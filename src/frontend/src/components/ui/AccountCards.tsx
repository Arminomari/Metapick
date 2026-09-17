import { useState } from 'react';
import type { CSSProperties } from 'react';
import api from '@/lib/api';
import { useProfile } from '@/hooks/api';
import { t, LangSwitcher } from '@/lib/i18n';
import { useAuthStore } from '@/stores/authStore';

const input: CSSProperties = {
  width: '100%', minWidth: 0, border: '1px solid rgba(241,168,143,.28)', borderRadius: 13,
  padding: '12px 14px', fontSize: 13.5, fontFamily: 'inherit',
  background: 'rgba(255,255,255,.75)', color: '#0B0F17',
};
const label: CSSProperties = { fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 6, display: 'block' };
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
      // Changing the password signs out every device. Sign this one straight back in
      // so the user isn't thrown out a few minutes later without knowing why.
      try {
        const email = useAuthStore.getState().email;
        if (email) { const { data } = await api.post('/auth/login', { email, password: form.next }); useAuthStore.getState().login(data.data); }
      } catch { /* next expiry shows the normal "session expired" notice */ }
      setMsg(t('Lösenordet är bytt. Andra enheter har loggats ut.'));
      setForm({ current: '', next: '', confirm: '' });
    } catch (e2: any) {
      setErr(e2?.response?.data?.error?.message ?? t('Kunde inte byta lösenord.'));
    }
    setBusy(false);
  };

  return (
    <div className="card" style={{ width: '100%', maxWidth: 860, minWidth: 0, marginTop: 16 }}>
      <div className="sec-head"><h3>{t('Byt lösenord')}</h3></div>
      <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 14, minWidth: 0 }}>
        <div><span style={label}>{t('Nuvarande lösenord')}</span><input style={input} type="password" required value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} autoComplete="current-password" /></div>
        <div><span style={label}>{t('Nytt lösenord')}</span><input style={input} type="password" required minLength={8} value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} autoComplete="new-password" placeholder={t('Minst 8 tecken, versal + siffra')} /></div>
        <div><span style={label}>{t('Bekräfta nytt lösenord')}</span><input style={input} type="password" required value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} autoComplete="new-password" /></div>
        <div style={{ alignSelf: 'end', minWidth: 0 }}>
          <button type="submit" className="btn-apply" style={{ width: 'auto', maxWidth: '100%', padding: '12px 24px' }} disabled={busy}>{busy ? t('Sparar…') : t('Byt lösenord')}</button>
        </div>
      </form>
      {msg && <div style={ok} role="status">{msg}</div>}
      {err && <div style={bad} role="alert">{err}</div>}
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
    // Never rely on the browser's own validation alone — a scripted submit skips it.
    const email = form.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErr(t('Ange en giltig e-postadress.')); return; }
    if (!form.password) { setErr(t('Ange ditt lösenord för att bekräfta bytet.')); return; }
    if (prof && email.toLowerCase() === prof.email.toLowerCase()) { setErr(t('Det är redan din e-postadress.')); return; }
    setBusy(true);
    try {
      await api.post('/auth/change-email', { newEmail: email, currentPassword: form.password });
      setMsg(t('E-postadressen är bytt. En verifieringslänk har skickats till den nya adressen — bekräfta den för att aktivera adressen fullt ut.'));
      setForm({ email: '', password: '' });
    } catch (e2: any) {
      setErr(e2?.response?.data?.error?.message ?? t('Kunde inte byta e-postadress.'));
    }
    setBusy(false);
  };

  return (
    <div className="card" style={{ width: '100%', maxWidth: 860, minWidth: 0, marginTop: 16 }}>
      <div className="sec-head"><h3>{t('Byt e-postadress')}</h3></div>
      {prof && <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--muted)' }}>{t('Nuvarande adress:')} <strong style={{ color: '#0B0F17' }}>{prof.email}</strong></p>}
      <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 14, minWidth: 0 }}>
        <div><span style={label}>{t('Ny e-postadress')}</span><input style={input} type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" placeholder={t('ny@adress.se')} /></div>
        <div><span style={label}>{t('Ditt lösenord')}</span><input style={input} type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="current-password" /></div>
        <div style={{ alignSelf: 'end', minWidth: 0 }}>
          <button type="submit" className="btn-apply" style={{ width: 'auto', maxWidth: '100%', padding: '12px 24px' }} disabled={busy}>{busy ? t('Sparar…') : t('Byt e-post')}</button>
        </div>
      </form>
      {msg && <div style={ok} role="status">{msg}</div>}
      {err && <div style={bad} role="alert">{err}</div>}
    </div>
  );
}

// ── Language ───────────────────────────────────────────
export function LanguageCard() {
  return (
    <div className="card" style={{ width: '100%', maxWidth: 860, minWidth: 0, marginTop: 16 }}>
      <div className="sec-head"><h3>{t('Språk')}</h3></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <p style={{ margin: 0, fontSize: 13.5, color: 'var(--muted)', flex: '1 1 240px' }}>{t('Välj språk för VYRLE i den här webbläsaren.')}</p>
        <LangSwitcher />
      </div>
    </div>
  );
}

// ── Delete account (request, handled by a person within the legal deadline) ──
export function DeleteAccountCard() {
  const [step, setStep] = useState<'idle' | 'confirm' | 'sent'>('idle');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const send = async () => {
    setBusy(true); setErr('');
    try {
      await api.post('/messages', { body: t('Jag vill radera mitt konto och mina personuppgifter.') });
      setStep('sent');
    } catch (e2: any) {
      setErr(e2?.response?.data?.error?.message ?? t('Kunde inte skicka begäran. Försök igen eller mejla support@vyrle.co.'));
    }
    setBusy(false);
  };

  return (
    <div className="card" style={{ width: '100%', maxWidth: 860, minWidth: 0, marginTop: 16 }}>
      <div className="sec-head"><h3>{t('Radera konto')}</h3></div>
      {step === 'sent' ? (
        <div style={ok} role="status">{t('Din begäran är skickad. Vi raderar kontot och dina personuppgifter inom 30 dagar och bekräftar via e-post. Uppgifter vi enligt lag måste spara, till exempel bokföring av utbetalningar, sparas så länge lagen kräver.')}</div>
      ) : (
        <>
          <p style={{ margin: '0 0 12px', fontSize: 13.5, lineHeight: 1.6, color: 'var(--muted)' }}>{t('Du kan när som helst begära att ditt konto och dina personuppgifter raderas. Pågående uppdrag och utbetalningar avslutas först.')}</p>
          {step === 'idle'
            ? <button type="button" className="btn-outline" style={{ padding: '10px 18px', color: '#b3402f' }} onClick={() => setStep('confirm')}>{t('Begär radering av kontot')}</button>
            : (
              <div role="alertdialog" aria-label={t('Bekräfta radering')} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{t('Är du säker? Det går inte att ångra när kontot väl är raderat.')}</span>
                <button type="button" className="btn-apply" style={{ width: 'auto', padding: '10px 18px', background: '#b3402f' }} onClick={send} disabled={busy}>{busy ? t('Skickar…') : t('Ja, skicka begäran')}</button>
                <button type="button" className="btn-outline" style={{ padding: '10px 16px' }} onClick={() => setStep('idle')} disabled={busy}>{t('Avbryt')}</button>
              </div>
            )}
          {err && <div style={bad} role="alert">{err}</div>}
        </>
      )}
    </div>
  );
}
