import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Platform } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { ONBOARDING_ROUTES } from '../../navigation/routeNames';
import { RADIUS, SPACING } from '../../theme/colors';
import PersonaChip from '../../components/common/PersonaChip';
import OnboardingCard from '../../components/common/OnboardingCard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Brain, Clock, Sparkles, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useOnboarding } from '../../state/OnboardingContext';

const PERSONAS = ['Student', 'Shopper', 'Builder', 'Creator', 'Traveller', 'Researcher'];
const TIMES = ['Morning (8am)', 'Afternoon (1pm)', 'Evening (9pm)', 'Custom'];

export default function PreferencesScreen() {
  const { palette, typography } = useTheme();
  const { completeOnboarding } = useOnboarding();
  
  const [digestTime, setDigestTime] = useState('Evening (9pm)');
  const [customTime, setCustomTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [aiMode, setAiMode] = useState('On-device');
  const [selectedPersonas, setSelectedPersonas] = useState(['Researcher']);

  const togglePersona = (persona) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPersonas(prev =>
      prev.includes(persona) 
        ? prev.filter(p => p !== persona) 
        : [...prev, persona]
    );
  };

  const handleTimePress = (time) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (time === 'Custom') {
      setShowTimePicker(true);
    } else {
      setDigestTime(time);
    }
  };

  const onTimeChange = (event, selectedDate) => {
    const currentDate = selectedDate || customTime;
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setCustomTime(currentDate);
      const hours = currentDate.getHours();
      const minutes = currentDate.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const hours12 = hours % 12 || 12;
      const formattedTime = `${hours12}:${minutes < 10 ? '0' + minutes : minutes} ${ampm}`;
      setDigestTime(`Custom (${formattedTime})`);
    }
  };

  const handleFinish = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await completeOnboarding({
      digestTime,
      aiMode,
      personas: selectedPersonas,
      customTimeValue: customTime.getTime()
    });
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
                    backgroundColor: digestTime.startsWith(time) || (time === 'Custom' && digestTime.startsWith('Custom')) 
                      ? palette.primary 
                      : palette.card,
                    borderColor: digestTime.startsWith(time) || (time === 'Custom' && digestTime.startsWith('Custom'))
                      ? palette.primary 
                      : palette.border,
                  },
                ]}
                onPress={() => handleTimePress(time)}
              >
                <Text
                  style={[
                    styles.timeLabel,
                    {
                      color: digestTime.startsWith(time) || (time === 'Custom' && digestTime.startsWith('Custom')) 
                        ? '#fff' 
                        : palette.textPrimary,
                      ...typography.caption,
                      fontWeight: '700',
                    },
                  ]}
                >
                  {time === 'Custom' && digestTime.startsWith('Custom') ? digestTime : time}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {showTimePicker && (
          <DateTimePicker
            value={customTime}
            mode="time"
            is24Hour={false}
            display="default"
            onChange={onTimeChange}
          />
        )}

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
                onValueChange={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setAiMode(prev => prev === 'On-device' ? 'Cloud' : 'On-device');
                }}
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
          <Text style={[styles.optionalText, { color: palette.textSecondary, ...typography.tiny, textAlign: 'center' }]}>
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
    alignItems: 'center',
  },
  title: {
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    lineHeight: 22,
    textAlign: 'center',
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    justifyContent: 'center',
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
    justifyContent: 'center',
  },
  optionalText: {
    paddingHorizontal: 4,
    marginTop: 8,
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
