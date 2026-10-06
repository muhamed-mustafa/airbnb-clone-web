import { MongoClient, type Db } from 'mongodb';
import { E2E_DATABASE } from './constants';

const MONGO_URI =
  process.env.E2E_MONGO_URI ?? `mongodb://localhost:27017/${E2E_DATABASE}?replicaSet=rs0`;

/**
 * Run `work` against the e2e database, only after proving on the live connection that it
 * really is `airbnb-clone-e2e` (driver name and server-reported name). Anything else (a
 * typo, an env override) stops the run before a single read or write.
 */
export async function withE2eDatabase<T>(work: (db: Db) => Promise<T>): Promise<T> {
  const client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  try {
    const db = client.db();
    const stats = await db.command({ dbStats: 1 });
    if (db.databaseName !== E2E_DATABASE || stats.db !== E2E_DATABASE) {
      throw new Error(
        `[e2e] refusing to use database "${db.databaseName}" (server reports "${String(stats.db)}"); expected exactly "${E2E_DATABASE}"`,
      );
    }
    return await work(db);
  } finally {
    await client.close();
  }
}

/**
 * The API has no endpoint to create admin accounts, so list tests insert them directly.
 * The password field is a placeholder: these accounts are never used to sign in.
 */
export async function insertAdmins(
  admins: { name: string; email: string; isSuperAdmin: boolean }[],
): Promise<void> {
  const now = new Date();
  await withE2eDatabase((db) =>
    db.collection('admins').insertMany(
      admins.map((admin) => ({
        ...admin,
        password: 'not-a-usable-hash',
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      })),
    ),
  );
}
