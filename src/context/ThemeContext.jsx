import { createContext, useContext, useEffect, useState } from 'react';

const THEME_STORAGE_KEY = 'foodiefy-theme';
const THEME_MODE_STORAGE_KEY = 'foodiefy-theme-mode';
const VALID_THEMES = new Set(['original', 'light', 'dark']);

const getPhilippineHour = () => {
  const hour = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    hour12: false,
    timeZone: 'Asia/Manila',
  }).format(new Date());
  return Number.parseInt(hour, 10);
};

const getAutoThemeByHour = (hour) => {
  if (hour >= 6 && hour < 12) return 'original';
  if (hour >= 12 && hour < 18) return 'light';
  return 'dark';
};

const getAutoThemeNow = () => getAutoThemeByHour(getPhilippineHour());

const getInitialMode = () => {
  const savedMode = localStorage.getItem(THEME_MODE_STORAGE_KEY);
  return savedMode === 'manual' ? 'manual' : 'auto';
};

const getInitialTheme = (mode) => {
  if (mode !== 'manual') return getAutoThemeNow();
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme && VALID_THEMES.has(savedTheme)) return savedTheme;
  return getAutoThemeNow();
};

const ThemeContext = createContext({ theme: 'light', setTheme: () => {} });

export function ThemeProvider({ children }) {
  const [themeMode, setThemeMode] = useState(() => getInitialMode());
  const [theme, setThemeState] = useState(() => {
    const initialMode = getInitialMode();
    return getInitialTheme(initialMode);
  });

  const setTheme = (nextTheme) => {
    if (!VALID_THEMES.has(nextTheme)) return;
    setThemeMode('manual');
    setThemeState(nextTheme);
  };

  useEffect(() => {
    if (themeMode !== 'auto') return undefined;

    const syncAutoTheme = () => {
      const autoTheme = getAutoThemeNow();
      setThemeState((current) => (current === autoTheme ? current : autoTheme));
    };

    syncAutoTheme();
    const timerId = window.setInterval(syncAutoTheme, 60 * 1000);
    return () => window.clearInterval(timerId);
  }, [themeMode]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    localStorage.setItem(THEME_MODE_STORAGE_KEY, themeMode);
  }, [theme, themeMode]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
