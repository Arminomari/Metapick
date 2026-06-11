import React, { useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLogin, useRegister } from '@/hooks/api';
import { useAuthStore } from '@/stores/authStore';
import { DateInput } from '@/components/ui/DateInput';
import { ALL_TAGS } from '@/lib/tags';
import api from '@/lib/api';
import { SocialButtons } from '@/components/auth/SocialButtons';
import { ImagePicker } from '@/components/auth/ImagePicker';
import {
  clearSocialSignup, readSocialSignup, stashSocialSignup,
  type PendingSocialSignup, type SocialTokenResult,
} from '@/lib/socialAuth';

/* ── shared marks ── */
const STAR_PATH = 'M12 1.5c.7 5.6 2.9 7.8 8.5 8.5 .9.1 .9 1.4 0 1.5-5.6.7-7.8 2.9-8.5 8.5-.1.9-1.4.9-1.5 0-.7-5.6-2.9-7.8-8.5-8.5-.9-.1-.9-1.4 0-1.5 5.6-.7 7.8-2.9 8.5-8.5.1-.9 1.4-.9 1.5 0z';
const Star = ({ fill }: { fill: string }) => (
  <svg className="brand-star" width="26" height="26" viewBox="0 0 24 24" fill={fill} aria-hidden="true"><path d={STAR_PATH} /></svg>
);
const Arrow = () => (
  <span className="auth-arrow"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg></span>
);
const Check = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 7" /></svg>
);
const SmallCheck = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 7" /></svg>
);

const CATEGORIES = ['Övrigt', 'Mode', 'Skönhet', 'Mat', 'Teknik', 'Gaming', 'Sport', 'Musik', 'Resor', 'Livsstil', 'Humor'];
const INDUSTRIES = ['Mode & Kläder', 'Skönhet & Hudvård', 'Mat & Dryck', 'Teknik & Appar', 'Gaming', 'Sport & Hälsa', 'Resor', 'Inredning & Hem', 'Finans', 'Utbildning', 'Underhållning', 'Övrigt'];
const COUNTRIES: [string, string][] = [['SE', 'Sverige'], ['NO', 'Norge'], ['DK', 'Danmark'], ['FI', 'Finland']];

function AuthShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
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
            <div className="hero-eyebrow"><span className="hero-live" /> KREATÖRER × VARUMÄRKEN</div>
            <h1>Där kreatörer och varumärken faktiskt <em>möts</em>.</h1>
            <p className="auth-brand-sub">VYRLE matchar rätt kreatörer med rätt kampanjer, och betalar ut i samma stund som jobbet presterar.</p>
            <div className="auth-props">
              <div className="auth-prop"><Check /> Briefs matchade mot din publik, inte ditt följarantal</div>
              <div className="auth-prop"><Check /> Transparent ersättning innan du postar</div>
              <div className="auth-prop"><Check /> Direkta utbetalningar, inga mellanhänder</div>
            </div>
          </div>

          <div className="auth-brand-foot">Byggt för kreatörer och varumärken i Norden.</div>
        </aside>

        <main className="auth-main">
          <div className={`card${wide ? ' auth-card-lg' : ''}`}>
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

function extractApiError(err: any, fallback: string): string {
  if (!err?.response) return 'Kunde inte nå servern. Försök igen om en stund.';
  if (err.response.status === 429) return 'För många försök. Vänta en minut och försök igen.';
  const resp = err.response.data;
  if (resp?.errors && typeof resp.errors === 'object') {
    const msgs = (Object.values(resp.errors) as string[][]).flat().filter(Boolean);
    if (msgs.length) return msgs.join('. ');
  }
  return resp?.error?.message || resp?.title || fallback;
}

function useSocialLoginFlow(setError: (msg: string) => void, onNeedsRegistration: (p: PendingSocialSignup) => void) {
  const navigate = useNavigate();
  const authStore = useAuthStore();
  return async (result: SocialTokenResult) => {
    setError('');
    try {
      const res = await api.post<{ data: SocialLoginOut }>('/auth/social', { provider: result.provider, token: result.token });
      const out = res.data.data;
      if (out.status === 'LoggedIn' && out.auth) {
        authStore.login(out.auth as any);
        navigate(out.auth.role === 'Admin' ? '/admin' : out.auth.role === 'Brand' ? '/brand' : '/creator');
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
      setError(extractApiError(err, 'Inloggningen misslyckades — försök igen'));
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
      navigate(data.role === 'Admin' ? '/admin' : data.role === 'Brand' ? '/brand' : '/creator');
    } catch (err: any) {
      setError(extractApiError(err, 'Fel e-post eller lösenord'));
    }
  };

  return (
    <AuthShell>
      <h1 className="auth-title">Logga <em>in</em></h1>
      <p className="auth-sub">Fortsätt där du slutade.</p>
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="field"><label htmlFor="li-email">E-post</label><input id="li-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="du@exempel.se" /></div>
        <div className="field"><label htmlFor="li-pw">Lösenord</label>
          <div className="auth-pw-wrap">
            <input id="li-pw" type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" placeholder="••••••••" />
            <EyeButton on={showPw} onClick={() => setShowPw((v) => !v)} />
          </div>
        </div>
        {error && <p className="auth-err">{error}</p>}
        <button type="submit" className="btn-apply" disabled={login.isPending} style={{ opacity: login.isPending ? 0.7 : 1 }}>
          {login.isPending ? 'Loggar in…' : <>Logga in <Arrow /></>}
        </button>
        <SocialButtons onToken={onSocialToken} disabled={login.isPending} />
      </form>
      <p className="auth-foot">Inget konto? <a href="/register" className="auth-link">Skapa konto</a></p>
    </AuthShell>
  );
}

/* ───────────────────────── Register (wizard) ───────────────────────── */
type Role = 'Creator' | 'Brand';

interface WizardForm {
  role: Role;
  email: string; password: string;
  firstName: string; lastName: string;
  // creator
  displayName: string; bio: string; category: string; country: string; dateOfBirth: string;
  avatarUrl: string | null;
  tikTokUsername: string; followerCount: string; averageViews: string;
  instagramUsername: string; instagramFollowerCount: string; website: string;
  profileTags: string[]; openToPrOffers: boolean;
  // brand
  companyName: string; organizationNumber: string; industry: string; contactPhone: string;
  description: string; logoUrl: string | null;
}

const STEP_LABELS: Record<Role, string[]> = {
  Creator: ['Kontotyp', 'Konto', 'Profil', 'Räckvidd', 'Expertis'],
  Brand: ['Kontotyp', 'Konto', 'Företag', 'Kontakt'],
};

const intOrNull = (s: string): number | null => {
  const n = parseInt(s.replace(/[\s,.]/g, ''), 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export function RegisterPage() {
  const [searchParams] = useSearchParams();
  const defaultRole: Role = searchParams.get('role') === 'Brand' ? 'Brand' : 'Creator';
  const fromSocial = searchParams.get('social') === '1';

  const [social, setSocial] = useState<PendingSocialSignup | null>(() => (fromSocial ? readSocialSignup() : null));
  // Social signups still start at role choice (Kontotyp) — brands sign in with Google too.
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<WizardForm>(() => ({
    role: defaultRole,
    email: social?.email ?? '', password: '',
    firstName: social?.firstName ?? '', lastName: social?.lastName ?? '',
    displayName: social?.firstName ?? '', bio: '', category: 'Övrigt', country: 'SE', dateOfBirth: '',
    avatarUrl: social?.pictureUrl ?? null,
    tikTokUsername: '', followerCount: '', averageViews: '',
    instagramUsername: '', instagramFollowerCount: '', website: '',
    profileTags: [], openToPrOffers: true,
    companyName: '', organizationNumber: '', industry: 'Övrigt', contactPhone: '',
    description: '', logoUrl: null,
  }));
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const register = useRegister();

  const onSocialToken = useSocialLoginFlow(setError, (pending) => {
    stashSocialSignup(pending);
    setSocial(pending);
    setForm((f) => ({
      ...f,
      email: pending.email,
      firstName: f.firstName || pending.firstName || '',
      lastName: f.lastName || pending.lastName || '',
      displayName: f.displayName || pending.firstName || '',
      avatarUrl: f.avatarUrl ?? pending.pictureUrl ?? null,
    }));
  });

  const steps = STEP_LABELS[form.role];
  const isLast = step === steps.length - 1;

  const set = (key: keyof WizardForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const toggleTag = (tag: string) =>
    setForm((f) => ({
      ...f,
      profileTags: f.profileTags.includes(tag) ? f.profileTags.filter((t) => t !== tag) : [...f.profileTags, tag],
    }));

  const pw = form.password;
  const pwRules: [boolean, string][] = [
    [/[A-Z]/.test(pw), 'Versal (A–Z)'], [/[a-z]/.test(pw), 'Gemen (a–z)'], [/[0-9]/.test(pw), 'Siffra (0–9)'], [pw.length >= 8, 'Minst 8 tecken'],
  ];
  const pwOk = pwRules.every(([ok]) => ok);

  const validateStep = (): string | null => {
    const label = steps[step];
    if (label === 'Konto') {
      if (social) return null;
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) return 'Ange en giltig e-postadress';
      if (!pwOk) return 'Lösenordet uppfyller inte alla krav';
      return null;
    }
    if (label === 'Profil') {
      if (!form.displayName.trim()) return 'Visningsnamn krävs';
      if (form.bio.trim().length < 20) return 'Skriv minst 20 tecken i din bio — varumärken läser den först av allt';
      return null;
    }
    if (label === 'Räckvidd') {
      if (!form.tikTokUsername.trim()) return 'TikTok-användarnamn krävs';
      return null;
    }
    if (label === 'Expertis') {
      if (form.profileTags.length === 0) return 'Välj minst en expertis-tagg';
      return null;
    }
    if (label === 'Företag') {
      if (!form.companyName.trim()) return 'Företagsnamn krävs';
      if (!/^\d{6}-?\d{4}$/.test(form.organizationNumber.trim())) return 'Ange organisationsnummer i formatet XXXXXX-XXXX';
      return null;
    }
    return null;
  };

  const next = () => {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError('');
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };
  const back = () => { setError(''); setStep((s) => Math.max(s - 1, 0)); };

  const handleSubmit = async () => {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError('');
    setSubmitting(true);

    const common = {
      role: form.role,
      firstName: form.firstName.trim() || null,
      lastName: form.lastName.trim() || null,
      companyName: form.companyName.trim() || null,
      organizationNumber: form.organizationNumber.trim() || null,
      contactPhone: form.contactPhone.trim() || null,
      displayName: form.displayName.trim() || null,
      country: form.country,
      bio: form.bio.trim() || null,
      category: form.category,
      tikTokUsername: form.tikTokUsername.trim() || null,
      dateOfBirth: form.dateOfBirth || null,
      profileTags: form.profileTags.length > 0 ? form.profileTags : null,
      instagramUsername: form.instagramUsername.trim() || null,
      avatarUrl: form.avatarUrl,
      followerCount: intOrNull(form.followerCount),
      averageViews: intOrNull(form.averageViews),
      instagramFollowerCount: intOrNull(form.instagramFollowerCount),
      website: form.website.trim() || null,
      industry: form.industry,
      logoUrl: form.logoUrl,
      description: form.description.trim() || null,
    };

    try {
      if (social) {
        await api.post('/auth/social/register', { provider: social.provider, token: social.token, ...common });
        clearSocialSignup();
      } else {
        await register.mutateAsync({ email: form.email.trim(), password: form.password, ...common });
      }
      setSubmitted(true);
    } catch (err: any) {
      console.error('Register error:', err?.response?.status, err?.response?.data ?? err?.message);
      setError(extractApiError(err, 'Registreringen misslyckades. Försök igen.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) return <PendingApprovalPage />;

  const stepLabel = steps[step];

  return (
    <AuthShell wide>
      <h1 className="auth-title">Skapa <em>konto</em></h1>
      <p className="auth-sub">{step === 0 ? 'Vem är du? Vi anpassar resten efter ditt svar.' : 'Vi granskar och godkänner din profil innan du går live, oftast inom 1–2 arbetsdagar.'}</p>

      <div className="wiz-track" role="list" aria-label="Registreringssteg">
        {steps.map((label, i) => (
          <React.Fragment key={label}>
            {i > 0 && <span className={`wiz-conn${i <= step ? ' done' : ''}`} aria-hidden="true" />}
            <div className={`wiz-step${i === step ? ' cur' : ''}${i < step ? ' done' : ''}`} role="listitem" aria-current={i === step ? 'step' : undefined}>
              <span className="wiz-dot">{i < step ? <SmallCheck /> : i + 1}</span>
              <span className="wiz-lbl">{label}</span>
            </div>
          </React.Fragment>
        ))}
      </div>
      <div className="wiz-meta">Steg {step + 1} av {steps.length} · {stepLabel}</div>

      <div className="auth-form">
        {/* ── Step: Kontotyp ── */}
        {stepLabel === 'Kontotyp' && (
          <div className="wiz-pane" key="role">
            <div className="role-cards" role="radiogroup" aria-label="Kontotyp">
              <button type="button" role="radio" aria-checked={form.role === 'Creator'} className={`role-card${form.role === 'Creator' ? ' on' : ''}`} onClick={() => setForm((f) => ({ ...f, role: 'Creator' }))}>
                <span className="rc-check"><SmallCheck /></span>
                <div className="rc-ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" /></svg></div>
                <div className="rc-t">Jag är kreatör</div>
                <div className="rc-d">Hitta betalda kampanjer, visa upp ditt innehåll och få betalt per visning.</div>
              </button>
              <button type="button" role="radio" aria-checked={form.role === 'Brand'} className={`role-card${form.role === 'Brand' ? ' on' : ''}`} onClick={() => setForm((f) => ({ ...f, role: 'Brand' }))}>
                <span className="rc-check"><SmallCheck /></span>
                <div className="rc-ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V12h6v10" /></svg></div>
                <div className="rc-t">Jag är varumärke</div>
                <div className="rc-d">Skapa kampanjer, hitta rätt kreatörer och betala bara för verifierade visningar.</div>
              </button>
            </div>
          </div>
        )}

        {/* ── Step: Konto ── */}
        {stepLabel === 'Konto' && (
          <div className="wiz-pane" key="account" style={{ display: 'flex', flexDirection: 'column', gap: 17 }}>
            {social ? (
              <div className="social-chip">
                <Check />
                <span>
                  Inloggad via <b>{social.provider}</b> som <b>{social.email}</b> — inget lösenord behövs.{' '}
                  <button type="button" className="auth-link" style={{ background: 'none', border: 'none', padding: 0, font: 'inherit' }}
                    onClick={() => { clearSocialSignup(); setSocial(null); }}>
                    Använd e-post i stället
                  </button>
                </span>
              </div>
            ) : (
              <>
                <div className="field"><label htmlFor="rg-email">E-post *</label><input id="rg-email" type="email" value={form.email} onChange={set('email')} required autoComplete="email" placeholder="du@exempel.se" /></div>
                <div className="field"><label htmlFor="rg-pw">Lösenord *</label>
                  <div className="auth-pw-wrap">
                    <input id="rg-pw" type={showPw ? 'text' : 'password'} value={form.password} onChange={set('password')} required minLength={8} autoComplete="new-password" placeholder="Minst 8 tecken" />
                    <EyeButton on={showPw} onClick={() => setShowPw((v) => !v)} />
                  </div>
                  <div className="auth-rules">
                    {pwRules.map(([ok, label]) => (
                      <span key={label} className={`auth-rule${ok ? ' ok' : ''}`}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">{ok ? <path d="m5 12 4 4L19 7" /> : <circle cx="12" cy="12" r="9" />}</svg>{label}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16 }}>
              <div className="field"><label htmlFor="rg-fn">{form.role === 'Brand' ? 'Förnamn (kontaktperson)' : 'Förnamn'}</label><input id="rg-fn" type="text" value={form.firstName} onChange={set('firstName')} autoComplete="given-name" /></div>
              <div className="field"><label htmlFor="rg-ln">Efternamn</label><input id="rg-ln" type="text" value={form.lastName} onChange={set('lastName')} autoComplete="family-name" /></div>
            </div>
            {!social && <SocialButtons onToken={onSocialToken} />}
          </div>
        )}

        {/* ── Step: Profil (creator) ── */}
        {stepLabel === 'Profil' && (
          <div className="wiz-pane" key="profile" style={{ display: 'flex', flexDirection: 'column', gap: 17 }}>
            <ImagePicker
              label="Profilbild"
              value={form.avatarUrl}
              onChange={(v) => setForm((f) => ({ ...f, avatarUrl: v }))}
              hint="Varumärken ser den först — ett tydligt ansikte ökar dina chanser."
            />
            <div className="field"><label htmlFor="rg-name">Visningsnamn *</label><input id="rg-name" type="text" value={form.displayName} onChange={set('displayName')} required placeholder="Ditt namn eller alias" /></div>
            <div className="field"><label htmlFor="rg-bio">Bio *</label><textarea id="rg-bio" value={form.bio} onChange={set('bio')} required rows={3} placeholder="Berätta om dig och ditt innehåll — varför ska varumärken samarbeta med dig?" />
              <div className="auth-hint">{form.bio.trim().length}/20 tecken minimum</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16 }}>
              <div className="field"><label htmlFor="rg-cat">Kategori *</label>
                <select id="rg-cat" value={form.category} onChange={set('category')} required>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="field"><label htmlFor="rg-country">Land *</label>
                <select id="rg-country" value={form.country} onChange={set('country')} required>
                  {COUNTRIES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                </select>
              </div>
            </div>
            <div className="field"><label>Födelsedatum</label><DateInput value={form.dateOfBirth} onChange={(v) => setForm((f) => ({ ...f, dateOfBirth: v }))} className="" /></div>
          </div>
        )}

        {/* ── Step: Räckvidd (creator) ── */}
        {stepLabel === 'Räckvidd' && (
          <div className="wiz-pane" key="reach" style={{ display: 'flex', flexDirection: 'column', gap: 17 }}>
            <div className="field"><label htmlFor="rg-tt">TikTok-användarnamn *</label>
              <div className="auth-at"><span>@</span><input id="rg-tt" type="text" value={form.tikTokUsername} onChange={set('tikTokUsername')} required placeholder="dittanvändarnamn" /></div>
              <div className="auth-hint">Efter godkännande kopplar du kontot via TikTok för automatisk visningsverifiering.</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16 }}>
              <div className="field"><label htmlFor="rg-fc">Följare på TikTok</label><input id="rg-fc" type="text" inputMode="numeric" value={form.followerCount} onChange={set('followerCount')} placeholder="t.ex. 12000" /></div>
              <div className="field"><label htmlFor="rg-av">Snittvisningar per video</label><input id="rg-av" type="text" inputMode="numeric" value={form.averageViews} onChange={set('averageViews')} placeholder="t.ex. 8500" /></div>
            </div>
            <div className="field"><label htmlFor="rg-ig">Instagram-användarnamn</label>
              <div className="auth-at"><span>@</span><input id="rg-ig" type="text" value={form.instagramUsername} onChange={set('instagramUsername')} placeholder="dittinstagram" /></div>
            </div>
            {form.instagramUsername.trim() && (
              <div className="field"><label htmlFor="rg-igf">Följare på Instagram</label><input id="rg-igf" type="text" inputMode="numeric" value={form.instagramFollowerCount} onChange={set('instagramFollowerCount')} placeholder="t.ex. 4300" /></div>
            )}
            <div className="field"><label htmlFor="rg-web">Webbplats / Linktree</label><input id="rg-web" type="url" value={form.website} onChange={set('website')} placeholder="https://…" /></div>
          </div>
        )}

        {/* ── Step: Expertis (creator, last) ── */}
        {stepLabel === 'Expertis' && (
          <div className="wiz-pane" key="tags" style={{ display: 'flex', flexDirection: 'column', gap: 17 }}>
            <div className="field"><label>Expertis-taggar * — vad är du bra på?</label>
              <div className="auth-tagbox">
                <div className="auth-tags">
                  {ALL_TAGS.map((tag) => (
                    <button key={tag} type="button" className={`auth-tag${form.profileTags.includes(tag) ? ' on' : ''}`} onClick={() => toggleTag(tag)}>
                      {form.profileTags.includes(tag) ? '✓ ' : ''}{tag}
                    </button>
                  ))}
                </div>
                <div className="auth-hint" style={{ marginTop: 10 }}>{form.profileTags.length === 0 ? 'Välj minst en tagg' : `Valt: ${form.profileTags.length} tagg(ar)`}</div>
              </div>
            </div>
            <label className="checkrow" htmlFor="rg-pr">
              <input id="rg-pr" type="checkbox" checked={form.openToPrOffers} onChange={(e) => setForm((f) => ({ ...f, openToPrOffers: e.target.checked }))} />
              Öppen för direkta PR-erbjudanden från varumärken
            </label>
            <RegisterSummary form={form} social={social} />
          </div>
        )}

        {/* ── Step: Företag (brand) ── */}
        {stepLabel === 'Företag' && (
          <div className="wiz-pane" key="company" style={{ display: 'flex', flexDirection: 'column', gap: 17 }}>
            <ImagePicker
              label="Logotyp"
              shape="rounded"
              value={form.logoUrl}
              onChange={(v) => setForm((f) => ({ ...f, logoUrl: v }))}
              hint="Visas för kreatörer på era kampanjer."
            />
            <div className="field"><label htmlFor="rg-co">Företagsnamn *</label><input id="rg-co" type="text" value={form.companyName} onChange={set('companyName')} required autoComplete="organization" /></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16 }}>
              <div className="field"><label htmlFor="rg-org">Organisationsnummer *</label><input id="rg-org" type="text" value={form.organizationNumber} onChange={set('organizationNumber')} required placeholder="XXXXXX-XXXX" /></div>
              <div className="field"><label htmlFor="rg-ind">Bransch *</label>
                <select id="rg-ind" value={form.industry} onChange={set('industry')} required>
                  {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
            </div>
            <div className="field"><label htmlFor="rg-bweb">Webbplats</label><input id="rg-bweb" type="url" value={form.website} onChange={set('website')} placeholder="https://erforetag.se" /></div>
          </div>
        )}

        {/* ── Step: Kontakt (brand, last) ── */}
        {stepLabel === 'Kontakt' && (
          <div className="wiz-pane" key="contact" style={{ display: 'flex', flexDirection: 'column', gap: 17 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16 }}>
              <div className="field"><label htmlFor="rg-phone">Kontakttelefon</label><input id="rg-phone" type="tel" value={form.contactPhone} onChange={set('contactPhone')} placeholder="+46…" autoComplete="tel" /></div>
              <div className="field"><label htmlFor="rg-bcountry">Land *</label>
                <select id="rg-bcountry" value={form.country} onChange={set('country')} required>
                  {COUNTRIES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                </select>
              </div>
            </div>
            <div className="field"><label htmlFor="rg-desc">Om företaget</label><textarea id="rg-desc" value={form.description} onChange={set('description')} rows={3} placeholder="Vad gör ni, och vilken typ av kreatörer letar ni efter? Kreatörer ser detta på era kampanjer." /></div>
            <RegisterSummary form={form} social={social} />
          </div>
        )}

        {error && <p className="auth-err" role="alert">{error}</p>}

        <div className="wiz-nav">
          {step > 0 && (
            <button type="button" className="btn-back" onClick={back} disabled={submitting}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
              Tillbaka
            </button>
          )}
          {isLast ? (
            <button type="button" className="btn-apply" onClick={handleSubmit} disabled={submitting} style={{ opacity: submitting ? 0.7 : 1 }}>
              {submitting ? 'Skickar…' : <>Skicka ansökan <Arrow /></>}
            </button>
          ) : (
            <button type="button" className="btn-apply" onClick={next}>
              Fortsätt <Arrow />
            </button>
          )}
        </div>
        {isLast && <p className="auth-consent">Genom att skicka in godkänner du våra <a className="auth-link" href="/terms" target="_blank" rel="noreferrer">villkor</a> och vår <a className="auth-link" href="/privacy" target="_blank" rel="noreferrer">integritetspolicy</a>. Kontot granskas av en administratör innan du kan logga in.</p>}
      </div>
      <p className="auth-foot">Har redan konto? <a href="/login" className="auth-link">Logga in</a></p>
    </AuthShell>
  );
}

function RegisterSummary({ form, social }: { form: WizardForm; social: PendingSocialSignup | null }) {
  const rows: [string, string][] = form.role === 'Creator'
    ? [
        ['Konto', social ? `${social.email} (via ${social.provider})` : form.email],
        ['Visningsnamn', form.displayName || '—'],
        ['Kategori', `${form.category} · ${form.country}`],
        ['TikTok', form.tikTokUsername ? `@${form.tikTokUsername.replace(/^@/, '')}` : '—'],
        ['Räckvidd', form.followerCount ? `${form.followerCount} följare` : 'Ej angiven'],
      ]
    : [
        ['Konto', social ? `${social.email} (via ${social.provider})` : form.email],
        ['Företag', form.companyName || '—'],
        ['Org.nr', form.organizationNumber || '—'],
        ['Bransch', `${form.industry} · ${form.country}`],
      ];
  return (
    <div className="sum-box" aria-label="Sammanfattning">
      {rows.map(([l, v]) => (
        <div className="sum-row" key={l}><span className="sr-l">{l}</span><span className="sr-v">{v}</span></div>
      ))}
    </div>
  );
}

/* ───────────────────────── Pending ───────────────────────── */
export function PendingApprovalPage() {
  const navigate = useNavigate();
  return (
    <AuthShell>
      <div style={{ textAlign: 'center' }}>
        <div className="auth-pending-ic"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></div>
        <h1 className="auth-title">Ansökan <em>mottagen</em></h1>
        <p className="auth-sub" style={{ maxWidth: 360, margin: '8px auto 0' }}>Tack för att du går med i VYRLE. Vi granskar din profil nu och hör av oss så snart du är godkänd, oftast inom 1 till 2 arbetsdagar.</p>
        <div style={{ background: 'rgba(237,225,255,.35)', border: '1px solid rgba(157,139,196,.2)', borderRadius: 14, padding: 14, margin: '20px 0', fontSize: 12.5, color: 'var(--muted)' }}>
          Du får ett meddelande när ditt konto har godkänts.
        </div>
        <button onClick={() => navigate('/')} className="btn-outline" style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>Tillbaka till startsidan</button>
      </div>
    </AuthShell>
  );
}

function EyeButton({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button type="button" className="auth-eye" onClick={onClick} aria-label={on ? 'Dölj lösenord' : 'Visa lösenord'}>
      {on ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-7-10-7a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22" /></svg>
      )}
    </button>
  );
}
