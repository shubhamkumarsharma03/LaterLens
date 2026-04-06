/**
 * ocrPreprocessor.js — Image preprocessing using Skia for ML Kit OCR.
 *
 * Uses @shopify/react-native-skia for all colour transformations
 * (inversion, contrast, greyscale, sharpening) and expo-image-manipulator
 * for resize and PNG conversion ONLY.
 *
 * @module ocrPreprocessor
 */

import { Skia, AlphaType, ColorType } from '@shopify/react-native-skia';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

const DEBUG = __DEV__ && false;

// ─── OCR Dimension Constants ─────────────────────────────────
const MIN_OCR_WIDTH = 1200;
const MAX_OCR_WIDTH = 1500;
const MAX_OCR_HEIGHT = 3000;

// ─────────────────────────────────────────────
//  SECTION A — Image Tone Detection
//  4-level fallback chain:
//    L1: Skia readPixels()
//    L2: PNG byte luminance estimation
//    L3: Sentinel 'unknown' → caller uses ML Kit block density
//    L4: Default to 'light'
// ─────────────────────────────────────────────

/**
 * Attempts tone detection via Skia readPixels() on a greyscale-converted crop.
 *
 * @param {string} imageUri - URI of the cropped centre strip (small PNG).
 * @returns {Promise<string|null>} 'dark', 'light', 'mixed', or null on failure.
 */
async function trySkiaPixelDetection(imageUri) {
  try {
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const rawBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const skData = Skia.Data.fromBytes(rawBytes);
    const skImage = Skia.Image.MakeImageFromEncoded(skData);

    if (!skImage) return null;

    const width = skImage.width();
    const height = skImage.height();
    const surface = Skia.Surface.Make(width, height);

    if (!surface) return null;

    const canvas = surface.getCanvas();

    // Draw to greyscale with luminance weights
    const paint = Skia.Paint();
    const greyscaleMatrix = [
      0.299, 0.587, 0.114, 0, 0,
      0.299, 0.587, 0.114, 0, 0,
      0.299, 0.587, 0.114, 0, 0,
      0,     0,     0,     1, 0,
    ];
    paint.setColorFilter(Skia.ColorFilter.MakeMatrix(greyscaleMatrix));
    canvas.drawImage(skImage, 0, 0, paint);

    const snapshot = surface.makeImageSnapshot();

    // Try readPixels — this is Level 1 of the fallback chain
    try {
      const pixelData = snapshot.readPixels(0, 0, {
        width,
        height,
        colorType: ColorType.RGBA_8888,
        alphaType: AlphaType.Unpremul,
      });

      if (pixelData && pixelData.length > 0) {
        let sum = 0;
        let count = 0;
        // Sample every 4th pixel (R channel of RGBA, greyscale so R=G=B)
        const step = Math.max(4, Math.floor(pixelData.length / 200) * 4);
        for (let i = 0; i < pixelData.length; i += step) {
          sum += pixelData[i]; // R channel
          count++;
        }

        if (count > 0) {
          const avg = sum / count;
          if (DEBUG) console.log('[OCR Preprocess] Skia readPixels avg brightness:', avg);
          if (avg < 100) return 'dark';
          if (avg > 160) return 'light';
          return 'mixed';
        }
      }
    } catch (_readErr) {
      // readPixels not available — fall through to Level 2
      if (DEBUG) console.log('[OCR Preprocess] readPixels failed, trying PNG byte estimation');
    }

    return null; // Signal: L1 failed, try L2
  } catch (err) {
    if (DEBUG) console.log('[OCR Preprocess] Skia pixel detection failed:', err);
    return null;
  }
}

/**
 * Level 2 fallback: estimates brightness from raw PNG byte sampling.
 * Works because on a 50×20px PNG, byte distribution correlates with luminance.
 *
 * @param {string} imageUri - URI of the cropped centre strip (small PNG).
 * @returns {Promise<string|null>} 'dark', 'light', 'mixed', or null on failure.
 */
async function estimateBrightnessFromPNGBytes(imageUri) {
  try {
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const bytes = atob(base64);
    let sum = 0;
    let count = 0;
    // PNG IDAT chunk starts around byte 33 for small images
    // Sample at regular intervals to estimate brightness
    const step = Math.max(1, Math.floor(bytes.length / 200));

    for (let i = 33; i < bytes.length; i += step) {
      const byte = bytes.charCodeAt(i);
      if (byte >= 0 && byte <= 255) {
        sum += byte;
        count++;
      }
    }

    if (count === 0) return null;
    const avg = sum / count;

    if (DEBUG) console.log('[OCR Preprocess] PNG byte avg brightness:', avg);

    // Conservative thresholds — PNG filter bytes contaminate the average
    if (isNaN(avg) || avg < 0 || avg > 255) return null;
    if (avg < 80) return 'dark';
    if (avg > 140) return 'light';
    return 'mixed';
  } catch {
    return null; // Signal failure to caller
  }
}

/**
 * Level 3: Infer tone from ML Kit block density (called by the pipeline,
 * not by detectImageTone directly). Checks if dense short blocks cluster
 * at the top of the image — a strong signal for dark mode status bars.
 *
 * @param {Array} blocks - ML Kit text blocks from a LATIN OCR pass.
 * @param {number} imageHeight - Image height in pixels.
 * @returns {string} 'dark', 'light', or 'mixed'.
 */
export function inferToneFromBlocks(blocks, imageHeight) {
  if (!blocks || blocks.length === 0) return 'light'; // Level 4 default

  const topRegionThreshold = imageHeight * 0.15;
  let topBlockCount = 0;
  let singleCharCount = 0;

  for (const block of blocks) {
    const text = (block.text || '').trim();
    if (block.frame && block.frame.top < topRegionThreshold) {
      topBlockCount++;
    }
    if (text.length <= 1) {
      singleCharCount++;
    }
  }

  const topRatio = blocks.length > 0 ? topBlockCount / blocks.length : 0;
  const singleCharRatio = blocks.length > 0 ? singleCharCount / blocks.length : 0;

  // >60% of blocks in top region, or high single-char density → likely dark mode
  if (topRatio > 0.6 || singleCharRatio > 0.4) return 'dark';
  return 'light'; // Level 4 default
}

/**
 * Detects whether a screenshot is light mode, dark mode, or mixed.
 * Uses a 4-level fallback chain for robustness.
 *
 * @param {string} imageUri - Source image URI.
 * @param {number} imageWidth - Image width in pixels.
 * @param {number} imageHeight - Image height in pixels.
 * @returns {Promise<{tone: string, likelyIndianApp: boolean}>}
 */
export async function detectImageTone(imageUri, imageWidth, imageHeight) {
  let croppedUri = null;

  try {
    // Crop horizontal strip from vertical centre (35%–65%) to avoid status/nav bars
    const cropResult = await ImageManipulator.manipulateAsync(
      imageUri,
      [
        {
          crop: {
            originX: 0,
            originY: Math.floor(imageHeight * 0.35),
            width: imageWidth,
            height: Math.floor(imageHeight * 0.30),
          },
        },
        { resize: { width: 50 } },
      ],
      { format: 'png', compress: 1 }
    );
    croppedUri = cropResult.uri;

    // Level 1 — Skia readPixels
    const skTone = await trySkiaPixelDetection(croppedUri);
    if (skTone) {
      if (DEBUG) console.log('[OCR Preprocess] Tone detected via Skia readPixels:', skTone);
      return { tone: skTone, likelyIndianApp: false };
    }

    // Level 2 — PNG byte luminance estimation
    const byteTone = await estimateBrightnessFromPNGBytes(croppedUri);
    if (byteTone) {
      if (DEBUG) console.log('[OCR Preprocess] Tone detected via PNG bytes:', byteTone);
      return { tone: byteTone, likelyIndianApp: false };
    }

    // Level 3 — Return sentinel 'unknown' so caller can use OCR block density
    if (DEBUG) console.log('[OCR Preprocess] L1+L2 failed, returning unknown for L3 block analysis');
    return { tone: 'unknown', likelyIndianApp: false };
  } catch (err) {
    // Level 4 — Default fallback
    if (DEBUG) console.warn('[OCR Preprocess] Tone detection failed entirely:', err);
    return { tone: 'light', likelyIndianApp: false };
  } finally {
    // Always clean up the crop temp file
    if (croppedUri) {
      try {
        await FileSystem.deleteAsync(croppedUri, { idempotent: true });
      } catch (_) {
        // Best-effort cleanup
      }
    }
  }
}

// ─────────────────────────────────────────────
//  SECTION B — Skia Colour Processing
// ─────────────────────────────────────────────

/**
 * Applies a 4×5 colour matrix transformation to an image using Skia
 * and saves the result as a PNG file.
 *
 * @param {string} imageUri - Source image URI.
 * @param {number[]} matrix - 20-element colour matrix (4 rows × 5 columns).
 * @param {string} [outputPath] - Optional output path. Generated if not provided.
 * @returns {Promise<string>} URI of the processed image.
 */
export async function applySkiaColourMatrix(imageUri, matrix, outputPath) {
  const base64 = await FileSystem.readAsStringAsync(imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const rawBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const skData = Skia.Data.fromBytes(rawBytes);
  const skImage = Skia.Image.MakeImageFromEncoded(skData);

  if (!skImage) {
    throw new Error('Failed to decode image with Skia');
  }

  const width = skImage.width();
  const height = skImage.height();
  const surface = Skia.Surface.Make(width, height);

  if (!surface) {
    throw new Error('Failed to create Skia offscreen surface');
  }

  const canvas = surface.getCanvas();
  const paint = Skia.Paint();
  paint.setColorFilter(Skia.ColorFilter.MakeMatrix(matrix));
  canvas.drawImage(skImage, 0, 0, paint);

  const snapshot = surface.makeImageSnapshot();
  const pngData = snapshot.encodeToBase64();

  // Generate output path if not provided
  const outUri =
    outputPath ||
    `${FileSystem.cacheDirectory}ocr_skia_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;

  await FileSystem.writeAsStringAsync(outUri, pngData, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return outUri;
}

/**
 * Inverts image colours (dark → light) for dark mode screenshots.
 *
 * @param {string} imageUri - Source image URI.
 * @returns {Promise<string>} URI of the inverted image.
 */
export async function invertImage(imageUri) {
  const inversionMatrix = [
    -1,  0,  0,  0,  1,
     0, -1,  0,  0,  1,
     0,  0, -1,  0,  1,
     0,  0,  0,  1,  0,
  ];
  return applySkiaColourMatrix(imageUri, inversionMatrix);
}

/**
 * Boosts contrast of an image using a colour matrix.
 *
 * @param {string} imageUri - Source image URI.
 * @param {number} [factor=1.4] - Contrast multiplier (>1 increases contrast).
 * @returns {Promise<string>} URI of the contrast-boosted image.
 */
export async function boostContrast(imageUri, factor = 1.4) {
  const translate = (1 - factor) * 0.5;
  const contrastMatrix = [
    factor, 0,      0,      0, translate,
    0,      factor, 0,      0, translate,
    0,      0,      factor, 0, translate,
    0,      0,      0,      1, 0,
  ];
  return applySkiaColourMatrix(imageUri, contrastMatrix);
}

/**
 * Converts an image to greyscale using luminance weights.
 *
 * @param {string} imageUri - Source image URI.
 * @returns {Promise<string>} URI of the greyscale image.
 */
export async function convertToGreyscale(imageUri) {
  const greyscaleMatrix = [
    0.299, 0.587, 0.114, 0, 0,
    0.299, 0.587, 0.114, 0, 0,
    0.299, 0.587, 0.114, 0, 0,
    0,     0,     0,     1, 0,
  ];
  return applySkiaColourMatrix(imageUri, greyscaleMatrix);
}

/**
 * Approximates sharpening using a contrast-boost colour matrix.
 * Uses factor 1.3 with a slight negative offset to sharpen text edges.
 *
 * @param {string} imageUri - Source image URI.
 * @returns {Promise<string>} URI of the sharpened image.
 */
export async function sharpenImage(imageUri) {
  const factor = 1.3;
  const translate = (1 - factor) * 0.5 - 0.05;
  const sharpenMatrix = [
    factor, 0,      0,      0, translate,
    0,      factor, 0,      0, translate,
    0,      0,      factor, 0, translate,
    0,      0,      0,      1, 0,
  ];
  return applySkiaColourMatrix(imageUri, sharpenMatrix);
}

// ─────────────────────────────────────────────
//  SECTION C — Full Preprocessing Pipeline
// ─────────────────────────────────────────────

/**
 * Main preprocessing pipeline. Runs tone detection, resize, and
 * tone-specific colour processing using Skia.
 *
 * IMPORTANT: The returned processedUri must be deleted by the caller
 * in its own finally block. This function does NOT delete processedUri.
 *
 * @param {string} imageUri - Source image URI.
 * @returns {Promise<{processedUri: string, wasInverted: boolean, originalTone: string, likelyIndianApp: boolean, originalDimensions: {width: number, height: number}}>}
 */
export async function preprocessImageForOCR(imageUri) {
  const tempFiles = []; // Track intermediates for cleanup

  try {
    // STEP 1 — Get image dimensions via no-op manipulation
    const probe = await ImageManipulator.manipulateAsync(
      imageUri,
      [],
      { format: 'png', compress: 1 }
    );
    tempFiles.push(probe.uri);

    const width = probe.width;
    const height = probe.height;

    // STEP 2 — Detect image tone
    const toneInfo = await detectImageTone(imageUri, width, height);

    // STEP 3 — Resize to OCR-optimal dimensions
    const resizeActions = [];

    if (width > MAX_OCR_WIDTH || height > MAX_OCR_HEIGHT) {
      const scaleW = MAX_OCR_WIDTH / width;
      const scaleH = MAX_OCR_HEIGHT / height;
      const scale = Math.min(scaleW, scaleH);
      resizeActions.push({ resize: { width: Math.round(width * scale) } });
    } else if (width < MIN_OCR_WIDTH) {
      resizeActions.push({ resize: { width: MIN_OCR_WIDTH } });
    }

    let resizedUri;
    if (resizeActions.length > 0) {
      const resized = await ImageManipulator.manipulateAsync(
        imageUri,
        resizeActions,
        { format: 'png', compress: 1 }
      );
      resizedUri = resized.uri;
      tempFiles.push(resizedUri);
    } else {
      // Use probe output directly (already PNG)
      resizedUri = probe.uri;
    }

    // STEP 4 — Apply tone-specific colour processing using Skia
    let processedUri;
    let wasInverted = false;
    let tone = toneInfo.tone;

    // Handle 'unknown' sentinel — will be resolved by caller via Level 3
    // For preprocessing, treat 'unknown' as 'mixed' (safest middle ground)
    if (tone === 'unknown') {
      tone = 'unknown'; // Keep sentinel for caller
    }

    if (tone === 'dark') {
      // Dark mode: greyscale → invert → sharpen
      const greyscaleUri = await convertToGreyscale(resizedUri);
      tempFiles.push(greyscaleUri);

      const invertedUri = await invertImage(greyscaleUri);
      tempFiles.push(invertedUri);

      processedUri = await sharpenImage(invertedUri);
      wasInverted = true;
    } else if (tone === 'light') {
      // Light mode: sharpen only
      processedUri = await sharpenImage(resizedUri);
      wasInverted = false;
    } else {
      // Mixed or unknown: contrast boost → sharpen
      const contrastedUri = await boostContrast(resizedUri, 1.3);
      tempFiles.push(contrastedUri);

      processedUri = await sharpenImage(contrastedUri);
      wasInverted = false;
    }

    // processedUri is NOT added to tempFiles — caller must delete it

    return {
      processedUri,
      wasInverted,
      originalTone: toneInfo.tone,
      likelyIndianApp: toneInfo.likelyIndianApp,
      originalDimensions: { width, height },
    };
  } catch (err) {
    if (DEBUG) console.warn('[OCR Preprocess] Pipeline failed, falling back to original:', err);

    // Return original image on failure — never throw from this function
    return {
      processedUri: imageUri,
      wasInverted: false,
      originalTone: 'light',
      likelyIndianApp: false,
      originalDimensions: { width: 0, height: 0 },
    };
  } finally {
    // STEP 5 — Clean up ALL intermediate files (never processedUri)
    for (const uri of tempFiles) {
      try {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      } catch (_) {
        // Best-effort cleanup
      }
    }
  }
}
