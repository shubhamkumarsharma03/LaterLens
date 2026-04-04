import TextRecognition from '@react-native-ml-kit/text-recognition';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { getGroqApiKey } from './settingsStorage';
import { checkPrivacy, getSensitivitySummary, redactSensitiveText, PRIVACY_GATE_VERSION } from './privacyGate';
import { saveLocalOnlyItem } from './actionQueueStorage';

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';

// --- OCR PREPROCESSING CONSTANTS ---
// Max dimensions to prevent OOM on high-res devices (1440x3200 flagships)
const MAX_OCR_WIDTH = 1500;
const MAX_OCR_HEIGHT = 3000;
// Minimum width for ML Kit to produce usable results
const MIN_OCR_WIDTH = 1200;

// Regex to count meaningful English words (3+ alpha chars), filtering out
// symbols, numbers, and single-char tokens ML Kit over-counts on Indian UIs
const MEANINGFUL_WORD_REGEX = /\b[a-zA-Z]{3,}\b/g;

const FALLBACK_RESULT = {
  contentType: 'Idea',
  intent: 'Review',
  tags: ['unclassified', 'screenshot', 'pending'],
  suggestedAction: 'Review manually',
  summary: 'Could not confidently classify the screenshot.',
  extractedUrl: null,
};

async function getApiKey() {
  const savedKey = await getGroqApiKey();
  if (savedKey) return savedKey;

  // Fallback to .env only during local development
  if (__DEV__) {
    return process.env.EXPO_PUBLIC_GROQ_API_KEY || null;
  }
  
  return null;
}

export async function validateGroqKey(key) {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/models', {
      headers: {
        'Authorization': `Bearer ${key}`,
      },
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

const STRICT_SCHEMA_PROMPT = `You are a contextual screenshot analyzer.
Return only valid JSON with exactly these keys:
- contentType: string (one of Product, Study material, Idea, Code, Event, Receipt)
- intent: string (one of Buy, Read, Build, Attend, Pay, Review)
- tags: array of strings (3 to 5 concise clustering keywords)
- suggestedAction: string (short actionable command)
- summary: string (one sentence)
- extractedUrl: string (a primary URL, email mailto:, or deep link found in the text, or null if absolutely none exist)

Rules:
- Output must be strict JSON object only. No markdown, no extra keys, no explanation.
- If evidence is weak, infer best-effort values and keep summary honest.
- tags must be lowercase unless they are proper nouns.`;

function parseAiJsonResponse(rawText) {
  const trimmed = (rawText || '').trim();

  if (!trimmed) {
    throw new Error('AI Provider returned an empty response.');
  }

  let candidate = trimmed;
  const startIdx = candidate.indexOf('{');
  const endIdx = candidate.lastIndexOf('}');
  
  if (startIdx !== -1 && endIdx !== -1 && endIdx >= startIdx) {
    candidate = candidate.substring(startIdx, endIdx + 1);
  }

  const parsed = JSON.parse(candidate);

  return {
    contentType: String(parsed.contentType || FALLBACK_RESULT.contentType),
    intent: String(parsed.intent || FALLBACK_RESULT.intent),
    tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5).map((tag) => String(tag)) : FALLBACK_RESULT.tags,
    suggestedAction: String(parsed.suggestedAction || FALLBACK_RESULT.suggestedAction),
    summary: String(parsed.summary || FALLBACK_RESULT.summary),
    extractedUrl: parsed.extractedUrl ? String(parsed.extractedUrl) : FALLBACK_RESULT.extractedUrl,
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Safely deletes a temporary file created during OCR preprocessing.
 * Ignores errors — cleanup is best-effort, never blocks the pipeline.
 *
 * @param {string} uri - File URI to delete.
 */
async function cleanupTempFile(uri) {
  try {
    if (uri && uri.startsWith('file://')) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  } catch (_) {
    // Best-effort cleanup — ignore failures
  }
}

/**
 * Low-level OCR call. Does NOT preprocess — use runOCRWithFallback instead.
 *
 * @param {string} imageUri - Local file URI.
 * @returns {Promise<string>} Extracted text.
 */
export async function extractTextFromImage(imageUri) {
  if (!imageUri) {
    throw new Error('Missing image URI for OCR extraction.');
  }

  try {
    const result = await TextRecognition.recognize(imageUri);
    const text = (result?.text || '').trim();
    return text;
  } catch (error) {
    console.log('[OCR] Failed to extract text from image:', error);
    throw error;
  }
}

// ─────────────────────────────────────────────
//  TASK 1 — OCR Preprocessing & Retry Pipeline
// ─────────────────────────────────────────────

/**
 * Preprocesses an image for better OCR accuracy.
 *
 * - Caps dimensions at MAX_OCR_WIDTH × MAX_OCR_HEIGHT to prevent OOM on
 *   high-res flagships (1440×3200 on Redmi/Realme = 8–15 MB PNG per image).
 * - Upscales to MIN_OCR_WIDTH if too small for ML Kit.
 * - Always outputs PNG with compress: 1 (lossless) — JPEG artefacts destroy
 *   OCR accuracy at text edges.
 *
 * @param {string} imageUri - Local file URI.
 * @returns {Promise<{processedUri: string, wasContrastBoosted: boolean, originalWidth: number, processedWidth: number, tempFiles: string[]}>}
 */
export async function preprocessImageForOCR(imageUri) {
  // Collect temp URIs so callers can clean up after OCR
  const tempFiles = [];

  try {
    // Step 1 — Probe dimensions with a no-op manipulation
    const probe = await ImageManipulator.manipulateAsync(
      imageUri,
      [],
      { format: 'png', compress: 1 }
    );
    tempFiles.push(probe.uri);

    const originalWidth = probe.width;
    const originalHeight = probe.height;
    const actions = [];

    // Step 2 — Clamp oversized images DOWN to fit within budget
    if (originalWidth > MAX_OCR_WIDTH || originalHeight > MAX_OCR_HEIGHT) {
      // Scale proportionally so BOTH dimensions are within limits
      const scaleW = MAX_OCR_WIDTH / originalWidth;
      const scaleH = MAX_OCR_HEIGHT / originalHeight;
      const scale = Math.min(scaleW, scaleH); // pick tighter constraint
      actions.push({ resize: { width: Math.round(originalWidth * scale) } });
    }
    // Step 3 — Upscale tiny screenshots so ML Kit has enough pixels
    else if (originalWidth < MIN_OCR_WIDTH) {
      actions.push({ resize: { width: MIN_OCR_WIDTH } });
    }

    if (actions.length > 0) {
      const resized = await ImageManipulator.manipulateAsync(
        imageUri,
        actions,
        { format: 'png', compress: 1 }
      );
      tempFiles.push(resized.uri);
      return {
        processedUri: resized.uri,
        wasContrastBoosted: false,
        originalWidth,
        processedWidth: resized.width,
        tempFiles,
      };
    }

    // No resize needed — use the probe output directly
    return {
      processedUri: probe.uri,
      wasContrastBoosted: false,
      originalWidth,
      processedWidth: originalWidth,
      tempFiles,
    };
  } catch (error) {
    console.warn('[LaterLens OCR] ImageManipulator failed, falling back to original:', error);
    return {
      processedUri: imageUri,
      wasContrastBoosted: false,
      originalWidth: 0,
      processedWidth: 0,
      tempFiles, // still return any files created before the error
    };
  }
}

/**
 * Runs OCR with a contrast-boost fallback for dark-mode screenshots.
 *
 * Pipeline:
 *   1. Preprocess (resize/PNG)
 *   2. Recognise text
 *   3. If rawWordCount < 5, boost contrast/brightness and retry
 *   4. Keep result with HIGHER raw word count
 *   5. If BOTH < 3 raw words → ocrFailed: true
 *
 * Confidence is based on *meaningful* English words (3+ alpha chars) to
 * avoid over-counting ₹, numbers, dashes that ML Kit returns on dense
 * Indian app UIs (PhonePe, GPay, banking apps).
 *
 * All temp PNG files are cleaned up after OCR completes.
 *
 * @param {string} imageUri - Local file URI.
 * @returns {Promise<{text: string, wordCount: number, confidence: string, wasRetried: boolean, ocrFailed: boolean}>}
 */
export async function runOCRWithFallback(imageUri) {
  const preprocessed = await preprocessImageForOCR(imageUri);
  const allTempFiles = [...preprocessed.tempFiles];

  try {
    // Attempt 1 — recognise on preprocessed image
    let text = await extractTextFromImage(preprocessed.processedUri);
    let rawWordCount = text.split(/\s+/).filter(w => w.length > 0).length;
    let wasRetried = false;

    // Retry if raw token count is too low (< 5)
    if (rawWordCount < 5) {
      try {
        const boosted = await ImageManipulator.manipulateAsync(
          preprocessed.processedUri,
          [
            { contrast: 1.4 },    // lift contrast for dark backgrounds
            { brightness: 0.15 }, // slight brightness bump
          ],
          { format: 'png', compress: 1 }
        );
        allTempFiles.push(boosted.uri);

        const boostedText = await extractTextFromImage(boosted.uri);
        const boostedRawCount = boostedText.split(/\s+/).filter(w => w.length > 0).length;

        // Keep whichever attempt returned more words
        if (boostedRawCount > rawWordCount) {
          text = boostedText;
          rawWordCount = boostedRawCount;
          wasRetried = true;
        }
      } catch (e) {
        console.warn('[LaterLens OCR] Contrast boost failed:', e);
      }
    }

    // Mark as failed if both attempts produced < 3 raw tokens
    const ocrFailed = rawWordCount < 3;
    if (ocrFailed) {
      console.warn('[LaterLens OCR] Low confidence result — skipping AI processing', { rawWordCount });
    }

    // Confidence is based on meaningful English words, not raw token count.
    // Indian app screenshots often have 40+ ML Kit "words" where only 8 are
    // actual English — counting ₹, commas, dashes inflates the number.
    const meaningfulWordCount = (text.match(MEANINGFUL_WORD_REGEX) || []).length;
    let confidence = 'low';
    if (meaningfulWordCount >= 8) confidence = 'high';
    else if (meaningfulWordCount >= 3) confidence = 'medium';

    return {
      text,
      wordCount: rawWordCount,
      confidence,
      wasRetried,
      ocrFailed,
    };
  } finally {
    // CLEANUP — delete every temp PNG we created during this pipeline.
    // Without this, each screenshot generates orphaned PNGs in the cache dir.
    // On a user with 500 screenshots, that's potentially gigabytes of temp files.
    for (const uri of allTempFiles) {
      await cleanupTempFile(uri);
    }
  }
}

// ─────────────────────────────────────────────
//  TASK 3 — Coordinated Processing Pipeline
// ─────────────────────────────────────────────

/**
 * Main entry point for processing a single screenshot end-to-end.
 * OCR → Privacy Gate → Groq Analysis.
 *
 * Handles three terminal statuses:
 *   - 'ocr_failed'       → stored locally with requiresManualReview: true
 *   - 'privacy_blocked'  → stored locally with redacted text
 *   - 'success'          → AI-enriched metadata returned
 *
 * @param {string} imagePath - Local file URI of the screenshot.
 * @param {object} userSettings - Settings object containing privacyRules.
 * @returns {Promise<object>} Processing result with status field.
 */
export async function processScreenshot(imagePath, userSettings) {
  // STEP 1 — Run improved OCR
  // Wrapped in try-catch to distinguish:
  //   • ocrFailed: true  → ML Kit ran but returned < 3 words (empty screenshot, image-only)
  //   • thrown exception  → ML Kit could not run at all (corrupt image, unsupported format)
  // The distinction matters: ocrFailed items can be retried, errors usually cannot.
  let ocrResult;
  try {
    ocrResult = await runOCRWithFallback(imagePath);
  } catch (err) {
    console.error('[processScreenshot] OCR threw an exception:', err);
    const errorItem = {
      imagePath,
      imageUri: imagePath,
      status: 'ocr_error',
      requiresManualReview: true,
      message: `OCR engine error: ${err.message}`,
      error: err.message,
      sentToAI: false,
      privacyGateVersion: PRIVACY_GATE_VERSION,
      processedAt: new Date().toISOString(),
    };
    await saveLocalOnlyItem(errorItem);
    return errorItem;
  }

  // STEP 2 — Handle OCR failure (ran but returned too little text)
  if (ocrResult.ocrFailed) {
    const failedItem = {
      imagePath,
      imageUri: imagePath,
      status: 'ocr_failed',
      requiresManualReview: true,
      message: 'Could not extract text from this screenshot',
      sentToAI: false,
      ocrConfidence: ocrResult.confidence,
      privacyGateVersion: PRIVACY_GATE_VERSION,
      processedAt: new Date().toISOString(),
    };
    await saveLocalOnlyItem(failedItem);
    return failedItem;
  }

  // STEP 3 — Run privacy gate
  const privacyResult = checkPrivacy(ocrResult.text, userSettings);

  // STEP 4 — Handle privacy block
  if (!privacyResult.safe) {
    const redactedText = redactSensitiveText(ocrResult.text);
    const blockedItem = {
      imagePath,
      imageUri: imagePath,
      ocrText: redactedText,
      blockedBy: privacyResult.blockedBy,
      labels: privacyResult.labels,
      severity: privacyResult.severity,
      sentToAI: false,
      status: 'privacy_blocked',
      sensitivitySummary: getSensitivitySummary(ocrResult.text, userSettings),
      privacyGateVersion: PRIVACY_GATE_VERSION,
      processedAt: new Date().toISOString(),
    };
    await saveLocalOnlyItem(blockedItem);

    return {
      status: 'privacy_blocked',
      sentToAI: false,
      blockedBy: privacyResult.blockedBy,
      sensitivitySummary: getSensitivitySummary(ocrResult.text, userSettings),
    };
  }

  // STEP 5 — Send safe text to Groq
  try {
    const aiResult = await analyzeScreenshotContext(ocrResult.text);

    // STEP 6 — Return enriched result
    return {
      ...aiResult,
      ocrConfidence: ocrResult.confidence,
      wasOCRRetried: ocrResult.wasRetried,
      privacyCheckPassed: true,
      privacyGateVersion: PRIVACY_GATE_VERSION,
      sentToAI: true,
      status: 'success',
    };
  } catch (error) {
    console.error('[processScreenshot] AI analysis failed:', error);
    return {
      status: 'ai_failed',
      message: error.message,
      sentToAI: false,
    };
  }
}

export async function analyzeScreenshotContext(extractedText) {
  const apiKey = await getApiKey();

  if (!apiKey) {
    throw new Error('No Groq API Key found. Please add one in your Profile settings.');
  }

  const safeText = (extractedText || '').trim();

  if (!safeText) {
    console.log('[AI] No OCR text found. Returning fallback metadata.');
    return {
      ...FALLBACK_RESULT,
      summary: 'No readable text detected in the screenshot.',
    };
  }

  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      // 2-second throttle to stay within Groq free-tier limits (usually 30 RPM)
      if (attempts === 0) {
        console.log('[AI] Throttling for 2s (Groq optimization)...');
        await sleep(2000);
      }

      const response = await fetch(GROQ_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            {
              role: 'system',
              content: STRICT_SCHEMA_PROMPT,
            },
            {
              role: 'user',
              content: `OCR_TEXT:\n${safeText}`,
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
          max_tokens: 800,
        }),
      });

      if (response.status === 429) {
        attempts++;
        const backoff = Math.pow(2, attempts) * 5000;
        console.log(`[AI] Groq Limit hit (429). Retrying in ${backoff / 1000}s... (Attempt ${attempts}/${maxAttempts})`);
        await sleep(backoff);
        continue;
      }

      if (!response.ok) {
        const errorBody = await response.text();
        console.log('[AI] Groq request failed:', response.status, errorBody);
        throw new Error(`Groq request failed with status ${response.status}.`);
      }

      const payload = await response.json();
      const modelText = payload?.choices?.[0]?.message?.content || '';

      const parsed = parseAiJsonResponse(modelText); 
      console.log('[AI] Parsed screenshot metadata (Groq):', parsed);
      return parsed;

    } catch (error) {
      if (attempts >= maxAttempts - 1) throw error;
      attempts++;
      console.log(`[AI] Error during analysis. Retrying... (Attempt ${attempts}/${maxAttempts})`, error);
      await sleep(2000);
    }
  }

  throw new Error('Screenshot analysis failed after multiple attempts.');
}

export async function queryScreenshotLibrary(userMessage, allQueueItems) {
  const apiKey = await getApiKey();

  if (!apiKey) {
    throw new Error('No Groq API Key found. Please add one in your Profile settings.');
  }

  // Create a minimal context string for the LLM
  const contextData = allQueueItems
    .map(
      (item) =>
        `[ID: ${item.id}]
Date: ${new Date(item.timestamp).toLocaleDateString()}
Category: ${item.contentType}
Summary: ${item.summary}
Action: ${item.suggestedAction}
Tags: ${(item.tags || []).join(', ')}
${item.extractedUrl ? `URL: ${item.extractedUrl}` : ''}`
    )
    .join('\n\n');

  const systemPrompt = `You are the LaterLens AI assistant. Your job is to answer questions based ONLY on the user's screenshot library context provided below. Be concise.

If the user asks for something specific, you MUST mention the relevant screenshots by their IDs at the end of your response in the format: [IDS: id1, id2, ...].

USER'S SCREENSHOT LIBRARY:
${contextData}`;

  const response = await fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: `USER QUESTION: ${userMessage}`,
        },
      ],
      temperature: 0.2, // low temperature for factual retrieval
      max_tokens: 800,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.log('[AI] Groq Chat failed:', response.status, errorBody);
    throw new Error('Chat generation failed.');
  }

  const payload = await response.json();
  const text = payload?.choices?.[0]?.message?.content || '';
  return text.trim();
}
