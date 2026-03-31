import { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AppNavigator from './src/navigation/AppNavigator';
import { QueueProvider } from './src/state/QueueContext';
import { registerBackgroundFetchAsync } from './src/services/backgroundTasks';

export default function App() {
  useEffect(() => {
    registerBackgroundFetchAsync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueueProvider>
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </QueueProvider>
    </GestureHandlerRootView>
  );
}
