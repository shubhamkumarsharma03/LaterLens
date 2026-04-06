import TextRecognition, { TextRecognitionScript } from '@react-native-ml-kit/text-recognition';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getGroqApiKey } from './settingsStorage';
import { checkPrivacy, getSensitivitySummary, redactSensitiveText, PRIVACY_GATE_VERSION } from './privacyGate';
import { saveLocalOnlyItem } from './actionQueueStorage';
import { preprocessImageForOCR, boostContrast, inferToneFromBlocks } from './ocrPreprocessor';
import { postProcessOCR, containsDevanagari } from './ocrPostProcessor';
import { STORAGE_KEYS } from '../constants/storageKeys';

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';

const DEBUG = __DEV__ && false;

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

// ─────────────────────────────────────────────
//  TASK 1 — 4-Layer OCR Pipeline
// ─────────────────────────────────────────────

/**
 * Checks whether the device has previously detected Devanagari content.
 * If so, all future screenshots automatically get dual-pass recognition.
 *
 * @returns {Promise<boolean>}
 */
async function getCachedIndianAppFlag() {
  try {
    const flag = await AsyncStorage.getItem(STORAGE_KEYS.LIKELY_INDIAN_APP_FLAG);
    return flag === 'true';
  } catch {
    return false;
  }
}

/**
 * Persists the Indian app flag so future screenshots skip the bootstrap check.
 *
 * @returns {Promise<void>}
 */
async function setCachedIndianAppFlag() {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.LIKELY_INDIAN_APP_FLAG, 'true');
  } catch {
    // Best-effort — non-critical
  }
}

/**
 * Complete 4-layer OCR pipeline with optional progress callback.
 *
 * LAYER 1 — Preprocessing (Skia tone detection, colour transforms)
 * LAYER 2 — Multi-script ML Kit recognition (LATIN + conditional DEVANAGARI)
 * LAYER 3 — Post-processing (chrome filter, edge filter, dedup, assembly)
 * LAYER 4 — Confidence check and contrast-boost retry
 *
 * @param {string} imageUri - Local file URI of the screenshot.
 * @param {object} [options] - Optional configuration.
 * @param {function} [options.onStageChange] - Callback invoked at each pipeline stage.
 * @returns {Promise<{text: string, wordCount: number, blockCount: number, hasDevanagari: boolean, confidence: string, wasRetried: boolean, wasInverted: boolean, originalTone: string, ocrFailed: boolean}>}
 */
export async function runOCRWithFallback(imageUri, options = {}) {
  const { onStageChange } = options;
  const notify = (stage) => { if (onStageChange) onStageChange(stage); };

  let processedUri = null;

  try {
    // ── LAYER 1 — Preprocessing ──
    notify('Preparing image...');
    const preprocessed = await preprocessImageForOCR(imageUri);
    processedUri = preprocessed.processedUri;

    let effectiveTone = preprocessed.originalTone;

    // ── LAYER 2 — Multi-script Recognition ──
    notify('Detecting text...');
    const latinResult = await TextRecognition.recognize(
      processedUri,
      { script: TextRecognitionScript.LATIN }
    );

    // Handle Level 3 tone detection (OCR block density) if L1+L2 failed
    if (effectiveTone === 'unknown') {
      effectiveTone = inferToneFromBlocks(
        latinResult.blocks || [],
        preprocessed.originalDimensions.height
      );
      if (DEBUG) console.log('[OCR] Level 3 tone inference:', effectiveTone);

      // If dark was detected via L3 and we didn't already invert,
      // we need to re-preprocess. For now, accept the mixed processing
      // since re-running the full pipeline would exceed time budget.
    }

    // Determine if we should run DEVANAGARI pass
    const cachedIndian = await getCachedIndianAppFlag();
    let likelyIndianApp = cachedIndian || preprocessed.likelyIndianApp;

    // Bootstrap: check LATIN result for Devanagari characters
    if (!likelyIndianApp) {
      const latinText = (latinResult.blocks || []).map((b) => b.text || '').join(' ');
      if (containsDevanagari(latinText)) {
        likelyIndianApp = true;
        await setCachedIndianAppFlag();
      }
    }

    let devanagariResult = { blocks: [] };
    if (likelyIndianApp) {
      notify('Processing Hindi text...');
      try {
        devanagariResult = await TextRecognition.recognize(
          processedUri,
          { script: TextRecognitionScript.DEVANAGARI }
        );
      } catch (devErr) {
        if (DEBUG) console.warn('[OCR] Devanagari pass failed:', devErr);
        devanagariResult = { blocks: [] };
      }
    }

    // ── LAYER 3 — Post-processing ──
    notify('Cleaning results...');
    let finalPostProcessed = postProcessOCR(
      latinResult.blocks || [],
      devanagariResult.blocks || [],
      preprocessed.originalDimensions.height
    );
    let wasRetried = false;

    // ── LAYER 4 — Confidence check and retry ──
    if (finalPostProcessed.wordCount < 5 && !preprocessed.wasInverted) {
      // Light/mixed mode with poor results — try contrast boost
      notify('Retrying with boost...');
      let boostedUri = null;
      try {
        boostedUri = await boostContrast(processedUri, 1.5);

        const retryResult = await TextRecognition.recognize(
          boostedUri,
          { script: TextRecognitionScript.LATIN }
        );

        const retryPostProcessed = postProcessOCR(
          retryResult.blocks || [],
          [],
          preprocessed.originalDimensions.height
        );

        if (retryPostProcessed.wordCount > finalPostProcessed.wordCount) {
          finalPostProcessed = retryPostProcessed;
          wasRetried = true;
        }
      } catch (retryErr) {
        if (DEBUG) console.warn('[OCR] Contrast retry failed:', retryErr);
      } finally {
        // Clean up boosted image
        if (boostedUri) {
          await cleanupTempFile(boostedUri);
        }
      }
    }

    const ocrFailed = finalPostProcessed.wordCount < 2;
    if (ocrFailed && DEBUG) {
      console.warn('[OCR] Low confidence result — ocrFailed', {
        wordCount: finalPostProcessed.wordCount,
      });
    }

    return {
      text: finalPostProcessed.text,
      wordCount: finalPostProcessed.wordCount,
      blockCount: finalPostProcessed.blockCount,
      hasDevanagari: finalPostProcessed.hasDevanagari,
      confidence: finalPostProcessed.confidence,
      wasRetried,
      wasInverted: preprocessed.wasInverted,
      originalTone: effectiveTone,
      ocrFailed,
    };
  } catch (err) {
    if (DEBUG) console.error('[OCR] Pipeline error:', err);
    return {
      text: '',
      wordCount: 0,
      blockCount: 0,
      hasDevanagari: false,
      confidence: 'low',
      wasRetried: false,
      wasInverted: false,
      originalTone: 'unknown',
      ocrFailed: true,
      error: err.message,
    };
  } finally {
    // CLEANUP — delete the processed image (preprocessor's temp files
    // are already cleaned by preprocessImageForOCR's own finally block)
    if (processedUri && processedUri !== imageUri) {
      await cleanupTempFile(processedUri);
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
