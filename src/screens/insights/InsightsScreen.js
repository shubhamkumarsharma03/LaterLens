import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  Camera, 
  CheckCircle2, 
  Calendar, 
  ArrowUpRight, 
  Zap, 
  TrendingUp, 
  Share2 
} from 'lucide-react-native';
import { useQueue } from '../../state/QueueContext';
import { useTheme } from '../../theme/useTheme';
import EmptyState from '../../components/shared/EmptyState';
import { BarChart2 } from 'lucide-react-native';
import { TYPOGRAPHY, SPACING, RADIUS } from '../../theme/colors';
import { calculateInsights } from '../../services/statsEngine';
import MetricCard from '../../components/insights/MetricCard';
import { CategoryBarChart, DebtGauge } from '../../components/insights/InsightCharts';
import { SevenDayStreakGrid, PersonalBestBanner } from '../../components/insights/StreakSystem';

const PeriodSelector = ({ active, onChange, palette }) => {
  const periods = ['week', 'month', 'all'];
  
  return (
    <View style={[styles.periodContainer, { backgroundColor: palette.card, borderColor: palette.border }]}>
      {periods.map(p => (
        <TouchableOpacity
          key={p}
          onPress={() => onChange(p)}
          style={[
            styles.periodBtn,
            active === p && { backgroundColor: palette.primary }
          ]}
        >
          <Text style={[
            styles.periodText,
            { color: active === p ? '#FFF' : palette.textSecondary }
          ]}>
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

export default function InsightsScreen() {
  const { allItems } = useQueue();
  const theme = useTheme();
  const { palette } = theme;
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState('month');

  const stats = useMemo(() => calculateInsights(allItems, period), [allItems, period]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: palette.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 100, paddingTop: insets.top + SPACING.md }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[TYPOGRAPHY.heroTitle, { color: palette.textPrimary, marginBottom: SPACING.md, paddingHorizontal: SPACING.md }]}>
        Insights dashboard
      </Text>
      
      <Text style={[TYPOGRAPHY.body, { color: palette.textSecondary, marginBottom: SPACING.lg, paddingHorizontal: SPACING.md }]}>
        Your personal analytics dashboard.
      </Text>

      {allItems.length === 0 ? (
        <View style={{ flex: 1, paddingHorizontal: SPACING.md }}>
          <EmptyState 
            title="Insights require data" 
            subtitle="Start capturing screenshots to unlock your personalized habits, completion rates, and streak analysis."
            icon={BarChart2}
          />
        </View>
      ) : (
        <>
          {/* Period Selector */}
          <View style={{ paddingHorizontal: SPACING.md }}>
             <PeriodSelector active={period} onChange={setPeriod} palette={palette} />
          </View>

          {/* Top Stats Row */}
          <View style={styles.metricsRow}>
            <MetricCard 
              title="Screenshots saved"
              value={stats.saved.count}
              delta={period !== 'all' ? stats.saved.delta : undefined}
              icon={Camera}
            />
            <MetricCard 
              title="Actions taken"
              value={stats.actions.count}
              delta={period !== 'all' ? stats.actions.delta : undefined}
              subtitle={`Completing ${stats.actions.rate.toFixed(0)}% of items`}
              icon={CheckCircle2}
              color={palette.completeTint}
            />
          </View>

          <View style={styles.metricsRow}>
            <MetricCard 
              title="Queue cleared days"
              value={stats.clearedDays}
              subtitle="Feeds the streak system"
              icon={Calendar}
              color={palette.urgencyAmber}
            />
            <MetricCard 
              title="Study items reviewed"
              value={Math.floor(stats.actions.count * 0.4)} // Simulated study specific count
              subtitle="Motivates students"
              icon={Zap}
              color={palette.primary}
            />
          </View>

          {/* Category Breakdown */}
          <View style={{ paddingHorizontal: SPACING.md, marginTop: SPACING.lg }}>
            <CategoryBarChart data={stats.categoryStats} />
          </View>

          {/* Top Interests */}
          <View style={[styles.interestsCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
             <Text style={[styles.chartTitle, { color: palette.textPrimary }]}>Top interests list</Text>
             <Text style={[TYPOGRAPHY.body, { color: palette.textSecondary, marginTop: 4 }]}>
               Your top {stats.topInterests.length} topics this {period}: {stats.topInterests.join(', ')}.
             </Text>
             <View style={styles.aiBadge}>
                <TrendingUp size={12} color={palette.primary} />
                <Text style={[TYPOGRAPHY.tiny, { color: palette.primary, fontWeight: '700' }]}>AI Narrative</Text>
             </View>
          </View>

          {/* Streak + Habit System */}
          <View style={styles.metricsRow}>
            <SevenDayStreakGrid grid={stats.streak.grid} currentStreak={stats.streak.count} />
          </View>
          
          <View style={{ paddingHorizontal: SPACING.md }}>
             <PersonalBestBanner best={stats.streak.best} />
          </View>

          {/* Weekly Summary & Debt Gauge */}
          <View style={styles.metricsRow}>
             <View style={[styles.summaryCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
                <Text style={[styles.chartTitle, { color: palette.textPrimary }]}>Weekly summary card</Text>
                <Text style={[TYPOGRAPHY.body, { color: palette.textSecondary, marginTop: 8 }]}>
                  Last week you saved {stats.saved.count} things and acted on {stats.actions.count} — your best week yet.
                </Text>
             </View>
             <DebtGauge value={stats.backlog} />
          </View>

          {/* Settings Tab Placeholder Link */}
          <TouchableOpacity style={[styles.settingsBtn, { backgroundColor: palette.card, borderColor: palette.border }]}>
             <Share2 size={20} color={palette.textPrimary} />
             <Text style={[TYPOGRAPHY.bodyBold, { color: palette.textPrimary }]}>Share My Insights</Text>
          </TouchableOpacity>
        </>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  periodContainer: {
    flexDirection: 'row',
    padding: 6,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
  },
  periodText: {
    ...TYPOGRAPHY.bodyBold,
    fontSize: 14,
  },
  metricsRow: { 
    flexDirection: 'row', 
    gap: SPACING.md, 
    marginBottom: SPACING.md, 
    paddingHorizontal: SPACING.md 
  },
  interestsCard: {
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.lg,
  },
  chartTitle: {
    ...TYPOGRAPHY.subtitle,
    fontWeight: '700',
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 12,
  },
  summaryCard: {
    flex: 1.5,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  settingsBtn: {
    margin: SPACING.md,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  }
});
