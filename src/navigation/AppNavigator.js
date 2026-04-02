/**
 * AppNavigator — Themed bottom-tab + stack navigator.
 *
 * Uses the LaterLens design system for all chrome:
 *   - Tab bar colours, active tint, background
 *   - Stack header styling (blurred translucent on iOS)
 *   - lucide-react-native icons
 */

import { StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Home, FolderOpen, Sparkles, BarChart3 } from 'lucide-react-native';

import HomeQueueScreen from '../screens/home/HomeQueueScreen';
import ActionDetailScreen from '../screens/home/ActionDetailScreen';
import ProfileScreen from '../screens/common/ProfileScreen';
import CollectionsScreen from '../screens/collections/CollectionsScreen';
import CollectionSearchScreen from '../screens/collections/CollectionSearchScreen';
import CollectionCategoryScreen from '../screens/collections/CollectionCategoryScreen';
import CollectionThreadScreen from '../screens/collections/CollectionThreadScreen';
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
import { RADIUS } from '../theme/colors';
import OnboardingNavigator from './OnboardingNavigator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect } from 'react';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator();
const CollectionsStack = createNativeStackNavigator();
const AskAIStack = createNativeStackNavigator();
const InsightsStack = createNativeStackNavigator();

// ─── Stack navigators ────────────────────────────────────────

function HomeStackNavigator() {
  const { palette, isDark } = useTheme();

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
      <HomeStack.Screen
        name={HOME_ROUTES.QUEUE}
        component={HomeQueueScreen}
        options={{ headerShown: false }}
      />
      <HomeStack.Screen
        name={HOME_ROUTES.DETAIL}
        component={ActionDetailScreen}
        options={{ title: 'Action Detail' }}
      />
      <HomeStack.Screen
        name={HOME_ROUTES.PROFILE}
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
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
      <CollectionsStack.Screen
        name={COLLECTION_ROUTES.HOME}
        component={CollectionsScreen}
        options={{ title: 'Collections' }}
      />
      <CollectionsStack.Screen
        name={COLLECTION_ROUTES.SEARCH}
        component={CollectionSearchScreen}
        options={{ title: 'Search' }}
      />
      <CollectionsStack.Screen
        name={COLLECTION_ROUTES.CATEGORY}
        component={CollectionCategoryScreen}
        options={{ title: 'Category' }}
      />
      <CollectionsStack.Screen
        name={COLLECTION_ROUTES.THREAD}
        component={CollectionThreadScreen}
        options={{ title: 'Thread' }}
      />
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
      <AskAIStack.Screen
        name={ASK_AI_ROUTES.HOME}
        component={AskAIScreen}
        options={{ title: 'Ask AI' }}
      />
      <AskAIStack.Screen
        name={ASK_AI_ROUTES.CHAT}
        component={AskAIChatScreen}
        options={{ title: 'Chat' }}
      />
      <AskAIStack.Screen
        name={ASK_AI_ROUTES.BOARD}
        component={AskAIBoardScreen}
        options={{ title: 'Board' }}
      />
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
      <InsightsStack.Screen
        name={INSIGHTS_ROUTES.HOME}
        component={InsightsScreen}
        options={{ title: 'Insights' }}
      />
      <InsightsStack.Screen
        name={INSIGHTS_ROUTES.STATS}
        component={InsightsStatsScreen}
        options={{ title: 'Stats' }}
      />
      <InsightsStack.Screen
        name={INSIGHTS_ROUTES.STREAK}
        component={InsightsStreakScreen}
        options={{ title: 'Streak' }}
      />
    </InsightsStack.Navigator>
  );
}

// ─── Tab icon map ────────────────────────────────────────────

import { useQueue } from '../state/QueueContext';

const TAB_ICONS = {
  Home,
  Collections: FolderOpen,
  'Ask AI': Sparkles,
  Insights: BarChart3,
};

function MainTabNavigator() {
  const { palette, isDark } = useTheme();
  const { queueItems, allItems } = useQueue();

  const homeBadge = queueItems.length > 0 ? queueItems.length : null;
  const newItems = allItems.filter(i => i.status === 'queued' || i.status === 'snoozed').length;
  const collectionsBadge = newItems > 0 ? newItems : null;
  const isMonday = new Date().getDay() === 1;
  const insightsBadge = isMonday ? '!' : null;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: palette.tabBarActive,
        tabBarInactiveTintColor: palette.tabBarInactive,
        tabBarStyle: {
          height: 68,
          paddingBottom: 10,
          paddingTop: 8,
          backgroundColor: palette.tabBarBackground,
          borderTopColor: palette.tabBarBorder,
          borderTopWidth: isDark ? 1 : StyleSheet.hairlineWidth,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.2,
        },
        tabBarIcon: ({ color, size }) => {
          const Icon = TAB_ICONS[route.name];
          return Icon ? <Icon size={size - 2} color={color} strokeWidth={1.8} /> : null;
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeStackNavigator} 
        options={{ tabBarBadge: homeBadge }}
      />
      <Tab.Screen 
        name="Collections" 
        component={CollectionsStackNavigator} 
        options={{ tabBarBadge: collectionsBadge }}
      />
      <Tab.Screen name="Ask AI" component={AskAIStackNavigator} />
      <Tab.Screen 
        name="Insights" 
        component={InsightsStackNavigator} 
        options={{ tabBarBadge: insightsBadge }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const [isLoading, setIsLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(true);

  useEffect(() => {
    checkOnboarding();
  }, []);

  const checkOnboarding = async () => {
    try {
      const value = await AsyncStorage.getItem('hasCompletedOnboarding');
      if (value === 'true') {
        setShowOnboarding(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) return null; // Or a splash screen

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {showOnboarding ? (
        <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
      ) : (
        <Stack.Screen name={ROOT_STACK.MAIN_TABS} component={MainTabNavigator} />
      )}
    </Stack.Navigator>
  );
}


