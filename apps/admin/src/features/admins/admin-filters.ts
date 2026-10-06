/**
 * What the backend's admin list filter accepts (FindAllDto in airbnb-clone-api):
 * - name: 2–50 characters, partial and case-insensitive;
 * - email: an exact match, validated by /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/. That pattern
 *   rejects top-level domains longer than 4 letters (report D5); such addresses cannot be
 *   searched until the backend changes, and sending them would only produce a 400;
 * - isSuperAdmin: "true" or "false".
 * Stored emails are lowercase, so the filter is lowercased before it is sent.
 */
const BACKEND_EMAIL = /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/;

export const isSendableName = (value: string) =>
  value === '' || (value.length >= 2 && value.length <= 50);

export const normalizeEmailFilter = (value: string) => value.trim().toLowerCase();

export const isSendableEmail = (value: string) => value === '' || BACKEND_EMAIL.test(value);

export const ROLE_FILTERS = ['', 'true', 'false'] as const;
