import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { ONBOARDING_ROUTES, ROOT_STACK } from '../../navigation/routeNames';
import { RADIUS, SPACING } from '../../theme/colors';
import PersonaChip from '../../components/common/PersonaChip';
import OnboardingCard from '../../components/common/OnboardingCard';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Info, Sparkles, Brain, Clock, ChevronRight } from 'lucide-react-native';

const PERSONAS = ['Student', 'Shopper', 'Builder', 'Creator', 'Traveller', 'Researcher'];
const TIMES = ['Morning (8am)', 'Afternoon (1pm)', 'Evening (9pm)', 'Custom'];

export default function PreferencesScreen({ navigation }) {
  const { palette, typography } = useTheme();
  const [digestTime, setDigestTime] = useState('Evening (9pm)');
  const [aiMode, setAiMode] = useState('On-device');
  const [selectedPersonas, setSelectedPersonas] = useState(['Researcher']);

  const togglePersona = (persona) => {
    setSelectedPersonas(prev =>
      prev.includes(persona) ? prev.filter(p => p !== persona) : [...prev, persona]
    );
  };

  const handleFinish = async () => {
    try {
      await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
      // Root stack will switch automatically on navigation to MainTabs
      navigation.replace(ROOT_STACK.MAIN_TABS);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: palette.textPrimary, ...typography.title }]}>
            Preferences
          </Text>
          <Text style={[styles.subtitle, { color: palette.textSecondary, ...typography.body }]}>
            Personalize your experience.
          </Text>
        </View>

        {/* Digest Time Picker */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Clock size={18} color={palette.primary} strokeWidth={2.5} style={styles.sectionIcon} />
            <Text style={[styles.sectionTitle, { color: palette.textPrimary, ...typography.subtitle }]}>
              Digest Time
            </Text>
          </View>
          <View style={styles.timeContainer}>
            {TIMES.map(time => (
              <TouchableOpacity
                key={time}
                style={[
                  styles.timeOption,
                  {
                    backgroundColor: digestTime === time ? palette.primary : palette.card,
                    borderColor: digestTime === time ? palette.primary : palette.border,
                  },
                  digestTime !== time && palette.shadow,
                ]}
                onPress={() => setDigestTime(time)}
              >
                <Text
                  style={[
                    styles.timeLabel,
                    {
                      color: digestTime === time ? '#fff' : palette.textPrimary,
                      ...typography.caption,
                      fontWeight: '700',
                    },
                  ]}
                >
                  {time}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* AI Mode Selector */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Brain size={18} color={palette.primary} strokeWidth={2.5} style={styles.sectionIcon} />
            <Text style={[styles.sectionTitle, { color: palette.textPrimary, ...typography.subtitle }]}>
              AI Mode
            </Text>
          </View>
          <OnboardingCard style={styles.aiCard}>
            <View style={styles.aiRow}>
              <View style={styles.aiLabelContainer}>
                <Text style={[styles.aiLabel, { color: palette.textPrimary, ...typography.bodyBold }]}>
                  {aiMode === 'On-device' ? 'On-device (private)' : 'Cloud AI (smarter)'}
                </Text>
                <Text style={[styles.aiSubLabel, { color: palette.textSecondary, ...typography.caption }]}>
                  {aiMode === 'On-device' 
                    ? 'Processing stays on your device.' 
                    : 'Requires login and shows a brief data privacy notice.'}
                </Text>
              </View>
              <Switch
                trackColor={{ false: palette.border, true: palette.primary }}
                thumbColor="#fff"
                onValueChange={() => setAiMode(prev => prev === 'On-device' ? 'Cloud' : 'On-device')}
                value={aiMode !== 'On-device'}
              />
            </View>
          </OnboardingCard>
        </View>

        {/* Persona Chip Selection */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Sparkles size={18} color={palette.primary} strokeWidth={2.5} style={styles.sectionIcon} />
            <Text style={[styles.sectionTitle, { color: palette.textPrimary, ...typography.subtitle }]}>
              What do you mainly save?
            </Text>
          </View>
          <View style={styles.chipGrid}>
            {PERSONAS.map(persona => (
              <PersonaChip
                key={persona}
                label={persona}
                isSelected={selectedPersonas.includes(persona)}
                onPress={() => togglePersona(persona)}
              />
            ))}
          </View>
          <Text style={[styles.optionalText, { color: palette.textSecondary, ...typography.tiny }]}>
            Optional. Tunes the AI's initial intent model. Multi-select.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.button, { backgroundColor: palette.primary }]}
          onPress={handleFinish}
          activeOpacity={0.8}
        >
          <Text style={[styles.buttonText, { color: '#fff', ...typography.buttonLabel }]}>
            Get Started
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
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionIcon: {
    marginRight: 10,
  },
  sectionTitle: {
    fontWeight: '700',
  },
  timeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  timeOption: {
    flexGrow: 1,
    minWidth: '45%',
    paddingVertical: 12,
    margin: 4,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  aiCard: {
    padding: 16,
  },
  aiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aiLabelContainer: {
    flex: 1,
    marginRight: 12,
  },
  aiLabel: {
    marginBottom: 4,
  },
  aiSubLabel: {
    fontSize: 12,
    lineHeight: 18,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  optionalText: {
    paddingHorizontal: 4,
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
});
