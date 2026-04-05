import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

function formatValue(value, unit) {
  const roundedValue = Math.round((Number(value) || 0) * 10) / 10;
  if (!unit) {
    return `${roundedValue}`;
  }

  if (unit === '%') {
    return `${roundedValue}%`;
  }

  return `${roundedValue}${unit}`;
}

export default function StatCard({ label, value, delta, unit, accentColor, theme }) {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const listenerId = animatedValue.addListener(({ value: animatedNumber }) => {
      setDisplayValue(Math.round(animatedNumber * 10) / 10);
    });

    Animated.timing(animatedValue, {
      toValue: Number(value) || 0,
      duration: 800,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();

    return () => {
      animatedValue.removeListener(listenerId);
    };
  }, [animatedValue, value]);

  const isPositiveDelta = Number(delta) > 0;
  const isNegativeDelta = Number(delta) < 0;
  const showDelta = isPositiveDelta || isNegativeDelta;
  const roundedDelta = Math.round((Number(delta) || 0) * 10) / 10;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.cardSurface,
          borderColor: theme.border,
        },
      ]}
    >
      <Text style={[styles.label, { color: theme.textTertiary }]}>{label}</Text>
      <Text
        style={[
          styles.value,
          {
            color: accentColor || theme.textPrimary,
          },
        ]}
      >
        {formatValue(displayValue, unit)}
      </Text>

      {showDelta ? (
        <Text
          style={[
            styles.delta,
            {
              color: isPositiveDelta ? theme.success : theme.danger,
            },
          ]}
        >
          {`${isPositiveDelta ? '+' : ''}${roundedDelta} from last period`}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 120,
  },
  label: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '600',
  },
  value: {
    marginTop: 10,
    fontSize: 26,
    fontWeight: '500',
  },
  delta: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '500',
  },
});
