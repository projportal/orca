/**
 * Whether a touch on the browser viewport may reach the desktop page.
 *
 * While markup is armed the finger draws on a frozen screenshot; forwarding it as a
 * browser.mouseClick, mouseMove or wheel would click and scroll the live page underneath the
 * drawing. A blocking page dialog already owns the viewport the same way.
 */
export function shouldForwardBrowserTouch(state: {
  dialogOpen: boolean
  markupArmed: boolean
}): boolean {
  return !state.dialogOpen && !state.markupArmed
}
