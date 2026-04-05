import React, { useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

const BUTTON_SIZE = 44;
const LABELS = {
  0: 'Blank',
  1: 'Wrong',
  2: 'Hard',
  3: 'OK',
  4: 'Good',
  5: 'Easy',
};
const FALLBACK_COLOR = '#cccccc';

function colorWithAlpha(color, alpha) {
  if (!color || typeof color !== 'string') return color;

  const hex = color.replace('#', '');
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  return color;
}

export default function RatingBar({ onRate, theme }) {
  const palette = theme?.palette || {};
  const [currentRating, setCurrentRating] = useState(null);
  const scales = useRef(
    Array.from({ length: 6 }, () => new Animated.Value(1))
  ).current;

  const ratingColors = useMemo(() => {
    const danger = palette.urgencyRed || palette.primary || FALLBACK_COLOR;
    const success = palette.completeTint || palette.primary || FALLBACK_COLOR;

    return {
      0: colorWithAlpha(danger, 0.16),
      1: colorWithAlpha(danger, 0.24),
      2: colorWithAlpha(danger, 0.34),
      3: colorWithAlpha(success, 0.2),
      4: colorWithAlpha(success, 0.32),
      5: colorWithAlpha(success, 0.46),
    };
  }, [palette.completeTint, palette.primary, palette.urgencyRed]);

  const handlePress = (rating) => {
    const value = scales[rating];
    Animated.sequence([
      Animated.timing(value, {
        toValue: 0.92,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(value, {
        toValue: 1,
        damping: 15,
        stiffness: 300,
        mass: 1,
        useNativeDriver: true,
      }),
    ]).start();

    setCurrentRating(rating);
    onRate?.(rating);
  };

  return (
    <View style={styles.container}>
      {Array.from({ length: 6 }, (_, rating) => (
        <View key={rating} style={styles.ratingCell}>
          <Pressable
            onPress={() => handlePress(rating)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Set rating ${rating} out of 5`}
            accessibilityState={{ selected: currentRating === rating }}
          >
            <Animated.View
              style={[
                styles.button,
                {
                  backgroundColor: ratingColors[rating],
                  borderColor: palette.border,
                  transform: [{ scale: scales[rating] }],
                },
              ]}
            >
              <Text style={[styles.buttonText, { color: palette.textPrimary }]}>{rating}</Text>
            </Animated.View>
          </Pressable>
          <Text style={[styles.label, { color: palette.textSecondary }]}>{LABELS[rating]}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  ratingCell: {
    alignItems: 'center',
    width: `${100 / 6}%`,
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  label: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '600',
  },
});
