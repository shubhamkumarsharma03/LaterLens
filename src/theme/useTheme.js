/**
 * useTheme — central hook for LaterLens theming.
 *
 * Responds to device appearance via useColorScheme() and
 * exposes the full palette + helper utilities.
 */

import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { LIGHT, DARK, TYPOGRAPHY, SPACING, RADIUS, getCategoryBadge } from './colors';

export function useTheme() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const palette = isDark ? DARK : LIGHT;

  const theme = useMemo(
    () => ({
      isDark,
      palette,
      typography: TYPOGRAPHY,
      spacing: SPACING,
      radius: RADIUS,
      getCategoryBadge: (category) => getCategoryBadge(category, isDark),

      /* Convenience helper — card container styles */
      cardStyle: isDark
        ? {
            backgroundColor: DARK.card,
            borderRadius: RADIUS.lg,
            ...DARK.cardBorder,
          }
        : {
            backgroundColor: LIGHT.card,
            borderRadius: RADIUS.lg,
            ...LIGHT.shadow,
          },
    }),
    [isDark]
  );

  return theme;
}
