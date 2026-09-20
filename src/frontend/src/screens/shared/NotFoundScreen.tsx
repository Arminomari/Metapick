/** 404 inside the shell, in the design system. */
import { useAuthStore } from '@/stores/authStore';
import { homeFor } from '@/lib/session';
import { t } from '@/lib/i18n';
import { Button, Card, EmptyState, Page, PageHead } from '@/components/ds';

export function NotFoundScreen() {
  const { role } = useAuthStore();
  return (
    <Page>
      <PageHead title={t('Sidan finns inte')} />
      <Card><EmptyState title="404" description={t('Adressen kan vara felstavad, eller så har sidan flyttat.')} action={<Button to={homeFor(role)}>{t('Till start')}</Button>} /></Card>
    </Page>
  );
}
