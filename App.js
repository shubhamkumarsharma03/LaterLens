import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AppNavigator from './src/navigation/AppNavigator';
import { QueueProvider } from './src/state/QueueContext';

export default function App() {
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
