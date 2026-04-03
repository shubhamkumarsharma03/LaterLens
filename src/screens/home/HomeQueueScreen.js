/**
 * HomeQueueScreen — Today's Queue (Main Screen · Tab 1)
 *
 * The daily driver. Shows the AI-curated list of screenshots that need
 * attention today. Prioritised by urgency, age, and predicted intent.
 * Zero manual sorting required from the user.
 *
 * Design spec features:
 *   - Date + personalised greeting
 *   - Avatar / profile button (initials circle)
 *   - Non-blocking processing banner with progress animation
 *   - Older items fold ("3 more from this week")
 *   - Empty state with streak counter & positive reinforcement
 *   - Undo toast (4-second auto-dismiss)
 *   - Full Light / Dark theme support
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  Alert,
  Pressable,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import * as MediaLibrary from 'expo-media-library';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  Sparkles, 
  ChevronRight, 
  ChevronDown, 
  CheckCircle2, 
  RotateCcw,
  Zap,
  Flame
} from 'lucide-react-native';

import { useTheme } from '../../theme/useTheme';
import { useQueue } from '../../state/QueueContext';
import { useAuth } from '../../state/AuthContext';
import { TYPOGRAPHY, SPACING, RADIUS } from '../../theme/colors';
import { getRecentScreenshotAssets } from '../../services/backgroundTasks';
import { extractTextFromImage, analyzeScreenshotContext } from '../../services/aiProcessingEngine';
import ActionCard from '../../components/ActionCard';
import { HOME_ROUTES } from '../../navigation/routeNames';

const { width } = Dimensions.get('window');

// Date Grouping Helper
const groupItems = (items) => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfWeek = startOfToday - 7 * 24 * 60 * 60 * 1000;

  const grouped = {
    today: [],
    thisWeek: [],
    older: [],
  };

  items.forEach(item => {
    const timestamp = item.timestamp || Date.now();
    if (timestamp >= startOfToday) {
      grouped.today.push(item);
    } else if (timestamp >= startOfWeek) {
      grouped.thisWeek.push(item);
    } else {
      grouped.older.push(item);
    }
  });

  return grouped;
};

// Streak Calculation Helper
const calculateStreak = (allItems) => {
  const archived = allItems.filter(i => i.status === 'archived' || i.status === 'completed');
  if (archived.length === 0) return 0;

  // Get unique days (YYYY-MM-DD)
  const days = [...new Set(archived.map(i => new Date(i.timestamp).toISOString().split('T')[0]))].sort().reverse();
  
  let streak = 0;
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  // Start with today or yesterday
  let checkDate = days[0] === today ? today : yesterday;
  if (days[0] !== today && days[0] !== yesterday) return 0;

  for (let i = 0; i < days.length; i++) {
    const d = new Date(checkDate);
    const dateStr = d.toISOString().split('T')[0];
    
    if (days.includes(dateStr)) {
      streak++;
      d.setDate(d.getDate() - 1);
      checkDate = d.toISOString().split('T')[0];
    } else {
      break;
    }
  }
  return streak;
};

export default function HomeQueueScreen() {
  const { palette, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user, isAuthenticated } = useAuth();
  const { allItems, queueItems, hydrateQueue, addQueueItem, archiveQueueItem } = useQueue();

  // Local State
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [isOlderFolded, setIsOlderFolded] = useState(true);
  
  // Undo Toast State
  const [lastAction, setLastAction] = useState(null); // { itemId: string, originalItem: object }
  const [showUndo, setShowUndo] = useState(false);
  const undoTimeout = useRef(null);

  // Animation Values
  const bannerAnim = useRef(new Animated.Value(-100)).current; // Start off-screen top
  const toastAnim = useRef(new Animated.Value(100)).current;  // Start off-screen bottom

  useEffect(() => {
    hydrateQueue();
  }, [hydrateQueue]);

  // Handle Banner Animation
  useEffect(() => {
    Animated.spring(bannerAnim, {
      toValue: isAnalysing ? 0 : -120,
      useNativeDriver: true,
      tension: 40,
      friction: 8,
    }).start();
  }, [isAnalysing]);

  // Handle Toast Animation
  useEffect(() => {
    Animated.spring(toastAnim, {
      toValue: showUndo ? 0 : 100,
      useNativeDriver: true,
    }).start();

    if (showUndo) {
      if (undoTimeout.current) clearTimeout(undoTimeout.current);
      undoTimeout.current = setTimeout(() => {
        setShowUndo(false);
      }, 4000);
    }
  }, [showUndo]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      const assets = await getRecentScreenshotAssets(15);
      const currentItems = allItems || [];
      const newAssets = assets.filter(
        asset => !currentItems.some(item => item.assetId === asset.id || item.imageUri === asset.uri)
      );

      if (newAssets.length > 0) {
        setIsAnalysing(true);
        setProgress({ current: 0, total: newAssets.length });
        
        for (let i = 0; i < newAssets.length; i++) {
          const asset = newAssets[i];
          setProgress(prev => ({ ...prev, current: i + 1 }));
          
          const text = await extractTextFromImage(asset.uri);
          const metadata = await analyzeScreenshotContext(text);
          
          const newItem = {
            id: `${Date.now()}-${asset.id}-${i}`,
            assetId: asset.id,
            imageUri: asset.uri,
            timestamp: asset.creationTime || Date.now(),
            ...metadata,
            status: 'queued',
          };

          await addQueueItem(newItem);
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.log('[HomeQueue] Refresh failed:', error);
    } finally {
      setIsRefreshing(false);
      setIsAnalysing(false);
    }
  };

  const handleArchive = async (item) => {
    setLastAction({ itemId: item.id, item });
    await archiveQueueItem(item.id);
    setShowUndo(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleUndo = async () => {
    if (lastAction) {
      await addQueueItem(lastAction.item);
      setShowUndo(false);
      setLastAction(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const grouped = useMemo(() => groupItems(queueItems || []), [queueItems]);
  const streak = useMemo(() => calculateStreak(allItems || []), [allItems]);

  const renderHeader = () => {
    const greeting = new Date().getHours() < 12 ? 'Good Morning' : 'Hello';
    const initials = user?.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase() : (isAuthenticated ? 'U' : 'G');

    return (
      <View style={[styles.header, { paddingTop: insets.top + SPACING.md }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.dateText, { color: palette.textSecondary }]}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </Text>
            <Text style={[styles.greeting, { color: palette.textPrimary }]}>
              {greeting}, {user?.name ? user.name.split(' ')[0] : (isAuthenticated ? 'User' : 'Guest')}
            </Text>
          </View>
          <Pressable 
            onPress={() => navigation.navigate(HOME_ROUTES.PROFILE)}
            style={styles.avatarContainer}
          >
            <View style={[styles.avatar, { backgroundColor: palette.primaryLight }]}>
              <Text style={[styles.avatarText, { color: palette.primary }]}>{initials}</Text>
            </View>
          </Pressable>
        </View>
      </View>
    );
  };

  const renderSectionHeader = (title) => (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: palette.textSecondary }]}>{title.toUpperCase()}</Text>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={[styles.streakBox, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Flame color={streak > 0 ? palette.urgencyRed : palette.textSecondary} size={32} />
        <Text style={[styles.streakValue, { color: palette.textPrimary }]}>{streak}</Text>
        <Text style={[styles.streakLabel, { color: palette.textSecondary }]}>Day Streak</Text>
      </View>
      <Text style={[styles.emptyTitle, { color: palette.textPrimary }]}>
        {streak > 3 ? "You're on fire!" : "Queue is Clear"}
      </Text>
      <Text style={[styles.emptySubtitle, { color: palette.textSecondary }]}>
        Zero items pending. Capture something new to get started.
      </Text>
      <Pressable 
        style={[styles.fetchFab, { backgroundColor: palette.primary }]}
        onPress={handleRefresh}
      >
        <Sparkles size={20} color="#FFF" />
        <Text style={styles.fetchFabText}>Fetch Latest</Text>
      </Pressable>
    </View>
  );

  const flatListData = [
    ...(grouped.today.length > 0 ? [{ type: 'header', title: 'Today' }, ...grouped.today] : []),
    ...(grouped.thisWeek.length > 0 ? [{ type: 'header', title: 'This Week' }, ...grouped.thisWeek] : []),
    ...(grouped.older.length > 0 ? [{ type: 'fold', title: 'Older Items', count: grouped.older.length }] : []),
    ...(!isOlderFolded ? grouped.older : []),
  ];

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {renderHeader()}

      {/* Processing Banner */}
      <Animated.View style={[styles.banner, { backgroundColor: palette.primary, transform: [{ translateY: bannerAnim }] }]}>
        <View style={styles.bannerRow}>
          <ActivityIndicator color="#FFF" size="small" />
          <Text style={styles.bannerText}>
            Analyzing {progress.current} of {progress.total} screenshots...
          </Text>
        </View>
        <View style={styles.progressBarBg}>
          <Animated.View style={[styles.progressBarFilled, { width: `${(progress.current / progress.total) * 100}%` }]} />
        </View>
      </Animated.View>

      <FlatList
        data={flatListData}
        keyExtractor={(item, index) => item.id || `section-${index}`}
        renderItem={({ item }) => {
          if (item.type === 'header') return renderSectionHeader(item.title);
          if (item.type === 'fold') {
            return (
              <Pressable 
                style={[styles.foldContainer, { backgroundColor: palette.card, borderColor: palette.border }]}
                onPress={() => setIsOlderFolded(!isOlderFolded)}
              >
                <Text style={[styles.foldText, { color: palette.textSecondary }]}>
                  {item.count} more from earlier
                </Text>
                {isOlderFolded ? <ChevronRight size={18} color={palette.textSecondary} /> : <ChevronDown size={18} color={palette.textSecondary} />}
              </Pressable>
            );
          }
          return (
             <ActionCard 
               item={item} 
               onCardPress={() => navigation.navigate(HOME_ROUTES.DETAIL, { itemId: item.id })}
               onPrimaryPress={() => navigation.navigate(HOME_ROUTES.DETAIL, { itemId: item.id })}
               onArchive={() => handleArchive(item)}
               onSnooze={() => {}}
               onComplete={() => {}}
             />
          );
        }}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 120 }]}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={palette.primary} />
        }
        ListEmptyComponent={!isRefreshing && renderEmptyState}
      />

      {/* Undo Toast */}
      <Animated.View style={[styles.toast, { transform: [{ translateY: toastAnim }] }]}>
        <View style={[styles.toastInner, { backgroundColor: palette.textPrimary }]}>
          <Text style={[styles.toastText, { color: palette.background }]}>Item Archived</Text>
          <Pressable style={styles.undoBtn} onPress={handleUndo}>
            <RotateCcw size={16} color={palette.primary} />
            <Text style={[styles.undoText, { color: palette.primary }]}>UNDO</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateText: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  greeting: { fontSize: 24, fontWeight: '800', marginTop: 2 },
  avatarContainer: { position: 'relative' },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '800' },
  
  // Banner
  banner: { position: 'absolute', top: 0, left: 0, right: 0, paddingVertical: 12, paddingHorizontal: 20, zIndex: 100 },
  bannerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bannerText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  progressBarBg: { height: 4, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, marginTop: 10, overflow: 'hidden' },
  progressBarFilled: { height: '100%', backgroundColor: '#FFF' },

  // List
  listContent: { paddingHorizontal: SPACING.md },
  sectionHeader: { marginTop: SPACING.xl, marginBottom: SPACING.sm, paddingHorizontal: 4 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  foldContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: RADIUS.lg, borderWidth: 1, marginTop: SPACING.md },
  foldText: { fontSize: 14, fontWeight: '600' },

  // Empty State
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingHorizontal: 40 },
  streakBox: { padding: 20, borderRadius: RADIUS.xl, borderWidth: 1, alignItems: 'center', marginBottom: 24 },
  streakValue: { fontSize: 32, fontWeight: '900', marginVertical: 4 },
  streakLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  emptyTitle: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  emptySubtitle: { fontSize: 15, textAlign: 'center', opacity: 0.7, lineHeight: 22, marginBottom: 32 },
  fetchFab: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 28, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
  fetchFabText: { color: '#FFF', fontSize: 15, fontWeight: '800' },

  // Toast
  toast: { position: 'absolute', bottom: 40, left: 20, right: 20, zIndex: 1000 },
  toastInner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
  toastText: { fontSize: 14, fontWeight: '700' },
  undoBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  undoText: { fontSize: 13, fontWeight: '800' },
});
