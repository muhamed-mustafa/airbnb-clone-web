export const THEMES = ['light', 'dark', 'system'] as const;
export type ThemePreference = (typeof THEMES)[number];

/** Not sensitive: only chooses the colour theme. Absent means "follow the system". */
export const THEME_COOKIE = 'admin_theme';

export const readTheme = (value: string | undefined): ThemePreference =>
  value === 'light' || value === 'dark' ? value : 'system';

/**
 * The attribute the server renders on <html>. System has none, so CSS follows
 * prefers-color-scheme and keeps following it when the operating system changes.
 */
export const themeAttribute = (theme: ThemePreference) => (theme === 'system' ? undefined : theme);
