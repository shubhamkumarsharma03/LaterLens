import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Circle, Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/useTheme';
import { COLLECTION_ROUTES } from '../../navigation/routeNames';
import { LEGACY_STORAGE_KEYS, STORAGE_KEYS } from '../../constants/storageKeys';
import StudyCard from '../../components/StudyCard';
import {
  getTodaysQueue,
  processRating,
} from '../../services/spacedRepetitionService';
import { updateStreakData } from '../../services/insightsService';

const ACTION_QUEUE_KEY = STORAGE_KEYS.ACTION_ITEMS;
const STREAK_DATA_KEY = STORAGE_KEYS.STREAK_DATA;
const SWIPE_THRESHOLD = 80;

function toLocalDateString(dateObj) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTodayKey() {
  return toLocalDateString(new Date());
}

function toDateKey(value) {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return toLocalDateString(parsed);
}

function dateDiffInDays(fromKey, toKey) {
  if (!fromKey || !toKey) return null;
  const from = new Date(`${fromKey}T00:00:00.000Z`).getTime();
  const to = new Date(`${toKey}T00:00:00.000Z`).getTime();
  return Math.floor((to - from) / (24 * 60 * 60 * 1000));
}

function getNextReviewHint(earliestDate) {
  const today = getTodayKey();
  if (!earliestDate) return 'Next review: tomorrow';
  const delta = dateDiffInDays(today, earliestDate);
  if (delta === null || delta <= 1) return 'Next review: tomorrow';
  return `Next review: in ${delta} days`;
}

async function getWithLegacyMigration(primaryKey, legacyKeys = []) {
  const currentRaw = await AsyncStorage.getItem(primaryKey);
  if (currentRaw !== null) {
    return currentRaw;
  }

  for (const legacyKey of legacyKeys) {
    const legacyRaw = await AsyncStorage.getItem(legacyKey);
    if (legacyRaw !== null) {
      await AsyncStorage.setItem(primaryKey, legacyRaw);
      return legacyRaw;
    }
  }

  return null;
}

async function getEarliestFutureReviewDate() {
  const raw = await AsyncStorage.getItem(ACTION_QUEUE_KEY);
  if (!raw) return null;

  let parsed = [];
  try {
    parsed = JSON.parse(raw);
  } catch (_error) {
    parsed = [];
  }

  const today = getTodayKey();
  const upcoming = (Array.isArray(parsed) ? parsed : [])
    .filter((item) => item?.srEnabled === true)
    .map((item) => toDateKey(item?.srNextReviewDate))
    .filter((value) => !!value && value > today)
    .sort();

  return upcoming[0] || null;
}

function CompletionMark({ color, accent }) {
  return (
    <Svg width={88} height={88} viewBox="0 0 88 88">
      <Circle cx="44" cy="44" r="38" stroke={color} strokeWidth="4" fill="none" opacity="0.3" />
      <Path
        d="M28 45.5L39.5 57L61 34"
        stroke={accent}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

export default function StudyQueueScreen() {
  const navigation = useNavigation();
  const theme = useTheme();
  const { palette } = theme;

  const [status, setStatus] = useState('loading');
  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [ratings, setRatings] = useState([]);
  const [nextHint, setNextHint] = useState('Next review: tomorrow');
  const [streakInfo, setStreakInfo] = useState({ increased: false, value: 0 });
  const [isPanning, setIsPanning] = useState(false);

  const translateX = useRef(new Animated.Value(0)).current;
  const isAnimating = useRef(false);
  const isSubmitting = useRef(false);

  const totalCards = queue.length;
  const currentItem = queue[currentIndex] || null;

  const progressRatio = totalCards > 0 ? currentIndex / totalCards : 0;

  const loadQueue = useCallback(async () => {
    setStatus('loading');

    try {
      const [dueItems, earliestDate] = await Promise.all([
        getTodaysQueue(),
        getEarliestFutureReviewDate(),
      ]);

      setQueue(dueItems);
      setCurrentIndex(0);
      setRatings([]);
      setNextHint(getNextReviewHint(earliestDate));
      setStatus(dueItems.length > 0 ? 'active' : 'empty');
    } catch (error) {
      console.error('StudyQueueScreen: failed to load queue', error);
      setQueue([]);
      setCurrentIndex(0);
      setRatings([]);
      setNextHint('Next review: tomorrow');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const finishSession = useCallback(async () => {
    const rawStreak = await getWithLegacyMigration(
      STREAK_DATA_KEY,
      LEGACY_STORAGE_KEYS.STREAK_DATA || []
    );
    let previousStreak = 0;

    if (rawStreak) {
      try {
        const parsed = JSON.parse(rawStreak);
        previousStreak = Number(parsed?.currentStreak || 0);
      } catch (_error) {
        previousStreak = 0;
      }
    }

    const updatedStreak = await updateStreakData();
    const nextStreak = Number(updatedStreak?.currentStreak || 0);

    setStreakInfo({
      increased: nextStreak > previousStreak,
      value: nextStreak,
    });
    setStatus('complete');
  }, []);

  const animateToNextCard = useCallback(
    (direction) => {
      const targetX = direction > 0 ? 420 : -420;
      isAnimating.current = true;

      Animated.timing(translateX, {
        toValue: targetX,
        duration: 220,
        useNativeDriver: true,
      }).start(() => {
        const nextIndex = currentIndex + 1;

        if (nextIndex >= totalCards) {
          translateX.setValue(0);
          isAnimating.current = false;
          finishSession();
          return;
        }

        setCurrentIndex(nextIndex);
        translateX.setValue(direction > 0 ? -320 : 320);

        Animated.spring(translateX, {
          toValue: 0,
          damping: 16,
          stiffness: 220,
          mass: 1,
          useNativeDriver: true,
        }).start(() => {
          isAnimating.current = false;
        });
      });
    },
    [currentIndex, finishSession, totalCards, translateX]
  );

  const submitRating = useCallback(
    async (rating, forcedDirection) => {
      if (!currentItem || isSubmitting.current || isAnimating.current) return;
      isSubmitting.current = true;

      try {
        await processRating(currentItem, rating);
        setRatings((prev) => [...prev, { itemId: currentItem.id, rating }]);

        const direction =
          typeof forcedDirection === 'number' ? forcedDirection : rating >= 3 ? 1 : -1;
        animateToNextCard(direction);
      } catch (error) {
        Alert.alert('Rating error', 'Could not save your review. Please try again.');
      } finally {
        isSubmitting.current = false;
      }
    },
    [animateToNextCard, currentItem]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onPanResponderGrant: () => {
          setIsPanning(true);
        },
        onMoveShouldSetPanResponder: (_evt, gestureState) =>
          Math.abs(gestureState.dx) > 10 && !isAnimating.current,
        onPanResponderMove: (_evt, gestureState) => {
          if (isAnimating.current) return;
          translateX.setValue(gestureState.dx);
        },
        onPanResponderRelease: (_evt, gestureState) => {
          setIsPanning(false);
          if (isAnimating.current) return;

          if (gestureState.dx >= SWIPE_THRESHOLD) {
            submitRating(5, 1);
            return;
          }

          if (gestureState.dx <= -SWIPE_THRESHOLD) {
            submitRating(0, -1);
            return;
          }

          Animated.spring(translateX, {
            toValue: 0,
            damping: 16,
            stiffness: 200,
            mass: 1,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderTerminate: () => {
          setIsPanning(false);
        },
      }),
    [submitRating, translateX]
  );

  const correctCount = ratings.filter((entry) => entry.rating >= 3).length;
  const revisitCount = ratings.filter((entry) => entry.rating < 3).length;

  if (status === 'loading') {
    return (
      <View style={[styles.centered, { backgroundColor: palette.background }]}> 
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  if (status === 'empty') {
    return (
      <View style={[styles.centered, { backgroundColor: palette.background, padding: 24 }]}> 
        <CompletionMark color={palette.border} accent={palette.primary} />
        <Text style={[styles.emptyTitle, { color: palette.textPrimary }]}>You're all caught up for today</Text>
        <Text style={[styles.emptySubtitle, { color: palette.textSecondary }]}>{nextHint}</Text>

        <Pressable
          style={[styles.primaryButton, { backgroundColor: palette.primary }]}
          onPress={() => navigation.navigate(COLLECTION_ROUTES.CATEGORY, { contentType: 'Study Material' })}
          accessibilityRole="button"
          accessibilityLabel="Browse study material, open study material categories"
        >
          <Text style={[styles.primaryButtonText, { color: palette.toastText }]}>Browse study material</Text>
        </Pressable>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={[styles.centered, { backgroundColor: palette.background, padding: 24 }]}> 
        <Text style={[styles.emptyTitle, { color: palette.textPrimary }]}>Could not load study queue</Text>
        <Text style={[styles.emptySubtitle, { color: palette.textSecondary }]}>Please try again.</Text>

        <Pressable
          style={[styles.primaryButton, { backgroundColor: palette.primary }]}
          onPress={loadQueue}
          accessibilityRole="button"
          accessibilityLabel="Retry loading study queue"
        >
          <Text style={[styles.primaryButtonText, { color: palette.toastText }]}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (status === 'complete') {
    return (
      <View style={[styles.centered, { backgroundColor: palette.background, padding: 24 }]}> 
        <Text style={[styles.completeTitle, { color: palette.textPrimary }]}>
          Session complete - {ratings.length} cards reviewed
        </Text>
        <Text style={[styles.completeLine, { color: palette.textSecondary }]}>
          {correctCount} correct, {revisitCount} to revisit
        </Text>
        {revisitCount > 0 ? (
          <Text style={[styles.completeLine, { color: palette.textSecondary }]}>
            {revisitCount} items scheduled for tomorrow
          </Text>
        ) : null}
        <Text style={[styles.completeLine, { color: palette.textSecondary }]}>
          {streakInfo.increased
            ? `Streak increased to ${streakInfo.value} days`
            : `Current streak: ${streakInfo.value} days`}
        </Text>

        <Pressable
          style={[styles.primaryButton, { backgroundColor: palette.primary }]}
          onPress={() => navigation.navigate(COLLECTION_ROUTES.HOME)}
          accessibilityRole="button"
          accessibilityLabel="Back to collections"
        >
          <Text style={[styles.primaryButtonText, { color: palette.toastText }]}>Back to Collections</Text>
        </Pressable>
      </View>
    );
  }

  const failOpacity = translateX.interpolate({
    inputRange: [-140, -80, 0],
    outputRange: [1, 0.75, 0],
    extrapolate: 'clamp',
  });

  const easyOpacity = translateX.interpolate({
    inputRange: [0, 80, 140],
    outputRange: [0, 0.75, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}> 
      <View style={styles.progressHeader}>
        <View style={[styles.progressTrack, { backgroundColor: palette.border }]}> 
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: palette.primary,
                width: `${Math.max(8, progressRatio * 100)}%`,
              },
            ]}
          />
        </View>
        <Text style={[styles.progressLabel, { color: palette.textSecondary }]}>
          {currentIndex + 1} / {totalCards}
        </Text>
      </View>

      <View style={styles.cardStage}>
        <Animated.View style={[styles.swipeBadgeLeft, { opacity: failOpacity, backgroundColor: palette.urgencyRedBg }]}> 
          <Text style={[styles.swipeBadgeText, { color: palette.urgencyRed }]}>Fail (0)</Text>
        </Animated.View>
        <Animated.View style={[styles.swipeBadgeRight, { opacity: easyOpacity, backgroundColor: palette.completeBg }]}> 
          <Text style={[styles.swipeBadgeText, { color: palette.completeTint }]}>Easy (5)</Text>
        </Animated.View>

        <Animated.View
          style={{
            width: '100%',
            transform: [{ translateX }],
          }}
          {...panResponder.panHandlers}
        >
          {currentItem ? (
            <StudyCard
              item={currentItem}
              cardIndex={currentIndex + 1}
              totalCards={totalCards}
              onRate={submitRating}
              theme={theme}
              isPanning={isPanning}
            />
          ) : null}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    marginTop: 18,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  primaryButton: {
    marginTop: 20,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  progressHeader: {
    marginBottom: 14,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    borderRadius: 999,
  },
  progressLabel: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
  },
  cardStage: {
    flex: 1,
    justifyContent: 'center',
  },
  swipeBadgeLeft: {
    position: 'absolute',
    left: 0,
    top: '40%',
    zIndex: 2,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  swipeBadgeRight: {
    position: 'absolute',
    right: 0,
    top: '40%',
    zIndex: 2,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  swipeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  completeTitle: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  completeLine: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});
