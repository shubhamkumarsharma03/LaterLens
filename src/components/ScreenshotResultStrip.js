import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { TYPOGRAPHY, SPACING, RADIUS } from '../theme/colors';
import { getCategoryIcon } from '../utils/categoryIcons';

export default function ScreenshotResultStrip({ items, onItemPress, theme }) {
  const palette = theme?.palette || {};
  const getCategoryBadge = theme?.getCategoryBadge;
  const [failedImageIds, setFailedImageIds] = useState({});

  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.contentContainer}
      style={styles.container}
    >
      {items.map((item) => {
        const Icon = getCategoryIcon(item?.category);
        const badge = getCategoryBadge ? getCategoryBadge(item?.category) : { bg: palette.primaryLight, text: palette.primary };

        return (
          <Pressable
            key={item?.id}
            style={[styles.card, { backgroundColor: palette.background, borderColor: palette.border }]}
            onPress={() => onItemPress?.(item)}
          >
            {item?.imagePath && !failedImageIds[item?.id] ? (
              <Image
                source={{ uri: item.imagePath }}
                style={styles.thumbnail}
                onError={() => setFailedImageIds((prev) => ({ ...prev, [item?.id]: true }))}
              />
            ) : (
              <View style={[styles.placeholder, { backgroundColor: palette.primaryLight }]}> 
                <Icon size={22} color={palette.primary} />
              </View>
            )}

            <View style={[styles.pill, { backgroundColor: badge.bg }]}> 
              <Text style={[TYPOGRAPHY.tiny, { color: badge.text }]} numberOfLines={1}>
                {item?.category || 'Item'}
              </Text>
            </View>

            <Text style={[TYPOGRAPHY.caption, styles.title, { color: palette.textPrimary }]} numberOfLines={2}>
              {item?.title || 'Untitled screenshot'}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: SPACING.sm,
  },
  contentContainer: {
    paddingHorizontal: 4,
    gap: SPACING.sm,
  },
  card: {
    width: 110,
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: SPACING.xs,
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.sm,
    alignSelf: 'center',
  },
  placeholder: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.sm,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    marginTop: SPACING.xs,
    alignSelf: 'center',
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    maxWidth: '100%',
  },
  title: {
    marginTop: SPACING.xs,
    textAlign: 'left',
    minHeight: 34,
  },
});
