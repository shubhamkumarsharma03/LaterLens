import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Path, Circle, G } from 'react-native-svg';
import { TYPOGRAPHY, SPACING, RADIUS } from '../../theme/colors';
import { useTheme } from '../../theme/useTheme';

const ProgressBar = ({ label, saved, acted, color, palette }) => {
  const percentage = saved > 0 ? (acted / saved) * 100 : 0;
  
  return (
    <View style={styles.barContainer}>
      <View style={styles.barHeader}>
        <Text style={[styles.barLabel, { color: palette.textPrimary }]}>{label}</Text>
        <Text style={[styles.barValue, { color: palette.textSecondary }]}>
          {acted} of {saved}
        </Text>
      </View>
      <View style={[styles.barTrack, { backgroundColor: palette.emptyBg }]}>
        <View style={[styles.barFill, { backgroundColor: color, width: `${(saved / 20) * 100}%` }]}>
           <View style={[styles.barActive, { width: `${percentage}%`, backgroundColor: palette.completeTint }]} />
        </View>
      </View>
    </View>
  );
};

export const CategoryBarChart = ({ data }) => {
  const { palette, getCategoryBadge } = useTheme();
  
  const sorted = Object.entries(data).sort((a,b) => b[1].saved - a[1].saved);

  return (
    <View style={[styles.chartCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <Text style={[styles.chartTitle, { color: palette.textPrimary }]}>Category Breakdown</Text>
      <Text style={[styles.chartSubtitle, { color: palette.textSecondary }]}>
        Saved vs. Acted On per category
      </Text>
      
      {sorted.map(([name, stats]) => {
        const badge = getCategoryBadge(name);
        return (
          <ProgressBar 
            key={name}
            label={name}
            saved={stats.saved}
            acted={stats.acted}
            color={badge.text}
            palette={palette}
          />
        );
      })}
    </View>
  );
};

export const DebtGauge = ({ value }) => {
  const { palette } = useTheme();
  const radius = 60;
  const strokeWidth = 14;
  const normalizedValue = Math.min(Math.max(value, 0), 100);
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (normalizedValue / 100) * circumference;
  
  const gaugeColor = value > 50 ? palette.urgencyRed : value > 20 ? palette.urgencyAmber : palette.completeTint;

  return (
    <View style={[styles.gaugeContainer, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <Text style={[styles.chartTitle, { color: palette.textPrimary, marginBottom: SPACING.md }]}>
        Screenshot Debt
      </Text>
      
      <View style={styles.svgWrapper}>
        <Svg height={radius * 2 + strokeWidth} width={radius * 2 + strokeWidth}>
          <G rotation="-90" origin={`${radius + strokeWidth/2}, ${radius + strokeWidth/2}`}>
            <Circle
              cx={radius + strokeWidth / 2}
              cy={radius + strokeWidth / 2}
              r={radius}
              stroke={palette.emptyBg}
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            <Circle
              cx={radius + strokeWidth / 2}
              cy={radius + strokeWidth / 2}
              r={radius}
              stroke={gaugeColor}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
            />
          </G>
        </Svg>
        <View style={styles.gaugeTextWrapper}>
          <Text style={[styles.gaugeValue, { color: palette.textPrimary }]}>{value}</Text>
          <Text style={[styles.gaugeLabel, { color: palette.textSecondary }]}>Pending</Text>
        </View>
      </View>
      
      <Text style={[styles.gaugeDescription, { color: palette.textSecondary }]}>
        {value > 50 ? "Your backlog is getting critical!" : value > 20 ? "Steady accumulation." : "You're all caught up!"}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  chartCard: {
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  chartTitle: {
    ...TYPOGRAPHY.subtitle,
    fontWeight: '700',
  },
  chartSubtitle: {
    ...TYPOGRAPHY.tiny,
    marginBottom: SPACING.lg,
  },
  barContainer: {
    marginBottom: SPACING.md,
  },
  barHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  barLabel: {
    ...TYPOGRAPHY.bodyBold,
    fontSize: 13,
  },
  barValue: {
    ...TYPOGRAPHY.tiny,
  },
  barTrack: {
    height: 10,
    borderRadius: RADIUS.pill,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: RADIUS.pill,
    overflow: 'hidden',
    position: 'relative',
    opacity: 0.3,
  },
  barActive: {
    height: '100%',
    position: 'absolute',
    left: 0,
    top: 0,
    opacity: 1,
  },
  gaugeContainer: {
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    alignItems: 'center',
    flex: 1,
  },
  svgWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  gaugeTextWrapper: {
      position: 'absolute',
      alignItems: 'center',
  },
  gaugeValue: {
    ...TYPOGRAPHY.heroTitle,
    fontSize: 32,
    fontWeight: '800',
  },
  gaugeLabel: {
    ...TYPOGRAPHY.tiny,
    textTransform: 'uppercase',
  },
  gaugeDescription: {
    ...TYPOGRAPHY.tiny,
    textAlign: 'center',
    fontWeight: '600',
  }
});
