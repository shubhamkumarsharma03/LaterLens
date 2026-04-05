import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

const DAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function toDayKey(date) {
  const dateObj = new Date(date);
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getLastSevenDays() {
  const today = new Date();
  const result = [];

  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    result.push(date);
  }

  return result;
}

export default function StreakGrid({ streakData, theme }) {
  const animationValues = useRef(Array.from({ length: 7 }, () => new Animated.Value(0))).current;
  const days = useMemo(() => getLastSevenDays(), []);
  const todayKey = toDayKey(new Date());

  useEffect(() => {
    const animations = animationValues.map((value, index) =>
      Animated.spring(value, {
        toValue: 1,
        speed: 16,
        bounciness: 8,
        useNativeDriver: true,
      })
    );

    Animated.stagger(60, animations).start();
  }, [animationValues]);

  const activityMap = streakData?.activityByDate || {};
  const currentStreak = Math.round(streakData?.currentStreak || 0);
  const longestStreak = Math.round(streakData?.longestStreak || 0);
  const showBestBadge = currentStreak > 0 && currentStreak === longestStreak && longestStreak > 3;

  return (
    <View>
      <View style={styles.gridRow}>
        {days.map((date, index) => {
          const dayKey = toDayKey(date);
          const isActive = Boolean(activityMap[dayKey]);
          const isToday = dayKey === todayKey;

          const scale = animationValues[index].interpolate({
            inputRange: [0, 1],
            outputRange: [0.75, 1],
          });

          const opacity = animationValues[index];

          return (
            <Animated.View key={dayKey} style={{ transform: [{ scale }], opacity }}>
              <View
                style={[
                  styles.circle,
                  {
                    backgroundColor: isActive ? theme.successSoft : theme.border,
                    borderColor: isToday ? theme.primary : 'transparent',
                  },
                ]}
              >
                <Text style={[styles.initial, { color: isActive ? theme.success : theme.textTertiary }]}> 
                  {DAY_INITIALS[(date.getDay() + 6) % 7]}
                </Text>
              </View>
            </Animated.View>
          );
        })}
      </View>

      <View style={styles.summaryRow}>
        {currentStreak > 0 ? (
          <Text style={[styles.streakText, { color: theme.textPrimary }]}>{`${currentStreak}-day streak`}</Text>
        ) : (
          <Text style={[styles.streakText, { color: theme.textPrimary }]}>Start your streak today</Text>
        )}

        {showBestBadge ? (
          <View style={[styles.badge, { backgroundColor: theme.primarySoft }]}> 
            <Text style={[styles.badgeText, { color: theme.primary }]}>Personal best!</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  initial: {
    fontSize: 11,
    fontWeight: '600',
  },
  summaryRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  streakText: {
    fontSize: 14,
    fontWeight: '500',
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
});
