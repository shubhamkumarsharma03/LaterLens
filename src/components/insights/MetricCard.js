import { View, Text, StyleSheet } from 'react-native';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react-native';
import { TYPOGRAPHY, SPACING, RADIUS } from '../../theme/colors';
import { useTheme } from '../../theme/useTheme';

export default function MetricCard({ title, value, subtitle, delta, icon: Icon, color }) {
  const { palette } = useTheme();
  const isPositive = delta > 0;
  const isNegative = delta < 0;

  return (
    <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <View style={styles.header}>
        {Icon && <Icon size={20} color={color || palette.primary} />}
        <Text style={[styles.title, { color: palette.textSecondary }]}>{title}</Text>
      </View>
      
      <Text style={[styles.value, { color: palette.textPrimary }]}>{value}</Text>
      
      {delta !== undefined && (
        <View style={styles.deltaRow}>
          {isPositive ? (
            <TrendingUp size={14} color={palette.completeTint} />
          ) : isNegative ? (
            <TrendingDown size={14} color={palette.urgencyRed} />
          ) : (
            <Minus size={14} color={palette.textSecondary} />
          )}
          <Text style={[
            styles.deltaText, 
            { color: isPositive ? palette.completeTint : isNegative ? palette.urgencyRed : palette.textSecondary }
          ]}>
            {Math.abs(delta)} from last month
          </Text>
        </View>
      )}

      {subtitle && (
        <Text style={[styles.subtitle, { color: palette.textSecondary }]}>{subtitle}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    minHeight: 140,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  title: {
    ...TYPOGRAPHY.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    ...TYPOGRAPHY.heroTitle,
    fontSize: 32,
    fontWeight: '800',
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  deltaText: {
    ...TYPOGRAPHY.tiny,
    fontWeight: '700',
  },
  subtitle: {
    ...TYPOGRAPHY.tiny,
    marginTop: 4,
  }
});
