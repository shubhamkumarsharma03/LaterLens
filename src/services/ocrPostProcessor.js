/**
 * ocrPostProcessor.js — Pure JavaScript OCR text cleaning and filtering.
 *
 * Takes raw ML Kit output (array of text blocks) and cleans it into
 * high-quality text ready for the privacy gate and Groq.
 *
 * ZERO React Native imports — fully unit-testable with vanilla Jest.
 *
 * @module ocrPostProcessor
 */

const DEBUG = typeof __DEV__ !== 'undefined' && __DEV__ && false;

// ─────────────────────────────────────────────
//  SECTION A — Constants
// ─────────────────────────────────────────────

/**
 * RegExp patterns matching common UI chrome strings that ML Kit detects
 * but are not meaningful content. Grouped by category.
 * @type {RegExp[]}
 */
const UI_CHROME_PATTERNS = [
  // Status bar items
  /^\d{1,2}:\d{2}(\s*(AM|PM))?$/i,                       // Time
  /^\d{1,3}%$/,                                           // Battery percentage
  /^(4G|5G|LTE|3G|H\+|H|E|2G|NR)$/,                      // Signal/network type
  /^(Jio|Airtel|Vi|Vodafone|BSNL|MTNL|idea)\s*$/i,        // Indian carriers
  /^(WiFi|Wi-Fi|\u2022{1,5})$/i,                           // WiFi strength

  // Navigation and action buttons
  /^(Back|Done|Cancel|Close|Menu|More|Share|Edit|Save|Next|Skip|Continue|Confirm|OK|Yes|No|Allow|Deny|Open|Install|Update|Get|Free)$/i,
  /^(Home|Search|Explore|Discover|Notifications?|Alerts?|Inbox|Profile|Account|Settings?|Feed|Trending|Library|History)$/i,

  // Arrow/chevron characters
  /^[\u2190\u2192\u2193\u2191\u276E\u276F\u2039\u203A]$/,
  // Ellipsis dots
  /^[\u2022\u00B7\u2026\u22EF]{1,3}$/,
  // Three-dot menu
  /^\u22EE$|^\.\.\.$/,

  // Social media chrome
  /^(Like|Comment|Share|Retweet|Repost|Reply|Follow|Unfollow|Subscribe|Connect|Message|React|Save|Bookmark|Report)$/i,
  /^\d+(\.\d+)?(K|M|B)?\s*(Likes?|Comments?|Shares?|Retweets?|Views?|Followers?|Following|Reposts?|Quotes?)$/i,
  /^(\d+\s*(s|m|h|d|w|mo|y)\s*(ago)?|just now|yesterday|now)$/i,
  /^[\u2713\u2714\u2611]$/,                                // Verification badges

  // Keyboard artifacts
  /^[a-zA-Z]$/,                                            // Single letters
  /^(space|return|delete|shift|ABC|123|\u21E7|\u232B)$/i,

  // Indian app specific chrome
  /^(Pay|Scan|Send|Receive|History|Passbook|Offers|Rewards|Help)$/i,
  /^(Deals|Offers|Cart|Wishlist|Orders?|Track|Support|Chat|Refer|Earn)$/i,
];

/**
 * Matches English words of 3+ chars AND Devanagari words of 3+ chars.
 * Used for confidence scoring.
 * @type {RegExp}
 */
const MEANINGFUL_WORD_REGEX = /\b[a-zA-Z\u0900-\u097F]{3,}\b/g;

/**
 * Detects Hindi/Devanagari characters in text.
 * @type {RegExp}
 */
const DEVANAGARI_REGEX = /[\u0900-\u097F]/g;

// ─────────────────────────────────────────────
//  SECTION B — Filtering functions
// ─────────────────────────────────────────────

/**
 * Filters out blocks whose text matches UI chrome patterns.
 *
 * @param {Array<{text: string}>} ocrBlocks - Raw ML Kit text blocks.
 * @returns {Array<{text: string}>} Blocks with chrome removed.
 */
function filterUIChrome(ocrBlocks) {
  return ocrBlocks.filter((block) => {
    const trimmed = (block.text || '').trim();

    // Filter single characters
    if (trimmed.length <= 1) return false;

    // Filter purely numeric strings of 2 or fewer digits
    if (/^\d{1,2}$/.test(trimmed)) return false;

    // Check against all chrome patterns
    for (const pattern of UI_CHROME_PATTERNS) {
      if (pattern.test(trimmed)) return false;
    }

    return true;
  });
}

/**
 * Removes blocks in the top 8% (status bar) and bottom 10% (tab bar) of the image.
 *
 * @param {Array<{text: string, frame?: {top: number}}>} ocrBlocks
 * @param {number} imageHeight - Original image height in pixels.
 * @returns {Array<{text: string, frame?: {top: number}}>} Filtered blocks.
 */
function filterEdgeRegions(ocrBlocks, imageHeight) {
  if (!imageHeight || imageHeight <= 0) return ocrBlocks;

  const topThreshold = imageHeight * 0.08;
  const bottomThreshold = imageHeight * 0.90;

  return ocrBlocks.filter((block) => {
    // Keep blocks with no frame data (don't exclude on missing data)
    if (!block.frame || block.frame.top === undefined) return true;

    if (block.frame.top < topThreshold) return false;
    if (block.frame.top > bottomThreshold) return false;

    return true;
  });
}

/**
 * Removes blocks with confidence below the threshold.
 * Blocks with undefined confidence are KEPT (unknown ≠ low).
 *
 * @param {Array<{text: string, confidence?: number}>} ocrBlocks
 * @param {number} [threshold=0.65] - Minimum confidence to keep.
 * @returns {Array<{text: string, confidence?: number}>} Filtered blocks.
 */
function filterLowConfidence(ocrBlocks, threshold = 0.65) {
  return ocrBlocks.filter((block) => {
    if (block.confidence === undefined || block.confidence === null) return true;
    return block.confidence >= threshold;
  });
}

/**
 * Removes duplicate and near-duplicate blocks.
 * - Exact duplicates (case-insensitive): second occurrence removed
 * - Substring blocks within 40px vertically of a longer block: shorter removed
 *
 * @param {Array<{text: string, frame?: {top: number}}>} ocrBlocks
 * @returns {Array<{text: string, frame?: {top: number}}>} Deduplicated blocks.
 */
function deduplicateBlocks(ocrBlocks) {
  const seen = new Set();
  const result = [];

  // Pass 1: Remove exact duplicates (case-insensitive, trimmed, collapsed whitespace)
  for (const block of ocrBlocks) {
    const normalised = (block.text || '').toLowerCase().trim().replace(/\s+/g, ' ');
    if (seen.has(normalised)) continue;
    seen.add(normalised);
    result.push(block);
  }

  // Pass 2: Remove near-duplicates (substring within 40px vertical distance)
  const VERTICAL_PROXIMITY = 40;
  const toRemove = new Set();

  for (let i = 0; i < result.length; i++) {
    if (toRemove.has(i)) continue;
    for (let j = i + 1; j < result.length; j++) {
      if (toRemove.has(j)) continue;

      const textA = (result[i].text || '').trim();
      const textB = (result[j].text || '').trim();
      const topA = result[i].frame?.top;
      const topB = result[j].frame?.top;

      // Both must have frame data for proximity check
      if (topA === undefined || topB === undefined) continue;
      if (Math.abs(topA - topB) > VERTICAL_PROXIMITY) continue;

      // Check substring relationship
      const lowerA = textA.toLowerCase();
      const lowerB = textB.toLowerCase();

      if (lowerA.includes(lowerB)) {
        // A contains B — remove B (shorter)
        toRemove.add(j);
      } else if (lowerB.includes(lowerA)) {
        // B contains A — remove A (shorter)
        toRemove.add(i);
        break; // stop checking A against others since A is marked for removal
      }
    }
  }

  return result.filter((_, index) => !toRemove.has(index));
}

/**
 * Sorts blocks in reading order: top-to-bottom, left-to-right.
 * Blocks within 20px vertically are considered to be on the same line.
 *
 * @param {Array<{text: string, frame?: {top: number, left: number}}>} ocrBlocks
 * @returns {Array<{text: string, frame?: {top: number, left: number}}>} Sorted blocks.
 */
function sortBlocksReadingOrder(ocrBlocks) {
  const LINE_THRESHOLD = 20;

  return [...ocrBlocks].sort((a, b) => {
    const topA = a.frame?.top;
    const topB = b.frame?.top;

    // Blocks with undefined frame sort to end
    if (topA === undefined && topB === undefined) return 0;
    if (topA === undefined) return 1;
    if (topB === undefined) return -1;

    // Same line (within threshold) — sort by left position
    if (Math.abs(topA - topB) < LINE_THRESHOLD) {
      const leftA = a.frame?.left ?? 0;
      const leftB = b.frame?.left ?? 0;
      return leftA - leftB;
    }

    // Different lines — sort by top position
    return topA - topB;
  });
}

/**
 * Merges blocks from LATIN and DEVANAGARI ML Kit passes.
 * Deduplicates by text content and bounding box proximity.
 *
 * @param {{blocks: Array}} latinResult - LATIN pass result.
 * @param {{blocks: Array}} devanagariResult - DEVANAGARI pass result.
 * @returns {Array} Merged, deduplicated blocks.
 */
function mergeMLKitResults(latinResult, devanagariResult) {
  const latinBlocks = latinResult?.blocks || [];
  const devanagariBlocks = devanagariResult?.blocks || [];

  if (devanagariBlocks.length === 0) return [...latinBlocks];
  if (latinBlocks.length === 0) return [...devanagariBlocks];

  const merged = [...latinBlocks];

  for (const devBlock of devanagariBlocks) {
    let isDuplicate = false;

    for (const latBlock of latinBlocks) {
      // Check bounding box overlap
      if (latBlock.frame && devBlock.frame) {
        const overlap = calculateOverlap(latBlock.frame, devBlock.frame);
        const smallerArea = Math.min(
          (latBlock.frame.width || 1) * (latBlock.frame.height || 1),
          (devBlock.frame.width || 1) * (devBlock.frame.height || 1)
        );

        if (overlap > smallerArea * 0.5) {
          // Overlapping — keep the one with higher confidence or longer text
          if (
            (devBlock.confidence || 0) > (latBlock.confidence || 0) ||
            ((devBlock.confidence || 0) === (latBlock.confidence || 0) &&
              (devBlock.text || '').length > (latBlock.text || '').length)
          ) {
            // Replace latin block with devanagari block
            const idx = merged.indexOf(latBlock);
            if (idx !== -1) merged[idx] = devBlock;
          }
          isDuplicate = true;
          break;
        }
      }
    }

    if (!isDuplicate) {
      merged.push(devBlock);
    }
  }

  return merged;
}

/**
 * Calculates the overlap area between two rectangles.
 * @param {{left: number, top: number, width: number, height: number}} a
 * @param {{left: number, top: number, width: number, height: number}} b
 * @returns {number} Overlap area in pixels.
 */
function calculateOverlap(a, b) {
  const x1 = Math.max(a.left || 0, b.left || 0);
  const y1 = Math.max(a.top || 0, b.top || 0);
  const x2 = Math.min((a.left || 0) + (a.width || 0), (b.left || 0) + (b.width || 0));
  const y2 = Math.min((a.top || 0) + (a.height || 0), (b.top || 0) + (b.height || 0));

  if (x2 <= x1 || y2 <= y1) return 0;
  return (x2 - x1) * (y2 - y1);
}

// ─────────────────────────────────────────────
//  SECTION C — Text assembly
// ─────────────────────────────────────────────

/**
 * Assembles sorted, filtered blocks into readable paragraphed text.
 * Blocks within 30px vertically are joined with spaces (same paragraph).
 * Blocks further apart are separated by newlines.
 *
 * @param {Array<{text: string, frame?: {top: number}}>} ocrBlocks - Sorted blocks.
 * @returns {string} Assembled text.
 */
function assembleText(ocrBlocks) {
  if (!ocrBlocks || ocrBlocks.length === 0) return '';

  const PARAGRAPH_THRESHOLD = 30;
  const paragraphs = [];
  let currentParagraph = [(ocrBlocks[0].text || '').trim()];
  let lastTop = ocrBlocks[0].frame?.top ?? 0;

  for (let i = 1; i < ocrBlocks.length; i++) {
    const block = ocrBlocks[i];
    const blockText = (block.text || '').trim();
    if (!blockText) continue;

    const blockTop = block.frame?.top ?? lastTop;
    const gap = Math.abs(blockTop - lastTop);

    if (gap <= PARAGRAPH_THRESHOLD) {
      currentParagraph.push(blockText);
    } else {
      paragraphs.push(currentParagraph.join(' '));
      currentParagraph = [blockText];
    }

    lastTop = blockTop;
  }

  // Flush last paragraph
  if (currentParagraph.length > 0) {
    paragraphs.push(currentParagraph.join(' '));
  }

  return paragraphs.join('\n').trim();
}

/**
 * Counts meaningful words (3+ alphabetic/Devanagari chars) across all blocks.
 *
 * @param {Array<{text: string}>} ocrBlocks
 * @returns {number} Count of meaningful words.
 */
function countMeaningfulWords(ocrBlocks) {
  const allText = ocrBlocks.map((b) => b.text || '').join(' ');
  const matches = allText.match(MEANINGFUL_WORD_REGEX);
  return matches ? matches.length : 0;
}

/**
 * Checks if text contains any Devanagari (Hindi) characters.
 *
 * @param {string} text
 * @returns {boolean}
 */
function containsDevanagari(text) {
  if (!text) return false;
  // Reset lastIndex since we use /g flag
  DEVANAGARI_REGEX.lastIndex = 0;
  return DEVANAGARI_REGEX.test(text);
}

// ─────────────────────────────────────────────
//  SECTION D — Main export
// ─────────────────────────────────────────────

/**
 * Full post-processing pipeline for ML Kit OCR output.
 *
 * Runs: merge → filter chrome → filter edges → filter confidence →
 *       sort → deduplicate → assemble → count
 *
 * @param {Array} latinBlocks - Blocks from LATIN script recognition pass.
 * @param {Array} devanagariBlocks - Blocks from DEVANAGARI pass (may be empty).
 * @param {number} imageHeight - Original image height for edge filtering.
 * @returns {{text: string, wordCount: number, blockCount: number, hasDevanagari: boolean, confidence: string}}
 */
function postProcessOCR(latinBlocks, devanagariBlocks, imageHeight) {
  // Step 1 — Merge multi-script results
  const merged = mergeMLKitResults(
    { blocks: latinBlocks || [] },
    { blocks: devanagariBlocks || [] }
  );

  // Step 2 — Filter UI chrome
  const clean = filterUIChrome(merged);

  // Step 3 — Filter edge regions
  const edgeTrimmed = filterEdgeRegions(clean, imageHeight);

  // Step 4 — Filter low confidence
  const confident = filterLowConfidence(edgeTrimmed);

  // Step 5 — Sort in reading order
  const sorted = sortBlocksReadingOrder(confident);

  // Step 6 — Deduplicate
  const deduped = deduplicateBlocks(sorted);

  // Step 7 — Assemble text
  const text = assembleText(deduped);

  // Step 8 — Count meaningful words
  const wordCount = countMeaningfulWords(deduped);

  if (DEBUG) {
    console.log('[OCR PostProcess] Pipeline:', {
      inputBlocks: (latinBlocks || []).length + (devanagariBlocks || []).length,
      afterMerge: merged.length,
      afterChrome: clean.length,
      afterEdge: edgeTrimmed.length,
      afterConfidence: confident.length,
      afterDedup: deduped.length,
      wordCount,
    });
  }

  return {
    text,
    wordCount,
    blockCount: deduped.length,
    hasDevanagari: containsDevanagari(text),
    confidence: wordCount >= 8 ? 'high' : wordCount >= 3 ? 'medium' : 'low',
  };
}

// ─── Exports ──────────────────────────────────────────────────

module.exports = {
  // Main export
  postProcessOCR,

  // Individual functions (for unit testing)
  filterUIChrome,
  filterEdgeRegions,
  filterLowConfidence,
  deduplicateBlocks,
  sortBlocksReadingOrder,
  mergeMLKitResults,
  assembleText,
  countMeaningfulWords,
  containsDevanagari,

  // Constants (for testing)
  UI_CHROME_PATTERNS,
  MEANINGFUL_WORD_REGEX,
  DEVANAGARI_REGEX,
};
