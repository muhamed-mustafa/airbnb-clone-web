'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { zLoginAdminDtoWritable } from '@stays/api-contract/schemas';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { bffFetch } from '@/lib/bff-client';
import { useApplyServerErrors, useZodErrorMap } from '@/lib/form-errors';
import { Button } from '@/ui/button';
import { TextField } from '@/ui/field';
import { FormAlert } from '@/ui/states';

type LoginValues = z.infer<typeof zLoginAdminDtoWritable>;

export function LoginForm({ next }: { next: string }) {
  const t = useTranslations('login');
  const errorMap = useZodErrorMap();
  const applyServerErrors = useApplyServerErrors();
  const [alert, setAlert] = useState<{ messages: string[]; requestId?: string }>({ messages: [] });

  const form = useForm<LoginValues>({
    resolver: zodResolver(zLoginAdminDtoWritable, { error: errorMap }),
    defaultValues: { email: '', password: '' },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setAlert({ messages: [] });
    try {
      await bffFetch('/bff/session', { method: 'POST', body: values });
      // Full navigation: the new session cookie must be read by the server on the next page.
      window.location.assign(next);
    } catch (error) {
      const result = applyServerErrors(error, form.setError, ['email', 'password']);
      setAlert({ messages: result.messages, requestId: result.requestId });
      // Wrong credentials: keep the email, clear only the password.
      if (result.appError?.kind === 'invalid_credentials') {
        form.resetField('password');
        form.setFocus('password');
      }
    }
  });

  return (
    <form noValidate onSubmit={onSubmit} className="grid gap-4">
      <FormAlert messages={alert.messages} requestId={alert.requestId} />
      <TextField
        label={t('email')}
        type="email"
        autoComplete="username"
        inputMode="email"
        dir="ltr"
        error={errors.email?.message}
        {...form.register('email')}
      />
      <TextField
        label={t('password')}
        type="password"
        autoComplete="current-password"
        dir="ltr"
        error={errors.password?.message}
        {...form.register('password')}
      />
      <Button
        type="submit"
        variant="primary"
        loading={isSubmitting}
        loadingLabel={t('submitting')}
        className="mt-2 w-full"
      >
        {t('submit')}
      </Button>
    </form>
  );
}
