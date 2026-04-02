import { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider } from './src/state/AuthContext';
import { QueueProvider } from './src/state/QueueContext';
import { ChatProvider } from './src/state/ChatContext';
import { registerBackgroundFetchAsync } from './src/services/backgroundTasks';

export default function App() {
  useEffect(() => {
    registerBackgroundFetchAsync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <QueueProvider>
          <ChatProvider>
            <NavigationContainer>
              <AppNavigator />
            </NavigationContainer>
          </ChatProvider>
        </QueueProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
