import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Image } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { ONBOARDING_ROUTES } from '../../navigation/routeNames';
import { SPACING, RADIUS } from '../../theme/colors';
import { CheckCircle2, Zap, Bell, ChevronRight } from 'lucide-react-native';
import OnboardingCard from '../../components/common/OnboardingCard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';

export default function WelcomeScreen({ navigation }) {
  const { palette, typography } = useTheme();

  // Setup animated logo player
  const videoSource = require('../../../assets/LaterLens_Animated_Logo.mp4');
  const player = useVideoPlayer(videoSource, (player) => {
    player.loop = true;
    player.play();
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Animated Hero Section */}
        <View style={[styles.hero, { backgroundColor: palette.primaryLight, borderRadius: RADIUS.xl, overflow: 'hidden' }]}>
          <VideoView
            style={styles.video}
            player={player}
            allowsFullscreen={false}
            allowsPictureInPicture={false}
            contentFit="cover"
          />
        </View>

        {/* Logo & Header Section */}
        <View style={styles.header}>
          <Image 
            source={require('../../../assets/logo.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
          {/* Tagline is now inside the image per user request, but we can keep it as backup or remove it */}
          {/* I will remove the text appName and tagline as they are in the image */}
        </View>

        {/* Value List */}
        <View style={styles.list}>
          <ValueItem 
            icon={CheckCircle2} 
            text="Auto-organises: Everything in one place." 
            palette={palette} 
            typography={typography} 
          />
          <ValueItem 
            icon={Zap} 
            text="Predicts your intent: Smarter workflows." 
            palette={palette} 
            typography={typography} 
          />
          <ValueItem 
            icon={Bell} 
            text="Reminds you at the right time: Never forget." 
            palette={palette} 
            typography={typography} 
          />
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.button, { backgroundColor: palette.primary }]}
          onPress={() => navigation.navigate(ONBOARDING_ROUTES.PERMISSIONS)}
          activeOpacity={0.8}
        >
          <Text style={[styles.buttonText, { color: '#fff', ...typography.buttonLabel }]}>
            Continue
          </Text>
          <ChevronRight size={18} color="#fff" strokeWidth={2.5} style={styles.buttonIcon} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function ValueItem({ icon: Icon, text, palette, typography }) {
  return (
    <OnboardingCard style={styles.valueItem}>
      <Icon size={20} color={palette.primary} strokeWidth={2} style={styles.valueIcon} />
      <Text style={[styles.valueText, { color: palette.textPrimary, ...typography.body }]}>
        {text}
      </Text>
    </OnboardingCard>
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
  hero: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  logo: {
    width: '100%',
    height: 120, // Adjusted to fit the logo + tagline image
  },
  list: {
    marginBottom: 24,
  },
  valueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    marginBottom: 12,
  },
  valueIcon: {
    marginRight: 16,
  },
  valueText: {
    flex: 1,
    fontWeight: '500',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    backgroundColor: 'transparent',
  },
  button: {
    flexDirection: 'row',
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  buttonIcon: {
    marginLeft: 8,
  },
});
