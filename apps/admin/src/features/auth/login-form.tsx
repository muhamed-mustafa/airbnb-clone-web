'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { zLoginAdminDtoWritable } from '@stays/api-contract/schemas';
import type { AppError } from '@stays/api-contract';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import type * as z from 'zod/mini';
import { animatePageExit } from '@/lib/page-exit';
import { bffFetch } from '@/lib/bff-client';
import { useApplyServerErrors, useZodErrorMap } from '@/lib/form-errors';
import { useErrorText } from '@/lib/error-text';
import { SessionTransition, finishSessionScene } from '@/ui/session-transition';
import { Button } from '@/ui/button';
import { TextField } from '@/ui/field';
import { FormAlert } from '@/ui/states';

type LoginValues = z.infer<typeof zLoginAdminDtoWritable>;

export function LoginForm({ next }: { next: string }) {
  const t = useTranslations('login');
  const locale = useLocale();
  const previousLocale = useRef(locale);
  const { formTexts, fieldText } = useErrorText();
  const errorMap = useZodErrorMap();
  const applyServerErrors = useApplyServerErrors();
  const [showPassword, setShowPassword] = useState(false);
  const [complete, setComplete] = useState(false);
  const [alert, setAlert] = useState<{ messages: string[]; requestId?: string; error?: AppError }>({
    messages: [],
  });

  const form = useForm<LoginValues>({
    resolver: zodResolver(zLoginAdminDtoWritable, { error: errorMap }),
    defaultValues: { email: '', password: '' },
    mode: 'onTouched',
  });
  const { errors, isSubmitting } = form.formState;
  useEffect(() => {
    if (previousLocale.current === locale) return;
    previousLocale.current = locale;
    const fields = (['email', 'password'] as const).filter(
      (name) => form.formState.errors[name] && form.formState.errors[name]?.type !== 'server',
    );
    if (fields.length) void form.trigger(fields);
  }, [locale, form]);

  const fieldMessage = (name: keyof LoginValues) => {
    const issue = alert.error?.fieldErrors[name]?.[0];
    return errors[name]?.type === 'server' && issue && alert.error
      ? fieldText(issue, alert.error)
      : errors[name]?.message;
  };

  const onSubmit = form.handleSubmit(
    async (values) => {
      setAlert({ messages: [] });
      setComplete(false);
      try {
        await bffFetch('/bff/session', { method: 'POST', body: values });
        setComplete(true);
        await finishSessionScene();
        // Full navigation: the new session cookie must be read by the server on the next page.
        await animatePageExit();
        window.location.assign(next);
      } catch (error) {
        const result = applyServerErrors(error, form.setError, ['email', 'password']);
        setAlert({
          messages: result.messages,
          requestId: result.requestId,
          error: result.appError ?? { kind: 'unknown', formErrors: [], fieldErrors: {} },
        });
        // Wrong credentials: keep the email, clear only the password.
        if (result.appError?.kind === 'invalid_credentials') {
          form.resetField('password');
          form.setFocus('password');
        }
      }
    },
    // A new attempt that fails client validation must not keep the previous message.
    () => setAlert({ messages: [] }),
  );

  return (
    <form noValidate onSubmit={onSubmit} className="login-form grid">
      {isSubmitting && (
        <SessionTransition action="enter" complete={complete} label={t('submitting')} />
      )}
      <FormAlert
        messages={alert.error && alert.messages.length ? formTexts(alert.error) : alert.messages}
        requestId={alert.requestId}
      />
      <TextField
        label={t('email')}
        type="email"
        startAdornment={
          <svg
            aria-hidden="true"
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m3 7 9 6 9-6" />
          </svg>
        }
        placeholder={t('emailPlaceholder')}
        autoComplete="username"
        inputMode="email"
        dir="ltr"
        frameClassName="login-field login-field-email"
        error={fieldMessage('email')}
        {...form.register('email')}
      />
      <TextField
        label={t('password')}
        type={showPassword ? 'text' : 'password'}
        placeholder={t('passwordPlaceholder')}
        startAdornment={
          <svg
            aria-hidden="true"
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="4" y="10" width="16" height="11" rx="2" />
            <path d="M8 10V7a4 4 0 1 1 8 0v3" />
          </svg>
        }
        endAdornment={
          <button
            type="button"
            className="password-toggle grid h-9 w-9 place-items-center rounded-md text-muted hover:bg-sunken hover:text-ink pointer-coarse:h-11 pointer-coarse:w-11"
            aria-label={t(showPassword ? 'hidePassword' : 'showPassword')}
            title={t(showPassword ? 'hidePassword' : 'showPassword')}
            aria-pressed={showPassword}
            onClick={() => setShowPassword(!showPassword)}
          >
            <svg
              aria-hidden="true"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
              <circle cx="12" cy="12" r="3" />
              {showPassword && <path d="M3 3l18 18" />}
            </svg>
          </button>
        }
        autoComplete="current-password"
        spellCheck={false}
        autoCapitalize="none"
        frameClassName="login-field login-field-password"
        dir="ltr"
        error={fieldMessage('password')}
        {...form.register('password')}
      />
      <div className="login-actions">
        <Link href="/forgot-password">{t('forgotPassword')}</Link>
      </div>
      <Button
        type="submit"
        variant="primary"
        loading={isSubmitting}
        loadingLabel={t('submitting')}
        className="mt-1 w-full"
      >
        {t('submit')}
      </Button>
    </form>
  );
}
