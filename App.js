import { useEffect } from 'react';
import { Platform } from 'react-native';
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

    // 2. Setup Notifications for Android & Request Permissions
    async function setupNotifications() {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'LaterLens Alerts',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#6366F1',
        });
      }

      if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') {
          console.log('[App] Failed to get push token for notification!');
        }
      }
    }

    setupNotifications();
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
