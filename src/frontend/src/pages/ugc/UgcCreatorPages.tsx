import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { t } from '@/lib/i18n';
import { formatDate, plural } from '@/lib/utils';
import { useToast, CardSkeleton } from '@/components/vyrle/Toast';
import {
  useUgcCreatorProfile, useUpsertUgcCreatorProfile, useUgcPayoutStatus, useStartUgcPayoutOnboarding,
  useUgcCreatorCampaigns, useApplyToUgcCampaign, useUgcMyApplications, useWithdrawUgcApplication, useUgcCollabs,
  formatOre, kronorToOre, oreToKronor, COMPENSATION_LABEL, RIGHTS_LABEL, RIGHTS_HINT, UGC_CATEGORIES, UGC_REGIONS, apiError,
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
    onSuccess: () => { toast.push(t('Ansökan är skickad. Företaget får en notis.'), 'success'); setTarget(null); },
    onError: (e) => toast.push(apiError(e, t('Kunde inte skicka ansökan')), 'error'),
  });

  return (
    <section className="view active reveal">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('Video')}<em>{t('uppdrag')}</em></h1>
          <p className="page-sub">{t('Företag beställer korta UGC-videor till fast pris. Ansök med ditt pris, leverera, få betalt via VYRLE.')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn-outline" style={btn} onClick={() => navigate('/creator/ugc/profile')}>{t('Min UGC-profil')}</button>
          <button className="btn-outline" style={btn} onClick={() => navigate('/creator/ugc/collabs')}>{t('Mina uppdrag')} {needsMe.length > 0 && <span className="vy-badge neg" style={{ marginLeft: 6 }}>{needsMe.length}</span>}</button>
        </div>
      </div>

      {profile && (
        <div className="card" style={{ marginBottom: 16, border: blocked ? '1px solid rgba(212,155,46,.45)' : undefined, background: blocked ? 'linear-gradient(160deg,#fff,#FFF9F0)' : undefined }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 240px', fontSize: 13.5, lineHeight: 1.5 }}>
              {profile.blocker ?? t('Du kan ansöka om betalda uppdrag och produktbyten.')}
            </div>
            <div style={{ display: 'flex', gap: 14, fontSize: 12.5, color: 'var(--muted)', flexWrap: 'wrap' }}>
              <span>{profile.deliveredCount} {t('leveranser')}</span>
              {profile.ratingCount > 0 && <span>★ {profile.averageRating.toFixed(1)}</span>}
              <span>{formatOre(earned)} {t('tjänat')}</span>
            </div>
            {!profile.payoutOnboardingComplete && profile.status !== 'Suspended' && <button className="btn-apply" style={{ ...btn, padding: '9px 16px', fontSize: 12.5 }} onClick={() => navigate('/creator/profile')}>{t('Verifiera dig')}</button>}
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
              <div className="tags" style={{ marginBottom: 10 }}><span className="tag g">{t(RIGHTS_LABEL[c.rightsPackage])}</span><span className="tag">{t(COMPENSATION_LABEL[c.compensation])}</span>{c.slots - c.hiredCount > 0 && <span className="tag">{plural(c.slots - c.hiredCount, t('plats'), t('platser'))}</span>}</div>
              <div style={{ marginTop: 'auto' }}>
                {c.myApplicationStatus ? (
                  c.myCollabId ? <button className="btn-apply" style={{ width: '100%' }} onClick={() => navigate(`/creator/ugc/collabs/${c.myCollabId}`)}>{t('Anlitad — öppna uppdraget')}</button>
                    : <button className="btn-outline" style={{ width: '100%' }} disabled>{c.myApplicationStatus === 'Rejected' ? t('Ansökan antogs inte') : c.myApplicationStatus === 'Withdrawn' ? t('Ansökan återtagen') : `${t('Ansökan skickad')}${c.myBidOre ? ` · ${formatOre(c.myBidOre)}` : ''}`}</button>
                ) : (
                  (c.compensation === 'ProductExchange' ? profile?.canTakeProduct : profile?.canTakePaid) === false
                    ? <button className="btn-outline" style={{ width: '100%' }} onClick={() => { toast.push(profile?.blocker ?? t('Verifiera dig under Inställningar först.'), 'error'); navigate('/creator/profile'); }}>{t('Verifiera dig först')}</button>
                    : <button className="btn-apply" style={{ width: '100%' }} disabled={!profile} onClick={() => openApply(c)}>{t('Ansök')}</button>
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
                <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>{t('Ansök om')} {target.title}</h2>
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
              <button className="btn-apply" style={{ ...btn, flex: 1 }} disabled={apply.isPending || pitch.trim().length < 20} onClick={send}>{apply.isPending ? t('Skickar…') : t('Skicka ansökan')}</button>
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
  const label: Record<string, [string, string]> = { Applied: ['Ansökan skickad', 'pend'], Preselected: ['Favorit hos företaget', 'info'], Hired: ['Anlitad', 'pos'], Rejected: ['Antogs inte', 'neg'], Withdrawn: ['Återtaget', 'neu'] };

  return (
    <section className="view active reveal">
      <div className="page-head"><div><h1 className="page-title">{t('Mina')} <em>{t('ansökningar')}</em></h1><p className="page-sub">{t('Allt du ansökt om. När ett företag anlitar dig dyker uppdraget upp under Mina uppdrag.')}</p></div></div>
      {isLoading ? <CardSkeleton rows={3} /> : apps.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '54px 24px' }}><div style={{ fontSize: 18, fontWeight: 700 }}>{t('Inga ansökningar ännu')}</div><button className="btn-apply" style={{ ...btn, marginTop: 14 }} onClick={() => navigate('/creator/ugc')}>{t('Se öppna beställningar')}</button></div>
      ) : (
        <div className="card">
          {apps.map((a) => (
            <div key={a.id} className="list-row" style={{ gap: 14, flexWrap: 'wrap' }}>
              <div className="row-main" style={{ flex: '1 1 220px', minWidth: 0 }}>
                <div className="t" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{a.campaignTitle}<span className={`vy-badge ${label[a.status]?.[1] ?? 'neu'}`}>{t(label[a.status]?.[0] ?? a.status)}</span></div>
                <div className="s">{a.bidOre > 0 ? `${formatOre(a.bidOre)} / video · ` : ''}{formatDate(a.createdAt)}{a.decisionNote ? ` · ${a.decisionNote}` : ''}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {a.collabId && <button className="btn-apply" style={{ ...btn, padding: '9px 16px', fontSize: 12.5 }} onClick={() => navigate(`/creator/ugc/collabs/${a.collabId}`)}>{t('Öppna uppdraget')}</button>}
                {(a.status === 'Applied' || a.status === 'Preselected') && <button className="view-all" style={{ color: 'var(--red)' }} disabled={withdraw.isPending} onClick={() => withdraw.mutate(a.id, { onSuccess: () => toast.push(t('Ansökan är återtagen'), 'success'), onError: (e) => toast.push(apiError(e, t('Kunde inte återta')), 'error') })}>{t('Ta tillbaka')}</button>}
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
/** Identity + payout verification through Stripe, plus the tax facts. Rendered under Inställningar. */
export function CreatorVerificationCard() {
  const toast = useToast();
  const [params] = useSearchParams();
  const { data: p } = useUgcCreatorProfile();
  const { data: payout, refetch: refetchPayout } = useUgcPayoutStatus(!!p?.hasStripeAccount);
  const upsert = useUpsertUgcCreatorProfile();
  const onboard = useStartUgcPayoutOnboarding();
  const [tax, setTax] = useState<{ hasFTax: boolean; vatRegistered: boolean; vatNumber: string } | null>(null);
  useEffect(() => { if (p && !tax) setTax({ hasFTax: p.hasFTax, vatRegistered: p.vatRegistered, vatNumber: p.vatNumber ?? '' }); }, [p, tax]);
  useEffect(() => {
    if (params.get('onboarding') === 'done') { refetchPayout(); toast.push(t('Välkommen tillbaka — vi kollar din verifiering hos Stripe.'), 'success'); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!p) return null;

  const suspended = p.status === 'Suspended';
  const verified = p.payoutOnboardingComplete;
  const start = () => onboard.mutate(undefined, {
    onSuccess: (r) => { if (r.url) window.location.href = r.url; else toast.push(r.message ?? t('Verifieringen är redan klar'), r.complete ? 'success' : 'error'); },
    onError: (e) => toast.push(apiError(e, t('Kunde inte starta verifieringen')), 'error'),
  });
  const saveTax = () => tax && upsert.mutate(tax as any, { onSuccess: () => toast.push(t('Sparat'), 'success'), onError: (e) => toast.push(apiError(e, t('Kunde inte spara')), 'error') });

  return (
    <div className="card" style={{ maxWidth: 860, marginBottom: 16 }}>
      <div className="sec-head"><h3>{t('Verifiering')}</h3><span className={`vy-badge ${suspended ? 'neg' : verified ? 'pos' : 'pend'}`}>{suspended ? t('Avstängd') : verified ? t('Verifierad') : t('Inte verifierad')}</span></div>
      <p style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink-2)', margin: 0 }}>{t('Verifieringen görs hos Stripe: du styrker din identitet och kopplar bankkontot som betalda videouppdrag betalas ut till. Det tar några minuter och görs bara en gång. Produktbyten kan du ta utan verifiering.')}</p>
      {payout?.message && !verified && <div style={{ fontSize: 12.5, color: '#9c6b1c', marginTop: 8 }}>{payout.message}</div>}
      {!verified && !suspended && <button className="btn-apply" style={{ ...btn, marginTop: 12 }} disabled={onboard.isPending} onClick={start}>{onboard.isPending ? t('Öppnar…') : p.hasStripeAccount ? t('Fortsätt verifieringen') : t('Verifiera dig')}</button>}
      {tax && (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(183,188,200,.25)' }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 8 }}>{t('Skatt')}</div>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
            <label className="checkrow"><input type="checkbox" checked={tax.hasFTax} onChange={(e) => setTax({ ...tax, hasFTax: e.target.checked })} /> {t('Jag är godkänd för F-skatt')}</label>
            <label className="checkrow"><input type="checkbox" checked={tax.vatRegistered} onChange={(e) => setTax({ ...tax, vatRegistered: e.target.checked })} /> {t('Jag är momsregistrerad')}</label>
            {tax.vatRegistered && <div className="field"><label>{t('Momsregistreringsnummer')}</label><input value={tax.vatNumber} onChange={(e) => setTax({ ...tax, vatNumber: e.target.value })} placeholder="SE…01" style={{ width: '100%' }} /></div>}
            <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.55 }}>{t('Du ansvarar själv för skatt på ersättning och på produkter du får i produktbyten.')}</div>
          </div>
          <button className="btn-outline" style={{ ...btn, marginTop: 10, padding: '8px 14px', fontSize: 12.5 }} disabled={upsert.isPending} onClick={saveTax}>{upsert.isPending ? t('Sparar…') : t('Spara')}</button>
        </div>
      )}
    </div>
  );
}

export function UgcCreatorProfilePage() {
  const toast = useToast();
  const { data: p, isLoading } = useUgcCreatorProfile();
  const upsert = useUpsertUgcCreatorProfile();
  const [form, setForm] = useState({ categories: [] as string[], city: '', region: '', sampleVideoUrl: '', hasFTax: false, vatRegistered: false, vatNumber: '', allowPortfolioUse: true });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (p && !loaded) { setForm({ categories: p.categories, city: p.city ?? '', region: p.region ?? '', sampleVideoUrl: p.sampleVideoUrl ?? '', hasFTax: p.hasFTax, vatRegistered: p.vatRegistered, vatNumber: p.vatNumber ?? '', allowPortfolioUse: p.allowPortfolioUse }); setLoaded(true); }
  }, [p, loaded]);

  if (isLoading || !p) return <CardSkeleton rows={4} />;

  // Tax facts are edited under Inställningar — only the matching fields go from here.
  const save = () => upsert.mutate({ categories: form.categories, city: form.city, region: form.region, sampleVideoUrl: form.sampleVideoUrl, allowPortfolioUse: form.allowPortfolioUse } as any, { onSuccess: () => toast.push(t('Sparat'), 'success'), onError: (e) => toast.push(apiError(e, t('Kunde inte spara')), 'error') });

  return (
    <section className="view active reveal">
      <div className="page-head"><div><h1 className="page-title">{t('Min')} <em>{t('UGC-profil')}</em></h1><p className="page-sub">{t('Det företag ser när du ansöker. Verifiering och utbetalning hittar du under Inställningar.')}</p></div></div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 16, alignItems: 'start' }}>
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
            <div className="field"><label>{t('Exempelvideo (länk)')}</label><input value={form.sampleVideoUrl} onChange={(e) => setForm({ ...form, sampleVideoUrl: e.target.value })} placeholder="https://…" style={{ width: '100%' }} /><div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{t('Valfritt. Visas för företaget när du ansöker.')}</div></div>
          </div>
        </div>

        <div className="card">
          <div className="sec-head"><h3>{t('Rättigheter')}</h3></div>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
            <label className="checkrow"><input type="checkbox" checked={form.allowPortfolioUse} onChange={(e) => setForm({ ...form, allowPortfolioUse: e.target.checked })} /> {t('VYRLE får visa mina levererade videor i min portfolio och i marknadsföring av tjänsten')}</label>
            <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.55 }}>{t('Du ansvarar själv för skatt på ersättning och på produkter du får i produktbyten. Rättighetspaketet per uppdrag står i kontraktet:')} {Object.values(RIGHTS_LABEL).map((v) => t(v)).join(' · ')}.</div>
            <div style={{ fontSize: 11.5, color: 'var(--muted-2)' }}>{t(RIGHTS_HINT.FullTransfer)}</div>
          </div>
        </div>
      </div>
      <button className="btn-apply" style={{ ...btn, marginTop: 16 }} disabled={upsert.isPending} onClick={save}>{upsert.isPending ? t('Sparar…') : t('Spara profil')}</button>
    </section>
  );
}
