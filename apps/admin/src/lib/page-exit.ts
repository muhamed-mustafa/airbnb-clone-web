/** A short visual exit after the request settles; never delays sending credentials or logout. */
export async function animatePageExit() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!document.body.animate) return;
  try {
    await document.body.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 160,
      easing: 'ease-out',
      fill: 'forwards',
    }).finished;
  } catch {
    // An interrupted animation must never prevent navigation.
  }
}
