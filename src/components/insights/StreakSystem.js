import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Trophy, Share2 } from 'lucide-react-native';
import { TYPOGRAPHY, SPACING, RADIUS } from '../../theme/colors';
import { useTheme } from '../../theme/useTheme';

export const SevenDayStreakGrid = ({ grid, currentStreak }) => {
  const { palette } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border, flex: 1 }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: palette.textPrimary }]}>7-day streak grid</Text>
        <View style={[styles.streakBadge, { backgroundColor: palette.completeBg }]}>
           <Text style={[styles.streakCount, { color: palette.completeTint }]}>{currentStreak}</Text>
        </View>
      </View>
      
      <View style={styles.gridRow}>
        {grid.map((item, idx) => (
          <View key={idx} style={styles.dayCol}>
            <View style={[
              styles.circle, 
              { 
                backgroundColor: item.active ? palette.completeTint : palette.emptyBg,
                borderColor: item.active ? palette.completeTint : palette.border 
              }
            ]} />
            <Text style={[styles.dayLabel, { color: palette.textSecondary }]}>{item.day[0]}</Text>
          </View>
        ))}
      </View>
      <Text style={[styles.footer, { color: palette.textSecondary }]}>
        Row of 7 day circles (M-S). Green-filled = queue reviewed that day.
      </Text>
    </View>
  );
};

export const PersonalBestBanner = ({ best }) => {
  const { palette } = useTheme();

  return (
    <View style={[styles.banner, { backgroundColor: palette.primary, borderColor: palette.primary }]}>
      <Trophy size={20} color="#FFF" />
      <Text style={styles.bannerText}>
        New record — {best} days in a row!
      </Text>
      <Share2 size={16} color="#FFF" style={{ marginLeft: 'auto' }} />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  title: {
    ...TYPOGRAPHY.subtitle,
    fontWeight: '700',
  },
  streakBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  },
  streakCount: {
    ...TYPOGRAPHY.bodyBold,
    fontSize: 18,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  dayCol: {
    alignItems: 'center',
    gap: 8,
  },
  circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
  },
  dayLabel: {
    ...TYPOGRAPHY.tiny,
    fontWeight: '700',
  },
  footer: {
    ...TYPOGRAPHY.tiny,
    lineHeight: 18,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  bannerText: {
    ...TYPOGRAPHY.bodyBold,
    color: '#FFF',
  }
});
