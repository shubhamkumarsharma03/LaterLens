import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Activity, BarChart2, CheckCircle2 } from 'lucide-react-native';
import { useQueue } from '../../state/QueueContext';
import { useTheme } from '../../theme/useTheme';
import { TYPOGRAPHY, SPACING, RADIUS } from '../../theme/colors';

function ProgressBar({ label, count, total, palette, color }) {
  const widthAnim = useRef(new Animated.Value(0)).current;
  const percentage = total > 0 ? (count / total) * 100 : 0;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: percentage,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [percentage, widthAnim]);

  const widthInterpolation = widthAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%']
  });

  return (
    <View style={styles.progressContainer}>
      <View style={styles.progressRow}>
        <Text style={[TYPOGRAPHY.bodyBold, { color: palette.textPrimary }]}>{label}</Text>
        <Text style={[TYPOGRAPHY.caption, { color: palette.textSecondary }]}>
          {count} ({percentage.toFixed(0)}%)
        </Text>
      </View>
      <View style={[styles.progressTrack, { backgroundColor: palette.emptyBg }]}>
        <Animated.View style={[styles.progressFill, { backgroundColor: color, width: widthInterpolation }]} />
      </View>
    </View>
  );
}

export default function InsightsScreen() {
  const { allItems } = useQueue();
  const theme = useTheme();
  const { palette } = theme;
  const insets = useSafeAreaInsets();

  const total = allItems.length;
  const completedCount = allItems.filter((i) => i.status === 'completed').length;

  const categoryCounts = allItems.reduce((acc, item) => {
    const type = item.contentType || 'Idea';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const sortedCategories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: palette.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 100, paddingTop: insets.top + SPACING.md }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[TYPOGRAPHY.heroTitle, { color: palette.textPrimary, marginBottom: SPACING.lg }]}>
        Insights
      </Text>

      {/* Header Metric */}
      <View style={styles.metricsRow}>
        <View style={[styles.metricCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Activity size={24} color={palette.primary} style={{ marginBottom: 8 }} />
          <Text style={[TYPOGRAPHY.heroTitle, { color: palette.textPrimary }]}>{total}</Text>
          <Text style={[TYPOGRAPHY.caption, { color: palette.textSecondary }]}>Screenshots Parsed</Text>
        </View>
        <View style={[styles.metricCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <CheckCircle2 size={24} color={palette.completeTint} style={{ marginBottom: 8 }} />
          <Text style={[TYPOGRAPHY.heroTitle, { color: palette.textPrimary }]}>{completedCount}</Text>
          <Text style={[TYPOGRAPHY.caption, { color: palette.textSecondary }]}>Actions Done</Text>
        </View>
      </View>

      {/* Category Dominance */}
      <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <View style={styles.cardHeader}>
          <BarChart2 size={20} color={palette.textPrimary} />
          <Text style={[TYPOGRAPHY.subtitle, { color: palette.textPrimary, marginLeft: 8 }]}>
            Category Breakdown
          </Text>
        </View>

        {sortedCategories.length > 0 ? (
          sortedCategories.map(([category, count]) => {
            const badgeConfig = theme.getCategoryBadge(category);
            return (
              <ProgressBar
                key={category}
                label={category}
                count={count}
                total={total}
                palette={palette}
                color={badgeConfig.text} // Use the text property for vibrant solid colors
              />
            );
          })
        ) : (
          <Text style={[TYPOGRAPHY.body, { color: palette.textSecondary, textAlign: 'center', marginVertical: 20 }]}>
            No data yet. Tap "Process Latest" to start.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: SPACING.md },
  metricsRow: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.lg },
  metricCard: { flex: 1, padding: SPACING.lg, borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth },
  card: { padding: SPACING.lg, borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.lg },
  progressContainer: { marginBottom: SPACING.md },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressTrack: { height: 8, borderRadius: RADIUS.pill, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: RADIUS.pill },
});
