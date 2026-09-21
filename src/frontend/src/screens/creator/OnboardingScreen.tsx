/**
 * First-login onboarding for creators: Konto → Koppla TikTok → Profil → Klar.
 * The profile is invisible to brands until the TikTok connection is OAuth-verified
 * (server rule: CreatorVisibility). This screen is where that happens.
 */
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { t } from '@/lib/i18n';
import { useCreatorProfile, usePortfolio } from '@/hooks/api';
import { Button, Card, Page, PageHead, SkeletonList, Badge } from '@/components/ds';
import { TikTokCard } from '@/components/app/AccountForms';
import { ProfileChecklist } from '@/components/app/ProfileChecklist';

function StepHead({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="ds-row" style={{ gap: 8, alignItems: 'center', marginBottom: 8 }}>
      <span className="ds-checklist-mark" style={done ? { background: 'var(--ds-ok, #1F7A4D)', borderColor: 'transparent' } : undefined} aria-hidden>{done && <Check size={14} />}</span>
      <span className="ds-body" style={{ fontWeight: 600 }}>{label}</span>
    </div>
  );
}

export function CreatorOnboardingScreen() {
  const navigate = useNavigate();
  const { data: p, isLoading } = useCreatorProfile();
  const { data: items = [] } = usePortfolio();
  if (isLoading || !p) return <Page><PageHead title={t('Kom igång')} /><SkeletonList rows={3} /></Page>;

  const connected = !!p.tikTokVerified;
  const profileItems = [
    { key: 'avatar', label: t('Lägg till profilbild'), done: !!p.avatarUrl, to: '/creator/profile/edit' },
    { key: 'cover', label: t('Lägg till cover'), done: !!p.coverUrl, to: '/creator/profile/edit' },
    { key: 'bio', label: t('Skriv en bio (minst 20 tecken)'), done: (p.bio ?? '').trim().length >= 20, to: '/creator/profile/edit' },
    { key: 'tags', label: t('Välj minst en expertis-tagg'), done: p.profileTags.length > 0, to: '/creator/profile/edit' },
    { key: 'portfolio', label: t('Lägg till 3 portfolio-verk'), done: items.length >= 3, to: '/creator/profile' },
  ];
  const profileDone = profileItems.every((i) => i.done);
  const step = !connected ? 1 : !profileDone ? 2 : 3;
  const steps = [t('Konto'), t('Koppla TikTok'), t('Profil'), t('Klar')];

  return (
    <Page>
      <PageHead title={t('Kom igång')} back={{ to: '/creator' }} />
      <div>
        <div className="ds-steps">{steps.map((s, i) => <span key={s} className={i <= step ? 'on' : ''} />)}</div>
        <div className="ds-caption ds-muted" style={{ marginTop: 6 }}>{t('Steg')} {step + 1} {t('av')} {steps.length} · {steps[step]}</div>
      </div>

      <Card>
        <Badge tone={p.visibleToBrands ? 'ok' : 'warn'}>{p.visibleToBrands ? t('Synlig för företag') : t('Inte synlig för företag än')}</Badge>
        {p.visibilityBlocker && <p className="ds-body" style={{ marginTop: 8 }}>{p.visibilityBlocker}</p>}
      </Card>

      <Card>
        <StepHead done label={t('Konto')} />
        <p className="ds-body ds-muted">{t('Kontot är skapat.')}</p>
      </Card>

      <Card>
        <StepHead done={connected} label={t('Koppla TikTok')} />
        <p className="ds-body ds-muted" style={{ marginBottom: 10 }}>{t('Obligatoriskt. Via TikToks inloggning hämtas dina videor och views automatiskt — det är så de blir verifierade och betalda. Ett inskrivet användarnamn räcker inte.')}</p>
        <TikTokCard />
      </Card>

      <Card>
        <StepHead done={profileDone} label={t('Profil')} />
        {profileDone ? <p className="ds-body ds-muted">{t('Profilen är komplett.')}</p> : <ProfileChecklist title={t('Det här gör profilen värd att dela')} items={profileItems} />}
      </Card>

      {step === 3 && (
        <Card>
          <StepHead done label={t('Klar')} />
          <p className="ds-body">{t('Din profil är synlig för företag. Nästa steg är att hitta en kampanj eller kran.')}</p>
          <div className="ds-row ds-row--wrap" style={{ marginTop: 12 }}><Button onClick={() => navigate('/creator/browse')}>{t('Upptäck kampanjer')}</Button><Button variant="secondary" onClick={() => navigate('/creator/profile')}>{t('Visa min profil')}</Button></div>
        </Card>
      )}
    </Page>
  );
}
