'use client';

import type { AppSettingsResponseDto, Envelope } from '@stays/api-contract';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bffFetch, isBffError } from '@/lib/bff-client';
import type { PricingSettingsPatch } from './pricing-settings-schema';

export type AppSettings = AppSettingsResponseDto;

export const appSettingsKey = ['app-settings'] as const;

/**
 * The settings document is a singleton that exists only after the first save: the backend
 * answers 404 APP_SETTINGS_NOT_FOUND until then. That is "not configured yet" (null),
 * not an error.
 */
export function useAppSettings() {
  return useQuery({
    queryKey: appSettingsKey,
    queryFn: async ({ signal }): Promise<AppSettings | null> => {
      try {
        const result = await bffFetch<Envelope<AppSettings>>('/bff/api/app-settings', { signal });
        return result.data;
      } catch (error) {
        if (
          isBffError(error) &&
          error.appError.formErrors.some(
            (item) => item.code === 'app-settings.APP_SETTINGS_NOT_FOUND',
          )
        ) {
          return null;
        }
        throw error;
      }
    },
  });
}

/** PATCH with the changed fields only: the backend changes only the fields it receives. */
export function useSaveAppSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: PricingSettingsPatch) =>
      bffFetch<Envelope<AppSettings>>('/bff/api/app-settings', { method: 'PATCH', body }),
    onSuccess: (result) => queryClient.setQueryData(appSettingsKey, result.data),
    // A timed-out save may have been applied: show the stored values, not a guess.
    onError: () => queryClient.invalidateQueries({ queryKey: appSettingsKey }),
  });
}
