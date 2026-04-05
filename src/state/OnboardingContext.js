import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LEGACY_STORAGE_KEYS, STORAGE_KEYS } from '../constants/storageKeys';

const OnboardingContext = createContext();

const ONBOARDING_COMPLETED_KEY = STORAGE_KEYS.ONBOARDING_COMPLETED;
const ONBOARDING_PREFERENCES_KEY = STORAGE_KEYS.ONBOARDING_PREFERENCES;

async function getWithLegacyMigration(primaryKey, legacyKeys = []) {
  const currentRaw = await AsyncStorage.getItem(primaryKey);
  if (currentRaw !== null) {
    return currentRaw;
  }

  for (const legacyKey of legacyKeys) {
    const legacyRaw = await AsyncStorage.getItem(legacyKey);
    if (legacyRaw !== null) {
      await AsyncStorage.setItem(primaryKey, legacyRaw);
      return legacyRaw;
    }
  }

  return null;
}

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
      const status = await getWithLegacyMigration(
        ONBOARDING_COMPLETED_KEY,
        LEGACY_STORAGE_KEYS.ONBOARDING_COMPLETED || []
      );
      const savedData = await getWithLegacyMigration(
        ONBOARDING_PREFERENCES_KEY,
        LEGACY_STORAGE_KEYS.ONBOARDING_PREFERENCES || []
      );
      
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
      await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
      if (data) {
        await AsyncStorage.setItem(ONBOARDING_PREFERENCES_KEY, JSON.stringify(data));
        setOnboardingData(data);
      }
      setHasCompletedOnboarding(true);
    } catch (e) {
      console.error('[OnboardingContext] Error saving completion:', e);
    }
  };

  const resetOnboarding = async () => {
    try {
      await AsyncStorage.removeItem(ONBOARDING_COMPLETED_KEY);
      for (const legacyKey of LEGACY_STORAGE_KEYS.ONBOARDING_COMPLETED || []) {
        await AsyncStorage.removeItem(legacyKey);
      }
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
