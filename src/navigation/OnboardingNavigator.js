import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ONBOARDING_ROUTES } from './routeNames';
import WelcomeScreen from '../screens/onboarding/WelcomeScreen';
import PermissionsScreen from '../screens/onboarding/PermissionsScreen';
import PreferencesScreen from '../screens/onboarding/PreferencesScreen';
import { useTheme } from '../theme/useTheme';

const Stack = createNativeStackNavigator();

export default function OnboardingNavigator() {
  const { palette } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: palette.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name={ONBOARDING_ROUTES.WELCOME} component={WelcomeScreen} />
      <Stack.Screen name={ONBOARDING_ROUTES.PERMISSIONS} component={PermissionsScreen} />
      <Stack.Screen name={ONBOARDING_ROUTES.PREFERENCES} component={PreferencesScreen} />
    </Stack.Navigator>
  );
}
