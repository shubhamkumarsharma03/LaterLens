import { useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { COLLECTION_ROUTES } from '../../navigation/routeNames';
import { useQueue } from '../../state/QueueContext';

export default function CollectionsScreen() {
  const navigation = useNavigation();
  const [query, setQuery] = useState('');
  const { collectionItems } = useQueue();

  const groupedCollections = useMemo(() => {
    const source = query.trim()
      ? collectionItems.filter((item) => {
          const haystack = `${item.contentType} ${item.summary} ${(item.tags || []).join(' ')}`.toLowerCase();
          return haystack.includes(query.trim().toLowerCase());
        })
      : collectionItems;

    const map = source.reduce((acc, item) => {
      const key = item.contentType || 'Uncategorized';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(map)
      .map(([contentType, count]) => ({ contentType, count }))
      .sort((a, b) => b.count - a.count);
  }, [collectionItems, query]);

  const recentItems = useMemo(() => collectionItems.slice(0, 5), [collectionItems]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Collections</Text>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search your screenshots..."
        style={styles.searchInput}
        placeholderTextColor="#94a3b8"
      />

      <FlatList
        data={groupedCollections}
        keyExtractor={(item) => item.contentType}
        numColumns={2}
        columnWrapperStyle={styles.collectionGridRow}
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              navigation.navigate(COLLECTION_ROUTES.CATEGORY, {
                contentType: item.contentType,
              })
            }
            style={styles.collectionCard}
          >
            <Text style={styles.collectionTitle}>{item.contentType}</Text>
            <Text style={styles.collectionCount}>{item.count} items</Text>
          </Pressable>
        )}
        ListHeaderComponent={<Text style={styles.sectionTitle}>Auto-generated groups</Text>}
        ListEmptyComponent={<Text style={styles.emptyText}>No collection data yet.</Text>}
        ListFooterComponent={
          <View style={styles.recentBlock}>
            <Text style={styles.sectionTitle}>Recently processed</Text>
            {recentItems.length ? (
              recentItems.map((item) => (
                <View key={item.id} style={styles.recentItemRow}>
                  <Text style={styles.recentSummary} numberOfLines={1}>
                    {item.summary}
                  </Text>
                  <Text style={styles.recentMeta}>{item.contentType}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No recent screenshots yet.</Text>
            )}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f4f6f8',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  searchInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
    color: '#111827',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 10,
  },
  collectionGridRow: {
    justifyContent: 'space-between',
  },
  collectionCard: {
    width: '48%',
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
  },
  collectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  collectionCount: {
    fontSize: 12,
    color: '#64748b',
  },
  recentBlock: {
    marginTop: 10,
    marginBottom: 20,
  },
  recentItemRow: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    padding: 12,
    marginBottom: 8,
  },
  recentSummary: {
    fontSize: 14,
    color: '#0f172a',
    marginBottom: 4,
  },
  recentMeta: {
    fontSize: 12,
    color: '#64748b',
  },
  emptyText: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 8,
  },
});
