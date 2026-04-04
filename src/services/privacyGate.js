/**
 * Privacy Gate Module for LaterLens
 *
 * Runs 100% on-device — no network calls, no async I/O.
 * Provides regex-based structural matching, keyword-density context detection,
 * and a safe-content allowlist to evaluate OCR text before sending to Groq.
 *
 * VERSION: 1.0.0
 * NO EXTERNAL DEPENDENCIES. PURE JAVASCRIPT (ES2022).
 * Can be unit-tested in Node without React Native.
 */

export const PRIVACY_GATE_VERSION = '1.0.0';
const DEBUG = typeof __DEV__ !== 'undefined' && __DEV__ && false;

// ─────────────────────────────────────────────────────────────────
// IMPORTANT — Why critical severity rules are NOT user-toggleable:
//
// Users cannot opt out of blocking card numbers, OTPs, Aadhaar,
// PINs, passwords, or bank account numbers because the consequence
// of accidental exposure (sending raw sensitive data to Groq's API
// over the network) is IRREVERSIBLE. Once the data leaves the
// device, there is no way to un-send it.
//
// High and medium severity rules ARE toggleable because the cost
// of a false positive (blocking a safe screenshot) outweighs the
// privacy risk for those categories. Examples: a travel blog
// mentioning "boarding pass" or a coding tutorial showing a
// placeholder API key.
//
// Critical rules have the INVERSE tradeoff — the privacy risk
// ALWAYS outweighs the convenience loss of a blocked screenshot.
// If a user's card number screenshot gets blocked unnecessarily,
// the worst case is they can't auto-classify it. If it gets sent
// to Groq, the worst case is financial identity theft.
//
// Do NOT make critical rules user-disableable without a thorough
// security review and explicit legal sign-off.
// ─────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────
//  SECTION A — STRUCTURAL PATTERN RULES
// ─────────────────────────────────────────────

/**
 * Regex rules that match sensitive data structures.
 * severity: 'critical' | 'high' | 'medium'
 * canUserDisable: false for critical, true otherwise
 * category: maps to userSettings.privacyRules toggle key
 */
export const STRUCTURAL_RULES = [
  // --- FINANCIAL ---
  {
    id: 'card_number',
    label: 'Credit/debit card number',
    category: 'blockFinancial',
    // 13-19 consecutive digits with optional spaces or dashes
    // Covers Visa 13/16, Mastercard 16, Amex 15, Discover 16, RuPay 16
    pattern: /\b(?:\d[ -]*?){13,19}\b/,
    severity: 'critical',
    canUserDisable: false,
  },
  {
    id: 'card_cvv',
    label: 'Card CVV',
    category: 'blockFinancial',
    // 3-4 digits appearing near keywords: cvv, cvc, security code, card verification
    pattern: /\b(?:cvv|cvc|security code|card verification)\b.{0,10}\b\d{3,4}\b/i,
    severity: 'critical',
    canUserDisable: false,
  },
  {
    id: 'card_expiry',
    label: 'Card expiry',
    category: 'blockFinancial',
    // MM/YY or MM/YYYY patterns near keywords: exp, expiry, valid thru, valid till
    pattern: /\b(?:exp|expiry|valid thru|valid till)\b.{0,10}\b\d{2}\/(\d{2}|\d{4})\b/i,
    severity: 'critical',
    canUserDisable: false,
  },
  {
    id: 'bank_account',
    label: 'Bank account number',
    category: 'blockFinancial',
    // 9-18 digit strings near keywords: account no, account number, a/c
    pattern: /\b(?:account no|account number|a\/c)\b.{0,10}\b\d{9,18}\b/i,
    severity: 'critical',
    canUserDisable: false,
  },
  {
    id: 'ifsc_code',
    label: 'IFSC code',
    category: 'blockFinancial',
    // Indian bank IFSC format — 4 uppercase letters + 0 + 6 alphanumeric
    pattern: /\b[A-Z]{4}0[A-Z0-9]{6}\b/,
    severity: 'critical',
    canUserDisable: false,
  },
  {
    id: 'swift_bic',
    label: 'SWIFT/BIC code',
    category: 'blockFinancial',
    // 8 or 11 character bank identifier codes
    pattern: /\b[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?\b/,
    severity: 'high',
    canUserDisable: true,
  },
  {
    id: 'upi_id',
    label: 'UPI ID',
    category: 'blockFinancial',
    // Indian payment UPI IDs: xxxx@xxxx
    pattern: /[\w.-]+@[\w.-]+/,
    severity: 'high',
    canUserDisable: true,
  },

  // --- AUTHENTICATION ---
  {
    id: 'otp',
    label: 'OTP / Verification code',
    category: 'blockAuth',
    // 4-8 digit codes near keywords: otp, one time, verification code, etc.
    pattern: /\b(?:otp|one time|verification code|authentication code|login code|security code)\b.{0,15}\b\d{4,8}\b/i,
    severity: 'critical',
    canUserDisable: false,
  },
  {
    id: 'password',
    label: 'Password',
    category: 'blockAuth',
    // Text containing "password:" or "pwd:" followed by any non-whitespace string
    pattern: /\b(?:password|pwd):[^\s]{3,}/i,
    severity: 'critical',
    canUserDisable: false,
  },
  {
    id: 'pin',
    label: 'PIN',
    category: 'blockAuth',
    // 4-6 digit number near keywords: pin, mpin, atm pin
    pattern: /\b(?:pin|mpin|atm pin)\b.{0,10}\b\d{4,6}\b/i,
    severity: 'critical',
    canUserDisable: false,
  },
  {
    id: 'private_key_seed',
    label: 'Private key or seed phrase',
    category: 'blockAuth',
    // Long hex strings (64 chars) or mnemonic seed phrases (12/24 words)
    pattern: /\b(?:[a-f0-9]{64})|(?:(?:\w+\s){11,23}\w+)\b/i,
    severity: 'critical',
    canUserDisable: false,
  },
  {
    id: 'api_key',
    label: 'API Key / Token',
    category: 'blockAuth',
    // Common patterns: sk-..., gsk_..., AIza..., Bearer + long string, or
    // 32+ char alphanumeric near keywords: api key, secret, token, authorization
    pattern: /\b(?:sk-|gsk_|AIza)[a-zA-Z0-9_-]{20,}|(?:Bearer\s[a-zA-Z0-9._-]{20,})|(?:api key|secret|token|authorization)\b.{0,10}\b[a-zA-Z0-9_-]{32,}\b/i,
    severity: 'high',
    canUserDisable: true,
  },

  // --- PERSONAL IDENTITY ---
  {
    id: 'aadhaar',
    label: 'Aadhaar number',
    category: 'blockPersonalId',
    // 12-digit number with or without spaces every 4 digits, optionally preceded by Aadhaar/UID
    pattern: /\b(?:Aadhaar|UID)?\s?\d{4}\s\d{4}\s\d{4}\b|\b\d{12}\b/,
    severity: 'critical',
    canUserDisable: false,
  },
  {
    id: 'pan_card',
    label: 'PAN card',
    category: 'blockPersonalId',
    // Indian PAN format — 5 uppercase letters + 4 digits + 1 uppercase letter
    pattern: /\b[A-Z]{5}\d{4}[A-Z]{1}\b/,
    severity: 'critical',
    canUserDisable: false,
  },
  {
    id: 'passport',
    label: 'Passport number',
    category: 'blockPersonalId',
    // Indian format: letter + 7 digits, or generic passport patterns near keyword
    pattern: /\b[A-Z][0-9]{7}\b|\bpassport\b.{0,15}\b[A-Z0-9]{6,12}\b/i,
    severity: 'high',
    canUserDisable: true,
  },
  {
    id: 'driving_licence',
    label: 'Driving licence',
    category: 'blockPersonalId',
    // Indian DL format: 2 letters + 2 digits + 11 digits = 15 chars
    pattern: /\b[A-Z]{2}[0-9]{2}[0-9]{11}\b/i,
    severity: 'high',
    canUserDisable: true,
  },
  {
    id: 'dob',
    label: 'Date of birth',
    category: 'blockPersonalId',
    // Date patterns near keywords: dob, date of birth, born on, birth date
    pattern: /\b(?:dob|date of birth|born on|birth date)\b.{0,15}\b\d{1,2}[-\/\s]\d{1,2}[-\/\s]\d{2,4}\b/i,
    severity: 'medium',
    canUserDisable: true,
  },

  // --- CONTACT / COMMUNICATION ---
  {
    id: 'phone',
    label: 'Phone number',
    category: 'blockContacts',
    // 10-digit Indian mobile numbers (6-9) with label/keyword nearby
    // Only matches when found with a name or label to avoid matching order numbers
    pattern: /\b(?:mobile|phone|tel|whatsapp):?\s?(?:\+91|91)?\s?[6-9]\d{9}\b/i,
    severity: 'medium',
    canUserDisable: true,
  },
  {
    id: 'email',
    label: 'Email address',
    category: 'blockContacts',
    // Standard email regex only near credential keywords: email, login, username
    pattern: /\b(?:email|login|username):?\s?[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}\b/i,
    severity: 'medium',
    canUserDisable: true,
  },
  {
    id: 'chat_indicators',
    label: 'Private chat trace',
    category: 'blockChats',
    // WhatsApp, iMessage, Telegram, Signal at top of text, or ✓✓ tick marks,
    // or timestamps in HH:MM format repeated on separate lines
    pattern: /\b(?:WhatsApp|iMessage|Telegram|Signal)\b|✓✓|\d{1,2}:\d{2}\s?(?:am|pm)?\s*\n.*(?:\d{1,2}:\d{2})/i,
    severity: 'high',
    canUserDisable: true,
  },

  // --- MEDICAL ---
  {
    id: 'medical_prescription',
    label: 'Prescription details',
    category: 'blockMedical',
    // Keywords: Rx, prescription, dosage, mg tablet, ml syrup, prescribed by Dr.
    pattern: /\b(?:Rx|prescription|dosage|mg tablet|ml syrup|prescribed by Dr\.)\b/i,
    severity: 'high',
    canUserDisable: true,
  },
  {
    id: 'medical_record_no',
    label: 'Medical record number',
    category: 'blockMedical',
    // MRN or patient ID patterns
    pattern: /\b(?:MRN|patient ID)\b.{0,10}\b[A-Z0-9-]{4,}\b/i,
    severity: 'high',
    canUserDisable: true,
  },
];

// ─────────────────────────────────────────────
//  SECTION B — KEYWORD DENSITY RULES
// ─────────────────────────────────────────────

/**
 * Trigger when a COMBINATION of sensitive keywords appears together.
 */
export const KEYWORD_DENSITY_RULES = [
  {
    id: 'financial_context',
    label: 'Banking or financial statement context',
    category: 'blockFinancial',
    keywords: [
      'balance', 'statement', 'transaction', 'debit', 'credit', 'transfer',
      'withdrawal', 'deposit', 'net banking', 'mobile banking', 'upi',
      'payment', 'amount', 'rupees', 'inr', '₹'
    ],
    minimumMatches: 4,
    severity: 'high',
  },
  {
    id: 'medical_context',
    label: 'Medical or health record context',
    category: 'blockMedical',
    keywords: [
      'diagnosis', 'prescribed', 'symptoms', 'treatment', 'patient',
      'doctor', 'hospital', 'clinic', 'medicine', 'tablet', 'mg', 'dosage',
      'blood pressure', 'sugar level', 'hemoglobin', 'test report'
    ],
    minimumMatches: 3,
    severity: 'high',
  },
  {
    id: 'legal_context',
    label: 'Legal document context',
    category: 'blockPersonalId',
    keywords: [
      'affidavit', 'notarized', 'court order', 'judgement', 'fir',
      'case number', 'advocate', 'plaintiff', 'defendant', 'hereby'
    ],
    minimumMatches: 3,
    severity: 'medium',
  },
  {
    id: 'private_conversation_context',
    label: 'Private messaging conversation context',
    category: 'blockChats',
    keywords: [
      'replied', 'typing...', 'seen', 'delivered', 'read receipt',
      'voice message', 'photo', 'sticker', 'emoji', 'react'
    ],
    minimumMatches: 3,
    severity: 'high',
  },
];

// ─────────────────────────────────────────────
//  SECTION C — SAFE CONTENT ALLOWLIST
// ─────────────────────────────────────────────

/**
 * Patterns that override 'medium' and 'high' severity blocks.
 * NEVER overrides 'critical' — this is enforced in checkPrivacy().
 */
export const SAFE_ALLOWLIST = [
  {
    id: 'order_confirmation',
    // E-commerce: "order confirmed", "order placed", etc.
    pattern: /order confirmed|order placed|order id|track your order|estimated delivery/i,
  },
  {
    id: 'food_delivery',
    // Food delivery apps: "your food is on the way", etc.
    pattern: /your food is on the way|out for delivery|rate your experience|reorder/i,
  },
  {
    id: 'travel_booking',
    // Travel booking confirmations — only overrides medium/high, never critical
    // since boarding passes can contain passport details (caught by 'passport' rule
    // which is 'high' severity — but if passport number IS present, the 'passport'
    // structural rule fires and the severity escalates, and the allowlist won't help)
    pattern: /booking confirmed|pnr|e-ticket|check-in|boarding pass/i,
  },
  {
    id: 'app_store',
    // App store / play store screenshots
    pattern: /\b(?:install|in-app purchases|ratings and reviews|get|open)\b/i,
  },
  {
    id: 'news_article',
    // News articles: long text with journalistic keywords
    pattern: /\b(?:published|reporter|according to|said in a statement)\b/i,
  },
];

// ─────────────────────────────────────────────
//  SECTION D — MAIN EXPORT: checkPrivacy()
// ─────────────────────────────────────────────

/**
 * Evaluates OCR text against all privacy rules and user settings.
 *
 * @param {string} ocrText - The full OCR-extracted text from the screenshot.
 * @param {object} userSettings - Object from SettingsContext with shape:
 *   { privacyRules: { blockFinancial, blockAuth, blockPersonalId, blockContacts, blockMedical, blockChats } }
 * @returns {{
 *   safe: boolean,
 *   blockedBy: string[],
 *   labels: string[],
 *   severity: string|null,
 *   overriddenByAllowlist: boolean,
 *   debugInfo: object
 * }}
 */
export function checkPrivacy(ocrText, userSettings = null) {
  const startTime = Date.now();

  // Default all rules enabled if settings missing
  const settings = userSettings?.privacyRules || {
    blockFinancial: true,
    blockAuth: true,
    blockPersonalId: true,
    blockContacts: true,
    blockMedical: true,
    blockChats: true,
  };

  // 1. Handle edge cases: null, undefined, empty, whitespace-only
  if (!ocrText || typeof ocrText !== 'string' || ocrText.trim().length === 0) {
    return {
      safe: false,
      blockedBy: ['empty_text'],
      labels: ['Empty content'],
      severity: null,
      overriddenByAllowlist: false,
      debugInfo: {
        structuralRulesChecked: 0,
        keywordRulesChecked: 0,
        allowlistChecked: false,
        processingTimeMs: 0,
        version: PRIVACY_GATE_VERSION,
      },
    };
  }

  // 2. Normalise — collapse whitespace, keep original for display
  const normalized = ocrText.replace(/\s+/g, ' ').trim();
  const lowerText = normalized.toLowerCase();

  const triggeredStructural = [];
  const triggeredKeyword = [];
  let allowlistMatch = false;

  // 3. Run STRUCTURAL_RULES
  for (const rule of STRUCTURAL_RULES) {
    // Skip user-disableable rules if the corresponding toggle is off.
    // canUserDisable is false for 'critical' rules — they always run.
    if (rule.canUserDisable && !settings[rule.category]) {
      continue;
    }

    if (rule.pattern.test(normalized)) {
      triggeredStructural.push(rule);
    }
  }

  // 4. Run KEYWORD_DENSITY_RULES
  for (const rule of KEYWORD_DENSITY_RULES) {
    if (!settings[rule.category]) continue;

    let matchCount = 0;
    for (const kw of rule.keywords) {
      if (lowerText.includes(kw.toLowerCase())) matchCount++;
    }

    if (matchCount >= rule.minimumMatches) {
      triggeredKeyword.push(rule);
    }
  }

  // 5. Check SAFE_ALLOWLIST
  for (const entry of SAFE_ALLOWLIST) {
    if (entry.pattern.test(normalized)) {
      allowlistMatch = true;
      break; // one match is sufficient
    }
  }

  // 6. Determine final result
  const allTriggered = [...triggeredStructural, ...triggeredKeyword];
  const SEVERITY_WEIGHTS = { critical: 3, high: 2, medium: 1 };

  const highestSeverity = allTriggered.reduce((max, rule) => {
    return (SEVERITY_WEIGHTS[rule.severity] || 0) > (SEVERITY_WEIGHTS[max] || 0)
      ? rule.severity
      : max;
  }, null);

  let safe = true;
  let overriddenByAllowlist = false;

  if (highestSeverity === 'critical') {
    // NEVER override critical — regardless of allowlist
    safe = false;
  } else if (highestSeverity === 'high' || highestSeverity === 'medium') {
    if (allowlistMatch) {
      safe = true;
      overriddenByAllowlist = true;
    } else {
      safe = false;
    }
  }
  // else: no rules triggered → safe stays true

  const processingTimeMs = Date.now() - startTime;

  return {
    safe,
    blockedBy: allTriggered.map(r => r.id),
    labels: allTriggered.map(r => r.label),
    severity: highestSeverity,
    overriddenByAllowlist,
    debugInfo: {
      structuralRulesChecked: STRUCTURAL_RULES.length,
      keywordRulesChecked: KEYWORD_DENSITY_RULES.length,
      allowlistChecked: true,
      processingTimeMs,
      version: PRIVACY_GATE_VERSION,
    },
  };
}

// ─────────────────────────────────────────────
//  SECTION E — ADDITIONAL EXPORTS
// ─────────────────────────────────────────────

/**
 * Returns a SHORT user-facing string for the UI (max 50 chars).
 *
 * @param {string} ocrText - OCR text.
 * @param {object} userSettings - Settings object.
 * @returns {string} Summary string.
 */
export function getSensitivitySummary(ocrText, userSettings) {
  const result = checkPrivacy(ocrText, userSettings);

  if (result.safe) {
    return result.overriddenByAllowlist
      ? 'Safe context — sent to AI'
      : 'Sent to AI for processing';
  }

  if (result.blockedBy.includes('empty_text')) return 'No text detected';

  // Pick the most important triggered rule's label
  const topLabel = result.labels[0] || 'Sensitive content';
  const summary = `Contains ${topLabel} — not sent to AI`;
  return summary.substring(0, 50);
}

/**
 * Redacts sensitive patterns from text using type-aware tags.
 * Format: [REDACTED:TYPE] where TYPE is the rule id in uppercase.
 *
 * Uses a curated set of REDACTION_PATTERNS rather than reusing the
 * detection patterns from STRUCTURAL_RULES. Detection patterns use
 * lazy quantifiers optimised for regex.test() which break under
 * global replace() (e.g., card_number regex matches single digits).
 *
 * If > 60% of the text would be redacted, returns a fully redacted placeholder
 * to avoid storing a string that's mostly tags with no context.
 *
 * @param {string} ocrText - Raw OCR text.
 * @returns {string} Redacted text.
 */

// Tight redaction patterns — designed for global replace(), not detection
const REDACTION_PATTERNS = [
  // Card numbers: 13-19 digits with spaces or dashes (greedy, anchored)
  { tag: 'CARD_NUMBER', pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{1,7}\b/g },
  // CVV near keyword
  { tag: 'CARD_CVV', pattern: /\b(?:cvv|cvc|security code)\b[:\s]*\d{3,4}\b/gi },
  // Card expiry
  { tag: 'CARD_EXPIRY', pattern: /\b(?:exp|expiry|valid thru|valid till)\b[:\s]*\d{2}\/\d{2,4}\b/gi },
  // OTP near keyword
  { tag: 'OTP', pattern: /\b(?:otp|one time|verification code|authentication code|login code|security code)\b[:\s]*\d{4,8}\b/gi },
  // Password field
  { tag: 'PASSWORD', pattern: /\b(?:password|pwd):[^\s]{3,}/gi },
  // PIN near keyword
  { tag: 'PIN', pattern: /\b(?:pin|mpin|atm pin)\b[:\s]*\d{4,6}\b/gi },
  // Aadhaar (spaced or unspaced)
  { tag: 'AADHAAR', pattern: /\b\d{4}\s\d{4}\s\d{4}\b/g },
  // PAN card
  { tag: 'PAN_CARD', pattern: /\b[A-Z]{5}\d{4}[A-Z]\b/g },
  // API keys
  { tag: 'API_KEY', pattern: /\b(?:sk-|gsk_|AIza)[a-zA-Z0-9_-]{20,}/g },
  // Bearer tokens
  { tag: 'API_KEY', pattern: /Bearer\s[a-zA-Z0-9._-]{20,}/g },
  // Phone number with label
  { tag: 'PHONE', pattern: /\b(?:mobile|phone|tel|whatsapp):?\s?(?:\+91|91)?\s?[6-9]\d{9}\b/gi },
  // Email with label
  { tag: 'EMAIL', pattern: /\b(?:email|login|username):?\s?[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}\b/gi },
  // Bank account with keyword
  { tag: 'BANK_ACCOUNT', pattern: /\b(?:account no|account number|a\/c)\b[:\s]*\d{9,18}\b/gi },
  // IFSC
  { tag: 'IFSC_CODE', pattern: /\b[A-Z]{4}0[A-Z0-9]{6}\b/g },
];

export function redactSensitiveText(ocrText) {
  if (!ocrText) return '';

  let redacted = ocrText;
  const originalLen = ocrText.length;
  let totalCharsRedacted = 0;

  for (const { tag, pattern } of REDACTION_PATTERNS) {
    // Reset lastIndex for global regexes reused across calls
    pattern.lastIndex = 0;
    redacted = redacted.replace(pattern, (match) => {
      totalCharsRedacted += match.length;
      return `[REDACTED:${tag}]`;
    });
  }

  // If we've replaced more than 60% of the original text, fully redact.
  if (totalCharsRedacted > originalLen * 0.6) {
    return '[Content too sensitive to store]';
  }

  return redacted;
}
