import { 
  startOfWeek, endOfWeek, subWeeks, 
  startOfMonth, endOfMonth, subMonths, 
  isWithinInterval, isSameDay, subDays, 
  format, eachDayOfInterval 
} from 'date-fns';

/**
 * Calculates dashboard metrics from a flat list of queue items.
 */
export function calculateInsights(allItems, period = 'month') {
  const now = new Date();
  let currentRange, previousRange;

  if (period === 'week') {
    currentRange = { start: startOfWeek(now), end: endOfWeek(now) };
    previousRange = { 
      start: startOfWeek(subWeeks(now, 1)), 
      end: endOfWeek(subWeeks(now, 1)) 
    };
  } else if (period === 'month') {
    currentRange = { start: startOfMonth(now), end: endOfMonth(now) };
    previousRange = { 
      start: startOfMonth(subMonths(now, 1)), 
      end: endOfMonth(subMonths(now, 1)) 
    };
  } else {
    // All time
    currentRange = { start: new Date(0), end: now };
    previousRange = null;
  }

  const currentItems = allItems.filter(item => 
    isWithinInterval(new Date(item.timestamp), currentRange)
  );

  const previousItems = previousRange 
    ? allItems.filter(item => isWithinInterval(new Date(item.timestamp), previousRange))
    : [];

  // 1. Screenshots Saved
  const savedCount = currentItems.length;
  const prevSavedCount = previousItems.length;
  const savedDelta = previousRange ? savedCount - prevSavedCount : 0;

  // 2. Actions Taken
  const actionsCount = currentItems.filter(i => i.status === 'completed').length;
  const prevActionsCount = previousItems.filter(i => i.status === 'completed').length;
  const actionsDelta = previousRange ? actionsCount - prevActionsCount : 0;
  
  // Completion Rate
  const completionRate = savedCount > 0 ? (actionsCount / savedCount) * 100 : 0;

  // 3. Queue Cleared Days (Simplified: Days in period with 0 pending items at end of day)
  // Realistically, we just count days in current period where items were completed.
  const uniqueActionDays = new Set(
    currentItems
      .filter(i => i.status === 'completed')
      .map(i => format(new Date(i.timestamp), 'yyyy-MM-dd'))
  ).size;

  // 4. Category Breakdown
  // Format: { category: { saved: 10, acted: 5 } }
  const categoryStats = {};
  currentItems.forEach(item => {
    const cat = item.contentType || 'Idea';
    if (!categoryStats[cat]) categoryStats[cat] = { saved: 0, acted: 0 };
    categoryStats[cat].saved++;
    if (item.status === 'completed') categoryStats[cat].acted++;
  });

  // Top Interests (AI Narrative)
  // Sort categories by volume
  const topInterests = Object.entries(categoryStats)
    .sort((a, b) => b[1].saved - a[1].saved)
    .slice(0, 3)
    .map(([name]) => name);

  // 5. Streak Logic (Last 7 Days)
  const last7Days = eachDayOfInterval({
    start: subDays(now, 6),
    end: now
  });

  const streakGrid = last7Days.map(day => {
    const hasAction = allItems.some(item => 
      item.status === 'completed' && isSameDay(new Date(item.timestamp), day)
    );
    return {
      day: format(day, 'E'), // Mon, Tue...
      active: hasAction,
      date: day
    };
  });

  // Calculate current streak count
  let currentStreak = 0;
  for (let i = 6; i >= 0; i--) {
    if (streakGrid[i].active) {
      currentStreak++;
    } else {
      // If today is not active yet, we don't break streak unless yesterday was also not active
      if (i === 6) continue; 
      break;
    }
  }

  // Backlog / Debt
  const pendingCount = allItems.filter(i => i.status === 'queued').length;

  return {
    saved: { count: savedCount, delta: savedDelta },
    actions: { count: actionsCount, delta: actionsDelta, rate: completionRate },
    clearedDays: uniqueActionDays,
    categoryStats,
    topInterests,
    streak: {
      grid: streakGrid,
      count: currentStreak,
      best: 12, // Mocked for now, need historical storage for real best
    },
    backlog: pendingCount
  };
}
