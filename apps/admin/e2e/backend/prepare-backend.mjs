// Builds an isolated copy of the backend for end-to-end tests.
//
// - Source: `git archive` of a pinned commit of airbnb-clone-api. The backend repository
//   itself is never modified: no checkout, no build output, no file written there.
// - The copy has no .env file, so the real secrets are never read. Tests pass their own.
// - node_modules is linked (junction) to the backend's installed dependencies, read-only use.
// - E2E_BACKEND_REF is never used in a path: Git resolves it to a full commit SHA first, and
//   every path that may be deleted is checked to be inside .cache/e2e-backend.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(here, '../../../..');
const CACHE_ROOT = resolve(repoRoot, '.cache', 'e2e-backend');

export const BACKEND_REPO =
  process.env.E2E_BACKEND_REPO ?? resolve(repoRoot, '../airbnb-clone-api');
// fix/d11-d12 on top of main@4d43d07: admin list without password hashes (D11) and a unique
// jti per refresh token (D12). backend-tokens.spec.ts and session.spec.ts depend on it.
export const BACKEND_REF =
  process.env.E2E_BACKEND_REF ?? '3ed3f9c04567a370c05c3242f67c4a1985ed0b8c';

/** Full 40-hex commit SHA for a ref, or throw. The ref is passed to Git only. */
export function resolveCommitSha(ref, repo = BACKEND_REPO) {
  if (typeof ref !== 'string' || ref.trim() === '' || ref.startsWith('-')) {
    throw new Error(`[e2e] invalid backend ref: ${JSON.stringify(ref)}`);
  }
  let sha;
  try {
    sha = execFileSync('git', ['-C', repo, 'rev-parse', '--verify', '--quiet', `${ref}^{commit}`], {
      encoding: 'utf8',
    }).trim();
  } catch {
    throw new Error(`[e2e] backend ref ${JSON.stringify(ref)} is not a commit in ${repo}`);
  }
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error(`[e2e] unexpected SHA from git: ${sha}`);
  return sha;
}

/** Throws unless `path` is strictly inside the cache root (never the root itself). */
export function assertInsideCache(path, root = CACHE_ROOT) {
  const fromRoot = relative(resolve(root), resolve(path));
  if (fromRoot === '' || fromRoot.startsWith('..') || isAbsolute(fromRoot)) {
    throw new Error(`[e2e] refusing to touch ${path}: not inside ${root}`);
  }
}

export function prepareBackend() {
  const sha = resolveCommitSha(BACKEND_REF);
  const target = join(CACHE_ROOT, sha);
  const archive = join(CACHE_ROOT, `${sha}.tar`);
  assertInsideCache(target);
  assertInsideCache(archive);

  const entry = join(target, 'dist', 'main.js');
  if (existsSync(entry)) return { target, entry, sha };

  console.log(`[e2e] building backend ${sha} from ${BACKEND_REPO} into ${target}`);
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });

  execFileSync('git', ['-C', BACKEND_REPO, 'archive', '--format=tar', '-o', archive, sha]);
  // Relative path: some tar builds read "D:\…" as a remote host.
  execFileSync('tar', ['-xf', `../${sha}.tar`], { cwd: target });
  rmSync(archive);

  symlinkSync(join(BACKEND_REPO, 'node_modules'), join(target, 'node_modules'), 'junction');
  execFileSync(
    process.execPath,
    [join(target, 'node_modules', '@nestjs', 'cli', 'bin', 'nest.js'), 'build'],
    { cwd: target, stdio: 'inherit' },
  );
  if (!existsSync(entry)) throw new Error(`[e2e] backend build did not produce ${entry}`);
  return { target, entry, sha };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(prepareBackend());
}
