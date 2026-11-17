'use client';

import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { MonitorIcon, MoonIcon, SunIcon } from '@/ui/icons';
import { THEMES, type ThemePreference } from './theme';
import { useTheme } from './theme-provider';

const ICONS = { light: SunIcon, dark: MoonIcon, system: MonitorIcon } as const;

/**
 * Light / Dark / System as one radio group: a single Tab stop, arrow keys move and select
 * (the native radio behaviour), and each option has a visible label as well as an icon.
 */
export function ThemeSwitch({ compact = false }: { compact?: boolean }) {
  const t = useTranslations('theme');
  const { theme, setTheme } = useTheme();
  const name = useId();

  return (
    <fieldset className={`theme-switch ${compact ? 'theme-switch-compact' : ''}`}>
      <legend className={compact ? 'sr-only' : 'theme-switch-legend'}>{t('label')}</legend>
      <div className="theme-switch-options">
        {THEMES.map((option: ThemePreference) => {
          const Icon = ICONS[option];
          return (
            <label
              key={option}
              className="theme-option"
              data-checked={theme === option}
              title={compact ? t(option) : undefined}
            >
              <input
                type="radio"
                name={name}
                value={option}
                checked={theme === option}
                onChange={() => setTheme(option)}
                className="sr-only"
              />
              <Icon width={16} height={16} />
              <span>{t(option)}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
