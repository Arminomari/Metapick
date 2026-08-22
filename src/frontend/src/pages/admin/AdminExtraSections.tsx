import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import api from '@/lib/api';

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
interface AuditRow { id: string; userId?: string; action: string; entityType?: string; entityId?: string; ipAddress?: string; createdAt: string }
interface Paged<T> { data: T[]; totalCount: number }

const card: React.CSSProperties = { background: 'rgba(255,255,255,.82)', border: '1px solid rgba(255,255,255,.7)', borderRadius: 24, padding: '1.4rem', marginBottom: '1rem', boxShadow: '0 10px 34px rgba(180,120,90,.08), 0 2px 8px rgba(11,15,23,.04)' };
const mutedTx: React.CSSProperties = { color: '#6E7480', fontSize: '.82rem', fontWeight: 500 };
const rowLine: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '.9rem', padding: '.8rem 0', borderTop: '1px solid rgba(241,168,143,.14)', flexWrap: 'wrap' };
const pill = (bg: string, color: string): React.CSSProperties => ({ display: 'inline-block', padding: '.22rem .7rem', borderRadius: 999, fontSize: '.72rem', fontWeight: 600, background: bg, color });
const kr = (v: number) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(v);
const num = (v: number) => new Intl.NumberFormat('sv-SE').format(v);
const dt = (iso: string) => new Date(iso).toLocaleString('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function statusPill(status: string) {
  const t = status.toLowerCase();
  if (['completed', 'approved', 'active', 'resolved_legitimate'].some((x) => t.includes(x))) return pill('rgba(47,157,91,.12)', '#2f9d5b');
  if (['pending', 'underreview', 'open', 'processing'].some((x) => t.includes(x))) return pill('rgba(255,216,199,.55)', '#b07d1c');
  if (['rejected', 'failed', 'fraud', 'critical', 'high'].some((x) => t.includes(x))) return pill('rgba(207,75,75,.12)', '#cf4b4b');
  return pill('rgba(183,188,200,.22)', '#5c6270');
}

const actionBtn = (bg: string): React.CSSProperties => ({ padding: '.5rem 1.1rem', borderRadius: 980, background: bg, color: '#fff', border: 'none', fontWeight: 600, fontSize: '.78rem', cursor: 'pointer' });

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
  if (isLoading || !stats) return <div style={{ ...card, textAlign: 'center', color: '#6E7480' }}>Laddar statistik…</div>;
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '1rem', marginBottom: '1.2rem' }}>
        <StatTile label="Användare" value={num(stats.totalUsers)} sub={`${stats.pendingUsers} väntar på godkännande`} accent={stats.pendingUsers > 0} />
        <StatTile label="Creators" value={num(stats.creators)} />
        <StatTile label="Varumärken" value={num(stats.brands)} />
        <StatTile label="Aktiva kampanjer" value={num(stats.activeCampaigns)} sub={`${stats.pendingCampaigns} väntar på granskning`} />
        <StatTile label="Verifierade views" value={num(stats.totalVerifiedViews)} />
        <StatTile label="Väntande utbetalningar" value={num(stats.pendingPayouts)} sub={kr(stats.pendingPayoutAmount)} accent={stats.pendingPayouts > 0} />
        <StatTile label="Utbetalt totalt" value={kr(stats.totalPaidOut)} />
        <StatTile label="Öppna säkerhetsflaggor" value={num(stats.openFraudFlags)} accent={stats.openFraudFlags > 0} />
      </div>
      <div style={card}>
        <h3 style={{ fontWeight: 700, marginBottom: '.4rem' }}>Senaste händelser</h3>
        {(audit?.data ?? []).slice(0, 8).map((a) => (
          <div key={a.id} style={rowLine}>
            <span style={{ fontWeight: 600, fontSize: '.85rem' }}>{a.action}</span>
            <span style={mutedTx}>{a.entityType ?? ''}</span>
            <span style={{ ...mutedTx, marginLeft: 'auto' }}>{dt(a.createdAt)}</span>
          </div>
        ))}
        {!audit?.data?.length && <div style={{ ...mutedTx, padding: '1rem 0' }}>Inga händelser än.</div>}
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
  const tabs: [string, string][] = [['', 'Alla'], ['Pending', 'Väntande'], ['Approved', 'Godkända'], ['Completed', 'Utbetalda'], ['Rejected', 'Avvisade']];

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
        {isLoading && <div style={{ ...mutedTx, padding: '1rem 0' }}>Laddar…</div>}
        {!isLoading && rows.length === 0 && <div style={{ ...mutedTx, padding: '1rem 0' }}>Inga utbetalningar {status ? 'med den statusen' : 'än'}.</div>}
        {rows.map((p) => (
          <div key={p.id} style={rowLine}>
            <div style={{ minWidth: 180 }}>
              <div style={{ fontWeight: 600, fontSize: '.9rem' }}>{p.campaignName}</div>
              <div style={mutedTx}>{p.payoutMethod} · {dt(p.createdAt)}</div>
            </div>
            <div style={{ fontWeight: 700 }}>{kr(p.amount)}</div>
            <span style={statusPill(p.status)}>{p.status}</span>
            {(p.status === 'Pending' || p.status === 'UnderReview') && (
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '.5rem' }}>
                <button style={actionBtn('#2f9d5b')} disabled={act.isPending}
                  onClick={() => act.mutate({ id: p.id, action: 'approve' })}>Godkänn</button>
                <button style={actionBtn('#cf4b4b')} disabled={act.isPending}
                  onClick={() => { const reason = window.prompt('Anledning till avslag?'); if (reason !== null) act.mutate({ id: p.id, action: 'reject', reason: reason || 'Avvisad av admin' }); }}>Avvisa</button>
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
      <h3 style={{ fontWeight: 700, marginBottom: '.4rem' }}>Säkerhetsflaggor</h3>
      {isLoading && <div style={{ ...mutedTx, padding: '1rem 0' }}>Laddar…</div>}
      {!isLoading && rows.length === 0 && <div style={{ ...mutedTx, padding: '1rem 0' }}>Inga flaggor — allt ser rent ut. ✨</div>}
      {rows.map((f) => (
        <div key={f.id} style={rowLine}>
          <span style={statusPill(f.severity)}>{f.severity}</span>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontWeight: 600, fontSize: '.88rem' }}>{f.flagType} · {f.entityType}</div>
            <div style={mutedTx}>{f.description}</div>
          </div>
          <span style={statusPill(f.status)}>{f.status}</span>
          {(f.status === 'Open' || f.status === 'UnderReview') ? (
            <div style={{ display: 'flex', gap: '.4rem' }}>
              <button style={actionBtn('#2f9d5b')} disabled={resolve.isPending}
                onClick={() => resolve.mutate({ id: f.id, action: 'Legitimate' })}>Legitim</button>
              <button style={actionBtn('#cf4b4b')} disabled={resolve.isPending}
                onClick={() => resolve.mutate({ id: f.id, action: 'Fraud', note: 'Bekräftat av admin' })}>Bedrägeri</button>
              <button style={actionBtn('#8a909e')} disabled={resolve.isPending}
                onClick={() => resolve.mutate({ id: f.id, action: 'Dismiss' })}>Avfärda</button>
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
      <h3 style={{ fontWeight: 700, marginBottom: '.4rem' }}>Händelselogg</h3>
      {isLoading && <div style={{ ...mutedTx, padding: '1rem 0' }}>Laddar…</div>}
      {!isLoading && rows.length === 0 && <div style={{ ...mutedTx, padding: '1rem 0' }}>Loggen är tom.</div>}
      {rows.map((a) => (
        <div key={a.id} style={rowLine}>
          <span style={{ fontWeight: 600, fontSize: '.85rem', minWidth: 200 }}>{a.action}</span>
          <span style={mutedTx}>{a.entityType ?? ''}</span>
          <span style={mutedTx}>{a.ipAddress ?? ''}</span>
          <span style={{ ...mutedTx, marginLeft: 'auto' }}>{dt(a.createdAt)}</span>
        </div>
      ))}
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
        {open ? '▾' : '▸'} Lägg till admin
      </button>
      <div style={{ ...mutedTx, marginTop: 2 }}>Endast huvudadmin. Nya admins får full panelåtkomst men kan inte skapa fler admins.</div>
      {open && (
        <form style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '.7rem', marginTop: '.9rem' }}
          onSubmit={(e) => { e.preventDefault(); setMessage(''); create.mutate(); }}>
          <input style={input} type="email" required placeholder="E-post" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input style={input} type="text" required placeholder="Förnamn" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          <input style={input} type="text" required placeholder="Efternamn" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          <input style={input} type="password" required minLength={12} placeholder="Lösenord (minst 12 tecken)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" />
          <button type="submit" disabled={create.isPending}
            style={{ padding: '.6rem 1.4rem', borderRadius: 980, background: 'linear-gradient(135deg,#1A2230,#0B0F17)', color: '#fff', border: 'none', fontWeight: 600, fontSize: '.85rem', cursor: 'pointer' }}>
            {create.isPending ? 'Skapar…' : 'Skapa admin'}
          </button>
        </form>
      )}
      {message && <div style={{ marginTop: '.6rem', fontSize: '.85rem', color: message.startsWith('Admin skapad') ? '#2f9d5b' : '#cf4b4b', fontWeight: 600 }}>{message}</div>}
    </div>
  );
}

