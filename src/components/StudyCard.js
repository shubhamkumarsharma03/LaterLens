import React, { useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import RatingBar from './RatingBar';
import { getRetentionEstimate } from '../services/spacedRepetitionService';

const CARD_IMAGE_HEIGHT = 220;

function toLocalDateString(dateObj) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function daysAgoLabel(dateString) {
  if (!dateString) return null;

  const start = new Date(`${dateString}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) return null;

  const today = new Date();
  const todayKey = toLocalDateString(today);
  const todayDate = new Date(`${todayKey}T00:00:00.000Z`);
  const delta = Math.max(0, Math.floor((todayDate.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));

  if (delta === 0) return 'Last reviewed today';
  if (delta === 1) return 'Last reviewed 1 day ago';
  return `Last reviewed ${delta} days ago`;
}

function StudyImage({ item, palette, radius }) {
  const [hasImageError, setHasImageError] = useState(false);

  if (!item?.imagePath || hasImageError) {
    return (
      <View
        style={[
          styles.imageFallback,
          {
            backgroundColor: palette.primaryLight,
            borderRadius: radius,
          },
        ]}
      >
        <Text style={[styles.imageFallbackTitle, { color: palette.textPrimary }]} numberOfLines={2}>
          {item?.title || 'Study card'}
        </Text>
        <Text style={[styles.imageFallbackSummary, { color: palette.textSecondary }]} numberOfLines={3}>
          {item?.summary || 'Image unavailable. You can still review this card.'}
        </Text>
      </View>
    );
  }

  return (
    <ExpoImage
      source={{ uri: item.imagePath }}
      contentFit="cover"
      cachePolicy="disk"
      onError={() => setHasImageError(true)}
      style={[styles.image, { borderRadius: radius }]}
    />
  );
}

export default function StudyCard({ item, onRate, cardIndex, totalCards, theme, isPanning = false }) {
  const [isFlipped, setIsFlipped] = useState(false);
  const flipAnim = useRef(new Animated.Value(0)).current;
  const palette = theme?.palette || {};
  const radius = theme?.radius?.md || 12;

  const retentionEstimate = useMemo(() => getRetentionEstimate(item), [item]);
  const lastReviewedLabel = daysAgoLabel(item?.srLastReviewDate);

  const frontRotate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });

  const backRotate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-90deg', '0deg'],
  });

  const frontOpacity = flipAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0, 0],
  });

  const backOpacity = flipAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });

  const handleFlip = () => {
    const toFlipped = !isFlipped;
    setIsFlipped(toFlipped);

    Animated.sequence([
      Animated.timing(flipAnim, {
        toValue: toFlipped ? 0.5 : 0.5,
        duration: 300,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(flipAnim, {
        toValue: toFlipped ? 1 : 0,
        duration: 300,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <View
      style={[styles.wrapper, { backgroundColor: palette.card, borderColor: palette.border }]}
      renderToHardwareTextureAndroid={true}
      shouldRasterizeIOS={true}
    > 
      <Animated.View
        style={[
          styles.face,
          {
            opacity: frontOpacity,
            transform: [{ perspective: 1000 }, { rotateY: frontRotate }],
          },
        ]}
      >
        <Pressable style={styles.facePressable} onPress={handleFlip}>
          <View style={styles.progressPill}>
            <Text style={[styles.progressText, { color: palette.textSecondary }]}>
              {cardIndex} of {totalCards}
            </Text>
          </View>

          <StudyImage item={item} palette={palette} radius={radius} />

          <Text style={[styles.title, { color: palette.textPrimary }]} numberOfLines={2}>
            {item?.title || 'Untitled study item'}
          </Text>

          <View style={styles.tagWrap}>
            {(Array.isArray(item?.tags) ? item.tags : []).slice(0, 4).map((tag) => (
              <View
                key={`${item?.id}-tag-${tag}`}
                style={[styles.tag, { backgroundColor: palette.primaryLight }]}
              >
                <Text style={[styles.tagText, { color: palette.primary }]} numberOfLines={1}>
                  {tag}
                </Text>
              </View>
            ))}
          </View>

          <Text style={[styles.hintText, { color: palette.textSecondary }]}>Tap to reveal</Text>
        </Pressable>
      </Animated.View>

      <Animated.View
        style={[
          styles.face,
          styles.backFace,
          {
            opacity: backOpacity,
            transform: [{ perspective: 1000 }, { rotateY: backRotate }],
          },
        ]}
      >
        <View style={styles.facePressable}>
          <Pressable style={styles.flipImageArea} onPress={handleFlip}>
            <StudyImage item={item} palette={palette} radius={radius} />
          </Pressable>
          <Text style={[styles.hintText, { color: palette.textSecondary }]}>Tap image to flip back</Text>

          <ScrollView
            style={styles.summaryScroll}
            showsVerticalScrollIndicator={false}
            horizontal={false}
            directionalLockEnabled={true}
            scrollEnabled={!isPanning}
          >
            <Text style={[styles.summaryText, { color: palette.textPrimary }]}>
              {item?.summary || 'No summary available for this study card.'}
            </Text>
          </ScrollView>

          <View style={styles.metaRow}>
            <View style={[styles.retentionChip, { backgroundColor: palette.primaryLight }]}> 
              <Text style={[styles.retentionText, { color: palette.primary }]}>{retentionEstimate}</Text>
            </View>
            {lastReviewedLabel ? (
              <Text style={[styles.lastReviewed, { color: palette.textSecondary }]}>{lastReviewedLabel}</Text>
            ) : null}
          </View>

          <RatingBar onRate={onRate} theme={theme} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    minHeight: 520,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    position: 'relative',
  },
  face: {
    width: '100%',
    minHeight: 520,
    padding: 14,
    backfaceVisibility: 'hidden',
  },
  backFace: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backfaceVisibility: 'hidden',
  },
  facePressable: {
    flex: 1,
  },
  flipImageArea: {
    width: '100%',
  },
  progressPill: {
    position: 'absolute',
    right: 2,
    top: -4,
    zIndex: 2,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
  },
  image: {
    width: '100%',
    height: CARD_IMAGE_HEIGHT,
  },
  imageFallback: {
    width: '100%',
    height: CARD_IMAGE_HEIGHT,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageFallbackTitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  imageFallbackSummary: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  title: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
  },
  tagWrap: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginRight: 6,
    marginBottom: 6,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  hintText: {
    marginTop: 'auto',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    paddingTop: 12,
  },
  summaryScroll: {
    marginTop: 12,
    maxHeight: 160,
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '400',
  },
  metaRow: {
    marginTop: 12,
    marginBottom: 14,
  },
  retentionChip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  retentionText: {
    fontSize: 11,
    fontWeight: '700',
  },
  lastReviewed: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '500',
  },
});
