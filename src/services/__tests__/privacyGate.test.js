/**
 * Unit tests for privacyGate.js
 *
 * Pure JS — no React Native dependencies required.
 *
 * Tests cover:
 *  - All 20+ structural rules individually
 *  - Edge cases: empty, null, whitespace, emojis-only
 *  - Allowlist override for medium/high severity
 *  - Allowlist override BLOCKED for critical severity
 *  - Keyword density rules
 *  - 60% redaction threshold in redactSensitiveText
 *  - Type-aware redaction tags
 *  - getSensitivitySummary output
 */

// Minimal shim for __DEV__ (used by the module)
globalThis.__DEV__ = false;

const {
  checkPrivacy,
  redactSensitiveText,
  getSensitivitySummary,
  STRUCTURAL_RULES,
  KEYWORD_DENSITY_RULES,
  SAFE_ALLOWLIST,
  PRIVACY_GATE_VERSION,
} = require('../privacyGate');

const ALL_ENABLED = {
  privacyRules: {
    blockFinancial: true,
    blockAuth: true,
    blockPersonalId: true,
    blockContacts: true,
    blockMedical: true,
    blockChats: true,
  },
};

// ─── EDGE CASES ──────────────────────────────────

describe('Edge Cases', () => {
  test('null input → blocked', () => {
    const r = checkPrivacy(null, ALL_ENABLED);
    expect(r.safe).toBe(false);
    expect(r.blockedBy).toContain('empty_text');
  });

  test('undefined input → blocked', () => {
    const r = checkPrivacy(undefined, ALL_ENABLED);
    expect(r.safe).toBe(false);
    expect(r.blockedBy).toContain('empty_text');
  });

  test('empty string → blocked', () => {
    const r = checkPrivacy('', ALL_ENABLED);
    expect(r.safe).toBe(false);
    expect(r.blockedBy).toContain('empty_text');
  });

  test('whitespace-only → blocked', () => {
    const r = checkPrivacy('   \n\t  ', ALL_ENABLED);
    expect(r.safe).toBe(false);
    expect(r.blockedBy).toContain('empty_text');
  });

  test('emojis-only → safe (no rules triggered)', () => {
    const r = checkPrivacy('😀🎉🔥💯', ALL_ENABLED);
    expect(r.safe).toBe(true);
  });

  test('missing userSettings → defaults to all rules enabled, safe text passes', () => {
    const r = checkPrivacy('Hello world, this is safe text');
    expect(r.safe).toBe(true);
  });
});

// ─── STRUCTURAL RULES — FINANCIAL ────────────────

describe('Financial Rules', () => {
  test('Card number detected', () => {
    const r = checkPrivacy('My card number is 4111 1111 1111 1111', ALL_ENABLED);
    expect(r.safe).toBe(false);
    expect(r.blockedBy).toContain('card_number');
  });

  test('Card number severity is critical', () => {
    const r = checkPrivacy('My card number is 4111 1111 1111 1111', ALL_ENABLED);
    expect(r.severity).toBe('critical');
  });

  test('CVV detected', () => {
    const r = checkPrivacy('CVV: 123 on the back', ALL_ENABLED);
    expect(r.safe).toBe(false);
    expect(r.blockedBy).toContain('card_cvv');
  });

  test('Card expiry detected', () => {
    const r = checkPrivacy('Expiry date: 12/2025', ALL_ENABLED);
    expect(r.safe).toBe(false);
    expect(r.blockedBy).toContain('card_expiry');
  });

  test('Bank account detected', () => {
    const r = checkPrivacy('Account Number: 123456789012345', ALL_ENABLED);
    expect(r.safe).toBe(false);
    expect(r.blockedBy).toContain('bank_account');
  });

  test('IFSC code detected', () => {
    const r = checkPrivacy('Transfer to HDFC0001234', ALL_ENABLED);
    expect(r.safe).toBe(false);
    expect(r.blockedBy).toContain('ifsc_code');
  });

  test('SWIFT/BIC code detected', () => {
    const r = checkPrivacy('SWIFT code HDFCINBBXXX for transfer', ALL_ENABLED);
    expect(r.blockedBy).toContain('swift_bic');
  });

  test('UPI ID detected', () => {
    const r = checkPrivacy('Pay to user@upi', ALL_ENABLED);
    expect(r.blockedBy).toContain('upi_id');
  });
});

// ─── STRUCTURAL RULES — AUTHENTICATION ───────────

describe('Authentication Rules', () => {
  test('OTP detected', () => {
    const r = checkPrivacy('Your OTP is 789456. Do not share.', ALL_ENABLED);
    expect(r.safe).toBe(false);
    expect(r.blockedBy).toContain('otp');
  });

  test('OTP severity is critical', () => {
    const r = checkPrivacy('Your OTP is 789456. Do not share.', ALL_ENABLED);
    expect(r.severity).toBe('critical');
  });

  test('Password detected', () => {
    const r = checkPrivacy('password:MySecret123!', ALL_ENABLED);
    expect(r.safe).toBe(false);
    expect(r.blockedBy).toContain('password');
  });

  test('PIN detected', () => {
    const r = checkPrivacy('Enter your mpin 4567 to continue', ALL_ENABLED);
    expect(r.safe).toBe(false);
    expect(r.blockedBy).toContain('pin');
  });

  test('API key (sk-) detected', () => {
    const r = checkPrivacy('sk-abcdefghijklmnopqrstuvwxyz12345', ALL_ENABLED);
    expect(r.blockedBy).toContain('api_key');
  });

  test('Bearer token detected', () => {
    const r = checkPrivacy('Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6', ALL_ENABLED);
    expect(r.blockedBy).toContain('api_key');
  });
});

// ─── STRUCTURAL RULES — PERSONAL IDENTITY ────────

describe('Personal Identity Rules', () => {
  test('Aadhaar (spaced) detected', () => {
    const r = checkPrivacy('Aadhaar 1234 5678 9012', ALL_ENABLED);
    expect(r.safe).toBe(false);
    expect(r.blockedBy).toContain('aadhaar');
  });

  test('Aadhaar (12-digit) detected', () => {
    const r = checkPrivacy('UID 123456789012', ALL_ENABLED);
    expect(r.blockedBy).toContain('aadhaar');
  });

  test('PAN card detected', () => {
    const r = checkPrivacy('PAN: ABCDE1234F', ALL_ENABLED);
    expect(r.safe).toBe(false);
    expect(r.blockedBy).toContain('pan_card');
  });

  test('PAN severity is critical', () => {
    const r = checkPrivacy('PAN: ABCDE1234F', ALL_ENABLED);
    expect(r.severity).toBe('critical');
  });

  test('Passport number detected', () => {
    const r = checkPrivacy('Passport A1234567', ALL_ENABLED);
    expect(r.blockedBy).toContain('passport');
  });

  test('Driving licence detected', () => {
    const r = checkPrivacy('DL: MH0112345678901', ALL_ENABLED);
    expect(r.blockedBy).toContain('driving_licence');
  });

  test('DOB detected', () => {
    const r = checkPrivacy('Date of Birth: 15/03/1990', ALL_ENABLED);
    expect(r.blockedBy).toContain('dob');
  });
});

// ─── STRUCTURAL RULES — CONTACT ──────────────────

describe('Contact Rules', () => {
  test('Phone number detected', () => {
    const r = checkPrivacy('Mobile: 9876543210', ALL_ENABLED);
    expect(r.blockedBy).toContain('phone');
  });

  test('Email detected', () => {
    const r = checkPrivacy('email: user@example.com', ALL_ENABLED);
    expect(r.blockedBy).toContain('email');
  });

  test('Chat indicator (WhatsApp) detected', () => {
    const r = checkPrivacy('WhatsApp group: Family', ALL_ENABLED);
    expect(r.blockedBy).toContain('chat_indicators');
  });
});

// ─── STRUCTURAL RULES — MEDICAL ──────────────────

describe('Medical Rules', () => {
  test('Prescription detected', () => {
    const r = checkPrivacy('Rx: Take 2 tablets daily after meals', ALL_ENABLED);
    expect(r.blockedBy).toContain('medical_prescription');
  });

  test('Medical record number detected', () => {
    const r = checkPrivacy('Patient ID PID-2024-0001 admitted', ALL_ENABLED);
    expect(r.blockedBy).toContain('medical_record_no');
  });
});

// ─── KEYWORD DENSITY RULES ─────────────────────

describe('Keyword Density Rules', () => {
  test('Financial context triggered (5 keywords)', () => {
    const r = checkPrivacy('Your balance is ₹5000. Last transaction debit of payment ₹200 via upi', ALL_ENABLED);
    expect(r.blockedBy).toContain('financial_context');
  });

  test('Medical context triggered', () => {
    const r = checkPrivacy('Patient diagnosis shows symptoms requiring treatment at hospital', ALL_ENABLED);
    expect(r.blockedBy).toContain('medical_context');
  });

  test('Legal context triggered', () => {
    const r = checkPrivacy('This affidavit is hereby notarized by the advocate', ALL_ENABLED);
    expect(r.blockedBy).toContain('legal_context');
  });

  test('Private conversation context triggered', () => {
    const r = checkPrivacy('Message delivered and seen. Voice message with photo attached.', ALL_ENABLED);
    expect(r.blockedBy).toContain('private_conversation_context');
  });
});

// ─── ALLOWLIST OVERRIDE — HIGH/MEDIUM ────────────

describe('Allowlist Override (Non-Critical)', () => {
  test('UPI in order confirmation is overridden by allowlist', () => {
    const r = checkPrivacy('Order confirmed! Pay to shop@upi. Track your order here.', ALL_ENABLED);
    expect(r.safe).toBe(true);
    expect(r.overriddenByAllowlist).toBe(true);
  });

  test('Phone number in food delivery overridden', () => {
    const r = checkPrivacy('Your food is on the way. Mobile: 9876543210', ALL_ENABLED);
    expect(r.safe).toBe(true);
    expect(r.overriddenByAllowlist).toBe(true);
  });
});

// ─── ALLOWLIST OVERRIDE — CRITICAL (MUST BLOCK) ──

describe('Allowlist Override BLOCKED for Critical', () => {
  test('Card number on boarding pass is NOT overridden by travel allowlist', () => {
    const r = checkPrivacy('Boarding pass confirmed. PNR ABC123. Card: 4111 1111 1111 1111', ALL_ENABLED);
    expect(r.safe).toBe(false);
    expect(r.severity).toBe('critical');
    expect(r.overriddenByAllowlist).toBe(false);
  });

  test('OTP in order confirmation is NOT overridden', () => {
    const r = checkPrivacy('Order confirmed! OTP is 456789 for verification.', ALL_ENABLED);
    expect(r.safe).toBe(false);
    expect(r.severity).toBe('critical');
  });
});

// ─── REDACTION ──────────────────────────────────

describe('Type-Aware Redaction', () => {
  test('Card number redacted with type tag', () => {
    const cardText = 'Use card 4111 1111 1111 1111 for payment';
    const redacted = redactSensitiveText(cardText);
    expect(redacted).toContain('[REDACTED:CARD_NUMBER]');
    expect(redacted).not.toContain('4111');
  });

  test('PAN redacted with type tag', () => {
    const panText = 'PAN is ABCDE1234F filed';
    const redacted = redactSensitiveText(panText);
    expect(redacted).toContain('[REDACTED:PAN_CARD]');
    expect(redacted).not.toContain('ABCDE1234F');
  });

  test('60% threshold triggers full redaction', () => {
    const text = '4111111111111111 4222222222222222 4333333333333333 4444444444444444';
    const redacted = redactSensitiveText(text);
    expect(redacted).toBe('[Content too sensitive to store]');
  });
});

// ─── SENSITIVITY SUMMARY ────────────────────────

describe('Sensitivity Summary', () => {
  test('Safe text summary', () => {
    const s = getSensitivitySummary('Safe harmless text', ALL_ENABLED);
    expect(s).toBe('Sent to AI for processing');
  });

  test('Blocked summary ≤ 50 chars and mentions not sent', () => {
    const s = getSensitivitySummary('Your OTP is 123456', ALL_ENABLED);
    expect(s.length).toBeLessThanOrEqual(50);
    expect(s).toContain('not sent to AI');
  });

  test('Null text summary', () => {
    const s = getSensitivitySummary(null, ALL_ENABLED);
    expect(s).toBe('No text detected');
  });
});

// ─── USER TOGGLE TESTS (DISABLING RULES) ─────────

describe('User Toggle Tests', () => {
  const noFinancial = {
    privacyRules: {
      blockFinancial: false,
      blockAuth: true,
      blockPersonalId: true,
      blockContacts: true,
      blockMedical: true,
      blockChats: true,
    },
  };

  test('UPI ID skipped when blockFinancial is false', () => {
    const r = checkPrivacy('Pay to user@upi for order', noFinancial);
    expect(r.blockedBy).not.toContain('upi_id');
  });

  test('Card number STILL detected even with blockFinancial off (critical)', () => {
    const r = checkPrivacy('Card 4111 1111 1111 1111', noFinancial);
    expect(r.blockedBy).toContain('card_number');
  });
});

// ─── VERSION FIELD ──────────────────────────────

describe('Version Check', () => {
  test('Version included in debugInfo', () => {
    const r = checkPrivacy('Safe text', ALL_ENABLED);
    expect(r.debugInfo.version).toBe('1.0.0');
  });
});
