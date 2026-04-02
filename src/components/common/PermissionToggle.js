import React from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { RADIUS, SPACING } from '../../theme/colors';
import OnboardingCard from './OnboardingCard';

export default function PermissionToggle({ icon: Icon, label, subLabel, isEnabled, onToggle, isRequired }) {
  const { palette, typography } = useTheme();

  return (
    <OnboardingCard style={styles.card}>
      <View style={styles.iconContainer}>
        {Icon && <Icon size={24} color={palette.primary} strokeWidth={1.5} />}
      </View>
      <View style={styles.content}>
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: palette.textPrimary, ...typography.subtitle }]}>
            {label}
          </Text>
          {isRequired && (
            <View style={[styles.requiredBadge, { backgroundColor: palette.primaryLight }]}>
              <Text style={[styles.requiredText, { color: palette.primary, ...typography.tiny }]}>
                REQUIRED
              </Text>
            </View>
          )}
        </View>
        <Text style={[styles.subLabel, { color: palette.textSecondary, ...typography.caption }]}>
          {subLabel}
        </Text>
      </View>
      <Switch
        trackColor={{ false: palette.border, true: palette.primary }}
        thumbColor="#fff"
        ios_backgroundColor={palette.border}
        onValueChange={onToggle}
        value={isEnabled}
      />
    </OnboardingCard>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  iconContainer: {
    marginRight: 16,
  },
  content: {
    flex: 1,
    marginRight:12,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  label: {
    fontWeight: '700',
  },
  requiredBadge: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  requiredText: {
    fontWeight: '800',
    fontSize: 10,
  },
  subLabel: {
    lineHeight: 18,
  },
});
