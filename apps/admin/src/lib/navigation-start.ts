/**
 * Signals that the user started leaving the current view, before the router commits it:
 * a plain click on a same-origin link (including Next links, the sidebar and in-page
 * links) or Back/Forward. Work scheduled for the current view, such as a debounced
 * search, must stop here: waiting for unmount is too late, because a slow navigation can
 * still be overridden by a router.replace issued while it is in flight.
 */

interface ClickLike {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  target: EventTarget | null;
}

interface AnchorLike {
  href: string;
  target: string;
  hasAttribute(name: string): boolean;
}

const asAnchor = (target: EventTarget | null): AnchorLike | null => {
  const element = target as { closest?: (selector: string) => unknown } | null;
  return typeof element?.closest === 'function'
    ? (element.closest('a[href]') as AnchorLike | null)
    : null;
};

/** True for a click the browser or router turns into a navigation of this tab. */
export function isNavigatingClick(event: ClickLike, origin: string): boolean {
  if (event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false; // new tab or window
  const anchor = asAnchor(event.target);
  if (!anchor || anchor.hasAttribute('download')) return false;
  if (anchor.target && anchor.target !== '_self') return false;
  try {
    return new URL(anchor.href, origin).origin === origin;
  } catch {
    return false;
  }
}

/**
 * Calls `listener` whenever a navigation starts. Listens in the capture phase, so it runs
 * before the router handles the click. Returns the unsubscribe function.
 */
export function onNavigationStart(
  listener: () => void,
  targets: { document: EventTarget; window: EventTarget; origin: string } = {
    document,
    window,
    origin: window.location.origin,
  },
): () => void {
  const onClick = (event: Event) => {
    if (isNavigatingClick(event as MouseEvent, targets.origin)) listener();
  };
  targets.document.addEventListener('click', onClick, { capture: true });
  targets.window.addEventListener('popstate', listener);
  return () => {
    targets.document.removeEventListener('click', onClick, { capture: true });
    targets.window.removeEventListener('popstate', listener);
  };
}
