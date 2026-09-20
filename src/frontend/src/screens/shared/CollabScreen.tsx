/**
 * One video job (UGC collab) for whoever is looking. The server still decides
 * what is allowed (`availableActions`); this screen only orders the buttons:
 * one primary, the rest secondary, the destructive ones in "…".
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { t } from '@/lib/i18n';
import { formatDate, formatDateTime, money } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from '@/components/vyrle/Toast';
import { useUgcCollab, useUgcCollabAction, useUgcMessages, useSendUgcMessage, useSubmitUgcDeliverable, useUgcAdminMarkFunded, formatOre, collabStatusLabel, COMPENSATION_LABEL, RIGHTS_LABEL, apiError, type UgcCollab, type UgcRole } from '@/hooks/ugc';
import { Avatar, Badge, BottomSheet, Button, Card, EmptyState, Field, Meter, Page, PageHead, Section, SkeletonList, StatusBadge, StickyAction } from '@/components/ds';
import { MoreMenu, apiMessage } from '@/components/app/common';
import { Composer } from '@/components/app/Chat';
import { Stars } from '@/components/app/Reviews';

const apiBase = () => (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '');
const fileUrl = (u: string) => !u ? '' : u.startsWith('http') ? u : `${apiBase().replace(/\/api$/, '')}${u}`;

export function CollabScreen() {
  const { id = '' } = useParams<{ id: string }>();
  const { role: authRole } = useAuthStore();
  const role: UgcRole = authRole === 'Brand' ? 'brand' : authRole === 'Admin' ? 'admin' : 'creator';
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const { data: c, isLoading, isError } = useUgcCollab(role, id);
  const act = useUgcCollabAction(role, id);
  const markFunded = useUgcAdminMarkFunded();
  const [mode, setMode] = useState<null | 'revision' | 'dispute' | 'cancel' | 'rate'>(null);
  const [reason, setReason] = useState('');
  const [rating, setRating] = useState(5);
  useEffect(() => {
    if (params.get('paid') === '1') toast.push(t('Betalningen registreras så fort Stripe bekräftat — oftast inom några sekunder.'), 'success');
    if (params.get('paid') === '0') toast.push(t('Betalningen avbröts. Du kan betala när som helst från uppdraget.'), 'error');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (window.location.hash === '#deliver') setTimeout(() => document.getElementById('deliver')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 100); }, [c?.id]);

  if (isLoading) return <Page><PageHead title="" back={{ onClick: () => navigate(-1) }} /><SkeletonList rows={3} /></Page>;
  if (isError || !c) return <Page><PageHead title={t('Uppdrag')} back={{ onClick: () => navigate(-1) }} /><Card><EmptyState title={t('Uppdraget hittades inte')} /></Card></Page>;

  const has = (a: string) => c.availableActions.includes(a);
  const run = (action: string, body?: unknown, ok?: string) => act.mutate({ action, body }, { onSuccess: () => ok && toast.push(ok, 'success'), onError: (e) => toast.push(apiError(e, t('Något gick fel')), 'error') });
  const pay = async () => {
    try {
      const res = await act.mutateAsync({ action: has('accept') && role === 'brand' ? 'accept' : 'checkout' }) as { url?: string; funded: boolean; productExchange: boolean; message?: string };
      if (res.url) window.location.href = res.url; else if (res.funded || res.productExchange) toast.push(t('Klart — avtalet är på plats.'), 'success'); else toast.push(res.message ?? t('Betalning kunde inte startas'), 'error');
    } catch (e) { toast.push(apiMessage(e, t('Något gick fel')), 'error'); }
  };
  const counterpart = role === 'brand' ? c.creatorName : c.brandName;
  const avatar = role === 'brand' ? c.creatorAvatarUrl : c.brandLogoUrl;
  const brandPays = c.compensation !== 'ProductExchange';

  // Primary action: the one thing to do next.
  type Act = { label: string; onClick: () => void; primary?: boolean };
  const actions: Act[] = [];
  if (role === 'brand' && has('accept')) actions.push({ label: brandPays ? `${t('Acceptera & betala')} ${formatOre(c.brandTotalOre)}` : t('Acceptera avtalet'), onClick: () => void pay(), primary: true });
  if (role === 'brand' && has('pay')) actions.push({ label: `${t('Betala')} ${formatOre(c.brandTotalOre)}`, onClick: () => void pay(), primary: true });
  if (role === 'creator' && has('accept')) actions.push({ label: t('Acceptera kontraktet'), onClick: () => run('accept', undefined, t('Avtalet gäller — lycka till!')), primary: true });
  if (has('approve')) actions.push({ label: t('Godkänn leveransen'), onClick: () => run('approve', undefined, t('Godkänd — creatorn får betalt.')), primary: true });
  if (has('submit')) actions.push({ label: c.deliverables.length ? t('Ladda upp ny version') : t('Leverera video'), onClick: () => document.getElementById('deliver')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), primary: true });
  if (has('start')) actions.push({ label: t('Markera som påbörjad'), onClick: () => run('start') });
  if (has('revision')) actions.push({ label: `${t('Begär ändring')} (${c.maxRevisions - c.revisionCount} ${t('kvar')})`, onClick: () => setMode('revision') });
  if (has('rate')) actions.push({ label: t('Betygsätt'), onClick: () => setMode('rate'), primary: actions.every((a) => !a.primary) });
  if (has('mark-funded')) actions.push({ label: t('Registrera betalning manuellt'), onClick: () => markFunded.mutate({ id: c.id, reason: 'admin' }, { onSuccess: () => toast.push(t('Betalning registrerad'), 'success'), onError: (e) => toast.push(apiError(e, t('Något gick fel')), 'error') }) });
  const primary = actions.find((a) => a.primary);
  const secondary = actions.filter((a) => a !== primary);
  const menu = [
    { label: t('Läs kontraktet'), onClick: () => document.getElementById('contract')?.scrollIntoView({ block: 'start', behavior: 'smooth' }) },
    { label: t('Licensbevis'), hidden: !has('license'), onClick: () => window.open(`${apiBase()}/ugc/collabs/${c.id}/license`, '_blank', 'noopener') },
    { label: t('Öppna tvist'), hidden: !has('dispute'), danger: true, onClick: () => setMode('dispute') },
    { label: has('decline') ? t('Avböj uppdraget') : t('Avbryt uppdraget'), hidden: !has('cancel') && !has('decline'), danger: true, onClick: () => setMode('cancel') },
  ];

  return (
    <Page>
      <PageHead title={c.title} back={{ onClick: () => navigate(role === 'brand' ? '/brand/campaigns?tab=orders' : role === 'admin' ? '/admin?section=ugc' : '/creator/assignments') }} actions={<MoreMenu items={menu} />} />

      <Card>
        <div className="ds-row" style={{ alignItems: 'flex-start' }}>
          <Avatar name={counterpart} src={avatar} rounded />
          <div className="ds-grow">
            <div className="ds-row ds-row--wrap"><span className="ds-heading">{counterpart}</span><Badge tone={c.status === 'Cancelled' || c.status === 'Disputed' ? 'bad' : c.status === 'Paid' || c.status === 'Approved' ? 'ok' : 'warn'}>{collabStatusLabel(c.status)}</Badge></div>
            <div className="ds-caption ds-muted">{t(COMPENSATION_LABEL[c.compensation] ?? c.compensation)} · {t(RIGHTS_LABEL[c.rightsPackage] ?? c.rightsPackage)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="ds-caption ds-muted">{role === 'brand' ? t('Du betalar') : t('Du får')}</div>
            <div className="ds-heading ds-num">{brandPays ? money((role === 'brand' ? c.brandTotalOre : c.agreedAmountOre) / 100) : t('Produkt')}</div>
          </div>
        </div>
        <StatusLine c={c} role={role} />
        {secondary.length > 0 && <div className="ds-row ds-row--wrap" style={{ marginTop: 12 }}>{secondary.map((a) => <Button key={a.label} variant="secondary" size="sm" onClick={a.onClick} disabled={act.isPending}>{a.label}</Button>)}</div>}
      </Card>

      <div id="deliver"><Deliverables c={c} role={role} canSubmit={has('submit')} /></div>
      {c.dispute && (
        <Section title={t('Tvist')}>
          <Card>
            <div className="ds-row" style={{ justifyContent: 'space-between' }}><span className="ds-body" style={{ fontWeight: 600 }}>{t('Öppnad av')} {c.dispute.openedBy === 'Brand' ? c.brandName : c.creatorName}</span><Badge tone={c.dispute.status === 'Open' ? 'bad' : 'neutral'}>{c.dispute.status === 'Open' ? t('Öppen') : t('Avgjord')}</Badge></div>
            <p className="ds-prose" style={{ marginTop: 6 }}>{c.dispute.reason}</p>
            {c.dispute.status === 'Resolved' && <p className="ds-body" style={{ marginTop: 8 }}><strong>{t('VYRLE:s beslut')}:</strong> {c.dispute.decision === 'PayCreator' ? t('creatorn får hela ersättningen') : c.dispute.decision === 'RefundBrand' ? t('företaget återbetalas') : `${t('delning')} ${c.dispute.creatorSharePercent} % ${t('till creatorn')}`}{c.dispute.adminReasoning ? ` — ${c.dispute.adminReasoning}` : ''}</p>}
          </Card>
        </Section>
      )}
      <Section title={t('Brief')}>
        <Card>
          <p className="ds-prose">{c.briefSnapshot.replace(/\*\*/g, '')}</p>
          {c.productDescription && <p className="ds-body" style={{ marginTop: 8 }}><strong>{t('Produkt')}:</strong> {c.productDescription}{c.productValueOre ? ` (${t('värde')} ${formatOre(c.productValueOre)})` : ''}</p>}
        </Card>
      </Section>
      <Section title={t('Chatt')}><Card><Messages id={id} role={role} /></Card></Section>
      {c.payment && (
        <Section title={t('Betalning')}>
          <Card>
            <div className="ds-facts">
              <div className="ds-fact"><span>Status</span><span>{t({ Pending: 'Väntar på betalning', Held: 'Pengarna hålls av VYRLE', Transferred: 'Utbetald till creatorn', Refunded: 'Återbetald', PartiallyRefunded: 'Delad', Failed: 'Misslyckad', NotApplicable: 'Ingen betalning (produktbyte)' }[c.payment.status] ?? c.payment.status)}</span></div>
              {role !== 'creator' && <div className="ds-fact"><span>{t('Företaget betalade')}</span><span className="ds-num">{c.payment.brandPaidOre ? formatOre(c.payment.brandPaidOre) : '–'}</span></div>}
              <div className="ds-fact"><span>{t('Till creatorn')}</span><span className="ds-num">{formatOre(c.payment.creatorAmountOre || c.agreedAmountOre)}</span></div>
              {role !== 'creator' && <div className="ds-fact"><span>{t('VYRLE-avgift')}</span><span className="ds-num">{formatOre(c.payment.platformFeeOre || c.platformFeeOre)}</span></div>}
              {c.payment.transferredOre > 0 && <div className="ds-fact"><span>{t('Utbetalt')}</span><span className="ds-num">{formatOre(c.payment.transferredOre)}{c.payment.transferredAt ? ` · ${formatDate(c.payment.transferredAt)}` : ''}</span></div>}
              {c.payment.refundedOre > 0 && <div className="ds-fact"><span>{t('Återbetalt')}</span><span className="ds-num">{formatOre(c.payment.refundedOre)}</span></div>}
            </div>
            {c.payment.lastError && role !== 'creator' && <p className="ds-caption" style={{ color: 'var(--ds-bad)', marginTop: 8 }}>{c.payment.lastError}</p>}
          </Card>
        </Section>
      )}
      <div id="contract"><Contract c={c} /></div>
      <Timeline c={c} />

      {primary && <StickyAction><Button full onClick={primary.onClick} loading={act.isPending}>{primary.label}</Button></StickyAction>}

      <BottomSheet open={mode === 'revision' || mode === 'dispute' || mode === 'cancel'} onClose={() => setMode(null)} title={mode === 'revision' ? t('Begär ändring') : mode === 'dispute' ? t('Öppna tvist') : has('decline') ? t('Avböj uppdraget') : t('Avbryt uppdraget')}
        footer={<><Button variant="secondary" onClick={() => setMode(null)}>{t('Avbryt')}</Button>
          <Button danger={mode !== 'revision'} loading={act.isPending} disabled={reason.trim().length < (mode === 'revision' ? 10 : mode === 'dispute' ? 20 : 0)} onClick={() => {
            if (mode === 'revision') run('revision', { feedback: reason }, t('Revision skickad'));
            else if (mode === 'dispute') run('dispute', { reason }, t('Tvist öppnad — VYRLE återkommer.'));
            else run(has('decline') ? 'decline' : 'cancel', { reason: reason || undefined }, t('Uppdraget är avbrutet'));
            setMode(null); setReason('');
          }}>{mode === 'revision' ? t('Skicka revision') : mode === 'dispute' ? t('Öppna tvist') : t('Bekräfta')}</Button></>}>
        <Field label={mode === 'revision' ? t('Vad ska ändras?') : mode === 'dispute' ? t('Vad i leveransen avviker från briefen?') : t('Varför? (valfritt)')} hint={mode === 'revision' ? t('Feedback utanför briefen räknas som en ny beställning, inte en revision.') : mode === 'dispute' ? t('VYRLE avgör bara den frågan.') : undefined}>
          <textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={4000} />
        </Field>
      </BottomSheet>
      <BottomSheet open={mode === 'rate'} onClose={() => setMode(null)} title={t('Betygsätt')} footer={<Button full loading={act.isPending} onClick={() => { run('rate', { rating }, t('Tack för betyget!')); setMode(null); }}>{t('Spara betyg')}</Button>}>
        <p className="ds-body">{t('Hur nöjd är du med leveransen?')}</p>
        <Stars value={rating} onChange={setRating} size={34} />
      </BottomSheet>
    </Page>
  );
}

function StatusLine({ c, role }: { c: UgcCollab; role: UgcRole }) {
  const funded = c.payment?.status === 'Held' || c.payment?.status === 'Transferred' || c.payment?.status === 'PartiallyRefunded' || c.compensation === 'ProductExchange';
  let text = '';
  switch (c.status) {
    case 'Invited':
      if (!c.brandAcceptedAt) text = role === 'brand' ? t('Läs kontraktet och acceptera för att komma igång.') : t('Väntar på att företaget accepterar avtalet.');
      else if (!funded) text = role === 'brand' ? t('Kontraktet är accepterat — betala så låses uppdraget.') : t('Företaget har accepterat. Väntar på betalning.');
      else if (!c.creatorAcceptedAt) text = role === 'creator' ? t('Företaget har accepterat och betalat. Acceptera kontraktet för att starta klockan.') : t('Betalt. Väntar på att creatorn accepterar kontraktet.');
      break;
    case 'Accepted': case 'InProgress': text = c.deadlineAt ? `${t('Leverans senast')} ${formatDateTime(c.deadlineAt)}` : ''; break;
    case 'Submitted': text = c.autoApproveAt ? `${t('Godkänns automatiskt')} ${formatDateTime(c.autoApproveAt)} ${t('om ingen granskar')}` : ''; break;
    case 'RevisionRequested': text = `${t('Revision')} ${c.revisionCount}/${c.maxRevisions}` + (c.deadlineAt ? ` · ${t('ny leverans senast')} ${formatDateTime(c.deadlineAt)}` : ''); break;
    case 'Approved': text = role === 'creator' && c.payment?.lastError?.includes('verifierat') ? t('Godkänd. Verifiera dig hos Stripe under Intäkter så betalas ersättningen ut.') : t('Godkänd — utbetalningen är på väg.'); break;
    case 'Paid': text = `${t('Betald')} ${c.paidAt ? formatDate(c.paidAt) : ''}`; break;
    case 'Cancelled': text = `${t('Avbrutet')}${c.cancelReason ? ': ' + c.cancelReason : ''}${c.noShow ? ' · ' + t('utebliven leverans') : ''}`; break;
    case 'Disputed': text = t('Tvist öppen — VYRLE granskar leveransen mot briefen.'); break;
  }
  return text ? <p className="ds-body" style={{ marginTop: 10, fontWeight: 600, color: c.status === 'Cancelled' || c.status === 'Disputed' ? 'var(--ds-bad)' : 'var(--ds-accent)' }}>{text}</p> : null;
}

function Deliverables({ c, role, canSubmit }: { c: UgcCollab; role: UgcRole; canSubmit: boolean }) {
  const toast = useToast();
  const submit = useSubmitUgcDeliverable(c.id);
  const [file, setFile] = useState<File | null>(null);
  const [comment, setComment] = useState('');
  const [pct, setPct] = useState(0);
  const upload = () => { if (!file) return; setPct(0); submit.mutate({ file, comment, onProgress: setPct }, { onSuccess: () => { toast.push(t('Videon är levererad! Företaget har nu 5 dagar på sig att granska.'), 'success'); setFile(null); setComment(''); }, onError: (e) => toast.push(apiError(e, t('Uppladdningen misslyckades')), 'error') }); };
  return (
    <Section title={t('Leverans')}>
      {c.deliverables.length === 0 && !canSubmit && <Card><p className="ds-body ds-muted">{role === 'creator' ? t('Ingen video ännu.') : t('Creatorn har inte levererat ännu.')}</p></Card>}
      {c.deliverables.map((d, i) => (
        <Card key={d.id}>
          <div className="ds-row ds-row--wrap"><Badge tone={i === 0 ? 'accent' : 'neutral'}>{t('Version')} {d.version}</Badge><span className="ds-caption ds-muted">{formatDateTime(d.createdAt)} · {Math.max(1, Math.round(d.fileSizeBytes / 1024 / 1024))} MB</span>{d.fileUrl && <a className="ds-link ds-caption" style={{ marginLeft: 'auto' }} href={fileUrl(d.fileUrl)} download>{t('Ladda ner')}</a>}</div>
          {d.fileUrl ? <video controls playsInline preload="metadata" src={fileUrl(d.fileUrl)} style={{ width: '100%', maxHeight: 480, borderRadius: 12, background: '#111', marginTop: 10 }} /> : <p className="ds-caption ds-muted" style={{ marginTop: 8 }}>{t('Filen är inte tillgänglig just nu.')}</p>}
          {d.creatorComment && <p className="ds-body" style={{ marginTop: 8 }}><strong>{c.creatorName}:</strong> {d.creatorComment}</p>}
          {d.brandFeedback && <p className="ds-body" style={{ marginTop: 8, padding: 10, borderRadius: 10, background: 'var(--ds-warn-soft)' }}><strong>{t('Feedback')} ({c.brandName}):</strong> {d.brandFeedback}</p>}
        </Card>
      ))}
      {canSubmit && (
        <Card title={c.deliverables.length ? t('Ladda upp ny version') : t('Ladda upp din video')}>
          <div className="ds-stack" style={{ gap: 12 }}>
            <p className="ds-caption ds-muted">{t('mp4, mov eller webm · max 500 MB · 9:16')}</p>
            <input type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm,.m4v" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="ds-input" />
            <Field label={t('Kommentar till företaget (valfritt)')}><textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} /></Field>
            {submit.isPending && <Meter value={pct} max={100} left={t('Laddar upp…')} right={`${pct} %`} />}
            <Button full disabled={!file} loading={submit.isPending} onClick={upload}>{t('Leverera video')}</Button>
          </div>
        </Card>
      )}
    </Section>
  );
}

function Contract({ c }: { c: UgcCollab }) {
  const [open, setOpen] = useState(false);
  return (
    <Section title={t('Kontrakt')} action={<Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>{open ? t('Dölj') : t('Läs hela')}</Button>}>
      <Card>
        <div className="ds-facts">
          <div className="ds-fact"><span>{t('Företaget')}</span><span>{c.brandAcceptedAt ? formatDate(c.brandAcceptedAt) : t('Inte accepterat')}</span></div>
          <div className="ds-fact"><span>{t('Creatorn')}</span><span>{c.creatorAcceptedAt ? formatDate(c.creatorAcceptedAt) : t('Inte accepterat')}</span></div>
          <div className="ds-fact"><span>SHA-256</span><span title={c.contractHash} style={{ fontFamily: 'ui-monospace, monospace' }}>{c.contractHash.slice(0, 12)}…</span></div>
        </div>
        {open && <div className="ds-prose ds-caption" style={{ marginTop: 12, maxHeight: 480, overflowY: 'auto', fontWeight: 400 }}>{c.contractText.replace(/^#+\s*/gm, '').replace(/\*\*/g, '')}</div>}
      </Card>
    </Section>
  );
}

function Timeline({ c }: { c: UgcCollab }) {
  const [open, setOpen] = useState(false);
  return (
    <Section title={t('Händelser')} action={<Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>{open ? t('Dölj') : `${t('Visa')} (${c.events.length})`}</Button>}>
      {open && <Card><div className="ds-facts">{[...c.events].reverse().map((e, i) => <div key={i} className="ds-fact"><span>{formatDateTime(e.at)}</span><span>{collabStatusLabel(e.to)} · {e.actor === 'Brand' ? c.brandName : e.actor === 'Creator' ? c.creatorName : e.actor === 'Admin' ? 'VYRLE' : t('System')}{e.note ? ` — ${e.note}` : ''}</span></div>)}{c.events.length === 0 && <span className="ds-caption ds-muted">{t('Inga händelser ännu.')}</span>}</div></Card>}
    </Section>
  );
}

function Messages({ id, role }: { id: string; role: UgcRole }) {
  const { data: messages = [] } = useUgcMessages(role, id);
  const send = useSendUgcMessage(role, id);
  const toast = useToast();
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [messages.length]);
  const mine = (m: { senderRole: string }) => (role === 'brand' && m.senderRole === 'Brand') || (role === 'creator' && m.senderRole === 'Creator') || (role === 'admin' && m.senderRole === 'Admin');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 420 }}>
      <div className="ds-thread" style={{ overflowY: 'auto' }}>
        {messages.length === 0 && <p className="ds-caption ds-muted" style={{ textAlign: 'center', padding: 12 }}>{t('Inga meddelanden än — frågor om briefen, produkten eller leveransen hör hemma här.')}</p>}
        {messages.map((m) => <div key={m.id} className={`ds-bubble ${mine(m) ? 'ds-bubble--me' : 'ds-bubble--them'}`}>{!mine(m) && <div className="ds-caption" style={{ fontWeight: 700 }}>{m.senderName}</div>}{m.body}<div className="ds-bubble-meta">{formatDateTime(m.createdAt)}</div></div>)}
        <div ref={endRef} />
      </div>
      <Composer busy={send.isPending} placeholder={t('Skriv…')} onSend={(text) => send.mutateAsync(text).then(() => undefined).catch((e) => { toast.push(apiError(e, t('Kunde inte skicka')), 'error'); throw e; })} />
    </div>
  );
}

export { StatusBadge };
