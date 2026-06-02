import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { DateInput } from '@/components/ui/DateInput';
import { TagSelector } from '@/components/ui/TagSelector';
import { ChatPanel } from '@/components/ui/ChatPanel';
import { ReviewSection, ReviewList } from '@/components/ui/ReviewSection';
import { ALL_TAGS } from '@/lib/tags';
import {
  useBrowseCampaigns, useCreatorAssignments, useAssignmentDetail,
  useCreatorPayouts, useApplyToCampaign, useSubmitVideo, useMyApplications,
  useCreatorProfile, useUpdateCreatorProfile,
  useTikTokStatus, useTikTokDisconnect,
  useUserReviews,
} from '@/hooks/api';
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

  if (isLoading || (tikTokStatus?.connected && tikTokStatus?.isOAuth)) return null;

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await api.get<{ url: string }>('/creator/tiktok/auth-url');
      window.location.href = res.data.url;
    } catch {
      setConnecting(false);
      alert('Kunde inte starta TikTok-anslutning.');
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3 rounded-[14px] border border-[hsl(var(--warning)/0.35)] bg-[hsl(var(--warning)/0.07)] px-4 py-3">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[hsl(var(--warning)/0.18)] text-[hsl(var(--warning))]" aria-hidden>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
        </span>
        <p className="text-sm text-[hsl(var(--warning))] flex-1">
          Anslut ditt TikTok-konto för automatisk tracking.{' '}
          <Link to="/creator/profile" className="text-primary hover:underline font-medium">Gå till profilen →</Link>
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
            <h3 className="text-xl font-bold tracking-tight">Anslut ditt TikTok-konto</h3>
            <p className="text-sm text-muted-foreground col-prose">
              Koppla ditt konto för att automatiskt spåra views, engagement och intjäning.
            </p>
          </div>
        </div>
        <Button onClick={handleConnect} disabled={connecting} size="sm">
          {connecting ? 'Ansluter…' : 'Anslut TikTok'}
        </Button>
      </div>
    </Card>
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
          <p className="eyebrow">Creator studio · Dashboard</p>
          <h1 className="mt-3 text-display text-[clamp(2.25rem,5vw,3.75rem)]">
            Din <span className="text-sunset">vibe</span>,<br />
            i siffror.
          </h1>
        </div>
        <div className="col-span-12 md:col-span-4 md:text-right">
          <p className="text-sm text-muted-foreground col-prose md:ml-auto">
            Aktiva uppdrag, verifierade views, och vad som faktiskt landat på kontot.
          </p>
        </div>
      </header>

      <TikTokAlertBanner />

      <div className="hairline" />

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-6 md:col-span-3"><StatCard label="Aktiva uppdrag" value={active.length} /></div>
        <div className="col-span-6 md:col-span-3"><StatCard label="Verifierade views" value={formatNumber(totalViews)} /></div>
        <div className="col-span-6 md:col-span-3"><StatCard label="Intjänat" value={formatCurrency(totalEarned)} /></div>
        <div className="col-span-6 md:col-span-3"><StatCard label="Skickat till dig" value={formatCurrency(paidOut)} /></div>
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="px-6 pt-6 pb-2 flex items-baseline justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Aktiva uppdrag</h2>
          <span className="eyebrow">{active.length} live</span>
        </div>
        <div className="px-2 pb-4">
          {active.length ? (
            <AssignmentTable assignments={active} />
          ) : (
            <EmptyState title="Inga aktiva uppdrag" description="Utforska kampanjer och ansök till de som matchar din röst." />
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
  const apply = useApplyToCampaign();
  const [applyingId, setApplyingId] = useState<string | null>(null);

  // Build a map of campaignId -> application status from backend data
  const appStatusMap = new Map<string, string>();
  myApps?.data.forEach((a) => appStatusMap.set(a.campaignId, a.status));

  const handleApply = async (campaignId: string) => {
    setApplyingId(campaignId);
    try {
      await apply.mutateAsync({ campaignId, message: 'Jag vill gärna delta i denna kampanj!' });
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message
        ?? err?.response?.data?.title
        ?? 'Kunde inte skicka ansökan';
      alert(msg);
    }
    setApplyingId(null);
  };

  const getButtonLabel = (campaignId: string, spotsRemaining: number) => {
    if (spotsRemaining <= 0) return 'Fullbokad';
    if (applyingId === campaignId) return 'Skickar...';
    const status = appStatusMap.get(campaignId);
    if (status === 'Approved') return '✓ Godkänd — gå till Mina uppdrag';
    if (status === 'Pending') return '⏳ Ansökan skickad — väntar på svar';
    if (status === 'Rejected') return '✗ Ansökan nekad';
    return 'Ansök';
  };

  const isDisabled = (campaignId: string, spotsRemaining: number) => {
    if (spotsRemaining <= 0 || applyingId === campaignId) return true;
    return appStatusMap.has(campaignId); // already applied in any status
  };

  return (
    <section className="view active reveal">
      <div className="page-head">
        <div>
          <h1 className="page-title">Hitta din nästa <em>kampanj</em></h1>
          <p className="page-sub">Kuraterade kampanjer som matchar din röst, ditt språk och din publik.</p>
        </div>
      </div>
      <TikTokAlertBanner compact />
      {isError && (
        <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <div style={{ fontWeight: 700 }}>Kunde inte hämta kampanjer</div>
          <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 6 }}>{getApiErrorMessage(error, 'Något gick fel när kampanjer skulle hämtas.')}</div>
        </div>
      )}
      {myAppsError && (
        <div className="card" style={{ marginTop: 14, borderColor: 'rgba(212,155,46,.4)' }}>
          <p style={{ color: 'var(--amber)', fontSize: 13 }}>Kunde inte hämta dina ansökningar: {getApiErrorMessage(myAppsErrorObj, 'okänt fel')}</p>
        </div>
      )}
      {!isError && (isLoading ? <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>Laddar…</div> : (
        <>
          {data?.data.length ? (
            <>
              <div className="results-meta"><div className="cnt"><span className="live-dot" />{data.totalCount} kampanj{data.totalCount === 1 ? '' : 'er'} tillgängliga</div></div>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 16, display: 'grid' }}>
                {data.data.map((c) => {
                  const status = appStatusMap.get(c.id);
                  const full = c.spotsLeft <= 0;
                  return (
                    <div className="camp-card" key={c.id}>
                      <div className="ch">
                        <span className="mono" style={{ background: grad(c.name) }}>{initial(c.brandName || c.name)}</span>
                        <div style={{ flex: 1 }}><div className="ttl">{c.name}</div><div className="brand">{c.brandName}</div></div>
                        {status === 'Approved' ? <span className="badge green">Godkänd</span> : status === 'Pending' ? <span className="badge amber">Skickad</span> : status === 'Rejected' ? <span className="badge red">Nekad</span> : <span className="badge green">Ny</span>}
                      </div>
                      <div className="desc">{c.description}</div>
                      <div className="tags">
                        <span className="tag g">{c.category}</span><span className="tag">{c.country}</span><span className="tag">{c.payoutModel}</span>
                      </div>
                      <div className="meta-cols">
                        <div className="mc"><div className="k">Ersättning</div><div className="v green">{c.payoutSummary}</div></div>
                        <div className="mc"><div className="k">Platser</div><div className="v">{c.spotsLeft} / {c.maxCreators}</div></div>
                        <div className="mc"><div className="k">Period</div><div className="v">{formatDate(c.startDate)} – {formatDate(c.endDate)}</div></div>
                      </div>
                      <button className={status === 'Approved' || status === 'Rejected' || status === 'Pending' || full ? 'btn-outline' : 'btn-apply'} style={{ width: '100%', marginTop: 'auto' }}
                        onClick={() => handleApply(c.id)} disabled={isDisabled(c.id, c.spotsLeft)}>
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
              <div style={{ fontSize: 18, fontWeight: 700 }}>Inga kampanjer tillgängliga</div>
              <div style={{ color: 'var(--muted)', fontSize: 14, marginTop: 8 }}>Kom tillbaka senare — nya briefs släpps löpande.</div>
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

  const tabs: { label: string; val?: string }[] = [
    { label: 'Alla', val: undefined }, { label: 'Aktiva', val: 'Active' }, { label: 'Avslutade', val: 'Completed' }, { label: 'Pausade', val: 'Paused' },
  ];

  return (
    <section className="view active reveal">
      <div className="page-head">
        <div>
          <h1 className="page-title">Mina <em>kampanjer</em></h1>
          <p className="page-sub">Dina aktiva samarbeten, verifierade views och vad du tjänat — allt på ett ställe.</p>
        </div>
      </div>
      <div className="tabs">
        {tabs.map((t) => <button key={t.label} className={`tab${status === t.val ? ' active' : ''}`} onClick={() => { setStatus(t.val); setPage(1); }}>{t.label}</button>)}
      </div>
      {isLoading ? <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>Laddar…</div> : (
        <div className="card">
          {data?.data.length ? (
            <>
              <div className="sec-head"><h3>{data.totalCount} uppdrag</h3></div>
              {data.data.map((a) => (
                <div key={a.id} className="vcamp" onClick={() => navigate(`/creator/assignments/${a.id}`)}>
                  <span className="vcamp-thumb" style={{ background: grad(a.campaignName) }}><span className="brand-mono">{initial(a.campaignName)}</span></span>
                  <div className="vcamp-main">
                    <div className="vcamp-b">{a.campaignName}</div>
                    <div className="vcamp-m">Tilldelad {formatDate(a.assignedAt)}</div>
                    <StatusBadge status={a.status} />
                  </div>
                  <div className="vcamp-end"><div className="vcamp-k">Views</div><div className="vcamp-v">{formatNumber(a.totalVerifiedViews)}</div></div>
                  <div className="vcamp-end"><div className="vcamp-k">Klick</div><div className="vcamp-v">{formatNumber(a.totalTrackedClicks)}</div></div>
                  <div className="vcamp-end"><div className="vcamp-k">Intjänat</div><div className="vcamp-v">{formatCurrency(a.currentPayoutAmount)}</div></div>
                </div>
              ))}
              <Pagination page={page} totalCount={data.totalCount} pageSize={data.pageSize} onPageChange={setPage} />
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '44px 24px' }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Inga uppdrag än</div>
              <div style={{ color: 'var(--muted)', fontSize: 14, marginTop: 8 }}>Ansök till kampanjer för att få ditt första uppdrag.</div>
              <Link to="/creator/browse" className="btn-apply" style={{ width: 'auto', display: 'inline-block', padding: '11px 22px', marginTop: 16 }}>Hitta kampanjer</Link>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ── TikTok Connection Card ─────────────────────────────
function TikTokConnectionCard() {
  const { data: status, isLoading } = useTikTokStatus();
  const disconnect = useTikTokDisconnect();
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await api.get<{ url: string }>('/creator/tiktok/auth-url');
      window.location.href = res.data.url;
    } catch {
      setConnecting(false);
      alert('Kunde inte starta TikTok-anslutning.');
    }
  };

  const handleDisconnect = () => {
    if (confirm('Vill du koppla bort ditt TikTok-konto? Automatisk tracking kommer att sluta fungera.')) {
      disconnect.mutate();
    }
  };

  if (isLoading) return <Card><LoadingSpinner /></Card>;

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">TikTok-konto</h2>
          {status?.connected ? (
            <div className="mt-1">
              {status.isOAuth ? (
                <span className="text-green-400 font-medium">✓ Kopplat via OAuth</span>
              ) : (
                <span className="text-yellow-400 font-medium">⚠ Manuellt tillagd — anslut via OAuth för automatisk tracking</span>
              )}
              <a href={`https://www.tiktok.com/@${status.username}`} target="_blank" rel="noopener noreferrer"
                className="ml-3 text-primary hover:underline">
                @{status.username}
              </a>
              {status.followerCount != null && (
                <span className="ml-3 text-sm text-muted-foreground">{formatNumber(status.followerCount)} följare</span>
              )}
              {status.lastSyncAt && (
                <p className="text-xs text-muted-foreground mt-1">Senast synkad: {formatDate(status.lastSyncAt)}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mt-1">
              Anslut ditt TikTok-konto för automatisk tracking av views och engagement.
            </p>
          )}
        </div>
        <div>
          {status?.connected && status?.isOAuth ? (
            <Button variant="secondary" size="sm" onClick={handleDisconnect} disabled={disconnect.isPending}>
              {disconnect.isPending ? 'Kopplar bort...' : 'Koppla bort'}
            </Button>
          ) : (
            <Button onClick={handleConnect} disabled={connecting}>
              {connecting ? 'Ansluter...' : '🎵 Anslut via OAuth'}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function AssignmentTable({ assignments, onRowClick }: { assignments: AssignmentListItem[]; onRowClick?: (a: AssignmentListItem) => void }) {
  const columns: Column<AssignmentListItem>[] = [
    { header: 'Kampanj', accessor: 'campaignName' },
    { header: 'Status', accessor: (a) => <StatusBadge status={a.status} /> },
    { header: 'Views', accessor: (a) => formatNumber(a.totalVerifiedViews) },
    { header: 'Klick', accessor: (a) => formatNumber(a.totalTrackedClicks) },
    { header: 'Intjänat', accessor: (a) => formatCurrency(a.currentPayoutAmount) },
    { header: 'Tilldelad', accessor: (a) => formatDate(a.assignedAt) },
  ];
  return <DataTable columns={columns} data={assignments} onRowClick={onRowClick} />;
}

// ── Assignment detail ──────────────────────────────────
export function AssignmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: assignment, isLoading } = useAssignmentDetail(id!);
  const submitVideo = useSubmitVideo();
  const [videoUrl, setVideoUrl] = useState('');

  if (isLoading || !assignment) return <LoadingSpinner />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitVideo.mutateAsync({ assignmentId: assignment.id, videoUrl });
    setVideoUrl('');
  };

  return (
    <section className="view active reveal">
      <div className="page-head">
        <div>
          <h1 className="page-title">{assignment.campaignName}</h1>
          <div style={{ marginTop: 10 }}><StatusBadge status={assignment.status} /></div>
        </div>
      </div>

      <div className="stat-row" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>
        <div className="card stat"><div className="top"><div className="ico soft"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg></div><div><div className="lbl">Verifierade views</div><div className="val">{formatNumber(assignment.totalVerifiedViews)}</div></div></div></div>
        <div className="card stat"><div className="top"><div className="ico soft"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="9" cy="7" rx="6" ry="3" /><path d="M3 7v5c0 1.7 2.7 3 6 3" /><ellipse cx="15" cy="14" rx="6" ry="3" /></svg></div><div><div className="lbl">Aktuell ersättning</div><div className="val">{formatCurrency(assignment.currentPayoutAmount)}</div></div></div></div>
        <div className="card stat"><div className="top"><div className="ico soft"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="m9 12 2 2 4-4" /></svg></div><div><div className="lbl">Antal inlämningar</div><div className="val">{assignment.submissions.length}</div></div></div></div>
      </div>

      {assignment.trackingTag && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="sec-head"><h3>Så här funkar det</h3></div>
          <p className="text-sm text-muted-foreground mb-4">
            Lägg till följande i din TikTok-videos beskrivning så hittar vi videon automatiskt:
          </p>

          <div className="space-y-3">
            {assignment.trackingTag.recommendedHashtag && (
              <div className="flex items-center gap-3 bg-muted rounded-lg p-3">
                <span className="text-lg">#️⃣</span>
                <div>
                  <p className="text-xs text-muted-foreground">Kampanjens hashtag</p>
                  <p className="font-mono font-bold text-base">{assignment.trackingTag.recommendedHashtag}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3 bg-muted rounded-lg p-3">
              <span className="text-lg">🏷️</span>
              <div>
                <p className="text-xs text-muted-foreground">Din unika tracking-tag (kopiera exakt, UTAN #)</p>
                <p className="font-mono font-bold text-base select-all">{assignment.trackingTag.tagCode}</p>
              </div>
            </div>
          </div>

          <div className="mt-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md px-3 py-2">
            <p className="text-xs text-yellow-300">
              ⚠️ <strong>Viktigt:</strong> Skriv tracking-tagen som vanlig text, INTE som hashtag. Sätt inget # framför den.
            </p>
          </div>

          <div className="mt-4 bg-muted/50 border border-border rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">Exempel på videobeskrivning:</p>
            <p className="text-sm font-mono bg-background rounded p-2">
              Min recension av produkten! {assignment.trackingTag.recommendedHashtag ?? ''} {assignment.trackingTag.tagCode}
            </p>
          </div>

          <div className="mt-3 bg-green-500/10 border border-green-500/20 rounded-md px-3 py-2">
            <p className="text-xs text-green-300">
              🤖 <strong>Automatisk tracking:</strong> Vårt system scannar dagligen efter nya videos. När vi hittar en video som matchar din tag dyker den upp automatiskt nedan — du behöver inte göra något mer efter att du publicerat.
            </p>
          </div>
        </div>
      )}

      {assignment.status === 'Active' && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="sec-head"><h3>Skicka in video manuellt</h3></div>
          <p className="text-xs text-muted-foreground mb-3">
            Videos som matchar din tracking-tag hittas automatiskt. Använd formuläret nedan om du vill lägga till en video manuellt.
          </p>
          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 10 }}>
            <input type="url" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://www.tiktok.com/@ditt-namn/video/123..." required
              style={{ flex: 1, border: '1px solid rgba(241,168,143,.22)', borderRadius: 13, padding: '12px 14px', fontSize: 13.5, fontFamily: 'inherit', background: 'rgba(255,255,255,.7)' }} />
            <button type="submit" className="btn-apply" style={{ width: 'auto', padding: '12px 22px' }} disabled={submitVideo.isPending}>{submitVideo.isPending ? 'Skickar…' : 'Skicka in'}</button>
          </form>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="sec-head"><h3>Spårade videos</h3></div>
        {(assignment.socialPosts?.length > 0) ? (
          <div className="space-y-6">
            {assignment.socialPosts.map((sp) => (
              <div key={sp.id} className="border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <StatusBadge status={sp.status} />
                    <span className="text-sm font-medium">{formatNumber(sp.views)} views</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDate(sp.discoveredAt)}</span>
                </div>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  <span>❤️ {formatNumber(sp.likes)}</span>
                  <span>💬 {formatNumber(sp.comments)}</span>
                  <span>🔗 {formatNumber(sp.shares)}</span>
                </div>
                <TikTokEmbed videoUrl={sp.tikTokUrl} compact />
              </div>
            ))}
          </div>
        ) : assignment.submissions.length ? (
          <div className="space-y-3">
            {assignment.submissions.map((s) => (
              <div key={s.id} className="border border-border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <a href={s.tikTokVideoUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm truncate max-w-[300px]">{s.tikTokVideoUrl}</a>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={s.status} />
                    <span className="text-xs text-muted-foreground">{formatDate(s.createdAt)}</span>
                  </div>
                </div>
                {s.status === 'Approved' && (
                  <p className="text-xs text-green-400 font-medium">✓ Godkänd av varumärket</p>
                )}
                {s.status === 'Rejected' && (
                  <p className="text-xs text-red-400 font-medium">
                    ✗ Nekad{s.rejectionReason ? `: ${s.rejectionReason}` : ''}
                  </p>
                )}
              </div>
            ))}
            <p className="text-xs text-muted-foreground">⏳ Väntar på att systemet ska hämta videodata...</p>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '34px 24px', color: 'var(--muted)' }}>Inga videos ännu. Publicera en TikTok-video med din tracking-tag så hittas den automatiskt, eller skicka in manuellt ovan.</div>
        )}
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="sec-head"><h3>Meddelanden</h3></div>
        <ChatPanel assignmentId={assignment.id} />
      </div>

      <div className="card">
        <div className="sec-head"><h3>Omdöme</h3></div>
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
          <h1 className="page-title">Track your <em>earnings</em></h1>
          <p className="page-sub">Pending, approved and paid — exactly where every krona stands. Pulled straight from your verified payouts, nothing estimated.</p>
        </div>
      </div>

      {/* ── the three states that matter ── */}
      <div className="vstat-row" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>
        <PayoutState tone="amber" label="Pending" amount={pending} count={pendingList.length} sub="awaiting brand approval"
          icon={<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>} />
        <PayoutState tone="lilac" label="Approved" amount={approved} count={approvedList.length} sub="cleared, on the way"
          icon={<path d="m5 12 4 4L19 7" />} />
        <PayoutState tone="green" label="Paid out" amount={paid} count={paidList.length} sub="landed in your account" featured
          icon={<><ellipse cx="9" cy="7" rx="6" ry="3" /><path d="M3 7v5c0 1.7 2.7 3 6 3M3 12v5c0 1.7 2.7 3 6 3" /><ellipse cx="15" cy="14" rx="6" ry="3" /></>} />
      </div>

      <div className="vtop">
        {/* overview + breakdown */}
        <div className="card vperf">
          <div className="vperf-head"><h3>Earnings overview</h3><span className="vchip">{payouts.length} payout{payouts.length === 1 ? '' : 's'}</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
            {donutSegs.length ? (
              <Donut size={150} segments={donutSegs}>
                <div className="vrep-num" style={{ fontSize: 26 }}>{formatCurrency(lifetime)}</div>
                <div className="vrep-lbl" style={{ color: 'var(--muted)', fontWeight: 600 }}>lifetime</div>
              </Donut>
            ) : (
              <div style={{ width: 150, height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13, textAlign: 'center' }}>No payouts yet</div>
            )}
            <div className="an-legend" style={{ flex: 1, minWidth: 200 }}>
              <div className="li"><span className="dotc" style={{ background: BLUSH[2] }} />Paid out<span className="lv">{formatCurrency(paid)}</span></div>
              <div className="li"><span className="dotc" style={{ background: BLUSH[0] }} />Approved<span className="lv">{formatCurrency(approved)}</span></div>
              <div className="li"><span className="dotc" style={{ background: BLUSH[3] }} />Pending<span className="lv">{formatCurrency(pending)}</span></div>
              {totalAccrued > paid + approved + pending && (
                <div className="li"><span className="dotc" style={{ background: BLUSH[7] }} />Accruing<span className="lv">{formatCurrency(totalAccrued - paid - approved - pending)}</span></div>
              )}
            </div>
          </div>
          <div className="vperf-foot">
            <div className="vf-stat"><div className="vf-l">Lifetime earned</div><div className="vf-v">{formatCurrency(lifetime)}</div></div>
            <div className="vf-stat"><div className="vf-l">Avg / payout</div><div className="vf-v">{formatCurrency(payouts.length ? (paid + approved + pending) / payouts.length : 0)}</div></div>
            <div className="vf-stat"><div className="vf-l">Paid rate</div><div className="vf-v">{payouts.length ? Math.round((paidList.length / payouts.length) * 100) : 0}%</div></div>
          </div>
        </div>

        {/* top earning brands */}
        <div className="card vrep">
          <div className="vperf-head"><h3>Top earning brands</h3></div>
          {topBrands.length ? (
            <div style={{ marginTop: 6 }}>
              {topBrands.map(([name, amt]) => (
                <div className="minibar" key={name}><span className="nm" style={{ width: 110, flex: '0 0 110px' }}>{name}</span><span className="track"><span style={{ width: `${Math.round((amt / maxBrand) * 100)}%` }} /></span><span className="pct">{formatCurrency(amt)}</span></div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '30px 6px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Your top paying partners will appear here.</div>
          )}
          <div className="vrep-rows" style={{ marginTop: 'auto' }}>
            <div className="vrep-row"><span className="vrep-ck"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg></span>Accrued (not requested)<b>{formatCurrency(Math.max(0, totalAccrued - paid - approved - pending))}</b></div>
          </div>
        </div>
      </div>

      {/* pending detail */}
      {pendingList.length > 0 && (
        <div className="card" style={{ marginTop: 18 }}>
          <div className="sec-head"><h3>Pending payouts <span className="badge amber">{pendingList.length}</span></h3></div>
          {pendingList.map((p) => <PayoutRow key={p.id} p={p} />)}
        </div>
      )}

      {/* all payouts */}
      <div className="card" style={{ marginTop: 18 }}>
        <div className="sec-head"><h3>Payout history</h3></div>
        {payouts.length ? payouts.map((p) => <PayoutRow key={p.id} p={p} />) : (
          <div style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--muted)' }}>No payouts yet. When a campaign pays out, it shows up here.</div>
        )}
        {data && <Pagination page={page} totalCount={data.totalCount} pageSize={data.pageSize} onPageChange={setPage} />}
      </div>
    </section>
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
      <div className="vstat-sub"><span className="vmut">{count} payout{count === 1 ? '' : 's'} · {sub}</span></div>
    </div>
  );
}

function PayoutRow({ p }: { p: import('@/types').PayoutRequest }) {
  return (
    <div className="list-row">
      <span className="mono sq" style={{ background: grad(p.campaignName) }}>{initial(p.campaignName)}</span>
      <div className="row-main" style={{ flex: 1 }}>
        <div className="t">{p.campaignName}</div>
        <div className="s">Logged {formatDate(p.createdAt)}{p.paidAt ? ` · paid ${formatDate(p.paidAt)}` : ''}{p.payoutMethod ? ` · ${p.payoutMethod}` : ''}</div>
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
        avatarUrl: form.avatarUrl || undefined,
        followerCount: form.followerCount === '' ? undefined : Number(form.followerCount),
        averageViews: form.averageViews === '' ? undefined : Number(form.averageViews),
        instagramUsername: form.instagramUsername || undefined,
        instagramFollowerCount: form.instagramFollowerCount === '' ? undefined : Number(form.instagramFollowerCount),
        website: form.website || undefined,
        openToPrOffers: form.openToPrOffers,
      });
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      alert('Kunde inte spara profilen');
    }
  };

  if (isLoading) return <LoadingSpinner />;
  if (isError) {
    return <EmptyState title="Kunde inte hämta profil" description={getApiErrorMessage(error, 'Ett oväntat fel inträffade.')} />;
  }
  if (!profile) return <EmptyState title="Profil hittades inte" description="" />;

  return (
    <section className="view active reveal" data-view="profile">
      <div className="page-head">
        <div>
          <h1 className="page-title">Hantera din <em>profil</em></h1>
          <p className="page-sub">Uppdatera din profil, publik och kopplade konton så att företag lär känna dig bättre.</p>
        </div>
        <StatusBadge status={profile.status} />
      </div>

      <div style={{ marginBottom: 16 }}><TikTokConnectionCard /></div>

      <div className="card" style={{ maxWidth: 860 }}>
        <div className="sec-head"><h3>Profilinformation</h3>{!editing && <button className="view-all" onClick={() => setEditing(true)}>Redigera</button>}</div>
        <form onSubmit={handleSave} className="form-grid">
          <div className="field"><label>Visningsnamn *</label><input type="text" value={form.displayName} onChange={set('displayName')} required disabled={!editing} /></div>
          <div className="field"><label>TikTok-användarnamn</label>
            {tikTokStatus?.connected ? (
              <input type="text" value={'@' + (tikTokStatus.username || '')} disabled />
            ) : (
              <input type="text" value={form.tikTokUsername} onChange={set('tikTokUsername')} disabled={!editing} placeholder="@dittanvändarnamn" />
            )}
          </div>
          <div className="field full"><label>Bio</label><textarea value={form.bio} onChange={set('bio')} rows={3} disabled={!editing} placeholder="Berätta om dig själv och ditt innehåll..." /></div>
          <div className="field"><label>Kategori</label>
            <select value={form.category} onChange={set('category')} disabled={!editing}>
              {['Övrigt', 'Mode', 'Skönhet', 'Mat', 'Teknik', 'Gaming', 'Sport', 'Musik', 'Resor', 'Livsstil', 'Humor'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field"><label>Land</label>
            <select value={form.country} onChange={set('country')} disabled={!editing}>
              <option value="SE">Sverige</option><option value="NO">Norge</option><option value="DK">Danmark</option><option value="FI">Finland</option>
            </select>
          </div>
          <div className="field"><label>Födelsedatum</label><DateInput value={form.dateOfBirth} onChange={v => setForm({ ...form, dateOfBirth: v })} disabled={!editing} className="" /></div>
          <div className="field"><label>Instagram-användarnamn</label><input type="text" value={form.instagramUsername} onChange={set('instagramUsername')} disabled={!editing} placeholder="@dittinstagram" /></div>
          <div className="field"><label>Instagram-följare</label><input type="text" inputMode="numeric" value={form.instagramFollowerCount} disabled={!editing} onChange={(e) => setForm({ ...form, instagramFollowerCount: e.target.value.replace(/\D/g, '') })} /></div>
          <div className="field"><label>Följare (TikTok/övrigt)</label><input type="text" inputMode="numeric" value={form.followerCount} disabled={!editing} onChange={(e) => setForm({ ...form, followerCount: e.target.value.replace(/\D/g, '') })} /></div>
          <div className="field"><label>Snittvisningar</label><input type="text" inputMode="numeric" value={form.averageViews} disabled={!editing} onChange={(e) => setForm({ ...form, averageViews: e.target.value.replace(/\D/g, '') })} /></div>
          <div className="field"><label>Profilbild-URL</label><input type="url" value={form.avatarUrl} onChange={set('avatarUrl')} disabled={!editing} placeholder="https://…" /></div>
          <div className="field"><label>Webbplats / Linktree</label><input type="url" value={form.website} onChange={set('website')} disabled={!editing} placeholder="https://…" /></div>
          <div className="field full checkrow" style={{ flexDirection: 'row', justifyContent: 'flex-start' }}>
            <input type="checkbox" checked={form.openToPrOffers} disabled={!editing} onChange={(e) => setForm({ ...form, openToPrOffers: e.target.checked })} /> Öppen för direkta PR-erbjudanden från företag
          </div>
          {editing ? (
            <div className="field full">
              <TagSelector label="Profiltaggar — vad är du expert på?" tags={ALL_TAGS} selected={form.profileTags} onChange={tags => setForm({ ...form, profileTags: tags })} max={10} />
            </div>
          ) : form.profileTags.length > 0 && (
            <div className="field full"><label>Profiltaggar</label><div className="tags">{form.profileTags.map(t => <span key={t} className="tag g">{t}</span>)}</div></div>
          )}
          <div className="field full">
            {saved && <p style={{ color: '#2f9d5b', fontSize: 13, marginBottom: 8 }}>Profilen har sparats!</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              {editing ? (
                <>
                  <button type="submit" className="btn-apply" style={{ width: 'auto', padding: '12px 22px' }} disabled={update.isPending}>{update.isPending ? 'Sparar…' : 'Spara profil'}</button>
                  <button type="button" className="btn-outline" onClick={() => setEditing(false)}>Avbryt</button>
                </>
              ) : (
                <button type="button" className="btn-apply" style={{ width: 'auto', padding: '12px 22px' }} onClick={() => setEditing(true)}>Redigera profil</button>
              )}
            </div>
          </div>
        </form>
      </div>

      <div className="card" style={{ maxWidth: 860, marginTop: 16 }}>
        <div className="sec-head"><h3>Profiluppgifter</h3></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 16 }}>
          <div><div className="vcamp-k">Följare</div><div className="vcamp-v" style={{ fontSize: 16 }}>{formatNumber(profile.followerCount)}</div></div>
          <div><div className="vcamp-k">Snittvisningar</div><div className="vcamp-v" style={{ fontSize: 16 }}>{profile.averageViews ? formatNumber(profile.averageViews) : '–'}</div></div>
          <div><div className="vcamp-k">Medlem sedan</div><div className="vcamp-v" style={{ fontSize: 16 }}>{formatDate(profile.createdAt)}</div></div>
          <div><div className="vcamp-k">Status</div><div style={{ marginTop: 3 }}><StatusBadge status={profile.status} /></div></div>
        </div>
      </div>

      <div style={{ maxWidth: 860, marginTop: 16 }}><CreatorReviewCard userId={profile.userId} /></div>
    </section>
  );
}

function CreatorReviewCard({ userId }: { userId: string }) {
  const { data } = useUserReviews(userId);
  if (!data || data.totalReviews === 0) return null;
  return (
    <Card>
      <h2 className="font-semibold mb-3">⭐ Omdömen</h2>
      <ReviewList summary={data} />
    </Card>
  );
}
