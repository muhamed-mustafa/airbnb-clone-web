import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM helper without type declarations
import { assertInsideCache, BACKEND_REPO, resolveCommitSha } from './prepare-backend.mjs';

// Uses the real backend repository read-only (`git rev-parse`); nothing is written.
describe('resolveCommitSha', () => {
  it('turns the pinned short ref into a full 40-hex SHA', () => {
    expect(resolveCommitSha('4d43d07')).toMatch(/^4d43d07[0-9a-f]{33}$/);
  });

  it.each(['../../outside', '..', '-rf', '--output=/tmp/x', '', 'no-such-ref-xyz', 'HEAD~999999'])(
    'refuses %j',
    (ref) => {
      expect(() => resolveCommitSha(ref, BACKEND_REPO)).toThrow(/\[e2e\]/);
    },
  );
});

describe('assertInsideCache', () => {
  const root = resolve('/tmp/cache/e2e-backend');

  it('accepts a path strictly inside the cache root', () => {
    expect(() => assertInsideCache(join(root, 'a'.repeat(40)), root)).not.toThrow();
  });

  it.each([
    root,
    resolve(root, '..'),
    resolve(root, '../other'),
    resolve('/'),
    resolve(root, '..', 'e2e-backend-x'),
  ])('refuses %s', (path) => {
    expect(() => assertInsideCache(path, root)).toThrow(/refusing/);
  });
});
