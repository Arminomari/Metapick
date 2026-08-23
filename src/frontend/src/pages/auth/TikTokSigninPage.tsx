import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { stashSocialSignup } from '@/lib/socialAuth';
import { t } from '@/lib/i18n';

/**
 * Landing page for TikTok login/signup (redirect target of the OAuth flow).
 * Existing TikTok-linked account → logged in directly. New account → the
 * encrypted ticket is stashed and the user finishes the signup wizard.
 */
export function TikTokSigninPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const authStore = useAuthStore();
  const [error, setError] = useState('');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    if (!code || !state) { setError(t('Inloggningen avbröts.')); return; }
    (async () => {
      try {
        const res = await api.post<{ data: { status: string; auth?: any; ticket?: string; identity?: { firstName?: string | null; pictureUrl?: string | null } } }>(
          '/auth/tiktok/exchange', { code, state });
        const out = res.data.data;
        if (out.status === 'LoggedIn' && out.auth) {
          authStore.login(out.auth);
          navigate(out.auth.role === 'Brand' ? '/brand' : '/creator', { replace: true });
        } else if (out.status === 'NeedsRegistration' && out.ticket) {
          stashSocialSignup({
            provider: 'TikTok',
            token: out.ticket,
            email: '',
            firstName: out.identity?.firstName ?? undefined,
            pictureUrl: out.identity?.pictureUrl ?? undefined,
          });
          navigate('/register?social=1&role=Creator', { replace: true });
        } else {
          setError(t('Något gick fel. Försök igen.'));
        }
      } catch (err: any) {
        setError(err?.response?.data?.error?.message ?? t('Kunde inte logga in med TikTok. Försök igen.'));
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFF4EC', padding: 'clamp(16px, 4vw, 24px)' }}>
      <div style={{ textAlign: 'center', width: '100%', maxWidth: 420, minWidth: 0 }}>
        {error ? (
          <>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0B0F17' }}>{t('Hoppsan')}</h2>
            <p style={{ color: '#6E7480', marginTop: 10, lineHeight: 1.5, overflowWrap: 'anywhere' }}>{error}</p>
            <a href="/login" style={{ display: 'inline-block', maxWidth: '100%', marginTop: 18, background: '#0B0F17', color: '#FFF4EC', padding: '12px 26px', borderRadius: 980, textDecoration: 'none', fontWeight: 600 }}>{t('Till inloggningen')}</a>
          </>
        ) : (
          <>
            <div style={{ width: 34, height: 34, margin: '0 auto 16px', border: '3px solid #F1A88F', borderTopColor: 'transparent', borderRadius: '50%', animation: 'ttspin .8s linear infinite' }} />
            <style>{'@keyframes ttspin{to{transform:rotate(360deg)}}'}</style>
            <p style={{ color: '#6E7480' }}>{t('Loggar in med TikTok…')}</p>
          </>
        )}
      </div>
    </div>
  );
}
