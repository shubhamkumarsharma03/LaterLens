import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, View, Text, ScrollView, Pressable, 
  Alert, ActivityIndicator, Platform, Modal, 
  TextInput, FlatList 
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { 
  Brain, Zap, Wifi, History, 
  FolderSearch, FolderDown, Ban,
  BellRing, BellPlus, Moon,
  Database, Archive, Download, Trash2,
  ChevronRight, LogOut, CircleHelp, User,
  Plus, X, Check
} from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { useTheme } from '../../theme/useTheme';
import { useAuth } from '../../state/AuthContext';
import { useSettings } from '../../state/SettingsContext';
import { TYPOGRAPHY, SPACING, RADIUS } from '../../theme/colors';
import { HOME_ROUTES } from '../../navigation/routeNames';

import { getGroqApiKey, saveGroqApiKey } from '../../services/settingsStorage';
import { validateGroqKey } from '../../services/aiProcessingEngine';

import SettingCard from '../../components/settings/SettingCard';
import StorageUsageBar from '../../components/settings/StorageUsageBar';
import { calculateStorageStats, exportMetadata, bulkImportScreenshots, wipeAllAppData, getLastBulkImportSummary } from '../../services/dataManagementService';
import { getNextDailyDigestOccurrence, scheduleDailyDigest, sendNotification } from '../../services/notificationService';

export default function ProfileScreen() {
  const { user, isAuthenticated, signOut, signIn } = useAuth();
  const { palette, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { settings, updateSetting, isLoading } = useSettings();

  const [showTimePicker, setShowTimePicker] = useState(false);
  const [stats, setStats] = useState({ totalMB: 0, metadata: 0.1, thumbnails: 0.9 });
  const [isProcessing, setIsProcessing] = useState(false);

  // Modals Visibility
  const [isExclusionModalVisible, setIsExclusionModalVisible] = useState(false);
  const [isNotificationModalVisible, setIsNotificationModalVisible] = useState(false);
  const [isArchiveModalVisible, setIsArchiveModalVisible] = useState(false);
  const [isQuietHoursModalVisible, setIsQuietHoursModalVisible] = useState(false);
  const [isApiKeyModalVisible, setIsApiKeyModalVisible] = useState(false);

  // Temporary State for Modals
  const [newExclusion, setNewExclusion] = useState('');
  const [tempQuietHours, setTempQuietHours] = useState(settings.quietHours);
  const [tempApiKey, setTempApiKey] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    loadStats();
    // Refresh stats when screen focuses
    const unsubscribe = navigation.addListener('focus', loadStats);
    return unsubscribe;
  }, [navigation]);

  const loadStats = async () => {
    const s = await calculateStorageStats();
    setStats(s);
  };

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: palette.background }]}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  const handleToggle = async (key, value) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await updateSetting(key, value);
    if (key === 'dailyDigestTime' || key === 'notificationConfig') {
      await scheduleDailyDigest();
    }
  };

  const handleBulkImport = async () => {
    setIsProcessing(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const summary = await bulkImportScreenshots(1);
      const lines = [
        `Total scanned: ${summary.total}`,
        `✅ Analysed: ${summary.successful}`,
      ];
      if (summary.privacyBlocked > 0) lines.push(`🔒 Privacy blocked: ${summary.privacyBlocked}`);
      if (summary.ocrFailed > 0) lines.push(`⚠️ Needs review: ${summary.ocrFailed}`);
      Alert.alert('Import Complete', lines.join('\n'));
      loadStats();
    } catch (e) {
      Alert.alert('Error', 'Failed to perform bulk import.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteAll = async () => {
    Alert.alert(
      'Delete Metadata?',
      'This will remove all processed AI insights from LaterLens. Your original screenshots will REMAIN in your photo library.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete All', 
          style: 'destructive',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            await wipeAllAppData();
            loadStats();
            Alert.alert('Cleared', 'Your action items have been reset.');
          }
        }
      ]
    );
  };

  const handleAddExclusion = () => {
    if (newExclusion.trim()) {
      const updated = [...settings.exclusionRules, newExclusion.trim()];
      updateSetting('exclusionRules', updated);
      setNewExclusion('');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const removeExclusion = (rule) => {
    const updated = settings.exclusionRules.filter(r => r !== rule);
    updateSetting('exclusionRules', updated);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const toggleNotificationType = async (key) => {
    try {
      const updated = { ...settings.notificationConfig, [key]: !settings.notificationConfig[key] };
      await updateSetting('notificationConfig', updated);
      await scheduleDailyDigest();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('[ProfileScreen] Failed to update notification type:', error);
      Alert.alert('Update Failed', 'Unable to update notification settings right now.');
    }
  };

  const SectionHeader = ({ title }) => (
    <Text style={[styles.sectionHeader, { color: palette.textSecondary }]}>
      {title.toUpperCase()}
    </Text>
  );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView 
        style={[styles.container, { backgroundColor: palette.background }]}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        <View style={[styles.header, { paddingTop: insets.top + SPACING.lg }]}>
          <View style={styles.profileBox}>
            <View style={[styles.avatar, { backgroundColor: palette.avatarBg }]}>
              <Text style={[styles.avatarText, { color: palette.avatarText }]}>
                {isAuthenticated ? user?.name?.charAt(0) : 'G'}
              </Text>
            </View>
            <View>
              <Text style={[TYPOGRAPHY.title, { color: palette.textPrimary }]}>
                {isAuthenticated ? user?.name : 'Guest User'}
              </Text>
              <Text style={[TYPOGRAPHY.caption, { color: palette.textSecondary }]}>
                {isAuthenticated ? user?.email : 'System · accessed via profile'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="AI & Processing" />
          <SettingCard
            icon={Brain}
            title="AI Processing Mode"
            description={settings.aiMode === 'on-device' ? 'On-device OCR is active.' : 'Cloud AI (Llama 3.1) is active.'}
          >
            <View style={styles.toggleRow}>
              <Pressable 
                onPress={() => handleToggle('aiMode', 'on-device')}
                style={[styles.modeButton, settings.aiMode === 'on-device' && { backgroundColor: palette.primaryLight, borderColor: palette.primary }]}
              >
                <Text style={[TYPOGRAPHY.tiny, { color: settings.aiMode === 'on-device' ? palette.primary : palette.textSecondary }]}>On-device</Text>
              </Pressable>
              <Pressable 
                onPress={() => handleToggle('aiMode', 'cloud')}
                style={[styles.modeButton, settings.aiMode === 'cloud' && { backgroundColor: palette.primaryLight, borderColor: palette.primary }]}
              >
                <Text style={[TYPOGRAPHY.tiny, { color: settings.aiMode === 'cloud' ? palette.primary : palette.textSecondary }]}>Cloud AI</Text>
              </Pressable>
            </View>
          </SettingCard>

          <SettingCard
            icon={Zap}
            title="Auto-processing"
            description="Automatically analyze new screenshots."
            isToggle
            toggleValue={settings.autoProcessingEnabled}
            onToggleChange={(v) => handleToggle('autoProcessingEnabled', v)}
            tags={['battery']}
          />

          <SettingCard
            icon={Wifi}
            title="Process on Wi-Fi only"
            description="Prevents cloud processing on mobile data."
            isToggle
            toggleValue={settings.wifiOnly}
            onToggleChange={(v) => handleToggle('wifiOnly', v)}
            tags={['data usage']}
          />

          <SettingCard
            icon={Zap}
            title="Groq API Configuration"
            description="Use your own API key for cloud analysis."
            onPress={async () => {
              const key = await getGroqApiKey();
              setTempApiKey(key || '');
              setIsApiKeyModalVisible(true);
            }}
            tags={['api key']}
          />
        </View>

        <View style={styles.section}>
          <SectionHeader title="Folders & Import" />
          <SettingCard
            icon={FolderSearch}
            title="Watched folder selector"
            description={settings.watchedFolderIds.length > 0 ? `${settings.watchedFolderIds.length} albums selected.` : "Default: Screenshots."}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate(HOME_ROUTES.ALBUM_PICKER);
            }}
            tags={['folder picker']}
          />

          <SettingCard
            icon={FolderDown}
            title="Bulk import trigger"
            description="Import and analyze from last 1 month."
            onPress={handleBulkImport}
            tags={['bulk import']}
          />

          <SettingCard
            icon={Ban}
            title="Exclusion rules"
            description={`${settings.exclusionRules.length} rules active.`}
            onPress={() => setIsExclusionModalVisible(true)}
            tags={['privacy']}
          />
        </View>

        <View style={styles.section}>
          <SectionHeader title="Notifications" />
          <SettingCard
            icon={BellRing}
            title="Daily digest time picker"
            description={`Scheduled for: ${settings.dailyDigestTime}`}
            onPress={() => setShowTimePicker(true)}
            tags={['time picker']}
          >
            <Pressable 
              onPress={async () => {
                await sendNotification("Test Alert", "Your notification system is working!");
              }}
              style={({ pressed }) => [
                { marginTop: 12, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: palette.primary, opacity: pressed ? 0.7 : 1, alignSelf: 'flex-start' }
              ]}
            >
              <Text style={[TYPOGRAPHY.tiny, { color: '#FFF' }]}>Send Test Alert</Text>
            </Pressable>
          </SettingCard>

          {showTimePicker && (
            <DateTimePicker
              value={new Date()}
              mode="time"
              is24Hour={true}
              display="default"
              onChange={(e, date) => {
                setShowTimePicker(false);
                if (date) {
                  (async () => {
                    const time = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
                    const notificationConfig = {
                      ...settings.notificationConfig,
                      dailyDigest: true,
                    };

                    await updateSetting('notificationConfig', notificationConfig);
                    await updateSetting('dailyDigestTime', time);
                    await scheduleDailyDigest(time);

                    const nextFire = getNextDailyDigestOccurrence(time);
                    Alert.alert(
                      'Daily digest scheduled',
                      `Your digest is set for ${time}.\nNext alert: ${nextFire.toLocaleString()}`
                    );
                  })();
                }
              }}
            />
          )}

          <SettingCard
            icon={BellPlus}
            title="Notification types"
            description="Manage alerts for digests and insights."
            onPress={() => setIsNotificationModalVisible(true)}
            tags={['granular toggles']}
          />

          <SettingCard
            icon={Moon}
            title="Quiet hours"
            description={`Muted from ${settings.quietHours.start} to ${settings.quietHours.end}`}
            onPress={() => setIsQuietHoursModalVisible(true)}
            tags={['quiet hours']}
          />
        </View>

        <View style={styles.section}>
          <SectionHeader title="Data & Storage" />
          <SettingCard
            icon={Database}
            title="Storage usage bar"
            description={`LaterLens is using ${stats.totalMB.toFixed(1)} MB.`}
          >
            <StorageUsageBar totalSizeMB={stats.totalMB} breakdown={{ metadata: stats.metadata, thumbnails: stats.thumbnails }} />
          </SettingCard>

          <SettingCard
            icon={Archive}
            title="Auto-archive rule"
            description={settings.autoArchiveDays === 0 ? 'Never archive' : `Archive after ${settings.autoArchiveDays} days`}
            onPress={() => setIsArchiveModalVisible(true)}
            tags={['automation']}
          />

          <View style={styles.row}>
            <Pressable 
              style={[styles.smallCard, { backgroundColor: palette.card, borderColor: palette.border }]}
              onPress={async () => {
                try {
                  await exportMetadata();
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                } catch (e) {
                  Alert.alert('Error', 'Export failed');
                }
              }}
            >
              <Download size={20} color={palette.primary} />
              <Text style={[TYPOGRAPHY.bodyBold, { color: palette.textPrimary, marginTop: 8 }]}>Export data</Text>
            </Pressable>
            <Pressable 
              style={[styles.smallCard, { backgroundColor: palette.card, borderColor: palette.border }]}
              onPress={handleDeleteAll}
            >
              <Trash2 size={20} color={palette.urgencyRed} />
              <Text style={[TYPOGRAPHY.bodyBold, { color: palette.urgencyRed, marginTop: 8 }]}>Delete all</Text>
            </Pressable>
          </View>
        </View>

        <Pressable 
          style={({ pressed }) => [
            styles.authButton, 
            { backgroundColor: isAuthenticated ? (isDark ? '#422020' : '#FEE2E2') : palette.primaryLight, opacity: pressed ? 0.8 : 1 }
          ]} 
          onPress={isAuthenticated ? signOut : signIn}
        >
          <LogOut size={18} color={isAuthenticated ? '#DC2626' : palette.primary} />
          <Text style={[TYPOGRAPHY.buttonLabel, { color: isAuthenticated ? '#DC2626' : palette.primary, marginLeft: 8 }]}>
            {isAuthenticated ? 'Sign Out' : 'Sign In'}
          </Text>
        </Pressable>
      </ScrollView>

      {/* MODALS */}
      
      {/* Exclusion Rules Modal */}
      <Modal visible={isExclusionModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: palette.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[TYPOGRAPHY.subtitle, { color: palette.textPrimary }]}>Exclusion Rules</Text>
              <Pressable onPress={() => setIsExclusionModalVisible(false)}><X color={palette.textSecondary} /></Pressable>
            </View>
            <Text style={[TYPOGRAPHY.caption, { color: palette.textSecondary, marginBottom: 16 }]}>Ignore screenshots containing these keywords or from these app names.</Text>
            
            <View style={styles.inputRow}>
              <TextInput 
                style={[styles.modalInput, { borderColor: palette.border, color: palette.textPrimary }]}
                placeholder="e.g. WhatsApp, Banking"
                placeholderTextColor={palette.textSecondary}
                value={newExclusion}
                onChangeText={setNewExclusion}
              />
              <Pressable style={[styles.addBtn, { backgroundColor: palette.primary }]} onPress={handleAddExclusion}>
                <Plus color="#FFF" size={20} />
              </Pressable>
            </View>

            <View style={{ maxHeight: 300, marginTop: 12 }}>
              <FlatList 
                data={settings.exclusionRules}
                keyExtractor={item => item}
                renderItem={({ item }) => (
                  <View style={[styles.ruleItem, { borderBottomColor: palette.border }]}>
                    <Text style={[TYPOGRAPHY.body, { color: palette.textPrimary }]}>{item}</Text>
                    <Pressable onPress={() => removeExclusion(item)}><Trash2 size={16} color={palette.urgencyRed} /></Pressable>
                  </View>
                )}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Notification Types Modal */}
      <Modal visible={isNotificationModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: palette.card }]}>
             <View style={styles.modalHeader}>
              <Text style={[TYPOGRAPHY.subtitle, { color: palette.textPrimary }]}>Notification Types</Text>
              <Pressable onPress={() => setIsNotificationModalVisible(false)}><X color={palette.textSecondary} /></Pressable>
            </View>
            {[
              { key: 'dailyDigest', label: 'Daily Digest summary' },
              { key: 'reminders', label: 'Actionable reminders' },
              { key: 'insights', label: 'Weekly productivity insights' },
              { key: 'saleExpiry', label: 'Sale & Expiry alerts' }
            ].map(item => (
              <Pressable 
                key={item.key} 
                style={styles.checkItem} 
                onPress={() => toggleNotificationType(item.key)}
              >
                <Text style={[TYPOGRAPHY.body, { color: palette.textPrimary }]}>{item.label}</Text>
                {settings.notificationConfig[item.key] && <Check color={palette.primary} size={20} />}
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>

      {/* Auto-Archive Modal */}
      <Modal visible={isArchiveModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: palette.card }]}>
             <View style={styles.modalHeader}>
              <Text style={[TYPOGRAPHY.subtitle, { color: palette.textPrimary }]}>Auto-Archive Rule</Text>
              <Pressable onPress={() => setIsArchiveModalVisible(false)}><X color={palette.textSecondary} /></Pressable>
            </View>
            {[
              { val: 7, label: 'After 7 days' },
              { val: 30, label: 'After 30 days' },
              { val: 90, label: 'After 90 days' },
              { val: 0, label: 'Never' }
            ].map(item => (
              <Pressable 
                key={item.val} 
                style={styles.checkItem} 
                onPress={() => {
                  updateSetting('autoArchiveDays', item.val);
                  setIsArchiveModalVisible(false);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Text style={[TYPOGRAPHY.body, { color: palette.textPrimary }]}>{item.label}</Text>
                {settings.autoArchiveDays === item.val && <Check color={palette.primary} size={20} />}
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>

      {/* Quiet Hours Modal */}
      <Modal visible={isQuietHoursModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: palette.card }]}>
             <View style={styles.modalHeader}>
              <Text style={[TYPOGRAPHY.subtitle, { color: palette.textPrimary }]}>Set Quiet Hours</Text>
              <Pressable onPress={() => setIsQuietHoursModalVisible(false)}><X color={palette.textSecondary} /></Pressable>
            </View>
            <Text style={[TYPOGRAPHY.caption, { color: palette.textSecondary, marginBottom: 16 }]}>Notifications queued during these hours will deliver at the start of the next active window.</Text>
            
            <View style={styles.timeSelectRow}>
               <View style={styles.timeBlock}>
                 <Text style={[TYPOGRAPHY.tiny, { color: palette.textSecondary }]}>START TIME</Text>
                 <Pressable style={[styles.timeBtn, { backgroundColor: palette.background }]} onPress={() => Alert.alert('Start Time', 'Select start time')}>
                    <Text style={[TYPOGRAPHY.subtitle, { color: palette.textPrimary }]}>{settings.quietHours.start}</Text>
                 </Pressable>
               </View>
               <View style={styles.timeBlock}>
                 <Text style={[TYPOGRAPHY.tiny, { color: palette.textSecondary }]}>END TIME</Text>
                 <Pressable style={[styles.timeBtn, { backgroundColor: palette.background }]} onPress={() => Alert.alert('End Time', 'Select end time')}>
                    <Text style={[TYPOGRAPHY.subtitle, { color: palette.textPrimary }]}>{settings.quietHours.end}</Text>
                 </Pressable>
               </View>
            </View>
            
            <Pressable 
              style={[styles.saveBtn, { backgroundColor: palette.primary }]}
              onPress={() => setIsQuietHoursModalVisible(false)}
            >
              <Text style={[TYPOGRAPHY.buttonLabel, { color: '#FFF' }]}>Save Window</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* API Key Modal */}
      <Modal visible={isApiKeyModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: palette.card }]}>
             <View style={styles.modalHeader}>
              <Text style={[TYPOGRAPHY.subtitle, { color: palette.textPrimary }]}>Groq API Configuration</Text>
              <Pressable onPress={() => setIsApiKeyModalVisible(false)}><X color={palette.textSecondary} /></Pressable>
            </View>
            <Text style={[TYPOGRAPHY.caption, { color: palette.textSecondary, marginBottom: 16 }]}>Enter your Groq Cloud API key. If left blank, LaterLens will use the internal system key.</Text>
            
            <TextInput 
              style={[styles.modalInput, { borderColor: palette.border, color: palette.textPrimary, marginBottom: 16 }]}
              placeholder="gsk_..."
              placeholderTextColor={palette.textSecondary}
              value={tempApiKey}
              onChangeText={setTempApiKey}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Pressable 
              style={[styles.saveBtn, { backgroundColor: palette.primary, opacity: isValidating ? 0.6 : 1 }]}
              onPress={async () => {
                if (!tempApiKey.trim()) {
                  await saveGroqApiKey(null);
                  setIsApiKeyModalVisible(false);
                  Alert.alert('Reset', 'Reverted to internal API key.');
                  return;
                }
                setIsValidating(true);
                const isValid = await validateGroqKey(tempApiKey.trim());
                if (isValid) {
                  await saveGroqApiKey(tempApiKey.trim());
                  setIsApiKeyModalVisible(false);
                  Alert.alert('Success', 'Your API key is valid and has been saved.');
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                } else {
                  Alert.alert('Error', 'Invalid API key. Please check and try again.');
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                }
                setIsValidating(false);
              }}
              disabled={isValidating}
            >
              {isValidating ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={[TYPOGRAPHY.buttonLabel, { color: '#FFF' }]}>Validate & Save</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      {isProcessing && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#FFF" />
          <Text style={[TYPOGRAPHY.subtitle, { color: '#FFF', marginTop: 16 }]}>Processing Library...</Text>
          <Text style={[TYPOGRAPHY.tiny, { color: 'rgba(255,255,255,0.7)', marginTop: 8 }]}>Wait times apply to respect API limits.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xl },
  profileBox: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 24, fontWeight: '800' },
  section: { paddingHorizontal: SPACING.md, marginTop: SPACING.xl },
  sectionHeader: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: SPACING.sm, paddingHorizontal: 4 },
  toggleRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  modeButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: '#DDD' },
  row: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.sm },
  smallCard: { flex: 1, padding: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1, alignItems: 'center' },
  authButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', margin: SPACING.xl, paddingVertical: SPACING.md, borderRadius: RADIUS.lg },
  
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, minHeight: 350 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalInput: { flex: 1, height: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16 },
  inputRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  addBtn: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  ruleItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  checkItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  timeSelectRow: { flexDirection: 'row', gap: 20, marginVertical: 20 },
  timeBlock: { flex: 1 },
  timeBtn: { marginTop: 8, padding: 16, borderRadius: 12, alignItems: 'center' },
  saveBtn: { marginTop: 24, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
});
