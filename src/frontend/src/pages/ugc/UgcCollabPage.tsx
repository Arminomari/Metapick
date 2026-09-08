import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { t } from '@/lib/i18n';
import { formatDate, formatDateTime } from '@/lib/utils';
import { useToast, PageSkeleton } from '@/components/vyrle/Toast';
import { useAuthStore } from '@/stores/authStore';
import {
  useUgcCollab, useUgcCollabAction, useUgcMessages, useSendUgcMessage, useSubmitUgcDeliverable, useUgcAdminMarkFunded,
  formatOre, collabStatusLabel, COLLAB_TONE, COMPENSATION_LABEL, RIGHTS_LABEL, apiError,
  type UgcCollab, type UgcRole,
} from '@/hooks/ugc';

/**
 * One page for the whole engagement, whoever is looking. The server sends
 * `availableActions`; this page renders exactly those buttons — it never
 * decides on its own what is allowed.
 */
export function UgcCollabPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { role: authRole } = useAuthStore();
  const role: UgcRole = authRole === 'Brand' ? 'brand' : authRole === 'Admin' ? 'admin' : 'creator';
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const { data: c, isLoading, isError } = useUgcCollab(role, id);
  const act = useUgcCollabAction(role, id);

  useEffect(() => {
    if (params.get('paid') === '1') toast.push(t('Betalningen registreras så fort Stripe bekräftat — oftast inom några sekunder.'), 'success');
    if (params.get('paid') === '0') toast.push(t('Betalningen avbröts. Du kan betala när som helst från uppdraget.'), 'error');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) return <PageSkeleton />;
  if (isError || !c) return (
    <section className="view active reveal"><div className="card" style={{ textAlign: 'center', padding: '54px 24px' }}>
      <div style={{ fontSize: 18, fontWeight: 700 }}>{t('Uppdraget hittades inte')}</div>
    </div></section>
  );

  const has = (a: string) => c.availableActions.includes(a);
  const run = (action: string, body?: unknown, okMsg?: string) =>
    act.mutate({ action, body }, {
      onSuccess: () => okMsg && toast.push(okMsg, 'success'),
      onError: (e) => toast.push(apiError(e, t('Något gick fel')), 'error'),
    });

  const back = role === 'brand' ? '/brand/ugc/pipeline' : role === 'admin' ? '/admin?section=ugc' : '/creator/ugc/collabs';
  const counterpart = role === 'brand' ? c.creatorName : c.brandName;
  const counterpartAvatar = role === 'brand' ? c.creatorAvatarUrl : c.brandLogoUrl;

  return (
    <section className="view active reveal">
      <button onClick={() => navigate(back)} className="view-all" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg> {t('Tillbaka')}
      </button>

      {/* ── Header ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {counterpartAvatar
            ? <img src={counterpartAvatar} alt="" style={{ width: 56, height: 56, borderRadius: 16, objectFit: 'cover', flex: '0 0 auto' }} />
            : <span className="mono" style={{ width: 56, height: 56, fontSize: 22, flex: '0 0 56px' }}>{(counterpart[0] || '?').toUpperCase()}</span>}
          <div style={{ flex: '1 1 260px', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 className="page-title" style={{ fontSize: 26, margin: 0, wordBreak: 'break-word' }}>{c.title}</h1>
              <span className={`vy-badge ${COLLAB_TONE[c.status] ?? 'neu'}`}>{collabStatusLabel(c.status)}</span>
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 4 }}>
              {role === 'brand' ? t('Creator') : t('Företag')}: <strong style={{ color: '#0B0F17' }}>{counterpart}</strong>
              {' · '}{t(COMPENSATION_LABEL[c.compensation] ?? c.compensation)}
              {' · '}{t(RIGHTS_LABEL[c.rightsPackage] ?? c.rightsPackage)}
            </div>
            <StatusLine c={c} role={role} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flex: '0 0 auto' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)' }}>
              {role === 'brand' ? t('Du betalar') : t('Du får')}
            </div>
            <div style={{ fontFamily: '"Fraunces",serif', fontSize: 30, fontWeight: 700, lineHeight: 1 }}>
              {c.compensation === 'ProductExchange' ? t('Produkt') : formatOre(role === 'brand' ? c.brandTotalOre : c.agreedAmountOre)}
            </div>
            {role === 'brand' && c.compensation !== 'ProductExchange' && (
              <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{formatOre(c.agreedAmountOre)} {t('till creatorn')} + {formatOre(c.platformFeeOre)} {t('avgift')}</div>
            )}
          </div>
        </div>

        <ActionBar c={c} role={role} has={has} run={run} busy={act.isPending} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
          <DeliverablesCard c={c} role={role} has={has} run={run} busy={act.isPending} />
          {c.dispute && <DisputeCard c={c} />}
          <BriefCard c={c} />
          <ContractCard c={c} />
        </div>
        <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
          <MessagesCard id={id} role={role} />
          {c.payment && <PaymentCard c={c} role={role} />}
          <TimelineCard c={c} />
        </div>
      </div>
    </section>
  );
}

// ── Pieces ─────────────────────────────────────────────────────────

function StatusLine({ c, role }: { c: UgcCollab; role: UgcRole }) {
  const funded = c.payment?.status === 'Held' || c.payment?.status === 'Transferred' || c.payment?.status === 'PartiallyRefunded' || c.compensation === 'ProductExchange';
  let text = '';
  switch (c.status) {
    case 'Invited':
      if (!c.brandAcceptedAt) text = role === 'brand' ? t('Läs kontraktet och acceptera för att komma igång.') : t('Väntar på att företaget accepterar avtalet.');
      else if (!funded) text = role === 'brand' ? t('Kontraktet är accepterat — betala så låses uppdraget.') : t('Företaget har accepterat. Väntar på betalning.');
      else if (!c.creatorAcceptedAt) text = role === 'creator' ? t('Företaget har accepterat och betalat. Acceptera kontraktet för att starta klockan.') : t('Betalt. Väntar på att creatorn accepterar kontraktet.');
      break;
    case 'Accepted': case 'InProgress':
      text = c.deadlineAt ? `${t('Leverans senast')} ${formatDateTime(c.deadlineAt)}` : '';
      break;
    case 'Submitted':
      text = c.autoApproveAt ? `${t('Godkänns automatiskt')} ${formatDateTime(c.autoApproveAt)} ${t('om ingen granskar')}` : '';
      break;
    case 'RevisionRequested':
      text = `${t('Revision')} ${c.revisionCount}/${c.maxRevisions}` + (c.deadlineAt ? ` · ${t('ny leverans senast')} ${formatDateTime(c.deadlineAt)}` : '');
      break;
    case 'Approved': text = t('Godkänd — utbetalningen är på väg.'); break;
    case 'Paid': text = `${t('Betald')} ${c.paidAt ? formatDate(c.paidAt) : ''}`; break;
    case 'Cancelled': text = `${t('Avbrutet')}${c.cancelReason ? ': ' + c.cancelReason : ''}${c.noShow ? ' · ' + t('utebliven leverans') : ''}`; break;
    case 'Disputed': text = t('Tvist öppen — VYRLE granskar leveransen mot briefen.'); break;
  }
  return text ? <div style={{ fontSize: 13, color: c.status === 'Cancelled' || c.status === 'Disputed' ? '#b3402f' : '#9c4f31', marginTop: 6, fontWeight: 600 }}>{text}</div> : null;
}

function ActionBar({ c, role, has, run, busy }: { c: UgcCollab; role: UgcRole; has: (a: string) => boolean; run: (a: string, body?: unknown, ok?: string) => void; busy: boolean }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [mode, setMode] = useState<null | 'revision' | 'dispute' | 'cancel' | 'rate'>(null);
  const [rating, setRating] = useState(5);
  const markFunded = useUgcAdminMarkFunded();
  const act = useUgcCollabAction(role, c.id);

  const pay = async () => {
    try {
      const res = await act.mutateAsync({ action: has('accept') && role === 'brand' ? 'accept' : 'checkout' }) as { url?: string; funded: boolean; productExchange: boolean; message?: string };
      if (res.url) window.location.href = res.url;
      else if (res.funded || res.productExchange) toast.push(t('Klart — avtalet är på plats.'), 'success');
      else toast.push(res.message ?? t('Betalning kunde inte startas'), 'error');
    } catch (e) { toast.push(apiError(e, t('Något gick fel')), 'error'); }
  };

  const buttons: React.ReactNode[] = [];
  if (role === 'brand' && has('accept')) buttons.push(<button key="accept" className="btn-apply" style={btn} disabled={busy} onClick={pay}>{c.compensation === 'ProductExchange' ? t('Acceptera avtalet') : t('Acceptera & betala')} {c.compensation !== 'ProductExchange' && formatOre(c.brandTotalOre)}</button>);
  if (role === 'brand' && has('pay')) buttons.push(<button key="pay" className="btn-apply" style={btn} disabled={busy} onClick={pay}>{t('Betala')} {formatOre(c.brandTotalOre)}</button>);
  if (role === 'creator' && has('accept')) buttons.push(<button key="acc" className="btn-apply" style={btn} disabled={busy} onClick={() => run('accept', undefined, t('Avtalet gäller — lycka till!'))}>{t('Acceptera kontraktet')}</button>);
  if (has('start')) buttons.push(<button key="start" className="btn-outline" style={btn} disabled={busy} onClick={() => run('start')}>{t('Markera som påbörjad')}</button>);
  if (has('approve')) buttons.push(<button key="approve" className="btn-apply" style={btn} disabled={busy} onClick={() => run('approve', undefined, t('Godkänd — creatorn får betalt.'))}>✓ {t('Godkänn leveransen')}</button>);
  if (has('revision')) buttons.push(<button key="rev" className="btn-outline" style={btn} onClick={() => setMode(mode === 'revision' ? null : 'revision')}>{t('Begär ändring')} ({c.maxRevisions - c.revisionCount} {t('kvar')})</button>);
  if (has('dispute')) buttons.push(<button key="disp" className="btn-outline" style={{ ...btn, borderColor: 'var(--red)', color: 'var(--red)' }} onClick={() => setMode(mode === 'dispute' ? null : 'dispute')}>{t('Öppna tvist')}</button>);
  if (has('rate')) buttons.push(<button key="rate" className="btn-outline" style={btn} onClick={() => setMode(mode === 'rate' ? null : 'rate')}>★ {t('Betygsätt')}</button>);
  if (has('license')) buttons.push(<a key="lic" className="btn-outline" style={{ ...btn, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }} href={licenseUrl(c.id)} target="_blank" rel="noopener noreferrer">📄 {t('Licensbevis')}</a>);
  if (has('mark-funded')) buttons.push(<button key="mf" className="btn-outline" style={btn} disabled={markFunded.isPending} onClick={() => markFunded.mutate({ id: c.id, reason: 'admin' }, { onSuccess: () => toast.push(t('Betalning registrerad'), 'success'), onError: (e) => toast.push(apiError(e, t('Något gick fel')), 'error') })}>{t('Registrera betalning manuellt')}</button>);
  if (has('cancel') || has('decline')) buttons.push(<button key="cancel" className="view-all" style={{ color: 'var(--red)' }} onClick={() => setMode(mode === 'cancel' ? null : 'cancel')}>{has('decline') ? t('Avböj') : t('Avbryt uppdraget')}</button>);

  if (buttons.length === 0 && !mode) return null;

  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(241,168,143,.2)' }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>{buttons}</div>

      {mode === 'revision' && (
        <Prompt label={t('Vad ska ändras? Feedback som ligger utanför briefen räknas som en ny beställning, inte en revision.')} value={reason} onChange={setReason}
          confirm={t('Skicka revision')} onCancel={() => setMode(null)} busy={busy}
          onConfirm={() => { run('revision', { feedback: reason }, t('Revision skickad')); setMode(null); setReason(''); }} min={10} />
      )}
      {mode === 'dispute' && (
        <Prompt label={t('Beskriv vad i leveransen som avviker från briefen. VYRLE avgör bara den frågan.')} value={reason} onChange={setReason}
          confirm={t('Öppna tvist')} onCancel={() => setMode(null)} busy={busy} danger
          onConfirm={() => { run('dispute', { reason }, t('Tvist öppnad — VYRLE återkommer.')); setMode(null); setReason(''); }} min={20} />
      )}
      {mode === 'cancel' && (
        <Prompt label={has('decline') ? t('Varför avböjer du? (valfritt)') : t('Varför avbryts uppdraget? (valfritt)')} value={reason} onChange={setReason}
          confirm={has('decline') ? t('Avböj uppdraget') : t('Avbryt uppdraget')} onCancel={() => setMode(null)} busy={busy} danger
          onConfirm={() => { run(has('decline') ? 'decline' : 'cancel', { reason: reason || undefined }, t('Uppdraget är avbrutet')); setMode(null); setReason(''); }} min={0} />
      )}
      {mode === 'rate' && (
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>{t('Hur nöjd är du med leveransen?')}</span>
          <span>{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" onClick={() => setRating(n)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, color: n <= rating ? '#e0a04e' : '#d9dbe3' }}>★</button>)}</span>
          <button className="btn-apply" style={btn} disabled={busy} onClick={() => { run('rate', { rating }, t('Tack för betyget!')); setMode(null); }}>{t('Spara betyg')}</button>
        </div>
      )}
    </div>
  );
}

const btn: React.CSSProperties = { width: 'auto', padding: '11px 20px', fontSize: 13.5 };

function Prompt({ label, value, onChange, confirm, onConfirm, onCancel, busy, danger, min }: { label: string; value: string; onChange: (v: string) => void; confirm: string; onConfirm: () => void; onCancel: () => void; busy: boolean; danger?: boolean; min: number }) {
  return (
    <div style={{ marginTop: 12 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} maxLength={4000}
        style={{ width: '100%', borderRadius: 14, border: '1px solid rgba(241,168,143,.3)', background: 'rgba(255,255,255,.85)', padding: '11px 14px', fontSize: 14, fontFamily: 'inherit', lineHeight: 1.5 }} />
      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <button className={danger ? 'btn-outline' : 'btn-apply'} style={{ ...btn, ...(danger ? { borderColor: 'var(--red)', color: 'var(--red)' } : {}) }} disabled={busy || value.trim().length < min} onClick={onConfirm}>{confirm}</button>
        <button className="view-all" onClick={onCancel}>{t('Avbryt')}</button>
      </div>
    </div>
  );
}

function licenseUrl(id: string) {
  const base = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '');
  return `${base}/ugc/collabs/${id}/license`;
}
function fileUrl(u: string) {
  if (!u) return '';
  if (u.startsWith('http')) return u;
  const base = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/api\/?$/, '');
  return `${base}${u}`;
}

function DeliverablesCard({ c, role, has, run, busy }: { c: UgcCollab; role: UgcRole; has: (a: string) => boolean; run: (a: string, body?: unknown, ok?: string) => void; busy: boolean }) {
  const toast = useToast();
  const submit = useSubmitUgcDeliverable(c.id);
  const [file, setFile] = useState<File | null>(null);
  const [comment, setComment] = useState('');
  const [pct, setPct] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  void run; void busy;

  const upload = () => {
    if (!file) return;
    setPct(0);
    submit.mutate({ file, comment, onProgress: setPct }, {
      onSuccess: () => { toast.push(t('Videon är levererad! Företaget har nu 5 dagar på sig att granska.'), 'success'); setFile(null); setComment(''); },
      onError: (e) => toast.push(apiError(e, t('Uppladdningen misslyckades')), 'error'),
    });
  };

  return (
    <div className="card">
      <div className="sec-head"><h3>{t('Leverans')}</h3>{c.deliverables.length > 0 && <span style={{ fontSize: 13, color: 'var(--muted)' }}>{c.deliverables.length} {t('version(er)')}</span>}</div>

      {c.deliverables.length === 0 && !has('submit') && (
        <div style={{ color: 'var(--muted)', fontSize: 13.5, padding: '8px 0' }}>{role === 'creator' ? t('Ingen video ännu.') : t('Creatorn har inte levererat ännu.')}</div>
      )}

      {c.deliverables.map((d, i) => (
        <div key={d.id} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: i < c.deliverables.length - 1 ? '1px solid rgba(241,168,143,.18)' : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
            <span className={`vy-badge ${i === 0 ? 'info' : 'neu'}`}>{t('Version')} {d.version}</span>
            <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{formatDateTime(d.createdAt)} · {Math.max(1, Math.round(d.fileSizeBytes / 1024 / 1024))} MB</span>
            {d.fileUrl && <a href={fileUrl(d.fileUrl)} download style={{ marginLeft: 'auto', fontSize: 12.5, color: '#C26A4A', fontWeight: 600 }}>⬇ {t('Ladda ner')}</a>}
          </div>
          {d.fileUrl ? (
            <video controls playsInline preload="metadata" src={fileUrl(d.fileUrl)} style={{ width: '100%', maxHeight: 520, borderRadius: 16, background: '#0B0F17' }} />
          ) : <div style={{ fontSize: 13, color: 'var(--muted)' }}>{t('Filen är inte tillgänglig just nu.')}</div>}
          {d.creatorComment && <div style={{ marginTop: 8, fontSize: 13.5, lineHeight: 1.55 }}><strong>{c.creatorName}:</strong> {d.creatorComment}</div>}
          {d.brandFeedback && (
            <div style={{ marginTop: 8, padding: '10px 12px', borderRadius: 12, background: 'rgba(242,197,138,.22)', fontSize: 13.5, lineHeight: 1.55 }}>
              <strong>{t('Feedback')} ({c.brandName}):</strong> {d.brandFeedback}
            </div>
          )}
        </div>
      ))}

      {has('submit') && (
        <div style={{ marginTop: c.deliverables.length ? 8 : 0, padding: '14px 16px', borderRadius: 16, background: 'rgba(255,244,236,.7)', border: '1px dashed rgba(241,168,143,.5)' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{c.deliverables.length ? t('Ladda upp ny version') : t('Ladda upp din video')}</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 10 }}>{t('mp4, mov eller webm · max 500 MB · 9:16')}</div>
          <input ref={inputRef} type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm,.m4v" onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={{ fontSize: 13 }} />
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} maxLength={2000} placeholder={t('Kommentar till företaget (valfritt)')}
            style={{ width: '100%', marginTop: 10, borderRadius: 12, border: '1px solid rgba(241,168,143,.3)', background: '#fff', padding: '10px 12px', fontSize: 13.5, fontFamily: 'inherit' }} />
          {submit.isPending && (
            <div style={{ marginTop: 10, height: 8, borderRadius: 980, background: 'rgba(241,168,143,.2)', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg,#FFD8C7,#F1A88F)', transition: 'width .3s' }} />
            </div>
          )}
          <button className="btn-apply" style={{ ...btn, marginTop: 10 }} disabled={!file || submit.isPending} onClick={upload}>
            {submit.isPending ? `${t('Laddar upp…')} ${pct}%` : t('Leverera video')}
          </button>
        </div>
      )}
    </div>
  );
}

function BriefCard({ c }: { c: UgcCollab }) {
  return (
    <div className="card">
      <div className="sec-head"><h3>{t('Brief')}</h3></div>
      <div style={{ fontSize: 13.5, lineHeight: 1.7, whiteSpace: 'pre-line', wordBreak: 'break-word' }}>{c.briefSnapshot.replace(/\*\*/g, '')}</div>
      {c.productDescription && <div style={{ marginTop: 10, fontSize: 13.5 }}><strong>{t('Produkt')}:</strong> {c.productDescription}{c.productValueOre ? ` (${t('värde')} ${formatOre(c.productValueOre)})` : ''}</div>}
    </div>
  );
}

function ContractCard({ c }: { c: UgcCollab }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card">
      <div className="sec-head" style={{ flexWrap: 'wrap', gap: 8 }}>
        <h3>{t('Kontrakt')}</h3>
        <button className="view-all" onClick={() => setOpen((v) => !v)}>{open ? t('Dölj') : t('Läs hela')}</button>
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--muted)' }}>
        <span>{c.brandAcceptedAt ? `✓ ${t('Företaget')} ${formatDate(c.brandAcceptedAt)}` : `○ ${t('Företaget har inte accepterat')}`}</span>
        <span>{c.creatorAcceptedAt ? `✓ ${t('Creatorn')} ${formatDate(c.creatorAcceptedAt)}` : `○ ${t('Creatorn har inte accepterat')}`}</span>
        <span title={c.contractHash} style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>SHA-256 {c.contractHash.slice(0, 12)}…</span>
      </div>
      {open && (
        <div style={{ marginTop: 12, padding: '14px 16px', borderRadius: 14, background: 'rgba(255,255,255,.85)', border: '1px solid rgba(241,168,143,.22)', fontSize: 13, lineHeight: 1.65, whiteSpace: 'pre-line', wordBreak: 'break-word', maxHeight: 520, overflowY: 'auto' }}>
          {c.contractText.replace(/^#+\s*/gm, '').replace(/\*\*/g, '')}
        </div>
      )}
    </div>
  );
}

function PaymentCard({ c, role }: { c: UgcCollab; role: UgcRole }) {
  const p = c.payment!;
  const label: Record<string, string> = { Pending: 'Väntar på betalning', Held: 'Pengarna hålls av VYRLE', Transferred: 'Utbetald till creatorn', Refunded: 'Återbetald', PartiallyRefunded: 'Delad', Failed: 'Misslyckad', NotApplicable: 'Ingen betalning (produktbyte)' };
  return (
    <div className="card">
      <div className="sec-head"><h3>{t('Betalning')}</h3><span className={`vy-badge ${p.status === 'Held' || p.status === 'Transferred' ? 'pos' : p.status === 'Pending' ? 'pend' : 'neu'}`}>{t(label[p.status] ?? p.status)}</span></div>
      <div style={{ display: 'grid', gap: 6, fontSize: 13.5 }}>
        {role !== 'creator' && <Row k={t('Företaget betalade')} v={p.brandPaidOre ? formatOre(p.brandPaidOre) : '–'} />}
        <Row k={t('Till creatorn')} v={formatOre(p.creatorAmountOre || c.agreedAmountOre)} />
        {role !== 'creator' && <Row k={t('VYRLE-avgift')} v={formatOre(p.platformFeeOre || c.platformFeeOre)} />}
        {p.transferredOre > 0 && <Row k={t('Utbetalt')} v={`${formatOre(p.transferredOre)} · ${p.transferredAt ? formatDate(p.transferredAt) : ''}`} />}
        {p.refundedOre > 0 && <Row k={t('Återbetalt')} v={`${formatOre(p.refundedOre)} · ${p.refundedAt ? formatDate(p.refundedAt) : ''}`} />}
        {p.lastError && role !== 'creator' && <div style={{ color: '#b3402f', fontSize: 12.5, marginTop: 4 }}>{p.lastError}</div>}
      </div>
    </div>
  );
}
const Row = ({ k, v }: { k: string; v: string }) => <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><span style={{ color: 'var(--muted)' }}>{k}</span><span style={{ fontWeight: 600 }}>{v}</span></div>;

function DisputeCard({ c }: { c: UgcCollab }) {
  const d = c.dispute!;
  return (
    <div className="card" style={{ border: '1px solid rgba(207,75,75,.35)', background: 'linear-gradient(160deg,#fff,#FFF3F0)' }}>
      <div className="sec-head"><h3>{t('Tvist')}</h3><span className={`vy-badge ${d.status === 'Open' ? 'neg' : 'neu'}`}>{d.status === 'Open' ? t('Öppen') : t('Avgjord')}</span></div>
      <div style={{ fontSize: 13.5, lineHeight: 1.6 }}><strong>{t('Öppnad av')} {d.openedBy === 'Brand' ? c.brandName : c.creatorName}:</strong> {d.reason}</div>
      {d.status === 'Resolved' && (
        <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,.8)', fontSize: 13.5, lineHeight: 1.6 }}>
          <strong>{t('VYRLE:s beslut')}:</strong> {d.decision === 'PayCreator' ? t('creatorn får hela ersättningen') : d.decision === 'RefundBrand' ? t('företaget återbetalas') : `${t('delning')} ${d.creatorSharePercent} % ${t('till creatorn')}`}
          {d.adminReasoning && <div style={{ marginTop: 4, color: 'var(--ink-2)' }}>{d.adminReasoning}</div>}
        </div>
      )}
    </div>
  );
}

function TimelineCard({ c }: { c: UgcCollab }) {
  return (
    <div className="card">
      <div className="sec-head"><h3>{t('Händelser')}</h3></div>
      <div style={{ display: 'grid', gap: 8 }}>
        {[...c.events].reverse().map((e, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, fontSize: 12.5, alignItems: 'flex-start' }}>
            <span style={{ color: 'var(--muted)', whiteSpace: 'nowrap', minWidth: 110 }}>{formatDateTime(e.at)}</span>
            <span style={{ minWidth: 0 }}>
              <strong>{collabStatusLabel(e.to)}</strong>{e.from && e.from !== e.to ? ` ← ${collabStatusLabel(e.from)}` : ''}
              <span style={{ color: 'var(--muted)' }}> · {e.actor === 'Brand' ? c.brandName : e.actor === 'Creator' ? c.creatorName : e.actor === 'Admin' ? 'VYRLE' : t('System')}</span>
              {e.note && <div style={{ color: 'var(--ink-2)' }}>{e.note}</div>}
            </span>
          </div>
        ))}
        {c.events.length === 0 && <div style={{ fontSize: 13, color: 'var(--muted)' }}>{t('Inga händelser ännu.')}</div>}
      </div>
    </div>
  );
}

function MessagesCard({ id, role }: { id: string; role: UgcRole }) {
  const { data: messages = [] } = useUgcMessages(role, id);
  const send = useSendUgcMessage(role, id);
  const toast = useToast();
  const [body, setBody] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [messages.length]);
  const mine = (m: { senderRole: string }) => (role === 'brand' && m.senderRole === 'Brand') || (role === 'creator' && m.senderRole === 'Creator') || (role === 'admin' && m.senderRole === 'Admin');

  const go = () => {
    const text = body.trim();
    if (!text || send.isPending) return;
    send.mutate(text, { onSuccess: () => setBody(''), onError: (e) => toast.push(apiError(e, t('Kunde inte skicka')), 'error') });
  };

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="sec-head"><h3>{t('Chatt')}</h3></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto', padding: '2px 2px 6px' }}>
        {messages.length === 0 && <div style={{ fontSize: 13, color: 'var(--muted)', padding: '10px 0' }}>{t('Inga meddelanden än — frågor om briefen, produkten eller leveransen hör hemma här.')}</div>}
        {messages.map((m) => (
          <div key={m.id} style={{ display: 'flex', justifyContent: mine(m) ? 'flex-end' : 'flex-start' }}>
            <div style={{ maxWidth: '82%', padding: '9px 12px', borderRadius: 14, background: mine(m) ? 'linear-gradient(135deg,#1A2230,#0B0F17)' : 'rgba(255,244,236,.9)', color: mine(m) ? '#FFF4EC' : '#0B0F17', border: mine(m) ? 'none' : '1px solid rgba(241,168,143,.25)' }}>
              {!mine(m) && <div style={{ fontSize: 11, fontWeight: 700, color: '#C26A4A', marginBottom: 2 }}>{m.senderName}</div>}
              <div style={{ fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-line', wordBreak: 'break-word' }}>{m.body}</div>
              <div style={{ fontSize: 10.5, opacity: .6, marginTop: 3 }}>{formatDateTime(m.createdAt)}</div>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(241,168,143,.2)' }}>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go(); } }} rows={1} maxLength={4000} placeholder={t('Skriv…')}
          style={{ flex: 1, minWidth: 0, borderRadius: 12, border: '1px solid rgba(241,168,143,.3)', background: 'rgba(255,255,255,.85)', padding: '9px 12px', fontSize: 13.5, fontFamily: 'inherit', resize: 'none' }} />
        <button className="btn-apply" style={{ width: 'auto', padding: '9px 16px', fontSize: 13 }} disabled={!body.trim() || send.isPending} onClick={go}>{t('Skicka')}</button>
      </div>
    </div>
  );
}
