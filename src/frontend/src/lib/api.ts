import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/stores/authStore';
import { markSessionExpired } from '@/lib/session';
import { notify } from '@/lib/notify';
import { t } from '@/lib/i18n';

const BASE = import.meta.env.VITE_API_URL ?? '/api';

const api = axios.create({
  baseURL: BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Refresh tokens rotate: each one works exactly once. A page fires several
 * requests at the same time, so when the access token expires they all get a
 * 401 together — if each of them tried to refresh, the first would win and
 * the rest would fail and log the user out. One shared promise fixes that.
 * Another tab may also have refreshed already; its tokens are in storage.
 */
let refreshing: Promise<string | null> | null = null;

function tokensFromOtherTab(): string | null {
  try {
    const raw = localStorage.getItem('creatorpay-auth');
    const s = raw ? JSON.parse(raw)?.state : null;
    const mem = useAuthStore.getState();
    if (s?.accessToken && s?.refreshToken && s.refreshToken !== mem.refreshToken) {
      mem.setTokens(s.accessToken, s.refreshToken);
      return s.accessToken as string;
    }
  } catch { /* storage unavailable */ }
  return null;
}

function refreshAccessToken(): Promise<string | null> {
  if (refreshing) return refreshing;
  const adopted = tokensFromOtherTab();
  if (adopted) return Promise.resolve(adopted);
  const refreshToken = useAuthStore.getState().refreshToken;
  if (!refreshToken) return Promise.resolve(null);
  refreshing = axios
    .post(`${BASE}/auth/refresh`, { refreshToken })
    .then(({ data }) => {
      useAuthStore.getState().setTokens(data.data.accessToken, data.data.refreshToken);
      return data.data.accessToken as string;
    })
    .catch(() => tokensFromOtherTab())
    .finally(() => { refreshing = null; });
  return refreshing;
}

function endSession() {
  const here = window.location.pathname + window.location.search;
  const onAuthPage = /^\/(login|register|forgot-password|reset-password|verify-email)/.test(window.location.pathname);
  if (!onAuthPage) markSessionExpired(here);
  useAuthStore.getState().logout();
  if (!onAuthPage) window.location.href = '/login';
}

// Failures nobody at the call site can do anything about get one global toast,
// so a dead server or a rate limit is never silent. 4xx stays with the caller.
let lastGlobalToast = 0;
function globalError(text: string) {
  if (document.visibilityState !== 'visible') return;
  if (Date.now() - lastGlobalToast < 20_000) return;
  lastGlobalToast = Date.now();
  notify(text, 'error');
}

api.interceptors.response.use(
  (response) => {
    // A 2xx that says success:false is still a failure — never let it read as done.
    if (response.data && typeof response.data === 'object' && response.data.success === false) {
      return Promise.reject(new AxiosError('Request reported failure', 'ERR_BAD_RESPONSE', response.config, response.request, response));
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const url = originalRequest?.url ?? '';
    const isCredentialCall = /\/auth\/(login|register|social|refresh|forgot-password|reset-password|verify-email)/.test(url);

    if (status === 401 && originalRequest && !isCredentialCall && !('_retried' in originalRequest)) {
      Object.assign(originalRequest, { _retried: true });

      // Someone already refreshed while this request was in flight — just retry.
      const current = useAuthStore.getState().accessToken;
      const used = String(originalRequest.headers?.Authorization ?? '');
      const token = current && used !== `Bearer ${current}` ? current : await refreshAccessToken();
      if (token) {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      }
      endSession();
      return Promise.reject(error);
    }

    if (!error.response) {
      if (error.code !== 'ERR_CANCELED') globalError(t('Ingen kontakt med servern. Kontrollera uppkopplingen och försök igen.'));
    } else if (status === 429) {
      globalError(t('För många försök på kort tid. Vänta en minut och försök igen.'));
    } else if (status !== undefined && status >= 500) {
      globalError(t('Något gick fel hos oss. Försök igen om en stund.'));
    }
    return Promise.reject(error);
  },
);

export default api;
