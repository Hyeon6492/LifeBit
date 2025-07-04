import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type FontSize = 'small' | 'normal' | 'large';
export type ColorScheme = 'default' | 'blue' | 'green' | 'purple' | 'orange';

interface ThemeSettings {
  themeMode: ThemeMode;
  fontSize: FontSize;
  colorScheme: ColorScheme;
  highContrast: boolean;
  reduceMotion: boolean;
}

interface ThemeContextType {
  // 현재 적용된 설정
  themeMode: ThemeMode;
  fontSize: FontSize;
  colorScheme: ColorScheme;
  isDarkMode: boolean;
  highContrast: boolean;
  reduceMotion: boolean;
  
  // 임시 설정 (저장 전)
  tempSettings: ThemeSettings;
  hasUnsavedChanges: boolean;
  
  // 설정 함수들
  setThemeMode: (mode: ThemeMode) => void;
  setFontSize: (size: FontSize) => void;
  setColorScheme: (scheme: ColorScheme) => void;
  setHighContrast: (enabled: boolean) => void;
  setReduceMotion: (enabled: boolean) => void;
  
  // 저장/취소 함수들
  saveSettings: () => void;
  cancelSettings: () => void;
  resetToDefaults: () => void;
  
  // 다크모드 토글 (즉시 적용)
  toggleDarkMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

// 기본 설정값
const DEFAULT_SETTINGS: ThemeSettings = {
  themeMode: 'system',
  fontSize: 'normal',
  colorScheme: 'default',
  highContrast: false,
  reduceMotion: false,
};

// 로컬 스토리지에서 설정 로드
const loadSettingsFromStorage = (): ThemeSettings => {
  try {
    const saved = localStorage.getItem('themeSettings');
    if (saved) {
      const parsed = JSON.parse(saved);
      // 필수값 누락 시 기본값으로 보완
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        fontSize: ['small', 'normal', 'large'].includes(parsed.fontSize) ? parsed.fontSize : DEFAULT_SETTINGS.fontSize,
        themeMode: ['light', 'dark', 'system'].includes(parsed.themeMode) ? parsed.themeMode : DEFAULT_SETTINGS.themeMode,
        colorScheme: ['default', 'blue', 'green', 'purple', 'orange'].includes(parsed.colorScheme) ? parsed.colorScheme : DEFAULT_SETTINGS.colorScheme,
        highContrast: typeof parsed.highContrast === 'boolean' ? parsed.highContrast : DEFAULT_SETTINGS.highContrast,
        reduceMotion: typeof parsed.reduceMotion === 'boolean' ? parsed.reduceMotion : DEFAULT_SETTINGS.reduceMotion,
      };
    }
  } catch (error) {
    console.error('Failed to load theme settings from storage:', error);
  }
  return { ...DEFAULT_SETTINGS };
};

// 설정을 로컬 스토리지에 저장
const saveSettingsToStorage = (settings: ThemeSettings) => {
  try {
    localStorage.setItem('themeSettings', JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save theme settings to storage:', error);
  }
};

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  // 저장된 설정 로드
  const [savedSettings, setSavedSettings] = useState<ThemeSettings>(loadSettingsFromStorage);
  
  // 임시 설정 (저장 전)
  const [tempSettings, setTempSettings] = useState<ThemeSettings>({ ...savedSettings });
  
  // 현재 적용된 설정
  const [currentSettings, setCurrentSettings] = useState<ThemeSettings>({ ...savedSettings });
  
  const [isDarkMode, setIsDarkMode] = useState(false);

  // 설정이 변경되었는지 확인
  const hasUnsavedChanges = JSON.stringify(tempSettings) !== JSON.stringify(savedSettings);

  // 시스템 테마 감지
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = () => {
      if (currentSettings.themeMode === 'system') {
        setIsDarkMode(mediaQuery.matches);
        applyTheme(mediaQuery.matches);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [currentSettings.themeMode]);

  // 테마 적용 함수
  const applyTheme = (dark: boolean) => {
    if (dark) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
    setIsDarkMode(dark);
  };

  // 설정 적용 함수
  const applySettings = (settings: ThemeSettings) => {
    // 테마 모드 적용
    if (settings.themeMode === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      applyTheme(isDark);
    } else {
      applyTheme(settings.themeMode === 'dark');
    }

    // 폰트 크기 적용
    const root = document.documentElement;
    switch (settings.fontSize) {
      case 'small':
        root.style.setProperty('--font-size-xs', '12px');
        root.style.setProperty('--font-size-sm', '14px');
        root.style.setProperty('--font-size-base', '16px');
        root.style.setProperty('--font-size-lg', '18px');
        root.style.setProperty('--font-size-xl', '20px');
        root.style.setProperty('--font-size-2xl', '22px');
        root.style.setProperty('--font-size-3xl', '24px');
        root.style.setProperty('--font-size-4xl', '26px');
        root.style.setProperty('--font-size-5xl', '30px');
        root.style.setProperty('--font-size-6xl', '36px');
        break;
      case 'normal':
        root.style.setProperty('--font-size-xs', '14px');
        root.style.setProperty('--font-size-sm', '16px');
        root.style.setProperty('--font-size-base', '21px');
        root.style.setProperty('--font-size-lg', '24px');
        root.style.setProperty('--font-size-xl', '28px');
        root.style.setProperty('--font-size-2xl', '32px');
        root.style.setProperty('--font-size-3xl', '36px');
        root.style.setProperty('--font-size-4xl', '40px');
        root.style.setProperty('--font-size-5xl', '48px');
        root.style.setProperty('--font-size-6xl', '60px');
        break;
      case 'large':
        root.style.setProperty('--font-size-xs', '18px');
        root.style.setProperty('--font-size-sm', '20px');
        root.style.setProperty('--font-size-base', '30px');
        root.style.setProperty('--font-size-lg', '34px');
        root.style.setProperty('--font-size-xl', '38px');
        root.style.setProperty('--font-size-2xl', '42px');
        root.style.setProperty('--font-size-3xl', '46px');
        root.style.setProperty('--font-size-4xl', '50px');
        root.style.setProperty('--font-size-5xl', '58px');
        root.style.setProperty('--font-size-6xl', '70px');
        break;
    }

    // 컬러 스킴 적용
    if (settings.colorScheme === 'default') {
      root.removeAttribute('data-color-scheme');
    } else {
      root.setAttribute('data-color-scheme', settings.colorScheme);
    }

    // 접근성 설정 적용
    if (settings.highContrast) {
      root.setAttribute('data-high-contrast', 'true');
    } else {
      root.removeAttribute('data-high-contrast');
    }

    if (settings.reduceMotion) {
      root.setAttribute('data-reduce-motion', 'true');
    } else {
      root.removeAttribute('data-reduce-motion');
    }
  };

  // 임시 설정 변경 함수들
  const setThemeMode = (mode: ThemeMode) => {
    setTempSettings(prev => ({ ...prev, themeMode: mode }));
  };

  const setFontSize = (size: FontSize) => {
    setTempSettings(prev => ({ ...prev, fontSize: size }));
    
    // 즉시 CSS 변수 업데이트 (미리보기)
    const root = document.documentElement;
    switch (size) {
      case 'small':
        root.style.setProperty('--font-size-xs', '12px');
        root.style.setProperty('--font-size-sm', '14px');
        root.style.setProperty('--font-size-base', '16px');
        root.style.setProperty('--font-size-lg', '18px');
        root.style.setProperty('--font-size-xl', '20px');
        root.style.setProperty('--font-size-2xl', '22px');
        root.style.setProperty('--font-size-3xl', '24px');
        root.style.setProperty('--font-size-4xl', '26px');
        root.style.setProperty('--font-size-5xl', '30px');
        root.style.setProperty('--font-size-6xl', '36px');
        break;
      case 'normal':
        root.style.setProperty('--font-size-xs', '14px');
        root.style.setProperty('--font-size-sm', '16px');
        root.style.setProperty('--font-size-base', '21px');
        root.style.setProperty('--font-size-lg', '24px');
        root.style.setProperty('--font-size-xl', '28px');
        root.style.setProperty('--font-size-2xl', '32px');
        root.style.setProperty('--font-size-3xl', '36px');
        root.style.setProperty('--font-size-4xl', '40px');
        root.style.setProperty('--font-size-5xl', '48px');
        root.style.setProperty('--font-size-6xl', '60px');
        break;
      case 'large':
        root.style.setProperty('--font-size-xs', '18px');
        root.style.setProperty('--font-size-sm', '20px');
        root.style.setProperty('--font-size-base', '30px');
        root.style.setProperty('--font-size-lg', '34px');
        root.style.setProperty('--font-size-xl', '38px');
        root.style.setProperty('--font-size-2xl', '42px');
        root.style.setProperty('--font-size-3xl', '46px');
        root.style.setProperty('--font-size-4xl', '50px');
        root.style.setProperty('--font-size-5xl', '58px');
        root.style.setProperty('--font-size-6xl', '70px');
        break;
    }
  };

  const setColorScheme = (scheme: ColorScheme) => {
    setTempSettings(prev => ({ ...prev, colorScheme: scheme }));
  };

  const setHighContrast = (enabled: boolean) => {
    setTempSettings(prev => ({ ...prev, highContrast: enabled }));
  };

  const setReduceMotion = (enabled: boolean) => {
    setTempSettings(prev => ({ ...prev, reduceMotion: enabled }));
  };

  // 설정 저장
  const saveSettings = () => {
    setSavedSettings(tempSettings);
    setCurrentSettings(tempSettings);
    saveSettingsToStorage(tempSettings);
  };

  // 설정 취소
  const cancelSettings = () => {
    setTempSettings(savedSettings);
    // 폰트 크기도 원래 설정으로 되돌리기
    const root = document.documentElement;
    switch (savedSettings.fontSize) {
      case 'small':
        root.style.setProperty('--font-size-xs', '12px');
        root.style.setProperty('--font-size-sm', '14px');
        root.style.setProperty('--font-size-base', '16px');
        root.style.setProperty('--font-size-lg', '18px');
        root.style.setProperty('--font-size-xl', '20px');
        root.style.setProperty('--font-size-2xl', '22px');
        root.style.setProperty('--font-size-3xl', '24px');
        root.style.setProperty('--font-size-4xl', '26px');
        root.style.setProperty('--font-size-5xl', '30px');
        root.style.setProperty('--font-size-6xl', '36px');
        break;
      case 'normal':
        root.style.setProperty('--font-size-xs', '14px');
        root.style.setProperty('--font-size-sm', '16px');
        root.style.setProperty('--font-size-base', '21px');
        root.style.setProperty('--font-size-lg', '24px');
        root.style.setProperty('--font-size-xl', '28px');
        root.style.setProperty('--font-size-2xl', '32px');
        root.style.setProperty('--font-size-3xl', '36px');
        root.style.setProperty('--font-size-4xl', '40px');
        root.style.setProperty('--font-size-5xl', '48px');
        root.style.setProperty('--font-size-6xl', '60px');
        break;
      case 'large':
        root.style.setProperty('--font-size-xs', '18px');
        root.style.setProperty('--font-size-sm', '20px');
        root.style.setProperty('--font-size-base', '30px');
        root.style.setProperty('--font-size-lg', '34px');
        root.style.setProperty('--font-size-xl', '38px');
        root.style.setProperty('--font-size-2xl', '42px');
        root.style.setProperty('--font-size-3xl', '46px');
        root.style.setProperty('--font-size-4xl', '50px');
        root.style.setProperty('--font-size-5xl', '58px');
        root.style.setProperty('--font-size-6xl', '70px');
        break;
    }
  };

  // 기본값으로 초기화
  const resetToDefaults = () => {
    setTempSettings(DEFAULT_SETTINGS);
  };

  // 다크모드 토글 (즉시 적용)
  const toggleDarkMode = () => {
    const newMode: ThemeMode = isDarkMode ? 'light' : 'dark';
    // 기존 savedSettings에서 themeMode만 바꿔서 저장
    const newSettings = { ...savedSettings, themeMode: newMode };
    setSavedSettings(newSettings);
    setCurrentSettings(newSettings);
    setTempSettings(newSettings);
    saveSettingsToStorage(newSettings);
    // 테마만 즉시 적용
    applyTheme(newMode === 'dark');
  };

  // 초기 설정 적용
  useEffect(() => {
    applySettings(currentSettings);
  }, [currentSettings]);

  // 임시 설정 미리보기
  useEffect(() => {
    applySettings(tempSettings);
  }, [tempSettings]);

  const value: ThemeContextType = {
    // 현재 적용된 설정
    themeMode: currentSettings.themeMode,
    fontSize: currentSettings.fontSize,
    colorScheme: currentSettings.colorScheme,
    isDarkMode,
    highContrast: currentSettings.highContrast,
    reduceMotion: currentSettings.reduceMotion,
    
    // 임시 설정
    tempSettings,
    hasUnsavedChanges,
    
    // 설정 함수들
    setThemeMode,
    setFontSize,
    setColorScheme,
    setHighContrast,
    setReduceMotion,
    
    // 저장/취소 함수들
    saveSettings,
    cancelSettings,
    resetToDefaults,
    
    // 다크모드 토글
    toggleDarkMode,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}; 