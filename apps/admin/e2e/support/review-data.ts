import { insertAdmins } from './e2e-db';
import { seed } from './fixtures';

interface Created {
  id: string;
}

/** Seeds once per database; a conflict means the data is already there. */
async function seedOnce<T extends Created>(path: string, body: unknown): Promise<T | undefined> {
  try {
    return await seed<T>(path, body);
  } catch {
    return undefined;
  }
}

/**
 * Realistic review data on the isolated e2e database: Arabic and English names, a long
 * country name, cities spread unevenly across countries, and a few admins.
 */
export async function seedReviewData() {
  const countries: [string, string, string[]][] = [
    ['Egypt', 'EG', ['Cairo', 'Alexandria', 'الأقصر', 'Sharm El Sheikh', 'Aswan']],
    ['Saudi Arabia', 'SA', ['Riyadh', 'Jeddah', 'العُلا']],
    ['United Arab Emirates', 'AE', ['Dubai', 'Abu Dhabi']],
    ['المغرب', 'MA', ['مراكش']],
    ['Saint Vincent and the Grenadines', 'VC', []],
    ['الأردن', 'JO', ['Amman', 'العقبة']],
  ];
  for (const [name, code, cities] of countries) {
    const country = await seedOnce('/countries', { name, code });
    if (!country) continue;
    for (const city of cities) await seedOnce('/cities', { name: city, country: country.id });
  }
  for (const [name, currencyCode] of [
    ['Egyptian Pound', 'EGP'],
    ['Saudi Riyal', 'SAR'],
    ['درهم إماراتي', 'AED'],
    ['US Dollar', 'USD'],
  ]) {
    await seedOnce('/currencies', { name, currencyCode });
  }
  for (const name of ['Apartment', 'Villa', 'شاليه', 'Studio']) {
    await seedOnce('/unit-categories', { name });
  }
  try {
    await insertAdmins([
      { name: 'Omar Khaled', email: 'omar.khaled@example.com', isSuperAdmin: false },
      { name: 'سارة الحربي', email: 'sara.alharbi@example.com', isSuperAdmin: false },
      { name: 'منى عبد الرحمن السيد', email: 'mona.elsayed@example.com', isSuperAdmin: true },
      { name: 'Youssef Nabil', email: 'youssef.nabil@example.com', isSuperAdmin: false },
    ]);
  } catch {
    // Already inserted by an earlier test in this run.
  }
}
