/**
 * Registration wizard.
 *   Creator: Konto → Koppla plattform → Profil → Klar
 *   Brand:   Konto → Företag → Profil → Klar
 * Every step validates all of its fields at once and shows each error under
 * its field. A live preview shows the profile card the way the other side will
 * see it: nothing is shown as verified before it is, and no numbers are typed.
 */
import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { t } from '@/lib/i18n';
import { useTitle } from '@/lib/title';
import api from '@/lib/api';
import { useRegister } from '@/hooks/api';
import { maskOrgNr, maskPhone } from '@/lib/masks';
import { isValidOrgNr } from '@/lib/orgnr';
import { ALL_TAGS } from '@/lib/tags';
import { CATEGORIES } from '@/lib/categories';
import { DateInput } from '@/components/ui/DateInput';
import { ImagePicker } from '@/components/auth/ImagePicker';
import { SocialButtons } from '@/components/auth/SocialButtons';
import { clearSocialSignup, readSocialSignup, stashSocialSignup, type PendingSocialSignup } from '@/lib/socialAuth';
import { AuthShell, Arrow, Check, SmallCheck, EyeButton, PendingApprovalPage, extractApiError, useSocialLoginFlow, INDUSTRIES, COUNTRIES } from '@/pages/auth/AuthPages';

type Role = 'Creator' | 'Brand';
interface Form {
  role: Role;
  email: string; password: string; firstName: string; lastName: string;
  displayName: string; bio: string; category: string; country: string; dateOfBirth: string;
  avatarUrl: string | null; selfieUrl: string | null;
  tikTokUsername: string; instagramUsername: string; website: string;
  profileTags: string[]; openToPrOffers: boolean;
  companyName: string; organizationNumber: string; industry: string; contactPhone: string; description: string; logoUrl: string | null;
}
type FieldKey = keyof Form;
type StringKey = { [K in FieldKey]: Form[K] extends string ? K : never }[FieldKey];
type Errors = Partial<Record<FieldKey, string>>;
interface Ctx { social: PendingSocialSignup | null; emailTaken: boolean; tiktokTaken: boolean; pwOk: boolean }

const STEPS: Record<Role, string[]> = { Creator: ['Konto', 'Koppla plattform', 'Profil', 'Klar'], Brand: ['Konto', 'Företag', 'Profil', 'Klar'] };
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const URL_RE = /^https?:\/\/\S+\.\S+$/;
const DRAFT_KEY = 'vyrle-register-draft';
const MAX_DOB = new Date(Date.now() - 13 * 365.25 * 86400000).toISOString().slice(0, 10);
const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 16, minWidth: 0 };
const pane: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 17 };

const emptyForm = (role: Role, social: PendingSocialSignup | null): Form => ({
  role, email: social?.email ?? '', password: '', firstName: social?.firstName ?? '', lastName: social?.lastName ?? '',
  displayName: social?.firstName ?? '', bio: '', category: 'Övrigt', country: 'SE', dateOfBirth: '',
  avatarUrl: social?.pictureUrl ?? null, selfieUrl: null,
  tikTokUsername: '', instagramUsername: '', website: '',
  profileTags: [], openToPrOffers: true,
  companyName: '', organizationNumber: '', industry: 'Övrigt', contactPhone: '', description: '', logoUrl: null,
});

/* The TikTok OAuth round-trip leaves the page; the draft survives in sessionStorage. */
function saveDraft(form: Form, step: number) { try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ form: { ...form, password: '' }, step })); } catch { /* private mode */ } }
function takeDraft(): { form: Form; step: number } | null {
  try { const raw = sessionStorage.getItem(DRAFT_KEY); sessionStorage.removeItem(DRAFT_KEY); return raw ? (JSON.parse(raw) as { form: Form; step: number }) : null; } catch { return null; }
}

/** Every error for the step, keyed by field, so they can all be fixed in one go. */
function validateStep(label: string, f: Form, ctx: Ctx): Errors {
  const e: Errors = {};
  const linked = ctx.social?.provider === 'TikTok';
  if (label === 'Konto') {
    if (!ctx.social || linked) {
      if (!EMAIL.test(f.email.trim())) e.email = t('Ange en giltig e-postadress');
      else if (ctx.emailTaken) e.email = t('E-postadressen används redan — logga in istället.');
    }
    if (!ctx.social && !ctx.pwOk) e.password = t('Lösenordet uppfyller inte alla krav');
  }
  if (label === 'Koppla plattform') {
    if (!linked) {
      if (!f.tikTokUsername.trim()) e.tikTokUsername = t('Ange ditt TikTok-användarnamn, eller koppla kontot direkt med knappen ovan.');
      else if (ctx.tiktokTaken) e.tikTokUsername = t('Det här TikTok-kontot är redan kopplat till ett annat VYRLE-konto.');
    }
    if (f.website.trim() && !URL_RE.test(f.website.trim())) e.website = t('Ange en fullständig adress som börjar med https://');
  }
  if (label === 'Profil' && f.role === 'Creator') {
    if (!f.displayName.trim()) e.displayName = t('Visningsnamn krävs');
    if (f.bio.trim().length < 20) e.bio = t('Skriv minst 20 tecken i din bio — varumärken läser den först av allt');
    if (!f.selfieUrl) e.selfieUrl = t('Selfie krävs — den används för att verifiera att du är en riktig person.');
    if (f.profileTags.length === 0) e.profileTags = t('Välj minst en expertis-tagg');
    if (f.dateOfBirth && f.dateOfBirth > MAX_DOB) e.dateOfBirth = t('Du måste vara minst 13 år.');
  }
  if (label === 'Företag') {
    if (!f.companyName.trim()) e.companyName = t('Företagsnamn krävs');
    if (!/^\d{6}-\d{4}$/.test(f.organizationNumber.trim())) e.organizationNumber = t('Ange organisationsnummer i formatet XXXXXX-XXXX');
    else if (!isValidOrgNr(f.organizationNumber)) e.organizationNumber = t('Kontrollsiffran stämmer inte — kontrollera numret.');
    if (f.website.trim() && !URL_RE.test(f.website.trim())) e.website = t('Ange en fullständig adress som börjar med https://');
  }
  return e;
}

function F({ id, label, error, hint, children }: { id?: string; label: React.ReactNode; error?: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className={`field${error ? ' has-err' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {error ? <div className="auth-err auth-err--field" role="alert">{error}</div> : hint ? <div className="auth-hint">{hint}</div> : null}
    </div>
  );
}

const TikTokMark = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.5 5.5c.9 1 2.1 1.6 3.5 1.7v2.6c-1.3 0-2.6-.4-3.6-1.1v6c0 3-2.4 5.4-5.4 5.4S5.6 17.7 5.6 14.7s2.4-5.4 5.4-5.4c.3 0 .6 0 .9.1v2.8c-.3-.1-.6-.2-.9-.2-1.5 0-2.7 1.2-2.7 2.7s1.2 2.7 2.7 2.7 2.7-1.2 2.7-2.7V2.5h2.8c0 1.1.2 2.1.5 3z" /></svg>;

/** The profile card as the other side will see it. Unverified facts say so; numbers are dashes until TikTok fills them. */
function Preview({ form, social }: { form: Form; social: PendingSocialSignup | null }) {
  const creator = form.role === 'Creator';
  const linked = social?.provider === 'TikTok';
  const img = creator ? form.avatarUrl : form.logoUrl;
  const name = creator ? form.displayName.trim() || form.firstName.trim() : form.companyName.trim();
  const country = COUNTRIES.find(([c]) => c === form.country)?.[1] ?? form.country;
  const handle = form.tikTokUsername.trim().replace(/^@/, '');
  return (
    <div className="reg-card" aria-label={t('Förhandsvisning av profilen')}>
      <div className="reg-card-cover" />
      <div className="reg-card-body">
        <div className="reg-card-avatar" style={img ? { backgroundImage: `url(${img})` } : undefined} aria-hidden>{!img && (name.charAt(0).toUpperCase() || '?')}</div>
        <div className="reg-card-name">{name || (creator ? t('Ditt visningsnamn') : t('Företagsnamn'))}</div>
        <div className="reg-card-sub">{creator ? t(form.category) : t(form.industry)} · {t(country)}</div>
        <div className="reg-card-badges">
          {creator ? (
            <>
              {linked ? <span className="reg-badge ok"><SmallCheck /> {t('Verifierad via TikTok')}</span>
                : handle ? <span className="reg-badge">@{handle} · {t('ej verifierad')}</span>
                : <span className="reg-badge">{t('TikTok ej kopplat')}</span>}
              {form.instagramUsername.trim() && <span className="reg-badge">Instagram · {t('ej verifierad')}</span>}
            </>
          ) : (
            <span className="reg-badge">{t('Org.nr')} · {form.organizationNumber.trim() ? t('kontrolleras efter registrering') : t('saknas')}</span>
          )}
        </div>
        {creator && form.profileTags.length > 0 && (
          <div className="reg-card-tags">{form.profileTags.slice(0, 4).map((tg) => <span key={tg}>{t(tg)}</span>)}{form.profileTags.length > 4 && <span>+{form.profileTags.length - 4}</span>}</div>
        )}
        <p className="reg-card-bio">{(creator ? form.bio : form.description).trim() || (creator ? t('Din bio visas här.') : t('Beskrivningen av företaget visas här.'))}</p>
        {creator && (
          <>
            <div className="reg-card-stats">
              <div><b>–</b><span>{t('Verifierade views')}</span></div>
              <div><b>–</b><span>{t('Intäkt / 1K views')}</span></div>
              <div><b>–</b><span>{t('Godkänt')}</span></div>
            </div>
            <div className="reg-card-note">{t('Siffrorna hämtas från TikTok när kontot är kopplat. Inget fylls i för hand.')}</div>
          </>
        )}
      </div>
    </div>
  );
}

export function RegisterPage() {
  useTitle(t('Skapa konto'));
  const [searchParams] = useSearchParams();
  const fromSocial = searchParams.get('social') === '1';
  const [social, setSocial] = useState<PendingSocialSignup | null>(() => (fromSocial ? readSocialSignup() : null));
  const [init] = useState(() => {
    const s = fromSocial ? readSocialSignup() : null;
    const draft = fromSocial ? takeDraft() : null;
    const role: Role = draft?.form.role ?? (searchParams.get('role') === 'Brand' ? 'Brand' : 'Creator');
    const form: Form = draft
      ? { ...draft.form, email: draft.form.email || s?.email || '', avatarUrl: draft.form.avatarUrl ?? s?.pictureUrl ?? null }
      : emptyForm(role, s);
    return { form, step: draft?.step ?? 0 };
  });
  const [form, setForm] = useState<Form>(init.form);
  const [step, setStep] = useState(init.step);
  const [errors, setErrors] = useState<Errors>({});
  const [apiError, setApiError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [emailTaken, setEmailTaken] = useState(false);
  const [tiktokTaken, setTiktokTaken] = useState(false);
  const register = useRegister();

  const update = <K extends FieldKey>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => { if (!e[key]) return e; const n = { ...e }; delete n[key]; return n; });
  };
  const set = (key: StringKey) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => update(key, e.target.value);
  const toggleTag = (tag: string) => update('profileTags', form.profileTags.includes(tag) ? form.profileTags.filter((x) => x !== tag) : [...form.profileTags, tag]);

  const onSocialToken = useSocialLoginFlow(setApiError, (pending) => {
    stashSocialSignup(pending);
    setSocial(pending);
    setErrors({});
    setForm((f) => ({ ...f, email: pending.email, firstName: f.firstName || pending.firstName || '', lastName: f.lastName || pending.lastName || '', displayName: f.displayName || pending.firstName || '', avatarUrl: f.avatarUrl ?? pending.pictureUrl ?? null }));
  });

  const pw = form.password;
  const pwRules: [boolean, string][] = [[/[A-Z]/.test(pw), t('Versal (A–Z)')], [/[a-z]/.test(pw), t('Gemen (a–z)')], [/[0-9]/.test(pw), t('Siffra (0–9)')], [pw.length >= 8, t('Minst 8 tecken')]];
  const pwOk = pwRules.every(([ok]) => ok);
  const ctx: Ctx = { social, emailTaken, tiktokTaken, pwOk };
  const linked = social?.provider === 'TikTok';

  const checkEmail = async () => {
    const v = form.email.trim();
    if (!EMAIL.test(v)) return;
    try { const res = await api.post('/auth/check-email', { email: v }); setEmailTaken(res.data.data === false); } catch { /* the final submit still guards */ }
  };
  const checkTikTok = async () => {
    const v = form.tikTokUsername.trim().replace(/^@/, '');
    if (!v) return;
    try { const res = await api.post('/auth/check-tiktok', { username: v }); setTiktokTaken(res.data.data === false); } catch { /* the final submit still guards */ }
  };

  const steps = STEPS[form.role];
  const label = steps[step];
  const isLast = step === steps.length - 1;
  const errCount = Object.keys(errors).length;

  const goNext = () => {
    const e = validateStep(label, form, ctx);
    setErrors(e); setApiError('');
    if (Object.keys(e).length) return;
    setStep((s) => Math.min(s + 1, steps.length - 1));
    window.scrollTo({ top: 0 });
  };
  const goBack = () => { setErrors({}); setApiError(''); setStep((s) => Math.max(s - 1, 0)); };

  const startTikTok = async () => {
    saveDraft(form, step); setApiError('');
    try { const res = await api.get<{ data: { url: string } }>('/auth/tiktok/start'); window.location.href = res.data.data.url; }
    catch (err) { setApiError(extractApiError(err, t('Kunde inte starta TikTok-inloggning — försök igen'))); }
  };

  const submit = async () => {
    // Everything again, in case a field was edited after its step.
    for (let i = 0; i < steps.length; i++) {
      const e = validateStep(steps[i], form, ctx);
      if (Object.keys(e).length) { setStep(i); setErrors(e); return; }
    }
    setApiError(''); setSubmitting(true);
    const common = {
      role: form.role,
      firstName: form.firstName.trim() || null, lastName: form.lastName.trim() || null,
      companyName: form.companyName.trim() || null, organizationNumber: form.organizationNumber.trim() || null, contactPhone: form.contactPhone.trim() || null,
      displayName: form.displayName.trim() || null, country: form.country, bio: form.bio.trim() || null, category: form.category,
      tikTokUsername: form.tikTokUsername.trim().replace(/^@/, '') || null, dateOfBirth: form.dateOfBirth || null,
      profileTags: form.profileTags.length > 0 ? form.profileTags : null,
      instagramUsername: form.instagramUsername.trim().replace(/^@/, '') || null,
      avatarUrl: form.avatarUrl, selfieUrl: form.selfieUrl, website: form.website.trim() || null,
      industry: form.industry, logoUrl: form.logoUrl, description: form.description.trim() || null,
    };
    try {
      if (social) { await api.post('/auth/social/register', { provider: social.provider, token: social.token, email: form.email.trim() || null, ...common }); clearSocialSignup(); }
      else await register.mutateAsync({ email: form.email.trim(), password: form.password, ...common });
      setSubmitted(true);
    } catch (err) {
      setApiError(extractApiError(err, t('Registreringen misslyckades. Försök igen.')));
    } finally { setSubmitting(false); }
  };

  if (submitted) return <PendingApprovalPage email={social?.email || form.email.trim()} tikTokLinked={form.role === 'Brand' ? undefined : !!linked} />;

  const preview = <Preview form={form} social={social} />;
  const summaryRows: [string, React.ReactNode][] = form.role === 'Creator'
    ? [
        [t('Konto'), social ? `${form.email || social.email} (${t('via')} ${social.provider})` : form.email],
        [t('Visningsnamn'), form.displayName || '—'],
        [t('Kategori'), `${t(form.category)} · ${form.country}`],
        ['TikTok', linked ? <span style={{ color: '#2f9d5b', fontWeight: 600 }}>{t('Kopplat och verifierat')}</span> : form.tikTokUsername ? `@${form.tikTokUsername.replace(/^@/, '')} · ${t('ej verifierad')}` : '—'],
        ...(form.instagramUsername ? [['Instagram', `@${form.instagramUsername.replace(/^@/, '')} · ${t('ej verifierad')}`] as [string, React.ReactNode]] : []),
        [t('Expertis'), `${form.profileTags.length} ${t('tagg(ar)')}`],
      ]
    : [
        [t('Konto'), social ? `${form.email || social.email} (${t('via')} ${social.provider})` : form.email],
        [t('Företag'), form.companyName || '—'],
        [t('Org.nr'), `${form.organizationNumber || '—'} · ${t('kontrolleras mot VIES')}`],
        [t('Bransch'), `${t(form.industry)} · ${form.country}`],
        [t('Kontakt'), [form.firstName, form.lastName].filter(Boolean).join(' ') || form.contactPhone || '—'],
      ];

  return (
    <AuthShell wide className="reg-wide">
      <h1 className="auth-title">{t('Skapa')} <em>{t('konto')}</em></h1>
      <p className="auth-sub">{t('Fyra steg. Vi granskar och godkänner profilen innan den går live, oftast inom 1–2 arbetsdagar.')}</p>

      <div className="wiz-track" role="list" aria-label={t('Registreringssteg')} style={{ flexWrap: 'wrap', rowGap: 6, minWidth: 0 }}>
        {steps.map((s, i) => (
          <React.Fragment key={s}>
            {i > 0 && <span className={`wiz-conn${i <= step ? ' done' : ''}`} aria-hidden="true" />}
            <div className={`wiz-step${i === step ? ' cur' : ''}${i < step ? ' done' : ''}`} role="listitem" aria-current={i === step ? 'step' : undefined}>
              <span className="wiz-dot">{i < step ? <SmallCheck /> : i + 1}</span>
              <span className="wiz-lbl">{t(s)}</span>
            </div>
          </React.Fragment>
        ))}
      </div>
      <div className="wiz-meta">{t('Steg')} {step + 1} {t('av')} {steps.length} · {t(label)}</div>

      <details className="reg-details"><summary>{t('Förhandsgranska profilen')}</summary>{preview}</details>

      <div className="reg-layout">
        <form className="auth-form" noValidate onSubmit={(e) => { e.preventDefault(); if (isLast) void submit(); else goNext(); }}>
          {label === 'Konto' && (
            <div className="wiz-pane" key="account" style={pane}>
              <div className="role-cards role-cards--sm" role="radiogroup" aria-label={t('Kontotyp')}>
                <button type="button" role="radio" aria-checked={form.role === 'Creator'} className={`role-card${form.role === 'Creator' ? ' on' : ''}`} onClick={() => update('role', 'Creator')}>
                  <span className="rc-check"><SmallCheck /></span>
                  <div className="rc-t">{t('Jag är creator')}</div>
                  <div className="rc-d">{t('Få betalt per verifierad visning.')}</div>
                </button>
                <button type="button" role="radio" aria-checked={form.role === 'Brand'} className={`role-card${form.role === 'Brand' ? ' on' : ''}`} onClick={() => update('role', 'Brand')} disabled={linked} title={linked ? t('Registrering via TikTok är endast för creators') : undefined}>
                  <span className="rc-check"><SmallCheck /></span>
                  <div className="rc-t">{t('Jag är varumärke')}</div>
                  <div className="rc-d">{t('Betala bara för verifierade visningar.')}</div>
                </button>
              </div>

              {social ? (
                <>
                  <div className="social-chip">
                    <Check />
                    <span>
                      {t('Inloggad via')} <b>{social.provider}</b>{social.email ? <> {t('som')} <b>{social.email}</b></> : null} {t('— inget lösenord behövs.')}{' '}
                      <button type="button" className="auth-link" style={{ background: 'none', border: 'none', padding: 0, font: 'inherit' }} onClick={() => { clearSocialSignup(); setSocial(null); }}>{t('Använd e-post i stället')}</button>
                    </span>
                  </div>
                  {linked && (
                    <F id="rg-email" label={<>{t('E-post')} *</>} error={errors.email} hint={t('TikTok delar ingen e-postadress, så vi behöver din för kvitton och utbetalningar.')}>
                      <input id="rg-email" type="email" value={form.email} onChange={(e) => { setEmailTaken(false); update('email', e.target.value); }} onBlur={() => void checkEmail()} autoComplete="email" placeholder={t('du@exempel.se')} aria-invalid={!!errors.email} />
                    </F>
                  )}
                </>
              ) : (
                <>
                  <F id="rg-email" label={<>{t('E-post')} *</>} error={errors.email}>
                    <input id="rg-email" type="email" value={form.email} onChange={(e) => { setEmailTaken(false); update('email', e.target.value); }} onBlur={() => void checkEmail()} autoComplete="email" placeholder={t('du@exempel.se')} aria-invalid={!!errors.email} />
                  </F>
                  {emailTaken && !errors.email && <div className="auth-err" style={{ marginTop: -8 }}>{t('E-postadressen används redan.')} <Link to="/login" style={{ fontWeight: 700 }}>{t('Logga in istället?')}</Link></div>}
                  <F id="rg-pw" label={<>{t('Lösenord')} *</>} error={errors.password}>
                    <div className="auth-pw-wrap">
                      <input id="rg-pw" type={showPw ? 'text' : 'password'} value={form.password} onChange={set('password')} minLength={8} autoComplete="new-password" placeholder={t('Minst 8 tecken')} aria-invalid={!!errors.password} />
                      <EyeButton on={showPw} onClick={() => setShowPw((v) => !v)} />
                    </div>
                  </F>
                  <div className="auth-rules" style={{ marginTop: -6 }}>
                    {pwRules.map(([ok, l]) => (
                      <span key={l} className={`auth-rule${ok ? ' ok' : ''}`}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">{ok ? <path d="m5 12 4 4L19 7" /> : <circle cx="12" cy="12" r="9" />}</svg>{l}
                      </span>
                    ))}
                  </div>
                </>
              )}
              <div style={grid2}>
                <F id="rg-fn" label={form.role === 'Brand' ? t('Förnamn (kontaktperson)') : t('Förnamn')}><input id="rg-fn" type="text" value={form.firstName} onChange={set('firstName')} autoComplete="given-name" /></F>
                <F id="rg-ln" label={t('Efternamn')}><input id="rg-ln" type="text" value={form.lastName} onChange={set('lastName')} autoComplete="family-name" /></F>
              </div>
              {!social && <SocialButtons onToken={onSocialToken} />}
            </div>
          )}

          {label === 'Koppla plattform' && (
            <div className="wiz-pane" key="platform" style={pane}>
              <div className="reg-connect">
                {linked ? (
                  <div className="social-chip" style={{ margin: 0 }}><Check /><span><b>{t('TikTok-kontot är kopplat.')}</b> {t('Dina videor och views hämtas automatiskt och räknas som verifierade.')}</span></div>
                ) : (
                  <>
                    <button type="button" className="btn-social tiktok" onClick={() => void startTikTok()} disabled={submitting} style={{ background: '#161823', color: '#fff', borderColor: '#161823' }}><TikTokMark />{t('Fortsätt med TikTok')}</button>
                    <div className="auth-hint" style={{ marginTop: 10 }}>{t('Rekommenderat. Kopplingen gör dina views verifierbara och profilen synlig för företag så snart du är godkänd. Vi läser bara din profil och dina videor, aldrig något annat.')}</div>
                  </>
                )}
              </div>
              {!linked && (
                <F id="rg-tt" label={<>{t('TikTok-användarnamn')} *</>} error={errors.tikTokUsername} hint={t('Utan koppling är profilen inte synlig för företag förrän du kopplar kontot i appen efter godkännandet.')}>
                  <div className="auth-at"><span>@</span><input id="rg-tt" type="text" value={form.tikTokUsername} onChange={(e) => { setTiktokTaken(false); update('tikTokUsername', e.target.value); }} onBlur={() => void checkTikTok()} placeholder={t('dittanvändarnamn')} aria-invalid={!!errors.tikTokUsername} /></div>
                </F>
              )}
              <F id="rg-ig" label={t('Instagram')} error={errors.instagramUsername} hint={t('Visas som en länk märkt "ej verifierad". Inga Instagram-siffror hämtas eller visas.')}>
                <div className="auth-at"><span>@</span><input id="rg-ig" type="text" value={form.instagramUsername} onChange={set('instagramUsername')} placeholder={t('dittinstagram')} /></div>
              </F>
              <F id="rg-web" label={t('Webbplats / Linktree')} error={errors.website}><input id="rg-web" type="url" value={form.website} onChange={set('website')} placeholder="https://…" aria-invalid={!!errors.website} /></F>
            </div>
          )}

          {label === 'Företag' && (
            <div className="wiz-pane" key="company" style={pane}>
              <ImagePicker label={t('Logotyp')} shape="rounded" value={form.logoUrl} onChange={(v) => update('logoUrl', v)} hint={t('Visas för creators på era kampanjer.')} />
              <F id="rg-co" label={<>{t('Företagsnamn')} *</>} error={errors.companyName}><input id="rg-co" type="text" value={form.companyName} onChange={set('companyName')} autoComplete="organization" aria-invalid={!!errors.companyName} /></F>
              <div style={grid2}>
                <F id="rg-org" label={<>{t('Organisationsnummer')} *</>} error={errors.organizationNumber} hint={t('Kontrolleras mot momsregistret (VIES). Krävs för att gå live.')}>
                  <input id="rg-org" type="text" inputMode="numeric" value={form.organizationNumber} onChange={(e) => update('organizationNumber', maskOrgNr(e.target.value))} placeholder="556677-8899" aria-invalid={!!errors.organizationNumber} />
                </F>
                <F id="rg-ind" label={<>{t('Bransch')} *</>}>
                  <select id="rg-ind" value={form.industry} onChange={set('industry')}>{INDUSTRIES.map((i) => <option key={i} value={i}>{t(i)}</option>)}</select>
                </F>
              </div>
              <F id="rg-bweb" label={t('Webbplats')} error={errors.website}><input id="rg-bweb" type="url" value={form.website} onChange={set('website')} placeholder={t('https://erforetag.se')} aria-invalid={!!errors.website} /></F>
            </div>
          )}

          {label === 'Profil' && form.role === 'Creator' && (
            <div className="wiz-pane" key="profile" style={pane}>
              <ImagePicker label={t('Profilbild')} value={form.avatarUrl} onChange={(v) => update('avatarUrl', v)} hint={t('Varumärken ser den först — ett tydligt ansikte ökar dina chanser.')} />
              <div>
                <ImagePicker label={`${t('Selfie för verifiering')} *`} value={form.selfieUrl} onChange={(v) => update('selfieUrl', v)} capture hint={t('Ta en selfie med framkameran. Visas ALDRIG offentligt — används endast av vårt team för att verifiera att du är en riktig person.')} />
                {errors.selfieUrl && <div className="auth-err auth-err--field" role="alert" style={{ marginTop: 8 }}>{errors.selfieUrl}</div>}
              </div>
              <F id="rg-name" label={<>{t('Visningsnamn')} *</>} error={errors.displayName}><input id="rg-name" type="text" value={form.displayName} onChange={set('displayName')} placeholder={t('Ditt namn eller alias')} aria-invalid={!!errors.displayName} /></F>
              <F id="rg-bio" label={<>{t('Bio')} *</>} error={errors.bio} hint={`${form.bio.trim().length}/20 ${t('tecken minimum')}`}>
                <textarea id="rg-bio" value={form.bio} onChange={set('bio')} rows={3} placeholder={t('Berätta om dig och ditt innehåll — varför ska varumärken samarbeta med dig?')} aria-invalid={!!errors.bio} />
              </F>
              <div style={grid2}>
                <F id="rg-cat" label={<>{t('Kategori')} *</>}><select id="rg-cat" value={form.category} onChange={set('category')}>{CATEGORIES.map((c) => <option key={c} value={c}>{t(c)}</option>)}</select></F>
                <F id="rg-country" label={<>{t('Land')} *</>}><select id="rg-country" value={form.country} onChange={set('country')}>{COUNTRIES.map(([code, name]) => <option key={code} value={code}>{t(name)}</option>)}</select></F>
              </div>
              <F id="rg-dob" label={t('Födelsedatum')} error={errors.dateOfBirth}><DateInput id="rg-dob" value={form.dateOfBirth} onChange={(v) => update('dateOfBirth', v)} max={MAX_DOB} /></F>
              <F label={<>{t('Expertis-taggar')} * — {t('vad är du bra på?')}</>} error={errors.profileTags}>
                <div className="auth-tagbox">
                  <div className="auth-tags">
                    {ALL_TAGS.map((tag) => (
                      <button key={tag} type="button" className={`auth-tag${form.profileTags.includes(tag) ? ' on' : ''}`} aria-pressed={form.profileTags.includes(tag)} onClick={() => toggleTag(tag)}>{t(tag)}</button>
                    ))}
                  </div>
                  <div className="auth-hint" style={{ marginTop: 10 }}>{form.profileTags.length === 0 ? t('Välj minst en tagg') : `${t('Valt:')} ${form.profileTags.length} ${t('tagg(ar)')}`}</div>
                </div>
              </F>
              <label className="checkrow" htmlFor="rg-pr">
                <input id="rg-pr" type="checkbox" checked={form.openToPrOffers} onChange={(e) => update('openToPrOffers', e.target.checked)} />
                {t('Öppen för direkta PR-erbjudanden från varumärken')}
              </label>
            </div>
          )}

          {label === 'Profil' && form.role === 'Brand' && (
            <div className="wiz-pane" key="contact" style={pane}>
              <div style={grid2}>
                <F id="rg-phone" label={t('Kontakttelefon')}><input id="rg-phone" type="tel" value={form.contactPhone} onChange={(e) => update('contactPhone', maskPhone(e.target.value))} placeholder="070-123 45 67" autoComplete="tel" /></F>
                <F id="rg-bcountry" label={<>{t('Land')} *</>}><select id="rg-bcountry" value={form.country} onChange={set('country')}>{COUNTRIES.map(([code, name]) => <option key={code} value={code}>{t(name)}</option>)}</select></F>
              </div>
              <F id="rg-desc" label={t('Om företaget')} hint={t('Creators ser detta på era kampanjer.')}><textarea id="rg-desc" value={form.description} onChange={set('description')} rows={3} placeholder={t('Vad gör ni, och vilken typ av creators letar ni efter?')} /></F>
            </div>
          )}

          {label === 'Klar' && (
            <div className="wiz-pane" key="done" style={pane}>
              <div className="sum-box" aria-label={t('Sammanfattning')}>
                {summaryRows.map(([l, v]) => <div className="sum-row" key={l}><span className="sr-l">{l}</span><span className="sr-v">{v}</span></div>)}
              </div>
              {form.role === 'Creator' && !linked && <div className="reg-summary-note">{t('Profilen blir synlig för företag först när TikTok-kontot är kopplat. Du kan göra det direkt efter godkännandet, eller gå tillbaka och koppla nu.')}</div>}
              {form.role === 'Brand' && <div className="reg-summary-note">{t('Organisationsnumret kontrolleras mot momsregistret efter registreringen. Kampanjer och videobeställningar kan gå live först när det är verifierat.')}</div>}
            </div>
          )}

          {errCount > 0 && <p className="auth-err" role="alert">{t('Rätta de markerade fälten')} ({errCount})</p>}
          {apiError && <p className="auth-err" role="alert">{apiError}</p>}

          <div className="wiz-nav" style={{ flexWrap: 'wrap', minWidth: 0 }}>
            {step > 0 && (
              <button type="button" className="btn-back" onClick={goBack} disabled={submitting} style={{ maxWidth: '100%' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
                {t('Tillbaka')}
              </button>
            )}
            <button type="submit" className="btn-apply" disabled={submitting} style={{ opacity: submitting ? 0.7 : 1 }}>
              {isLast ? (submitting ? t('Skickar…') : <>{t('Skicka ansökan')} <Arrow /></>) : <>{t('Fortsätt')} <Arrow /></>}
            </button>
          </div>
          {isLast && <p className="auth-consent">{t('Genom att skicka in godkänner du våra')} <a className="auth-link" href="/terms" target="_blank" rel="noreferrer">{t('villkor')}</a> {t('och vår')} <a className="auth-link" href="/privacy" target="_blank" rel="noreferrer">{t('integritetspolicy')}</a>.</p>}
        </form>

        <aside className="reg-aside"><div className="reg-aside-title">{t('Så ser profilen ut')}</div>{preview}</aside>
      </div>
      <p className="auth-foot">{t('Har redan konto?')} <a href="/login" className="auth-link">{t('Logga in')}</a></p>
    </AuthShell>
  );
}
