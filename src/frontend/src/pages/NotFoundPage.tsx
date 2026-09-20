import { useAuthStore } from '@/stores/authStore';
import { homeFor } from '@/lib/session';
import { useTitle } from '@/lib/title';
import { t } from '@/lib/i18n';
import { Button, Card, EmptyState } from '@/components/ds';

/**
 * A mistyped address must never throw a logged-in user out to the marketing
 * page. Standalone (outside the shells), in the design system.
 */
export function NotFoundPage() {
  const { isAuthenticated, role } = useAuthStore();
  useTitle(t('Sidan finns inte'));
  const home = isAuthenticated && role ? homeFor(role) : '/';
  return (
    <div className="ds-root" style={{ display: 'grid', placeItems: 'center', padding: 24 }}>
      <Card style={{ maxWidth: 420, width: '100%' }}>
        <EmptyState title={t('Sidan finns inte')} description={t('Adressen kan vara felstavad, eller så har sidan flyttat.')}
          action={<div className="ds-row ds-row--wrap" style={{ justifyContent: 'center' }}><Button to={home}>{isAuthenticated ? t('Till översikten') : t('Till startsidan')}</Button>{!isAuthenticated && <Button variant="secondary" to="/login">{t('Logga in')}</Button>}</div>} />
      </Card>
    </div>
  );
}
