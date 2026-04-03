import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Check, Folder, ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { getAllUserAlbums } from '../../services/mediaDiscovery';
import { saveScreenshotAlbum, getScreenshotAlbum } from '../../services/settingsStorage';
import { useTheme } from '../../theme/useTheme';
import { TYPOGRAPHY, SPACING, RADIUS } from '../../theme/colors';

export default function AlbumPickerScreen() {
  const navigation = useNavigation();
  const { palette, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlbumId, setSelectedAlbumId] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const allAlbums = await getAllUserAlbums();
      const current = await getScreenshotAlbum();
      
      setAlbums(allAlbums);
      setSelectedAlbumId(current.albumId);
    } catch (error) {
      console.log('[AlbumPicker] Load failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (album) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedAlbumId(album.id);
    await saveScreenshotAlbum(album.id, album.title);
    
    // Brief delay for visual feedback then go back
    setTimeout(() => {
      navigation.goBack();
    }, 300);
  };

  const renderItem = ({ item }) => {
    const isSelected = selectedAlbumId === item.id;
    
    return (
      <Pressable
        onPress={() => handleSelect(item)}
        style={({ pressed }) => [
          styles.albumItem,
          { 
            borderBottomColor: palette.border,
            backgroundColor: pressed ? (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)') : 'transparent'
          }
        ]}
      >
        <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(129,140,248,0.1)' : 'rgba(99,102,241,0.06)' }]}>
          <Folder size={20} color={palette.primary} />
        </View>
        
        <View style={styles.albumInfo}>
          <Text style={[TYPOGRAPHY.bodyBold, { color: palette.textPrimary }]}>
            {item.title || 'Untitled Album'}
          </Text>
          <Text style={[TYPOGRAPHY.caption, { color: palette.textSecondary }]}>
            {item.assetCount} items
          </Text>
        </View>

        {isSelected && (
          <View style={styles.checkWrap}>
            <Check size={20} color={palette.primary} strokeWidth={3} />
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm, borderBottomColor: palette.border }]}>
        <Pressable 
          onPress={() => navigation.goBack()}
          hitSlop={20}
          style={styles.backButton}
        >
          <ChevronLeft size={24} color={palette.textPrimary} />
        </Pressable>
        <Text style={[TYPOGRAPHY.subtitle, { color: palette.textPrimary }]}>Select Screenshot Folder</Text>
        <View style={{ width: 40 }} />
      </View>

      <Text style={[TYPOGRAPHY.caption, { color: palette.textSecondary, margin: SPACING.md }]}>
        LaterLens will scan the selected folder for new screenshots. Selecting a new folder will trigger a fresh scan of today's items.
      </Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={albums}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.xl }}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={[TYPOGRAPHY.body, { color: palette.textSecondary }]}>No albums found</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.sm,
    paddingBottom: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  albumItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  albumInfo: {
    flex: 1,
  },
  checkWrap: {
    marginLeft: SPACING.sm,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
});
