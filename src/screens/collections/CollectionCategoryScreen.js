import React, { useMemo, useState, useCallback } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  Dimensions,
  Image,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../../theme/useTheme';
import { SPACING, RADIUS, TYPOGRAPHY } from '../../theme/colors';
import { HOME_ROUTES } from '../../navigation/routeNames';
import { useQueue } from '../../state/QueueContext';
import { getCategoryIcon } from '../../utils/categoryIcons';
import { ChevronLeft } from 'lucide-react-native';
import BatchActionsBar from './components/BatchActionsBar';
import CategoryPickerModal from './components/CategoryPickerModal';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - SPACING.md * 3) / 2;

export default function CollectionCategoryScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { palette } = useTheme();
  const { contentType } = route.params || {};
  const { 
    collectionItems, 
    bulkDelete, 
    bulkUpdateStatus, 
    bulkUpdateCategory 
  } = useQueue();

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const isMultiSelect = selectedIds.size > 0;

  const items = useMemo(
    () => collectionItems.filter((item) => item.contentType === contentType),
    [collectionItems, contentType]
  );

  const toggleSelection = useCallback((id) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleLongPress = (id) => {
    if (!isMultiSelect) {
      toggleSelection(id);
    }
  };

  const handlePress = (id) => {
    if (isMultiSelect) {
      toggleSelection(id);
    } else {
      navigation.navigate('Home', {
        screen: HOME_ROUTES.DETAIL,
        params: { itemId: id },
      });
    }
  };

  const handleBatchAction = async (action) => {
    const ids = Array.from(selectedIds);
    if (action === 'delete') {
      await bulkDelete(ids);
    } else if (action === 'done') {
      await bulkUpdateStatus(ids, 'completed');
    } else if (action === 'move') {
      setIsPickerVisible(true);
      return; // Wait for picker selection
    } else if (action === 'share') {
      const selectedItems = items.filter(i => selectedIds.has(i.id));
      // For demo, we might not have real local URIs, but let's try
      // Sharing.shareAsync(uri) works for local files.
      // If we don't have real URIs, we show a toast.
      const firstUri = selectedItems.find(i => i.uri)?.uri;
      if (firstUri && await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(firstUri);
      } else {
        alert('Sharing screenshots requires real file paths on-device.');
      }
    }
    // Handle other actions similarly
    setSelectedIds(new Set());
  };

  const onMoveSelect = async (newCategory) => {
    setIsPickerVisible(false);
    await bulkUpdateCategory(Array.from(selectedIds), newCategory);
    setSelectedIds(new Set());
  };

  const allCategories = useMemo(() => {
    const set = new Set(collectionItems.map(i => i.contentType || 'Uncategorized'));
    return Array.from(set).sort();
  }, [collectionItems]);

  const renderItem = ({ item }) => {
    const isSelected = selectedIds.has(item.id);
    return (
      <Pressable
        onPress={() => handlePress(item.id)}
        onLongPress={() => handleLongPress(item.id)}
        style={[
          styles.itemCard,
          { backgroundColor: palette.card, borderColor: isSelected ? palette.primary : palette.border },
          isSelected && { borderWidth: 2 }
        ]}
      >
        <View style={[styles.imagePlaceholder, { backgroundColor: palette.background }]}>
          {/* Real image would go here */}
           {isSelected && (
              <View style={[styles.selectionBadge, { backgroundColor: palette.primary }]}>
                  <Text style={styles.selectionCheck}>✓</Text>
              </View>
           )}
        </View>
        <View style={styles.itemInfo}>
          <Text style={[styles.itemSummary, { color: palette.textPrimary }]} numberOfLines={2}>
            {item.summary}
          </Text>
          <Text style={[styles.itemDate, { color: palette.textSecondary }]}>
            {new Date(item.timestamp).toLocaleDateString()}
          </Text>
        </View>
      </Pressable>
    );
  };

  const CategoryIcon = getCategoryIcon(contentType);

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={24} color={palette.textPrimary} />
        </Pressable>
        <View style={styles.headerTitleContainer}>
          <View style={styles.titleRow}>
            <CategoryIcon size={20} color={palette.primary} />
            <Text style={[styles.title, { color: palette.textPrimary }]}>{contentType}</Text>
          </View>
          <Text style={[styles.subtitle, { color: palette.textSecondary }]}>{items.length} items total</Text>
        </View>
      </View>

      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
           <View style={styles.filterStrip}>
               <Text style={[styles.filterLabel, { color: palette.textSecondary }]}>Filter by: Latest · All screenshots</Text>
           </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: palette.textSecondary }]}>No items in this collection yet.</Text>
          </View>
        }
      />

      <BatchActionsBar
        selectedCount={selectedIds.size}
        onClear={() => setSelectedIds(new Set())}
        onAction={handleBatchAction}
      />

      <CategoryPickerModal
        visible={isPickerVisible}
        onClose={() => setIsPickerVisible(false)}
        onSelect={onMoveSelect}
        categories={allCategories}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  backBtn: {
    marginRight: 12,
  },
  headerTitleContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    ...TYPOGRAPHY.title,
    marginLeft: 8,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
    marginLeft: 28,
  },
  filterStrip: {
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: 100, // Space for batch bar
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  itemCard: {
    width: COLUMN_WIDTH,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  imagePlaceholder: {
    width: '100%',
    aspectRatio: 3 / 4,
    position: 'relative',
  },
  selectionBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionCheck: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  itemInfo: {
    padding: 10,
  },
  itemSummary: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemDate: {
    fontSize: 10,
    fontWeight: '500',
  },
  emptyContainer: {
    marginTop: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
});
