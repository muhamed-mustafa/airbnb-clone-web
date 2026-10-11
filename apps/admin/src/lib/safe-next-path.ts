export const DEFAULT_PATH = '/';

/** Only same-app absolute paths; blocks open redirects like `//evil.test` or `https://…`. */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return DEFAULT_PATH;
  }
  if (value === '/login' || value.startsWith('/login?') || value.startsWith('/bff/'))
    return DEFAULT_PATH;
  return value;
}
