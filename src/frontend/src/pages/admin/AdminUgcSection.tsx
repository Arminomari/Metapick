import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '@/lib/i18n';
import { formatDate, formatNumber } from '@/lib/utils';
import {
  useUgcAdminOverview, useUgcAdminCreators, useUgcAdminSetCreatorStatus, useUgcAdminDisputes, useUgcAdminResolveDispute, useUgcCollabs,
  formatOre, collabStatusLabel, COLLAB_TONE, CREATOR_STATUS_SV, apiError,
} from '@/hooks/ugc';

const card: React.CSSProperties = { background: 'rgba(255,255,255,.82)', border: '1px solid rgba(255,255,255,.7)', borderRadius: 24, padding: 'clamp(1rem, 3.5vw, 1.4rem)', marginBottom: '1rem', minWidth: 0, boxShadow: '0 10px 34px rgba(180,120,90,.08), 0 2px 8px rgba(11,15,23,.04)' };
const mutedTx: React.CSSProperties = { color: '#6E7480', fontSize: '.82rem', fontWeight: 500 };
const pill = (active: boolean): React.CSSProperties => ({ padding: '.45rem 1rem', borderRadius: 980, border: active ? '1px solid #0B0F17' : '1px solid rgba(241,168,143,.25)', background: active ? 'linear-gradient(135deg,#1A2230,#0B0F17)' : 'rgba(255,255,255,.7)', color: active ? '#fff' : '#2C333F', cursor: 'pointer', fontSize: '.82rem', fontWeight: 600 });
const btnDark: React.CSSProperties = { padding: '.5rem 1.1rem', borderRadius: 980, background: 'linear-gradient(135deg,#1A2230,#0B0F17)', color: '#fff', border: 'none', fontWeight: 600, fontSize: '.8rem', cursor: 'pointer' };
const btnLine = (color = '#0B0F17'): React.CSSProperties => ({ padding: '.5rem 1rem', borderRadius: 980, background: 'transparent', color, border: `1px solid ${color}`, fontWeight: 600, fontSize: '.8rem', cursor: 'pointer' });
const input: React.CSSProperties = { width: '100%', minWidth: 0, padding: '.6rem .8rem', borderRadius: 12, border: '1px solid rgba(241,168,143,.3)', background: '#fff', fontSize: '.88rem', color: '#0B0F17', fontFamily: 'inherit' };

/** Admin: verification queue, dispute desk, marketplace numbers and what still needs keys. */
export function AdminUgcSection() {
  const [tab, setTab] = useState<'overview' | 'creators' | 'disputes' | 'collabs'>('overview');
  const { data: o } = useUgcAdminOverview();
  const { data: openDisputes = [] } = useUgcAdminDisputes(true);
  const { data: pending = [] } = useUgcAdminCreators('Pending');
  const { data: verified = [] } = useUgcAdminCreators('Verified');
  const queue = pending.length + verified.length;

  return (
    <>
      <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1.2rem', flexWrap: 'wrap' }}>
        <button style={pill(tab === 'overview')} onClick={() => setTab('overview')}>{t('Översikt')}</button>
        <button style={pill(tab === 'creators')} onClick={() => setTab('creators')}>{t('Verifieringskö')}{queue > 0 && <Badge n={queue} />}</button>
        <button style={pill(tab === 'disputes')} onClick={() => setTab('disputes')}>{t('Tvister')}{openDisputes.length > 0 && <Badge n={openDisputes.length} />}</button>
        <button style={pill(tab === 'collabs')} onClick={() => setTab('collabs')}>{t('Alla uppdrag')}</button>
      </div>
      {tab === 'overview' && o && <Overview o={o} />}
      {tab === 'creators' && <CreatorQueue />}
      {tab === 'disputes' && <DisputeDesk />}
      {tab === 'collabs' && <AllCollabs />}
    </>
  );
}

const Badge = ({ n }: { n: number }) => <span style={{ marginLeft: 6, background: '#C26A4A', color: '#fff', borderRadius: 999, fontSize: '.7rem', fontWeight: 700, padding: '1px 7px' }}>{n}</span>;

function Overview({ o }: { o: NonNullable<ReturnType<typeof useUgcAdminOverview>['data']> }) {
  const Tile = ({ label, value, sub }: { label: string; value: string | number; sub?: string }) => (
    <div style={{ ...card, marginBottom: 0, padding: '1rem 1.1rem' }}>
      <div style={mutedTx}>{label}</div>
      <div style={{ fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-.02em', marginTop: 2 }}>{value}</div>
      {sub && <div style={{ ...mutedTx, marginTop: 2 }}>{sub}</div>}
    </div>
  );
  const Flag = ({ ok, label, hint }: { ok: boolean; label: string; hint: string }) => (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '.6rem 0', borderBottom: '1px solid rgba(241,168,143,.18)' }}>
      <span style={{ fontSize: 18, lineHeight: 1 }}>{ok ? '🟢' : '🟡'}</span>
      <div><div style={{ fontWeight: 700, fontSize: '.9rem' }}>{label}</div><div style={mutedTx}>{ok ? t('Aktiv') : hint}</div></div>
    </div>
  );
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '.8rem', marginBottom: '1rem' }}>
        <Tile label={t('Väntar på verifiering')} value={o.pendingVerification} sub={`${o.verifiedAwaitingApproval} ${t('verifierade, ej godkända')}`} />
        <Tile label={t('Öppna tvister')} value={o.openDisputes} />
        <Tile label={t('Pågående uppdrag')} value={o.activeCollabs} sub={`${o.publishedCampaigns} ${t('öppna beställningar')}`} />
        <Tile label={t('Hålls just nu')} value={formatOre(o.heldOre)} />
        <Tile label={t('Utbetalt till creators')} value={formatOre(o.paidOutOre)} />
        <Tile label={t('Avgifter intjänade')} value={formatOre(o.feesEarnedOre)} sub={`${o.feePercent} %`} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '1rem' }}>
        <div style={card}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{t('Integrationer')}</div>
          <Flag ok={o.stripeConfigured} label="Stripe Connect" hint={t('Lägg in Stripe__SecretKey och Stripe__WebhookSecret i Railway. Tills dess: registrera betalningar manuellt på uppdraget.')} />
          <Flag ok={o.storageConfigured} label={t('Videolagring (S3/R2)')} hint={t('Lägg in Storage__S3__Bucket, AccessKey, SecretKey, ServiceUrl. Tills dess sparas videos på servern (försvinner vid omstart).')} />
          <Flag ok={o.aiConfigured} label={t('AI-brief (Anthropic)')} hint={t('Lägg in Anthropic__ApiKey så kan företag generera briefs.')} />
        </div>
        <div style={card}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{t('Inställningar')}</div>
          <div style={{ ...mutedTx, marginBottom: 8 }}>{t('Sätts som miljövariabler (Ugc__…) — ändringar kräver omstart.')}</div>
          {[
            ['Ugc__PlatformFeePercent', `${o.feePercent} %`], ['Ugc__AutoApproveDays', `${o.autoApproveDays} ${t('dagar')}`], ['Ugc__RevisionDeadlineDays', `${o.revisionDeadlineDays} ${t('dagar')}`],
            ['Ugc__MaxRevisions', o.maxRevisions], ['Ugc__StrikesToSuspend', o.strikesToSuspend], ['Ugc__AutoVerifyMinFollowers', formatNumber(o.autoVerifyMinFollowers)],
            ['Ugc__AutoVerifyMinLikeFollowerRatio', o.autoVerifyMinLikeFollowerRatio], ['Ugc__RequireFTaxForPaid', o.requireFTaxForPaid ? t('ja') : t('nej')], ['Ugc__ContractTemplateVersion', o.contractTemplateVersion],
          ].map(([k, v]) => <div key={String(k)} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: '.82rem', padding: '.3rem 0', borderBottom: '1px solid rgba(241,168,143,.14)' }}><span style={{ fontFamily: 'ui-monospace, Menlo, monospace', color: '#6E7480' }}>{k}</span><strong>{String(v)}</strong></div>)}
        </div>
      </div>
    </>
  );
}

function CreatorQueue() {
  const [status, setStatus] = useState<string>('Pending');
  const { data: rows = [], isLoading } = useUgcAdminCreators(status === 'All' ? undefined : status);
  const set = useUgcAdminSetCreatorStatus();
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');

  const decide = (id: string, to: string) => set.mutate({ id, status: to, note: note || undefined }, {
    onSuccess: () => { setMsg(t('Sparat')); setNoteFor(null); setNote(''); },
    onError: (e) => setMsg(apiError(e, t('Kunde inte spara'))),
  });

  return (
    <>
      <div style={{ display: 'flex', gap: '.4rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {['Pending', 'Verified', 'Approved', 'Suspended', 'All'].map((s) => <button key={s} style={pill(status === s)} onClick={() => setStatus(s)}>{s === 'All' ? t('Alla') : t(CREATOR_STATUS_SV[s])}</button>)}
      </div>
      {msg && <div style={{ ...mutedTx, marginBottom: 8, color: msg === t('Sparat') ? '#2f9d5b' : '#cf4b4b' }}>{msg}</div>}
      {isLoading && <div style={mutedTx}>{t('Laddar…')}</div>}
      {!isLoading && rows.length === 0 && <div style={{ ...card, textAlign: 'center', color: '#6E7480' }}>{t('Inga creators i den här kön.')}</div>}
      {rows.map((r) => (
        <div key={r.creatorProfileId} style={card}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {r.avatarUrl ? <img src={r.avatarUrl} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} /> : <span style={{ width: 44, height: 44, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg,#FFD8C7,#F1A88F)', color: '#fff', fontWeight: 800 }}>{(r.displayName[0] || '?').toUpperCase()}</span>}
            <div style={{ flex: '1 1 240px', minWidth: 0 }}>
              <div style={{ fontWeight: 700, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {r.displayName}
                <span style={{ fontSize: '.72rem', fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: r.status === 'Approved' ? 'rgba(47,157,91,.12)' : r.status === 'Suspended' ? 'rgba(207,75,75,.12)' : 'rgba(255,216,199,.55)', color: r.status === 'Approved' ? '#2f9d5b' : r.status === 'Suspended' ? '#cf4b4b' : '#b07d1c' }}>{t(CREATOR_STATUS_SV[r.status])}</span>
                {r.strikes > 0 && <span style={{ fontSize: '.72rem', color: '#cf4b4b', fontWeight: 700 }}>{r.strikes} {t('anmärkning(ar)')}</span>}
              </div>
              <div style={{ ...mutedTx, marginTop: 2, overflowWrap: 'anywhere' }}>
                {r.email}{r.tikTokUsername ? ` · @${r.tikTokUsername}` : ''} · {formatNumber(r.followerSnapshot)} {t('följare')} · L/F {(r.likeFollowerRatio * 100).toFixed(0)} % · {r.deliveredCount} {t('leveranser')}{r.averageRating > 0 ? ` · ★ ${r.averageRating.toFixed(1)}` : ''}
              </div>
              <div style={{ ...mutedTx, marginTop: 2 }}>
                {r.categories.join(', ') || '–'}{r.city ? ` · ${r.city}` : ''} · {r.payoutOnboardingComplete ? t('utbetalning klar') : t('utbetalning saknas')} · {r.sampleVideoUrl ? <a href={r.sampleVideoUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#C26A4A' }}>{t('exempelvideo')}</a> : t('ingen exempelvideo')}
              </div>
              {r.statusNote && <div style={{ ...mutedTx, marginTop: 4, fontStyle: 'italic' }}>{r.statusNote}</div>}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {r.status !== 'Approved' && <button style={{ ...btnDark, background: '#2f9d5b' }} disabled={set.isPending} onClick={() => decide(r.creatorProfileId, 'Approved')}>✓ {t('Godkänn')}</button>}
              {r.status !== 'Suspended' && <button style={btnLine('#cf4b4b')} onClick={() => setNoteFor(noteFor === r.creatorProfileId ? null : r.creatorProfileId)}>{t('Stäng av')}</button>}
              {r.status === 'Suspended' && <button style={btnLine()} disabled={set.isPending} onClick={() => decide(r.creatorProfileId, 'Verified')}>{t('Häv avstängning')}</button>}
            </div>
          </div>
          {noteFor === r.creatorProfileId && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <input style={{ ...input, flex: '1 1 200px' }} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('Orsak (visas för creatorn)')} />
              <button style={{ ...btnDark, background: '#cf4b4b' }} disabled={set.isPending || !note.trim()} onClick={() => decide(r.creatorProfileId, 'Suspended')}>{t('Bekräfta avstängning')}</button>
            </div>
          )}
        </div>
      ))}
    </>
  );
}

function DisputeDesk() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  const { data: rows = [], isLoading } = useUgcAdminDisputes(open);
  const resolve = useUgcAdminResolveDispute();
  const [active, setActive] = useState<string | null>(null);
  const [decision, setDecision] = useState('PayCreator');
  const [share, setShare] = useState(50);
  const [reasoning, setReasoning] = useState('');
  const [msg, setMsg] = useState('');

  const go = (id: string) => resolve.mutate({ id, decision, creatorSharePercent: decision === 'Split' ? share : undefined, reasoning }, {
    onSuccess: () => { setMsg(t('Tvisten är avgjord och båda parter har fått besked.')); setActive(null); setReasoning(''); },
    onError: (e) => setMsg(apiError(e, t('Kunde inte avgöra tvisten'))),
  });

  return (
    <>
      <div style={{ display: 'flex', gap: '.4rem', marginBottom: '1rem' }}>
        <button style={pill(open)} onClick={() => setOpen(true)}>{t('Öppna')}</button>
        <button style={pill(!open)} onClick={() => setOpen(false)}>{t('Alla')}</button>
      </div>
      <div style={{ ...mutedTx, marginBottom: 10 }}>{t('Bedöm en sak: följer leveransen briefen? Beslutet flyttar pengarna och loggas med din motivering.')}</div>
      {msg && <div style={{ ...mutedTx, marginBottom: 8, color: msg.startsWith('Tvisten') ? '#2f9d5b' : '#cf4b4b' }}>{msg}</div>}
      {isLoading && <div style={mutedTx}>{t('Laddar…')}</div>}
      {!isLoading && rows.length === 0 && <div style={{ ...card, textAlign: 'center', color: '#6E7480' }}>{t('Inga tvister.')}</div>}
      {rows.map((d) => (
        <div key={d.disputeId} style={{ ...card, border: d.status === 'Open' ? '1px solid rgba(207,75,75,.35)' : undefined }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ flex: '1 1 260px', minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>{d.title} <span style={mutedTx}>· {d.brandName} ↔ {d.creatorName}</span></div>
              <div style={{ ...mutedTx, marginTop: 2 }}>{t('Öppnad av')} {d.openedBy === 'Brand' ? d.brandName : d.creatorName} {formatDate(d.openedAt)} · {t('avtalat')} {formatOre(d.agreedAmountOre)} · {t('hålls')} {formatOre(d.brandPaidOre)}</div>
              <div style={{ marginTop: 8, padding: '.6rem .8rem', borderRadius: 12, background: 'rgba(255,244,236,.8)', fontSize: '.88rem', lineHeight: 1.5 }}>{d.reason}</div>
              {d.status === 'Resolved' && <div style={{ ...mutedTx, marginTop: 6 }}>{t('Beslut')}: <strong>{d.decision}{d.creatorSharePercent ? ` ${d.creatorSharePercent} %` : ''}</strong> · {d.resolvedAt ? formatDate(d.resolvedAt) : ''}</div>}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button style={btnLine()} onClick={() => navigate(`/admin/ugc/collabs/${d.collabId}`)}>{t('Öppna uppdraget')}</button>
              {d.status === 'Open' && <button style={btnDark} onClick={() => setActive(active === d.disputeId ? null : d.disputeId)}>{t('Avgör')}</button>}
            </div>
          </div>
          {active === d.disputeId && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(241,168,143,.2)', display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[['PayCreator', t('Creatorn får betalt')], ['RefundBrand', t('Företaget återbetalas')], ['Split', t('Dela')]].map(([k, l]) => <button key={k} style={pill(decision === k)} onClick={() => setDecision(k)}>{l}</button>)}
                {decision === 'Split' && <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '.85rem' }}>{t('Creatorns andel')} <input type="number" min={1} max={99} value={share} onChange={(e) => setShare(Number(e.target.value))} style={{ ...input, width: 80 }} /> %</label>}
              </div>
              <textarea style={{ ...input, minHeight: 80 }} value={reasoning} onChange={(e) => setReasoning(e.target.value)} placeholder={t('Motivering (minst 20 tecken) — visas för båda parter')} />
              <div><button style={btnDark} disabled={resolve.isPending || reasoning.trim().length < 20} onClick={() => go(d.disputeId)}>{resolve.isPending ? t('Sparar…') : t('Bekräfta beslut')}</button></div>
            </div>
          )}
        </div>
      ))}
    </>
  );
}

function AllCollabs() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<string | undefined>(undefined);
  const { data: rows = [], isLoading } = useUgcCollabs('admin', status);
  return (
    <>
      <div style={{ display: 'flex', gap: '.4rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {[undefined, 'Invited', 'Accepted', 'Submitted', 'Disputed', 'Approved', 'Paid', 'Cancelled'].map((s) => <button key={s ?? 'all'} style={pill(status === s)} onClick={() => setStatus(s)}>{s ? collabStatusLabel(s) : t('Alla')}</button>)}
      </div>
      {isLoading && <div style={mutedTx}>{t('Laddar…')}</div>}
      {!isLoading && rows.length === 0 && <div style={{ ...card, textAlign: 'center', color: '#6E7480' }}>{t('Inga uppdrag.')}</div>}
      {rows.map((c) => (
        <div key={c.id} style={{ ...card, padding: '.9rem 1.1rem', cursor: 'pointer' }} onClick={() => navigate(`/admin/ugc/collabs/${c.id}`)}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700 }}>{c.title}</span>
            <span className={`vy-badge ${COLLAB_TONE[c.status] ?? 'neu'}`}>{collabStatusLabel(c.status)}</span>
            <span style={mutedTx}>{c.brandName} ↔ {c.creatorName} · {c.compensation === 'ProductExchange' ? t('Produktbyte') : formatOre(c.brandTotalOre)} · {c.funded ? t('betalt') : t('ej betalt')} · {formatDate(c.updatedAt)}</span>
          </div>
        </div>
      ))}
    </>
  );
}
