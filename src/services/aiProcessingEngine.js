import TextRecognition from '@react-native-ml-kit/text-recognition';
import { getGroqApiKey } from './settingsStorage';

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';

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

export async function extractTextFromImage(imageUri) {
  if (!imageUri) {
    throw new Error('Missing image URI for OCR extraction.');
  }

  try {
    const result = await TextRecognition.recognize(imageUri);
    const text = (result?.text || '').trim();
    console.log('[OCR] Extracted text length:', text.length);
    return text;
  } catch (error) {
    console.log('[OCR] Failed to extract text from image:', error);
    throw error;
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
