import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

function darkenHexColor(hexColor, factor = 0.18) {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hexColor || '');
  if (!match) {
    return hexColor;
  }

  const next = [1, 2, 3].map((index) => {
    const value = parseInt(match[index], 16);
    const darkened = Math.max(0, Math.round(value * (1 - factor)));
    return darkened.toString(16).padStart(2, '0');
  });

  return `#${next.join('')}`;
}

export default function CategoryBar({
  category,
  savedCount,
  actedOnCount,
  maxCount,
  theme,
  index = 0,
}) {
  const animation = useRef(new Animated.Value(0)).current;

  const safeMax = Math.max(1, maxCount || 1);
  const savedRatio = Math.max(0, Math.min(1, (savedCount || 0) / safeMax));
  const actedRatio = Math.max(0, Math.min(1, (actedOnCount || 0) / safeMax));
  const safeSavedCount = Math.round(savedCount ?? 0);
  const safeActedCount = Math.round(actedOnCount ?? 0);

  useEffect(() => {
    const anim = Animated.timing(animation, {
      toValue: 1,
      duration: 600,
      delay: index * 80,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });

    anim.start();

    return () => {
      anim.stop();
    };
  }, [animation, index]);

  const savedWidth = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', `${savedRatio * 100}%`],
  });

  const actedWidth = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', `${actedRatio * 100}%`],
  });

  const categoryColor = theme.getCategoryColor(category);
  const actedColor = darkenHexColor(categoryColor, 0.2);

  return (
    <View style={styles.row}>
      <Text style={[styles.category, { color: theme.textPrimary }]} numberOfLines={1}>
        {category}
      </Text>

      <View style={[styles.track, { backgroundColor: theme.border }]}> 
        <Animated.View style={[styles.savedFill, { width: savedWidth, backgroundColor: categoryColor }]} />
        <Animated.View style={[styles.actedFill, { width: actedWidth, backgroundColor: actedColor }]} />
      </View>

      <Text style={[styles.count, { color: theme.textTertiary }]}>{`${safeActedCount} / ${safeSavedCount}`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  category: {
    width: 110,
    fontSize: 13,
    marginRight: 10,
    fontWeight: '500',
  },
  track: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  savedFill: {
    height: 6,
    borderRadius: 3,
  },
  actedFill: {
    height: 6,
    borderRadius: 3,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  count: {
    width: 40,
    marginLeft: 10,
    textAlign: 'right',
    fontSize: 11,
    fontWeight: '500',
  },
});
