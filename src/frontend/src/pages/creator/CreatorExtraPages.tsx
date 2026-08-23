import { Link, useNavigate } from 'react-router-dom';
import { statusLabel, t } from '@/lib/i18n';
import { useCreatorAssignments, useCreatorProfile, useCreatorPayouts, useSavedCampaigns, useToggleSaveCampaign } from '@/hooks/api';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';
import { AreaChart, Donut, MiniBars, VizDefs, BLUSH } from '@/components/vyrle/Viz';
import { useToast, CardSkeleton } from '@/components/vyrle/Toast';

const GRADS = [
  'linear-gradient(135deg,#FFD8C7,#F1A88F)',
  'linear-gradient(135deg,#cdb8f2,#9c7de0)',
  'linear-gradient(135deg,#F2C58A,#e0a04e)',
  'linear-gradient(135deg,#a9dcc0,#5fb98a)',
];
const grad = (s: string) => GRADS[((s || '').charCodeAt(0) || 0) % GRADS.length];
const initial = (s: string) => (s?.[0] || '?').toUpperCase();

function Arrow() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}

/* ───────────────────────── Analytics ───────────────────────── */
function shortMoney(n: number) {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace('.0', '') + 'K';
  return String(Math.round(n));
}

export function CreatorAnalyticsPage() {
  const { data: res, isLoading } = useCreatorAssignments();
  const { data: profile } = useCreatorProfile();
  const assignments = res?.data ?? [];

  const totalViews = assignments.reduce((s, a) => s + (a.totalVerifiedViews || 0), 0);
  const totalClicks = assignments.reduce((s, a) => s + (a.totalTrackedClicks || 0), 0);
  const totalEarned = assignments.reduce((s, a) => s + (a.currentPayoutAmount || 0), 0);
  const ctr = totalViews ? (totalClicks / totalViews) * 100 : 0;
  const live = assignments.filter((a) => ['Active', 'InProgress', 'Submitted', 'Approved'].includes(a.status)).length;
  const earningPerView = totalViews ? (totalEarned / totalViews) * 1000 : 0; // per 1k views
  const avgViews = assignments.length ? totalViews / assignments.length : 0;

  const ranked = [...assignments].sort((a, b) => (b.totalVerifiedViews || 0) - (a.totalVerifiedViews || 0));
  const maxViews = Math.max(1, ...ranked.map((a) => a.totalVerifiedViews || 0));

  // earnings split by campaign (real)
  const earners = ranked.filter((a) => (a.currentPayoutAmount || 0) > 0).sort((a, b) => b.currentPayoutAmount - a.currentPayoutAmount);
  const earnSegments = earners.slice(0, 8).map((a, i) => ({ value: a.currentPayoutAmount, color: BLUSH[i % BLUSH.length] }));

  // views-by-campaign chart series (oldest → newest by assignedAt so it reads as a trend)
  const byTime = [...assignments].sort((a, b) => +new Date(a.assignedAt) - +new Date(b.assignedAt)).slice(-10);
  const chartVals = byTime.map((a) => a.totalVerifiedViews || 0);
  const chartLabels = byTime.map((a) => a.campaignName);

  return (
    <section className="view active reveal" data-view="analytics">
      <VizDefs />
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('Koll på dina')} <em>{t('siffror')}</em></h1>
          <p className="page-sub">{t('En tydlig bild av räckvidd, resultat och vad som faktiskt betalar sig. Varje siffra är din verifierade, attribuerade prestation — inga uppskattningar.')}</p>
        </div>
      </div>

      {isLoading ? (
        <CardSkeleton rows={4} />
      ) : assignments.length === 0 ? (
        <EmptyCard title={t('Ingen statistik ännu')} sub={t('När du går med i en kampanj och dina videos går live visas din verifierade prestation här — räckvidd, klick och intäkter, samlat på ett ställe.')} cta={t('Upptäck kampanjer')} to="/creator/browse" />
      ) : (
        <>
          <div className="vstat-row">
            <BigStat label={t('Verifierade views')} val={formatNumber(totalViews)} hint={`${t('fördelat på')} ${assignments.length} ${assignments.length === 1 ? t('kampanj') : t('kampanjer')}`} tint="peach" featured />
            <BigStat label={t('Spårade klick')} val={formatNumber(totalClicks)} hint={`${ctr.toFixed(2)}% ${t('klickfrekvens')}`} tint="lilac" />
            <BigStat label={t('Intäkter')} val={formatCurrency(totalEarned)} hint={`${formatCurrency(earningPerView)} / 1K views`} tint="green" money />
            <BigStat label={t('Live-kampanjer')} val={String(live)} hint={`${formatNumber(Math.round(avgViews))} ${t('snittvisningar')}`} tint="amber" />
          </div>

          <div className="vtop">
            <div className="card vperf">
              <div className="vperf-head"><h3>{t('Views per kampanj')}</h3><span className="vchip">{byTime.length} {t('senaste')}</span></div>
              {chartVals.length >= 2 ? (
                <AreaChart id="anViews" values={chartVals} labels={chartLabels} fmtY={shortMoney} height={280} />
              ) : (
                <div style={{ padding: '50px 10px', textAlign: 'center', color: 'var(--muted)' }}>{t('Kör ett par kampanjer så ritar din viewstrend upp sig här.')}</div>
              )}
              <div className="vperf-foot" style={{ flexWrap: 'wrap', gap: '10px 18px' }}>
                <div className="vf-stat"><div className="vf-l">{t('Total räckvidd')}</div><div className="vf-v">{formatNumber(totalViews)}</div></div>
                <div className="vf-stat"><div className="vf-l">{t('Bästa kampanjen')}</div><div className="vf-v">{ranked[0] ? formatNumber(ranked[0].totalVerifiedViews) : '—'}</div></div>
                <div className="vf-stat"><div className="vf-l">{t('Klickfrekvens')}</div><div className="vf-v">{ctr.toFixed(2)}%</div></div>
                <Link className="vperf-link" to="/creator/assignments" style={{ margin: 0 }}>{t('Mina kampanjer')} <Arrow /></Link>
              </div>
            </div>

            <div className="card vrep">
              <div className="vperf-head"><h3>{t('Var du tjänar')}</h3></div>
              {earnSegments.length ? (
                <>
                  <Donut size={170} segments={earnSegments}>
                    <div className="vrep-num" style={{ fontSize: 30 }}>{formatCurrency(totalEarned)}</div>
                    <div className="vrep-lbl" style={{ color: 'var(--muted)', fontWeight: 600 }}>{t('totalt intjänat')}</div>
                  </Donut>
                  <div className="an-legend" style={{ marginTop: 'auto' }}>
                    {earners.slice(0, 4).map((a, i) => (
                      <div className="li" key={a.id}><span className="dotc" style={{ background: BLUSH[i % BLUSH.length] }} />{a.campaignName}<span className="lv">{formatCurrency(a.currentPayoutAmount)}</span></div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ padding: '40px 10px', textAlign: 'center', color: 'var(--muted)' }}>{t('Inga intäkter spårade ännu. När en kampanj betalar ut visas fördelningen här.')}</div>
              )}
              <Link className="vperf-link" to="/creator/earnings" style={{ marginTop: 18 }}>{t('Öppna intäkter')} <Arrow /></Link>
            </div>
          </div>

          <div className="vcsplit" style={{ marginTop: 18 }}>
            <div className="card">
              <div className="vperf-head"><h3>{t('Innehåll som presterar bäst')}</h3></div>
              {ranked.slice(0, 5).map((a) => (
                <div key={a.id} className="vcamp" style={{ cursor: 'default' }}>
                  <span className="vcamp-thumb" style={{ background: grad(a.campaignName) }}><span className="brand-mono">{initial(a.campaignName)}</span></span>
                  <div className="vcamp-main">
                    <div className="vcamp-b">{a.campaignName}</div>
                    <div className="progress-line" style={{ maxWidth: 260, marginTop: 6 }}><span style={{ width: `${Math.round(((a.totalVerifiedViews || 0) / maxViews) * 100)}%` }} /></div>
                  </div>
                  <div className="vcamp-end"><div className="vcamp-k">Views</div><div className="vcamp-v">{formatNumber(a.totalVerifiedViews || 0)}</div></div>
                  <div className="vcamp-end"><div className="vcamp-k">{t('Klick')}</div><div className="vcamp-v">{formatNumber(a.totalTrackedClicks || 0)}</div></div>
                </div>
              ))}
            </div>

            <div className="card">
              <div className="vperf-head"><h3>{t('Räckvidd & monetarisering')}</h3></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '2px 10px', fontSize: 12.5, color: 'var(--muted)', marginBottom: 6 }}><span>{t('Publik')}</span><span>{formatNumber(profile?.followerCount ?? 0)} {t('följare')}</span></div>
                  <MiniBars rows={[
                    { label: t('Klickfrekvens'), pct: Math.min(100, ctr * 8), value: ctr.toFixed(2) + '%' },
                    { label: t('Intäkt / 1K views'), pct: Math.min(100, earningPerView * 2), value: formatCurrency(earningPerView) },
                    { label: t('Snittvisningar'), pct: Math.min(100, (avgViews / maxViews) * 100), value: shortMoney(avgViews) },
                  ]} />
                </div>
                <div style={{ borderTop: '1px solid rgba(241,168,143,.12)', paddingTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14 }}>
                  <div><div className="vcamp-k">{t('Totalt antal klick')}</div><div className="vcamp-v" style={{ fontSize: 18 }}>{formatNumber(totalClicks)}</div></div>
                  <div><div className="vcamp-k">{t('Genomförda kampanjer')}</div><div className="vcamp-v" style={{ fontSize: 18 }}>{assignments.length}</div></div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function BigStat({ label, val, hint, tint, featured, money }: { label: string; val: string; hint?: string; tint: 'peach' | 'lilac' | 'green' | 'amber'; featured?: boolean; money?: boolean }) {
  const ic: Record<string, string> = {
    peach: 'linear-gradient(140deg,#FFE3D3,#FFC2A6)', lilac: 'linear-gradient(140deg,#EDE1FF,#cdb8f2)', green: 'linear-gradient(140deg,#d7f0e0,#a9dcc0)', amber: 'linear-gradient(140deg,#FFE9D2,#F2C58A)',
  };
  const col: Record<string, string> = { peach: '#9c4f31', lilac: '#6a4ea8', green: '#2f7d52', amber: '#9c6b1c' };
  return (
    <div className="card vstat">
      <div className="vstat-ico" style={{ background: ic[tint], color: col[tint] }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M5 20V10M12 20V4M19 20v-6" /></svg>
      </div>
      <div className="vstat-lbl">{label}</div>
      <div className="vstat-val" style={featured || money ? undefined : undefined}>{val}</div>
      {hint && <div className="vstat-sub"><span className="vmut">{hint}</span></div>}
    </div>
  );
}

/* ───────────────────────── Link Tree ───────────────────────── */
export function CreatorLinksPage() {
  const { data: profile } = useCreatorProfile();
  const { data: res } = useCreatorAssignments();
  const assignments = res?.data ?? [];
  const live = assignments.filter((a) => ['Active', 'InProgress', 'Submitted', 'Approved', 'Completed'].includes(a.status));
  const name = profile?.displayName || 'Creator';
  const handle = profile?.tikTokUsername ? '@' + profile.tikTokUsername : '';

  return (
    <section className="view active reveal" data-view="links">
      <div className="page-head">
        <div>
          <h1 className="page-title">Link <em>Tree</em></h1>
          <p className="page-sub">{t('Varje kampanj du kör får en spårad länk. Klicken som visas här är de riktiga, attribuerade klick som räknas mot dina klickbaserade utbetalningar.')}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 20, alignItems: 'start' }}>
        <div className="card" style={{ minWidth: 0 }}>
          <div className="sec-head"><h3>{t('Dina kampanjlänkar')}</h3><span style={{ fontSize: 13, color: 'var(--muted)' }}>{live.length} {t('aktiva')}</span></div>
          {live.length === 0 ? (
            <div style={{ padding: '34px 6px', textAlign: 'center' }}>
              <div style={{ fontWeight: 600 }}>{t('Inga live-länkar ännu')}</div>
              <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 6 }}>{t('Gå med i en kampanj så dyker din spårade länk upp här automatiskt.')}</div>
              <Link to="/creator/browse" className="btn-apply" style={{ width: 'auto', display: 'inline-block', padding: '11px 20px', marginTop: 16 }}>{t('Upptäck kampanjer')}</Link>
            </div>
          ) : live.map((a) => (
            <Link key={a.id} to={`/creator/assignments/${a.id}`} className="lt-link" style={{ textDecoration: 'none' }}>
              <span className="lt-grip"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="9" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="9" cy="18" r="1" /><circle cx="15" cy="6" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="18" r="1" /></svg></span>
              <span className="lt-ic" style={{ background: grad(a.campaignName) }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 17H7a5 5 0 0 1 0-10h2M15 7h2a5 5 0 0 1 0 10h-2M8 12h8" /></svg></span>
              <div className="lt-main"><div className="lt-t">{a.campaignName}</div><div className="lt-u">{statusLabel(a.goalReached ? 'GoalReached' : a.status)} · {t('spårad länk')}</div></div>
              <div className="lt-clicks"><div className="n">{formatNumber(a.totalTrackedClicks || 0)}</div><div className="l">{t('klick')}</div></div>
            </Link>
          ))}
        </div>

        <div className="lt-phone" style={{ maxWidth: '100%' }}>
          <div className="lt-screen">
            <div className="pp">{initial(name)}</div>
            <div className="pn">{name}</div>
            <div className="pb">{handle}</div>
            {live.slice(0, 5).map((a) => <span key={a.id} className="lt-pill">{a.campaignName}</span>)}
            {live.length === 0 && <span className="lt-pill" style={{ opacity: .6 }}>{t('Dina länkar förhandsvisas här')}</span>}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Creator Levels ───────────────────────── */
const TIERS = [
  { name: 'Rising', min: 0 },
  { name: 'Established', min: 5000 },
  { name: 'Pro', min: 25000 },
  { name: 'Elite', min: 100000 },
  { name: 'Icon', min: 500000 },
];

export function CreatorLevelsPage() {
  const { data: profile } = useCreatorProfile();
  const { data: payRes } = useCreatorPayouts();
  const { data: asgRes } = useCreatorAssignments();
  const payouts = payRes?.data ?? [];
  const assignments = asgRes?.data ?? [];

  const lifetimeEarned = payouts.filter((p) => p.status === 'Paid').reduce((s, p) => s + p.amount, 0);
  const completed = assignments.filter((a) => a.status === 'Completed').length;

  let idx = 0;
  for (let i = 0; i < TIERS.length; i++) if (lifetimeEarned >= TIERS[i].min) idx = i;
  const cur = TIERS[idx];
  const next = TIERS[idx + 1];
  const pct = next ? Math.min(100, Math.round(((lifetimeEarned - cur.min) / (next.min - cur.min)) * 100)) : 100;
  const name = profile?.displayName || 'Creator';

  return (
    <section className="view active reveal" data-view="levels">
      <div className="page-head">
        <div>
          <h1 className="page-title">Creator <em>Levels</em></h1>
          <p className="page-sub">{t('Din nivå förtjänas genom riktiga, utbetalda intäkter på plattformen. Fortsätt leverera kampanjer för att klättra på stegen och låsa upp förmåner.')}</p>
        </div>
      </div>

      <div className="lvl-hero" style={{ background: 'linear-gradient(135deg,#1A2230,#0B0F17)' }}>
        <div className="lvl-hero-row">
          <div className="lvl-badge-big">
            <svg viewBox="0 0 24 24" fill="none" stroke="#3a1d12" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="9" r="4" /><path d="M9 13l-1.5 8 4.5-2.5 4.5 2.5L15 13" /></svg>
            <span className="lv-num">{idx + 1}</span>
          </div>
          <div style={{ flex: 1, minWidth: 'min(100%, 240px)' }}>
            <div className="lvl-name">{cur.name}</div>
            <div className="lvl-sub">{name} · {formatCurrency(lifetimeEarned)} {t('utbetalt')} · {completed} {completed === 1 ? t('slutförd kampanj') : t('slutförda kampanjer')}</div>
            <div className="lvl-xpbar"><span style={{ width: `${pct}%` }} /></div>
            <div className="lvl-xp-meta">
              <span>{formatCurrency(lifetimeEarned)}</span>
              <span>{next ? `${formatCurrency(next.min)} ${t('för att nå')} ${next.name}` : t('Högsta nivån nådd')}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="sec-head"><h3>{t('Stegen')}</h3></div>
        <div className="lvl-track" style={{ overflowX: 'auto', padding: '6px 0' }}>
          {TIERS.map((tier, i) => (
            <div key={tier.name} className={`lvl-node${i < idx ? ' done' : ''}${i === idx ? ' now' : ''}`} style={{ flex: '1 0 72px' }}>
              <div className="lvl-dot">{i + 1}</div>
              <div className="lvl-cap">{tier.name}</div>
              <div className="lvl-xpc">{tier.min === 0 ? 'Start' : formatCurrency(tier.min)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="sec-head"><h3>{t('Förmåner')}</h3></div>
        {TIERS.map((tier, i) => (
          <div key={tier.name} className={`perk${i > idx ? ' locked' : ''}`}>
            <span className="perk-ic" style={{ background: grad(tier.name) }}><svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{i > idx ? <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></> : <path d="m5 12 4 4L19 7" />}</svg></span>
            <div><div className="perk-t">{tier.name} {t('nivå')}</div><div className="perk-s">{i <= idx ? t('Upplåst') : `${t('Låses upp vid')} ${formatCurrency(tier.min)} ${t('utbetalt')}`}</div></div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────────── Saved ───────────────────────── */
export function CreatorSavedPage() {
  const { data: saved, isLoading } = useSavedCampaigns();
  const toggleSave = useToggleSaveCampaign();
  const toast = useToast();
  const navigate = useNavigate();

  const items = saved ?? [];

  return (
    <section className="view active reveal" data-view="saved">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('Sparat för')} <em>{t('senare')}</em></h1>
          <p className="page-sub">{t('Kampanjer du bokmärkt. Kom tillbaka när du är redo att ansöka — men vänta inte för länge, platserna fylls.')}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="saved-grid"><CardSkeleton rows={3} /><CardSkeleton rows={3} /><CardSkeleton rows={3} /></div>
      ) : items.length === 0 ? (
        <EmptyCard title={t('Inget sparat ännu')} sub={t('Bläddra bland kampanjerna och tryck på bokmärket på de som fångar ditt öga, så samlas de här.')} cta={t('Hitta kampanjer')} to="/creator/browse" />
      ) : (
        <div className="saved-grid">
          {items.map(({ campaign: c, savedAt }) => {
            if (!c?.id) return null;
            const full = c.spotsLeft <= 0;
            return (
              <div className="camp-card" key={c.id}>
                <div className="ch">
                  <span className="mono" style={{ background: grad(c.name) }}>{initial(c.brandName || c.name)}</span>
                  <div style={{ flex: 1, minWidth: 0, wordBreak: 'break-word' }}><div className="ttl">{c.name}</div><div className="brand">{c.brandName}</div></div>
                  <button className="lt-icbtn" style={{ borderRadius: '50%' }} aria-label={t('Ta bort från sparade')}
                    onClick={() => toggleSave.mutate({ campaignId: c.id, save: false }, { onSuccess: () => toast.push(t('Borttagen från Saved'), 'success') })}
                    disabled={toggleSave.isPending}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#C26A4A" stroke="#C26A4A" strokeWidth="1.5" strokeLinejoin="round"><path d="M7 4h10v16l-5-3-5 3z" /></svg>
                  </button>
                </div>
                <div className="desc">{c.description}</div>
                <div className="tags">
                  <span className="tag g">{c.category}</span><span className="tag">{c.payoutModel}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)' }}>{t('Sparad')} <b style={{ color: 'var(--ink)' }}>{formatDate(savedAt)}</b></span>
                </div>
                <div className="meta-cols">
                  <div className="mc"><div className="k">{t('Ersättning')}</div><div className="v green">{c.payoutSummary}</div></div>
                  <div className="mc"><div className="k">{t('Platser')}</div><div className="v">{c.spotsLeft} / {c.maxCreators}</div></div>
                  <div className="mc"><div className="k">{t('Stänger')}</div><div className="v">{formatDate(c.endDate)}</div></div>
                </div>
                <button className={full ? 'btn-outline' : 'btn-apply'} style={{ width: '100%', marginTop: 'auto' }} disabled={full}
                  onClick={() => navigate('/creator/browse')}>
                  {full ? t('Fullbokad') : t('Ansök via Discover')}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ───────────────────────── shared bits ───────────────────────── */
function EmptyCard({ title, sub, cta, to }: { title: string; sub: string; cta: string; to: string }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '54px 24px' }}>
      <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-.02em' }}>{title}</div>
      <div style={{ color: 'var(--muted)', fontSize: 14, marginTop: 8, maxWidth: 420, marginInline: 'auto' }}>{sub}</div>
      <Link to={to} className="btn-apply" style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 22px', marginTop: 20 }}>{cta} <Arrow /></Link>
    </div>
  );
}
