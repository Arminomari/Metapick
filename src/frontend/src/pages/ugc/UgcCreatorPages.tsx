import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { t } from '@/lib/i18n';
import { formatDate, formatNumber } from '@/lib/utils';
import { useToast, CardSkeleton } from '@/components/vyrle/Toast';
import {
  useUgcCreatorProfile, useUpsertUgcCreatorProfile, useRefreshUgcVerification, useUgcPayoutStatus, useStartUgcPayoutOnboarding,
  useUgcCreatorCampaigns, useApplyToUgcCampaign, useUgcMyApplications, useWithdrawUgcApplication, useUgcCollabs,
  formatOre, kronorToOre, oreToKronor, COMPENSATION_LABEL, RIGHTS_LABEL, RIGHTS_HINT, CREATOR_STATUS_SV, UGC_CATEGORIES, UGC_REGIONS, apiError,
  type UgcCampaign,
} from '@/hooks/ugc';
import { BriefView, CollabRow } from './UgcBrandPages';

const btn: React.CSSProperties = { width: 'auto', padding: '11px 20px', fontSize: 13.5 };
const initial = (s: string) => (s?.[0] || '?').toUpperCase();

// ═══════════════════════════════════════════════════════════════════
// Marketplace home: matching orders + bid
// ═══════════════════════════════════════════════════════════════════
export function UgcCreatorHomePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [matching, setMatching] = useState(true);
  const { data: profile } = useUgcCreatorProfile();
  const { data: campaigns = [], isLoading } = useUgcCreatorCampaigns(matching);
  const { data: collabs = [] } = useUgcCollabs('creator');
  const apply = useApplyToUgcCampaign();
  const [target, setTarget] = useState<UgcCampaign | null>(null);
  const [bid, setBid] = useState('');
  const [pitch, setPitch] = useState('');

  const needsMe = collabs.filter((c) => c.needsMyAction);
  const earned = collabs.filter((c) => c.status === 'Paid').reduce((s, c) => s + c.agreedAmountOre, 0);
  const blocked = profile && !profile.canTakeProduct;

  const openApply = (c: UgcCampaign) => {
    setTarget(c);
    setBid(oreToKronor(c.compensation === 'ProductExchange' ? 0 : Math.round((c.budgetMinOre + c.budgetMaxOre) / 2)));
    setPitch('');
  };
  const send = () => target && apply.mutate({ campaignId: target.id, bidOre: kronorToOre(bid), pitch }, {
    onSuccess: () => { toast.push(t('Budet är skickat! Företaget får en notis.'), 'success'); setTarget(null); },
    onError: (e) => toast.push(apiError(e, t('Kunde inte skicka budet')), 'error'),
  });

  return (
    <section className="view active reveal">
      <div className="page-head">
        <div>
          <h1 className="page-title">🎬 {t('Video')}<em>{t('uppdrag')}</em></h1>
          <p className="page-sub">{t('Företag beställer korta UGC-videor till fast pris. Lägg ditt bud, leverera, få betalt via VYRLE.')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn-outline" style={btn} onClick={() => navigate('/creator/ugc/profile')}>{t('Min UGC-profil')}</button>
          <button className="btn-outline" style={btn} onClick={() => navigate('/creator/ugc/collabs')}>{t('Mina uppdrag')} {needsMe.length > 0 && <span className="vy-badge neg" style={{ marginLeft: 6 }}>{needsMe.length}</span>}</button>
        </div>
      </div>

      {profile && (
        <div className="card" style={{ marginBottom: 16, border: blocked ? '1px solid rgba(212,155,46,.45)' : undefined, background: blocked ? 'linear-gradient(160deg,#fff,#FFF9F0)' : undefined }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className={`vy-badge ${profile.status === 'Approved' || profile.status === 'Verified' ? 'pos' : profile.status === 'Suspended' ? 'neg' : 'pend'}`}>{t(CREATOR_STATUS_SV[profile.status])}</span>
            <div style={{ flex: '1 1 240px', fontSize: 13.5, lineHeight: 1.5 }}>
              {profile.blocker ?? t('Du kan lägga bud på betalda uppdrag och produktbyten.')}
            </div>
            <div style={{ display: 'flex', gap: 14, fontSize: 12.5, color: 'var(--muted)', flexWrap: 'wrap' }}>
              <span>{profile.deliveredCount} {t('leveranser')}</span>
              {profile.ratingCount > 0 && <span>★ {profile.averageRating.toFixed(1)}</span>}
              <span>{formatOre(earned)} {t('tjänat')}</span>
            </div>
            {(profile.status === 'Pending' || !profile.payoutOnboardingComplete) && <button className="btn-apply" style={{ ...btn, padding: '9px 16px', fontSize: 12.5 }} onClick={() => navigate('/creator/ugc/profile')}>{t('Fixa profilen')} →</button>}
          </div>
        </div>
      )}

      {needsMe.length > 0 && (
        <div className="card" style={{ marginBottom: 16, border: '1px solid rgba(212,155,46,.45)', background: 'linear-gradient(160deg,#fff,#FFF9F0)' }}>
          <div className="sec-head"><h3>{t('Väntar på dig')}</h3></div>
          {needsMe.map((c) => <CollabRow key={c.id} c={c} role="creator" onOpen={() => navigate(`/creator/ugc/collabs/${c.id}`)} />)}
        </div>
      )}

      <div className="tabs">
        <button className={`tab${matching ? ' active' : ''}`} onClick={() => setMatching(true)}>{t('Passar dig')}</button>
        <button className={`tab${!matching ? ' active' : ''}`} onClick={() => setMatching(false)}>{t('Alla öppna')}</button>
      </div>

      {isLoading ? <CardSkeleton rows={3} /> : campaigns.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '54px 24px' }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{t('Inga öppna beställningar just nu')}</div>
          <div style={{ color: 'var(--muted)', fontSize: 14, marginTop: 8 }}>{matching ? t('Prova "Alla öppna" — eller fyll i kategorier och stad i din UGC-profil så matchar du fler.') : t('Du får en notis så fort ett företag publicerar något som passar dig.')}</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: 16 }}>
          {campaigns.map((c) => (
            <div key={c.id} className="camp-card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="ch">
                {c.brandLogoUrl ? <img src={c.brandLogoUrl} alt="" className="mono" style={{ objectFit: 'cover' }} /> : <span className="mono">{initial(c.brandName)}</span>}
                <div style={{ flex: 1, minWidth: 0 }}><div className="ttl">{c.title}</div><div className="brand">{c.brandName}{c.region ? ` · ${c.region}` : ''}</div></div>
                {c.briefGeneratedByAi && <span className="vy-badge info" style={{ fontSize: 10 }}>AI</span>}
              </div>
              <div className="desc" style={{ whiteSpace: 'pre-line' }}>{c.brief.goal}</div>
              <div className="meta-cols">
                <div className="mc"><div className="k">{t('Ersättning')}</div><div className="v" style={{ fontSize: 13 }}>{c.compensation === 'ProductExchange' ? t('Produkt') : `${formatOre(c.budgetMinOre)}–${formatOre(c.budgetMaxOre)}`}</div></div>
                <div className="mc"><div className="k">{t('Format')}</div><div className="v" style={{ fontSize: 13 }}>{c.brief.lengthSeconds} s · {c.brief.videoCount} st</div></div>
                <div className="mc"><div className="k">{t('Leverans')}</div><div className="v" style={{ fontSize: 13 }}>{c.deadlineDays} {t('dagar')}</div></div>
              </div>
              <div className="tags" style={{ marginBottom: 10 }}><span className="tag g">{t(RIGHTS_LABEL[c.rightsPackage])}</span><span className="tag">{t(COMPENSATION_LABEL[c.compensation])}</span>{c.slots - c.hiredCount > 0 && <span className="tag">{c.slots - c.hiredCount} {t('platser')}</span>}</div>
              <div style={{ marginTop: 'auto' }}>
                {c.myApplicationStatus ? (
                  c.myCollabId ? <button className="btn-apply" style={{ width: '100%' }} onClick={() => navigate(`/creator/ugc/collabs/${c.myCollabId}`)}>✓ {t('Anlitad — öppna uppdraget')}</button>
                    : <button className="btn-outline" style={{ width: '100%' }} disabled>{c.myApplicationStatus === 'Rejected' ? '✗ ' + t('Budet antogs inte') : c.myApplicationStatus === 'Withdrawn' ? t('Bud återtaget') : `⏳ ${t('Bud lagt')}${c.myBidOre ? ` · ${formatOre(c.myBidOre)}` : ''}`}</button>
                ) : (
                  <button className="btn-apply" style={{ width: '100%' }} disabled={c.compensation === 'ProductExchange' ? !profile?.canTakeProduct : !profile?.canTakePaid} onClick={() => openApply(c)}>{t('Lägg bud')}</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {target && (
        <>
          <div onClick={() => setTarget(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(11,15,23,.45)', backdropFilter: 'blur(3px)', zIndex: 80 }} aria-hidden />
          <div role="dialog" aria-modal="true" style={{ position: 'fixed', zIndex: 81, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(600px, calc(100vw - 28px))', maxHeight: 'calc(100dvh - 40px)', overflowY: 'auto', background: 'linear-gradient(160deg,#fff,#FFF9F5)', borderRadius: 24, border: '1px solid rgba(241,168,143,.35)', boxShadow: '0 30px 80px rgba(11,15,23,.28)', padding: 'clamp(18px, 5vw, 26px)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>{t('Lägg bud på')} {target.title}</h2>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>{target.brandName} · {t(RIGHTS_LABEL[target.rightsPackage])} · {target.deadlineDays} {t('dagars leverans')}</div>
              </div>
              <button type="button" onClick={() => setTarget(null)} aria-label={t('Stäng')} style={{ border: 'none', background: 'rgba(183,188,200,.2)', width: 34, height: 34, borderRadius: '50%', cursor: 'pointer', fontSize: 16 }}>×</button>
            </div>
            <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 14, background: 'rgba(255,244,236,.7)', maxHeight: 220, overflowY: 'auto' }}><BriefView b={target.brief} /></div>
            {target.compensation !== 'ProductExchange' && (
              <div className="field" style={{ marginTop: 14 }}>
                <label>{t('Ditt pris per video (kr)')} · {t('intervall')} {formatOre(target.budgetMinOre)}–{formatOre(target.budgetMaxOre)}</label>
                <input inputMode="decimal" value={bid} onChange={(e) => setBid(e.target.value)} style={{ width: '100%' }} />
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{t('Du får exakt det här beloppet — VYRLE:s avgift läggs ovanpå för företaget.')}</div>
              </div>
            )}
            <div className="field" style={{ marginTop: 12 }}>
              <label>{t('Pitch — varför just du?')} *</label>
              <textarea rows={4} maxLength={2000} value={pitch} onChange={(e) => setPitch(e.target.value)} placeholder={t('Vad du brukar göra, vem som följer dig, och hur du skulle lösa just den här briefen…')} style={{ width: '100%' }} />
              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}><span>{pitch.trim().length < 20 ? t('Minst 20 tecken.') : t('Bra — konkret slår långt.')}</span><span>{pitch.length}/2000</span></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button className="btn-apply" style={{ ...btn, flex: 1 }} disabled={apply.isPending || pitch.trim().length < 20} onClick={send}>{apply.isPending ? t('Skickar…') : t('Skicka bud')}</button>
              <button className="btn-outline" style={btn} onClick={() => setTarget(null)}>{t('Avbryt')}</button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════
// My bids
// ═══════════════════════════════════════════════════════════════════
export function UgcCreatorApplicationsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { data: apps = [], isLoading } = useUgcMyApplications();
  const withdraw = useWithdrawUgcApplication();
  const label: Record<string, [string, string]> = { Applied: ['Bud lagt', 'pend'], Preselected: ['Favorit hos företaget', 'info'], Hired: ['Anlitad', 'pos'], Rejected: ['Antogs inte', 'neg'], Withdrawn: ['Återtaget', 'neu'] };

  return (
    <section className="view active reveal">
      <div className="page-head"><div><h1 className="page-title">{t('Mina')} <em>{t('bud')}</em></h1><p className="page-sub">{t('Allt du lagt bud på. När ett företag anlitar dig dyker uppdraget upp under Mina uppdrag.')}</p></div></div>
      {isLoading ? <CardSkeleton rows={3} /> : apps.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '54px 24px' }}><div style={{ fontSize: 18, fontWeight: 700 }}>{t('Inga bud ännu')}</div><button className="btn-apply" style={{ ...btn, marginTop: 14 }} onClick={() => navigate('/creator/ugc')}>{t('Se öppna beställningar')}</button></div>
      ) : (
        <div className="card">
          {apps.map((a) => (
            <div key={a.id} className="list-row" style={{ gap: 14, flexWrap: 'wrap' }}>
              <div className="row-main" style={{ flex: '1 1 220px', minWidth: 0 }}>
                <div className="t" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{a.campaignTitle}<span className={`vy-badge ${label[a.status]?.[1] ?? 'neu'}`}>{t(label[a.status]?.[0] ?? a.status)}</span></div>
                <div className="s">{a.bidOre > 0 ? `${formatOre(a.bidOre)} / video · ` : ''}{formatDate(a.createdAt)}{a.decisionNote ? ` · ${a.decisionNote}` : ''}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {a.collabId && <button className="btn-apply" style={{ ...btn, padding: '9px 16px', fontSize: 12.5 }} onClick={() => navigate(`/creator/ugc/collabs/${a.collabId}`)}>{t('Öppna uppdraget')} →</button>}
                {(a.status === 'Applied' || a.status === 'Preselected') && <button className="view-all" style={{ color: 'var(--red)' }} disabled={withdraw.isPending} onClick={() => withdraw.mutate(a.id, { onSuccess: () => toast.push(t('Budet är återtaget'), 'success'), onError: (e) => toast.push(apiError(e, t('Kunde inte återta')), 'error') })}>{t('Ta tillbaka')}</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════
// UGC profile: verification, payout onboarding, tax, portfolio opt-out
// ═══════════════════════════════════════════════════════════════════
export function UgcCreatorProfilePage() {
  const toast = useToast();
  const [params] = useSearchParams();
  const { data: p, isLoading } = useUgcCreatorProfile();
  const { data: payout, refetch: refetchPayout } = useUgcPayoutStatus(!!p?.hasStripeAccount);
  const upsert = useUpsertUgcCreatorProfile();
  const refresh = useRefreshUgcVerification();
  const onboard = useStartUgcPayoutOnboarding();
  const [form, setForm] = useState({ categories: [] as string[], city: '', region: '', sampleVideoUrl: '', hasFTax: false, vatRegistered: false, vatNumber: '', allowPortfolioUse: true });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (p && !loaded) { setForm({ categories: p.categories, city: p.city ?? '', region: p.region ?? '', sampleVideoUrl: p.sampleVideoUrl ?? '', hasFTax: p.hasFTax, vatRegistered: p.vatRegistered, vatNumber: p.vatNumber ?? '', allowPortfolioUse: p.allowPortfolioUse }); setLoaded(true); }
  }, [p, loaded]);
  useEffect(() => {
    if (params.get('onboarding') === 'done') { refetchPayout(); toast.push(t('Välkommen tillbaka — vi kollar din registrering hos Stripe.'), 'success'); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading || !p) return <CardSkeleton rows={4} />;

  const save = () => upsert.mutate(form as any, { onSuccess: () => toast.push(t('Sparat'), 'success'), onError: (e) => toast.push(apiError(e, t('Kunde inte spara')), 'error') });
  const startOnboarding = () => onboard.mutate(undefined, {
    onSuccess: (r) => { if (r.url) window.location.href = r.url; else toast.push(r.message ?? t('Registreringen är redan klar'), r.complete ? 'success' : 'error'); },
    onError: (e) => toast.push(apiError(e, t('Kunde inte starta registreringen')), 'error'),
  });

  const steps = [
    { ok: p.followerSnapshot > 0 || p.socialSnapshotAt != null, label: t('TikTok kopplat') },
    { ok: !!p.sampleVideoUrl, label: t('Exempelvideo') },
    { ok: p.status === 'Verified' || p.status === 'Approved', label: t('Verifierad') },
    { ok: p.payoutOnboardingComplete, label: t('Utbetalning klar') },
  ];

  return (
    <section className="view active reveal">
      <div className="page-head"><div><h1 className="page-title">{t('Min')} <em>{t('UGC-profil')}</em></h1><p className="page-sub">{t('Det företag ser när du lägger bud, och det som krävs för att kunna ta betalda uppdrag.')}</p></div></div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span className={`vy-badge ${p.status === 'Approved' || p.status === 'Verified' ? 'pos' : p.status === 'Suspended' ? 'neg' : 'pend'}`}>{t(CREATOR_STATUS_SV[p.status])}</span>
          <div style={{ flex: '1 1 220px', fontSize: 13.5 }}>{p.blocker ?? t('Allt klart — du kan ta både betalda uppdrag och produktbyten.')}{p.statusNote ? ` (${p.statusNote})` : ''}</div>
          <button className="btn-outline" style={{ ...btn, padding: '8px 14px', fontSize: 12.5 }} disabled={refresh.isPending} onClick={() => refresh.mutate(undefined, { onSuccess: () => toast.push(t('Profilen är uppdaterad från TikTok'), 'success') })}>{refresh.isPending ? t('Kollar…') : t('Kolla igen')}</button>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
          {steps.map((s) => <span key={s.label} className={`vy-badge ${s.ok ? 'pos' : 'neu'}`}>{s.ok ? '✓' : '○'} {s.label}</span>)}
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 12, fontSize: 12.5, color: 'var(--muted)' }}>
          <span>{formatNumber(p.followerSnapshot)} {t('följare')}</span><span>L/F {(p.likeFollowerRatio * 100).toFixed(0)} %</span><span>{p.deliveredCount} {t('leveranser')} · {p.onTimeCount} {t('i tid')}</span>{p.strikes > 0 && <span style={{ color: '#b3402f' }}>{p.strikes} {t('anmärkning(ar)')}</span>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 16, alignItems: 'start' }}>
        <div className="card">
          <div className="sec-head"><h3>{t('Utbetalning')}</h3><span className={`vy-badge ${p.payoutOnboardingComplete ? 'pos' : 'pend'}`}>{p.payoutOnboardingComplete ? t('Klar') : t('Inte klar')}</span></div>
          <p style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink-2)', margin: 0 }}>{t('Betalda uppdrag betalas ut via Stripe direkt till ditt bankkonto när företaget godkänt leveransen. Registreringen tar några minuter.')}</p>
          {payout?.message && !p.payoutOnboardingComplete && <div style={{ fontSize: 12.5, color: '#9c6b1c', marginTop: 8 }}>{payout.message}</div>}
          {!p.payoutOnboardingComplete && <button className="btn-apply" style={{ ...btn, marginTop: 12 }} disabled={onboard.isPending} onClick={startOnboarding}>{p.hasStripeAccount ? t('Fortsätt registreringen') : t('Starta registreringen')}</button>}
        </div>

        <div className="card">
          <div className="sec-head"><h3>{t('Så matchas du')}</h3></div>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
            <div className="field"><label>{t('Kategorier')}</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{UGC_CATEGORIES.map((c) => { const on = form.categories.includes(c); return <button key={c} type="button" className={`tag ${on ? 'g' : ''}`} style={{ cursor: 'pointer', border: on ? undefined : '1px solid rgba(183,188,200,.4)', background: on ? undefined : 'transparent' }} onClick={() => setForm({ ...form, categories: on ? form.categories.filter((x) => x !== c) : [...form.categories, c].slice(0, 6) })}>{c}</button>; })}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field"><label>{t('Stad')}</label><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} style={{ width: '100%' }} /></div>
              <div className="field"><label>{t('Region')}</label><select value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })}><option value="">–</option>{UGC_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
            </div>
            <div className="field"><label>{t('Exempelvideo (länk)')}</label><input value={form.sampleVideoUrl} onChange={(e) => setForm({ ...form, sampleVideoUrl: e.target.value })} placeholder="https://www.tiktok.com/@…/video/…" style={{ width: '100%' }} /><div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{t('En video som visar hur du gör. Portfoliovideor räknas också.')}</div></div>
          </div>
        </div>

        <div className="card">
          <div className="sec-head"><h3>{t('Skatt & rättigheter')}</h3></div>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
            <label className="checkrow"><input type="checkbox" checked={form.hasFTax} onChange={(e) => setForm({ ...form, hasFTax: e.target.checked })} /> {t('Jag är godkänd för F-skatt')}</label>
            <label className="checkrow"><input type="checkbox" checked={form.vatRegistered} onChange={(e) => setForm({ ...form, vatRegistered: e.target.checked })} /> {t('Jag är momsregistrerad')}</label>
            {form.vatRegistered && <div className="field"><label>{t('Momsregistreringsnummer')}</label><input value={form.vatNumber} onChange={(e) => setForm({ ...form, vatNumber: e.target.value })} placeholder="SE…01" style={{ width: '100%' }} /></div>}
            <label className="checkrow"><input type="checkbox" checked={form.allowPortfolioUse} onChange={(e) => setForm({ ...form, allowPortfolioUse: e.target.checked })} /> {t('VYRLE får visa mina levererade videos i min portfolio och i marknadsföring av tjänsten')}</label>
            <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.55 }}>{t('Du ansvarar själv för skatt på ersättning och på produkter du får i produktbyten. Rättighetspaketet per uppdrag står i kontraktet:')} {Object.values(RIGHTS_LABEL).map((v) => t(v)).join(' · ')}.</div>
            <div style={{ fontSize: 11.5, color: 'var(--muted-2)' }}>{t(RIGHTS_HINT.FullTransfer)}</div>
          </div>
        </div>
      </div>
      <button className="btn-apply" style={{ ...btn, marginTop: 16 }} disabled={upsert.isPending} onClick={save}>{upsert.isPending ? t('Sparar…') : t('Spara profil')}</button>
    </section>
  );
}
