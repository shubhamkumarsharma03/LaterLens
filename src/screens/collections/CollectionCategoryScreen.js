import { useMemo } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { HOME_ROUTES } from '../../navigation/routeNames';
import { useQueue } from '../../state/QueueContext';

export default function CollectionCategoryScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { contentType } = route.params || {};
  const { collectionItems } = useQueue();

  const items = useMemo(
    () => collectionItems.filter((item) => item.contentType === contentType),
    [collectionItems, contentType]
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{contentType || 'Category'}</Text>
      <Text style={styles.subtitle}>{items.length} items</Text>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            style={styles.itemRow}
            onPress={() =>
              navigation.navigate('Home', {
                screen: HOME_ROUTES.DETAIL,
                params: { itemId: item.id },
              })
            }
          >
            <Text style={styles.itemSummary} numberOfLines={2}>
              {item.summary}
            </Text>
            <Text style={styles.itemMeta}>{new Date(item.timestamp).toLocaleDateString()}</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No items in this collection yet.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f6f8',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 12,
  },
  itemRow: {
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 10,
  },
  itemSummary: {
    fontSize: 14,
    color: '#0f172a',
    marginBottom: 6,
  },
  itemMeta: {
    fontSize: 12,
    color: '#64748b',
  },
  emptyText: {
    fontSize: 13,
    color: '#64748b',
  },
});
