import { useState } from 'react';
import type { CSSProperties } from 'react';
import api from '@/lib/api';
import { useProfile } from '@/hooks/api';
import { t } from '@/lib/i18n';

const input: CSSProperties = {
  width: '100%', border: '1px solid rgba(241,168,143,.28)', borderRadius: 13,
  padding: '12px 14px', fontSize: 13.5, fontFamily: 'inherit',
  background: 'rgba(255,255,255,.75)', color: '#0B0F17',
};
const label: CSSProperties = { fontSize: 12, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6, display: 'block' };
const ok: CSSProperties = { marginTop: 10, fontSize: 13, fontWeight: 600, color: '#2f7d52' };
const bad: CSSProperties = { marginTop: 10, fontSize: 13, fontWeight: 600, color: '#cf4b4b' };

// ── Change password ────────────────────────────────────
export function ChangePasswordCard() {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(''); setErr('');
    if (form.next !== form.confirm) { setErr(t('De nya lösenorden matchar inte.')); return; }
    setBusy(true);
    try {
      await api.post('/auth/change-password', { currentPassword: form.current, newPassword: form.next });
      setMsg(t('Lösenordet är bytt!'));
      setForm({ current: '', next: '', confirm: '' });
    } catch (e2: any) {
      setErr(e2?.response?.data?.error?.message ?? t('Kunde inte byta lösenord.'));
    }
    setBusy(false);
  };

  return (
    <div className="card" style={{ maxWidth: 860, marginTop: 16 }}>
      <div className="sec-head"><h3>{t('Byt lösenord')}</h3></div>
      <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <div><span style={label}>{t('Nuvarande lösenord')}</span><input style={input} type="password" required value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} autoComplete="current-password" /></div>
        <div><span style={label}>{t('Nytt lösenord')}</span><input style={input} type="password" required minLength={8} value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} autoComplete="new-password" placeholder={t('Minst 8 tecken, versal + siffra')} /></div>
        <div><span style={label}>{t('Bekräfta nytt lösenord')}</span><input style={input} type="password" required value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} autoComplete="new-password" /></div>
        <div style={{ alignSelf: 'end' }}>
          <button type="submit" className="btn-apply" style={{ width: 'auto', padding: '12px 24px' }} disabled={busy}>{busy ? t('Sparar…') : t('Byt lösenord')}</button>
        </div>
      </form>
      {msg && <div style={ok}>✓ {msg}</div>}
      {err && <div style={bad}>{err}</div>}
    </div>
  );
}

// ── Change email ───────────────────────────────────────
export function ChangeEmailCard() {
  const { data: prof } = useProfile();
  const [form, setForm] = useState({ email: '', password: '' });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(''); setErr('');
    setBusy(true);
    try {
      await api.post('/auth/change-email', { newEmail: form.email, currentPassword: form.password });
      setMsg(t('E-postadressen är bytt! En verifieringslänk har skickats till den nya adressen — bekräfta för att aktivera den fullt ut.'));
      setForm({ email: '', password: '' });
    } catch (e2: any) {
      setErr(e2?.response?.data?.error?.message ?? t('Kunde inte byta e-postadress.'));
    }
    setBusy(false);
  };

  return (
    <div className="card" style={{ maxWidth: 860, marginTop: 16 }}>
      <div className="sec-head"><h3>{t('Byt e-postadress')}</h3></div>
      {prof && <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--muted)' }}>{t('Nuvarande adress:')} <strong style={{ color: '#0B0F17' }}>{prof.email}</strong></p>}
      <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <div><span style={label}>{t('Ny e-postadress')}</span><input style={input} type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" placeholder={t('ny@adress.se')} /></div>
        <div><span style={label}>{t('Ditt lösenord')}</span><input style={input} type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="current-password" /></div>
        <div style={{ alignSelf: 'end' }}>
          <button type="submit" className="btn-apply" style={{ width: 'auto', padding: '12px 24px' }} disabled={busy}>{busy ? t('Sparar…') : t('Byt e-post')}</button>
        </div>
      </form>
      {msg && <div style={ok}>✓ {msg}</div>}
      {err && <div style={bad}>{err}</div>}
    </div>
  );
}
