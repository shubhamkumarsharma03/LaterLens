/**
 * HomeQueueScreen — Today's Queue (Main Screen · Tab 1)
 *
 * The daily driver. Shows the AI-curated list of screenshots that need
 * attention today. Prioritised by urgency, age, and predicted intent.
 * Zero manual sorting required from the user.
 *
 * Design spec features:
 *   - Date + personalised greeting with queue count badge
 *   - Avatar / profile button (initials circle)
 *   - Non-blocking processing banner with progress animation
 *   - Older items fold ("3 more from this week")
 *   - Empty state with streak counter & positive reinforcement
 *   - Undo toast (4-second auto-dismiss)
 *   - Full Light / Dark theme support
 */

import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import * as MediaLibrary from 'expo-media-library';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Sparkles,
  RefreshCw,
  Inbox,
  ChevronDown,
  ChevronUp,
  Undo2,
  Flame,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  analyzeScreenshotContext,
  extractTextFromImage,
} from '../../services/aiProcessingEngine';
import ActionCard from '../../components/ActionCard';
import PermissionsScreen from './PermissionsScreen';
import EmptyState from '../../components/shared/EmptyState';
import { HOME_ROUTES } from '../../navigation/routeNames';
import { useQueue } from '../../state/QueueContext';
import { useAuth } from '../../state/AuthContext';
import { useTheme } from '../../theme/useTheme';
import { TYPOGRAPHY, SPACING, RADIUS } from '../../theme/colors';
import { User as UserIcon } from 'lucide-react-native';

// ─── Helpers ─────────────────────────────────────────────────

function getGreeting(name) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  return name ? `${greeting}, ${name}` : `${greeting}!`;
}

function getFormattedDate() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function getUserInitials(name = 'User') {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const URGENT_THRESHOLD = 3; // Show only top N items; rest fold

// ─── Processing Banner (non-blocking, auto-dismiss) ──────────

function ProcessingBanner({ visible, message, palette }) {
  const slideAnim = useRef(new Animated.Value(-60)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        speed: 14,
        bounciness: 4,
      }).start();
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -60,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim, spinAnim]);

  const rotation = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.processingBanner,
        {
          backgroundColor: palette.processingBg,
          borderColor: palette.processingBorder,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <Animated.View style={{ transform: [{ rotate: rotation }] }}>
        <RefreshCw size={14} color={palette.processingText} strokeWidth={2.4} />
      </Animated.View>
      <Text style={[TYPOGRAPHY.caption, { color: palette.processingText, marginLeft: 8, flex: 1 }]}>
        {message || 'Processing 1 new screenshot…'}
      </Text>
    </Animated.View>
  );
}

// ─── Undo Toast (4-second auto-dismiss) ──────────────────────

function UndoToast({ visible, message, onUndo, onDismiss, palette }) {
  const slideAnim = useRef(new Animated.Value(80)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        speed: 12,
        bounciness: 6,
      }).start();

      const timer = setTimeout(() => {
        Animated.timing(slideAnim, {
          toValue: 80,
          duration: 250,
          useNativeDriver: true,
        }).start(() => onDismiss?.());
      }, 4000);

      return () => clearTimeout(timer);
    } else {
      slideAnim.setValue(80);
    }
  }, [visible, slideAnim, onDismiss]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.undoToast,
        {
          backgroundColor: palette.toastBg,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <Text style={[TYPOGRAPHY.caption, { color: palette.toastText, flex: 1 }]}>
        {message}
      </Text>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onUndo?.();
        }}
        hitSlop={12}
      >
        <View style={styles.undoButton}>
          <Undo2 size={14} color={palette.toastAction} strokeWidth={2.4} />
          <Text style={[TYPOGRAPHY.buttonLabel, { color: palette.toastAction, fontSize: 13, marginLeft: 4 }]}>
            Undo
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Beautiful Empty State with Streak ───────────────────────

// Removed inline EmptyState in favor of shared component

// ─── Older Items Fold ────────────────────────────────────────

function OlderItemsFold({ count, expanded, onToggle, palette }) {
  if (count <= 0) return null;

  return (
    <Pressable
      onPress={onToggle}
      style={[styles.foldButton, { backgroundColor: palette.foldBg }]}
    >
      <Text style={[TYPOGRAPHY.caption, { color: palette.foldText }]}>
        {expanded ? 'Hide older items' : `${count} more from this week`}
      </Text>
      {expanded ? (
        <ChevronUp size={16} color={palette.foldText} strokeWidth={2} />
      ) : (
        <ChevronDown size={16} color={palette.foldText} strokeWidth={2} />
      )}
    </Pressable>
  );
}

// ─── Main Screen Component ───────────────────────────────────

export default function HomeQueueScreen() {
  const navigation = useNavigation();
  const { palette, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [showOlderItems, setShowOlderItems] = useState(false);
  const [streakDays, setStreakDays] = useState(0);

  // Undo state
  const [undoToast, setUndoToast] = useState({ visible: false, message: '', undoAction: null });
  const lastAction = useRef(null);

  const {
    allItems,
    queueItems,
    queueHydrated,
    hydrateQueue,
    addQueueItem,
    completeQueueItem,
    archiveQueueItem,
    snoozeQueueItem,
    reviveDueSnoozed,
  } = useQueue();

  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    setIsLoading(true);
    hydrateQueue()
      .catch((err) => {
        console.log('[App] Failed during hydration:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [hydrateQueue]);

  useEffect(() => {
    if (queueHydrated) {
      reviveDueSnoozed().catch((err) => console.log('[Queue] Failed to revive:', err));
      initializeMediaFlow();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueHydrated]);

  useEffect(() => {
    const timer = setInterval(() => {
      reviveDueSnoozed().catch((error) => {
        console.log('[Queue] Failed to revive snoozed items:', error);
      });
    }, 30000);
    return () => clearInterval(timer);
  }, [reviveDueSnoozed]);

  // ─── Flow ──

  const initializeMediaFlow = async () => {
    setIsProcessing(true);
    setProcessingMessage('');

    try {
      const currentPermission = await MediaLibrary.getPermissionsAsync();
      let finalPermission = currentPermission;

      if (!currentPermission.granted) {
        finalPermission = await MediaLibrary.requestPermissionsAsync();
      }

      if (!finalPermission.granted) {
        setHasPermission(false);
        setProcessingMessage('We need photo access to analyze your screenshots.');
        return;
      }

      if (Platform.OS === 'android' && Platform.Version >= 29) {
        const { PermissionsAndroid } = require('react-native');
        try {
          await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_MEDIA_LOCATION);
        } catch (err) {
          console.log('[Media] Failed to request media location permission:', err);
        }
      }

      setHasPermission(true);
      const assets = await fetchLatestScreenshotAssets(allItems.length === 0 ? 10 : 20);

      if (!assets || assets.length === 0) {
        setProcessingMessage('No screenshots found yet.');
        return;
      }

      const newAssets = assets.filter(asset => 
        !allItems.some(item => item.assetId === asset.id || item.imageUri === asset.uri)
      );

      if (newAssets.length === 0) {
        setProcessingMessage('Everything is up to date.');
        return;
      }

      for (let i = 0; i < newAssets.length; i++) {
        const asset = newAssets[i];
        if (newAssets.length > 1) {
          setProcessingMessage(`Processing ${i + 1}/${newAssets.length} screenshots…`);
        }
        await processScreenshotWithAI(asset);
      }
    } catch (error) {
      console.log('[Media] Failed to initialize media flow:', error);
      setHasPermission(false);
      setProcessingMessage('Could not load screenshots. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const processScreenshotWithAI = async (asset) => {
    const imageUri = asset.uri;
    const assetId = asset.id;
    try {
      setProcessingMessage('Running on-device OCR…');
      const extractedText = await extractTextFromImage(imageUri);
      console.log('[AI Flow] OCR text preview:', extractedText.slice(0, 160));

      setProcessingMessage('Analyzing context with Gemini…');
      const metadata = await analyzeScreenshotContext(extractedText);

      const queueItem = {
        id: `${Date.now()}-${assetId}`,
        assetId,
        imageUri,
        timestamp: asset.creationTime || Date.now(),
        contentType: metadata.contentType,
        intent: metadata.intent,
        tags: metadata.tags,
        suggestedAction: metadata.suggestedAction,
        summary: metadata.summary,
        extractedUrl: metadata.extractedUrl || null,
        urgency: metadata.urgency || null,
        urgencyLabel: metadata.urgencyLabel || null,
        status: 'queued',
      };

      await addQueueItem(queueItem);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setProcessingMessage('');

      console.log('[AI Flow] Final structured JSON metadata:', queueItem);
    } catch (error) {
      console.log('[AI Flow] Processing failed:', error);
      setProcessingMessage('Could not analyze screenshot context.');
    }
  };

  // ─── Action handlers with Undo support ──

  const handleComplete = useCallback(
    async (item) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      lastAction.current = { type: 'complete', item };
      await completeQueueItem(item.id);
      setUndoToast({
        visible: true,
        message: 'Marked as done · Undo',
        undoAction: () => {
          // Re-queue the item (simplified undo)
          addQueueItem({ ...item, status: 'queued' });
        },
      });
    },
    [completeQueueItem, addQueueItem]
  );

  const handleArchive = useCallback(
    async (item) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      lastAction.current = { type: 'archive', item };
      await archiveQueueItem(item.id);
      setUndoToast({
        visible: true,
        message: 'Archived · Undo',
        undoAction: () => {
          addQueueItem({ ...item, status: 'queued' });
        },
      });
    },
    [archiveQueueItem, addQueueItem]
  );

  const handleSnooze = useCallback(
    async (item) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      lastAction.current = { type: 'snooze', item };
      await snoozeQueueItem(item.id, 60 * 24); // Tomorrow (24h)
      setUndoToast({
        visible: true,
        message: 'Snoozed for tomorrow · Undo',
        undoAction: () => {
          addQueueItem({ ...item, status: 'queued', snoozeUntil: null });
        },
      });
    },
    [snoozeQueueItem, addQueueItem]
  );

  const handlePrimaryAction = (item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    console.log('[ActionQueue] Suggested action pressed:', item.suggestedAction, item.id);
  };

  const handleUndoAction = useCallback(() => {
    undoToast.undoAction?.();
    setUndoToast({ visible: false, message: '', undoAction: null });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [undoToast]);

  // ─── Media helpers ──

  const fetchLatestScreenshotAssets = async (limit = 1) => {
    try {
      const screenshotAlbum = await findScreenshotAlbum();

      if (!screenshotAlbum) {
        console.log('[Media] Screenshot album not found.');
        return [];
      }

      const assetsPage = await MediaLibrary.getAssetsAsync({
        first: limit + 10, // Fetch a bit more to handle potential filters
        album: screenshotAlbum,
        mediaType: [MediaLibrary.MediaType.photo],
        sortBy: [[MediaLibrary.SortBy.creationTime, false]], // Sort newest first directly
      });

      if (!assetsPage.assets.length) {
        console.log('[Media] Screenshot album found but it is empty:', screenshotAlbum.title);
        return [];
      }

      const latestAssets = assetsPage.assets.slice(0, limit);

      const resolvedAssets = [];
      for (const asset of latestAssets) {
        const assetInfo = await MediaLibrary.getAssetInfoAsync(asset);
        resolvedAssets.push({
          id: asset.id,
          uri: assetInfo.localUri || assetInfo.uri || asset.uri,
          creationTime: asset.creationTime,
        });
      }

      return resolvedAssets;
    } catch (error) {
      console.log('[Media] Error fetching screenshot assets:', error);
      return [];
    }
  };

  const findScreenshotAlbum = async () => {
    const screenshotNameCandidates = ['screenshots', 'screenshot', 'captures', 'images'];

    const findInAlbums = (albums) =>
      albums.find((album) => {
        const title = (album.title || '').toLowerCase();
        return screenshotNameCandidates.some((candidate) => title === candidate || title.includes(candidate));
      });

    let albums = [];

    try {
      albums = await MediaLibrary.getAlbumsAsync();
    } catch (error) {
      console.log('[Media] Failed to read albums:', error);
      albums = [];
    }

    let screenshotAlbum = findInAlbums(albums);

    if (!screenshotAlbum && Platform.OS === 'ios') {
      try {
        const smartAlbums = await MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true });
        screenshotAlbum = findInAlbums(smartAlbums);
      } catch (error) {
        console.log('[Media] Smart album lookup not available:', error);
      }
    }

    console.log(
      '[Media] Albums scanned:',
      albums.map((album) => album.title).slice(0, 20)
    );

    return screenshotAlbum || null;
  };

  // ─── Split items: urgent vs older ──

  const urgentItems = queueItems.slice(0, URGENT_THRESHOLD);
  const olderItems = queueItems.slice(URGENT_THRESHOLD);
  const displayedItems = showOlderItems ? queueItems : urgentItems;

  // ─── Loading State ──

  if (isLoading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: palette.background }]}>
        <ActivityIndicator size="large" color={palette.primary} />
        <Text style={[TYPOGRAPHY.caption, { color: palette.textSecondary, marginTop: SPACING.md }]}>
          Loading your Action Queue…
        </Text>
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </View>
    );
  }

  // ─── Permission Gate ──

  if (!hasPermission) {
    return (
      <>
        <PermissionsScreen onAllow={initializeMediaFlow} />
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </>
    );
  }

  // ─── Main Feed ──

  const pendingCount = queueItems.length;

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: palette.background, paddingTop: insets.top + SPACING.sm },
      ]}
    >
      {/* ── Header: Date + Greeting + Avatar ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[TYPOGRAPHY.caption, { color: palette.textSecondary }]}>
            {getFormattedDate()}
          </Text>
          <Text style={[TYPOGRAPHY.title, { color: palette.textPrimary, marginTop: 2 }]}>
            {getGreeting(isAuthenticated ? user?.name : null)}
          </Text>
          <Text style={[TYPOGRAPHY.body, { color: palette.textSecondary, marginTop: 4 }]}>
            Today's queue ·{' '}
            <Text style={{ fontWeight: '700', color: palette.primary }}>
              {pendingCount} item{pendingCount !== 1 ? 's' : ''}
            </Text>
          </Text>
        </View>

        {/* Avatar / Profile Button */}
        <Pressable
          style={[styles.avatar, { backgroundColor: palette.avatarBg }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.navigate(HOME_ROUTES.PROFILE);
          }}
          accessibilityLabel="Open profile"
        >
          {isAuthenticated ? (
            <Text style={[styles.avatarText, { color: palette.avatarText }]}>
              {getUserInitials(user?.name)}
            </Text>
          ) : (
            <UserIcon size={20} color={palette.avatarText} />
          )}
        </Pressable>
      </View>

      {/* ── Processing Banner (non-blocking) ── */}
      <ProcessingBanner
        visible={isProcessing}
        message={processingMessage}
        palette={palette}
      />

      {/* ── Process Latest trigger ── */}
      <View style={styles.processRow}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            initializeMediaFlow();
          }}
          disabled={isProcessing}
          style={({ pressed }) => [
            styles.processButton,
            {
              backgroundColor: isDark
                ? 'rgba(129,140,248,0.14)'
                : 'rgba(99,102,241,0.08)',
              opacity: pressed ? 0.7 : isProcessing ? 0.5 : 1,
            },
          ]}
        >
          <Sparkles size={16} color={palette.primary} strokeWidth={2.2} />
          <Text
            style={[
              TYPOGRAPHY.buttonLabel,
              { color: palette.primary, fontSize: 13, marginLeft: 6 },
            ]}
          >
            {isProcessing ? 'Processing…' : 'Process Latest'}
          </Text>
        </Pressable>
      </View>

      {/* ── Feed ── */}
      <FlatList
        data={displayedItems}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ActionCard
            item={item}
            onPrimaryPress={handlePrimaryAction}
            onComplete={handleComplete}
            onSnooze={handleSnooze}
            onArchive={handleArchive}
            onCardPress={() =>
              navigation.navigate(HOME_ROUTES.DETAIL, {
                itemId: item.id,
              })
            }
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState 
            title="All quiet here" 
            subtitle="Take a screenshot or tap 'Process Latest' to sync your recent activity."
            onAction={initializeMediaFlow}
            actionLabel="Sync Recent"
          />
        }
        ListFooterComponent={
          olderItems.length > 0 ? (
            <OlderItemsFold
              count={olderItems.length}
              expanded={showOlderItems}
              onToggle={() => {
                Haptics.selectionAsync();
                setShowOlderItems((prev) => !prev);
              }}
              palette={palette}
            />
          ) : null
        }
      />

      {/* ── Undo Toast ── */}
      <UndoToast
        visible={undoToast.visible}
        message={undoToast.message}
        onUndo={handleUndoAction}
        onDismiss={() => setUndoToast({ visible: false, message: '', undoAction: null })}
        palette={palette}
      />

      <StatusBar style={isDark ? 'light' : 'dark'} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },

  screen: {
    flex: 1,
  },

  /* ── Header ── */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  headerLeft: {
    flex: 1,
    marginRight: SPACING.sm,
  },

  /* ── Avatar ── */
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  /* ── Processing banner ── */
  processingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },

  /* ── Process button row ── */
  processRow: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  processButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.pill,
  },

  /* ── Feed ── */
  listContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xxl + SPACING.xl,
    paddingTop: SPACING.xs,
  },

  /* ── Older items fold ── */
  foldButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    marginTop: SPACING.xs,
    gap: 6,
  },

  /* ── Empty state ── */
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg,
    marginTop: SPACING.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  emptyIconWrap: {
    marginBottom: SPACING.xs,
  },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.md,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: RADIUS.pill,
  },

  /* ── Undo toast ── */
  undoToast: {
    position: 'absolute',
    bottom: 24,
    left: SPACING.md,
    right: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  undoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: SPACING.md,
  },
});
