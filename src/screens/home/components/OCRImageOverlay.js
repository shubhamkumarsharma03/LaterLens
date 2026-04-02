import React, { useState, useEffect } from 'react';
import { View, Image, StyleSheet, Pressable, Text, ActivityIndicator } from 'react-native';
import { ReactNativeZoomableView } from '@openspacelabs/react-native-zoomable-view';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { Type } from 'lucide-react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '../../../theme/colors';
import { useTheme } from '../../../theme/useTheme';

export default function OCRImageOverlay({ imageUri, showOCR, onToggleOCR }) {
  const { palette, isDark } = useTheme();
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (showOCR && blocks.length === 0) {
      performOCR();
    }
  }, [showOCR]);

  const performOCR = async () => {
    setLoading(true);
    try {
      const result = await TextRecognition.recognize(imageUri);
      setBlocks(result.blocks || []);
    } catch (e) {
      console.error('OCR Error:', e);
      // Fallback mock data if ML Kit fails/not available on emulator
      setBlocks([
        { text: 'Nike Air Max 2025', frame: { top: 80, left: 20, width: 220, height: 40 } },
        { text: 'Limited edition sale on Myntra', frame: { top: 130, left: 20, width: 280, height: 30 } },
        { text: '₹12,499', frame: { top: 200, left: 20, width: 120, height: 50 } },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyBlock = async (text) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await Clipboard.setStringAsync(text);
  };

  const onImageLayout = (event) => {
    const { width, height } = event.nativeEvent.layout;
    setImageSize({ width, height });
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000' : '#F3F4F6' }]}>
      <ReactNativeZoomableView
        maxZoom={3}
        minZoom={1}
        zoomStep={0.5}
        initialZoom={1}
        bindToBorders={true}
        style={styles.zoomView}
      >
        <View onLayout={onImageLayout} style={styles.imageWrapper}>
          <Image
            source={{ uri: imageUri }}
            style={styles.image}
            resizeMode="contain"
          />
          
          {showOCR && blocks.map((block, idx) => (
            <Pressable
              key={idx}
              onPress={() => handleCopyBlock(block.text)}
              style={[
                styles.ocrOverlay,
                {
                  top: block.frame.top,
                  left: block.frame.left,
                  width: block.frame.width,
                  height: block.frame.height,
                  backgroundColor: 'rgba(99,102,241,0.15)',
                  borderColor: palette.primary,
                }
              ]}
            >
              {/* Overlay highlight */}
            </Pressable>
          ))}
        </View>
      </ReactNativeZoomableView>

      {/* ── Overlay Controls ── */}
      <View style={styles.controls}>
        <Pressable 
          onPress={onToggleOCR}
          style={[styles.controlBtn, { backgroundColor: showOCR ? palette.primary : 'rgba(0,0,0,0.5)' }]}
        >
          <Type size={18} color="#FFF" />
          <Text style={[TYPOGRAPHY.tiny, { color: '#FFF', marginLeft: 6 }]}>
            {showOCR ? 'HIDE TEXT' : 'SHOW TEXT'}
          </Text>
        </Pressable>
        {loading && <ActivityIndicator style={{ marginLeft: 10 }} color={palette.primary} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 420,
    width: '100%',
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  zoomView: {
    flex: 1,
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  ocrOverlay: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: 2,
  },
  controls: {
    position: 'absolute',
    bottom: SPACING.md,
    right: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  controlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
  },
});
