import { describe, expect, it, vi } from 'vitest';
import { RefreshCoordinator, type RefreshResult } from './refresh-coordinator';
import { deferred, fakeTokens } from './test-helpers';

const clock = () => {
  let now = 1_000_000;
  return { now: () => now, advance: (ms: number) => (now += ms) };
};

describe('RefreshCoordinator', () => {
  it('runs a single backend refresh for concurrent requests of one session', async () => {
    const coordinator = new RefreshCoordinator();
    const old = fakeTokens(1, 100);
    const next = fakeTokens(2, 200);
    const pending = deferred<RefreshResult>();
    const rotate = vi.fn(() => pending.promise);

    const calls = Array.from({ length: 5 }, () =>
      coordinator.refresh('s1', old.refreshToken, rotate),
    );
    pending.resolve({ type: 'rotated', tokens: next });
    const outcomes = await Promise.all(calls);

    expect(rotate).toHaveBeenCalledTimes(1);
    expect(outcomes).toEqual(Array(5).fill({ type: 'refreshed', tokens: next }));
  });

  it('gives a late request with the rotated token the newer tokens within 30 seconds', async () => {
    const time = clock();
    const coordinator = new RefreshCoordinator({ now: time.now });
    const old = fakeTokens(1, 100);
    const next = fakeTokens(2, 200);
    await coordinator.refresh('s1', old.refreshToken, async () => ({
      type: 'rotated',
      tokens: next,
    }));

    time.advance(29_000);
    const rotate = vi.fn();
    await expect(coordinator.refresh('s1', old.refreshToken, rotate)).resolves.toEqual({
      type: 'refreshed',
      tokens: next,
    });
    expect(rotate).not.toHaveBeenCalled();

    time.advance(2_000);
    expect(coordinator.latestFor('s1', old.refreshToken)).toBeUndefined();
  });

  it('follows a chain of rotations to the latest tokens', async () => {
    const coordinator = new RefreshCoordinator();
    const [t1, t2, t3] = [fakeTokens(1, 1), fakeTokens(2, 2), fakeTokens(3, 3)];
    await coordinator.refresh('s1', t1.refreshToken, async () => ({ type: 'rotated', tokens: t2 }));
    await coordinator.refresh('s1', t2.refreshToken, async () => ({ type: 'rotated', tokens: t3 }));
    expect(coordinator.latestFor('s1', t1.refreshToken)).toEqual(t3);
  });

  it('reports expired only when the backend rejects and no newer tokens exist', async () => {
    const coordinator = new RefreshCoordinator();
    const old = fakeTokens(1, 100);
    await expect(
      coordinator.refresh('s1', old.refreshToken, async () => ({ type: 'rejected' })),
    ).resolves.toEqual({ type: 'expired' });
  });

  it('keeps the session on network/5xx failures', async () => {
    const coordinator = new RefreshCoordinator();
    const old = fakeTokens(1, 100);
    await expect(
      coordinator.refresh('s1', old.refreshToken, async () => ({ type: 'unavailable' })),
    ).resolves.toEqual({ type: 'unavailable' });
    expect(coordinator.isRevoked('s1')).toBe(false);
  });

  it('does not let a refresh that finishes after logout resurrect the session', async () => {
    const coordinator = new RefreshCoordinator();
    const old = fakeTokens(1, 100);
    const pending = deferred<RefreshResult>();
    const call = coordinator.refresh('s1', old.refreshToken, () => pending.promise);

    coordinator.revoke('s1', old.refreshExp);
    pending.resolve({ type: 'rotated', tokens: fakeTokens(2, 200) });

    await expect(call).resolves.toEqual({ type: 'revoked' });
    expect(coordinator.latestFor('s1', old.refreshToken)).toBeUndefined();
    expect(coordinator.isRevoked('s1')).toBe(true);
  });

  it('isolates sessions from each other', async () => {
    const coordinator = new RefreshCoordinator();
    const a = fakeTokens(1, 100);
    await coordinator.refresh('a', a.refreshToken, async () => ({
      type: 'rotated',
      tokens: fakeTokens(2, 2),
    }));
    expect(coordinator.latestFor('b', a.refreshToken)).toBeUndefined();
  });

  it('honours Retry-After: no backend refresh for that session until it passes', async () => {
    const time = clock();
    const coordinator = new RefreshCoordinator({ now: time.now });
    const old = fakeTokens(1, 100);
    await expect(
      coordinator.refresh('s1', old.refreshToken, async () => ({
        type: 'unavailable',
        retryAfterSeconds: 10,
      })),
    ).resolves.toEqual({ type: 'unavailable', retryAfterSeconds: 10 });

    time.advance(4_000);
    const rotate = vi.fn(async (): Promise<RefreshResult> => ({
      type: 'rotated',
      tokens: fakeTokens(2, 200),
    }));
    await expect(coordinator.refresh('s1', old.refreshToken, rotate)).resolves.toEqual({
      type: 'unavailable',
      retryAfterSeconds: 6,
    });
    expect(rotate).not.toHaveBeenCalled();

    time.advance(6_000);
    await expect(coordinator.refresh('s1', old.refreshToken, rotate)).resolves.toMatchObject({
      type: 'refreshed',
    });
    expect(rotate).toHaveBeenCalledTimes(1);
  });

  it('reports an unexpected response as failed, not expired', async () => {
    const coordinator = new RefreshCoordinator();
    const old = fakeTokens(1, 100);
    await expect(
      coordinator.refresh('s1', old.refreshToken, async () => ({ type: 'failed' })),
    ).resolves.toEqual({ type: 'failed' });
    expect(coordinator.isRevoked('s1')).toBe(false);
  });
});
