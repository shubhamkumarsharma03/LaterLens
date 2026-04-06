import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ShieldCheck } from 'lucide-react-native';

import { useTheme } from '../../theme/useTheme';
import { COLLECTION_ROUTES } from '../../navigation/routeNames';
import StatCard from '../../components/insights/StatCard';
import CategoryBar from '../../components/insights/CategoryBar';
import StreakGrid from '../../components/insights/StreakGrid';
import DebtGauge from '../../components/insights/DebtGauge';
import { useQueue } from '../../state/QueueContext';
import {
  computeBacklogSize,
  computeCategoryBreakdown,
  getItemsForPeriod,
  getPreviousItemsForPeriod,
  computeTopInterests,
  computeTopStats,
  generateWeeklySummary,
  getLastBulkImportSummary,
  getStreakData,
  updateStreakData,
} from '../../services/insightsService';

const PERIODS = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'alltime', label: 'All time' },
];

function toDayKey(input) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function mapPeriodLabel(period) {
  if (period === 'week') return 'week';
  if (period === 'month') return 'month';
  return 'all time';
}

function buildActivityMap(allItems) {
  const map = {};
  const today = new Date();

  for (let offset = 0; offset < 7; offset += 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - offset);
    map[toDayKey(day)] = false;
  }

  (allItems || []).forEach((item) => {
    if (item?.status !== 'completed' || !item?.processedAt) return;
    const key = toDayKey(item.processedAt);
    if (map[key] !== undefined) {
      map[key] = true;
    }
  });

  return map;
}

function PeriodSelector({ active, onChange, palette }) {
  return (
    <View style={[styles.periodContainer, { borderColor: palette.border }]}>
      {PERIODS.map((option) => (
        <TouchableOpacity
          key={option.value}
          onPress={() => onChange(option.value)}
          style={[
            styles.periodBtn,
            active === option.value && { backgroundColor: palette.primary },
          ]}
        >
          <Text
            style={[
              styles.periodText,
              { color: active === option.value ? palette.toastText : palette.textSecondary },
            ]}
          >
            {option.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function InsightsScreen() {
  const theme = useTheme();
  const { palette } = theme;
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { allItems: queueAllItems, hydrateQueue } = useQueue();

  const [period, setPeriod] = useState('week');
  const [items, setItems] = useState([]);
  const [previousItems, setPreviousItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [categoryBreakdown, setCategoryBreakdown] = useState([]);
  const [streakData, setStreakData] = useState(null);
  const [backlog, setBacklog] = useState(null);
  const [weeklySummary, setWeeklySummary] = useState('');
  const [lastImportSummary, setLastImportSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [allItems, setAllItems] = useState([]);
  const [topInterestsText, setTopInterestsText] = useState('');
  const recomputeRequestIdRef = useRef(0);
  const recomputeDebounceRef = useRef(null);
  const skipNextRecomputeRef = useRef(false);

  const screenTheme = useMemo(
    () => ({
      cardSurface: palette.card,
      border: palette.border,
      primary: palette.primary,
      primarySoft: palette.primaryLight,
      textPrimary: palette.textPrimary,
      textSecondary: palette.textSecondary,
      textTertiary: palette.textSecondary,
      success: palette.completeTint,
      successSoft: palette.completeBg,
      warning: palette.urgencyAmber,
      danger: palette.urgencyRed,
      getCategoryColor: (category) => theme.getCategoryBadge(category).text,
    }),
    [palette, theme]
  );

  const recomputeForPeriod = useCallback(async (selectedPeriod, sourceItems, requestId) => {
    const currentItems = await getItemsForPeriod(selectedPeriod, sourceItems);
    const previousPeriodItems = await getPreviousItemsForPeriod(selectedPeriod, sourceItems);

    const nextStats = await computeTopStats(currentItems, previousPeriodItems);
    const nextBreakdown = await computeCategoryBreakdown(currentItems);
    const nextInterests = await computeTopInterests(currentItems);
    const nextBacklog = await computeBacklogSize(sourceItems);
    const previousStats = await computeTopStats(previousPeriodItems, []);

    if (requestId !== undefined && recomputeRequestIdRef.current !== requestId) {
      return;
    }

    setItems(currentItems);
    setPreviousItems(previousPeriodItems);
    setStats(nextStats);
    setCategoryBreakdown(nextBreakdown);
    setTopInterestsText(nextInterests);
    setBacklog(nextBacklog);

    if (new Date().getDay() === 1 && sourceItems.length >= 5) {
      const summary = await generateWeeklySummary(nextStats, previousStats);
      if (requestId !== undefined && recomputeRequestIdRef.current !== requestId) {
        return;
      }
      setWeeklySummary(summary);
    } else {
      setWeeklySummary('');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      hydrateQueue().catch((error) => {
        console.error('InsightsScreen: failed to hydrate queue on focus', error);
      });
    }, [hydrateQueue])
  );

  useEffect(() => {
    setAllItems(Array.isArray(queueAllItems) ? queueAllItems : []);
  }, [queueAllItems]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setIsLoading(true);

      try {
        const loadedAllItems = await hydrateQueue();
        const streak = await getStreakData();
        const updatedStreak = await updateStreakData(streak);
        const importSummary = await getLastBulkImportSummary();

        if (!active) return;

        setAllItems(loadedAllItems);
        setLastImportSummary(importSummary);
        setStreakData({
          ...updatedStreak,
          activityByDate: buildActivityMap(loadedAllItems),
        });

        const requestId = recomputeRequestIdRef.current + 1;
        recomputeRequestIdRef.current = requestId;
        await recomputeForPeriod('week', loadedAllItems, requestId);
        skipNextRecomputeRef.current = true;
      } catch (error) {
        console.error('InsightsScreen: failed to load insights data', error);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      active = false;
      recomputeRequestIdRef.current += 1;
      if (recomputeDebounceRef.current) {
        clearTimeout(recomputeDebounceRef.current);
      }
    };
  }, [hydrateQueue, recomputeForPeriod]);

  useEffect(() => {
    if (isLoading) return;

    if (skipNextRecomputeRef.current) {
      skipNextRecomputeRef.current = false;
      return;
    }

    const requestId = recomputeRequestIdRef.current + 1;
    recomputeRequestIdRef.current = requestId;

    if (recomputeDebounceRef.current) {
      clearTimeout(recomputeDebounceRef.current);
    }

    recomputeDebounceRef.current = setTimeout(() => {
      recomputeForPeriod(period, allItems, requestId).catch((error) => {
        console.error('InsightsScreen: failed to recompute period data', error);
      });
    }, 150);

    return () => {
      if (recomputeDebounceRef.current) {
        clearTimeout(recomputeDebounceRef.current);
      }
    };
  }, [period, allItems, isLoading, recomputeForPeriod]);

  const maxCategoryCount = useMemo(() => {
    return categoryBreakdown.reduce((max, item) => Math.max(max, item.savedCount), 0);
  }, [categoryBreakdown]);

  const onBacklogPress = useCallback(() => {
    if (backlog?.severity !== 'critical') return;

    navigation.navigate('Collections', {
      screen: COLLECTION_ROUTES.HOME,
      params: { status: 'pending' },
    });
  }, [backlog, navigation]);

  const parsedImportDate = lastImportSummary?.completedAt
    ? new Date(lastImportSummary.completedAt)
    : null;
  const formattedImportDate =
    parsedImportDate && !Number.isNaN(parsedImportDate.getTime())
      ? parsedImportDate.toLocaleDateString()
      : '';

  if (isLoading || !stats || !streakData || !backlog) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: palette.background }]}>
        <ActivityIndicator color={palette.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: palette.background }]}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 120,
        paddingHorizontal: 16,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: palette.textPrimary }]}>Insights</Text>
        <PeriodSelector active={period} onChange={setPeriod} palette={palette} />
      </View>

      {new Date().getDay() === 1 && allItems.length >= 5 && weeklySummary ? (
        <View
          style={[
            styles.weeklySummaryCard,
            {
              backgroundColor: palette.card,
              borderColor: palette.border,
              borderLeftColor: palette.primary,
            },
          ]}
        >
          <Text style={[styles.summaryText, { color: palette.textPrimary }]}>{weeklySummary}</Text>
        </View>
      ) : null}

      <View style={styles.gridRow}>
        <View style={styles.gridCol}>
          <StatCard
            label="Screenshots saved"
            value={Math.round(stats.totalSaved || 0)}
            delta={Math.round(stats.deltas?.totalSaved || 0)}
            theme={screenTheme}
          />
        </View>

        <View style={styles.gridCol}>
          <StatCard label="Acted on" value={Math.round(stats.totalActedOn || 0)} theme={screenTheme} />
          <Text style={[styles.actedSubtitle, { color: palette.textSecondary }]}>
            {`${Math.round(stats.completionRate || 0)}% completion rate this ${mapPeriodLabel(period)}.`}
          </Text>
        </View>
      </View>

      <View style={styles.gridRow}>
        <StatCard label="Days active" value={Math.round(stats.queueClearedDays || 0)} theme={screenTheme} />
        <StatCard label="Study reviewed" value={Math.round(stats.studyReviewed || 0)} theme={screenTheme} />
      </View>

      {(stats.privacyBlocked > 0 || stats.ocrFailed > 0) && (
        <View style={[styles.privacyCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.privacyHeader}>
            <ShieldCheck size={18} color={palette.primary} />
            <Text style={[styles.privacyTitle, { color: palette.textPrimary }]}>Your data, protected</Text>
          </View>

          <Text style={[styles.privacyBody, { color: palette.textSecondary }]}>
            {`${Math.round(stats.privacyBlocked || 0)} screenshots kept private this ${mapPeriodLabel(period)}.`}
          </Text>

          {stats.ocrFailed > 0 ? (
            <Text style={[styles.privacyBody, { color: palette.textSecondary }]}>
              {`${Math.round(stats.ocrFailed)} couldn't be read and are awaiting review.`}
            </Text>
          ) : null}
        </View>
      )}

      <Text style={[styles.sectionLabel, { color: palette.textSecondary }]}>By category</Text>
      <View style={[styles.sectionCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
        {categoryBreakdown
          .filter((entry) => entry.savedCount > 0)
          .map((categoryItem, index) => (
            <CategoryBar
              key={categoryItem.category}
              category={categoryItem.category}
              savedCount={Math.round(categoryItem.savedCount)}
              actedOnCount={Math.round(categoryItem.actedOnCount)}
              maxCount={maxCategoryCount}
              index={index}
              theme={screenTheme}
            />
          ))}

        <Text style={[styles.interestText, { color: palette.textSecondary }]}>{topInterestsText}</Text>
      </View>

      <Text style={[styles.sectionLabel, { color: palette.textSecondary }]}>Daily streak</Text>
      <View style={[styles.sectionCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <StreakGrid streakData={streakData} theme={screenTheme} />

        <View style={styles.streakStatsRow}>
          <View style={styles.streakStatItem}>
            <Text style={[styles.streakStatLabel, { color: palette.textSecondary }]}>Current</Text>
            <Text style={[styles.streakStatValue, { color: palette.textPrimary }]}>
              {Math.round(streakData.currentStreak || 0)}
            </Text>
          </View>
          <View style={styles.streakStatItem}>
            <Text style={[styles.streakStatLabel, { color: palette.textSecondary }]}>Longest</Text>
            <Text style={[styles.streakStatValue, { color: palette.textPrimary }]}>
              {Math.round(streakData.longestStreak || 0)}
            </Text>
          </View>
        </View>
      </View>

      <Text style={[styles.sectionLabel, { color: palette.textSecondary }]}>Screenshot backlog</Text>
      <View style={[styles.sectionCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <DebtGauge
          backlogCount={Math.round(backlog.backlogCount || 0)}
          severity={backlog.severity || 'ok'}
          theme={screenTheme}
          onPress={onBacklogPress}
        />
      </View>

      {lastImportSummary ? (
        <View style={[styles.importCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          {formattedImportDate ? (
            <Text style={[styles.importTitle, { color: palette.textPrimary }]}>{`Last import: ${formattedImportDate}`}</Text>
          ) : null}

          <View style={styles.importStatsRow}>
            <View style={[styles.importChip, { borderColor: palette.border }]}>
              <Text style={[styles.importChipLabel, { color: palette.textSecondary }]}>Total</Text>
              <Text style={[styles.importChipValue, { color: palette.textPrimary }]}>
                {Math.round(lastImportSummary.total || 0)}
              </Text>
            </View>

            <View style={[styles.importChip, { borderColor: palette.border }]}>
              <Text style={[styles.importChipLabel, { color: palette.textSecondary }]}>Processed</Text>
              <Text style={[styles.importChipValue, { color: palette.textPrimary }]}>
                {Math.round(lastImportSummary.successful || 0)}
              </Text>
            </View>

            <View style={[styles.importChip, { borderColor: palette.border }]}>
              <Text style={[styles.importChipLabel, { color: palette.textSecondary }]}>Blocked</Text>
              <Text style={[styles.importChipValue, { color: palette.textPrimary }]}>
                {Math.round(lastImportSummary.privacyBlocked || 0)}
              </Text>
            </View>

            <View style={[styles.importChip, { borderColor: palette.border }]}>
              <Text style={[styles.importChipLabel, { color: palette.textSecondary }]}>Failed</Text>
              <Text style={[styles.importChipValue, { color: palette.textPrimary }]}>
                {Math.round(lastImportSummary.ocrFailed || 0)}
              </Text>
            </View>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  periodContainer: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  periodBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  periodText: {
    fontSize: 12,
    fontWeight: '600',
  },
  weeklySummaryCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 3,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  summaryText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  gridRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  gridCol: {
    flex: 1,
  },
  actedSubtitle: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '500',
  },
  sectionLabel: {
    marginTop: 18,
    marginBottom: 8,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  sectionCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
  },
  privacyCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
  },
  privacyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  privacyTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  privacyBody: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  interestText: {
    marginTop: 4,
    fontSize: 13,
    fontStyle: 'italic',
    fontWeight: '500',
  },
  streakStatsRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  streakStatItem: {
    flex: 1,
    paddingTop: 6,
  },
  streakStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  streakStatValue: {
    marginTop: 4,
    fontSize: 20,
    fontWeight: '600',
  },
  importCard: {
    marginTop: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
  },
  importTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  importStatsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  importChip: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  importChipLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  importChipValue: {
    marginTop: 3,
    fontSize: 14,
    fontWeight: '600',
  },
});
