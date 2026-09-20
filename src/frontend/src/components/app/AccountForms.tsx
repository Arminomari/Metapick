/** Account forms shared by both roles: e-mail, password, language, delete, TikTok. Same endpoints as before. */
import { useState } from 'react';
import api from '@/lib/api';
import { t, lang, setLang } from '@/lib/i18n';
import { formatDate, formatNumber } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useProfile, useTikTokStatus, useTikTokDisconnect } from '@/hooks/api';
import { useToast } from '@/components/vyrle/Toast';
import { Badge, Button, Card, Chip, Chips, Field, ListRow, Avatar } from '@/components/ds';
import { apiMessage } from './common';

export function ChangeEmailForm() {
  const { data: prof } = useProfile();
  const toast = useToast();
  const [form, setForm] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    const email = form.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErr(t('Ange en giltig e-postadress.')); return; }
    if (!form.password) { setErr(t('Ange ditt lösenord för att bekräfta bytet.')); return; }
    if (prof && email.toLowerCase() === prof.email.toLowerCase()) { setErr(t('Det är redan din e-postadress.')); return; }
    setBusy(true);
    try { await api.post('/auth/change-email', { newEmail: email, currentPassword: form.password }); toast.push(t('E-postadressen är bytt. Bekräfta länken i den nya inkorgen.'), 'success'); setForm({ email: '', password: '' }); }
    catch (e2) { setErr(apiMessage(e2, t('Kunde inte byta e-postadress.'))); }
    setBusy(false);
  };
  return (
    <form onSubmit={submit} className="ds-stack" style={{ gap: 12 }}>
      {prof && <p className="ds-caption ds-muted">{t('Nuvarande adress')}: <strong>{prof.email}</strong></p>}
      <Field label={t('Ny e-postadress')}><input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" /></Field>
      <Field label={t('Ditt lösenord')} error={err}><input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="current-password" /></Field>
      <Button type="submit" loading={busy}>{t('Byt e-post')}</Button>
    </form>
  );
}

export function ChangePasswordForm() {
  const toast = useToast();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    if (form.next !== form.confirm) { setErr(t('De nya lösenorden matchar inte.')); return; }
    if (form.next.length < 8) { setErr(t('Lösenordet måste vara minst 8 tecken.')); return; }
    setBusy(true);
    try {
      await api.post('/auth/change-password', { currentPassword: form.current, newPassword: form.next });
      try { const email = useAuthStore.getState().email; if (email) { const { data } = await api.post('/auth/login', { email, password: form.next }); useAuthStore.getState().login(data.data); } } catch { /* next expiry shows the normal notice */ }
      toast.push(t('Lösenordet är bytt. Andra enheter har loggats ut.'), 'success'); setForm({ current: '', next: '', confirm: '' });
    } catch (e2) { setErr(apiMessage(e2, t('Kunde inte byta lösenord.'))); }
    setBusy(false);
  };
  return (
    <form onSubmit={submit} className="ds-stack" style={{ gap: 12 }}>
      <Field label={t('Nuvarande lösenord')}><input type="password" required value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} autoComplete="current-password" /></Field>
      <Field label={t('Nytt lösenord')} hint={t('Minst 8 tecken, versal + siffra')}><input type="password" required minLength={8} value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} autoComplete="new-password" /></Field>
      <Field label={t('Bekräfta nytt lösenord')} error={err}><input type="password" required value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} autoComplete="new-password" /></Field>
      <Button type="submit" loading={busy}>{t('Byt lösenord')}</Button>
    </form>
  );
}

export function LanguagePicker() {
  return (
    <Chips>
      {(['sv', 'en'] as const).map((l) => <Chip key={l} selected={lang === l} onClick={() => setLang(l)}>{l === 'sv' ? 'Svenska' : 'English'}</Chip>)}
    </Chips>
  );
}

export function DeleteAccountForm() {
  const [step, setStep] = useState<'idle' | 'confirm' | 'sent'>('idle');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const send = async () => {
    setBusy(true); setErr('');
    try { await api.post('/messages', { body: t('Jag vill radera mitt konto och mina personuppgifter.') }); setStep('sent'); }
    catch (e2) { setErr(apiMessage(e2, t('Kunde inte skicka begäran. Försök igen eller mejla support@vyrle.co.'))); }
    setBusy(false);
  };
  if (step === 'sent') return <p className="ds-body" style={{ color: 'var(--ds-ok)' }}>{t('Din begäran är skickad. Vi raderar kontot och dina personuppgifter inom 30 dagar och bekräftar via e-post.')}</p>;
  return (
    <div className="ds-stack" style={{ gap: 12 }}>
      <p className="ds-body ds-muted">{t('Du kan när som helst begära att ditt konto och dina personuppgifter raderas. Pågående uppdrag och utbetalningar avslutas först.')}</p>
      {step === 'idle' ? <Button variant="secondary" danger onClick={() => setStep('confirm')}>{t('Begär radering av kontot')}</Button> : (
        <div className="ds-stack" role="alertdialog" aria-label={t('Bekräfta radering')}>
          <p className="ds-body" style={{ fontWeight: 600 }}>{t('Är du säker? Det går inte att ångra när kontot väl är raderat.')}</p>
          <div className="ds-row"><Button danger onClick={() => void send()} loading={busy}>{t('Ja, skicka begäran')}</Button><Button variant="secondary" onClick={() => setStep('idle')} disabled={busy}>{t('Avbryt')}</Button></div>
        </div>
      )}
      {err && <p className="ds-caption" style={{ color: 'var(--ds-bad)' }}>{err}</p>}
    </div>
  );
}

/** TikTok connection state with connect / disconnect. */
export function TikTokCard() {
  const { data: status, isLoading } = useTikTokStatus();
  const disconnect = useTikTokDisconnect();
  const toast = useToast();
  const [connecting, setConnecting] = useState(false);
  const [arm, setArm] = useState(false);
  const connect = async () => {
    setConnecting(true);
    try { const res = await api.get<{ url: string }>('/creator/tiktok/auth-url'); window.location.href = res.data.url; }
    catch { setConnecting(false); toast.push(t('Kunde inte starta TikTok-anslutning.'), 'error'); }
  };
  if (isLoading) return null;
  const ok = status?.connected && status?.isOAuth;
  return (
    <Card>
      <ListRow className="ds-listrow--flush" leading={<Avatar name="T" rounded />} title={ok ? `@${status?.username}` : status?.connected ? `@${status?.username}` : t('TikTok')}
        badge={ok ? <Badge tone="ok">{t('Ansluten')}</Badge> : status?.connected ? <Badge tone="warn">{t('Ej verifierad')}</Badge> : <Badge>{t('Ej ansluten')}</Badge>}
        subtitle={ok ? `${status?.followerCount != null ? `${formatNumber(status.followerCount)} ${t('följare')} · ` : ''}${status?.lastSyncAt ? `${t('synkad')} ${formatDate(status.lastSyncAt)}` : t('synkas automatiskt')}` : t('Views verifieras via ditt konto — det krävs för att få betalt.')} wrapSubtitle chevron={false} />
      <div className="ds-row" style={{ marginTop: 8 }}>
        {ok ? <Button variant="secondary" danger={arm} onClick={() => { if (!arm) { setArm(true); setTimeout(() => setArm(false), 4000); return; } setArm(false); disconnect.mutate(undefined, { onSuccess: () => toast.push(t('TikTok-kontot bortkopplat'), 'success'), onError: () => toast.push(t('Kunde inte koppla bort kontot'), 'error') }); }} loading={disconnect.isPending}>{arm ? t('Säker? Tryck igen') : t('Koppla bort')}</Button>
          : <Button onClick={() => void connect()} loading={connecting}>{t('Fortsätt med TikTok')}</Button>}
      </div>
    </Card>
  );
}
