import { E2E_BACKEND_URL } from './support/constants';
import { insertAdmins } from './support/e2e-db';
import {
  admin,
  backendAdminToken,
  expect,
  expectNoHorizontalScroll,
  setLocale,
  signIn,
  test,
  unique,
} from './support/fixtures';

const PAGE = '/team/admins';

interface AdminDto {
  id: string;
  name: string;
  email: string;
  isSuperAdmin: boolean;
}

test.describe('admin team (read only)', () => {
  // A distinct batch per project run: emails are unique in the backend.
  let tag = '';
  test.beforeAll(async () => {
    tag = unique('team').split(' ')[1]!;
    await insertAdmins(
      Array.from({ length: 24 }, (_, index) => ({
        name: `Team ${tag} ${String(index + 1).padStart(2, '0')}`,
        email: `team-${tag}-${index + 1}@example.com`,
        isSuperAdmin: index === 0,
      })),
    );
  });

  test.beforeEach(async ({ page }) => signIn(page, PAGE));

  test('lists admins read-only, marks the current one, and offers no write actions', async ({
    page,
  }) => {
    await expect(page.getByRole('heading', { name: 'فريق الإدارة', exact: true })).toBeVisible();
    await expect(
      page.getByText('عرض فقط. إضافة المشرفين أو تعديلهم أو إيقافهم غير متاحة'),
    ).toBeVisible();
    await expect(page.getByText(/مشرفًا|مشرف/).first()).toBeVisible();

    await page.getByLabel('البريد الإلكتروني').fill(admin().email);
    const row = page
      .getByRole('row', { name: new RegExp(admin().name) })
      .or(page.getByRole('listitem').filter({ hasText: admin().name }));
    await expect(row.first()).toContainText('(أنت)');
    await expect(row.first()).toContainText('مشرف رئيسي');

    const main = page.getByRole('main');
    for (const action of ['إضافة', 'تعديل', 'حذف', 'إيقاف']) {
      await expect(main.getByRole('button', { name: new RegExp(action) })).toHaveCount(0);
    }
  });

  test('never sends the password hash to the browser, although the backend returns it', async ({
    page,
  }) => {
    // Characterizes the backend defect D11: GET /admins includes `password` today.
    const backend = await fetch(`${E2E_BACKEND_URL}/api/admins?limit=1`, {
      headers: { authorization: `Bearer ${await backendAdminToken()}` },
    });
    const raw = (await backend.json()) as { data: Record<string, unknown>[] };
    const backendLeaks = raw.data.some((item) => 'password' in item);
    console.log('[characterization] backend GET /admins includes password:', backendLeaks);
    const one = await fetch(`${E2E_BACKEND_URL}/api/admins/${String(raw.data[0]!.id)}`, {
      headers: { authorization: `Bearer ${await backendAdminToken()}` },
    });
    const oneBody = (await one.json()) as { data: Record<string, unknown> };
    console.log(
      '[characterization] backend GET /admins/{id} includes password:',
      'password' in oneBody.data,
    );

    // The BFF projects list and detail responses to id, name, email, isSuperAdmin.
    const listResponse = await page.request.get('/bff/api/admins?limit=100');
    const list = (await listResponse.json()) as { data: AdminDto[] };
    expect(list.data.length).toBeGreaterThan(0);
    for (const item of list.data) {
      expect(Object.keys(item).sort()).toEqual(['email', 'id', 'isSuperAdmin', 'name']);
    }
    const detailResponse = await page.request.get(`/bff/api/admins/${list.data[0]!.id}`);
    const detail = (await detailResponse.json()) as { data: AdminDto };
    expect(Object.keys(detail.data).sort()).toEqual(['email', 'id', 'isSuperAdmin', 'name']);

    // And the page itself never received it.
    const seen: string[] = [];
    page.on('response', async (response) => {
      if (response.url().includes('/bff/api/admins')) seen.push(await response.text());
    });
    // Filter to this run's batch: other projects' batches can fill the first page.
    await page.goto(`${PAGE}?name=Team+${tag}`);
    await expect(page.getByText(`Team ${tag} 01`).filter({ visible: true }).first()).toBeVisible();
    expect(seen.length).toBeGreaterThan(0);
    for (const body of seen) {
      expect(body).not.toContain('password');
      expect(body).not.toContain('not-a-usable-hash');
      expect(body).not.toContain('$argon2');
    }
  });

  test('filters by name, exact email and role in the URL, with paging', async ({ page }) => {
    // Paging: 24 seeded + the initial admin, 20 per page.
    await page.getByLabel('بحث بالاسم').fill(`Team ${tag}`);
    await expect(page).toHaveURL(new RegExp(`name=Team\\+${tag}`));
    await expect(page.getByText('24 مشرفًا')).toBeVisible();
    await page.getByRole('button', { name: 'التالي' }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByText(`Team ${tag} 24`).filter({ visible: true })).toBeVisible();

    // One character is below the backend minimum: nothing is sent.
    await page.getByRole('button', { name: 'مسح الفلاتر' }).click();
    await page.getByLabel('بحث بالاسم').fill('T');
    await page.waitForTimeout(700);
    await expect(page).not.toHaveURL(/name=/);

    // Email is an exact match; typed in any case, sent lowercase.
    await page.getByLabel('بحث بالاسم').fill('');
    await page.getByLabel('البريد الإلكتروني').fill(`TEAM-${tag}-7@Example.com`.toUpperCase());
    await expect(page).toHaveURL(new RegExp(`email=team-${tag}-7%40example.com`));
    await expect(page.getByText('مشرف واحد')).toBeVisible();
    await expect(page.getByText(`Team ${tag} 07`).filter({ visible: true })).toBeVisible();

    // A partial email is not sent (it would match nothing and the backend rejects it).
    await page.getByLabel('البريد الإلكتروني').fill(`team-${tag}`);
    await page.waitForTimeout(700);
    await expect(page).toHaveURL(new RegExp(`email=team-${tag}-7%40example.com`));

    // Role filter: super admins only (the initial admin and the first seeded one).
    await page.getByRole('button', { name: 'مسح الفلاتر' }).click();
    await page.getByLabel('الدور').selectOption({ label: 'مشرف رئيسي' });
    await expect(page).toHaveURL(/isSuperAdmin=true/);
    await expect(page.getByText(`Team ${tag} 01`).filter({ visible: true })).toBeVisible();
    await expect(page.getByText(`Team ${tag} 02`).filter({ visible: true })).toBeHidden();
    await page.getByLabel('الدور').selectOption({ label: 'مشرف' });
    await expect(page).toHaveURL(/isSuperAdmin=false/);
    // Scoped to the list: the shell header always shows the signed-in admin's name.
    await expect(
      page.getByRole('main').getByText(admin().name).filter({ visible: true }),
    ).toBeHidden();
  });

  test('opens an admin, goes back, and handles unknown ids', async ({ page }) => {
    await page.getByLabel('بحث بالاسم').fill(`Team ${tag} 05`);
    await page.getByRole('link', { name: `عرض Team ${tag} 05` }).click();
    await expect(page).toHaveURL(/\/team\/admins\/[a-f0-9]{24}$/);
    await expect(page.getByRole('heading', { name: `Team ${tag} 05` })).toBeVisible();
    await expect(page.getByText(`team-${tag}-5@example.com`)).toBeVisible();
    await expect(page.getByText('لا تغيّر الصلاحيات حاليًا')).toBeVisible();

    await page.getByRole('link', { name: 'العودة إلى فريق الإدارة' }).click();
    await expect(page).toHaveURL(new RegExp(`${PAGE}$`));

    for (const id of ['670d1234567890abcdef1234', 'not-an-id']) {
      await page.goto(`${PAGE}/${id}`);
      await expect(page.getByRole('heading', { name: 'المشرف غير موجود' })).toBeVisible();
    }
  });

  test('works in English, left to right, from the menu, no horizontal scroll', async ({
    page,
    isMobile,
  }) => {
    await setLocale(page, 'en');
    await page.goto('/locations/countries');
    if (isMobile) await page.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('link', { name: 'Admin team' }).filter({ visible: true }).click();
    await expect(page).toHaveURL(new RegExp(PAGE));
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.getByRole('heading', { name: 'Admin team', exact: true })).toBeVisible();
    await expect(page.getByText(/View only/)).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
