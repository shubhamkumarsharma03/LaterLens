import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
  FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/useTheme';
import { SPACING, RADIUS, TYPOGRAPHY } from '../../theme/colors';
import { COLLECTION_ROUTES } from '../../navigation/routeNames';
import { useQueue } from '../../state/QueueContext';
import { getCategoryIcon, UI_ICONS } from '../../utils/categoryIcons';
import { SMART_COLLECTIONS } from '../../services/mockData';
import { Search, ChevronDown, LayoutGrid, List, Clock, Sparkles, BookOpen } from 'lucide-react-native';

/**
 * CollectionsScreen — Overhauled visual library (Light Theme)
 */
export default function CollectionsScreen() {
  const { palette } = useTheme();
  const navigation = useNavigation();
  const { collectionItems } = useQueue();
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'

  const filters = useMemo(() => {
    const cats = new Set(collectionItems.map(i => i.contentType || 'Uncategorized'));
    return ['All', ...Array.from(cats).sort()];
  }, [collectionItems]);

  const groupedCategories = useMemo(() => {
    // 1. First, apply search query if any
    let filtered = collectionItems;
    if (query.trim()) {
      const q = query.toLowerCase().trim();
      filtered = filtered.filter(item => 
        (item.summary || '').toLowerCase().includes(q) ||
        (item.contentType || '').toLowerCase().includes(q) ||
        (item.tags || []).some(t => t.toLowerCase().includes(q))
      );
    }

    // 2. Then, grouped by category
    const map = filtered.reduce((acc, item) => {
      const key = item.contentType || 'Uncategorized';
      // If active filter is on, and item category doesn't match, we skip unless filter is 'All'
      if (activeFilter !== 'All' && key !== activeFilter) return acc;

      if (!acc[key]) {
        acc[key] = { name: key, count: 0, items: [] };
      }
      acc[key].count++;
      if (acc[key].items.length < 3) {
        acc[key].items.push(item);
      }
      return acc;
    }, {});

    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [collectionItems, query, activeFilter]);

  const smartCollections = useMemo(() => {
    // Real logic to group by tags
    const groups = [
      { id: 'smart-1', name: 'Your app ideas', tags: ['idea', 'app'] },
      { id: 'smart-2', name: 'Rajasthan trip', tags: ['travel', 'rajasthan'] },
      { id: 'smart-3', name: 'React learning path', tags: ['coding', 'react'] },
    ];

    return groups.map(g => {
      const matchingItems = collectionItems.filter(item => 
        (item.tags || []).some(t => g.tags.includes(t.toLowerCase()))
      );
      return { ...g, count: matchingItems.length };
    }).filter(g => g.count > 0);
  }, [collectionItems]);

  const spacedReviewCount = useMemo(() => {
    return collectionItems.filter(item => 
      item.contentType === 'Study' && 
      (Date.now() - item.timestamp > 86400000) // Older than 24h
    ).length;
  }, [collectionItems]);

  const recentItems = useMemo(() => collectionItems.slice(0, 5), [collectionItems]);

  // Headers & Subtitles
  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.badgeRow}>
        <View style={[styles.statusBadge, { backgroundColor: palette.primaryLight }]}>
          <Text style={[styles.badgeText, { color: palette.primary }]}>browse + organise · tab 2</Text>
        </View>
      </View>
      <Text style={[styles.title, { color: palette.textPrimary }]}>Collections</Text>
      <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
        The visual library. Auto-categorised, searchable, filterable.
      </Text>
    </View>
  );

  // Search + Filter Bar
  const renderControlBar = () => (
    <View style={styles.controlBar}>
      <View style={[styles.searchContainer, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Search size={18} color={palette.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: palette.textPrimary }]}
          placeholder="Search your library..."
          placeholderTextColor={palette.textSecondary}
          value={query}
          onChangeText={setQuery}
        />
        <View style={[styles.ocrBadge, { backgroundColor: palette.background }]}>
          <Text style={styles.ocrText}>OCR-powered</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {filters.map((f) => (
          <Pressable
            key={f}
            onPress={() => setActiveFilter(f)}
            style={[
              styles.filterChip,
              activeFilter === f && { backgroundColor: palette.primary, borderColor: palette.primary },
              { borderColor: palette.border }
            ]}
          >
            <Text style={[
              styles.filterChipText,
              activeFilter === f ? { color: '#FFF' } : { color: palette.textSecondary }
            ]}>
              {f}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.sortToggleRow}>
        <Pressable style={styles.sortDropdown}>
          <Text style={[styles.sortText, { color: palette.textSecondary }]}>Sort by: Newest</Text>
          <ChevronDown size={14} color={palette.textSecondary} />
        </Pressable>
        <View style={styles.viewToggles}>
          <Pressable onPress={() => setViewMode('grid')} style={styles.toggleIcon}>
            <LayoutGrid size={20} color={viewMode === 'grid' ? palette.primary : palette.textSecondary} />
          </Pressable>
          <Pressable onPress={() => setViewMode('list')} style={styles.toggleIcon}>
            <List size={20} color={viewMode === 'list' ? palette.primary : palette.textSecondary} />
          </Pressable>
        </View>
      </View>
    </View>
  );

  // Recent Strip
  const renderRecentStrip = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Clock size={16} color={palette.textSecondary} />
        <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>Recently processed</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentScroll}>
        {recentItems.map((item, idx) => (
          <Pressable key={item.id} style={styles.recentItem}>
            <View style={[styles.recentThumb, { backgroundColor: palette.border }]}>
               {idx === 0 && (
                 <View style={[styles.justProcessedBadge, { backgroundColor: palette.primary }]}>
                   <Text style={styles.justProcessedText}>NEW</Text>
                 </View>
               )}
            </View>
            <Text style={styles.recentTime} numberOfLines={1}>Just now</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );

  // Category Cell
  const renderCategoryCard = ({ item }) => {
    const CategoryIcon = getCategoryIcon(item.name);
    return (
      <Pressable
        style={[styles.categoryCard, { backgroundColor: palette.card, borderColor: palette.border }]}
        onPress={() => navigation.navigate(COLLECTION_ROUTES.CATEGORY, { contentType: item.name })}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.iconBox, { backgroundColor: palette.primaryLight }]}>
            <CategoryIcon size={18} color={palette.primary} />
          </View>
          <View>
            <Text style={[styles.cardName, { color: palette.textPrimary }]}>{item.name}</Text>
            <Text style={[styles.cardCount, { color: palette.textSecondary }]}>{item.count} items</Text>
          </View>
        </View>
        <View style={styles.thumbStrip}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.miniThumb, { backgroundColor: palette.background, borderColor: palette.border }]} />
          ))}
        </View>
      </Pressable>
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: palette.background }]} showsVerticalScrollIndicator={false}>
      {renderHeader()}
      {renderControlBar()}
      {renderRecentStrip()}

      <View style={styles.gridSection}>
        <Text style={[styles.sectionTitleGrid, { color: palette.textSecondary }]}>Category cards grid</Text>
        <FlatList
          data={groupedCategories}
          renderItem={renderCategoryCard}
          keyExtractor={(item) => item.name}
          numColumns={2}
          scrollEnabled={false}
          columnWrapperStyle={styles.columnWrapper}
        />
      </View>

      {/* Smart Collections */}
      {smartCollections.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Sparkles size={16} color={palette.primary} />
            <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>Smart collections</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentScroll}>
            {smartCollections.map((c) => (
              <Pressable key={c.id} style={[styles.smartCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
                 <View style={styles.smartBadge}>
                    <Sparkles size={10} color="#FFF" />
                 </View>
                 <Text style={[styles.smartName, { color: palette.textPrimary }]}>{c.name}</Text>
                 <Text style={[styles.smartCount, { color: palette.textSecondary }]}>{c.count} items</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Spaced Repetition */}
      <View style={[styles.spacedRepSection, { backgroundColor: palette.primaryLight }]}>
        <View style={styles.spacedRepContent}>
          <View style={styles.spacedRepHeader}>
            <BookOpen size={18} color={palette.primary} />
            <Text style={[styles.spacedRepTitle, { color: palette.primary }]}>Spaced repetition queue</Text>
          </View>
          <Text style={[styles.spacedRepSub, { color: palette.textSecondary }]}>Review study screenshots today. Grow automatically.</Text>
        </View>
        <View style={[styles.spacedRepCount, { backgroundColor: palette.primary }]}>
          <Text style={styles.spacedRepCountText}>{spacedReviewCount}</Text>
        </View>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.lg,
    marginBottom: SPACING.md,
  },
  badgeRow: {
    marginBottom: SPACING.sm,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    ...TYPOGRAPHY.heroTitle,
    marginBottom: 4,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
  },
  controlBar: {
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.lg,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: SPACING.sm,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  ocrBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ocrText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  filterRow: {
    marginBottom: SPACING.md,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    marginRight: 8,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sortToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sortDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortText: {
    fontSize: 13,
    fontWeight: '600',
    marginRight: 4,
  },
  viewToggles: {
    flexDirection: 'row',
  },
  toggleIcon: {
    marginLeft: 12,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 6,
  },
  recentScroll: {
    paddingLeft: SPACING.md,
  },
  recentItem: {
    marginRight: 12,
    alignItems: 'center',
  },
  recentThumb: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.sm,
    marginBottom: 4,
    position: 'relative',
  },
  recentTime: {
    fontSize: 11,
    color: '#9CA3AF',
    width: 64,
    textAlign: 'center',
  },
  justProcessedBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  justProcessedText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#FFF',
  },
  gridSection: {
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.lg,
  },
  sectionTitleGrid: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.md,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  categoryCard: {
    width: '48%',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: 12,
    marginBottom: SPACING.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  cardName: {
    fontSize: 14,
    fontWeight: '700',
  },
  cardCount: {
    fontSize: 11,
    fontWeight: '500',
  },
  thumbStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  miniThumb: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 4,
    borderWidth: 1,
  },
  smartCard: {
    width: 140,
    padding: 12,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginRight: 12,
    position: 'relative',
  },
  smartBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#8B5CF6',
    borderRadius: RADIUS.pill,
    padding: 4,
  },
  smartName: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 2,
  },
  smartCount: {
    fontSize: 11,
    fontWeight: '500',
  },
  spacedRepSection: {
    marginHorizontal: SPACING.md,
    padding: 16,
    borderRadius: RADIUS.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  spacedRepContent: {
    flex: 1,
    marginRight: 12,
  },
  spacedRepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  spacedRepTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
  },
  spacedRepSub: {
    fontSize: 12,
    fontWeight: '500',
  },
  spacedRepCount: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spacedRepCountText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
