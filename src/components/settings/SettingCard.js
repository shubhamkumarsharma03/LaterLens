import React from 'react';
import { StyleSheet, View, Text, Switch, Pressable } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { TYPOGRAPHY, SPACING, RADIUS } from '../../theme/colors';
import { LucideIcon } from 'lucide-react-native';

/**
 * @typedef {Object} SettingCardProps
 * @property {string} title
 * @property {string} [description]
 * @property {boolean} [isToggle]
 * @property {boolean} [toggleValue]
 * @property {function} [onToggleChange]
 * @property {function} [onPress]
 * @property {React.ReactNode} [children]
 * @property {LucideIcon} [icon]
 * @property {string[]} [tags]
 */

const SettingCard = ({
  title,
  description,
  isToggle,
  toggleValue,
  onToggleChange,
  onPress,
  children,
  icon: Icon,
  tags = [],
}) => {
  const { palette } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress || isToggle}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: palette.card,
          borderColor: palette.border,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={styles.header}>
        {Icon && (
          <View style={styles.iconContainer}>
            <Icon size={20} color={palette.primary} />
          </View>
        )}
        <View style={styles.textContainer}>
          <Text style={[TYPOGRAPHY.subtitle, { color: palette.textPrimary }]}>{title}</Text>
          {description && (
            <Text style={[TYPOGRAPHY.caption, { color: palette.textSecondary, marginTop: 2 }]}>
              {description}
            </Text>
          )}
        </View>
        {isToggle && (
          <Switch
            value={toggleValue}
            onValueChange={onToggleChange}
            trackColor={{ false: palette.border, true: palette.primary }}
            thumbColor="#FFFFFF"
          />
        )}
      </View>

      {children && <View style={styles.childrenContainer}>{children}</View>}

      {tags.length > 0 && (
        <View style={styles.tagContainer}>
          {tags.map((tag, index) => (
            <View
              key={index}
              style={[styles.tag, { backgroundColor: palette.background, borderColor: palette.border }]}
            >
              <Text style={[TYPOGRAPHY.tiny, { color: palette.textSecondary }]}>{tag}</Text>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    marginRight: SPACING.md,
  },
  textContainer: {
    flex: 1,
  },
  childrenContainer: {
    marginTop: SPACING.md,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: SPACING.sm,
    gap: SPACING.xs,
  },
  tag: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
});

export default SettingCard;
