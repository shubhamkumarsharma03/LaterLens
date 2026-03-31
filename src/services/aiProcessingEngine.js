import TextRecognition from '@react-native-ml-kit/text-recognition';

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

const FALLBACK_RESULT = {
  contentType: 'Idea',
  intent: 'Review',
  tags: ['unclassified', 'screenshot', 'pending'],
  suggestedAction: 'Review manually',
  summary: 'Could not confidently classify the screenshot.',
};

const STRICT_SCHEMA_PROMPT = `You are a contextual screenshot analyzer.
Return only valid JSON with exactly these keys:
- contentType: string (one of Product, Study material, Idea, Code, Event, Receipt)
- intent: string (one of Buy, Read, Build, Attend, Pay, Review)
- tags: array of strings (3 to 5 concise clustering keywords)
- suggestedAction: string (short actionable command)
- summary: string (one sentence)

Rules:
- Output must be strict JSON object only. No markdown, no extra keys, no explanation.
- If evidence is weak, infer best-effort values and keep summary honest.
- tags must be lowercase unless they are proper nouns.`;

function parseGeminiJson(rawText) {
  const trimmed = (rawText || '').trim();

  if (!trimmed) {
    throw new Error('Gemini returned an empty response.');
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fencedMatch?.[1] ? fencedMatch[1].trim() : trimmed;
  const parsed = JSON.parse(candidate);

  return {
    contentType: String(parsed.contentType || FALLBACK_RESULT.contentType),
    intent: String(parsed.intent || FALLBACK_RESULT.intent),
    tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5).map((tag) => String(tag)) : FALLBACK_RESULT.tags,
    suggestedAction: String(parsed.suggestedAction || FALLBACK_RESULT.suggestedAction),
    summary: String(parsed.summary || FALLBACK_RESULT.summary),
  };
}

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
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('EXPO_PUBLIC_GEMINI_API_KEY is missing.');
  }

  const safeText = (extractedText || '').trim();

  if (!safeText) {
    console.log('[AI] No OCR text found. Returning fallback metadata.');
    return {
      ...FALLBACK_RESULT,
      summary: 'No readable text detected in the screenshot.',
    };
  }

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${STRICT_SCHEMA_PROMPT}\n\nOCR_TEXT:\n${safeText}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 300,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.log('[AI] Gemini request failed:', response.status, errorBody);
    throw new Error(`Gemini request failed with status ${response.status}.`);
  }

  const payload = await response.json();
  const modelText = payload?.candidates?.[0]?.content?.parts?.[0]?.text || '';

  try {
    const parsed = parseGeminiJson(modelText);
    console.log('[AI] Parsed screenshot metadata:', parsed);
    return parsed;
  } catch (parseError) {
    console.log('[AI] Failed to parse Gemini JSON:', parseError, modelText);
    throw parseError;
  }
}
