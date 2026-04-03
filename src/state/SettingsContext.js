import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSetting, saveSetting, SETTINGS_KEYS } from '../services/settingsStorage';

const SettingsContext = createContext();

export const DEFAULT_SETTINGS = {
  aiMode: 'cloud',
  autoProcessingEnabled: true,
  wifiOnly: false,
  watchedFolderIds: [],
  exclusionRules: [],
  dailyDigestTime: '19:00',
  notificationConfig: {
    dailyDigest: true,
    reminders: true,
    insights: true,
    saleExpiry: true,
  },
  quietHours: {
    start: '23:00',
    end: '08:00',
  },
  autoArchiveDays: 30, // 0 = Never
};

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAllSettings();
  }, []);

  const loadAllSettings = async () => {
    setIsLoading(true);
    try {
      const loadedSettings = { ...DEFAULT_SETTINGS };
      
      // Map keys to settings object
      const keyMap = {
        [SETTINGS_KEYS.AI_MODE]: 'aiMode',
        [SETTINGS_KEYS.AUTO_PROCESSING_ENABLED]: 'autoProcessingEnabled',
        [SETTINGS_KEYS.WIFI_ONLY]: 'wifiOnly',
        [SETTINGS_KEYS.WATCHED_FOLDER_IDS]: 'watchedFolderIds',
        [SETTINGS_KEYS.EXCLUSION_RULES]: 'exclusionRules',
        [SETTINGS_KEYS.DAILY_DIGEST_TIME]: 'dailyDigestTime',
        [SETTINGS_KEYS.NOTIFICATION_CONFIG]: 'notificationConfig',
        [SETTINGS_KEYS.QUIET_HOURS]: 'quietHours',
        [SETTINGS_KEYS.AUTO_ARCHIVE_DAYS]: 'autoArchiveDays',
      };

      for (const [storageKey, stateKey] of Object.entries(keyMap)) {
        const val = await getSetting(storageKey, DEFAULT_SETTINGS[stateKey]);
        loadedSettings[stateKey] = val;
      }

      setSettings(loadedSettings);
    } catch (e) {
      console.error('[SettingsContext] Failed to load settings:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const updateSetting = async (key, value) => {
    // Determine storage key from state key
    const stateKeyToStorageKey = {
      aiMode: SETTINGS_KEYS.AI_MODE,
      autoProcessingEnabled: SETTINGS_KEYS.AUTO_PROCESSING_ENABLED,
      wifiOnly: SETTINGS_KEYS.WIFI_ONLY,
      watchedFolderIds: SETTINGS_KEYS.WATCHED_FOLDER_IDS,
      exclusionRules: SETTINGS_KEYS.EXCLUSION_RULES,
      dailyDigestTime: SETTINGS_KEYS.DAILY_DIGEST_TIME,
      notificationConfig: SETTINGS_KEYS.NOTIFICATION_CONFIG,
      quietHours: SETTINGS_KEYS.QUIET_HOURS,
      autoArchiveDays: SETTINGS_KEYS.AUTO_ARCHIVE_DAYS,
    };

    const storageKey = stateKeyToStorageKey[key];
    if (storageKey) {
      setSettings(prev => ({ ...prev, [key]: value }));
      await saveSetting(storageKey, value);
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, isLoading, reloadSettings: loadAllSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
