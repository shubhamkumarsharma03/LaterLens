import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

export default function DebtGauge({ backlogCount, severity, theme, onPress }) {
  const safeTheme = {
    danger: '#d14343',
    warning: '#c58b00',
    success: '#2f9e44',
    border: '#d1d5db',
    textTertiary: '#6b7280',
    textSecondary: '#4b5563',
    ...(theme || {}),
  };
  const animation = useRef(new Animated.Value(0)).current;
  const safeCount = Math.max(0, Math.round(backlogCount || 0));
  const fillTarget = Math.min((safeCount / 50) * 100, 100);
  const isCritical = severity === 'critical';

  useEffect(() => {
    const anim = Animated.timing(animation, {
      toValue: fillTarget,
      duration: 1000,
      easing: Easing.out(Easing.exp),
      useNativeDriver: false,
    });

    anim.start();

    return () => {
      anim.stop();
    };
  }, [animation, fillTarget]);

  const fillWidth = animation.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  const fillColor =
    severity === 'critical' ? safeTheme.danger : severity === 'warning' ? safeTheme.warning : safeTheme.success;

  const message = isCritical
    ? `${safeCount} screenshots older than 7 days - tap to review`
    : `${safeCount} screenshots older than 7 days`;

  return (
    <Pressable
      onPress={isCritical ? onPress : undefined}
      disabled={!isCritical}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={
        isCritical
          ? `Debt gauge, critical backlog of ${safeCount} screenshots. Tap to review.`
          : `Debt gauge, backlog at ${safeCount} screenshots.`
      }
      accessibilityState={{ disabled: !isCritical }}
    >
      <View style={styles.wrapper}>
        <Text style={[styles.label, { color: safeTheme.textTertiary }]}>Unreviewed backlog</Text>

        <View style={[styles.track, { backgroundColor: safeTheme.border }]}> 
          <Animated.View
            style={[
              styles.fill,
              {
                width: fillWidth,
                maxWidth: `${fillTarget}%`,
                backgroundColor: fillColor,
              },
            ]}
          />
        </View>

        <Text style={[styles.message, { color: safeTheme.textSecondary }]}>{message}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  track: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: 8,
    borderRadius: 4,
  },
  message: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '500',
  },
});
