/**
 * HomeQueueScreen — The LaterLens Action Feed
 *
 * Features:
 * - Branded header with item count badge
 * - Time-of-day greeting with pending action count
 * - Premium ActionCard feed with 16px spacing
 * - Gorgeous empty state
 * - Permission-gated via PermissionsScreen
 * - Full Light / Dark theme support
 */

import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import * as MediaLibrary from 'expo-media-library';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
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
import { Settings, Sparkles, RefreshCw, Inbox } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  analyzeScreenshotContext,
  extractTextFromImage,
} from '../../services/aiProcessingEngine';
import ActionCard from '../../components/ActionCard';
import PermissionsScreen from './PermissionsScreen';
import { HOME_ROUTES } from '../../navigation/routeNames';
import { useQueue } from '../../state/QueueContext';
import { useTheme } from '../../theme/useTheme';
import { TYPOGRAPHY, SPACING, RADIUS } from '../../theme/colors';

// ─── Helpers ─────────────────────────────────────────────────

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

// ─── Animated Spinner for Processing ─────────────────────────

function ProcessingOverlay({ visible, palette }) {
  const spin = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      Animated.loop(
        Animated.timing(spin, {
          toValue: 1,
          duration: 1200,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  }, [visible, opacity, spin]);

  const rotation = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  if (!visible) return null;

  return (
    <Animated.View style={[styles.processingOverlay, { backgroundColor: palette.overlayBg, opacity }]}>
      <Animated.View style={{ transform: [{ rotate: rotation }] }}>
        <RefreshCw size={28} color={palette.primary} strokeWidth={2.2} />
      </Animated.View>
      <Text style={[TYPOGRAPHY.caption, { color: palette.textSecondary, marginTop: SPACING.sm }]}>
        Analyzing screenshot…
      </Text>
    </Animated.View>
  );
}

// ─── Beautiful Empty State ───────────────────────────────────

function EmptyState({ palette, isDark }) {
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: -8, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, [float]);

  return (
    <View style={[styles.emptyContainer, { backgroundColor: palette.emptyBg, borderColor: palette.border }]}>
      <Animated.View style={[styles.emptyIconWrap, { transform: [{ translateY: float }] }]}>
        <View
          style={[
            styles.emptyIconBg,
            {
              backgroundColor: isDark
                ? 'rgba(129,140,248,0.12)'
                : 'rgba(99,102,241,0.08)',
            },
          ]}
        >
          <Inbox size={32} color={palette.primary} strokeWidth={1.6} />
        </View>
      </Animated.View>

      <Text style={[TYPOGRAPHY.subtitle, { color: palette.textPrimary, marginTop: SPACING.md }]}>
        All caught up!
      </Text>
      <Text
        style={[
          TYPOGRAPHY.body,
          { color: palette.textSecondary, textAlign: 'center', marginTop: SPACING.xs, maxWidth: 280 },
        ]}
      >
        Tap "Process Latest" to analyze your newest screenshot and build your action queue.
      </Text>
    </View>
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
  const [message, setMessage] = useState('');
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

  useEffect(() => {
    setIsLoading(true);
    hydrateQueue()
      .catch((err) => {
        console.log('[App] Failed during hydration:', err);
        setMessage('Could not load your action queue.');
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
    setMessage('');

    try {
      const currentPermission = await MediaLibrary.getPermissionsAsync();
      let finalPermission = currentPermission;

      if (!currentPermission.granted) {
        finalPermission = await MediaLibrary.requestPermissionsAsync();
      }

      if (!finalPermission.granted) {
        setHasPermission(false);
        setMessage('We need photo access to analyze your screenshots.');
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
      const uri = await fetchLatestScreenshotUri();

      if (!uri) {
        setMessage('No screenshots found yet in your library.');
        return;
      }

      const isDuplicate = allItems.some((item) => item.imageUri === uri);
      if (isDuplicate) {
        console.log('[Media] Screenshot already processed:', uri);
        setMessage('Latest screenshot is already processed.');
        return;
      }

      await processScreenshotWithAI(uri);
    } catch (error) {
      console.log('[Media] Failed to initialize media flow:', error);
      setHasPermission(false);
      setMessage('Could not load screenshots. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const processScreenshotWithAI = async (imageUri) => {
    try {
      setMessage('Running on-device OCR...');
      const extractedText = await extractTextFromImage(imageUri);
      console.log('[AI Flow] OCR text preview:', extractedText.slice(0, 160));

      setMessage('Analyzing context with Gemini...');
      const metadata = await analyzeScreenshotContext(extractedText);

      const queueItem = {
        id: `${Date.now()}`,
        imageUri,
        timestamp: Date.now(),
        contentType: metadata.contentType,
        intent: metadata.intent,
        tags: metadata.tags,
        suggestedAction: metadata.suggestedAction,
        summary: metadata.summary,
        extractedUrl: metadata.extractedUrl || null,
        status: 'queued',
      };

      await addQueueItem(queueItem);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMessage('');

      console.log('[AI Flow] Final structured JSON metadata:', queueItem);
    } catch (error) {
      console.log('[AI Flow] Processing failed:', error);
      setMessage('Could not analyze screenshot context.');
    }
  };

  // ─── Action handlers ──

  const handleComplete = async (item) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await completeQueueItem(item.id);
  };

  const handleArchive = async (item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await archiveQueueItem(item.id);
  };

  const handleSnooze = async (item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await snoozeQueueItem(item.id, 60);
  };

  const handlePrimaryAction = (item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    console.log('[ActionQueue] Suggested action pressed:', item.suggestedAction, item.id);
  };

  // ─── Media helpers ──

  const fetchLatestScreenshotUri = async () => {
    try {
      const screenshotAlbum = await findScreenshotAlbum();

      if (!screenshotAlbum) {
        console.log('[Media] Screenshot album not found.');
        return null;
      }

      const assetsPage = await MediaLibrary.getAssetsAsync({
        first: 50,
        album: screenshotAlbum,
        mediaType: [MediaLibrary.MediaType.photo],
      });

      if (!assetsPage.assets.length) {
        console.log('[Media] Screenshot album found but it is empty:', screenshotAlbum.title);
        return null;
      }

      const latestAsset = [...assetsPage.assets].sort(
        (a, b) => (b.creationTime || 0) - (a.creationTime || 0)
      )[0];

      const assetInfo = await MediaLibrary.getAssetInfoAsync(latestAsset);
      const resolvedUri = assetInfo.localUri || assetInfo.uri || latestAsset.uri;

      console.log('[Media] Screenshot album:', screenshotAlbum.title);
      console.log('[Media] Latest screenshot URI:', resolvedUri);

      return resolvedUri;
    } catch (error) {
      console.log('[Media] Error fetching latest screenshot:', error);
      return null;
    }
  };

  const findScreenshotAlbum = async () => {
    const screenshotNameCandidates = ['screenshots', 'screenshot'];

    const findInAlbums = (albums) =>
      albums.find((album) => {
        const title = (album.title || '').toLowerCase();
        return screenshotNameCandidates.some((candidate) => title.includes(candidate));
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
    <View style={[styles.screen, { backgroundColor: palette.background, paddingTop: insets.top + SPACING.sm }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.brandRow}>
            <Sparkles size={20} color={palette.primary} strokeWidth={2.2} />
            <Text style={[TYPOGRAPHY.title, { color: palette.textPrimary, marginLeft: 6 }]}>
              LaterLens
            </Text>
          </View>
          <Text style={[TYPOGRAPHY.body, { color: palette.textSecondary, marginTop: 2 }]}>
            {getGreeting()}. You have{' '}
            <Text style={{ fontWeight: '700', color: palette.primary }}>
              {pendingCount} pending action{pendingCount !== 1 ? 's' : ''}
            </Text>
            .
          </Text>
        </View>

        <View style={styles.headerRight}>
          {/* Item count badge */}
          {pendingCount > 0 && (
            <View style={[styles.countBadge, { backgroundColor: palette.primary }]}>
              <Text style={styles.countBadgeText}>{pendingCount}</Text>
            </View>
          )}

          {/* Process Latest button */}
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
            <RefreshCw
              size={16}
              color={palette.primary}
              strokeWidth={2.4}
            />
            <Text
              style={[
                TYPOGRAPHY.buttonLabel,
                { color: palette.primary, fontSize: 13 },
              ]}
            >
              {isProcessing ? 'Processing…' : 'Process Latest'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* ── Status message ── */}
      {!!message && (
        <View style={[styles.messageBanner, { backgroundColor: palette.emptyBg, borderColor: palette.border }]}>
          <Text style={[TYPOGRAPHY.caption, { color: palette.textSecondary }]}>
            {message}
          </Text>
        </View>
      )}

      {/* ── Feed ── */}
      <FlatList
        data={queueItems}
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
        ListEmptyComponent={<EmptyState palette={palette} isDark={isDark} />}
      />

      {/* ── Processing overlay ── */}
      <ProcessingOverlay visible={isProcessing} palette={palette} />

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
    paddingBottom: SPACING.md,
  },
  headerLeft: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: SPACING.sm,
  },
  countBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  countBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  processButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.pill,
  },

  /* ── Status ── */
  messageBanner: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
  },

  /* ── Feed ── */
  listContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xxl,
    paddingTop: SPACING.xs,
  },

  /* ── Empty ── */
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
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── Processing overlay ── */
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
});
