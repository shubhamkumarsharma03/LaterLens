/**
 * ocrPostProcessor.test.js — Comprehensive unit tests for the OCR post-processor.
 *
 * The post-processor is pure JavaScript with no React Native dependencies,
 * so these tests run with vanilla Jest — no mocking required.
 */

const {
  filterUIChrome,
  filterEdgeRegions,
  filterLowConfidence,
  deduplicateBlocks,
  sortBlocksReadingOrder,
  mergeMLKitResults,
  assembleText,
  countMeaningfulWords,
  containsDevanagari,
  postProcessOCR,
} = require('../ocrPostProcessor');

// ─── Helpers ──────────────────────────────────────────────────

/** Creates a minimal ML Kit-like text block. */
function makeBlock(text, opts = {}) {
  return {
    text,
    frame: opts.frame || { top: opts.top ?? 100, left: opts.left ?? 0, width: 200, height: 20 },
    confidence: opts.confidence,
  };
}

// ─────────────────────────────────────────────
//  filterUIChrome
// ─────────────────────────────────────────────

describe('filterUIChrome', () => {
  test('filters time pattern "9:41"', () => {
    const blocks = [makeBlock('9:41')];
    expect(filterUIChrome(blocks)).toHaveLength(0);
  });

  test('filters battery percentage "84%"', () => {
    const blocks = [makeBlock('84%')];
    expect(filterUIChrome(blocks)).toHaveLength(0);
  });

  test('filters signal type "5G"', () => {
    const blocks = [makeBlock('5G')];
    expect(filterUIChrome(blocks)).toHaveLength(0);
  });

  test('filters Indian carrier "Jio"', () => {
    const blocks = [makeBlock('Jio')];
    expect(filterUIChrome(blocks)).toHaveLength(0);
  });

  test('filters navigation label "Back"', () => {
    const blocks = [makeBlock('Back')];
    expect(filterUIChrome(blocks)).toHaveLength(0);
  });

  test('filters social chrome "Like"', () => {
    const blocks = [makeBlock('Like')];
    expect(filterUIChrome(blocks)).toHaveLength(0);
  });

  test('filters relative timestamp "2h ago"', () => {
    const blocks = [makeBlock('2h ago')];
    expect(filterUIChrome(blocks)).toHaveLength(0);
  });

  test('keeps real content "Hello World"', () => {
    const blocks = [makeBlock('Hello World')];
    expect(filterUIChrome(blocks)).toHaveLength(1);
    expect(filterUIChrome(blocks)[0].text).toBe('Hello World');
  });

  test('keeps real content "React Native"', () => {
    const blocks = [makeBlock('React Native')];
    expect(filterUIChrome(blocks)).toHaveLength(1);
  });

  test('keeps price "₹8,999"', () => {
    const blocks = [makeBlock('₹8,999')];
    expect(filterUIChrome(blocks)).toHaveLength(1);
  });

  test('keeps product name "Nike Air Max"', () => {
    const blocks = [makeBlock('Nike Air Max')];
    expect(filterUIChrome(blocks)).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────
//  filterEdgeRegions
// ─────────────────────────────────────────────

describe('filterEdgeRegions', () => {
  const IMAGE_HEIGHT = 2000;

  test('removes block at top 5% (status bar)', () => {
    const blocks = [makeBlock('9:41', { top: 80 })]; // 80 / 2000 = 4%
    expect(filterEdgeRegions(blocks, IMAGE_HEIGHT)).toHaveLength(0);
  });

  test('removes block at bottom 95% (tab bar)', () => {
    const blocks = [makeBlock('Home', { top: 1900 })]; // 1900 / 2000 = 95%
    expect(filterEdgeRegions(blocks, IMAGE_HEIGHT)).toHaveLength(0);
  });

  test('keeps block at 50% height', () => {
    const blocks = [makeBlock('Main content', { top: 1000 })];
    expect(filterEdgeRegions(blocks, IMAGE_HEIGHT)).toHaveLength(1);
  });

  test('keeps block with no frame (missing data → keep)', () => {
    const blocks = [{ text: 'No frame data' }];
    expect(filterEdgeRegions(blocks, IMAGE_HEIGHT)).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────
//  filterLowConfidence
// ─────────────────────────────────────────────

describe('filterLowConfidence', () => {
  test('removes block with confidence 0.4 (below 0.65 threshold)', () => {
    const blocks = [makeBlock('Fuzzy text', { confidence: 0.4 })];
    expect(filterLowConfidence(blocks)).toHaveLength(0);
  });

  test('keeps block with confidence 0.9', () => {
    const blocks = [makeBlock('Clear text', { confidence: 0.9 })];
    expect(filterLowConfidence(blocks)).toHaveLength(1);
  });

  test('keeps block with undefined confidence (unknown ≠ low)', () => {
    const blocks = [makeBlock('Unknown confidence')];
    // confidence is not set in makeBlock by default → undefined
    expect(filterLowConfidence(blocks)).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────
//  deduplicateBlocks
// ─────────────────────────────────────────────

describe('deduplicateBlocks', () => {
  test('removes second block with identical text', () => {
    const blocks = [
      makeBlock('Hello World', { top: 100 }),
      makeBlock('Hello World', { top: 200 }),
    ];
    expect(deduplicateBlocks(blocks)).toHaveLength(1);
  });

  test('removes second block with same text different casing', () => {
    const blocks = [
      makeBlock('Hello World', { top: 100 }),
      makeBlock('hello world', { top: 200 }),
    ];
    expect(deduplicateBlocks(blocks)).toHaveLength(1);
  });

  test('removes shorter substring block within 40px of longer block', () => {
    const blocks = [
      makeBlock('React Native Development', { top: 100 }),
      makeBlock('React Native', { top: 120 }), // within 40px, substring
    ];
    const result = deduplicateBlocks(blocks);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('React Native Development');
  });

  test('keeps two blocks with different text', () => {
    const blocks = [
      makeBlock('Hello World', { top: 100 }),
      makeBlock('Goodbye World', { top: 200 }),
    ];
    expect(deduplicateBlocks(blocks)).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────
//  sortBlocksReadingOrder
// ─────────────────────────────────────────────

describe('sortBlocksReadingOrder', () => {
  test('block at y=100 comes before block at y=200', () => {
    const blocks = [
      makeBlock('Second', { top: 200 }),
      makeBlock('First', { top: 100 }),
    ];
    const sorted = sortBlocksReadingOrder(blocks);
    expect(sorted[0].text).toBe('First');
    expect(sorted[1].text).toBe('Second');
  });

  test('same-line blocks (within 20px) sorted by x left-to-right', () => {
    const blocks = [
      makeBlock('Right', { top: 50, left: 200 }),
      makeBlock('Left', { top: 60, left: 50 }),
    ];
    const sorted = sortBlocksReadingOrder(blocks);
    expect(sorted[0].text).toBe('Left');
    expect(sorted[1].text).toBe('Right');
  });

  test('block with undefined frame sorts to end', () => {
    const blocks = [
      { text: 'No frame' },
      makeBlock('Has frame', { top: 100 }),
    ];
    const sorted = sortBlocksReadingOrder(blocks);
    expect(sorted[0].text).toBe('Has frame');
    expect(sorted[1].text).toBe('No frame');
  });
});

// ─────────────────────────────────────────────
//  countMeaningfulWords
// ─────────────────────────────────────────────

describe('countMeaningfulWords', () => {
  test('"Hello World" → 2', () => {
    expect(countMeaningfulWords([makeBlock('Hello World')])).toBe(2);
  });

  test('"Hi" → 0 (less than 3 chars)', () => {
    expect(countMeaningfulWords([makeBlock('Hi')])).toBe(0);
  });

  test('"React Native Development" → 3', () => {
    expect(countMeaningfulWords([makeBlock('React Native Development')])).toBe(3);
  });

  test('"₹8999" → 0 (no alphabetic words)', () => {
    expect(countMeaningfulWords([makeBlock('₹8999')])).toBe(0);
  });

  test('"" → 0', () => {
    expect(countMeaningfulWords([makeBlock('')])).toBe(0);
  });
});

// ─────────────────────────────────────────────
//  assembleText
// ─────────────────────────────────────────────

describe('assembleText', () => {
  test('blocks within 30px vertically are joined with space', () => {
    const blocks = [
      makeBlock('Hello', { top: 100 }),
      makeBlock('World', { top: 120 }), // 20px gap — same paragraph
    ];
    expect(assembleText(blocks)).toBe('Hello World');
  });

  test('blocks more than 30px apart are joined with newline', () => {
    const blocks = [
      makeBlock('First paragraph', { top: 100 }),
      makeBlock('Second paragraph', { top: 200 }), // 100px gap — new paragraph
    ];
    expect(assembleText(blocks)).toBe('First paragraph\nSecond paragraph');
  });

  test('no leading/trailing whitespace in output', () => {
    const blocks = [
      makeBlock('  Trimmed  ', { top: 100 }),
    ];
    const result = assembleText(blocks);
    expect(result).toBe('Trimmed');
    expect(result).toBe(result.trim());
  });
});

// ─────────────────────────────────────────────
//  containsDevanagari
// ─────────────────────────────────────────────

describe('containsDevanagari', () => {
  test('"नमस्ते" → true', () => {
    expect(containsDevanagari('नमस्ते')).toBe(true);
  });

  test('"Hello" → false', () => {
    expect(containsDevanagari('Hello')).toBe(false);
  });

  test('"Hello नमस्ते" → true', () => {
    expect(containsDevanagari('Hello नमस्ते')).toBe(true);
  });
});

// ─────────────────────────────────────────────
//  postProcessOCR (integration)
// ─────────────────────────────────────────────

describe('postProcessOCR', () => {
  test('returns expected shape with correct confidence level', () => {
    const blocks = [
      makeBlock('This is a meaningful sentence with enough words for high confidence', { top: 500 }),
      makeBlock('Another line of real content here', { top: 600 }),
    ];
    const result = postProcessOCR(blocks, [], 2000);

    expect(result).toHaveProperty('text');
    expect(result).toHaveProperty('wordCount');
    expect(result).toHaveProperty('blockCount');
    expect(result).toHaveProperty('hasDevanagari');
    expect(result).toHaveProperty('confidence');
    expect(result.confidence).toBe('high');
    expect(result.hasDevanagari).toBe(false);
  });

  test('filters chrome and edges from mixed input', () => {
    const blocks = [
      makeBlock('9:41', { top: 20 }),           // chrome + edge → filtered
      makeBlock('84%', { top: 20 }),             // chrome → filtered
      makeBlock('Real content here', { top: 500 }),
      makeBlock('Home', { top: 1950 }),          // edge → filtered
    ];
    const result = postProcessOCR(blocks, [], 2000);

    expect(result.text).toContain('Real content');
    expect(result.text).not.toContain('9:41');
    expect(result.text).not.toContain('84%');
    expect(result.text).not.toContain('Home');
  });

  test('detects Devanagari content', () => {
    const blocks = [
      makeBlock('यह हिंदी टेक्स्ट है', { top: 500 }),
    ];
    const result = postProcessOCR(blocks, [], 2000);
    expect(result.hasDevanagari).toBe(true);
  });

  test('returns low confidence for empty input', () => {
    const result = postProcessOCR([], [], 2000);
    expect(result.confidence).toBe('low');
    expect(result.wordCount).toBe(0);
    expect(result.blockCount).toBe(0);
  });
});
