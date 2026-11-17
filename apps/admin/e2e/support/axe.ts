import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect } from './fixtures';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** WCAG 2.1 A/AA audit of the page as it is now (in whichever theme it renders). */
export async function expectNoAxeViolations(page: Page, label: string) {
  // Audit the settled visual state. Ignore indefinite decorative/loading animations.
  await page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined)),
    );
  });
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const summary = results.violations.map(
    (violation) =>
      `${violation.id}: ${violation.nodes.length} node(s): ${violation.nodes.map((node) => `${node.target.join(', ')}: ${node.failureSummary}`).join('; ')}`,
  );
  expect(summary, `axe violations on ${label}`).toEqual([]);
}
