import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { ONBOARDING_ROUTES } from '../../navigation/routeNames';
import { SPACING, RADIUS } from '../../theme/colors';
import { Image, Bell, MapPin, FolderOpen, ShieldCheck, ChevronRight } from 'lucide-react-native';
import PermissionToggle from '../../components/common/PermissionToggle';
import OnboardingCard from '../../components/common/OnboardingCard';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as MediaLibrary from 'expo-media-library';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import { Modal, FlatList } from 'react-native';
import { getAllUserAlbums, findScreenshotAlbum } from '../../services/mediaDiscovery';
import { saveScreenshotAlbum, getScreenshotAlbum } from '../../services/settingsStorage';
import { Check } from 'lucide-react-native';

export default function PermissionsScreen({ navigation }) {
  const { palette, typography } = useTheme();
  const [permissions, setPermissions] = useState({
    photos: true,
    notifications: true,
    location: false,
  });

  const [albums, setAlbums] = useState([]);
  const [selectedAlbum, setSelectedAlbum] = useState({ id: null, title: 'Screenshots' });
  const [isModalVisible, setIsModalVisible] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    // Load saved preference
    const saved = await getScreenshotAlbum();
    if (saved.albumTitle) {
      setSelectedAlbum({ id: saved.albumId, title: saved.albumTitle });
    } else {
      // Auto-discover if none saved
      const auto = await findScreenshotAlbum();
      if (auto) setSelectedAlbum({ id: auto.id, title: auto.title });
    }

    // Pre-fetch all albums for the picker
    const all = await getAllUserAlbums();
    setAlbums(all);
  };

  const handleSelectAlbum = async (album) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedAlbum({ id: album.id, title: album.title });
    await saveScreenshotAlbum(album.id, album.title);
    setIsModalVisible(false);
  };

  const handleToggle = (key) => {
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const requestPermissions = async () => {
    // Photos (Required)
    if (permissions.photos) {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Required Permission', 'Photos access is required for ScreenMind to function.');
        return;
      }
    }

    // Notifications (Required)
    if (permissions.notifications) {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Required Permission', 'Notifications are required for the daily digest.');
        return;
      }
    }

    // Location (Optional)
    if (permissions.location) {
      await Location.requestForegroundPermissionsAsync();
    }

    navigation.navigate(ONBOARDING_ROUTES.PREFERENCES);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: palette.textPrimary, ...typography.title }]}>
            Permissions
          </Text>
          <Text style={[styles.subtitle, { color: palette.textSecondary, ...typography.body }]}>
            Grant access to make ScreenMind work as intended.
          </Text>
        </View>

        <View style={styles.list}>
          <PermissionToggle
            icon={Image}
            label="Photos"
            subLabel="Required to scan and organize your screenshots."
            isEnabled={permissions.photos}
            isRequired={true}
            onToggle={() => handleToggle('photos')}
          />
          <PermissionToggle
            icon={Bell}
            label="Notifications"
            subLabel="Required to send you daily digests and reminders."
            isEnabled={permissions.notifications}
            isRequired={true}
            onToggle={() => handleToggle('notifications')}
          />
          <PermissionToggle
            icon={MapPin}
            label="Location"
            subLabel="Optional. Helps group screenshots by place."
            isEnabled={permissions.location}
            isRequired={false}
            onToggle={() => handleToggle('location')}
          />
        </View>

        <OnboardingCard style={styles.folderPicker}>
          <FolderOpen size={20} color={palette.primary} strokeWidth={2} style={styles.folderIcon} />
          <View style={styles.folderContent}>
            <Text style={[styles.folderLabel, { color: palette.textPrimary, ...typography.bodyBold }]}>
              Folder: /{selectedAlbum.title}
            </Text>
            <TouchableOpacity onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setIsModalVisible(true);
            }}>
              <Text style={[styles.folderLink, { color: palette.primary, ...typography.caption }]}>
                Change folder (optional)
              </Text>
            </TouchableOpacity>
          </View>
        </OnboardingCard>

        {/* Album Picker Modal */}
        <Modal
          visible={isModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setIsModalVisible(false)}
        >
          <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
            <View style={[styles.modalContent, { backgroundColor: palette.background, borderTopLeftRadius: 24, borderTopRightRadius: 24 }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: palette.textPrimary, ...typography.title }]}>
                  Select Folder
                </Text>
                <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                  <Text style={{ color: palette.primary, fontWeight: '700' }}>Done</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={albums}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.albumItem}
                    onPress={() => handleSelectAlbum(item)}
                  >
                    <View style={styles.albumInfo}>
                      <FolderOpen size={18} color={palette.textSecondary} style={{ marginRight: 12 }} />
                      <Text style={[styles.albumTitle, { color: palette.textPrimary, ...typography.body }]}>
                        {item.title}
                      </Text>
                    </View>
                    {selectedAlbum.id === item.id && (
                      <Check size={18} color={palette.primary} strokeWidth={3} />
                    )}
                  </TouchableOpacity>
                )}
                contentContainerStyle={{ paddingBottom: 40 }}
              />
            </View>
          </View>
        </Modal>

        <View style={styles.privacyNote}>
          <ShieldCheck size={16} color={palette.textSecondary} strokeWidth={2} style={styles.privacyIcon} />
          <Text style={[styles.privacyText, { color: palette.textSecondary, ...typography.caption }]}>
            Processing happens on your device by default. Nothing is uploaded unless you enable cloud sync.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.button, { backgroundColor: palette.primary }]}
          onPress={requestPermissions}
          activeOpacity={0.8}
        >
          <Text style={[styles.buttonText, { color: '#fff', ...typography.buttonLabel }]}>
            Grant Permissions
          </Text>
          <ChevronRight size={18} color="#fff" strokeWidth={2.5} style={styles.buttonIcon} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    marginBottom: 8,
  },
  subtitle: {
    lineHeight: 22,
  },
  list: {
    marginBottom: 24,
  },
  folderPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 24,
  },
  folderIcon: {
    marginRight: 16,
  },
  folderContent: {
    flex: 1,
  },
  folderLabel: {
    marginBottom: 4,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 8,
  },
  privacyIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  privacyText: {
    flex: 1,
    lineHeight: 18,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
  },
  button: {
    flexDirection: 'row',
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  buttonIcon: {
    marginLeft: 8,
  },
  /* Modal Styles */
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: '70%',
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
  },
  albumItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  albumInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  albumTitle: {
    fontSize: 16,
  },
});
