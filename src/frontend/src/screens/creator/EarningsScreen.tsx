/** Intäkter: the money that is ready first, then how to get paid, then history. */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { t } from '@/lib/i18n';
import { money, formatDate, formatNumber } from '@/lib/utils';
import { maskSwishNumber, maskBankAccount } from '@/lib/masks';
import { useCreatorPayouts, usePayoutMethod, useSetPayoutMethod, useReceivedPrOffers } from '@/hooks/api';
import { usePayables, useRequestPayable } from '@/hooks/extra';
import { useUgcCreatorProfile, useUpsertUgcCreatorProfile, useUgcPayoutStatus, useStartUgcPayoutOnboarding, apiError } from '@/hooks/ugc';
import { useToast } from '@/components/vyrle/Toast';
import { Avatar, Badge, BottomSheet, Button, Card, Checkbox, Chip, Chips, EmptyState, Field, List, ListRow, Page, PageHead, Section, SegmentedControl, SkeletonList, StatusBadge } from '@/components/ds';
import { apiMessage } from '@/components/app/common';

const METHOD: Record<string, { label: string; hint: string; placeholder: string }> = {
  BankTransfer: { label: t('Bankkonto'), hint: t('Clearing + kontonummer'), placeholder: 'XXXX-X XXX XXX XXX-X' },
  Swish: { label: 'Swish', hint: t('Mobilnummer kopplat till Swish'), placeholder: '070-123 45 67' },
  PayPal: { label: 'PayPal', hint: t('E-postadress för ditt PayPal-konto'), placeholder: 'du@exempel.se' },
};

export function EarningsScreen() {
  const navigate = useNavigate();
  const toast = useToast();
  const { data: payables = [], isLoading } = usePayables();
  const request = useRequestPayable();
  const { data: pm } = usePayoutMethod();
  const { data: offers } = useReceivedPrOffers();
  const { data: ugc } = useUgcCreatorProfile();
  const [tab, setTab] = useState<'pending' | 'approved' | 'paid'>('pending');
  const [page, setPage] = useState(1);
  const { data: payouts } = useCreatorPayouts(tab === 'pending' ? 'Pending' : tab === 'approved' ? 'Approved' : 'Completed', page);
  const [method, setMethod] = useState(false);
  const [how, setHow] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const available = payables.reduce((s, p) => s + p.available, 0);
  const prValue = (offers?.data ?? []).filter((o) => o.status === 'Accepted' || o.status === 'Completed').reduce((s, o) => s + (o.productValue ?? 0) + (o.compensationAmount ?? 0), 0);
  const rows = payouts?.data ?? [];
  const pages = payouts ? Math.ceil(payouts.totalCount / payouts.pageSize) : 1;

  return (
    <Page>
      <PageHead title={t('Intäkter')} back={{ to: '/creator/profile' }} />
      <Card>
        <div className="ds-caption ds-muted">{t('Att hämta ut')}</div>
        <div className="ds-hero-number ds-num" style={{ color: available > 0 ? 'var(--ds-accent)' : undefined }}>{money(available)}</div>
        <p className="ds-caption ds-muted" style={{ marginTop: 4 }}>{available > 0 ? t('Verifierade views som är klara att betalas ut till din valda metod.') : t('Inget att begära ut ännu. Så fort dina views verifierats dyker beloppet upp här.')}</p>
        {!pm?.isConfigured && available > 0 && <p className="ds-caption" style={{ color: 'var(--ds-warn)', marginTop: 6 }}>{t('Lägg till en utbetalningsmetod nedan innan du begär.')}</p>}
      </Card>

      {isLoading ? <SkeletonList rows={2} /> : payables.length > 0 && (
        <List>
          {payables.map((p) => (
            <ListRow key={p.assignmentId} leading={<Avatar name={p.campaignName} rounded size="sm" />} title={p.campaignName} badge={p.isTap ? <Badge tone="accent">{t('Kran')}</Badge> : undefined}
              subtitle={`${formatNumber(p.verifiedViews)} views · ${t('intjänat')} ${money(p.earned)}${p.alreadyClaimed > 0 ? ` · ${t('utbetalt')} ${money(p.alreadyClaimed)}` : ''}`} wrapSubtitle chevron={false}
              trailing={p.hasPendingRequest ? <Badge tone="warn">{t('Pågår')}</Badge> : p.available > 0 ? <Button size="sm" loading={request.isPending && busyId === p.calculationId} onClick={() => { setBusyId(p.calculationId); request.mutate(p.calculationId, { onSuccess: () => toast.push(t('Utbetalning begärd! Vi granskar och betalar ut till din valda metod.'), 'success'), onError: (e) => toast.push(apiMessage(e, t('Kunde inte begära utbetalning')), 'error') }); }}>{money(p.available)}</Button> : <Badge>{t('Allt utbetalt')}</Badge>} />
          ))}
        </List>
      )}

      <Section title={t('Så får du betalt')}>
        <List>
          <ListRow title={t('Utbetalningsmetod')} subtitle={pm?.isConfigured ? `${METHOD[pm.method ?? '']?.label ?? pm.method} · ${pm.maskedDetails}` : t('Bankkonto, Swish eller PayPal')} badge={!pm?.isConfigured ? <Badge tone="warn">{t('Saknas')}</Badge> : undefined} onClick={() => setMethod(true)} />
          <ListRow title={t('Verifiering & skatt')} subtitle={ugc?.payoutOnboardingComplete ? t('Verifierad hos Stripe') : t('Krävs för betalda videouppdrag')} badge={ugc ? <Badge tone={ugc.status === 'Suspended' ? 'bad' : ugc.payoutOnboardingComplete ? 'ok' : 'neutral'}>{ugc.status === 'Suspended' ? t('Avstängd') : ugc.payoutOnboardingComplete ? t('Klar') : t('Valfri')}</Badge> : undefined} onClick={() => navigate('/creator/earnings/verification')} />
          <ListRow title={t('PR-värde att deklarera')} subtitle={t('Produkter och ersättning från accepterade PR-erbjudanden')} value={money(prValue)} chevron={false} />
          <ListRow title={t('Från visning till pengar på kontot')} onClick={() => setHow(true)} />
        </List>
      </Section>

      <Section title={t('Historik')}>
        <SegmentedControl segments={[{ key: 'pending', label: t('Väntande') }, { key: 'approved', label: t('Godkänt') }, { key: 'paid', label: t('Utbetalt') }]} value={tab} onChange={(k) => { setTab(k); setPage(1); }} />
        {rows.length === 0 ? <Card><EmptyState title={t('Inget här ännu')} /></Card> : (
          <List>
            {rows.map((p) => <ListRow key={p.id} leading={<Avatar name={p.campaignName} size="sm" rounded />} title={p.campaignName} subtitle={`${formatDate(p.createdAt)}${p.paidAt ? ` · ${t('utbetald')} ${formatDate(p.paidAt)}` : ''}${p.payoutMethod ? ` · ${METHOD[p.payoutMethod]?.label ?? p.payoutMethod}` : ''}`} value={money(p.amount)} trailing={<StatusBadge status={p.status} />} chevron={false} />)}
          </List>
        )}
        {pages > 1 && <div className="ds-row" style={{ justifyContent: 'space-between' }}><Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t('Föregående')}</Button><span className="ds-caption ds-muted">{page} / {pages}</span><Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>{t('Nästa')}</Button></div>}
      </Section>

      <PayoutMethodSheet open={method} onClose={() => setMethod(false)} />
      <BottomSheet open={how} onClose={() => setHow(false)} title={t('Så får du betalt')}>
        <ol className="ds-body" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
          <li>{t('Du lägger till din video — dina visningar verifieras automatiskt via TikTok.')}</li>
          <li>{t('Varje natt räknas din intjäning om enligt kampanjens villkor.')}</li>
          <li>{t('När beloppet är verifierat begär du utbetalning här.')}</li>
          <li>{t('Pengarna går till din valda metod — Swish, bank eller PayPal.')}</li>
        </ol>
      </BottomSheet>
    </Page>
  );
}

function PayoutMethodSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: pm } = usePayoutMethod();
  const set = useSetPayoutMethod();
  const toast = useToast();
  const [type, setType] = useState('BankTransfer');
  const [details, setDetails] = useState('');
  const [holder, setHolder] = useState('');
  useEffect(() => { if (open) { setType(pm?.method || 'BankTransfer'); setDetails(''); setHolder(pm?.accountHolder || ''); } }, [open, pm]);
  const save = async () => {
    try { await set.mutateAsync({ method: type, details: details.trim(), accountHolder: holder.trim() || undefined }); toast.push(t('Utbetalningsmetod sparad'), 'success'); onClose(); }
    catch (e) { toast.push(apiMessage(e, t('Kunde inte spara utbetalningsmetoden')), 'error'); }
  };
  const meta = METHOD[type];
  return (
    <BottomSheet open={open} onClose={onClose} title={t('Utbetalningsmetod')} footer={<><Button variant="secondary" onClick={onClose}>{t('Avbryt')}</Button><Button loading={set.isPending} disabled={details.trim().length < 4} onClick={() => void save()}>{t('Spara')}</Button></>}>
      {pm?.isConfigured && <p className="ds-caption ds-muted">{t('Nuvarande')}: {METHOD[pm.method ?? '']?.label ?? pm.method} · {pm.maskedDetails}</p>}
      <Chips>{Object.entries(METHOD).map(([k, m]) => <Chip key={k} selected={type === k} onClick={() => { setType(k); setDetails(''); }}>{m.label}</Chip>)}</Chips>
      <Field label={meta.hint}><input value={details} inputMode={type === 'PayPal' ? 'email' : 'numeric'} onChange={(e) => setDetails(type === 'Swish' ? maskSwishNumber(e.target.value) : type === 'BankTransfer' ? maskBankAccount(e.target.value) : e.target.value)} placeholder={meta.placeholder} autoComplete="off" /></Field>
      <Field label={t('Kontoinnehavare')}><input value={holder} onChange={(e) => setHolder(e.target.value)} placeholder={t('För- och efternamn')} /></Field>
      <p className="ds-caption ds-muted">{t('Krypteras med AES-256 innan lagring. Används vid dina utbetalningar.')}</p>
    </BottomSheet>
  );
}

/** Stripe verification and tax facts, one level under Intäkter. */
export function VerificationScreen() {
  const toast = useToast();
  const [params] = useSearchParams();
  const { data: p } = useUgcCreatorProfile();
  const { data: payout, refetch } = useUgcPayoutStatus(!!p?.hasStripeAccount);
  const upsert = useUpsertUgcCreatorProfile();
  const onboard = useStartUgcPayoutOnboarding();
  const [tax, setTax] = useState<{ hasFTax: boolean; vatRegistered: boolean; vatNumber: string } | null>(null);
  useEffect(() => { if (p && !tax) setTax({ hasFTax: p.hasFTax, vatRegistered: p.vatRegistered, vatNumber: p.vatNumber ?? '' }); }, [p, tax]);
  useEffect(() => { if (params.get('onboarding') === 'done') { refetch(); toast.push(t('Välkommen tillbaka — vi kollar din verifiering hos Stripe.'), 'success'); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const suspended = p?.status === 'Suspended';
  const verified = p?.payoutOnboardingComplete;
  const start = () => onboard.mutate(undefined, { onSuccess: (r) => { if (r.url) window.location.href = r.url; else toast.push(r.message ?? t('Verifieringen är redan klar'), r.complete ? 'success' : 'error'); }, onError: (e) => toast.push(apiError(e, t('Kunde inte starta verifieringen')), 'error') });
  return (
    <Page>
      <PageHead title={t('Verifiering & skatt')} back={{ to: '/creator/earnings' }} />
      <Card title={t('Verifiering hos Stripe')} action={p && <Badge tone={suspended ? 'bad' : verified ? 'ok' : 'neutral'}>{suspended ? t('Avstängd') : verified ? t('Verifierad') : t('Valfri')}</Badge>}>
        <p className="ds-body ds-muted">{t('Valfritt. Du kan söka och ta uppdrag utan verifiering. När ett betalt videouppdrag godkänns behöver pengarna någonstans att ta vägen: verifiera dig hos Stripe (identitet och bankkonto, några minuter, en gång) så betalas det ut automatiskt.')}</p>
        {payout?.message && !verified && <p className="ds-caption" style={{ color: 'var(--ds-warn)', marginTop: 8 }}>{payout.message}</p>}
        {!verified && !suspended && <div style={{ marginTop: 12 }}><Button onClick={start} loading={onboard.isPending}>{p?.hasStripeAccount ? t('Fortsätt verifieringen') : t('Verifiera dig')}</Button></div>}
      </Card>
      {tax && (
        <Card title={t('Skatt')}>
          <div className="ds-stack" style={{ gap: 8 }}>
            <Checkbox label={t('Jag är godkänd för F-skatt')} checked={tax.hasFTax} onChange={(e) => setTax({ ...tax, hasFTax: e.target.checked })} />
            <Checkbox label={t('Jag är momsregistrerad')} checked={tax.vatRegistered} onChange={(e) => setTax({ ...tax, vatRegistered: e.target.checked })} />
            {tax.vatRegistered && <Field label={t('Momsregistreringsnummer')}><input value={tax.vatNumber} onChange={(e) => setTax({ ...tax, vatNumber: e.target.value })} placeholder="SE…01" /></Field>}
            <p className="ds-caption ds-muted">{t('Du ansvarar själv för skatt på ersättning och på produkter du får i produktbyten.')}</p>
            <Button variant="secondary" loading={upsert.isPending} onClick={() => upsert.mutate(tax as never, { onSuccess: () => toast.push(t('Sparat'), 'success'), onError: (e) => toast.push(apiError(e, t('Kunde inte spara')), 'error') })}>{t('Spara')}</Button>
          </div>
        </Card>
      )}
    </Page>
  );
}
