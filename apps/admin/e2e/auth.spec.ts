import { E2E_BACKEND_URL } from './support/constants';
import { admin, expect, setLocale, signIn, test, unique } from './support/fixtures';

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

    await page.getByRole('button', { name: 'تسجيل الخروج' }).click();
    await expect(page).toHaveURL(/\/login\?reason=signed-out/);
    await expect(page.getByRole('main').getByRole('status')).toContainText('تم تسجيل الخروج.');
    expect((await context.cookies()).some((cookie) => cookie.name.endsWith('admin_session'))).toBe(
      false,
    );

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
