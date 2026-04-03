import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { TYPOGRAPHY, SPACING, RADIUS } from '../../theme/colors';

/**
 * @typedef {Object} StorageUsageBarProps
 * @property {number} totalSizeMB - Total size in MB
 * @property {Object} breakdown - Breakdown values in percentage (0-1)
 * @property {number} breakdown.metadata - Percentage for AI metadata
 * @property {number} breakdown.thumbnails - Percentage for thumbnails
 */

const StorageUsageBar = ({ totalSizeMB, breakdown = { metadata: 0.4, thumbnails: 0.6 } }) => {
  const { palette } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.barContainer}>
        {/* Thumbnails (Primary) */}
        <View
          style={[
            styles.segment,
            {
              flex: breakdown.thumbnails,
              backgroundColor: palette.primary,
              borderTopLeftRadius: RADIUS.sm,
              borderBottomLeftRadius: RADIUS.sm,
            },
          ]}
        />
        {/* Metadata (Amber) */}
        <View
          style={[
            styles.segment,
            {
              flex: breakdown.metadata,
              backgroundColor: palette.urgencyAmber,
              borderTopRightRadius: RADIUS.sm,
              borderBottomRightRadius: RADIUS.sm,
            },
          ]}
        />
      </View>

      <View style={styles.footer}>
        <View style={styles.statRow}>
          <View style={[styles.dot, { backgroundColor: palette.primary }]} />
          <Text style={[TYPOGRAPHY.tiny, { color: palette.textSecondary }]}>
            Media: {(breakdown.thumbnails * 100).toFixed(0)}%
          </Text>
        </View>
        <View style={styles.statRow}>
          <View style={[styles.dot, { backgroundColor: palette.urgencyAmber }]} />
          <Text style={[TYPOGRAPHY.tiny, { color: palette.textSecondary }]}>
            AI Data: {(breakdown.metadata * 100).toFixed(0)}%
          </Text>
        </View>
        <Text style={[TYPOGRAPHY.bodyBold, { color: palette.textPrimary, marginLeft: 'auto' }]}>
          {totalSizeMB.toFixed(1)} MB
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  barContainer: {
    height: 8,
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
  },
  segment: {
    height: '100%',
  },
  footer: {
    flexDirection: 'row',
    marginTop: SPACING.sm,
    alignItems: 'center',
    gap: SPACING.md,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});

export default StorageUsageBar;
