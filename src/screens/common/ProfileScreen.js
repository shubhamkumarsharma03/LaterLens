import { StyleSheet, View, Text, Pressable, ScrollView } from 'react-native';
import { useAuth } from '../../state/AuthContext';
import { useTheme } from '../../theme/useTheme';
import { TYPOGRAPHY, SPACING, RADIUS } from '../../theme/colors';
import { User, Mail, LogOut, Shield, Bell, CircleHelp } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

export default function ProfileScreen() {
  const { user, isAuthenticated, signOut, signIn } = useAuth();
  const { palette, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const handleAuthAction = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isAuthenticated) {
      signOut();
    } else {
      signIn({ name: 'User', email: 'user@example.com' });
    }
  };

  const ProfileItem = ({ icon: Icon, label, value, color }) => (
    <View style={[styles.itemRow, { borderBottomColor: palette.border }]}>
      <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(129,140,248,0.1)' : 'rgba(99,102,241,0.06)' }]}>
        <Icon size={18} color={color || palette.primary} />
      </View>
      <View style={styles.itemContent}>
        <Text style={[TYPOGRAPHY.caption, { color: palette.textSecondary }]}>{label}</Text>
        <Text style={[TYPOGRAPHY.bodyBold, { color: palette.textPrimary }]}>{value || 'Not set'}</Text>
      </View>
    </View>
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
      </View>

      <View style={styles.section}>
        <Text style={[TYPOGRAPHY.subtitle, { color: palette.textPrimary, marginHorizontal: SPACING.md, marginBottom: SPACING.sm }]}>Security</Text>
        <ProfileItem icon={Shield} label="Privacy Policy" value="v1.0" />
        <ProfileItem icon={Bell} label="Notifications" value="Enabled" />
      </View>

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
  authButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', margin: SPACING.xl, paddingVertical: SPACING.md, borderRadius: RADIUS.lg },
  footer: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center', paddingBottom: 60 }
});
