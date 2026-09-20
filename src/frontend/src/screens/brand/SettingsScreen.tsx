/** Brand settings: account, language, help. Company details live under Profil › Företagsprofil. */
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { t } from '@/lib/i18n';
import { Card, List, ListRow, Page, PageHead, Section } from '@/components/ds';
import { ChangeEmailForm, ChangePasswordForm, DeleteAccountForm, LanguagePicker } from '@/components/app/AccountForms';

export function BrandSettingsScreen() {
  const navigate = useNavigate();
  return (
    <Page>
      <PageHead title={t('Inställningar')} back={{ to: '/brand/profile' }} />
      <List>
        <ListRow title={t('Företagsprofil')} subtitle={t('Logotyp, org.nr, bransch, beskrivning')} to="/brand/profile/edit" />
        <ListRow title={t('Konto')} subtitle={t('E-post, lösenord, radera konto')} to="/brand/settings/account" />
      </List>
      <Section title={t('Språk')}><Card><LanguagePicker /></Card></Section>
      <List>
        <ListRow title={t('Hjälp & support')} subtitle={t('Skriv till VYRLE-teamet')} onClick={() => navigate('/brand/messages?thread=support')} />
        <ListRow title={t('Villkor')} trailing={<ChevronRight className="ds-listrow-chevron" />} chevron={false} onClick={() => window.open('/terms', '_blank', 'noopener')} />
        <ListRow title={t('Integritet')} trailing={<ChevronRight className="ds-listrow-chevron" />} chevron={false} onClick={() => window.open('/privacy', '_blank', 'noopener')} />
      </List>
    </Page>
  );
}

export function BrandSettingsAccountScreen() {
  return (
    <Page>
      <PageHead title={t('Konto')} back={{ to: '/brand/settings' }} />
      <Card title={t('Byt e-postadress')}><ChangeEmailForm /></Card>
      <Card title={t('Byt lösenord')}><ChangePasswordForm /></Card>
      <Card title={t('Radera konto')}><DeleteAccountForm /></Card>
    </Page>
  );
}
