/**
 * LaterLens Design System — Theme Tokens
 *
 * 8pt grid spacing · SF Pro / Inter typography
 * Light + Dark palettes with category-semantic badge colours
 */

// ─── Palette Primitives ───────────────────────────────────────

const LIGHT = {
  background: '#F9FAFB',
  card: '#FFFFFF',
  primary: '#6366F1',
  primaryLight: '#EEF2FF',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
  /** Card shadow (light only) */
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  /** StatusBar style */
  statusBar: 'dark',
  tabBarActive: '#6366F1',
  tabBarInactive: '#9CA3AF',
  tabBarBackground: '#FFFFFF',
  tabBarBorder: '#E5E7EB',
  /** Quick-action tints */
  completeTint: '#059669',
  completeBg: '#ECFDF5',
  snoozeTint: '#D97706',
  snoozeBg: '#FFFBEB',
  archiveTint: '#6B7280',
  archiveBg: '#F3F4F6',
  /** Swipe actions */
  swipeComplete: '#059669',
  swipeArchive: '#6B7280',
  /** Loading / processing overlay */
  overlayBg: 'rgba(255,255,255,0.85)',
  /** Empty state */
  emptyBg: '#FFFFFF',
  /** Avatar */
  avatarBg: '#EEF2FF',
  avatarText: '#6366F1',
  /** Processing banner */
  processingBg: '#EEF2FF',
  processingBorder: '#C7D2FE',
  processingText: '#4338CA',
  /** Undo toast */
  toastBg: '#1F2937',
  toastText: '#FFFFFF',
  toastAction: '#818CF8',
  /** Urgency */
  urgencyAmber: '#D97706',
  urgencyAmberBg: '#FFFBEB',
  urgencyRed: '#DC2626',
  urgencyRedBg: '#FEF2F2',
  /** Older items fold */
  foldBg: '#F3F4F6',
  foldText: '#6B7280',
};

const DARK = {
  background: '#0F172A',
  card: '#1E293B',
  primary: '#818CF8',
  primaryLight: '#1E1B4B',
  textPrimary: '#F8FAFC',
  textSecondary: '#9CA3AF',
  border: '#334155',
  /** Card border (dark only — no shadows) */
  cardBorder: {
    borderWidth: 1,
    borderColor: '#334155',
  },
  statusBar: 'light',
  tabBarActive: '#818CF8',
  tabBarInactive: '#64748B',
  tabBarBackground: '#1E293B',
  tabBarBorder: '#334155',
  completeTint: '#34D399',
  completeBg: 'rgba(52,211,153,0.12)',
  snoozeTint: '#FBBF24',
  snoozeBg: 'rgba(251,191,36,0.12)',
  archiveTint: '#94A3B8',
  archiveBg: 'rgba(148,163,184,0.08)',
  swipeComplete: '#059669',
  swipeArchive: '#475569',
  overlayBg: 'rgba(15,23,42,0.85)',
  emptyBg: '#1E293B',
  avatarBg: 'rgba(129,140,248,0.15)',
  avatarText: '#818CF8',
  processingBg: 'rgba(129,140,248,0.12)',
  processingBorder: 'rgba(129,140,248,0.25)',
  processingText: '#A5B4FC',
  toastBg: '#334155',
  toastText: '#F8FAFC',
  toastAction: '#818CF8',
  urgencyAmber: '#FBBF24',
  urgencyAmberBg: 'rgba(251,191,36,0.14)',
  urgencyRed: '#F87171',
  urgencyRedBg: 'rgba(248,113,113,0.14)',
  foldBg: '#1E293B',
  foldText: '#94A3B8',
};

// ─── Category Badge Colours (updated per spec) ────────────────

const CATEGORY_BADGES = {
  light: {
    Shopping: { bg: '#ECFDF5', text: '#065F46' },
    Product: { bg: '#ECFDF5', text: '#065F46' },
    Study: { bg: '#EFF6FF', text: '#1E40AF' },
    'Study material': { bg: '#EFF6FF', text: '#1E40AF' },
    'Project idea': { bg: '#F5F3FF', text: '#5B21B6' },
    Idea: { bg: '#FEF3C7', text: '#92400E' },
    Place: { bg: '#FFFBEB', text: '#92400E' },
    Event: { bg: '#FDF2F8', text: '#9D174D' },
    Person: { bg: '#FDF2F8', text: '#831843' },
    Receipt: { bg: '#F5F3FF', text: '#5B21B6' },
    Ticket: { bg: '#FDF2F8', text: '#9D174D' },
    Code: { bg: '#F0FDF4', text: '#166534' },
    default: { bg: '#EEF2FF', text: '#4338CA' },
  },
  dark: {
    Shopping: { bg: 'rgba(16,185,129,0.14)', text: '#6EE7B7' },
    Product: { bg: 'rgba(16,185,129,0.14)', text: '#6EE7B7' },
    Study: { bg: 'rgba(59,130,246,0.14)', text: '#93C5FD' },
    'Study material': { bg: 'rgba(59,130,246,0.14)', text: '#93C5FD' },
    'Project idea': { bg: 'rgba(139,92,246,0.14)', text: '#C4B5FD' },
    Idea: { bg: 'rgba(245,158,11,0.14)', text: '#FCD34D' },
    Place: { bg: 'rgba(245,158,11,0.14)', text: '#FCD34D' },
    Event: { bg: 'rgba(236,72,153,0.14)', text: '#F9A8D4' },
    Person: { bg: 'rgba(236,72,153,0.14)', text: '#F9A8D4' },
    Receipt: { bg: 'rgba(139,92,246,0.14)', text: '#C4B5FD' },
    Ticket: { bg: 'rgba(236,72,153,0.14)', text: '#F9A8D4' },
    Code: { bg: 'rgba(34,197,94,0.14)', text: '#86EFAC' },
    default: { bg: 'rgba(129,140,248,0.14)', text: '#A5B4FC' },
  },
};

function getCategoryBadge(category, isDark) {
  const palette = isDark ? CATEGORY_BADGES.dark : CATEGORY_BADGES.light;
  return palette[category] || palette.default;
}

// ─── Typography ───────────────────────────────────────────────

const TYPOGRAPHY = {
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 28,
  },
  subtitle: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 22,
  },
  body: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
  },
  bodyBold: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  caption: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  tiny: {
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 16,
  },
  badgeLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    lineHeight: 14,
  },
  buttonLabel: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
    lineHeight: 20,
  },
};

// ─── Spacing (8pt grid) ──────────────────────────────────────

const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

// ─── Radii ────────────────────────────────────────────────────

const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
};

// ─── Export ───────────────────────────────────────────────────

export { LIGHT, DARK, TYPOGRAPHY, SPACING, RADIUS, CATEGORY_BADGES, getCategoryBadge };
