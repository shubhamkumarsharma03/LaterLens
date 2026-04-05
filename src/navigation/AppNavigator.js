/**
 * AppNavigator — Swipeable Bottom-Tab + Stack Navigator.
 *
 * Transitions from Bottom Tabs to Material Top Tabs (positioned at bottom)
 * to support horizontal swiping between main app sections.
 */

import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Home, FolderOpen, Sparkles, BarChart3 } from 'lucide-react-native';

import HomeQueueScreen from '../screens/home/HomeQueueScreen';
import ActionDetailScreen from '../screens/home/ActionDetailScreen';
import ProfileScreen from '../screens/common/ProfileScreen';
import AlbumPickerScreen from '../screens/common/AlbumPickerScreen';
import CollectionsScreen from '../screens/collections/CollectionsScreen';
import CollectionSearchScreen from '../screens/collections/CollectionSearchScreen';
import CollectionCategoryScreen from '../screens/collections/CollectionCategoryScreen';
import CollectionThreadScreen from '../screens/collections/CollectionThreadScreen';
import StudyQueueScreen from '../screens/collections/StudyQueueScreen';
import AskAIScreen from '../screens/askAI/AskAIScreen';
import AskAIChatScreen from '../screens/askAI/AskAIChatScreen';
import AskAIBoardScreen from '../screens/askAI/AskAIBoardScreen';
import InsightsScreen from '../screens/insights/InsightsScreen';
import InsightsStatsScreen from '../screens/insights/InsightsStatsScreen';
import InsightsStreakScreen from '../screens/insights/InsightsStreakScreen';
import {
  ASK_AI_ROUTES,
  COLLECTION_ROUTES,
  HOME_ROUTES,
  INSIGHTS_ROUTES,
  ROOT_STACK,
} from './routeNames';
import { useTheme } from '../theme/useTheme';
import { useQueue } from '../state/QueueContext';
import { OnboardingProvider, useOnboarding } from '../state/OnboardingContext';
import OnboardingNavigator from './OnboardingNavigator';

const Stack = createNativeStackNavigator();
const Tab = createMaterialTopTabNavigator();
const HomeStack = createNativeStackNavigator();
const CollectionsStack = createNativeStackNavigator();
const AskAIStack = createNativeStackNavigator();
const InsightsStack = createNativeStackNavigator();

// ─── Stack navigators ────────────────────────────────────────

function HomeStackNavigator() {
  const { palette } = useTheme();
  return (
    <HomeStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: palette.background },
        headerTintColor: palette.textPrimary,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: palette.background },
      }}
    >
      <HomeStack.Screen name={HOME_ROUTES.QUEUE} component={HomeQueueScreen} options={{ headerShown: false }} />
      <HomeStack.Screen name={HOME_ROUTES.DETAIL} component={ActionDetailScreen} options={{ title: 'Action Detail' }} />
      <HomeStack.Screen name={HOME_ROUTES.PROFILE} component={ProfileScreen} options={{ title: 'Profile' }} />
      <HomeStack.Screen name={HOME_ROUTES.ALBUM_PICKER} component={AlbumPickerScreen} options={{ title: 'Select Folder' }} />
    </HomeStack.Navigator>
  );
}

function CollectionsStackNavigator() {
  const { palette } = useTheme();
  return (
    <CollectionsStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: palette.background },
        headerTintColor: palette.textPrimary,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <CollectionsStack.Screen name={COLLECTION_ROUTES.HOME} component={CollectionsScreen} options={{ headerShown: false }} />
      <CollectionsStack.Screen name={COLLECTION_ROUTES.SEARCH} component={CollectionSearchScreen} options={{ title: 'Search' }} />
      <CollectionsStack.Screen name={COLLECTION_ROUTES.CATEGORY} component={CollectionCategoryScreen} options={{ title: 'Category' }} />
      <CollectionsStack.Screen name={COLLECTION_ROUTES.THREAD} component={CollectionThreadScreen} options={{ title: 'Thread' }} />
      <CollectionsStack.Screen name={COLLECTION_ROUTES.STUDY_QUEUE} component={StudyQueueScreen} options={{ title: 'Study Queue' }} />
    </CollectionsStack.Navigator>
  );
}

function AskAIStackNavigator() {
  const { palette } = useTheme();
  return (
    <AskAIStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: palette.background },
        headerTintColor: palette.textPrimary,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <AskAIStack.Screen name={ASK_AI_ROUTES.HOME} component={AskAIScreen} options={{ headerShown: false }} />
      <AskAIStack.Screen name={ASK_AI_ROUTES.CHAT} component={AskAIChatScreen} options={{ title: 'Chat' }} />
      <AskAIStack.Screen name={ASK_AI_ROUTES.BOARD} component={AskAIBoardScreen} options={{ title: 'Board' }} />
    </AskAIStack.Navigator>
  );
}

function InsightsStackNavigator() {
  const { palette } = useTheme();
  return (
    <InsightsStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: palette.background },
        headerTintColor: palette.textPrimary,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <InsightsStack.Screen name={INSIGHTS_ROUTES.HOME} component={InsightsScreen} options={{ headerShown: false }} />
      <InsightsStack.Screen name={INSIGHTS_ROUTES.STATS} component={InsightsStatsScreen} options={{ title: 'Stats' }} />
      <InsightsStack.Screen name={INSIGHTS_ROUTES.STREAK} component={InsightsStreakScreen} options={{ title: 'Streak' }} />
    </InsightsStack.Navigator>
  );
}

// ─── Custom Tab Bar Components ────────────────────────────────

const TAB_ICONS = {
  Home,
  Collections: FolderOpen,
  'Ask AI': Sparkles,
  Insights: BarChart3,
};

function TabIconWithBadge({ name, color, size, badge }) {
  const Icon = TAB_ICONS[name];
  const { palette } = useTheme();
  
  return (
    <View style={styles.iconContainer}>
      <Icon size={size - 2} color={color} strokeWidth={1.8} />
      {badge && (
        <View style={[styles.badge, { backgroundColor: palette.urgencyRed }]}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
    </View>
  );
}

function MainTabNavigator() {
  const { palette, isDark } = useTheme();
  const { queueItems } = useQueue();

  const homeBadge = queueItems.filter((i) => !i.viewed).length;
  const isMonday = new Date().getDay() === 1;
  const insightsBadge = isMonday ? '!' : null;

  return (
    <Tab.Navigator
      tabBarPosition="bottom"
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: palette.tabBarActive,
        tabBarInactiveTintColor: palette.tabBarInactive,
        tabBarIndicatorStyle: { height: 0 }, // Hide top tab indicator
        tabBarPressColor: 'transparent',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          textTransform: 'none',
          marginTop: -2,
        },
        tabBarStyle: {
          height: 80,
          backgroundColor: palette.tabBarBackground,
          borderTopColor: palette.tabBarBorder,
          borderTopWidth: isDark ? 1 : StyleSheet.hairlineWidth,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarIcon: ({ color, focused }) => {
          let badge = null;
          if (route.name === 'Home') badge = homeBadge > 0 ? homeBadge : null;
          if (route.name === 'Insights') badge = insightsBadge;
          
          return <TabIconWithBadge name={route.name} color={color} size={24} badge={badge} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeStackNavigator} />
      <Tab.Screen name="Collections" component={CollectionsStackNavigator} />
      <Tab.Screen name="Ask AI" component={AskAIStackNavigator} />
      <Tab.Screen name="Insights" component={InsightsStackNavigator} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: '900',
  },
});

function AppNavigatorContent() {
  const { hasCompletedOnboarding, isLoading, palette } = useOnboarding();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: palette?.background || '#fff' }}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {hasCompletedOnboarding ? (
        <Stack.Screen name={ROOT_STACK.MAIN_TABS} component={MainTabNavigator} />
      ) : (
        <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
      )}
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <OnboardingProvider>
      <AppNavigatorContent />
    </OnboardingProvider>
  );
}
