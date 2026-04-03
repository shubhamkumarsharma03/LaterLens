import { StyleSheet, View, Text, Pressable, ScrollView, Modal, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useAuth } from '../../state/AuthContext';
import { useTheme } from '../../theme/useTheme';
import { TYPOGRAPHY, SPACING, RADIUS } from '../../theme/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useState, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { 
  User, Mail, LogOut, Shield, Bell, CircleHelp, 
  Folder, ChevronRight 
} from 'lucide-react-native';
import { HOME_ROUTES } from '../../navigation/routeNames';
import { getScreenshotAlbum, getGroqApiKey, saveGroqApiKey } from '../../services/settingsStorage';
import { findScreenshotAlbum } from '../../services/mediaDiscovery';
import { validateGroqKey } from '../../services/aiProcessingEngine';
import { Brain, CheckCircle2, XCircle } from 'lucide-react-native';

export default function ProfileScreen() {
  const { user, isAuthenticated, signOut, signIn } = useAuth();
  const { palette, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const [screenshotAlbum, setScreenshotAlbum] = useState('Auto-discovery');
  const [groqKey, setGroqKey] = useState('');
  const [isKeyModalVisible, setIsKeyModalVisible] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadSettings();
    });
    return unsubscribe;
  }, [navigation]);

  const loadSettings = async () => {
    try {
      const { albumTitle } = await getScreenshotAlbum();
      if (albumTitle) {
        setScreenshotAlbum(albumTitle);
      } else {
        const auto = await findScreenshotAlbum();
        setScreenshotAlbum(auto?.title || 'Not set');
      }

      const savedKey = await getGroqApiKey();
      if (savedKey) {
        const masked = `${savedKey.substring(0, 7)}...${savedKey.slice(-4)}`;
        setGroqKey(masked);
      } else {
        setGroqKey('Developer Default');
      }
    } catch (error) {
      console.log('[Profile] Failed to load settings:', error);
    }
  };

  const handleSaveKey = async () => {
    if (!newKeyValue.trim()) {
      Alert.alert('Error', 'Please enter a valid API key.');
      return;
    }

    setIsValidating(true);
    const isValid = await validateGroqKey(newKeyValue.trim());
    setIsValidating(false);

    if (isValid) {
      await saveGroqApiKey(newKeyValue.trim());
      setIsKeyModalVisible(false);
      setNewKeyValue('');
      loadSettings();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Groq API Key verified and saved.');
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Invalid Key', 'This key could not be verified with Groq. Please check your key and try again.');
    }
  };

  const handleClearKey = async () => {
    Alert.alert(
      'Clear Custom Key?',
      'The app will revert to using the default developer key.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive',
          onPress: async () => {
            await saveGroqApiKey(null);
            loadSettings();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
        }
      ]
    );
  };

  const handleAuthAction = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isAuthenticated) {
      signOut();
    } else {
      signIn({ name: 'User', email: 'user@example.com' });
    }
  };

  const ProfileItem = ({ icon: Icon, label, value, color, onPress }) => (
    <Pressable 
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.itemRow, 
        { borderBottomColor: palette.border, backgroundColor: pressed ? 'rgba(0,0,0,0.02)' : 'transparent' }
      ]}
    >
      <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(129,140,248,0.1)' : 'rgba(99,102,241,0.06)' }]}>
        <Icon size={18} color={color || palette.primary} />
      </View>
      <View style={styles.itemContent}>
        <Text style={[TYPOGRAPHY.caption, { color: palette.textSecondary }]}>{label}</Text>
        <View style={styles.valueRow}>
          <Text style={[TYPOGRAPHY.bodyBold, { color: palette.textPrimary, flex: 1 }]}>{value || 'Not set'}</Text>
          {onPress && <ChevronRight size={16} color={palette.textSecondary} />}
        </View>
      </View>
    </Pressable>
  );

  return (
    <ScrollView style={[styles.container, { backgroundColor: palette.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + SPACING.lg, backgroundColor: palette.card, borderBottomColor: palette.border }]}>
        <View style={[styles.avatarLarge, { backgroundColor: palette.avatarBg }]}>
          <Text style={[styles.avatarTextLarge, { color: palette.avatarText }]}>
            {isAuthenticated ? (user?.name?.charAt(0) || 'U') : 'G'}
          </Text>
        </View>
        <Text style={[TYPOGRAPHY.title, { color: palette.textPrimary, marginTop: SPACING.md }]}>
          {isAuthenticated ? user?.name : 'Guest User'}
        </Text>
        <Text style={[TYPOGRAPHY.caption, { color: palette.textSecondary }]}>
          {isAuthenticated ? user?.email : 'Login to save your library'}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={[TYPOGRAPHY.subtitle, { color: palette.textPrimary, marginHorizontal: SPACING.md, marginBottom: SPACING.sm }]}>Account</Text>
        <ProfileItem icon={User} label="Full Name" value={isAuthenticated ? user?.name : 'Guest'} />
        <ProfileItem icon={Mail} label="Email" value={isAuthenticated ? user?.email : 'Not logged in'} />
        <ProfileItem 
          icon={Folder} 
          label="Screenshot Folder" 
          value={screenshotAlbum} 
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.navigate(HOME_ROUTES.ALBUM_PICKER);
          }}
        />
      </View>

      <View style={styles.section}>
        <Text style={[TYPOGRAPHY.subtitle, { color: palette.textPrimary, marginHorizontal: SPACING.md, marginBottom: SPACING.sm }]}>Intelligence</Text>
        <ProfileItem 
          icon={Brain} 
          label="Groq API Key" 
          value={groqKey} 
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setNewKeyValue('');
            setIsKeyModalVisible(true);
          }}
        />
      </View>

      <View style={styles.section}>
        <Text style={[TYPOGRAPHY.subtitle, { color: palette.textPrimary, marginHorizontal: SPACING.md, marginBottom: SPACING.sm }]}>Security</Text>
        <ProfileItem icon={Shield} label="Privacy Policy" value="v1.0" />
        <ProfileItem icon={Bell} label="Notifications" value="Enabled" />
      </View>

      {/* API Key Modal */}
      <Modal
        visible={isKeyModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsKeyModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: palette.card }]}>
            <Text style={[TYPOGRAPHY.subtitle, { color: palette.textPrimary, marginBottom: 8 }]}>Set Groq API Key</Text>
            <Text style={[TYPOGRAPHY.tiny, { color: palette.textSecondary, marginBottom: 16 }]}>
              Enter your 'gsk_...' key from groq.com. This key is stored only on your device.
            </Text>
            
            <TextInput
              style={[styles.input, { borderColor: palette.border, color: palette.textPrimary, backgroundColor: palette.background }]}
              placeholder="gsk_..."
              placeholderTextColor={palette.textSecondary}
              value={newKeyValue}
              onChangeText={setNewKeyValue}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />

            <View style={styles.modalActions}>
              <Pressable 
                style={[styles.modalButton, { backgroundColor: palette.background }]} 
                onPress={() => setIsKeyModalVisible(false)}
              >
                <Text style={[TYPOGRAPHY.buttonLabel, { color: palette.textSecondary }]}>Cancel</Text>
              </Pressable>
              
              <Pressable 
                style={[styles.modalButton, { backgroundColor: palette.primary }]} 
                onPress={handleSaveKey}
                disabled={isValidating}
              >
                {isValidating ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={[TYPOGRAPHY.buttonLabel, { color: '#FFF' }]}>Verify & Save</Text>
                )}
              </Pressable>
            </View>

            {groqKey !== 'Developer Default' && (
              <Pressable style={styles.clearButton} onPress={handleClearKey}>
                <Text style={[TYPOGRAPHY.tiny, { color: '#DC2626', fontWeight: 'bold' }]}>Clear Custom Key</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>

      <Pressable 
        style={({ pressed }) => [
          styles.authButton, 
          { backgroundColor: isAuthenticated ? '#FEE2E2' : palette.primaryLight, opacity: pressed ? 0.8 : 1 }
        ]} 
        onPress={handleAuthAction}
      >
        <LogOut size={18} color={isAuthenticated ? '#DC2626' : palette.primary} />
        <Text style={[TYPOGRAPHY.buttonLabel, { color: isAuthenticated ? '#DC2626' : palette.primary, marginLeft: 8 }]}>
          {isAuthenticated ? 'Sign Out' : 'Sign In'}
        </Text>
      </Pressable>

      <View style={styles.footer}>
        <CircleHelp size={16} color={palette.textSecondary} />
        <Text style={[TYPOGRAPHY.tiny, { color: palette.textSecondary, marginLeft: 4 }]}>LaterLens Help Center</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { alignItems: 'center', paddingBottom: SPACING.xl, borderBottomWidth: StyleSheet.hairlineWidth },
  avatarLarge: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  avatarTextLarge: { fontSize: 32, fontWeight: '800' },
  section: { marginTop: SPACING.xl },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.md, paddingHorizontal: SPACING.md, borderBottomWidth: StyleSheet.hairlineWidth },
  iconBox: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: SPACING.md },
  itemContent: { flex: 1 },
  valueRow: { flexDirection: 'row', alignItems: 'center' },
  authButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', margin: SPACING.xl, paddingVertical: SPACING.md, borderRadius: RADIUS.lg },
  footer: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center', paddingBottom: 60 },
  
  /* Modal Styles */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', borderRadius: 20, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
  input: { height: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, marginBottom: 20, fontSize: 14 },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalButton: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  clearButton: { marginTop: 20, alignSelf: 'center', padding: 8 }
});
