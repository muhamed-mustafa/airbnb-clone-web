import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { MongoClient } from 'mongodb';
// @ts-expect-error -- plain ESM helper without type declarations
import { prepareBackend } from './backend/prepare-backend.mjs';
import { E2E_BACKEND_URL, E2E_DATABASE } from './support/constants';

const MONGO_URI =
  process.env.E2E_MONGO_URI ?? `mongodb://localhost:27017/${E2E_DATABASE}?replicaSet=rs0`;

/**
 * Wipe the e2e database only after proving, on the live connection, that it really is
 * `airbnb-clone-e2e`. Any other name (a typo, an env override) stops the run.
 */
async function resetDatabase() {
  const client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  try {
    const db = client.db();
    const stats = await db.command({ dbStats: 1 });
    if (db.databaseName !== E2E_DATABASE || stats.db !== E2E_DATABASE) {
      throw new Error(
        `[e2e] refusing to wipe database "${db.databaseName}" (server reports "${String(stats.db)}"); expected exactly "${E2E_DATABASE}"`,
      );
    }
    await db.dropDatabase();
  } finally {
    await client.close();
  }
}

async function waitFor(url: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((done) => setTimeout(done, 500));
  }
  throw new Error(`[e2e] backend did not become ready at ${url}`);
}

export default async function globalSetup() {
  try {
    await fetch(`${E2E_BACKEND_URL}/api/countries`);
    throw new Error(`[e2e] something is already listening on ${E2E_BACKEND_URL}; stop it first`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('[e2e]')) throw error;
  }

  await resetDatabase();
  const { target, entry } = prepareBackend();

  const admin = {
    email: 'e2e-admin@example.com',
    password: `${randomBytes(12).toString('base64url')}aA1!`,
    name: 'E2E Admin',
  };
  const env = {
    PATH: process.env.PATH ?? '',
    SystemRoot: process.env.SystemRoot ?? '',
    NODE_ENV: 'test' as const,
    PORT: new URL(E2E_BACKEND_URL).port,
    MONGO_URI,
    FALLBACK_LANGUAGE: 'en',
    JWT_SECRET: randomBytes(32).toString('hex'),
    REFRESH_TOKEN_SECRET: randomBytes(32).toString('hex'),
    // Short access tokens so every run exercises the refresh path (BFF skew is 30 s).
    ACCESS_TOKEN_EXPIRE_IN: '40s',
    REFRESH_TOKEN_EXPIRE_IN: '1d',
    INITIAL_ADMIN_NAME: admin.name,
    INITIAL_ADMIN_EMAIL: admin.email,
    INITIAL_ADMIN_PASSWORD: admin.password,
  };

  const log = createWriteStream(join(target, '..', 'backend.log'));
  const child = spawn(process.execPath, [entry], {
    cwd: target,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.pipe(log);
  child.stderr.pipe(log);

  const exited = new Promise<never>((_, reject) =>
    child.once('exit', (code) =>
      reject(
        new Error(`[e2e] backend exited with code ${code}; see .cache/e2e-backend/backend.log`),
      ),
    ),
  );
  await Promise.race([waitFor(`${E2E_BACKEND_URL}/api/countries`, 60_000), exited]);

  // Workers inherit these.
  process.env.E2E_ADMIN_EMAIL = admin.email;
  process.env.E2E_ADMIN_PASSWORD = admin.password;
  process.env.E2E_ADMIN_NAME = admin.name;

  return async () => {
    child.kill();
  };
}
