import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTikTokCallback } from '@/hooks/api';

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
      setError(`TikTok nekade åtkomst: ${searchParams.get('error_description') || errorParam}`);
      return;
    }

    if (!code) {
      setError('Ingen auktoriseringskod mottogs från TikTok.');
      return;
    }

    // Exchange the code for tokens via our backend
    callback.mutate(code, {
      onSuccess: () => {
        setDone(true);
        setTimeout(() => navigate('/creator/profile'), 2000);
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.error?.message || 'Kunde inte ansluta TikTok-kontot.';
        setError(msg);
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const s = {
    page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f', padding: '2rem' } as React.CSSProperties,
    card: { width: '100%', maxWidth: 480, background: '#14141f', border: '1px solid #1e1e2e', borderRadius: '1rem', padding: '2.5rem', textAlign: 'center' } as React.CSSProperties,
  };

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fafafa', marginBottom: '1rem' }}>
          Meta<span style={{ color: '#e84393' }}>Pick</span>
        </div>

        {error ? (
          <>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❌</div>
            <h2 style={{ color: '#e84393', fontSize: '1.25rem', fontWeight: 600, marginBottom: '.5rem' }}>Anslutning misslyckades</h2>
            <p style={{ color: '#8b8ba3', fontSize: '.875rem', marginBottom: '1.5rem' }}>{error}</p>
            <button
              onClick={() => navigate('/creator/profile')}
              style={{ padding: '.75rem 2rem', borderRadius: '.5rem', background: '#e84393', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}
            >
              Tillbaka till profil
            </button>
          </>
        ) : done ? (
          <>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
            <h2 style={{ color: '#4ade80', fontSize: '1.25rem', fontWeight: 600, marginBottom: '.5rem' }}>TikTok anslutet!</h2>
            <p style={{ color: '#8b8ba3', fontSize: '.875rem' }}>Omdirigerar till din profil...</p>
          </>
        ) : (
          <>
            <div style={{ fontSize: '3rem', marginBottom: '1rem', animation: 'spin 1s linear infinite' }}>⏳</div>
            <h2 style={{ color: '#fafafa', fontSize: '1.25rem', fontWeight: 600, marginBottom: '.5rem' }}>Ansluter TikTok...</h2>
            <p style={{ color: '#8b8ba3', fontSize: '.875rem' }}>Vänta medan vi kopplar ditt konto.</p>
          </>
        )}
      </div>
    </div>
  );
}
