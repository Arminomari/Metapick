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
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';
import type { AssignmentListItem } from '@/types';

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
      <div className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-3">
        <span className="text-yellow-400 text-lg">⚠️</span>
        <p className="text-sm text-yellow-200 flex-1">
          Anslut ditt TikTok-konto för automatisk tracking.{' '}
          <Link to="/creator/profile" className="text-primary hover:underline font-medium">Gå till profilen →</Link>
        </p>
      </div>
    );
  }

  return (
    <Card className="border-yellow-500/30 bg-yellow-500/5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center text-xl">🎵</div>
          <div>
            <h3 className="font-semibold text-yellow-200">Anslut ditt TikTok-konto</h3>
            <p className="text-sm text-muted-foreground">
              Koppla ditt konto för att automatiskt spåra views, engagement och intjäning från kampanjer.
            </p>
          </div>
        </div>
        <Button onClick={handleConnect} disabled={connecting} size="sm">
          {connecting ? 'Ansluter...' : '🎵 Anslut TikTok'}
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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Creator Dashboard</h1>
      <TikTokAlertBanner />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Aktiva uppdrag" value={active.length} />
        <StatCard label="Total verifierade views" value={formatNumber(totalViews)} />
        <StatCard label="Total intjänat" value={formatCurrency(totalEarned)} />
        <StatCard label="Skickat till dig" value={formatCurrency(paidOut)} />
      </div>
      <Card>
        <h2 className="text-lg font-semibold mb-4">Aktiva uppdrag</h2>
        {active.length ? (
          <AssignmentTable assignments={active} />
        ) : (
          <EmptyState title="Inga aktiva uppdrag" description="Utforska kampanjer och ansök!" />
        )}
      </Card>
    </div>
  );
}

// ── Browse campaigns ───────────────────────────────────
export function BrowseCampaignsPage() {
  const [category] = useState<string>();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useBrowseCampaigns(category, undefined, page);
  const { data: myApps } = useMyApplications();
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

  const getButtonVariant = (campaignId: string): 'primary' | 'secondary' | 'destructive' | 'ghost' => {
    const status = appStatusMap.get(campaignId);
    if (status === 'Approved') return 'ghost';
    if (status === 'Pending') return 'secondary';
    if (status === 'Rejected') return 'destructive';
    return 'primary';
  };

  const isDisabled = (campaignId: string, spotsRemaining: number) => {
    if (spotsRemaining <= 0 || applyingId === campaignId) return true;
    return appStatusMap.has(campaignId); // already applied in any status
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Utforska kampanjer</h1>
      <TikTokAlertBanner compact />
      {isLoading ? <LoadingSpinner /> : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data?.data.map((c) => (
              <Card key={c.id} className="flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold">{c.name}</h3>
                    <span className="text-xs text-muted-foreground">{c.brandName}</span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{c.description}</p>
                  <div className="flex flex-wrap gap-2 text-xs mb-3">
                    <span className="bg-muted px-2 py-1 rounded">{c.category}</span>
                    <span className="bg-muted px-2 py-1 rounded">{c.country}</span>
                    <span className="bg-muted px-2 py-1 rounded">{c.payoutModel}</span>
                  </div>
                  <div className="text-sm space-y-1">
                    <p><strong>Ersättning:</strong> {c.payoutSummary}</p>
                    <p><strong>Platser kvar:</strong> {c.spotsLeft} av {c.maxCreators}</p>
                    <p><strong>Period:</strong> {formatDate(c.startDate)} – {formatDate(c.endDate)}</p>
                  </div>
                  {c.contentTags && c.contentTags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {c.contentTags.slice(0, 5).map(tag => (
                        <span key={tag} className="px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary border border-primary/20">{tag}</span>
                      ))}
                      {c.contentTags.length > 5 && (
                        <span className="px-2 py-0.5 rounded-full text-xs text-muted-foreground">+{c.contentTags.length - 5}</span>
                      )}
                    </div>
                  )}
                  {c.perks && (
                    <p className="text-xs text-muted-foreground mt-2">🎁 {c.perks}</p>
                  )}
                </div>
                <Button className="mt-4 w-full" onClick={() => handleApply(c.id)}
                  disabled={isDisabled(c.id, c.spotsLeft)}
                  variant={getButtonVariant(c.id)}>
                  {getButtonLabel(c.id, c.spotsLeft)}
                </Button>
              </Card>
            ))}
          </div>
          {data && <Pagination page={page} totalCount={data.totalCount} pageSize={data.pageSize} onPageChange={setPage} />}
          {!data?.data.length && <EmptyState title="Inga kampanjer tillgängliga" description="Kom tillbaka senare!" />}
        </>
      )}
    </div>
  );
}

// ── Creator assignments ────────────────────────────────
export function CreatorAssignmentsPage() {
  const [status, setStatus] = useState<string>();
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const { data, isLoading } = useCreatorAssignments(status, page);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Mina uppdrag</h1>
      <div className="flex gap-2">
        {['Alla', 'Active', 'Completed', 'Paused'].map((s) => (
          <Button key={s} variant={status === (s === 'Alla' ? undefined : s) ? 'primary' : 'secondary'} size="sm"
            onClick={() => { setStatus(s === 'Alla' ? undefined : s); setPage(1); }}>
            {s}
          </Button>
        ))}
      </div>
      {isLoading ? <LoadingSpinner /> : (
        <Card>
          {data?.data.length ? (
            <>
              <AssignmentTable assignments={data.data} onRowClick={(a) => navigate(`/creator/assignments/${a.id}`)} />
              <Pagination page={page} totalCount={data.totalCount} pageSize={data.pageSize} onPageChange={setPage} />
            </>
          ) : (
            <EmptyState title="Inga uppdrag" description="Ansök till kampanjer för att få ditt första uppdrag!" />
          )}
        </Card>
      )}
    </div>
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{assignment.campaignName}</h1>
          <StatusBadge status={assignment.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Verifierade views" value={formatNumber(assignment.totalVerifiedViews)} />
        <StatCard label="Aktuell ersättning" value={formatCurrency(assignment.currentPayoutAmount)} />
        <StatCard label="Antal inlämningar" value={assignment.submissions.length} />
      </div>

      {assignment.trackingTag && (
        <Card>
          <h2 className="font-semibold mb-3">Så här funkar det</h2>
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
        </Card>
      )}

      {assignment.status === 'Active' && (
        <Card>
          <h2 className="font-semibold mb-2">Skicka in video manuellt</h2>
          <p className="text-xs text-muted-foreground mb-3">
            Videos som matchar din tracking-tag hittas automatiskt. Använd formuläret nedan om du vill lägga till en video manuellt.
          </p>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="url" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://www.tiktok.com/@ditt-namn/video/123..."
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
              required
            />
            <Button type="submit" disabled={submitVideo.isPending}>
              {submitVideo.isPending ? 'Skickar...' : 'Skicka in'}
            </Button>
          </form>
        </Card>
      )}

      <Card>
        <h2 className="font-semibold mb-4">Spårade videos</h2>
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
          <EmptyState title="Inga videos ännu" description="Publicera en TikTok-video med din tracking-tag så hittas den automatiskt, eller skicka in manuellt ovan." />
        )}
      </Card>
      <Card>
        <h2 className="font-semibold mb-3">💬 Meddelanden</h2>
        <ChatPanel assignmentId={assignment.id} />
      </Card>

      <Card>
        <h2 className="font-semibold mb-3">⭐ Omdöme</h2>
        <ReviewSection
          assignmentId={assignment.id}
          revieweeUserId={assignment.brandUserId}
          assignmentCompleted={assignment.status === 'Completed'}
        />
      </Card>
    </div>
  );
}

// ── Earnings page ──────────────────────────────────────
export function EarningsPage() {
  const [page, setPage] = useState(1);
  const { data: assignments } = useCreatorAssignments(undefined, 1);
  const { data, isLoading } = useCreatorPayouts(undefined, page);

  if (isLoading) return <LoadingSpinner />;
  const payouts = data?.data ?? [];
  const totalEarned = (assignments?.data ?? []).reduce((sum, a) => sum + a.currentPayoutAmount, 0);
  const sent = payouts.filter((p) => p.status === 'Approved' || p.status === 'Completed' || p.status === 'Processing')
    .reduce((sum, p) => sum + p.amount, 0);
  const pending = Math.max(totalEarned - sent, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Intjäning</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Totalt intjänat" value={formatCurrency(totalEarned)} />
        <StatCard label="Skickat av företag" value={formatCurrency(sent)} />
        <StatCard label="Kvar att betala" value={formatCurrency(pending)} />
      </div>
      <Card>
        <DataTable
          columns={[
            { header: 'Kampanj', accessor: (p) => p.campaignName },
            { header: 'Belopp', accessor: (p) => formatCurrency(p.amount) },
            { header: 'Status', accessor: (p) => <StatusBadge status={p.status} /> },
            { header: 'Skickad', accessor: (p) => p.paidAt ? formatDate(p.paidAt) : 'Inte skickad ännu' },
            { header: 'Registrerad', accessor: (p) => formatDate(p.createdAt) },
          ]}
          data={payouts}
        />
        {data && <Pagination page={page} totalCount={data.totalCount} pageSize={data.pageSize} onPageChange={setPage} />}
      </Card>
    </div>
  );
}

// ── Creator Profile ────────────────────────────────────
export function CreatorProfilePage() {
  const { data: profile, isLoading } = useCreatorProfile();
  const { data: tikTokStatus } = useTikTokStatus();
  const update = useUpdateCreatorProfile();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    displayName: '', bio: '', category: 'Övrigt', country: 'SE', language: 'sv',
    tikTokUsername: '', dateOfBirth: '', profileTags: [] as string[],
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
    });
    setInitialized(true);
  }

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [key]: e.target.value });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await update.mutateAsync(form);
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      alert('Kunde inte spara profilen');
    }
  };

  if (isLoading) return <LoadingSpinner />;
  if (!profile) return <EmptyState title="Profil hittades inte" description="" />;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Min profil</h1>
        <StatusBadge status={profile.status} />
      </div>

      {/* TikTok connection status */}
      <TikTokConnectionCard />

      {/* Profile form */}
      <Card>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Visningsnamn *</label>
            <input type="text" value={form.displayName} onChange={set('displayName')} required
              disabled={!editing}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Bio</label>
            <textarea value={form.bio} onChange={set('bio')} rows={3} disabled={!editing}
              placeholder="Berätta om dig själv och ditt innehåll..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">TikTok-användarnamn</label>
            {tikTokStatus?.connected && tikTokStatus.isOAuth ? (
              <div className="flex items-center gap-2 rounded-md border border-green-500/30 bg-green-500/5 px-3 py-2">
                <span className="text-green-400">✓</span>
                <span className="text-sm">Kopplat via OAuth: </span>
                <a href={`https://www.tiktok.com/@${tikTokStatus.username}`} target="_blank" rel="noopener noreferrer"
                  className="text-primary hover:underline font-medium">@{tikTokStatus.username}</a>
              </div>
            ) : tikTokStatus?.connected ? (
              <div className="flex items-center gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/5 px-3 py-2">
                <span className="text-yellow-400">⚠</span>
                <span className="text-sm">@{tikTokStatus.username} (manuellt angiven – anslut via OAuth för automatisk tracking)</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">@</span>
                <input type="text" value={form.tikTokUsername} onChange={set('tikTokUsername')}
                  disabled={!editing} placeholder="dittanvändarnamn"
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60" />
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Kategori</label>
              <select value={form.category} onChange={set('category')} disabled={!editing}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60">
                {['Övrigt', 'Mode', 'Skönhet', 'Mat', 'Teknik', 'Gaming', 'Sport', 'Musik', 'Resor', 'Livsstil', 'Humor'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Land</label>
              <select value={form.country} onChange={set('country')} disabled={!editing}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60">
                <option value="SE">Sverige</option>
                <option value="NO">Norge</option>
                <option value="DK">Danmark</option>
                <option value="FI">Finland</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Födelsedatum</label>
            <DateInput value={form.dateOfBirth} onChange={v => setForm({ ...form, dateOfBirth: v })} disabled={!editing}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60" />
          </div>

          {editing && (
            <div className="border border-border rounded-lg p-4 bg-muted/20">
              <TagSelector
                label="Profiltaggar — vad är du expert på?"
                tags={ALL_TAGS}
                selected={form.profileTags}
                onChange={tags => setForm({ ...form, profileTags: tags })}
                max={10}
              />
            </div>
          )}
          {!editing && form.profileTags.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">Profiltaggar</label>
              <div className="flex flex-wrap gap-2">
                {form.profileTags.map(t => (
                  <span key={t} className="px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/30">{t}</span>
                ))}
              </div>
            </div>
          )}

          {saved && <p className="text-sm text-green-600">✓ Profilen har sparats!</p>}

          <div className="flex gap-3">
            {editing ? (
              <>
                <Button type="submit" disabled={update.isPending}>
                  {update.isPending ? 'Sparar...' : 'Spara'}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setEditing(false)}>Avbryt</Button>
              </>
            ) : (
              <Button type="button" onClick={() => setEditing(true)}>Redigera profil</Button>
            )}
          </div>
        </form>
      </Card>

      {/* Profile stats */}
      <Card>
        <h2 className="font-semibold mb-3">Profiluppgifter</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-muted-foreground">Följare:</span> <strong>{formatNumber(profile.followerCount)}</strong></div>
          <div><span className="text-muted-foreground">Snittvisningar:</span> <strong>{profile.averageViews ? formatNumber(profile.averageViews) : '–'}</strong></div>
          <div><span className="text-muted-foreground">Medlem sedan:</span> <strong>{formatDate(profile.createdAt)}</strong></div>
          <div><span className="text-muted-foreground">Status:</span> <strong>{profile.status}</strong></div>
        </div>
      </Card>

      <CreatorReviewCard userId={profile.userId} />
    </div>
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
