import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const OnboardingContext = createContext();

export const OnboardingProvider = ({ children }) => {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [onboardingData, setOnboardingData] = useState({
    digestTime: 'Evening (9pm)',
    aiMode: 'On-device',
    personas: ['Researcher'],
  });

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    try {
      const status = await AsyncStorage.getItem('hasCompletedOnboarding');
      const savedData = await AsyncStorage.getItem('onboarding_preferences');
      
      if (status === 'true') {
        setHasCompletedOnboarding(true);
      }
      
      if (savedData) {
        setOnboardingData(JSON.parse(savedData));
      }
    } catch (e) {
      console.error('[OnboardingContext] Error loading status:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const completeOnboarding = async (data) => {
    try {
      await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
      if (data) {
        await AsyncStorage.setItem('onboarding_preferences', JSON.stringify(data));
        setOnboardingData(data);
      }
      setHasCompletedOnboarding(true);
    } catch (e) {
      console.error('[OnboardingContext] Error saving completion:', e);
    }
  };

  const resetOnboarding = async () => {
    try {
      await AsyncStorage.removeItem('hasCompletedOnboarding');
      setHasCompletedOnboarding(false);
    } catch (e) {
      console.error('[OnboardingContext] Error resetting:', e);
    }
  };

  return (
    <OnboardingContext.Provider
      value={{
        hasCompletedOnboarding,
        isLoading,
        onboardingData,
        completeOnboarding,
        resetOnboarding,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
};
