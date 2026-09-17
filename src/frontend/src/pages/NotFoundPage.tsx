import { Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { homeFor } from '@/lib/session';
import { useTitle } from '@/lib/title';
import { t } from '@/lib/i18n';

/**
 * A mistyped address must never throw a logged-in user out to the marketing
 * page. Inside the shell it renders as a normal view; elsewhere it stands alone.
 */
export function NotFoundPage({ inApp = false }: { inApp?: boolean }) {
  const { isAuthenticated, role } = useAuthStore();
  useTitle(t('Sidan finns inte'));
  const home = isAuthenticated && role ? homeFor(role) : '/';

  const body = (
    <section className="view active reveal" style={{ display: 'grid', placeItems: 'center', minHeight: inApp ? '60vh' : '100vh', padding: 24 }}>
      <div className="card" style={{ maxWidth: 460, width: '100%', padding: '44px 30px', textAlign: 'center' }}>
        <div style={{ fontFamily: '"Fraunces",serif', fontSize: 64, lineHeight: 1, color: '#F1A88F' }}>404</div>
        <h1 style={{ margin: '14px 0 6px', fontSize: 22, fontWeight: 700 }}>{t('Sidan finns inte')}</h1>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--muted)' }}>{t('Adressen kan vara felstavad, eller så har sidan flyttat.')}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 22 }}>
          <Link to={home} className="btn-apply" style={{ width: 'auto', padding: '12px 24px', textDecoration: 'none' }}>{isAuthenticated ? t('Till översikten') : t('Till startsidan')}</Link>
          {!isAuthenticated && <Link to="/login" className="btn-outline" style={{ padding: '12px 22px', textDecoration: 'none' }}>{t('Logga in')}</Link>}
        </div>
      </div>
    </section>
  );
  return inApp ? body : <div className="vy-app">{body}</div>;
}
