import AxeBuilder from '@axe-core/playwright';
import { E2E_BACKEND_URL } from './support/constants';
import {
  admin,
  expect,
  setLocale,
  signIn,
  test,
  unique,
  openAccountMenu,
} from './support/fixtures';

test.describe('admin sign in', () => {
  test('sends signed-out visitors to login and back to where they were going', async ({ page }) => {
    await page.goto('/locations/cities?name=cai');
    await expect(page).toHaveURL(/\/login\?next=%2Flocations%2Fcities%3Fname%3Dcai/);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { name: 'تسجيل دخول الإدارة' })).toBeVisible();

    const { email, password } = admin();
    await page.getByLabel('البريد الإلكتروني').fill(email);
    await page.getByLabel('كلمة المرور', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
    await expect(page).toHaveURL(/\/locations\/cities\?name=cai$/);
  });

  test('wrong password: message in the form, email kept, password cleared', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('البريد الإلكتروني').fill(admin().email);
    await page.getByLabel('كلمة المرور', { exact: true }).fill('wrong-password');
    await page.getByRole('button', { name: 'تسجيل الدخول' }).click();

    await expect(page.getByRole('main').getByRole('alert')).toContainText(
      'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
    );
    await expect(page.getByLabel('البريد الإلكتروني')).toHaveValue(admin().email);
    await expect(page.getByLabel('كلمة المرور', { exact: true })).toHaveValue('');
    await expect(page.getByLabel('كلمة المرور', { exact: true })).toBeFocused();
    await expect(page).toHaveURL(/\/login/);
  });

  test('client-side validation in English', async ({ page }) => {
    await setLocale(page, 'en');
    await page.goto('/login');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await page.getByLabel('Email').fill('not-an-email');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Enter a valid email, like name@example.com.')).toBeVisible();
    await expect(page.getByText('This field is required.')).toBeVisible();
  });

  test('a guest (user) account cannot sign in to the admin', async ({ page }) => {
    const email = `${unique('guest').replace(' ', '-')}@example.com`;
    const password = 'Guest-password-123';
    const register = await fetch(`${E2E_BACKEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Guest User',
        email,
        countryCode: '+20',
        phone: `10${String(Date.now()).slice(-8)}`,
        password,
      }),
    });
    expect(register.status).toBe(201);

    await page.goto('/login');
    await page.getByLabel('البريد الإلكتروني').fill(email);
    await page.getByLabel('كلمة المرور', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
    await expect(page.getByRole('main').getByRole('alert')).toContainText(
      'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
    );
    await expect(page).toHaveURL(/\/login/);
  });

  test('shows the admin name and signs out of this browser only', async ({ page, context }) => {
    await signIn(page);
    if ((page.viewportSize()?.width ?? 0) < 1024) {
      await page.getByRole('button', { name: 'فتح القائمة' }).click();
    }
    await expect(page.getByText(admin().name).filter({ visible: true })).toBeVisible();

    const before = (await context.cookies()).find((cookie) =>
      cookie.name.endsWith('admin_session'),
    );
    expect(before?.httpOnly).toBe(true);
    expect(before?.sameSite).toBe('Lax');

    await openAccountMenu(page);
    await page.getByRole('button', { name: 'تسجيل الخروج' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('main').getByRole('status')).toContainText('تم تسجيل الخروج.');
    expect((await context.cookies()).some((cookie) => cookie.name.endsWith('admin_session'))).toBe(
      false,
    );

    await page.reload();
    await expect(page.getByRole('main').getByRole('status')).toHaveCount(0);

    // Replaying the old cookie after sign-out is refused by the BFF (revoked session id).
    const replay = await page.request.get('/bff/api/countries', {
      headers: { cookie: `${before!.name}=${before!.value}` },
    });
    expect(replay.status()).toBe(401);
    expect((await replay.json()).error.kind).toBe('session_expired');

    await page.goto('/locations/countries');
    await expect(page).toHaveURL(/\/login/);
  });
});

test('logout notice is consumed without removing the intended destination', async ({ page }) => {
  await page.goto('/login?reason=signed-out&next=%2Fteam%2Fadmins');
  await expect(page.getByRole('main').getByRole('status')).toBeVisible();
  await expect(page).toHaveURL(/next=%2Fteam%2Fadmins$/);
  await page.reload();
  await expect(page.getByRole('main').getByRole('status')).toHaveCount(0);
  await expect(page).toHaveURL(/next=%2Fteam%2Fadmins$/);
});

test('validation is linked to fields and password visibility preserves input', async ({
  page,
}, info) => {
  await setLocale(page, 'en');
  await page.goto('/login');
  const email = page.getByLabel('Email', { exact: true });
  const password = page.getByLabel('Password', { exact: true });
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(email).toBeFocused();
  for (const input of [email, password]) {
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    const messageId = await input.getAttribute('aria-describedby');
    await expect(page.locator(`[id="${messageId}"]`)).toHaveText('This field is required.');
  }
  await password.hover();
  await expect(password).toHaveCSS('border-color', 'rgb(180, 35, 24)');
  await page.screenshot({
    path: `../../docs/phase-1/screens/${info.project.name}-login-validation-en.png`,
  });
  const audit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(audit.violations).toEqual([]);
  await email.fill('name@example.com');
  await password.fill('a');
  await expect(email).not.toHaveAttribute('aria-invalid', 'true');
  await expect(password).not.toHaveAttribute('aria-invalid', 'true');
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await expect(password).toHaveValue('a');
  await page.getByRole('button', { name: 'Hide password' }).click();
  await expect(password).toHaveAttribute('type', 'password');
  await expect(password).toHaveValue('a');
  // Login accepts an existing password; no account-creation policy is imposed here.
  await expect(page.locator('.field-error')).toHaveCount(0);
  await setLocale(page, 'ar');
  await page.reload();
  await page.locator('form button[type="submit"]').click();
  await expect(page.locator('.field-error')).toHaveCount(2);
  await expect(page.locator('input[type="password"]')).toHaveAttribute('aria-invalid', 'true');
  await page.screenshot({
    path: `../../docs/phase-1/screens/${info.project.name}-login-validation-ar.png`,
  });
  const arabicAudit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(arabicAudit.violations).toEqual([]);
});

test('switching locale translates existing errors without another request or losing input', async ({
  page,
}) => {
  await setLocale(page, 'en');
  await page.goto('/login');
  let requests = 0;
  page.on('request', (request) => {
    if (request.url().endsWith('/bff/session') && request.method() === 'POST') requests++;
  });
  await page.getByLabel('Email').fill(admin().email);
  await page.getByLabel('Password', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  const alert = page.getByRole('main').getByRole('alert');
  await expect(alert).toContainText('The email or password is incorrect.');
  await page.getByRole('button', { name: 'Switch to Arabic' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(alert).toContainText('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
  await expect(page.locator('input[type="email"]')).toHaveValue(admin().email);
  expect(requests).toBe(1);
  await page.getByRole('button', { name: 'التبديل إلى الإنجليزية' }).click();
  await expect(alert).toContainText('The email or password is incorrect.');
  await page.getByLabel('Email').fill('invalid');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('.field-error')).toHaveCount(2);
  await page.getByRole('button', { name: 'Switch to Arabic' }).click();
  await expect(page.locator('.field-error').last()).toContainText('هذا الحقل مطلوب.');
  await expect(page.locator('input[type="email"]')).toHaveValue('invalid');
  expect(requests).toBe(1);
});
