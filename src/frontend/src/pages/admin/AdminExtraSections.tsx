import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import api from '@/lib/api';
import { t, statusLabel, lang } from '@/lib/i18n';

/* Extra admin sections: overview stats, payouts, fraud and audit log.
   Styled to match the VYRLE light design system. */

interface AdminStats {
  totalUsers: number; pendingUsers: number; creators: number; brands: number;
  activeCampaigns: number; pendingCampaigns: number;
  pendingPayouts: number; pendingPayoutAmount: number; totalPaidOut: number;
  totalVerifiedViews: number; openFraudFlags: number;
}
interface PayoutRow { id: string; campaignName: string; amount: number; currency: string; status: string; payoutMethod: string; rejectionReason?: string; reviewedAt?: string; createdAt: string }
interface FraudRow { id: string; entityType: string; entityId: string; flagType: string; severity: string; description: string; status: string; resolution?: string; createdAt: string }
interface AuditRow { id: string; userId?: string; action: string; entityType?: string; entityId?: string; ipAddress?: string; createdAt: string; userEmail?: string | null; userRole?: string | null }
interface Paged<T> { data: T[]; totalCount: number }

const card: React.CSSProperties = { background: 'rgba(255,255,255,.82)', border: '1px solid rgba(255,255,255,.7)', borderRadius: 24, padding: '1.4rem', marginBottom: '1rem', boxShadow: '0 10px 34px rgba(180,120,90,.08), 0 2px 8px rgba(11,15,23,.04)' };
const mutedTx: React.CSSProperties = { color: '#6E7480', fontSize: '.82rem', fontWeight: 500 };
const rowLine: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '.9rem', padding: '.8rem 0', borderTop: '1px solid rgba(241,168,143,.14)', flexWrap: 'wrap' };
const pill = (bg: string, color: string): React.CSSProperties => ({ display: 'inline-block', padding: '.22rem .7rem', borderRadius: 999, fontSize: '.72rem', fontWeight: 600, background: bg, color });
const kr = (v: number) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(v);
const num = (v: number) => new Intl.NumberFormat('sv-SE').format(v);
const dt = (iso: string) => new Date(iso).toLocaleString(lang === 'en' ? 'en-US' : 'sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function statusPill(status: string) {
  const t = status.toLowerCase();
  if (['completed', 'approved', 'active', 'resolved_legitimate'].some((x) => t.includes(x))) return pill('rgba(47,157,91,.12)', '#2f9d5b');
  if (['pending', 'underreview', 'open', 'processing'].some((x) => t.includes(x))) return pill('rgba(255,216,199,.55)', '#b07d1c');
  if (['rejected', 'failed', 'fraud', 'critical', 'high'].some((x) => t.includes(x))) return pill('rgba(207,75,75,.12)', '#cf4b4b');
  return pill('rgba(183,188,200,.22)', '#5c6270');
}

const actionBtn = (bg: string): React.CSSProperties => ({ padding: '.5rem 1.1rem', borderRadius: 980, background: bg, color: '#fff', border: 'none', fontWeight: 600, fontSize: '.78rem', cursor: 'pointer' });

/* ── Audit rendering ───────────────────────────────────── */
const ACTION_LABELS: Record<string, string> = {
  'Auth.Login': 'Inloggning',
  'Auth.SocialLogin.TikTok': 'Inloggning via TikTok',
  'Auth.SocialRegister.TikTok': 'Konto skapat via TikTok',
  'Auth.PasswordChanged': 'Lösenord bytt',
  'Auth.PasswordReset': 'Lösenord återställt',
  'Auth.PasswordResetRequested': 'Lösenordsåterställning begärd',
  'Campaign.Created': 'Kampanj skapad',
  'Campaign.SubmittedForReview': 'Kampanj inskickad för granskning',
  'Campaign.Approved': 'Kampanj godkänd',
  'Campaign.Rejected': 'Kampanj nekad',
  'Application.Created': 'Kampanjansökan skickad',
  'Application.Approved': 'Kampanjansökan godkänd',
  'Application.Rejected': 'Kampanjansökan nekad',
  'Submission.Created': 'Video inskickad',
  'Submission.Approved': 'Video godkänd',
  'Submission.Rejected': 'Video nekad',
  'TikTok.Connected': 'TikTok-konto kopplat',
  'TikTok.Disconnected': 'TikTok-konto bortkopplat',
  'Assignment.ViewRefreshRequested': 'Viewsynk begärd',
  'Payout.Requested': 'Utbetalning begärd',
  'Payout.Approved': 'Utbetalning godkänd',
  'Payout.Rejected': 'Utbetalning nekad',
  'Admin.ApproveUser': 'Konto godkänt av admin',
  'Admin.RejectUser': 'Konto nekat av admin',
  'Admin.CreateAdmin': 'Ny admin skapad',
};
const actionLabel = (a: string) => ACTION_LABELS[a] ?? a.replace('.', ' · ');
function actionDot(a: string): string {
  if (a.startsWith('Payout')) return '#2f9d5b';
  if (a.startsWith('Campaign') || a.startsWith('Application')) return '#6a4ea8';
  if (a.startsWith('Submission') || a.startsWith('TikTok') || a.startsWith('Assignment')) return '#F1A88F';
  if (a.startsWith('Admin') || a.startsWith('Fraud')) return '#0B0F17';
  return '#B7BCC8';
}
const ROLE_LABEL: Record<string, string> = { Creator: 'Creator', Brand: 'Varumärke', Admin: 'Admin' };

function AuditRows({ rows }: { rows: AuditRow[] }) {
  return (
    <>
      {rows.map((a) => (
        <div key={a.id} style={rowLine}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: actionDot(a.action), flex: '0 0 9px' }} />
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontWeight: 600, fontSize: '.88rem', color: '#0B0F17' }}>{t(actionLabel(a.action))}</div>
            <div style={mutedTx}>
              {a.userEmail ?? t('Okänd användare')}
              {a.userRole && <span style={{ ...pill('rgba(183,188,200,.2)', '#5c6270'), marginLeft: 8, fontSize: '.66rem', padding: '.1rem .5rem' }}>{t(ROLE_LABEL[a.userRole] ?? a.userRole)}</span>}
            </div>
          </div>
          <span style={{ ...mutedTx, marginLeft: 'auto', whiteSpace: 'nowrap' }}>{dt(a.createdAt)}</span>
        </div>
      ))}
    </>
  );
}

/* ── Hooks ─────────────────────────────────────────────── */
function useAdminStats() {
  return useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => (await api.get<{ data: AdminStats }>('/admin/stats')).data.data,
    refetchInterval: 30000,
  });
}
function useAdminPayouts(status?: string) {
  return useQuery({
    queryKey: ['admin-payouts', status],
    queryFn: async () => (await api.get<{ data: Paged<PayoutRow> }>('/payouts/all', { params: { status: status || undefined, pageSize: 50 } })).data.data,
  });
}
function usePayoutAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action, reason }: { id: string; action: 'approve' | 'reject'; reason?: string }) => {
      if (action === 'approve') await api.post(`/payouts/${id}/approve`);
      else await api.post(`/payouts/${id}/reject`, { reason: reason ?? 'Avvisad av admin' });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-payouts'] }); qc.invalidateQueries({ queryKey: ['admin-stats'] }); },
  });
}
function useFraudFlags() {
  return useQuery({
    queryKey: ['admin-fraud'],
    queryFn: async () => (await api.get<{ data: Paged<FraudRow> }>('/fraud', { params: { pageSize: 50 } })).data.data,
  });
}
function useResolveFraud() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action, note }: { id: string; action: string; note?: string }) => {
      await api.post(`/fraud/${id}/resolve`, { action, note });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-fraud'] }); qc.invalidateQueries({ queryKey: ['admin-stats'] }); },
  });
}
function useAuditLog() {
  return useQuery({
    queryKey: ['admin-audit'],
    queryFn: async () => (await api.get<{ data: Paged<AuditRow> }>('/audit', { params: { pageSize: 50 } })).data.data,
  });
}

/* ── Översikt ──────────────────────────────────────────── */
function StatTile({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div style={{ ...card, marginBottom: 0, padding: '1.2rem 1.3rem' }}>
      <div style={mutedTx}>{label}</div>
      <div style={{ fontSize: '1.7rem', fontWeight: 700, letterSpacing: '-0.02em', marginTop: 4, color: accent ? '#C26A4A' : '#0B0F17' }}>{value}</div>
      {sub && <div style={{ ...mutedTx, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export function AdminOverviewSection() {
  const { data: stats, isLoading } = useAdminStats();
  const { data: audit } = useAuditLog();
  if (isLoading || !stats) return <div style={{ ...card, textAlign: 'center', color: '#6E7480' }}>{t('Laddar statistik…')}</div>;
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '1rem', marginBottom: '1.2rem' }}>
        <StatTile label={t('Användare')} value={num(stats.totalUsers)} sub={`${stats.pendingUsers} ${t('väntar på godkännande')}`} accent={stats.pendingUsers > 0} />
        <StatTile label="Creators" value={num(stats.creators)} />
        <StatTile label={t('Varumärken')} value={num(stats.brands)} />
        <StatTile label={t('Aktiva kampanjer')} value={num(stats.activeCampaigns)} sub={`${stats.pendingCampaigns} ${t('väntar på granskning')}`} />
        <StatTile label={t('Verifierade views')} value={num(stats.totalVerifiedViews)} />
        <StatTile label={t('Väntande utbetalningar')} value={num(stats.pendingPayouts)} sub={kr(stats.pendingPayoutAmount)} accent={stats.pendingPayouts > 0} />
        <StatTile label={t('Utbetalt totalt')} value={kr(stats.totalPaidOut)} />
        <StatTile label={t('Öppna säkerhetsflaggor')} value={num(stats.openFraudFlags)} accent={stats.openFraudFlags > 0} />
      </div>
      <div style={card}>
        <h3 style={{ fontWeight: 700, marginBottom: '.4rem' }}>{t('Senaste händelser')}</h3>
        <AuditRows rows={(audit?.data ?? []).slice(0, 8)} />
        {!audit?.data?.length && <div style={{ ...mutedTx, padding: '1rem 0' }}>{t('Inga händelser än.')}</div>}
      </div>
    </>
  );
}

/* ── Utbetalningar ─────────────────────────────────────── */
export function AdminPayoutsSection() {
  const [status, setStatus] = useState<string>('');
  const { data, isLoading } = useAdminPayouts(status);
  const act = usePayoutAction();
  const rows = data?.data ?? [];
  const tabs: [string, string][] = [['', t('Alla')], ['Pending', t('Väntande')], ['Approved', t('Godkända')], ['Completed', t('Utbetalda')], ['Rejected', t('Avvisade')]];

  return (
    <>
      <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {tabs.map(([val, label]) => (
          <button key={val} onClick={() => setStatus(val)}
            style={{ padding: '.45rem 1rem', borderRadius: 980, fontSize: '.8rem', fontWeight: 600, cursor: 'pointer', border: status === val ? '1px solid #0B0F17' : '1px solid rgba(241,168,143,.25)', background: status === val ? '#0B0F17' : 'rgba(255,255,255,.7)', color: status === val ? '#fff' : '#2C333F' }}>
            {label}
          </button>
        ))}
      </div>
      <div style={card}>
        {isLoading && <div style={{ ...mutedTx, padding: '1rem 0' }}>{t('Laddar…')}</div>}
        {!isLoading && rows.length === 0 && <div style={{ ...mutedTx, padding: '1rem 0' }}>{t('Inga utbetalningar')} {status ? t('med den statusen') : t('än')}.</div>}
        {rows.map((p) => (
          <div key={p.id} style={rowLine}>
            <div style={{ minWidth: 180 }}>
              <div style={{ fontWeight: 600, fontSize: '.9rem' }}>{p.campaignName}</div>
              <div style={mutedTx}>{statusLabel(p.payoutMethod)} · {dt(p.createdAt)}</div>
            </div>
            <div style={{ fontWeight: 700 }}>{kr(p.amount)}</div>
            <span style={statusPill(p.status)}>{statusLabel(p.status)}</span>
            {(p.status === 'Pending' || p.status === 'UnderReview') && (
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '.5rem' }}>
                <button style={actionBtn('#2f9d5b')} disabled={act.isPending}
                  onClick={() => act.mutate({ id: p.id, action: 'approve' })}>{t('Godkänn')}</button>
                <button style={actionBtn('#cf4b4b')} disabled={act.isPending}
                  onClick={() => { const reason = window.prompt(t('Anledning till avslag?')); if (reason !== null) act.mutate({ id: p.id, action: 'reject', reason: reason || 'Avvisad av admin' }); }}>{t('Avvisa')}</button>
              </div>
            )}
            {p.rejectionReason && <span style={{ ...mutedTx, marginLeft: 'auto' }}>{p.rejectionReason}</span>}
          </div>
        ))}
      </div>
    </>
  );
}

/* ── Säkerhet (fraud) ──────────────────────────────────── */
export function AdminFraudSection() {
  const { data, isLoading } = useFraudFlags();
  const resolve = useResolveFraud();
  const rows = data?.data ?? [];
  return (
    <div style={card}>
      <h3 style={{ fontWeight: 700, marginBottom: '.4rem' }}>{t('Säkerhetsflaggor')}</h3>
      {isLoading && <div style={{ ...mutedTx, padding: '1rem 0' }}>{t('Laddar…')}</div>}
      {!isLoading && rows.length === 0 && <div style={{ ...mutedTx, padding: '1rem 0' }}>{t('Inga flaggor — allt ser rent ut. ✨')}</div>}
      {rows.map((f) => (
        <div key={f.id} style={rowLine}>
          <span style={statusPill(f.severity)}>{statusLabel(f.severity)}</span>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontWeight: 600, fontSize: '.88rem' }}>{statusLabel(f.flagType)} · {statusLabel(f.entityType)}</div>
            <div style={mutedTx}>{f.description}</div>
          </div>
          <span style={statusPill(f.status)}>{statusLabel(f.status)}</span>
          {(f.status === 'Open' || f.status === 'UnderReview') ? (
            <div style={{ display: 'flex', gap: '.4rem' }}>
              <button style={actionBtn('#2f9d5b')} disabled={resolve.isPending}
                onClick={() => resolve.mutate({ id: f.id, action: 'Legitimate' })}>{t('Legitim')}</button>
              <button style={actionBtn('#cf4b4b')} disabled={resolve.isPending}
                onClick={() => resolve.mutate({ id: f.id, action: 'Fraud', note: 'Bekräftat av admin' })}>{t('Bedrägeri')}</button>
              <button style={actionBtn('#8a909e')} disabled={resolve.isPending}
                onClick={() => resolve.mutate({ id: f.id, action: 'Dismiss' })}>{t('Avfärda')}</button>
            </div>
          ) : (
            <span style={{ ...mutedTx }}>{dt(f.createdAt)}</span>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Logg (audit) ──────────────────────────────────────── */
export function AdminAuditSection() {
  const { data, isLoading } = useAuditLog();
  const rows = data?.data ?? [];
  return (
    <div style={card}>
      <h3 style={{ fontWeight: 700, marginBottom: '.4rem' }}>{t('Händelselogg')}</h3>
      {isLoading && <div style={{ ...mutedTx, padding: '1rem 0' }}>{t('Laddar…')}</div>}
      {!isLoading && rows.length === 0 && <div style={{ ...mutedTx, padding: '1rem 0' }}>{t('Loggen är tom.')}</div>}
      <AuditRows rows={rows} />
    </div>
  );
}

/* ── Lägg till admin (endast huvudadmin) ───────────────── */
export function AdminCreateAdminCard() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '', password: '' });
  const [message, setMessage] = useState('');
  const create = useMutation({
    mutationFn: async () => { await api.post('/admin/users/admins', form); },
    onSuccess: () => { setMessage('Admin skapad! Skicka inloggningsuppgifterna säkert.'); setForm({ email: '', firstName: '', lastName: '', password: '' }); },
    onError: (err: any) => setMessage(err?.response?.data?.error?.message ?? 'Kunde inte skapa admin.'),
  });

  const input: React.CSSProperties = { width: '100%', padding: '.6rem .8rem', borderRadius: 12, border: '1px solid rgba(241,168,143,.3)', background: '#fff', fontSize: '.88rem', color: '#0B0F17' };

  return (
    <div style={{ ...card, padding: '1.1rem 1.3rem' }}>
      <button type="button" onClick={() => setOpen((v) => !v)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '.92rem', color: '#0B0F17', padding: 0 }}>
        {open ? '▾' : '▸'} {t('Lägg till admin')}
      </button>
      <div style={{ ...mutedTx, marginTop: 2 }}>{t('Endast huvudadmin. Nya admins får full panelåtkomst men kan inte skapa fler admins.')}</div>
      {open && (
        <form style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '.7rem', marginTop: '.9rem' }}
          onSubmit={(e) => { e.preventDefault(); setMessage(''); create.mutate(); }}>
          <input style={input} type="email" required placeholder={t('E-post')} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input style={input} type="text" required placeholder={t('Förnamn')} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          <input style={input} type="text" required placeholder={t('Efternamn')} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          <input style={input} type="password" required minLength={12} placeholder={t('Lösenord (minst 12 tecken)')} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" />
          <button type="submit" disabled={create.isPending}
            style={{ padding: '.6rem 1.4rem', borderRadius: 980, background: 'linear-gradient(135deg,#1A2230,#0B0F17)', color: '#fff', border: 'none', fontWeight: 600, fontSize: '.85rem', cursor: 'pointer' }}>
            {create.isPending ? t('Skapar…') : t('Skapa admin')}
          </button>
        </form>
      )}
      {message && <div style={{ marginTop: '.6rem', fontSize: '.85rem', color: message.startsWith('Admin skapad') ? '#2f9d5b' : '#cf4b4b', fontWeight: 600 }}>{t(message)}</div>}
    </div>
  );
}

