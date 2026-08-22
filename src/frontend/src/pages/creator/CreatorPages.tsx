import { ChangeEmailCard, ChangePasswordCard } from '@/components/ui/AccountCards';
import { maskSwishNumber, maskBankAccount } from '@/lib/masks';
import { CopyField } from '@/components/ui/CopyButton';
import { t } from '@/lib/i18n';
import { useState } from 'react';
import { RefreshViewsButton } from '@/components/ui/RefreshViewsButton';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { DateInput } from '@/components/ui/DateInput';
import { TagSelector } from '@/components/ui/TagSelector';
import { ChatPanel } from '@/components/ui/ChatPanel';
import { ReviewSection, ReviewList } from '@/components/ui/ReviewSection';
import { ALL_TAGS } from '@/lib/tags';
import {
  useBrowseCampaigns, useCreatorAssignments, useAssignmentDetail, useCampaignDetail,
  useCreatorPayouts, useApplyToCampaign, useSubmitVideo, useMyApplications,
  useCreatorProfile, useUpdateCreatorProfile,
  useTikTokStatus, useTikTokDisconnect,
  useUserReviews,
  useSavedCampaignIds, useToggleSaveCampaign,
  usePayoutMethod, useSetPayoutMethod,
} from '@/hooks/api';
import { useToast, CardSkeleton } from '@/components/vyrle/Toast';
import { PayoutEstimator, PayoutTerms } from '@/components/vyrle/PayoutEstimator';
import { ImagePicker } from '@/components/auth/ImagePicker';
import api from '@/lib/api';
import { Button, Card, DataTable, EmptyState, LoadingSpinner, Pagination, StatCard, StatusBadge, type Column } from '@/components/ui';
import { TikTokEmbed } from '@/components/ui/TikTokEmbed';
import { Donut, VizDefs, BLUSH } from '@/components/vyrle/Viz';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';
import type { AssignmentListItem } from '@/types';

const GRADS = [
  'linear-gradient(135deg,#FFD8C7,#F1A88F)',
  'linear-gradient(135deg,#cdb8f2,#9c7de0)',
  'linear-gradient(135deg,#F2C58A,#e0a04e)',
  'linear-gradient(135deg,#a9dcc0,#5fb98a)',
];
const grad = (s: string) => GRADS[((s || '').charCodeAt(0) || 0) % GRADS.length];
const initial = (s: string) => (s?.[0] || '?').toUpperCase();

function getApiErrorMessage(error: any, fallback: string) {
  const apiError = error?.response?.data?.error;
  const detail = Array.isArray(apiError?.details) ? apiError.details[1] ?? apiError.details[0] : undefined;
  return detail
    ?? apiError?.message
    ?? error?.response?.data?.title
    ?? error?.message
    ?? fallback;
}

// ── TikTok Alert Banner ────────────────────────────────
function TikTokAlertBanner({ compact = false }: { compact?: boolean }) {
  const { data: tikTokStatus, isLoading } = useTikTokStatus();
  const [connecting, setConnecting] = useState(false);
  const toast = useToast();

  if (isLoading || (tikTokStatus?.connected && tikTokStatus?.isOAuth)) return null;

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await api.get<{ url: string }>('/creator/tiktok/auth-url');
      window.location.href = res.data.url;
    } catch {
      setConnecting(false);
      toast.push(t('Kunde inte starta TikTok-anslutning.'), 'error');
    }
  };

  if (compact) {
    return (
      <div className="vy-alert warn" style={{ marginBottom: 16 }}>
        <span className="va-ic" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12V3h4a4 4 0 0 0 4 4" /><path d="M9 12a4 4 0 1 0 4 4V3" /></svg>
        </span>
        <p style={{ flex: 1, margin: 0 }}>
          <b>{t('Anslut ditt TikTok-konto')}</b> {t('för automatisk visningsverifiering — det krävs för att få betalt.')}{' '}
          <Link to="/creator/profile" className="auth-link">{t('Gå till profilen →')}</Link>
        </p>
      </div>
    );
  }

  return (
    <Card className="!border-[hsl(var(--warning)/0.35)] !bg-[hsl(var(--warning)/0.05)]">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="h-11 w-11 rounded-full bg-[hsl(var(--warning)/0.15)] flex items-center justify-center text-[hsl(var(--warning))]" aria-hidden>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12V3h4a4 4 0 0 0 4 4"/><path d="M9 12a4 4 0 1 0 4 4V3"/></svg>
          </div>
          <div>
            <h3 className="text-xl font-bold tracking-tight">{t('Anslut ditt TikTok-konto')}</h3>
            <p className="text-sm text-muted-foreground col-prose">
              {t('Koppla ditt konto för att automatiskt spåra views, engagement och intjäning.')}
            </p>
          </div>
        </div>
        <Button onClick={handleConnect} disabled={connecting} size="sm">
          {connecting ? t('Ansluter…') : t('Anslut TikTok')}
        </Button>
      </div>
    </Card>
  );
}

// ── TikTok Connect Bar (Discover) ──────────────────────
const TIKTOK_GLYPH = 'M16.5 5.5c.9 1 2.1 1.6 3.5 1.7v2.6c-1.3 0-2.6-.4-3.6-1.1v6c0 3-2.4 5.4-5.4 5.4S5.6 17.7 5.6 14.7s2.4-5.4 5.4-5.4c.3 0 .6 0 .9.1v2.8c-.3-.1-.6-.2-.9-.2-1.5 0-2.7 1.2-2.7 2.7s1.2 2.7 2.7 2.7 2.7-1.2 2.7-2.7V2.5h2.8c0 1.1.2 2.1.5 3z';

function TikTokConnectBar() {
  const { data: status, isLoading } = useTikTokStatus();
  const [connecting, setConnecting] = useState(false);
  const toast = useToast();

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await api.get<{ url: string }>('/creator/tiktok/auth-url');
      window.location.href = res.data.url;
    } catch {
      setConnecting(false);
      toast.push(t('Kunde inte starta TikTok-anslutning.'), 'error');
    }
  };

  if (isLoading) return null;
  const connected = status?.connected && status?.isOAuth;

  return (
    <div className="connect-bar">
      <div className="logo" aria-hidden>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d={TIKTOK_GLYPH} /></svg>
      </div>
      {connected ? (
        <>
          <div>
            <h4>{t('TikTok ansluten')} <span className="tt-handle">@{status?.username}</span> <span className="badge green">{t('Verifierad')}</span></h4>
            <p>{t('Profil, statistik och videor synkas automatiskt.')}</p>
          </div>
          <div className="manage">
            <span className="tt-live"><span className="live-dot" />{t('Ansluten via OAuth')}</span>
            <Link to="/creator/profile" className="btn-outline" style={{ textDecoration: 'none' }}>{t('Hantera')}</Link>
          </div>
        </>
      ) : (
        <>
          <div>
            <h4>{t('Anslut ditt TikTok-konto för automatisk tracking och verifierade resultat.')}</h4>
            <p>{t('Säker inloggning med TikTok. VYRLE läser endast din profil, statistik och videor.')}</p>
          </div>
          <div className="manage">
            <button type="button" className="tt-connect-btn" onClick={handleConnect} disabled={connecting}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d={TIKTOK_GLYPH} /></svg>
              {connecting ? t('Ansluter…') : t('Fortsätt med TikTok')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Creator Dashboard ──────────────────────────────────
export function CreatorDashboard() {
  const { data: assignments, isLoading } = useCreatorAssignments();
  const { data: payouts } = useCreatorPayouts();

  if (isLoading) return <LoadingSpinner />;
  const active = assignments?.data.filter((a) => a.status === 'Active') ?? [];
  const totalEarned = (assignments?.data ?? []).reduce((sum, a) => sum + a.currentPayoutAmount, 0);
  const paidOut = payouts?.data.filter((p) => p.status === 'Completed' || p.status === 'Approved' || p.status === 'Processing')
    .reduce((sum, p) => sum + p.amount, 0) ?? 0;
  const totalViews = (assignments?.data ?? []).reduce((sum, a) => sum + a.totalVerifiedViews, 0);

  return (
    <div className="space-y-12">
      {/* Header */}
      <header className="grid grid-cols-12 gap-x-6 items-end">
        <div className="col-span-12 md:col-span-8">
          <p className="eyebrow">{t('Creator Studio · Översikt')}</p>
          <h1 className="mt-3 text-display text-[clamp(2.25rem,5vw,3.75rem)]">
            {t('Din')} <span className="text-sunset">{t('vibe')}</span>,<br />
            {t('i siffror.')}
          </h1>
        </div>
        <div className="col-span-12 md:col-span-4 md:text-right">
          <p className="text-sm text-muted-foreground col-prose md:ml-auto">
            {t('Aktiva uppdrag, verifierade views, och vad som faktiskt landat på kontot.')}
          </p>
        </div>
      </header>

      <TikTokAlertBanner />

      <div className="hairline" />

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-6 md:col-span-3"><StatCard label={t('Aktiva uppdrag')} value={active.length} /></div>
        <div className="col-span-6 md:col-span-3"><StatCard label={t('Verifierade views')} value={formatNumber(totalViews)} /></div>
        <div className="col-span-6 md:col-span-3"><StatCard label={t('Intjänat')} value={formatCurrency(totalEarned)} /></div>
        <div className="col-span-6 md:col-span-3"><StatCard label={t('Skickat till dig')} value={formatCurrency(paidOut)} /></div>
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="px-6 pt-6 pb-2 flex items-baseline justify-between">
          <h2 className="text-2xl font-bold tracking-tight">{t('Aktiva uppdrag')}</h2>
          <span className="eyebrow">{active.length} {t('live')}</span>
        </div>
        <div className="px-2 pb-4">
          {active.length ? (
            <AssignmentTable assignments={active} />
          ) : (
            <EmptyState title={t('Inga aktiva uppdrag')} description={t('Utforska kampanjer och ansök till de som matchar din röst.')} />
          )}
        </div>
      </Card>
    </div>
  );
}

// ── Browse campaigns ───────────────────────────────────
export function BrowseCampaignsPage() {
  const [category] = useState<string>();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error } = useBrowseCampaigns(category, undefined, page);
  const { data: myApps, isError: myAppsError, error: myAppsErrorObj } = useMyApplications();
  const { data: myAssignments } = useCreatorAssignments(undefined, 1);
  const navigate = useNavigate();
  const { data: savedIds } = useSavedCampaignIds();
  const toggleSave = useToggleSaveCampaign();
  const toast = useToast();
  const apply = useApplyToCampaign();
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [calcId, setCalcId] = useState<string | null>(null);

  // Build a map of campaignId -> application status from backend data
  const appStatusMap = new Map<string, string>();
  myApps?.data.forEach((a) => appStatusMap.set(a.campaignId, a.status));
  const assignmentByCampaign = new Map<string, string>();
  myAssignments?.data.forEach((a) => assignmentByCampaign.set(a.campaignId, a.id));
  const savedSet = new Set(savedIds ?? []);

  const goToAssignment = (campaignId: string) => {
    const assignmentId = assignmentByCampaign.get(campaignId);
    navigate(assignmentId ? `/creator/assignments/${assignmentId}` : '/creator/assignments');
  };

  const handleApply = async (campaignId: string) => {
    setApplyingId(campaignId);
    try {
      await apply.mutateAsync({ campaignId, message: t('Jag vill gärna delta i denna kampanj!') });
      toast.push(t('Ansökan skickad!'), 'success');
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message
        ?? err?.response?.data?.title
        ?? t('Kunde inte skicka ansökan');
      toast.push(msg, 'error');
    }
    setApplyingId(null);
  };

  const handleSave = (campaignId: string) => {
    const save = !savedSet.has(campaignId);
    toggleSave.mutate({ campaignId, save }, {
      onSuccess: () => toast.push(save ? t('Sparad i Saved') : t('Borttagen från Saved'), 'success'),
      onError: () => toast.push(t('Kunde inte spara kampanjen'), 'error'),
    });
  };

  const getButtonLabel = (campaignId: string, spotsRemaining: number) => {
    const status = appStatusMap.get(campaignId);
    if (status === 'Approved') return '✓ ' + t('Godkänd — gå till Mina uppdrag');
    if (spotsRemaining <= 0) return t('Fullbokad');
    if (applyingId === campaignId) return t('Skickar…');
    if (status === 'Pending') return '⏳ ' + t('Ansökan skickad — väntar på svar');
    if (status === 'Rejected') return '✗ ' + t('Ansökan nekad');
    return t('Ansök');
  };

  const isDisabled = (campaignId: string, spotsRemaining: number) => {
    // Approved stays clickable — it navigates to the assignment.
    if (appStatusMap.get(campaignId) === 'Approved') return false;
    if (spotsRemaining <= 0 || applyingId === campaignId) return true;
    return appStatusMap.has(campaignId); // already applied in any status
  };

  return (
    <section className="view active reveal">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('Hitta din nästa')} <em>{t('kampanj')}</em></h1>
          <p className="page-sub">{t('Kuraterade kampanjer som matchar din röst, ditt språk och din publik.')}</p>
        </div>
      </div>
      <TikTokConnectBar />
      {isError && (
        <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <div style={{ fontWeight: 700 }}>{t('Kunde inte hämta kampanjer')}</div>
          <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 6 }}>{getApiErrorMessage(error, t('Något gick fel när kampanjer skulle hämtas.'))}</div>
        </div>
      )}
      {myAppsError && (
        <div className="card" style={{ marginTop: 14, borderColor: 'rgba(212,155,46,.4)' }}>
          <p style={{ color: 'var(--amber)', fontSize: 13 }}>{t('Kunde inte hämta dina ansökningar:')} {getApiErrorMessage(myAppsErrorObj, t('okänt fel'))}</p>
        </div>
      )}
      {!isError && (isLoading ? (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 16, display: 'grid' }}>
          <CardSkeleton rows={3} /><CardSkeleton rows={3} /><CardSkeleton rows={3} />
        </div>
      ) : (
        <>
          {data?.data.length ? (
            <>
              <div className="results-meta"><div className="cnt"><span className="live-dot" />{data.totalCount} {data.totalCount === 1 ? t('kampanj tillgänglig') : t('kampanjer tillgängliga')}</div></div>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 16, display: 'grid' }}>
                {data.data.map((c) => {
                  const status = appStatusMap.get(c.id);
                  const full = c.spotsLeft <= 0;
                  const saved = savedSet.has(c.id);
                  return (
                    <div className="camp-card" key={c.id}>
                      <div className="ch">
                        <span className="mono" style={{ background: grad(c.name) }}>{initial(c.brandName || c.name)}</span>
                        <div style={{ flex: 1 }}><div className="ttl">{c.name}</div><div className="brand">{c.brandName}</div></div>
                        <button className="lt-icbtn" style={{ borderRadius: '50%' }} aria-label={saved ? t('Ta bort från sparade') : t('Spara kampanj')} aria-pressed={saved}
                          onClick={() => handleSave(c.id)} disabled={toggleSave.isPending}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill={saved ? '#C26A4A' : 'none'} stroke="#C26A4A" strokeWidth="1.6" strokeLinejoin="round"><path d="M7 4h10v16l-5-3-5 3z" /></svg>
                        </button>
                        {status === 'Approved' ? <span className="badge green">{t('Godkänd')}</span> : status === 'Pending' ? <span className="badge amber">{t('Skickad')}</span> : status === 'Rejected' ? <span className="badge red">{t('Nekad')}</span> : null}
                      </div>
                      <div className="desc">{c.description}</div>
                      <div className="tags">
                        <span className="tag g">{c.category}</span><span className="tag">{c.country}</span><span className="tag">{c.payoutModel}</span>
                      </div>
                      <div className="meta-cols">
                        <div className="mc"><div className="k">{t('Ersättning')}</div><div className="v green">{c.payoutSummary}</div></div>
                        <div className="mc"><div className="k">{t('Platser')}</div><div className="v">{c.spotsLeft} / {c.maxCreators}</div></div>
                        <div className="mc"><div className="k">{t('Period')}</div><div className="v">{formatDate(c.startDate)} – {formatDate(c.endDate)}</div></div>
                      </div>
                      {(c.payoutRules?.length ?? 0) > 0 && (
                        <div style={{ margin: '2px 0 10px' }}>
                          <button type="button" className="view-all" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                            aria-expanded={calcId === c.id}
                            onClick={() => setCalcId(calcId === c.id ? null : c.id)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M8 6h8M8 10h2m2 0h2m2 0h0M8 14h2m2 0h2m2 0h0M8 18h2m2 0h4" /></svg>
                            {calcId === c.id ? t('Dölj kalkylen') : t('Räkna på din ersättning')}
                          </button>
                          {calcId === c.id && (
                            <PayoutEstimator model={c.payoutModel} rules={c.payoutRules!} />
                          )}
                        </div>
                      )}
                      <button className={status === 'Approved' || status === 'Rejected' || status === 'Pending' || full ? 'btn-outline' : 'btn-apply'} style={{ width: '100%', marginTop: 'auto' }}
                        onClick={() => appStatusMap.get(c.id) === 'Approved' ? goToAssignment(c.id) : handleApply(c.id)} disabled={isDisabled(c.id, c.spotsLeft)}>
                        {getButtonLabel(c.id, c.spotsLeft)}
                      </button>
                    </div>
                  );
                })}
              </div>
              <Pagination page={page} totalCount={data.totalCount} pageSize={data.pageSize} onPageChange={setPage} />
            </>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '54px 24px' }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{t('Inga kampanjer tillgängliga')}</div>
              <div style={{ color: 'var(--muted)', fontSize: 14, marginTop: 8 }}>{t('Kom tillbaka senare — nya briefs släpps löpande.')}</div>
            </div>
          )}
        </>
      ))}
    </section>
  );
}

// ── Creator assignments ────────────────────────────────
export function CreatorAssignmentsPage() {
  const [status, setStatus] = useState<string>();
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const { data, isLoading } = useCreatorAssignments(status, page);
  const { data: allAssignments } = useCreatorAssignments(undefined, 1);
  const { data: myApps } = useMyApplications();

  const all = allAssignments?.data ?? [];
  const activeCount = all.filter((a) => ['Active', 'InProgress', 'Submitted', 'Approved'].includes(a.status)).length;
  const totalViews = all.reduce((s, a) => s + (a.totalVerifiedViews || 0), 0);
  const totalEarned = all.reduce((s, a) => s + (a.currentPayoutAmount || 0), 0);
  const pendingApps = (myApps?.data ?? []).filter((a) => a.status === 'Pending');

  const tabs: { label: string; val?: string }[] = [
    { label: t('Alla'), val: undefined }, { label: t('Aktiva'), val: 'Active' }, { label: t('Avslutade'), val: 'Completed' }, { label: t('Pausade'), val: 'Paused' },
  ];

  return (
    <section className="view active reveal">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('Mina')} <em>{t('kampanjer')}</em></h1>
          <p className="page-sub">{t('Det du blivit godkänd till och kör just nu. Verifierade views, klick och intjäning per samarbete.')}</p>
        </div>
      </div>

      <div className="vstat-row">
        <div className="card vstat" style={{ background: 'linear-gradient(160deg,#fff,#FFF6F0)' }}>
          <div className="vstat-ico" style={{ background: 'linear-gradient(140deg,#d7f0e0,#a9dcc0)', color: '#2f7d52' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 7" /></svg></div>
          <div className="vstat-lbl">{t('Godkänd & aktiv')}</div><div className="vstat-val">{activeCount}</div><div className="vstat-sub"><span className="vmut">{t('pågående uppdrag')}</span></div>
        </div>
        <div className="card vstat"><div className="vstat-ico" style={{ background: 'linear-gradient(140deg,#FFE3D3,#FFC2A6)', color: '#9c4f31' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg></div><div className="vstat-lbl">{t('Verifierade views')}</div><div className="vstat-val">{formatNumber(totalViews)}</div><div className="vstat-sub"><span className="vmut">{t('totalt')}</span></div></div>
        <div className="card vstat"><div className="vstat-ico" style={{ background: 'linear-gradient(140deg,#EDE1FF,#cdb8f2)', color: '#6a4ea8' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="9" cy="7" rx="6" ry="3" /><path d="M3 7v5c0 1.7 2.7 3 6 3" /><ellipse cx="15" cy="14" rx="6" ry="3" /></svg></div><div className="vstat-lbl">{t('Intjänat')}</div><div className="vstat-val">{formatCurrency(totalEarned)}</div><div className="vstat-sub"><span className="vmut">{t('över alla kampanjer')}</span></div></div>
        <div className="card vstat"><div className="vstat-ico" style={{ background: 'linear-gradient(140deg,#FFE9D2,#F2C58A)', color: '#9c6b1c' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg></div><div className="vstat-lbl">{t('Väntande ansökningar')}</div><div className="vstat-val">{pendingApps.length}</div><div className="vstat-sub"><span className="vmut">{t('väntar på svar')}</span></div></div>
      </div>

      <div className="tabs">
        {tabs.map((t) => <button key={t.label} className={`tab${status === t.val ? ' active' : ''}`} onClick={() => { setStatus(t.val); setPage(1); }}>{t.label}</button>)}
      </div>
      {isLoading ? <CardSkeleton rows={4} /> : (
        <div className="card">
          {data?.data.length ? (
            <>
              <div className="sec-head"><h3>{data.totalCount} {t('uppdrag')}</h3></div>
              {data.data.map((a) => (
                <div key={a.id} className="vcamp" onClick={() => navigate(`/creator/assignments/${a.id}`)}>
                  <span className="vcamp-thumb" style={{ background: grad(a.campaignName) }}><span className="brand-mono">{initial(a.campaignName)}</span></span>
                  <div className="vcamp-main">
                    <div className="vcamp-b">{a.campaignName}</div>
                    <div className="vcamp-m">{t('Tilldelad')} {formatDate(a.assignedAt)}</div>
                    <StatusBadge status={a.goalReached ? 'GoalReached' : a.status} />
                  </div>
                  <div className="vcamp-end"><div className="vcamp-k">Views</div><div className="vcamp-v">{formatNumber(a.totalVerifiedViews)}</div></div>
                  <div className="vcamp-end"><div className="vcamp-k">{t('Klick')}</div><div className="vcamp-v">{formatNumber(a.totalTrackedClicks)}</div></div>
                  <div className="vcamp-end"><div className="vcamp-k">{t('Intjänat')}</div><div className="vcamp-v">{formatCurrency(a.currentPayoutAmount)}</div></div>
                </div>
              ))}
              <Pagination page={page} totalCount={data.totalCount} pageSize={data.pageSize} onPageChange={setPage} />
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '44px 24px' }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{t('Inga uppdrag än')}</div>
              <div style={{ color: 'var(--muted)', fontSize: 14, marginTop: 8 }}>{t('Ansök till kampanjer för att få ditt första uppdrag.')}</div>
              <Link to="/creator/browse" className="btn-apply" style={{ width: 'auto', display: 'inline-block', padding: '11px 22px', marginTop: 16 }}>{t('Hitta kampanjer')}</Link>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function VideoStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: 13, textAlign: 'center', background: highlight ? 'linear-gradient(140deg,#FFE3D3,#FFD3BC)' : 'rgba(255,244,236,.75)', border: '1px solid rgba(241,168,143,.2)' }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: highlight ? '#9c4f31' : 'var(--muted)' }}>{label}</div>
      <div style={{ fontWeight: 800, fontSize: 16.5, color: '#0B0F17', marginTop: 2 }}>{value}</div>
    </div>
  );
}

// ── TikTok Connection Card ─────────────────────────────
function TikTokConnectionCard() {
  const { data: status, isLoading } = useTikTokStatus();
  const disconnect = useTikTokDisconnect();
  const [connecting, setConnecting] = useState(false);
  const [armDisconnect, setArmDisconnect] = useState(false);
  const toast = useToast();

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await api.get<{ url: string }>('/creator/tiktok/auth-url');
      window.location.href = res.data.url;
    } catch {
      setConnecting(false);
      toast.push(t('Kunde inte starta TikTok-anslutning.'), 'error');
    }
  };

  // Two-step inline confirm: first click arms, second confirms.
  const handleDisconnect = () => {
    if (!armDisconnect) {
      setArmDisconnect(true);
      setTimeout(() => setArmDisconnect(false), 4000);
      return;
    }
    setArmDisconnect(false);
    disconnect.mutate(undefined, {
      onSuccess: () => toast.push('TikTok-kontot bortkopplat', 'success'),
      onError: () => toast.push('Kunde inte koppla bort kontot', 'error'),
    });
  };

  if (isLoading) return <Card><LoadingSpinner /></Card>;

  return (
    <div className="connect-bar" style={{ marginBottom: 16 }}>
      <div className="logo" aria-hidden>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d={TIKTOK_GLYPH} /></svg>
      </div>
      {status?.connected && status?.isOAuth ? (
        <>
          <div>
            <h4>{t('TikTok ansluten')} <span className="tt-handle">@{status.username}</span> <span className="badge green">{t('Verifierad')}</span>{status.followerCount != null && <span style={{ marginLeft: 8, fontSize: 12.5, color: 'var(--muted)' }}>{formatNumber(status.followerCount)} {t('följare')}</span>}</h4>
            <p>{t('Profil, statistik och videor synkas automatiskt.')}{status.lastSyncAt ? ` ${t('Senast synkad')} ${formatDate(status.lastSyncAt)}.` : ''}</p>
          </div>
          <div className="manage">
            <span className="tt-live"><span className="live-dot" />{t('Ansluten via OAuth')}</span>
            <button type="button" className="btn-outline" onClick={handleDisconnect} disabled={disconnect.isPending} style={armDisconnect ? { borderColor: 'var(--red)', color: 'var(--red)', fontWeight: 600 } : undefined}>
              {disconnect.isPending ? t('Kopplar bort…') : armDisconnect ? t('Säker? Klicka igen') : t('Koppla bort')}
            </button>
          </div>
        </>
      ) : (
        <>
          <div>
            <h4>{status?.connected
              ? <>{t('TikTok ej verifierat')} <span className="tt-handle">@{status.username}</span> <span className="badge amber">{t('Manuellt tillagd')}</span></>
              : t('Anslut ditt TikTok-konto för automatisk tracking och verifierade resultat.')}</h4>
            <p>{t('Säker inloggning med TikTok. VYRLE läser endast din profil, statistik och videor.')}</p>
          </div>
          <div className="manage">
            <button type="button" className="tt-connect-btn" onClick={handleConnect} disabled={connecting}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d={TIKTOK_GLYPH} /></svg>
              {connecting ? t('Ansluter…') : t('Fortsätt med TikTok')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function AssignmentTable({ assignments, onRowClick }: { assignments: AssignmentListItem[]; onRowClick?: (a: AssignmentListItem) => void }) {
  const columns: Column<AssignmentListItem>[] = [
    { header: t('Kampanj'), accessor: 'campaignName' },
    { header: 'Status', accessor: (a) => <StatusBadge status={a.goalReached ? 'GoalReached' : a.status} /> },
    { header: 'Views', accessor: (a) => formatNumber(a.totalVerifiedViews) },
    { header: t('Klick'), accessor: (a) => formatNumber(a.totalTrackedClicks) },
    { header: t('Intjänat'), accessor: (a) => formatCurrency(a.currentPayoutAmount) },
    { header: t('Tilldelad'), accessor: (a) => formatDate(a.assignedAt) },
  ];
  return <DataTable columns={columns} data={assignments} onRowClick={onRowClick} />;
}

// ── Assignment detail ──────────────────────────────────
export function AssignmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: assignment, isLoading } = useAssignmentDetail(id!);
  const { data: campaign } = useCampaignDetail(assignment?.campaignId ?? '');
  const submitVideo = useSubmitVideo();
  const [videoUrl, setVideoUrl] = useState('');
  const [submitError, setSubmitError] = useState('');

  if (isLoading || !assignment) return <LoadingSpinner />;

  const cpmRule = campaign?.payoutRules?.[0];
  const payoutDesc = campaign ? (
    campaign.payoutModel === 'CPM' ? `${cpmRule?.amount ?? 0} ${t('kr / 1 000 views')}`
    : campaign.payoutModel === 'Tiered' ? t('Trappsteg per views')
    : `${cpmRule?.amount ?? 0} ${t('kr vid')} ${formatNumber(cpmRule?.minViews ?? 0)}+ views`
  ) : '—';
  const daysLeft = campaign?.endDate ? Math.ceil((+new Date(campaign.endDate) - Date.now()) / 86400000) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    try {
      await submitVideo.mutateAsync({ assignmentId: assignment.id, videoUrl });
      setVideoUrl('');
    } catch (err: any) {
      setSubmitError(err?.response?.data?.error?.message ?? t('Videon kunde inte läggas till — kontrollera länken och försök igen.'));
    }
  };

  return (
    <section className="view active reveal">
      <button onClick={() => navigate('/creator/assignments')} className="view-all" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg> {t('Mina kampanjer')}
      </button>
      <div className="page-head">
        <div>
          <h1 className="page-title">{assignment.campaignName}</h1>
          <div style={{ marginTop: 10 }}><StatusBadge status={assignment.status} /></div>
        </div>
      </div>

      <div className="stat-row">
        <div className="card stat"><div className="top"><div className="ico soft"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg></div><div><div className="lbl">{t('Verifierade views')}</div><div className="val">{formatNumber(assignment.totalVerifiedViews)}</div></div></div></div>
        <div className="card stat"><div className="top"><div className="ico soft"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="9" cy="7" rx="6" ry="3" /><path d="M3 7v5c0 1.7 2.7 3 6 3" /><ellipse cx="15" cy="14" rx="6" ry="3" /></svg></div><div><div className="lbl">{t('Estimerad ersättning')}</div><div className="val">{formatCurrency(assignment.currentPayoutAmount)}</div></div></div></div>
        <div className="card stat"><div className="top"><div className="ico soft"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" /></svg></div><div><div className="lbl">{t('Ersättningsmodell')}</div><div className="val" style={{ fontSize: 18 }}>{payoutDesc}</div></div></div></div>
        <div className="card stat"><div className="top"><div className="ico amber"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg></div><div><div className="lbl">{daysLeft != null && daysLeft >= 0 ? t('Slutar om') : t('Slutdatum')}</div><div className="val" style={{ fontSize: 20 }}>{daysLeft != null && daysLeft >= 0 ? `${daysLeft} ${t('dgr')}` : campaign?.endDate ? formatDate(campaign.endDate) : '—'}</div></div></div></div>
      </div>

      {campaign && (campaign.requirements?.length > 0 || campaign.contentInstructions || campaign.perks) && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="sec-head"><h3>{t('Kampanjkrav & brief')}</h3><span style={{ fontSize: 13, color: 'var(--muted)' }}>{campaign.category} · {formatDate(campaign.startDate)} – {formatDate(campaign.endDate)}</span></div>
          {campaign.contentInstructions && <p style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: 14 }}>{campaign.contentInstructions}</p>}
          {campaign.requirements?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {campaign.requirements.map((r, i) => (
                <div key={i} className="vrep-row" style={{ fontSize: 13 }}>
                  <span className="vrep-ck"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 7" /></svg></span>
                  {r.value || r.requirementType}{r.isRequired && <span className="badge green" style={{ marginLeft: 8 }}>{t('Krav')}</span>}
                </div>
              ))}
            </div>
          )}
          {campaign.perks && (
            <div style={{ marginTop: 14, padding: 14, borderRadius: 14, background: 'linear-gradient(135deg,rgba(255,216,199,.5),rgba(237,225,255,.4))', fontSize: 13 }}>
              <b style={{ color: '#9c4f31' }}>{t('Förmåner:')}</b> {campaign.perks}
            </div>
          )}
          {(campaign.payoutRules?.length ?? 0) > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>{t('Ersättningsvillkor')}</div>
              <PayoutTerms rules={campaign.payoutRules} minViews={campaign.minViews} />
            </div>
          )}
        </div>
      )}

      {assignment.goalReached && (
        <div className="card" style={{ marginBottom: 16, background: 'linear-gradient(160deg,#f2fbf5,#e2f5e9)', border: '1px solid rgba(95,185,138,.4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 22 }} aria-hidden>🎉</span>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#2f7d52' }}>{t('Mål uppnått — maxersättningen är säkrad!')}</div>
              <div style={{ fontSize: 13, color: '#3d6b52', marginTop: 3 }}>{t('Du har tjänat')} {formatCurrency(assignment.currentPayoutAmount)} · {t('Du behöver inte göra något mer — ersättningen kan begäras ut under Intäkter när kampanjen avslutas.')}</div>
            </div>
            <StatusBadge status="GoalReached" />
          </div>
        </div>
      )}

      {assignment.trackingTag && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="sec-head"><h3>{t('Så här funkar det')}</h3></div>
          <p style={{ margin: '0 0 14px', fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.55 }}>
            {t('Kopiera med ett tryck och klistra in i din videobeskrivning på TikTok — så hittar vi videon automatiskt.')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {assignment.trackingTag.recommendedHashtag && (
              <CopyField icon="#" label={t('Kampanjens hashtag')} value={assignment.trackingTag.recommendedHashtag} />
            )}
            <CopyField icon="✦" label={t('Din unika tracking-tag (utan #)')} value={assignment.trackingTag.tagCode}
              hint={t('Skriv den som vanlig text — sätt inget # framför.')} />
            <CopyField icon="✎" label={t('Färdig videobeskrivning (exempel)')}
              value={`${t('Min recension av produkten!')} ${assignment.trackingTag.recommendedHashtag ?? ''} ${assignment.trackingTag.tagCode}`.replace(/\s+/g, ' ').trim()} />
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'flex-start', padding: '11px 14px', borderRadius: 13, background: 'rgba(169,220,192,.22)', border: '1px solid rgba(95,185,138,.35)' }}>
            <span style={{ fontSize: 15, lineHeight: 1 }} aria-hidden>🤖</span>
            <p style={{ margin: 0, fontSize: 12.5, color: '#2f7d52', lineHeight: 1.55 }}>
              <strong>{t('Automatisk tracking:')}</strong> {t('Vi scannar regelbundet efter nya videos. När din video hittas dyker den upp nedan av sig själv — publicera och luta dig tillbaka.')}
            </p>
          </div>
        </div>
      )}

      {assignment.status === 'Active' && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="sec-head"><h3>{t('Lägg till video')}</h3></div>
          <p style={{ margin: '0 0 8px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.55 }}>
            {t('Videos med din tracking-tag hittas automatiskt — klistra in länken här om du vill lägga till din video direkt.')}
          </p>
          <p style={{ margin: '0 0 12px', fontSize: 12.5, color: '#2f7d52', lineHeight: 1.55, fontWeight: 600 }}>
            💡 {t('Lägger du till videon via länk behöver du inte skriva koderna i beskrivningen — videon kopplas direkt till kampanjen och verifieras när företaget godkänner den.')}
          </p>
          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 10 }}>
            <input type="url" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder={t('https://www.tiktok.com/@ditt-namn/video/123...')} required
              style={{ flex: 1, border: '1px solid rgba(241,168,143,.22)', borderRadius: 13, padding: '12px 14px', fontSize: 13.5, fontFamily: 'inherit', background: 'rgba(255,255,255,.7)' }} />
            <button type="submit" className="btn-apply" style={{ width: 'auto', padding: '12px 22px' }} disabled={submitVideo.isPending}>{submitVideo.isPending ? t('Skickar…') : t('Lägg till')}</button>
          </form>
          {submitError && (
            <p style={{ margin: '10px 0 0', fontSize: 13, fontWeight: 600, color: '#cf4b4b', lineHeight: 1.5 }}>⚠ {submitError}</p>
          )}
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="sec-head"><h3>{t('Spårade videos')}</h3><RefreshViewsButton assignmentId={assignment.id} /></div>
        {(assignment.socialPosts?.length > 0) ? (
          <div style={{ display: 'grid', gap: 14 }}>
            {assignment.socialPosts.map((sp) => (
              <div key={sp.id} style={{ border: '1px solid rgba(241,168,143,.22)', borderRadius: 18, padding: 16, background: 'linear-gradient(160deg,#fff,#FFF9F5)', boxShadow: '0 8px 24px rgba(180,120,90,.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                  <StatusBadge status={sp.status} />
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{t('Hittad')} {formatDate(sp.discoveredAt)}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(105px, 1fr))', gap: 8, marginBottom: 14 }}>
                  <VideoStat label="Views" value={formatNumber(sp.views)} highlight />
                  <VideoStat label={t('Gilla')} value={formatNumber(sp.likes)} />
                  <VideoStat label={t('Kommentarer')} value={formatNumber(sp.comments)} />
                  <VideoStat label={t('Delningar')} value={formatNumber(sp.shares)} />
                </div>
                <TikTokEmbed videoUrl={sp.tikTokUrl} videoId={sp.tikTokVideoId} compact />
              </div>
            ))}
          </div>
        ) : assignment.submissions.length ? (
          <div style={{ display: 'grid', gap: 10 }}>
            {assignment.submissions.map((s) => (
              <div key={s.id} style={{ border: '1px solid rgba(241,168,143,.22)', borderRadius: 14, padding: '12px 14px', background: 'rgba(255,255,255,.6)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <a href={s.tikTokVideoUrl} target="_blank" rel="noopener noreferrer" style={{ flex: 1, minWidth: 160, fontSize: 13, fontWeight: 600, color: '#9c4f31', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'none' }}>{s.tikTokVideoUrl}</a>
                  <StatusBadge status={s.status} />
                  <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{formatDate(s.createdAt)}</span>
                </div>
                {s.status === 'Approved' && (
                  <p style={{ margin: '8px 0 0', fontSize: 12.5, fontWeight: 600, color: '#2f7d52' }}>✓ {t('Godkänd av varumärket')}</p>
                )}
                {s.status === 'Rejected' && (
                  <p style={{ margin: '8px 0 0', fontSize: 12.5, fontWeight: 600, color: '#cf4b4b' }}>✗ {t('Nekad')}{s.rejectionReason ? `: ${s.rejectionReason}` : ''}</p>
                )}
              </div>
            ))}
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)' }}>⏳ {t('Väntar på att systemet ska hämta videodata…')}</p>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '34px 24px', color: 'var(--muted)' }}>{t('Inga videos ännu. Publicera en TikTok-video med din tracking-tag så hittas den automatiskt, eller skicka in manuellt ovan.')}</div>
        )}
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="sec-head"><h3>{t('Meddelanden')}</h3></div>
        <ChatPanel assignmentId={assignment.id} />
      </div>

      <div className="card">
        <div className="sec-head"><h3>{t('Omdöme')}</h3></div>
        <ReviewSection assignmentId={assignment.id} revieweeUserId={assignment.brandUserId} assignmentCompleted={assignment.status === 'Completed'} />
      </div>
    </section>
  );
}

// ── Earnings page ──────────────────────────────────────
export function EarningsPage() {
  const [page, setPage] = useState(1);
  const { data: assignments } = useCreatorAssignments(undefined, 1);
  const { data, isLoading } = useCreatorPayouts(undefined, page);

  if (isLoading) return <LoadingSpinner />;
  const payouts = data?.data ?? [];
  const totalAccrued = (assignments?.data ?? []).reduce((sum, a) => sum + a.currentPayoutAmount, 0);

  const pendingList = payouts.filter((p) => p.status === 'Pending');
  const approvedList = payouts.filter((p) => p.status === 'Approved' || p.status === 'Processing');
  const paidList = payouts.filter((p) => p.status === 'Completed');

  const pending = pendingList.reduce((s, p) => s + p.amount, 0);
  const approved = approvedList.reduce((s, p) => s + p.amount, 0);
  const paid = paidList.reduce((s, p) => s + p.amount, 0);
  const lifetime = Math.max(totalAccrued, paid + approved + pending);

  const donutSegs = [
    { value: paid, color: BLUSH[2] },
    { value: approved, color: BLUSH[0] },
    { value: pending, color: BLUSH[3] },
  ].filter((s) => s.value > 0);

  // top earning brands (real, from paid+approved)
  const byCampaign = new Map<string, number>();
  payouts.forEach((p) => byCampaign.set(p.campaignName, (byCampaign.get(p.campaignName) ?? 0) + p.amount));
  const topBrands = [...byCampaign.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const maxBrand = Math.max(1, ...topBrands.map((b) => b[1]));

  return (
    <section className="view active reveal" data-view="earnings">
      <VizDefs />
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('Följ dina')} <em>{t('intäkter')}</em></h1>
          <p className="page-sub">{t('Väntande, godkänt och utbetalt — exakt var varje krona står. Hämtat direkt från dina verifierade utbetalningar, inget estimerat.')}</p>
        </div>
      </div>

      {/* ── the three states that matter ── */}
      <div className="vstat-row" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>
        <PayoutState tone="amber" label={t('Väntande')} amount={pending} count={pendingList.length} sub={t('väntar på varumärkets godkännande')}
          icon={<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>} />
        <PayoutState tone="lilac" label={t('Godkänt')} amount={approved} count={approvedList.length} sub={t('klart, på väg')}
          icon={<path d="m5 12 4 4L19 7" />} />
        <PayoutState tone="green" label={t('Utbetalt')} amount={paid} count={paidList.length} sub={t('har landat på ditt konto')} featured
          icon={<><ellipse cx="9" cy="7" rx="6" ry="3" /><path d="M3 7v5c0 1.7 2.7 3 6 3M3 12v5c0 1.7 2.7 3 6 3" /><ellipse cx="15" cy="14" rx="6" ry="3" /></>} />
      </div>

      <div className="vtop">
        {/* overview + breakdown */}
        <div className="card vperf">
          <div className="vperf-head"><h3>{t('Intäktsöversikt')}</h3><span className="vchip">{payouts.length} {payouts.length === 1 ? t('utbetalning') : t('utbetalningar')}</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
            {donutSegs.length ? (
              <Donut size={150} segments={donutSegs}>
                <div className="vrep-num" style={{ fontSize: 26 }}>{formatCurrency(lifetime)}</div>
                <div className="vrep-lbl" style={{ color: 'var(--muted)', fontWeight: 600 }}>{t('totalt genom tiderna')}</div>
              </Donut>
            ) : (
              <div style={{ width: 150, height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13, textAlign: 'center' }}>{t('Inga utbetalningar ännu')}</div>
            )}
            <div className="an-legend" style={{ flex: 1, minWidth: 200 }}>
              <div className="li"><span className="dotc" style={{ background: BLUSH[2] }} />{t('Utbetalt')}<span className="lv">{formatCurrency(paid)}</span></div>
              <div className="li"><span className="dotc" style={{ background: BLUSH[0] }} />{t('Godkänt')}<span className="lv">{formatCurrency(approved)}</span></div>
              <div className="li"><span className="dotc" style={{ background: BLUSH[3] }} />{t('Väntande')}<span className="lv">{formatCurrency(pending)}</span></div>
              {totalAccrued > paid + approved + pending && (
                <div className="li"><span className="dotc" style={{ background: BLUSH[7] }} />{t('Upplupet')}<span className="lv">{formatCurrency(totalAccrued - paid - approved - pending)}</span></div>
              )}
            </div>
          </div>
          <div className="vperf-foot">
            <div className="vf-stat"><div className="vf-l">{t('Totalt intjänat')}</div><div className="vf-v">{formatCurrency(lifetime)}</div></div>
            <div className="vf-stat"><div className="vf-l">{t('Snitt / utbetalning')}</div><div className="vf-v">{formatCurrency(payouts.length ? (paid + approved + pending) / payouts.length : 0)}</div></div>
            <div className="vf-stat"><div className="vf-l">{t('Andel utbetalt')}</div><div className="vf-v">{payouts.length ? Math.round((paidList.length / payouts.length) * 100) : 0}%</div></div>
          </div>
        </div>

        {/* top earning brands */}
        <div className="card vrep">
          <div className="vperf-head"><h3>{t('Varumärken du tjänar mest på')}</h3></div>
          {topBrands.length ? (
            <div style={{ marginTop: 6 }}>
              {topBrands.map(([name, amt]) => (
                <div className="minibar" key={name}><span className="nm" style={{ width: 110, flex: '0 0 110px' }}>{name}</span><span className="track"><span style={{ width: `${Math.round((amt / maxBrand) * 100)}%` }} /></span><span className="pct">{formatCurrency(amt)}</span></div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '30px 6px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>{t('Dina bäst betalande partners visas här.')}</div>
          )}
          <div className="vrep-rows" style={{ marginTop: 'auto' }}>
            <div className="vrep-row"><span className="vrep-ck"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg></span>{t('Upplupet (ej begärt)')}<b>{formatCurrency(Math.max(0, totalAccrued - paid - approved - pending))}</b></div>
          </div>
        </div>
      </div>

      {/* payout method */}
      <div style={{ marginTop: 18 }}><PayoutMethodCard /></div>

      {/* how payouts work */}
      <div className="card" style={{ marginTop: 18 }}>
        <div className="sec-head"><h3>{t('Så får du betalt')}</h3><span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{t('Från visning till pengar på kontot')}</span></div>
        <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 12 }}>
          {[
            [t('1. Posta & verifiera'), t('Du postar med kampanjens hashtag — dina visningar verifieras automatiskt via TikTok.')],
            [t('2. Ersättning räknas'), t('Varje natt räknas din intjäning om enligt kampanjens villkor (t.ex. kr per 1 000 visningar).')],
            [t('3. Begär utbetalning'), t('När beloppet är verifierat begär du utbetalning med ett klick härifrån.')],
            [t('4. Pengar på kontot'), t('Utbetalningen går till din valda metod ovan — Swish, bank eller PayPal.')],
          ].map(([t, d], i) => (
            <div key={t} className="vy-alert info" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
              <div className="va-ic" aria-hidden="true" style={{ fontWeight: 800, fontSize: 14 }}>{i + 1}</div>
              <div><b>{(t as string).slice(3)}</b><div style={{ marginTop: 3, fontSize: 12, lineHeight: 1.5 }}>{d}</div></div>
            </div>
          ))}
        </div>
      </div>

      {/* pending detail */}
      {pendingList.length > 0 && (
        <div className="card" style={{ marginTop: 18 }}>
          <div className="sec-head"><h3>{t('Väntande utbetalningar')} <span className="badge amber">{pendingList.length}</span></h3></div>
          {pendingList.map((p) => <PayoutRow key={p.id} p={p} />)}
        </div>
      )}

      {/* all payouts */}
      <div className="card" style={{ marginTop: 18 }}>
        <div className="sec-head"><h3>{t('Utbetalningshistorik')}</h3></div>
        {payouts.length ? payouts.map((p) => <PayoutRow key={p.id} p={p} />) : (
          <div style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--muted)' }}>{t('Inga utbetalningar ännu. När en kampanj betalar ut dyker den upp här.')}</div>
        )}
        {data && <Pagination page={page} totalCount={data.totalCount} pageSize={data.pageSize} onPageChange={setPage} />}
      </div>
    </section>
  );
}

const METHOD_META: Record<string, { label: string; hint: string; placeholder: string; icon: React.ReactNode }> = {
  BankTransfer: {
    label: t('Bankkonto'), hint: t('Clearing + kontonummer'), placeholder: 'XXXX-X XXX XXX XXX-X',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10h16M5 10 12 5l7 5M6 10v7M10 10v7M14 10v7M18 10v7M4 20h16" /></svg>,
  },
  Swish: {
    label: 'Swish', hint: t('Mobilnummer kopplat till Swish'), placeholder: '070-123 45 67',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="7" y="2" width="10" height="20" rx="2.5" /><path d="M11 18h2" /></svg>,
  },
  PayPal: {
    label: 'PayPal', hint: t('E-postadress för ditt PayPal-konto'), placeholder: t('du@exempel.se'),
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M7 18 9 6h5a3 3 0 0 1 0 6h-3l-.8 6z" /><path d="M10 9h4a2.5 2.5 0 0 1 0 5h-2.5" /></svg>,
  },
};

function PayoutMethodCard() {
  const { data: pm, isLoading } = usePayoutMethod();
  const setMethod = useSetPayoutMethod();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [method, setMethodType] = useState('BankTransfer');
  const [details, setDetails] = useState('');
  const [holder, setHolder] = useState('');

  const startEdit = () => { setMethodType(pm?.method || 'BankTransfer'); setDetails(''); setHolder(pm?.accountHolder || ''); setEditing(true); };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setMethod.mutateAsync({ method, details: details.trim(), accountHolder: holder.trim() || undefined });
      toast.push(t('Utbetalningsmetod sparad'), 'success');
      setEditing(false);
      setDetails('');
    } catch (err: any) {
      toast.push(err?.response?.data?.error?.message ?? t('Kunde inte spara utbetalningsmetoden'), 'error');
    }
  };

  if (isLoading) return <CardSkeleton rows={1} />;
  const meta = METHOD_META[method] ?? METHOD_META.BankTransfer;
  const activeMeta = pm?.method ? (METHOD_META[pm.method] ?? METHOD_META.BankTransfer) : null;

  return (
    <div className="card" style={!pm?.isConfigured && !editing ? { border: '1px solid rgba(212,155,46,.35)' } : undefined}>
      <div className="sec-head">
        <h3>{t('Utbetalningsmetod')}</h3>
        {pm?.isConfigured && !editing && <button className="view-all" onClick={startEdit}>{t('Ändra')}</button>}
      </div>

      {!editing && pm?.isConfigured && activeMeta && (
        <div className="list-row" style={{ borderTop: 'none', paddingTop: 0 }}>
          <span className="mono sq" style={{ background: 'linear-gradient(140deg,#FFE3D3,#FFC2A6)', color: '#9c4f31' }}>{activeMeta.icon}</span>
          <div className="row-main" style={{ flex: 1 }}>
            <div className="t">{activeMeta.label}</div>
            <div className="s">{pm.maskedDetails}{pm.accountHolder ? ` · ${pm.accountHolder}` : ''}</div>
          </div>
          <span className="badge green">{t('Aktiv')}</span>
        </div>
      )}

      {!editing && !pm?.isConfigured && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{t('Lägg till hur du vill få betalt')}</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4 }}>{t('Bankkonto, Swish eller PayPal. Detaljerna krypteras och visas aldrig i klartext.')}</div>
          </div>
          <button className="btn-apply" style={{ width: 'auto', padding: '11px 20px' }} onClick={startEdit}>{t('Lägg till metod')}</button>
        </div>
      )}

      {editing && (
        <form onSubmit={save}>
          <div className="auth-role" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', marginBottom: 16 }} role="group" aria-label={t('Metod')}>
            {Object.entries(METHOD_META).map(([key, m]) => (
              <button key={key} type="button" aria-pressed={method === key} className={method === key ? 'on' : ''} onClick={() => { setMethodType(key); setDetails(''); }}>{m.label}</button>
            ))}
          </div>
          <div className="form-grid">
            <div className="field"><label htmlFor="pm-details">{meta.hint} *</label><input id="pm-details" value={details} inputMode={method === 'PayPal' ? 'email' : 'numeric'} onChange={(e) => setDetails(method === 'Swish' ? maskSwishNumber(e.target.value) : method === 'BankTransfer' ? maskBankAccount(e.target.value) : e.target.value)} required minLength={4} maxLength={200} placeholder={meta.placeholder} autoComplete="off" /></div>
            <div className="field"><label htmlFor="pm-holder">{t('Kontoinnehavare')}</label><input id="pm-holder" value={holder} onChange={(e) => setHolder(e.target.value)} placeholder={t('För- och efternamn')} /></div>
            <div className="field full" style={{ flexDirection: 'row', gap: 10 }}>
              <button type="submit" className="btn-apply" style={{ width: 'auto', padding: '12px 22px' }} disabled={setMethod.isPending}>{setMethod.isPending ? t('Sparar…') : t('Spara metod')}</button>
              <button type="button" className="btn-outline" onClick={() => setEditing(false)}>{t('Avbryt')}</button>
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--muted-2)', marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
            {t('Krypteras med AES-256 innan lagring. Används vid dina utbetalningar.')}
          </div>
        </form>
      )}
    </div>
  );
}

function PayoutState({ tone, label, amount, count, sub, icon, featured }: { tone: 'amber' | 'lilac' | 'green'; label: string; amount: number; count: number; sub: string; icon: React.ReactNode; featured?: boolean }) {
  const ic = { amber: 'linear-gradient(140deg,#FFE9D2,#F2C58A)', lilac: 'linear-gradient(140deg,#EDE1FF,#cdb8f2)', green: 'linear-gradient(140deg,#d7f0e0,#a9dcc0)' };
  const col = { amber: '#9c6b1c', lilac: '#6a4ea8', green: '#2f7d52' };
  return (
    <div className="card vstat" style={featured ? { background: 'linear-gradient(160deg,#fff,#FFF6F0)' } : undefined}>
      <div className="vstat-ico" style={{ background: ic[tone], color: col[tone] }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
      </div>
      <div className="vstat-lbl">{label}</div>
      <div className="vstat-val">{formatCurrency(amount)}</div>
      <div className="vstat-sub"><span className="vmut">{count} {count === 1 ? t('utbetalning') : t('utbetalningar')} · {sub}</span></div>
    </div>
  );
}

function PayoutRow({ p }: { p: import('@/types').PayoutRequest }) {
  return (
    <div className="list-row">
      <span className="mono sq" style={{ background: grad(p.campaignName) }}>{initial(p.campaignName)}</span>
      <div className="row-main" style={{ flex: 1 }}>
        <div className="t">{p.campaignName}</div>
        <div className="s">{t('Loggad')} {formatDate(p.createdAt)}{p.paidAt ? ` · ${t('utbetald')} ${formatDate(p.paidAt)}` : ''}{p.payoutMethod ? ` · ${METHOD_META[p.payoutMethod]?.label ?? p.payoutMethod}` : ''}</div>
      </div>
      <StatusBadge status={p.status} />
      <div style={{ textAlign: 'right', minWidth: 96 }}><div className="t">{formatCurrency(p.amount)}</div></div>
    </div>
  );
}

// ── Creator Profile ────────────────────────────────────
export function CreatorProfilePage() {
  const { data: profile, isLoading, isError, error } = useCreatorProfile();
  const { data: tikTokStatus } = useTikTokStatus();
  const update = useUpdateCreatorProfile();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    displayName: '', bio: '', category: 'Övrigt', country: 'SE', language: 'sv',
    tikTokUsername: '', dateOfBirth: '', profileTags: [] as string[],
    instagramUsername: '', instagramFollowerCount: '', website: '',
    avatarUrl: '', followerCount: '', averageViews: '', openToPrOffers: true,
  });
  const [saved, setSaved] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Sync form when profile loads
  if (profile && !initialized) {
    setForm({
      displayName: profile.displayName,
      bio: profile.bio ?? '',
      category: profile.category,
      country: profile.country,
      language: profile.language,
      tikTokUsername: profile.tikTokUsername ?? '',
      dateOfBirth: '',
      profileTags: profile.profileTags ?? [],
      instagramUsername: profile.instagramUsername ?? '',
      instagramFollowerCount: profile.instagramFollowerCount ? String(profile.instagramFollowerCount) : '',
      website: profile.website ?? '',
      avatarUrl: profile.avatarUrl ?? '',
      followerCount: profile.followerCount ? String(profile.followerCount) : '',
      averageViews: profile.averageViews ? String(profile.averageViews) : '',
      openToPrOffers: profile.openToPrOffers ?? true,
    });
    setInitialized(true);
  }

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [key]: e.target.value });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await update.mutateAsync({
        displayName: form.displayName,
        bio: form.bio,
        category: form.category,
        country: form.country,
        language: form.language,
        tikTokUsername: form.tikTokUsername || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        profileTags: form.profileTags,
        avatarUrl: form.avatarUrl,
        followerCount: form.followerCount === '' ? undefined : Number(form.followerCount),
        averageViews: form.averageViews === '' ? undefined : Number(form.averageViews),
        instagramUsername: form.instagramUsername || undefined,
        instagramFollowerCount: form.instagramFollowerCount === '' ? undefined : Number(form.instagramFollowerCount),
        website: form.website || undefined,
        openToPrOffers: form.openToPrOffers,
      });
      setEditing(false);
      setSaved(true);
      toast.push(t('Profilen sparad'), 'success');
      setTimeout(() => setSaved(false), 3000);
    } catch {
      toast.push(t('Kunde inte spara profilen'), 'error');
    }
  };

  if (isLoading) return <LoadingSpinner />;
  if (isError) {
    return <EmptyState title={t('Kunde inte hämta profil')} description={getApiErrorMessage(error, t('Ett oväntat fel inträffade.'))} />;
  }
  if (!profile) return <EmptyState title={t('Profil hittades inte')} description="" />;

  return (
    <section className="view active reveal" data-view="profile">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('Hantera din')} <em>{t('profil')}</em></h1>
          <p className="page-sub">{t('Uppdatera din profil, publik och kopplade konton så att företag lär känna dig bättre.')}</p>
        </div>
        <StatusBadge status={profile.status} />
      </div>

      <div style={{ marginBottom: 16 }}><TikTokConnectionCard /></div>

      <div className="card" style={{ maxWidth: 860 }}>
        <div className="sec-head"><h3>{t('Profilinformation')}</h3>{!editing && <button className="view-all" onClick={() => setEditing(true)}>{t('Redigera')}</button>}</div>
        <form onSubmit={handleSave} className="form-grid">
          <div className="field"><label>{t('Visningsnamn')} *</label><input type="text" value={form.displayName} onChange={set('displayName')} required disabled={!editing} /></div>
          <div className="field"><label>{t('TikTok-användarnamn')}</label>
            {tikTokStatus?.connected ? (
              <input type="text" value={'@' + (tikTokStatus.username || '')} disabled />
            ) : (
              <input type="text" value={form.tikTokUsername} onChange={set('tikTokUsername')} disabled={!editing} placeholder={t('@dittanvändarnamn')} />
            )}
          </div>
          <div className="field full"><label>Bio</label><textarea value={form.bio} onChange={set('bio')} rows={3} disabled={!editing} placeholder={t('Berätta om dig själv och ditt innehåll...')} /></div>
          <div className="field"><label>{t('Kategori')}</label>
            <select value={form.category} onChange={set('category')} disabled={!editing}>
              {['Övrigt', 'Mode', 'Skönhet', 'Mat', 'Teknik', 'Gaming', 'Sport', 'Musik', 'Resor', 'Livsstil', 'Humor'].map(c => <option key={c} value={c}>{t(c)}</option>)}
            </select>
          </div>
          <div className="field"><label>{t('Land')}</label>
            <select value={form.country} onChange={set('country')} disabled={!editing}>
              <option value="SE">{t('Sverige')}</option><option value="NO">{t('Norge')}</option><option value="DK">{t('Danmark')}</option><option value="FI">{t('Finland')}</option>
            </select>
          </div>
          <div className="field"><label>{t('Födelsedatum')}</label><DateInput value={form.dateOfBirth} onChange={v => setForm({ ...form, dateOfBirth: v })} disabled={!editing} className="" /></div>
          <div className="field"><label>{t('Instagram-användarnamn')}</label><input type="text" value={form.instagramUsername} onChange={set('instagramUsername')} disabled={!editing} placeholder={t('@dittinstagram')} /></div>
          <div className="field"><label>{t('Instagram-följare')}</label><input type="text" inputMode="numeric" value={form.instagramFollowerCount} disabled={!editing} onChange={(e) => setForm({ ...form, instagramFollowerCount: e.target.value.replace(/\D/g, '') })} /></div>
          <div className="field"><label>{t('Följare (TikTok/övrigt)')}</label><input type="text" inputMode="numeric" value={form.followerCount} disabled={!editing} onChange={(e) => setForm({ ...form, followerCount: e.target.value.replace(/\D/g, '') })} /></div>
          <div className="field"><label>{t('Snittvisningar')}</label><input type="text" inputMode="numeric" value={form.averageViews} disabled={!editing} onChange={(e) => setForm({ ...form, averageViews: e.target.value.replace(/\D/g, '') })} /></div>
          <div className="field"><label>{t('Webbplats / Linktree')}</label><input type="url" value={form.website} onChange={set('website')} disabled={!editing} placeholder="https://…" /></div>
          <div className="field full">
            {editing ? (
              <ImagePicker label={t('Profilbild')} value={form.avatarUrl || null}
                onChange={(v) => setForm({ ...form, avatarUrl: v ?? '' })}
                hint={t('Varumärken ser den i Discover och på din publika profil.')} />
            ) : (
              <>
                <label>{t('Profilbild')}</label>
                {form.avatarUrl
                  ? <img src={form.avatarUrl} alt={t('Profilbild')} className="upload-prev circle" style={{ width: 64, height: 64 }} />
                  : <span className="auth-hint">{t('Ingen profilbild uppladdad ännu.')}</span>}
              </>
            )}
          </div>
          <div className="field full checkrow" style={{ flexDirection: 'row', justifyContent: 'flex-start' }}>
            <input type="checkbox" checked={form.openToPrOffers} disabled={!editing} onChange={(e) => setForm({ ...form, openToPrOffers: e.target.checked })} /> {t('Öppen för direkta PR-erbjudanden från företag')}
          </div>
          {editing ? (
            <div className="field full">
              <TagSelector label={t('Profiltaggar — vad är du expert på?')} tags={ALL_TAGS} selected={form.profileTags} onChange={tags => setForm({ ...form, profileTags: tags })} max={10} />
            </div>
          ) : form.profileTags.length > 0 && (
            <div className="field full"><label>{t('Profiltaggar')}</label><div className="tags">{form.profileTags.map(tag => <span key={tag} className="tag g">{tag}</span>)}</div></div>
          )}
          <div className="field full">
            {saved && <p style={{ color: '#2f9d5b', fontSize: 13, marginBottom: 8 }}>{t('Profilen har sparats!')}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              {editing ? (
                <>
                  <button type="submit" className="btn-apply" style={{ width: 'auto', padding: '12px 22px' }} disabled={update.isPending}>{update.isPending ? t('Sparar…') : t('Spara profil')}</button>
                  <button type="button" className="btn-outline" onClick={() => setEditing(false)}>{t('Avbryt')}</button>
                </>
              ) : (
                <button type="button" className="btn-apply" style={{ width: 'auto', padding: '12px 22px' }} onClick={() => setEditing(true)}>{t('Redigera profil')}</button>
              )}
            </div>
          </div>
        </form>
      </div>

      <div className="card" style={{ maxWidth: 860, marginTop: 16 }}>
        <div className="sec-head"><h3>{t('Profiluppgifter')}</h3></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 16 }}>
          <div><div className="vcamp-k">{t('Följare')}</div><div className="vcamp-v" style={{ fontSize: 16 }}>{formatNumber(profile.followerCount)}</div></div>
          <div><div className="vcamp-k">{t('Snittvisningar')}</div><div className="vcamp-v" style={{ fontSize: 16 }}>{profile.averageViews ? formatNumber(profile.averageViews) : '–'}</div></div>
          <div><div className="vcamp-k">{t('Medlem sedan')}</div><div className="vcamp-v" style={{ fontSize: 16 }}>{formatDate(profile.createdAt)}</div></div>
          <div><div className="vcamp-k">Status</div><div style={{ marginTop: 3 }}><StatusBadge status={profile.status} /></div></div>
        </div>
      </div>

      <ChangeEmailCard />
      <ChangePasswordCard />
      <div style={{ maxWidth: 860, marginTop: 16 }}><CreatorReviewCard userId={profile.userId} /></div>
    </section>
  );
}

function CreatorReviewCard({ userId }: { userId: string }) {
  const { data } = useUserReviews(userId);
  if (!data || data.totalReviews === 0) return null;
  return (
    <Card>
      <h2 className="font-semibold mb-3">⭐ {t('Omdömen')}</h2>
      <ReviewList summary={data} />
    </Card>
  );
}
