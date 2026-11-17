'use client';

import { createContext, use, useCallback, useState, type ReactNode } from 'react';
import { THEME_COOKIE, themeAttribute, type ThemePreference } from './theme';

interface ThemeContextValue {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** How long colours ease into the new theme; skipped when reduced motion is requested. */
const THEME_FADE_MS = 160;

/**
 * Holds the person's theme choice. The server already rendered the right attribute from the
 * cookie, so the first paint is correct; this only applies later changes, without a reload.
 */
export function ThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme: ThemePreference;
  children: ReactNode;
}) {
  const [theme, setThemeState] = useState(initialTheme);

  const setTheme = useCallback((next: ThemePreference) => {
    const root = document.documentElement;
    const fade = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (fade) root.classList.add('theme-changing');
    const attribute = themeAttribute(next);
    if (attribute) root.setAttribute('data-theme', attribute);
    else root.removeAttribute('data-theme');
    // Only a UI preference; not sensitive. "System" removes the explicit choice.
    document.cookie =
      next === 'system'
        ? `${THEME_COOKIE}=; path=/; max-age=0; samesite=lax`
        : `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    setThemeState(next);
    if (fade) window.setTimeout(() => root.classList.remove('theme-changing'), THEME_FADE_MS);
  }, []);

  return <ThemeContext value={{ theme, setTheme }}>{children}</ThemeContext>;
}

export function useTheme(): ThemeContextValue {
  const value = use(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}
