import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { RADIUS } from '../../theme/colors';

export default function OnboardingCard({ children, style }) {
  const { palette } = useTheme();

  return (
    <View style={[
      styles.card, 
      { 
        backgroundColor: palette.card,
        borderColor: palette.border,
      },
      !palette.isDark && palette.shadow,
      style
    ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.lg,
    padding: 16,
    marginVertical: 8,
    borderWidth: Platform.OS === 'android' ? 0 : 1,
  },
});
