import { LangSwitcher, t } from '@/lib/i18n';
import React, { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useLogin } from '@/hooks/api';
import { useAuthStore } from '@/stores/authStore';
import { postLoginPath, takeSessionExpired } from '@/lib/session';
import { useTitle } from '@/lib/title';
import api from '@/lib/api';
import { SocialButtons } from '@/components/auth/SocialButtons';
import {
  stashSocialSignup,
  type PendingSocialSignup, type SocialTokenResult,
} from '@/lib/socialAuth';

/* ── shared marks ── */
const STAR_PATH = 'M12 1.5c.7 5.6 2.9 7.8 8.5 8.5 .9.1 .9 1.4 0 1.5-5.6.7-7.8 2.9-8.5 8.5-.1.9-1.4.9-1.5 0-.7-5.6-2.9-7.8-8.5-8.5-.9-.1-.9-1.4 0-1.5 5.6-.7 7.8-2.9 8.5-8.5.1-.9 1.4-.9 1.5 0z';
const Star = ({ fill }: { fill: string }) => (
  <svg className="brand-star" width="26" height="26" viewBox="0 0 24 24" fill={fill} aria-hidden="true"><path d={STAR_PATH} /></svg>
);
export const Arrow = () => (
  <span className="auth-arrow"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg></span>
);
export const Check = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 7" /></svg>
);
export const SmallCheck = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 7" /></svg>
);

export const INDUSTRIES = ['Mode & Kläder', 'Skönhet & Hudvård', 'Mat & Dryck', 'Teknik & Appar', 'Gaming', 'Sport & Hälsa', 'Resor', 'Inredning & Hem', 'Finans', 'Utbildning', 'Underhållning', 'Övrigt'];
export const COUNTRIES: [string, string][] = [['SE', 'Sverige'], ['NO', 'Norge'], ['DK', 'Danmark'], ['FI', 'Finland']];

export function AuthShell({ children, wide, className }: { children: ReactNode; wide?: boolean; className?: string }) {
  return (
    <div className="vy-app">
      <div className="auth-split">
        <aside className="auth-brand">
          <div className="hero-grain" />
          <div className="hero-glow" />
          <svg className="auth-star" viewBox="0 0 220 220" fill="none" aria-hidden="true">
            <defs>
              <radialGradient id="authGlow" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#FFF4EC" /><stop offset="30%" stopColor="#FFD8C7" stopOpacity=".9" /><stop offset="100%" stopColor="#F1A88F" stopOpacity="0" /></radialGradient>
              <linearGradient id="authCore" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#FFFFFF" /><stop offset="60%" stopColor="#FBEEF6" /><stop offset="100%" stopColor="#EDE1FF" /></linearGradient>
            </defs>
            <circle cx="110" cy="110" r="104" fill="url(#authGlow)" />
            <path d="M110 20 C118 78 142 102 200 110 C142 118 118 142 110 200 C102 142 78 118 20 110 C78 102 102 78 110 20Z" fill="url(#authCore)" />
            <path d="M110 58 C115 95 125 105 162 110 C125 115 115 125 110 162 C105 125 95 115 58 110 C95 105 105 95 110 58Z" fill="#fff" opacity=".96" />
          </svg>

          <div className="auth-brand-top"><Star fill="#FFF4EC" /> VYRLE</div>

          <div className="auth-brand-mid">
            <div className="hero-eyebrow"><span className="hero-live" /> {t('KREATÖRER × VARUMÄRKEN')}</div>
            <h1>{t('Där creators och varumärken faktiskt')} <em>{t('möts')}</em>.</h1>
            <p className="auth-brand-sub">{t('VYRLE matchar rätt creators med rätt kampanjer, och betalar ut i samma stund som jobbet presterar.')}</p>
            <div className="auth-props">
              <div className="auth-prop"><Check /> {t('Briefs matchade mot din publik, inte ditt följarantal')}</div>
              <div className="auth-prop"><Check /> {t('Transparent ersättning innan du postar')}</div>
              <div className="auth-prop"><Check /> {t('Direkta utbetalningar, inga mellanhänder')}</div>
            </div>
          </div>

          <div className="auth-brand-foot">{t('Byggt för creators och varumärken i Norden.')}</div>
        </aside>

        <main className="auth-main" style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', top: 16, right: 18, zIndex: 5 }}><LangSwitcher /></div>
          <div className={`card${wide ? ' auth-card-lg' : ''}${className ? ` ${className}` : ''}`}>
            <div className="auth-lockup"><Star fill="#0B0F17" /> VYRLE</div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

/* ── social login plumbing (shared by login + register) ── */
interface SocialLoginOut {
  status: 'LoggedIn' | 'NeedsRegistration';
  auth?: { accessToken: string; refreshToken: string; expiresAt: string; userId: string; email: string; role: string } | null;
  identity?: { provider: string; email: string; firstName?: string | null; lastName?: string | null; pictureUrl?: string | null } | null;
}

export function extractApiError(err: any, fallback: string): string {
  if (!err?.response) return t('Kunde inte nå servern. Försök igen om en stund.');
  if (err.response.status === 429) return t('För många försök. Vänta en minut och försök igen.');
  const resp = err.response.data;
  // Our own envelope first; it carries a message written for the reader.
  if (resp?.error?.message) return resp.error.message;
  if (resp?.errors && typeof resp.errors === 'object') {
    const msgs = [...new Set((Object.values(resp.errors) as string[][]).flat().filter(Boolean))];
    if (msgs.length) return msgs.join(' ');
  }
  return resp?.title || fallback;
}

export function useSocialLoginFlow(setError: (msg: string) => void, onNeedsRegistration: (p: PendingSocialSignup) => void) {
  const navigate = useNavigate();
  const authStore = useAuthStore();
  return async (result: SocialTokenResult) => {
    setError('');
    try {
      const res = await api.post<{ data: SocialLoginOut }>('/auth/social', { provider: result.provider, token: result.token });
      const out = res.data.data;
      if (out.status === 'LoggedIn' && out.auth) {
        authStore.login(out.auth as any);
        navigate(postLoginPath(out.auth.role));
      } else if (out.status === 'NeedsRegistration' && out.identity) {
        onNeedsRegistration({
          provider: result.provider,
          token: result.token,
          email: out.identity.email,
          firstName: result.firstName ?? out.identity.firstName ?? undefined,
          lastName: result.lastName ?? out.identity.lastName ?? undefined,
          pictureUrl: out.identity.pictureUrl ?? undefined,
        });
      }
    } catch (err: any) {
      setError(extractApiError(err, t('Inloggningen misslyckades — försök igen')));
    }
  };
}

/* ───────────────────────── Login ───────────────────────── */
export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const login = useLogin();
  const [expired] = useState(() => takeSessionExpired());
  useTitle(t('Logga in'));
  const authStore = useAuthStore();

  const onSocialToken = useSocialLoginFlow(setError, (pending) => {
    stashSocialSignup(pending);
    navigate('/register?social=1');
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const data = await login.mutateAsync({ email, password });
      authStore.login(data);
      navigate(postLoginPath(data.role));
    } catch (err: any) {
      setError(extractApiError(err, t('Fel e-post eller lösenord')));
    }
  };

  return (
    <AuthShell>
      <h1 className="auth-title">{t('Logga')} <em>{t('in')}</em></h1>
      <p className="auth-sub">{t('Fortsätt där du slutade.')}</p>
      {expired && <p role="status" style={{ margin: '0 0 14px', padding: '10px 14px', borderRadius: 12, fontSize: 13.5, lineHeight: 1.5, background: 'rgba(242,197,138,.28)', border: '1px solid rgba(212,155,46,.35)', color: '#7a5416' }}>{t('Din session har gått ut. Logga in igen så kommer du tillbaka dit du var.')}</p>}
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="field"><label htmlFor="li-email">{t('E-post')}</label><input id="li-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder={t('du@exempel.se')} /></div>
        <div className="field"><label htmlFor="li-pw">{t('Lösenord')}</label>
          <div className="auth-pw-wrap">
            <input id="li-pw" type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" placeholder="••••••••" />
            <EyeButton on={showPw} onClick={() => setShowPw((v) => !v)} />
          </div>
        </div>
        <p style={{ textAlign: 'right', margin: '-6px 0 0' }}><a href="/forgot-password" className="auth-link" style={{ fontSize: 13 }}>{t('Glömt lösenordet?')}</a></p>
        {error && <p className="auth-err">{error}</p>}
        <button type="submit" className="btn-apply" disabled={login.isPending} style={{ opacity: login.isPending ? 0.7 : 1 }}>
          {login.isPending ? t('Loggar in…') : <>{t('Logga in')} <Arrow /></>}
        </button>
        <SocialButtons onToken={onSocialToken} disabled={login.isPending} />
      </form>
      <p className="auth-foot">{t('Inget konto?')} <a href="/register" className="auth-link">{t('Skapa konto')}</a></p>
    </AuthShell>
  );
}

/* ───────────────────────── Register (wizard) ───────────────────────── */
/* ───────────────────────── Pending ───────────────────────── */
export function PendingApprovalPage({ email, tikTokLinked }: { email?: string; tikTokLinked?: boolean }) {
  const navigate = useNavigate();
  return (
    <AuthShell>
      <div style={{ textAlign: 'center' }}>
        <div className="auth-pending-ic"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></div>
        <h1 className="auth-title">{t('Ansökan')} <em>{t('mottagen')}</em></h1>
        <p className="auth-sub" style={{ maxWidth: 360, margin: '8px auto 0' }}>{t('Tack för att du går med i VYRLE. Vi granskar din profil nu och hör av oss så snart du är godkänd, oftast inom 1 till 2 arbetsdagar.')}</p>
        <div style={{ background: 'rgba(255,227,211,.45)', border: '1px solid rgba(241,168,143,.4)', borderRadius: 14, padding: 14, margin: '20px 0 10px', fontSize: 12.5, color: '#7a4a30', textAlign: 'left', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ lineHeight: 1.55 }}>
            {t('Vi har skickat ett bekräftelsemejl till')} {email ? <strong>{email}</strong> : t('din e-postadress')} — {t('klicka på länken i mejlet för att verifiera din adress. Hittar du det inte? Kolla skräpposten.')}
          </span>
        </div>
        <div style={{ background: 'rgba(237,225,255,.35)', border: '1px solid rgba(157,139,196,.2)', borderRadius: 14, padding: 14, margin: '0 0 10px', fontSize: 12.5, color: 'var(--muted)' }}>
          {t('Du får ett meddelande när ditt konto har godkänts.')}
        </div>
        {tikTokLinked === false && (
          <div style={{ background: 'rgba(237,225,255,.35)', border: '1px solid rgba(157,139,196,.2)', borderRadius: 14, padding: 14, margin: '0 0 20px', fontSize: 12.5, color: 'var(--muted)', textAlign: 'left' }}>
            <strong style={{ color: 'var(--ink)' }}>{t('Nästa steg efter godkännandet:')}</strong> {t('koppla ditt TikTok-konto. Profilen visas inte för företag förrän det är gjort, och det är så dina views blir verifierade.')}
          </div>
        )}
        <button onClick={() => navigate('/login')} className="btn-outline" style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>{t('Till inloggningen')}</button>
      </div>
    </AuthShell>
  );
}

export function EyeButton({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button type="button" className="auth-eye" onClick={onClick} aria-label={on ? t('Dölj lösenord') : t('Visa lösenord')}>
      {on ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-7-10-7a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22" /></svg>
      )}
    </button>
  );
}

/* ───────────────────────── Password reset ───────────────────────── */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await api.post('/auth/forgot-password', { email: email.trim() }); setSent(true); }
    catch { setError(t('Något gick fel. Försök igen om en stund.')); }
    finally { setBusy(false); }
  };

  return (
    <AuthShell>
      <h1 className="auth-title">{t('Glömt')} <em>{t('lösenordet?')}</em></h1>
      {sent ? (
        <p className="auth-sub" style={{ marginTop: 14 }}>
          {t('Om')} <b>{email.trim()}</b> {t('finns hos oss har vi skickat en återställningslänk. Kolla inkorgen — och skräpposten för säkerhets skull.')}
        </p>
      ) : (
        <>
          <p className="auth-sub">{t('Ange din e-post så skickar vi en länk för att välja ett nytt lösenord.')}</p>
          <form className="auth-form" onSubmit={submit}>
            <div className="field"><label htmlFor="fp-email">{t('E-post')}</label>
              <input id="fp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder={t('du@exempel.se')} />
            </div>
            {error && <p className="auth-err">{error}</p>}
            <button type="submit" className="btn-apply" disabled={busy}>{busy ? t('Skickar…') : t('Skicka återställningslänk')}</button>
          </form>
        </>
      )}
      <p className="auth-foot"><a href="/login" className="auth-link">{t('Tillbaka till inloggning')}</a></p>
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  const token = new URLSearchParams(window.location.search).get('token') ?? '';
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await api.post('/auth/reset-password', { token, newPassword: pw }); setDone(true); }
    catch (err: any) { setError(extractApiError(err, t('Länken är ogiltig eller har gått ut. Begär en ny.'))); }
    finally { setBusy(false); }
  };

  if (!token) {
    return (
      <AuthShell>
        <h1 className="auth-title">{t('Ogiltig')} <em>{t('länk')}</em></h1>
        <p className="auth-sub">{t('Återställningslänken saknas eller är trasig.')}</p>
        <p className="auth-foot"><a href="/forgot-password" className="auth-link">{t('Begär en ny länk')}</a></p>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 className="auth-title">{t('Välj nytt')} <em>{t('lösenord')}</em></h1>
      {done ? (
        <>
          <p className="auth-sub" style={{ marginTop: 14 }}>{t('Klart! Ditt lösenord är uppdaterat.')}</p>
          <a href="/login" className="btn-apply" style={{ display: 'inline-block', textAlign: 'center', textDecoration: 'none', marginTop: 10 }}>{t('Logga in')}</a>
        </>
      ) : (
        <form className="auth-form" onSubmit={submit}>
          <div className="field"><label htmlFor="rp-pw">{t('Nytt lösenord')}</label>
            <div className="auth-pw-wrap">
              <input id="rp-pw" type={showPw ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)} required autoComplete="new-password" placeholder={t('Minst 8 tecken, versal + siffra')} minLength={8} />
              <EyeButton on={showPw} onClick={() => setShowPw((v) => !v)} />
            </div>
          </div>
          {error && <p className="auth-err">{error}</p>}
          <button type="submit" className="btn-apply" disabled={busy}>{busy ? t('Sparar…') : t('Spara nytt lösenord')}</button>
        </form>
      )}
    </AuthShell>
  );
}

// ── Email verification landing ─────────────────────────
export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [state, setState] = useState<'working' | 'ok' | 'fail'>('working');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) { setState('fail'); setMessage(t('Länken saknar verifieringskod.')); return; }
    api.post('/auth/verify-email', { token })
      .then(() => setState('ok'))
      .catch((err: any) => {
        setState('fail');
        setMessage(err?.response?.data?.error?.message ?? t('Länken är ogiltig eller har gått ut.'));
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthShell>
      <div style={{ textAlign: 'center', padding: '18px 6px' }}>
        {state === 'working' && (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{t('Bekräftar din e-postadress…')}</h2>
          </>
        )}
        {state === 'ok' && (
          <>
            <div style={{ width: 54, height: 54, margin: '0 auto 14px', borderRadius: '50%', background: 'linear-gradient(135deg,#3dbb77,#2f9d5b)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }} aria-hidden>✓</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{t('E-postadressen är bekräftad!')}</h2>
            <p style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 8, lineHeight: 1.55 }}>{t('Tack! Ditt konto är nu verifierat. Du kan stänga den här sidan eller logga in direkt.')}</p>
            <Link to="/login" className="btn-apply" style={{ display: 'inline-block', width: 'auto', padding: '12px 26px', marginTop: 16, textDecoration: 'none' }}>{t('Logga in')}</Link>
          </>
        )}
        {state === 'fail' && (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{t('Kunde inte bekräfta adressen')}</h2>
            <p style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 8, lineHeight: 1.55 }}>{message} {t('Logga in och begär en ny länk från bannern högst upp.')}</p>
            <Link to="/login" className="btn-apply" style={{ display: 'inline-block', width: 'auto', padding: '12px 26px', marginTop: 16, textDecoration: 'none' }}>{t('Logga in')}</Link>
          </>
        )}
      </div>
    </AuthShell>
  );
}

