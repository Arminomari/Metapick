import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import {
  appleSignIn, facebookSignIn, initGoogle, renderGoogleButton,
  type SocialTokenResult,
} from '@/lib/socialAuth';

interface ProviderInfo { enabled: boolean; clientId: string | null }
interface ProvidersDto { google: ProviderInfo; apple: ProviderInfo; facebook: ProviderInfo }

export function useSocialProviders() {
  return useQuery({
    queryKey: ['social-providers'],
    queryFn: async () => {
      const res = await api.get<{ data: ProvidersDto }>('/auth/social/providers');
      return res.data.data;
    },
    staleTime: 10 * 60_000,
    retry: 1,
  });
}

/**
 * Social sign-in row (Google/Apple/Facebook). Only providers configured on the
 * backend are shown; renders nothing when none are enabled.
 */
export function SocialButtons({ onToken, disabled }: {
  onToken: (result: SocialTokenResult) => void | Promise<void>;
  disabled?: boolean;
}) {
  const { data: providers } = useSocialProviders();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const googleHost = useRef<HTMLDivElement>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  const googleId = providers?.google.enabled ? providers.google.clientId : null;

  useEffect(() => {
    if (!googleId || !googleHost.current) return;
    let cancelled = false;
    void initGoogle(googleId).then(() => {
      if (!cancelled && googleHost.current) {
        renderGoogleButton(googleHost.current, (token) => {
          void onTokenRef.current({ provider: 'Google', token });
        });
      }
    }).catch(() => { /* GIS blocked (adblock etc) — row simply stays empty */ });
    return () => { cancelled = true; };
  }, [googleId]);

  if (!providers || (!providers.google.enabled && !providers.apple.enabled && !providers.facebook.enabled)) {
    return null;
  }

  const run = async (name: string, fn: () => Promise<SocialTokenResult>) => {
    setError('');
    setBusy(name);
    try {
      const result = await fn();
      await onTokenRef.current(result);
    } catch (e: any) {
      const msg: string = e?.message ?? '';
      if (!/avbröts/.test(msg)) setError(msg || 'Inloggningen misslyckades — försök igen');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="social-block">
      <div className="auth-divider"><span>eller fortsätt med</span></div>
      <div className="social-row">
        {providers.google.enabled && <div ref={googleHost} className="gsi-host" aria-label="Fortsätt med Google" />}
        {providers.apple.enabled && (
          <button
            type="button" className="btn-social apple" disabled={disabled || busy !== null}
            onClick={() => void run('apple', () => appleSignIn(providers.apple.clientId!))}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.08ZM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25Z" /></svg>
            {busy === 'apple' ? 'Öppnar…' : 'Fortsätt med Apple'}
          </button>
        )}
        {providers.facebook.enabled && (
          <button
            type="button" className="btn-social facebook" disabled={disabled || busy !== null}
            onClick={() => void run('facebook', () => facebookSignIn(providers.facebook.clientId!))}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M24 12.07C24 5.41 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.32l-.53 3.5h-2.8V24C19.62 23.1 24 18.1 24 12.07" /></svg>
            {busy === 'facebook' ? 'Öppnar…' : 'Fortsätt med Facebook'}
          </button>
        )}
      </div>
      {error && <p className="auth-err" style={{ marginTop: 8 }}>{error}</p>}
    </div>
  );
}
