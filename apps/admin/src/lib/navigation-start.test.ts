import { describe, expect, it, vi } from 'vitest';
import { isNavigatingClick, onNavigationStart } from './navigation-start';

const ORIGIN = 'http://admin.test';

const anchor = (href: string, attributes: Record<string, string> = {}) => ({
  href: new URL(href, ORIGIN).href,
  target: attributes.target ?? '',
  hasAttribute: (name: string) => name in attributes,
});
/** A click target inside `link` (or on nothing when link is null). */
const inside = (link: ReturnType<typeof anchor> | null) => ({
  closest: (selector: string) => (selector === 'a[href]' ? link : null),
});
const click = (target: unknown, overrides: Partial<Record<string, unknown>> = {}) => ({
  button: 0,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  target: target as EventTarget,
  ...overrides,
});

describe('isNavigatingClick', () => {
  it('is true for a plain click on a same-origin link, or inside one', () => {
    expect(isNavigatingClick(click(inside(anchor('/team/admins/1'))), ORIGIN)).toBe(true);
    expect(isNavigatingClick(click(inside(anchor(`${ORIGIN}/locations/cities`))), ORIGIN)).toBe(
      true,
    );
    expect(isNavigatingClick(click(inside(anchor('/x', { target: '_self' }))), ORIGIN)).toBe(true);
  });

  it.each([
    ['a button or text (no link)', click(inside(null))],
    ['a target without closest()', click({})],
    ['a middle click', click(inside(anchor('/x')), { button: 1 })],
    ['ctrl/cmd click (new tab)', click(inside(anchor('/x')), { ctrlKey: true })],
    ['meta click', click(inside(anchor('/x')), { metaKey: true })],
    ['shift click (new window)', click(inside(anchor('/x')), { shiftKey: true })],
    ['alt click (download)', click(inside(anchor('/x')), { altKey: true })],
    ['a link opening another tab', click(inside(anchor('/x', { target: '_blank' })))],
    ['a download link', click(inside(anchor('/file.csv', { download: '' })))],
    ['another origin', click(inside(anchor('https://example.com/')))],
  ])('is false for %s', (_label, event) => {
    expect(isNavigatingClick(event, ORIGIN)).toBe(false);
  });
});

describe('onNavigationStart', () => {
  const setup = () => {
    const targets = { document: new EventTarget(), window: new EventTarget(), origin: ORIGIN };
    const listener = vi.fn();
    const stop = onNavigationStart(listener, targets);
    const dispatchClick = (target: unknown) => {
      const event = new Event('click');
      Object.assign(event, { button: 0, metaKey: false, ctrlKey: false, shiftKey: false });
      Object.defineProperty(event, 'altKey', { value: false });
      Object.defineProperty(event, 'target', { value: target });
      targets.document.dispatchEvent(event);
    };
    return { targets, listener, stop, dispatchClick };
  };

  it('fires on a navigating click and on Back/Forward (popstate)', () => {
    const { targets, listener, dispatchClick } = setup();
    dispatchClick(inside(anchor('/team/admins/1')));
    targets.window.dispatchEvent(new Event('popstate'));
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('ignores clicks that do not navigate', () => {
    const { listener, dispatchClick } = setup();
    dispatchClick(inside(null));
    dispatchClick(inside(anchor('https://example.com/')));
    expect(listener).not.toHaveBeenCalled();
  });

  it('stops listening after unsubscribe', () => {
    const { targets, listener, stop, dispatchClick } = setup();
    stop();
    dispatchClick(inside(anchor('/team/admins/1')));
    targets.window.dispatchEvent(new Event('popstate'));
    expect(listener).not.toHaveBeenCalled();
  });
});
