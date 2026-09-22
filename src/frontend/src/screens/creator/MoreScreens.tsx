/** The smaller Profil sub-screens: Creator-nivå, Sparat, Inställningar and its sub-screens, Länkar. */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, ChevronRight } from 'lucide-react';
import { t } from '@/lib/i18n';
import { money, formatDate, formatNumber, categoryLabel, payoutSummaryText, plural } from '@/lib/utils';
import { useSavedCampaigns, useToggleSaveCampaign, useCreatorAssignments, useCreatorProfile } from '@/hooks/api';
import { useUgcCreatorProfile, useUpsertUgcCreatorProfile, UGC_CATEGORIES, UGC_REGIONS, RIGHTS_LABEL, apiError } from '@/hooks/ugc';
import { useToast } from '@/components/vyrle/Toast';
import { Avatar, Badge, Button, Card, Checkbox, EmptyState, Field, List, ListRow, Meter, Page, PageHead, Section, SkeletonList } from '@/components/ds';
import { MoreMenu } from '@/components/app/common';
import { ChangeEmailForm, ChangePasswordForm, DeleteAccountForm, LanguagePicker, TikTokCard } from '@/components/app/AccountForms';
import { useLevel } from './ProfileScreen';

export function LevelsScreen() {
  const level = useLevel();
  const { data: asg } = useCreatorAssignments(undefined, 1, 100);
  const completed = (asg?.data ?? []).filter((a) => a.status === 'Completed').length;
  const pct = level.progress;
  return (
    <Page>
      <PageHead title={t('Creator-nivå')} back={{ to: '/creator/profile' }} />
      <Card>
        <div className="ds-caption ds-muted">{t('Din nivå')}</div>
        <div className="ds-hero-number">{level.tier.name}</div>
        <p className="ds-caption ds-muted" style={{ margin: '4px 0 12px' }}>{money(level.paid)} {t('utbetalt')} · {completed} {completed === 1 ? t('slutförd kampanj') : t('slutförda kampanjer')}</p>
        <Meter value={pct} max={100} left={level.tier.name} right={level.next ? `${money(level.next.min)} → ${level.next.name}` : t('Högsta nivån')} />
      </Card>
      <Section title={t('Alla nivåer')}>
        <List>
          {level.tiers.map((tier, i) => <ListRow key={tier.name} leading={<Avatar name={String(i + 1)} size="sm" />} title={tier.name} badge={i === level.idx ? <Badge tone="accent">{t('Du är här')}</Badge> : i < level.idx ? <Badge tone="ok">{t('Upplåst')}</Badge> : undefined} subtitle={tier.min === 0 ? t('Start') : `${t('Låses upp vid')} ${money(tier.min)} ${t('utbetalt')}`} chevron={false} />)}
        </List>
        <p className="ds-caption ds-muted">{t('Din nivå bygger på hur mycket du fått utbetalt via VYRLE och låses upp automatiskt.')} {t('Beräknas på servern ur utbetalningsboken.')}</p>
      </Section>
    </Page>
  );
}

export function SavedScreen() {
  const toast = useToast();
  const { data: saved = [], isLoading } = useSavedCampaigns();
  const toggle = useToggleSaveCampaign();
  return (
    <Page>
      <PageHead title={t('Sparat')} back={{ to: '/creator/profile' }} />
      {isLoading ? <SkeletonList rows={3} /> : saved.length === 0 ? <Card><EmptyState icon={<Bookmark />} title={t('Inget sparat ännu')} description={t('Tryck på bokmärket på kampanjer som fångar ditt öga, så samlas de här.')} action={<Button to="/creator/browse">{t('Upptäck kampanjer')}</Button>} /></Card> : (
        <List>
          {saved.filter((s) => s.campaign?.id).map(({ campaign: c, savedAt }) => (
            <ListRow key={c.id} leading={<Avatar name={c.brandName || c.name} rounded />} title={c.name} badge={c.spotsLeft <= 0 ? <Badge>{t('Fullbokad')}</Badge> : undefined} subtitle={`${c.brandName} · ${categoryLabel(c.category)} · ${payoutSummaryText(c.payoutSummary)} · ${plural(c.spotsLeft, t('plats kvar'), t('platser kvar'))} · ${t('sparad')} ${formatDate(savedAt)}`} wrapSubtitle chevron={false}
              trailing={<MoreMenu items={[{ label: t('Öppna kampanjen'), to: `/creator/campaigns/${c.id}` }, { label: t('Ta bort från sparade'), danger: true, onClick: () => toggle.mutate({ campaignId: c.id, save: false }, { onSuccess: () => toast.push(t('Borttagen från Sparat'), 'success') }) }]} />}
              to={`/creator/campaigns/${c.id}`} />
          ))}
        </List>
      )}
    </Page>
  );
}

export function SettingsScreen() {
  const navigate = useNavigate();
  const { data: p } = useCreatorProfile();
  return (
    <Page>
      <PageHead title={t('Inställningar')} back={{ to: '/creator/profile' }} />
      <List>
        <ListRow title={t('TikTok-konto')} subtitle={p?.tikTokConnected ? `@${p.tikTokUsername}` : t('Ej anslutet')} to="/creator/settings/tiktok" />
        <ListRow title={t('Videouppdrag')} subtitle={t('Kategorier, stad och rättigheter för matchning')} to="/creator/settings/ugc" />
        <ListRow title={t('Konto')} subtitle={t('E-post, lösenord, radera konto')} to="/creator/settings/account" />
      </List>
      <Section title={t('Språk')}><Card><LanguagePicker /></Card></Section>
      <List>
        <ListRow title={t('Hjälp & support')} subtitle={t('Skriv till VYRLE-teamet')} onClick={() => navigate('/creator/messages?thread=support')} />
        <ListRow title={t('Villkor')} trailing={<ChevronRight className="ds-listrow-chevron" />} chevron={false} onClick={() => window.open('/terms', '_blank', 'noopener')} />
        <ListRow title={t('Integritet')} trailing={<ChevronRight className="ds-listrow-chevron" />} chevron={false} onClick={() => window.open('/privacy', '_blank', 'noopener')} />
      </List>
    </Page>
  );
}

export function SettingsTikTokScreen() {
  return <Page><PageHead title={t('TikTok-konto')} back={{ to: '/creator/settings' }} /><TikTokCard /><p className="ds-caption ds-muted">{t('Säker inloggning med TikTok. VYRLE läser endast din profil, statistik och videor.')}</p></Page>;
}

export function SettingsAccountScreen() {
  return (
    <Page>
      <PageHead title={t('Konto')} back={{ to: '/creator/settings' }} />
      <Card title={t('Byt e-postadress')}><ChangeEmailForm /></Card>
      <Card title={t('Byt lösenord')}><ChangePasswordForm /></Card>
      <Card title={t('Radera konto')}><DeleteAccountForm /></Card>
    </Page>
  );
}

export function SettingsUgcScreen() {
  const toast = useToast();
  const { data: p, isLoading } = useUgcCreatorProfile();
  const upsert = useUpsertUgcCreatorProfile();
  const [form, setForm] = useState<null | { categories: string[]; city: string; region: string; sampleVideoUrl: string; allowPortfolioUse: boolean }>(null);
  useEffect(() => { if (p && !form) setForm({ categories: p.categories, city: p.city ?? '', region: p.region ?? '', sampleVideoUrl: p.sampleVideoUrl ?? '', allowPortfolioUse: p.allowPortfolioUse }); }, [p, form]);
  if (isLoading || !form) return <Page><PageHead title={t('Videouppdrag')} back={{ to: '/creator/settings' }} /><SkeletonList rows={2} /></Page>;
  return (
    <Page>
      <PageHead title={t('Videouppdrag')} back={{ to: '/creator/settings' }} />
      <Card title={t('Så matchas du')}>
        <div className="ds-stack" style={{ gap: 12 }}>
          <div><div className="ds-field-label" style={{ marginBottom: 6 }}>{t('Kategorier')} <span className="ds-muted">({form.categories.length}/6)</span></div><div className="ds-tags">{UGC_CATEGORIES.map((c) => <button key={c} type="button" className={`ds-tag${form.categories.includes(c) ? ' ds-tag--on' : ''}`} onClick={() => setForm({ ...form, categories: form.categories.includes(c) ? form.categories.filter((x) => x !== c) : [...form.categories, c].slice(0, 6) })}>{c}</button>)}</div></div>
          <div className="ds-kv">
            <Field label={t('Stad')}><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
            <Field label={t('Region')}><select value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })}><option value="">–</option>{UGC_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}</select></Field>
          </div>
          <Field label={t('Exempelvideo (länk)')} hint={t('Valfritt. Visas för företaget när du ansöker.')}><input value={form.sampleVideoUrl} onChange={(e) => setForm({ ...form, sampleVideoUrl: e.target.value })} placeholder="https://…" /></Field>
        </div>
      </Card>
      <Card title={t('Rättigheter')}>
        <Checkbox label={t('VYRLE får visa mina levererade videor i min portfolio och i marknadsföring av tjänsten')} checked={form.allowPortfolioUse} onChange={(e) => setForm({ ...form, allowPortfolioUse: e.target.checked })} />
        <p className="ds-caption ds-muted" style={{ marginTop: 8 }}>{t('Rättighetspaketet per uppdrag står i kontraktet')}: {Object.values(RIGHTS_LABEL).map((v) => t(v)).join(' · ')}.</p>
      </Card>
      <div className="ds-sticky-action"><Button full loading={upsert.isPending} onClick={() => upsert.mutate(form as never, { onSuccess: () => toast.push(t('Sparat'), 'success'), onError: (e) => toast.push(apiError(e, t('Kunde inte spara')), 'error') })}>{t('Spara')}</Button></div>
    </Page>
  );
}

/** Tracked campaign links (behind FEATURES.linkTree). */
export function LinksScreen() {
  const { data: res } = useCreatorAssignments(undefined, 1, 100);
  const live = (res?.data ?? []).filter((a) => ['Active', 'Completed'].includes(a.status));
  return (
    <Page>
      <PageHead title={t('Länkar')} back={{ to: '/creator/profile' }} />
      <p className="ds-body ds-muted">{t('Varje kampanj du kör får en spårad länk. Klicken här är de attribuerade klick som räknas mot dina klickbaserade utbetalningar.')}</p>
      {live.length === 0 ? <Card><EmptyState title={t('Inga live-länkar ännu')} action={<Button to="/creator/browse">{t('Upptäck kampanjer')}</Button>} /></Card> : (
        <List>{live.map((a) => <ListRow key={a.id} leading={<Avatar name={a.campaignName} size="sm" rounded />} title={a.campaignName} subtitle={t('spårad länk')} value={`${formatNumber(a.totalTrackedClicks || 0)} ${t('klick')}`} to={`/creator/assignments/${a.id}`} />)}</List>
      )}
    </Page>
  );
}
