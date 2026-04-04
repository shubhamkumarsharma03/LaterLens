/**
 * Unit tests for privacyGate.js
 *
 * Pure JS — no React Native dependencies required.
 * Run with: node src/services/__tests__/privacyGate.test.js
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

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.error(`  ❌ FAILED: ${label}`);
  }
}

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

console.log('\n── PRIVACY GATE TESTS ──\n');
console.log(`Module version: ${PRIVACY_GATE_VERSION}`);
console.log(`Structural rules count: ${STRUCTURAL_RULES.length}`);
console.log(`Keyword density rules count: ${KEYWORD_DENSITY_RULES.length}`);
console.log(`Allowlist count: ${SAFE_ALLOWLIST.length}\n`);

// ─── EDGE CASES ──────────────────────────────────
console.log('--- Edge Cases ---');
{
  const r1 = checkPrivacy(null, ALL_ENABLED);
  assert(r1.safe === false && r1.blockedBy.includes('empty_text'), 'null input → blocked');

  const r2 = checkPrivacy(undefined, ALL_ENABLED);
  assert(r2.safe === false && r2.blockedBy.includes('empty_text'), 'undefined input → blocked');

  const r3 = checkPrivacy('', ALL_ENABLED);
  assert(r3.safe === false && r3.blockedBy.includes('empty_text'), 'empty string → blocked');

  const r4 = checkPrivacy('   \n\t  ', ALL_ENABLED);
  assert(r4.safe === false && r4.blockedBy.includes('empty_text'), 'whitespace-only → blocked');

  const r5 = checkPrivacy('😀🎉🔥💯', ALL_ENABLED);
  assert(r5.safe === true, 'emojis-only → safe (no rules triggered)');

  // Missing userSettings defaults to all enabled
  const r6 = checkPrivacy('Hello world, this is safe text');
  assert(r6.safe === true, 'missing userSettings → defaults to all rules enabled, safe text passes');
}

// ─── STRUCTURAL RULES — FINANCIAL ────────────────
console.log('\n--- Financial Rules ---');
{
  const r = checkPrivacy('My card number is 4111 1111 1111 1111', ALL_ENABLED);
  assert(r.safe === false && r.blockedBy.includes('card_number'), 'Card number detected');
  assert(r.severity === 'critical', 'Card number severity is critical');
}
{
  const r = checkPrivacy('CVV: 123 on the back', ALL_ENABLED);
  assert(r.safe === false && r.blockedBy.includes('card_cvv'), 'CVV detected');
}
{
  const r = checkPrivacy('Expiry date: 12/2025', ALL_ENABLED);
  assert(r.safe === false && r.blockedBy.includes('card_expiry'), 'Card expiry detected');
}
{
  const r = checkPrivacy('Account Number: 123456789012345', ALL_ENABLED);
  assert(r.safe === false && r.blockedBy.includes('bank_account'), 'Bank account detected');
}
{
  const r = checkPrivacy('Transfer to HDFC0001234', ALL_ENABLED);
  assert(r.safe === false && r.blockedBy.includes('ifsc_code'), 'IFSC code detected');
}
{
  const r = checkPrivacy('SWIFT code HDFCINBBXXX for transfer', ALL_ENABLED);
  assert(r.blockedBy.includes('swift_bic'), 'SWIFT/BIC code detected');
}
{
  const r = checkPrivacy('Pay to user@upi', ALL_ENABLED);
  assert(r.blockedBy.includes('upi_id'), 'UPI ID detected');
}

// ─── STRUCTURAL RULES — AUTHENTICATION ───────────
console.log('\n--- Authentication Rules ---');
{
  const r = checkPrivacy('Your OTP is 789456. Do not share.', ALL_ENABLED);
  assert(r.safe === false && r.blockedBy.includes('otp'), 'OTP detected');
  assert(r.severity === 'critical', 'OTP severity is critical');
}
{
  const r = checkPrivacy('password:MySecret123!', ALL_ENABLED);
  assert(r.safe === false && r.blockedBy.includes('password'), 'Password detected');
}
{
  const r = checkPrivacy('Enter your mpin 4567 to continue', ALL_ENABLED);
  assert(r.safe === false && r.blockedBy.includes('pin'), 'PIN detected');
}
{
  const r = checkPrivacy('sk-abcdefghijklmnopqrstuvwxyz12345', ALL_ENABLED);
  assert(r.blockedBy.includes('api_key'), 'API key (sk-) detected');
}
{
  const r = checkPrivacy('Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6', ALL_ENABLED);
  assert(r.blockedBy.includes('api_key'), 'Bearer token detected');
}

// ─── STRUCTURAL RULES — PERSONAL IDENTITY ────────
console.log('\n--- Personal Identity Rules ---');
{
  const r = checkPrivacy('Aadhaar 1234 5678 9012', ALL_ENABLED);
  assert(r.safe === false && r.blockedBy.includes('aadhaar'), 'Aadhaar (spaced) detected');
}
{
  const r = checkPrivacy('UID 123456789012', ALL_ENABLED);
  assert(r.blockedBy.includes('aadhaar'), 'Aadhaar (12-digit) detected');
}
{
  const r = checkPrivacy('PAN: ABCDE1234F', ALL_ENABLED);
  assert(r.safe === false && r.blockedBy.includes('pan_card'), 'PAN card detected');
  assert(r.severity === 'critical', 'PAN severity is critical');
}
{
  const r = checkPrivacy('Passport A1234567', ALL_ENABLED);
  assert(r.blockedBy.includes('passport'), 'Passport number detected');
}
{
  const r = checkPrivacy('DL: MH0112345678901', ALL_ENABLED);
  // Indian DL format: 2 letters + 2 digits + 11 digits = 15 chars total
  assert(r.blockedBy.includes('driving_licence'), 'Driving licence detected');
}
{
  const r = checkPrivacy('Date of Birth: 15/03/1990', ALL_ENABLED);
  assert(r.blockedBy.includes('dob'), 'DOB detected');
}

// ─── STRUCTURAL RULES — CONTACT ──────────────────
console.log('\n--- Contact Rules ---');
{
  const r = checkPrivacy('Mobile: 9876543210', ALL_ENABLED);
  assert(r.blockedBy.includes('phone'), 'Phone number detected');
}
{
  const r = checkPrivacy('email: user@example.com', ALL_ENABLED);
  assert(r.blockedBy.includes('email'), 'Email detected');
}
{
  const r = checkPrivacy('WhatsApp group: Family', ALL_ENABLED);
  assert(r.blockedBy.includes('chat_indicators'), 'Chat indicator (WhatsApp) detected');
}

// ─── STRUCTURAL RULES — MEDICAL ──────────────────
console.log('\n--- Medical Rules ---');
{
  const r = checkPrivacy('Rx: Take 2 tablets daily after meals', ALL_ENABLED);
  assert(r.blockedBy.includes('medical_prescription'), 'Prescription detected');
}
{
  const r = checkPrivacy('Patient ID PID-2024-0001 admitted', ALL_ENABLED);
  assert(r.blockedBy.includes('medical_record_no'), 'Medical record number detected');
}

// ─── KEYWORD DENSITY RULES ─────────────────────
console.log('\n--- Keyword Density Rules ---');
{
  // Financial context: needs 4+ matches
  const r = checkPrivacy('Your balance is ₹5000. Last transaction debit of payment ₹200 via upi', ALL_ENABLED);
  assert(r.blockedBy.includes('financial_context'), 'Financial context triggered (5 keywords)');
}
{
  // Medical context: needs 3+ matches
  const r = checkPrivacy('Patient diagnosis shows symptoms requiring treatment at hospital', ALL_ENABLED);
  assert(r.blockedBy.includes('medical_context'), 'Medical context triggered');
}
{
  // Legal context: needs 3+ matches
  const r = checkPrivacy('This affidavit is hereby notarized by the advocate', ALL_ENABLED);
  assert(r.blockedBy.includes('legal_context'), 'Legal context triggered');
}
{
  // Private conversation: needs 3+ matches
  const r = checkPrivacy('Message delivered and seen. Voice message with photo attached.', ALL_ENABLED);
  assert(r.blockedBy.includes('private_conversation_context'), 'Private conversation context triggered');
}

// ─── ALLOWLIST OVERRIDE — HIGH/MEDIUM ────────────
console.log('\n--- Allowlist Override (Non-Critical) ---');
{
  // Order confirmation with UPI ID (high severity) — should be overridden
  const r = checkPrivacy('Order confirmed! Pay to shop@upi. Track your order here.', ALL_ENABLED);
  assert(r.safe === true, 'UPI in order confirmation is overridden by allowlist');
  assert(r.overriddenByAllowlist === true, 'overriddenByAllowlist flag is true');
}
{
  // Food delivery with phone number (medium severity)
  const r = checkPrivacy('Your food is on the way. Mobile: 9876543210', ALL_ENABLED);
  assert(r.safe === true, 'Phone number in food delivery overridden');
  assert(r.overriddenByAllowlist === true, 'overriddenByAllowlist set');
}

// ─── ALLOWLIST OVERRIDE — CRITICAL (MUST BLOCK) ──
console.log('\n--- Allowlist Override BLOCKED for Critical ---');
{
  // Boarding pass with CRITICAL card number — allowlist must NOT override
  const r = checkPrivacy('Boarding pass confirmed. PNR ABC123. Card: 4111 1111 1111 1111', ALL_ENABLED);
  assert(r.safe === false, 'Card number on boarding pass is NOT overridden by travel allowlist');
  assert(r.severity === 'critical', 'Severity remains critical');
  assert(r.overriddenByAllowlist === false, 'overriddenByAllowlist is false');
}
{
  // Order confirmation with OTP — critical must still block
  const r = checkPrivacy('Order confirmed! OTP is 456789 for verification.', ALL_ENABLED);
  assert(r.safe === false, 'OTP in order confirmation is NOT overridden');
  assert(r.severity === 'critical', 'Severity is critical');
}

// ─── REDACTION ──────────────────────────────────
console.log('\n--- Type-Aware Redaction ---');
{
  // Test card number redaction independently
  const cardText = 'Use card 4111 1111 1111 1111 for payment';
  const cardRedacted = redactSensitiveText(cardText);
  assert(cardRedacted.includes('[REDACTED:CARD_NUMBER]'), 'Card number redacted with type tag');
  assert(!cardRedacted.includes('4111'), 'Raw card number removed');
}
{
  // Test PAN redaction independently  
  const panText = 'PAN is ABCDE1234F filed';
  const panRedacted = redactSensitiveText(panText);
  assert(panRedacted.includes('[REDACTED:PAN_CARD]'), 'PAN redacted with type tag');
  assert(!panRedacted.includes('ABCDE1234F'), 'Raw PAN removed');
}
{
  // Test 60% threshold — text that's mostly sensitive should be fully redacted
  const text = '4111111111111111 4222222222222222 4333333333333333 4444444444444444';
  const redacted = redactSensitiveText(text);
  assert(redacted === '[Content too sensitive to store]', '60% threshold triggers full redaction');
}

// ─── SENSITIVITY SUMMARY ────────────────────────
console.log('\n--- Sensitivity Summary ---');
{
  const s = getSensitivitySummary('Safe harmless text', ALL_ENABLED);
  assert(s === 'Sent to AI for processing', 'Safe text summary');
}
{
  const s = getSensitivitySummary('Your OTP is 123456', ALL_ENABLED);
  assert(s.length <= 50, 'Summary ≤ 50 chars');
  assert(s.includes('not sent to AI'), 'Blocked summary mentions not sent');
}
{
  const s = getSensitivitySummary(null, ALL_ENABLED);
  assert(s === 'No text detected', 'Null text summary');
}

// ─── USER TOGGLE TESTS (DISABLING RULES) ─────────
console.log('\n--- User Toggle Tests ---');
{
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
  // UPI ID is high/canUserDisable, category: blockFinancial
  const r = checkPrivacy('Pay to user@upi for order', noFinancial);
  assert(!r.blockedBy.includes('upi_id'), 'UPI ID skipped when blockFinancial is false');
  
  // But card_number is critical/canUserDisable:false — always runs
  const r2 = checkPrivacy('Card 4111 1111 1111 1111', noFinancial);
  assert(r2.blockedBy.includes('card_number'), 'Card number STILL detected even with blockFinancial off (critical)');
}

// ─── VERSION FIELD ──────────────────────────────
console.log('\n--- Version Check ---');
{
  const r = checkPrivacy('Safe text', ALL_ENABLED);
  assert(r.debugInfo.version === '1.0.0', 'Version included in debugInfo');
}

// ─── RESULTS ────────────────────────────────────
console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`  PASSED: ${passed}`);
console.log(`  FAILED: ${failed}`);
console.log(`  TOTAL:  ${passed + failed}`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

process.exit(failed > 0 ? 1 : 0);
