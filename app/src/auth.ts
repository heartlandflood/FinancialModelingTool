// Soft password gate. This is NOT real security — the value lives in the
// client bundle and anyone who downloads the JS can read it. It's just a
// "casual visitor" check, the same kind of friction as a private link.
//
// Change PASSWORD to whatever you want operators to type. After a
// successful entry, the choice is remembered in sessionStorage, so closing
// the tab (or window) drops it. Refreshing the page does not.
//
// To rotate the password: edit this constant, redeploy, and tell operators
// the new value out-of-band.

export const PASSWORD = 'heartland2026';

const SESSION_KEY = 'hcf:auth';
const SEEN_WELCOME_KEY = 'hcf:welcomed';

export function isAuthenticated(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === 'true';
  } catch {
    return false;  // private browsing / storage disabled
  }
}

export function tryAuthenticate(input: string): boolean {
  if (input.trim() === PASSWORD) {
    try { sessionStorage.setItem(SESSION_KEY, 'true'); } catch { /* noop */ }
    return true;
  }
  return false;
}

export function logout(): void {
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* noop */ }
}

export function hasSeenWelcome(): boolean {
  try { return sessionStorage.getItem(SEEN_WELCOME_KEY) === 'true'; } catch { return true; }
}

export function markWelcomeSeen(): void {
  try { sessionStorage.setItem(SEEN_WELCOME_KEY, 'true'); } catch { /* noop */ }
}
