import { useEffect } from 'react';
import { AppState } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider } from './src/state/AuthContext';
import { SettingsProvider } from './src/state/SettingsContext';
import { QueueProvider } from './src/state/QueueContext';
import { ChatProvider } from './src/state/ChatContext';
import { registerBackgroundFetchAsync } from './src/services/backgroundTasks';
import {
  ensureNotificationChannels,
  reRegisterDailyDigestIfMissing,
  requestNotificationPermissions,
} from './src/services/notificationService';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  useEffect(() => {
    // 1. Register Background Tasks
    registerBackgroundFetchAsync();

    // 2. Setup notification channels + permissions and verify digest schedule.
    async function setupNotifications() {
      await ensureNotificationChannels();

      if (Device.isDevice) {
        const finalStatus = await requestNotificationPermissions();
        if (finalStatus !== 'granted') {
          console.log('[App] Failed to get push token for notification!');
        }
      }

      await reRegisterDailyDigestIfMissing();
    }

    setupNotifications();

    // Re-verify daily digest registration whenever app returns to foreground.
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        reRegisterDailyDigestIfMissing().catch((error) => {
          console.error('[App] Failed to re-register daily digest on foreground:', error);
        });
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <SettingsProvider>
          <QueueProvider>
            <ChatProvider>
              <NavigationContainer>
                <AppNavigator />
              </NavigationContainer>
            </ChatProvider>
          </QueueProvider>
        </SettingsProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
