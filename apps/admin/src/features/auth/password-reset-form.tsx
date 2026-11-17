'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { zLoginAdminDtoWritable } from '@stays/api-contract/schemas';
import { BffError, bffFetch } from '@/lib/bff-client';
import { Button, buttonClasses } from '@/ui/button';
import { FieldFrame, TextField } from '@/ui/field';
import { FormAlert } from '@/ui/states';

type Step = 'email' | 'code' | 'password' | 'done';

const MIN_PASSWORD_LENGTH = 15;
const MAX_PASSWORD_LENGTH = 128;

function Icon({ kind }: { kind: 'mail' | 'key' | 'lock' }) {
  if (kind === 'mail')
    return (
      <svg
        aria-hidden="true"
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      >
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </svg>
    );
  if (kind === 'key')
    return (
      <svg
        aria-hidden="true"
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      >
        <circle cx="8" cy="15" r="5" />
        <path d="m11.5 11.5 8-8 2 2-2 2 2 2-3 3-2-2-3.5 3.5" />
      </svg>
    );
  return (
    <svg
      aria-hidden="true"
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 1 1 8 0v3" />
    </svg>
  );
}

export function PasswordResetForm() {
  const t = useTranslations('passwordReset');
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [emailIssue, setEmailIssue] = useState<'required' | 'invalid' | null>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState('');
  const codeInputId = useId();
  const verifyingCode = useRef(false);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordAttempted, setPasswordAttempted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setTimeout(() => setSecondsLeft((remaining) => remaining - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft]);

  const run = async (event: FormEvent<HTMLFormElement>, action: () => Promise<void>) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await action();
    } catch (reason) {
      setError(
        reason instanceof BffError && reason.appError.status === 503
          ? t('emailUnavailable')
          : reason instanceof BffError && reason.appError.status === 400 && step === 'code'
            ? t('codeInvalid')
            : t('genericError'),
      );
    } finally {
      setBusy(false);
    }
  };

  const activeStep = step === 'email' ? 1 : step === 'code' ? 2 : 3;
  const passwordLength = Array.from(newPassword).length;
  const passwordHasRequiredCharacters =
    /[a-z]/.test(newPassword) &&
    /[A-Z]/.test(newPassword) &&
    /\d/.test(newPassword) &&
    /[^A-Za-z0-9\s]/.test(newPassword);
  const passwordHasRepeatedCharacters = /(.)\1{4,}/s.test(newPassword);
  const passwordIsValid =
    passwordLength >= MIN_PASSWORD_LENGTH &&
    passwordLength <= MAX_PASSWORD_LENGTH &&
    passwordHasRequiredCharacters &&
    !passwordHasRepeatedCharacters;
  const passwordFieldError =
    passwordAttempted || newPassword.length > 0
      ? !newPassword
        ? t('passwordRequired')
        : passwordLength < MIN_PASSWORD_LENGTH
          ? t('passwordTooShort')
          : passwordLength > MAX_PASSWORD_LENGTH
            ? t('passwordTooLong')
            : !passwordHasRequiredCharacters
              ? t('passwordStrength')
              : passwordHasRepeatedCharacters
                ? t('passwordRepeatedCharacters')
                : undefined
      : undefined;
  const confirmPasswordFieldError =
    passwordAttempted || confirmPassword.length > 0
      ? !confirmPassword
        ? t('confirmPasswordRequired')
        : confirmPassword !== newPassword
          ? t('passwordMismatch')
          : undefined
      : undefined;

  const verifyCode = async (value: string) => {
    const result = await bffFetch<{ resetToken: string }>('/bff/password-reset/verify', {
      method: 'POST',
      body: { email, code: value },
    });
    setResetToken(result.resetToken);
    setStep('password');
  };

  const verifyCodeWhenComplete = async (value: string) => {
    if (value.length !== 6 || verifyingCode.current) return;
    verifyingCode.current = true;
    setError('');
    setBusy(true);
    try {
      await verifyCode(value);
    } catch (reason) {
      setError(
        reason instanceof BffError && reason.appError.status === 400
          ? t('codeInvalid')
          : t('genericError'),
      );
      setCode('');
    } finally {
      verifyingCode.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="reset-flow">
      {step !== 'done' && (
        <ol className="reset-progress" aria-label={t('progress')}>
          {[t('stepEmail'), t('stepCode'), t('stepPassword')].map((label, index) => (
            <li
              key={label}
              className={activeStep >= index + 1 ? 'is-active' : ''}
              aria-current={activeStep === index + 1 ? 'step' : undefined}
            >
              <span>{index + 1}</span>
              <small>{label}</small>
            </li>
          ))}
        </ol>
      )}

      {step === 'email' && (
        <form
          noValidate
          className="reset-form"
          onSubmit={(event) =>
            run(event, async () => {
              const normalizedEmail = email.trim();
              if (!normalizedEmail) {
                setEmailIssue('required');
                emailInputRef.current?.focus();
                return;
              }
              if (!zLoginAdminDtoWritable.shape.email.safeParse(normalizedEmail).success) {
                setEmailIssue('invalid');
                emailInputRef.current?.focus();
                return;
              }
              setEmailIssue(null);
              await bffFetch('/bff/password-reset/request', {
                method: 'POST',
                body: { email: normalizedEmail },
              });
              setEmail(normalizedEmail);
              setSecondsLeft(60);
              setStep('code');
            })
          }
        >
          <p className="reset-step-copy">{t('emailIntro')}</p>
          <TextField
            label={t('email')}
            ref={emailInputRef}
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            dir="ltr"
            required
            maxLength={254}
            placeholder={t('emailPlaceholder')}
            startAdornment={<Icon kind="mail" />}
            frameClassName="reset-field reset-field-email"
            error={
              emailIssue
                ? t(emailIssue === 'required' ? 'emailRequired' : 'emailInvalid')
                : undefined
            }
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (emailIssue) setEmailIssue(null);
            }}
          />
          <FormAlert messages={error ? [error] : []} />
          <Button
            type="submit"
            variant="primary"
            loading={busy}
            loadingLabel={t('sending')}
            className="w-full"
          >
            {t('sendCode')}
          </Button>
        </form>
      )}

      {step === 'code' && (
        <form
          noValidate
          className="reset-form"
          onSubmit={(event) => run(event, () => verifyCode(code))}
        >
          <p className="reset-step-copy">{t('codeIntro', { email })}</p>
          <FieldFrame id={codeInputId} label={t('code')} className="reset-field reset-field-code">
            <div className={`reset-otp${busy ? ' is-loading' : ''}`} dir="ltr">
              <span className="reset-otp-icon">
                <Icon kind="key" />
              </span>
              <div className="reset-otp-cells" aria-hidden="true">
                {Array.from({ length: 6 }, (_, index) => (
                  <span
                    key={index}
                    className={`reset-otp-cell${code[index] ? ' is-filled' : ''}${index === code.length && code.length < 6 ? ' is-current' : ''}`}
                  >
                    {code[index] ?? ''}
                  </span>
                ))}
              </div>
              <input
                id={codeInputId}
                className="reset-otp-input"
                type="text"
                name="one-time-code"
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                aria-label={t('code')}
                aria-describedby={`${codeInputId}-hint`}
                required
                minLength={6}
                maxLength={6}
                value={code}
                disabled={busy}
                onChange={(event) => {
                  const value = event.target.value.replace(/\D/g, '').slice(0, 6);
                  setCode(value);
                  setError('');
                  if (value.length === 6) void verifyCodeWhenComplete(value);
                }}
              />
            </div>
            <p id={`${codeInputId}-hint`} className="sr-only">
              {t('codeIntro', { email })}
            </p>
          </FieldFrame>
          <FormAlert messages={error ? [error] : []} />
          <Button
            type="submit"
            variant="primary"
            loading={busy}
            loadingLabel={t('verifying')}
            disabled={code.length !== 6}
            className="w-full"
          >
            {t('verifyCode')}
          </Button>
          <button
            type="button"
            className="reset-secondary"
            disabled={busy || secondsLeft > 0}
            onClick={async () => {
              setError('');
              setBusy(true);
              try {
                await bffFetch('/bff/password-reset/request', {
                  method: 'POST',
                  body: { email },
                });
                setSecondsLeft(60);
              } catch (reason) {
                setError(
                  reason instanceof BffError && reason.appError.status === 503
                    ? t('emailUnavailable')
                    : t('genericError'),
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {secondsLeft > 0 ? t('resendIn', { seconds: secondsLeft }) : t('resendCode')}
          </button>
          <button
            type="button"
            className="reset-secondary"
            disabled={busy}
            onClick={() => {
              setError('');
              setStep('email');
            }}
          >
            {t('changeEmail')}
          </button>
        </form>
      )}

      {step === 'password' && (
        <form
          noValidate
          className="reset-form"
          onSubmit={(event) =>
            run(event, async () => {
              setPasswordAttempted(true);
              if (!passwordIsValid || !confirmPassword || newPassword !== confirmPassword) return;
              await bffFetch('/bff/password-reset/complete', {
                method: 'POST',
                body: { resetToken, newPassword },
              });
              setStep('done');
            })
          }
        >
          <p className="reset-step-copy">{t('passwordIntro')}</p>
          <TextField
            label={t('newPassword')}
            type={showPassword ? 'text' : 'password'}
            name="new-password"
            autoComplete="new-password"
            dir="ltr"
            required
            minLength={MIN_PASSWORD_LENGTH}
            maxLength={MAX_PASSWORD_LENGTH}
            placeholder={t('passwordPlaceholder')}
            hint={t('passwordHint')}
            error={passwordFieldError}
            startAdornment={<Icon kind="lock" />}
            frameClassName="reset-field"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
          <TextField
            label={t('confirmPassword')}
            type={showPassword ? 'text' : 'password'}
            name="confirm-password"
            autoComplete="new-password"
            dir="ltr"
            required
            minLength={MIN_PASSWORD_LENGTH}
            maxLength={MAX_PASSWORD_LENGTH}
            placeholder={t('confirmPlaceholder')}
            error={confirmPasswordFieldError}
            startAdornment={<Icon kind="lock" />}
            frameClassName="reset-field"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
          <label className="reset-show-password">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(event) => setShowPassword(event.target.checked)}
            />
            {t('showPassword')}
          </label>
          <FormAlert messages={error ? [error] : []} />
          <Button
            type="submit"
            variant="primary"
            loading={busy}
            loadingLabel={t('saving')}
            className="w-full"
          >
            {t('savePassword')}
          </Button>
        </form>
      )}

      {step === 'done' && (
        <div className="reset-success" role="status">
          <span className="reset-success-mark" aria-hidden="true">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m5 12 4 4L19 6" />
            </svg>
          </span>
          <h2>{t('successTitle')}</h2>
          <p>{t('successBody')}</p>
          <Link href="/login" className={buttonClasses('primary', 'w-full')}>
            {t('backToLogin')}
          </Link>
        </div>
      )}

      {step !== 'done' && (
        <Link href="/login" className="reset-back-link">
          {t('backToLogin')}
        </Link>
      )}
    </div>
  );
}
