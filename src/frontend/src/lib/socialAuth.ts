/**
 * Client-side glue for social login. Loads each provider's SDK on demand and
 * returns a token the backend verifies server-side:
 *  - Google → ID token (credential from Google Identity Services)
 *  - Apple  → identity token (JWT from Sign in with Apple JS)
 *  - Facebook → access token (verified via Graph debug_token)
 */

declare global {
  interface Window {
    google?: any;
    AppleID?: any;
    FB?: any;
    fbAsyncInit?: () => void;
  }
}

export type SocialProvider = 'Google' | 'Apple' | 'Facebook';

export interface SocialTokenResult {
  provider: SocialProvider;
  token: string;
  /** Apple only sends the name once, in the first authorization response. */
  firstName?: string;
  lastName?: string;
}

const loadedScripts = new Map<string, Promise<void>>();

function loadScript(src: string): Promise<void> {
  const existing = loadedScripts.get(src);
  if (existing) return existing;
  const p = new Promise<void>((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`Kunde inte ladda ${src}`));
    document.head.appendChild(el);
  });
  loadedScripts.set(src, p);
  return p;
}

// ── Google ─────────────────────────────────────────────────
let googleInited = false;
let googleCredentialResolve: ((credential: string) => void) | null = null;

export async function initGoogle(clientId: string): Promise<void> {
  await loadScript('https://accounts.google.com/gsi/client');
  if (googleInited || !window.google?.accounts?.id) return;
  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: (response: { credential: string }) => {
      // Keep the handler registered: if the first backend call fails, the user
      // can press the Google button again and still reach us.
      googleCredentialResolve?.(response.credential);
    },
  });
  googleInited = true;
}

/**
 * Renders Google's official sign-in button into `host` (required by Google's
 * branding policy for the ID-token flow) and resolves with the credential
 * when the user completes sign-in.
 */
export function renderGoogleButton(host: HTMLElement, onCredential: (token: string) => void): void {
  if (!window.google?.accounts?.id) return;
  googleCredentialResolve = onCredential;
  window.google.accounts.id.renderButton(host, {
    theme: 'outline',
    size: 'large',
    shape: 'pill',
    text: 'continue_with',
    width: Math.min(380, host.clientWidth || 380),
    locale: 'sv_SE',
  });
}

// ── Apple ──────────────────────────────────────────────────
export async function appleSignIn(clientId: string): Promise<SocialTokenResult> {
  await loadScript('https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js');
  if (!window.AppleID) throw new Error('Apple-inloggning kunde inte laddas');
  window.AppleID.auth.init({
    clientId,
    scope: 'name email',
    redirectURI: `${window.location.origin}/login`,
    usePopup: true,
  });
  const res = await window.AppleID.auth.signIn();
  const token = res?.authorization?.id_token;
  if (!token) throw new Error('Apple-inloggningen avbröts');
  return {
    provider: 'Apple',
    token,
    firstName: res?.user?.name?.firstName,
    lastName: res?.user?.name?.lastName,
  };
}

// ── Facebook ───────────────────────────────────────────────
let fbInited = false;

export async function facebookSignIn(appId: string): Promise<SocialTokenResult> {
  await loadScript('https://connect.facebook.net/sv_SE/sdk.js');
  if (!window.FB) throw new Error('Facebook-inloggning kunde inte laddas');
  if (!fbInited) {
    window.FB.init({ appId, cookie: false, xfbml: false, version: 'v19.0' });
    fbInited = true;
  }
  const token = await new Promise<string>((resolve, reject) => {
    window.FB.login(
      (response: any) => {
        if (response?.authResponse?.accessToken) resolve(response.authResponse.accessToken);
        else reject(new Error('Facebook-inloggningen avbröts'));
      },
      { scope: 'public_profile,email' },
    );
  });
  return { provider: 'Facebook', token };
}

// ── Pending social signup hand-off (login → register wizard) ──
const SOCIAL_SIGNUP_KEY = 'vyrle-social-signup';

export interface PendingSocialSignup {
  provider: SocialProvider;
  token: string;
  email: string;
  firstName?: string;
  lastName?: string;
  pictureUrl?: string;
}

export function stashSocialSignup(data: PendingSocialSignup): void {
  sessionStorage.setItem(SOCIAL_SIGNUP_KEY, JSON.stringify(data));
}

export function readSocialSignup(): PendingSocialSignup | null {
  try {
    const raw = sessionStorage.getItem(SOCIAL_SIGNUP_KEY);
    return raw ? (JSON.parse(raw) as PendingSocialSignup) : null;
  } catch {
    return null;
  }
}

export function clearSocialSignup(): void {
  sessionStorage.removeItem(SOCIAL_SIGNUP_KEY);
}
