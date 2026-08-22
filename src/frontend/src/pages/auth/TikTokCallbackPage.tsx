import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTikTokCallback } from '@/hooks/api';
import { t } from '@/lib/i18n';

export function TikTokCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const callback = useTikTokCallback();
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    const code = searchParams.get('code');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError(`${t('TikTok nekade åtkomst:')} ${searchParams.get('error_description') || errorParam}`);
      return;
    }

    if (!code) {
      setError(t('Ingen auktoriseringskod mottogs från TikTok.'));
      return;
    }

    // Exchange the code for tokens via our backend
    callback.mutate(code, {
      onSuccess: () => {
        setDone(true);
        setTimeout(() => navigate('/creator/profile'), 2000);
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.error?.message || t('Kunde inte ansluta TikTok-kontot.');
        setError(msg);
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const box: React.CSSProperties = { width: '100%', maxWidth: 460, background: 'rgba(255,255,255,.85)', border: '1px solid rgba(241,168,143,.3)', borderRadius: 22, padding: '2.4rem 2rem', textAlign: 'center', boxShadow: '0 14px 40px rgba(180,120,90,.12)' };

  return (
    <div className="vy-app" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(1000px 500px at 15% -5%, rgba(255,216,199,.55), transparent 60%), #FFF4EC', padding: '2rem' }}>
      <div style={box}>
        <div style={{ fontFamily: '"Fraunces",serif', fontSize: '1.4rem', fontWeight: 700, color: '#0B0F17', marginBottom: '1.2rem' }}>✦ VYRLE</div>

        {error ? (
          <>
            <div style={{ width: 54, height: 54, margin: '0 auto 14px', borderRadius: '50%', background: 'rgba(255,90,77,.14)', color: '#c0392b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }} aria-hidden>✕</div>
            <h2 style={{ color: '#0B0F17', fontSize: '1.15rem', fontWeight: 700, margin: '0 0 .5rem' }}>{t('Anslutning misslyckades')}</h2>
            <p style={{ color: '#8a8f9c', fontSize: '.88rem', margin: '0 0 1.4rem', lineHeight: 1.55 }}>{error}</p>
            <button onClick={() => navigate('/creator/profile')} className="btn-apply" style={{ width: 'auto', padding: '12px 26px' }}>
              {t('Tillbaka till profil')}
            </button>
          </>
        ) : done ? (
          <>
            <div style={{ width: 54, height: 54, margin: '0 auto 14px', borderRadius: '50%', background: 'linear-gradient(135deg,#3dbb77,#2f9d5b)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }} aria-hidden>✓</div>
            <h2 style={{ color: '#0B0F17', fontSize: '1.15rem', fontWeight: 700, margin: '0 0 .5rem' }}>{t('TikTok anslutet!')}</h2>
            <p style={{ color: '#8a8f9c', fontSize: '.88rem', margin: 0 }}>{t('Omdirigerar till din profil...')}</p>
          </>
        ) : (
          <>
            <div style={{ width: 54, height: 54, margin: '0 auto 14px', borderRadius: '50%', background: '#0B0F17', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }} aria-hidden>♪</div>
            <h2 style={{ color: '#0B0F17', fontSize: '1.15rem', fontWeight: 700, margin: '0 0 .5rem' }}>{t('Ansluter TikTok...')}</h2>
            <p style={{ color: '#8a8f9c', fontSize: '.88rem', margin: 0 }}>{t('Vänta medan vi kopplar ditt konto.')}</p>
          </>
        )}
      </div>
    </div>
  );
}
