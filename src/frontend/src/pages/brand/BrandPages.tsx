import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBrandCampaigns, useCampaignDetail, useCampaignAnalytics, useCampaignApplications, usePublishCampaign, useCreateCampaign, useApproveApplication, useRejectApplication, useApproveSubmission, useRejectSubmission, useMarkManualPayoutSent } from '@/hooks/api';
import { Button, Card, DataTable, EmptyState, LoadingSpinner, Pagination, StatCard, StatusBadge, type Column } from '@/components/ui';
import { TikTokEmbed } from '@/components/ui/TikTokEmbed';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';
import type { CampaignListItem, ApplicationItem, CreateCampaignRequest, CreatorPerformance, CreatorVideo } from '@/types';

function getPayoutStatusLabel(status: string) {
  if (status === 'ReadyForManualPayment') return 'Redo att betalas';
  if (status === 'AwaitingThreshold') return 'Väntar på views';
  if (status === 'Completed') return 'Pengar skickade';
  if (status === 'Approved') return 'Godkänd för utbetalning';
  if (status === 'Pending') return 'Väntar';
  if (status === 'Processing') return 'Bearbetas';
  return status;
}

// ── Brand Dashboard ────────────────────────────────────
export function BrandDashboard() {
  const { data, isLoading } = useBrandCampaigns();

  if (isLoading) return <LoadingSpinner />;
  const campaigns = data?.data ?? [];
  const active = campaigns.filter((c) => c.status === 'Active');
  const totalBudget = campaigns.reduce((sum, c) => sum + c.budget, 0);
  const totalSpent = campaigns.reduce((sum, c) => sum + c.budgetSpent, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Brand Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Aktiva kampanjer" value={active.length} />
        <StatCard label="Totalt antal kampanjer" value={campaigns.length} />
        <StatCard label="Total budget" value={formatCurrency(totalBudget)} />
        <StatCard label="Totalt spenderat" value={formatCurrency(totalSpent)} />
      </div>
      <Card>
        <h2 className="text-lg font-semibold mb-4">Senaste kampanjer</h2>
        <BrandCampaignTable campaigns={campaigns.slice(0, 5)} />
      </Card>
    </div>
  );
}

// ── Campaign list ──────────────────────────────────────
export function BrandCampaignListPage() {
  const [status, setStatus] = useState<string>();
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const { data, isLoading } = useBrandCampaigns(status, page);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mina kampanjer</h1>
        <Button onClick={() => navigate('/brand/campaigns/new')}>+ Ny kampanj</Button>
      </div>
      <div className="flex gap-2">
        {['Alla', 'Draft', 'Active', 'Paused', 'Completed'].map((s) => (
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
              <BrandCampaignTable campaigns={data.data} onRowClick={(c) => navigate(`/brand/campaigns/${c.id}`)} />
              <Pagination page={page} totalCount={data.totalCount} pageSize={data.pageSize} onPageChange={setPage} />
            </>
          ) : (
            <EmptyState title="Inga kampanjer" description="Skapa din första kampanj för att komma igång." action={
              <Button onClick={() => navigate('/brand/campaigns/new')}>Skapa kampanj</Button>
            } />
          )}
        </Card>
      )}
    </div>
  );
}

// ── Create campaign ────────────────────────────────────
export function CreateCampaignPage() {
  const navigate = useNavigate();
  const create = useCreateCampaign();
  const [error, setError] = useState('');
  const [form, setForm] = useState<CreateCampaignRequest>({
    name: '', description: '', country: 'SE', category: 'Övrigt',
    requiredHashtag: '', payoutModel: 'Fixed', budget: 0,
    maxCreators: 10, requiredVideoCount: 1, startDate: '', endDate: '', reviewMode: 'ManualReview',
    minViews: 0, requirements: [], rules: [],
    payoutRules: [{ payoutType: 'FixedThreshold', minViews: 1000, amount: 500, sortOrder: 0 }],
  });

  const set = (key: keyof CreateCampaignRequest) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const val = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
    setForm({ ...form, [key]: val });
  };

  // ── Payout model change handler ──
  const handlePayoutModelChange = (model: string) => {
    let rules: CreateCampaignRequest['payoutRules'] = [];
    switch (model) {
      case 'Fixed':
        rules = [{ payoutType: 'FixedThreshold', minViews: 1000, amount: 500, sortOrder: 0 }];
        break;
      case 'CPM':
        rules = [{ payoutType: 'CPM', minViews: 0, amount: 50, sortOrder: 0 }];
        break;
      case 'Tiered':
        rules = [
          { payoutType: 'Tiered', minViews: 1000, maxViews: 4999, amount: 200, sortOrder: 0 },
          { payoutType: 'Tiered', minViews: 5000, maxViews: 19999, amount: 500, sortOrder: 1 },
          { payoutType: 'Tiered', minViews: 20000, amount: 1500, sortOrder: 2 },
        ];
        break;
      default:
        rules = [{ payoutType: 'FixedThreshold', minViews: 1000, amount: 500, sortOrder: 0 }];
    }
    setForm({ ...form, payoutModel: model, payoutRules: rules });
  };

  const updateRule = (idx: number, partial: Partial<CreateCampaignRequest['payoutRules'][0]>) => {
    const updated = form.payoutRules.map((r, i) => i === idx ? { ...r, ...partial } : r);
    setForm({ ...form, payoutRules: updated });
  };

  const addTier = () => {
    const last = form.payoutRules[form.payoutRules.length - 1];
    const nextMin = (last?.maxViews ?? last?.minViews ?? 0) + 1;
    setForm({
      ...form,
      payoutRules: [...form.payoutRules, {
        payoutType: 'Tiered', minViews: nextMin, amount: 0, sortOrder: form.payoutRules.length,
      }],
    });
  };

  const removeTier = (idx: number) => {
    if (form.payoutRules.length <= 1) return;
    setForm({ ...form, payoutRules: form.payoutRules.filter((_, i) => i !== idx).map((r, i) => ({ ...r, sortOrder: i })) });
  };

  // ── Payout summary ──
  const payoutSummary = () => {
    const rules = form.payoutRules;
    if (!rules.length) return '';
    switch (form.payoutModel) {
      case 'Fixed':
        return `${rules[0].amount} kr per creator som når ${formatNumber(rules[0].minViews)} views`;
      case 'CPM':
        return `${rules[0].amount} kr per 1 000 views${rules[0].maxPayoutPerCreator ? ` (max ${rules[0].maxPayoutPerCreator} kr/creator)` : ''}`;
      case 'Tiered':
        return rules.map(r =>
          `${formatNumber(r.minViews)}${r.maxViews ? `–${formatNumber(r.maxViews)}` : '+'} views → ${r.amount} kr`
        ).join(' · ');
      default:
        return '';
    }
  };

  // ── Budget estimate ──
  const estimatedMaxCost = () => {
    const rules = form.payoutRules;
    if (!rules.length) return 0;
    switch (form.payoutModel) {
      case 'Fixed':
        return rules[0].amount * form.maxCreators;
      case 'CPM':
        return rules[0].maxPayoutPerCreator ? rules[0].maxPayoutPerCreator * form.maxCreators : 0;
      case 'Tiered': {
        const maxTier = rules.reduce((max, r) => r.amount > max ? r.amount : max, 0);
        return maxTier * form.maxCreators;
      }
      default:
        return 0;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      setError('Slutdatumet måste vara efter startdatumet.');
      return;
    }

    if (form.payoutRules.some(r => r.amount <= 0)) {
      setError('Alla utbetalningsbelopp måste vara större än 0.');
      return;
    }

    const maxCost = estimatedMaxCost();
    if (maxCost > 0 && form.budget < maxCost) {
      setError(`Budget (${formatCurrency(form.budget)}) kan vara för låg. Max kostnad om alla creators får max: ${formatCurrency(maxCost)}.`);
      // Not blocking, just warning — let them submit
    }

    try {
      const result = await create.mutateAsync(form as unknown as Record<string, unknown>);
      navigate(`/brand/campaigns/${result.id}`);
    } catch (err: any) {
      const resp = err?.response?.data;
      if (resp?.errors) {
        const msgs = Object.values(resp.errors).flat() as string[];
        setError(msgs.join('. '));
      } else if (resp?.error?.message) {
        setError(resp.error.message);
      } else {
        setError('Kunde inte skapa kampanjen. Kontrollera att alla fält är korrekt ifyllda.');
      }
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Skapa ny kampanj</h1>
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Kampanjnamn *</label>
            <input type="text" value={form.name} onChange={set('name')} required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Beskrivning *</label>
            <textarea value={form.description} onChange={set('description')} required rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Kategori</label>
              <select value={form.category} onChange={set('category')}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {['Övrigt', 'Mode', 'Skönhet', 'Mat', 'Teknik', 'Gaming', 'Sport', 'Musik', 'Resor'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Hashtag *</label>
              <input type="text" value={form.requiredHashtag} onChange={set('requiredHashtag')} required placeholder="#mittvarumärke"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Startdatum *</label>
              <input type="date" value={form.startDate} onChange={set('startDate')} required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Slutdatum *</label>
              <input type="date" value={form.endDate} onChange={set('endDate')} required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Total budget (SEK) *</label>
              <input type="number" value={form.budget} onChange={set('budget')} required min={1}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Max antal creators</label>
              <input type="number" value={form.maxCreators} onChange={set('maxCreators')} min={1}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Antal videos per creator</label>
              <input type="number" value={form.requiredVideoCount} onChange={set('requiredVideoCount')} min={1}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              <p className="text-xs text-muted-foreground mt-1">Hur många videos varje creator ska leverera</p>
            </div>
          </div>

          {/* ── Payout Configuration ── */}
          <div className="border border-border rounded-lg p-4 space-y-4 bg-muted/20">
            <h3 className="font-semibold">Utbetalningsmodell</h3>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: 'Fixed', label: 'Fast belopp', desc: 'En fast summa per creator som når tröskeln' },
                { value: 'CPM', label: 'Per visning', desc: 'Betala per 1 000 visningar' },
                { value: 'Tiered', label: 'Trappsteg', desc: 'Olika belopp vid olika visningsmål' },
              ] as const).map((opt) => (
                <button key={opt.value} type="button"
                  className={`rounded-lg border p-3 text-left transition-colors ${form.payoutModel === opt.value
                    ? 'border-primary bg-primary/10 ring-1 ring-primary'
                    : 'border-border hover:border-primary/50'}`}
                  onClick={() => handlePayoutModelChange(opt.value)}>
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>

            {/* Fixed model */}
            {form.payoutModel === 'Fixed' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1">Belopp per creator (SEK)</label>
                    <input type="number" value={form.payoutRules[0]?.amount ?? 0} min={1}
                      onChange={(e) => updateRule(0, { amount: Number(e.target.value) })}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Minsta antal views</label>
                    <input type="number" value={form.payoutRules[0]?.minViews ?? 1000} min={0} step={100}
                      onChange={(e) => updateRule(0, { minViews: Number(e.target.value) })}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Creatorn får {form.payoutRules[0]?.amount ?? 0} kr när videon når {formatNumber(form.payoutRules[0]?.minViews ?? 0)} views.
                </p>
              </div>
            )}

            {/* CPM model */}
            {form.payoutModel === 'CPM' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1">Pris per 1 000 views (SEK)</label>
                    <input type="number" step="1" value={form.payoutRules[0]?.amount ?? 50} min={1}
                      onChange={(e) => updateRule(0, { amount: Number(e.target.value) })}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Max per creator (SEK, valfritt)</label>
                    <input type="number" value={form.payoutRules[0]?.maxPayoutPerCreator ?? ''} min={0}
                      onChange={(e) => updateRule(0, { maxPayoutPerCreator: e.target.value ? Number(e.target.value) : undefined })}
                      placeholder="Ingen gräns"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {(() => {
                    const amt = form.payoutRules[0]?.amount ?? 50;
                    const cap = form.payoutRules[0]?.maxPayoutPerCreator;
                    const ex10k = (10000 / 1000) * amt;
                    return `Exempel: 10 000 views = ${formatCurrency(ex10k)}${cap ? ` (max ${formatCurrency(cap)} per creator)` : ''}`;
                  })()}
                </p>
              </div>
            )}

            {/* Tiered model */}
            {form.payoutModel === 'Tiered' && (
              <div className="space-y-3">
                {form.payoutRules.map((rule, idx) => (
                  <div key={idx} className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="block text-xs font-medium mb-1">{idx === 0 ? 'Från views' : ''}</label>
                      <input type="number" value={rule.minViews} min={0} step={100}
                        onChange={(e) => updateRule(idx, { minViews: Number(e.target.value) })}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium mb-1">{idx === 0 ? 'Till views' : ''}</label>
                      <input type="number" value={rule.maxViews ?? ''} min={0} step={100}
                        onChange={(e) => updateRule(idx, { maxViews: e.target.value ? Number(e.target.value) : undefined })}
                        placeholder="∞"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium mb-1">{idx === 0 ? 'Belopp (SEK)' : ''}</label>
                      <input type="number" value={rule.amount} min={1}
                        onChange={(e) => updateRule(idx, { amount: Number(e.target.value) })}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                    </div>
                    <button type="button" onClick={() => removeTier(idx)}
                      className="text-muted-foreground hover:text-destructive p-2 text-sm"
                      title="Ta bort steg">✕</button>
                  </div>
                ))}
                <button type="button" onClick={addTier}
                  className="text-sm text-primary hover:underline">+ Lägg till steg</button>
              </div>
            )}

            {/* Summary */}
            {payoutSummary() && (
              <div className="bg-primary/5 border border-primary/20 rounded-md px-3 py-2">
                <p className="text-xs font-medium text-primary">Sammanfattning: {payoutSummary()}</p>
                {estimatedMaxCost() > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Uppskattad maxkostnad ({form.maxCreators} creators): {formatCurrency(estimatedMaxCost())}
                  </p>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Instruktioner till creators</label>
            <textarea value={form.contentInstructions ?? ''} onChange={set('contentInstructions')} rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Beskriv vad creators ska göra..." />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-3">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Skapar...' : 'Skapa kampanj'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate('/brand/campaigns')}>
              Avbryt
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function BrandCampaignTable({ campaigns, onRowClick }: { campaigns: CampaignListItem[]; onRowClick?: (c: CampaignListItem) => void }) {
  const columns: Column<CampaignListItem>[] = [
    { header: 'Namn', accessor: 'name' },
    { header: 'Status', accessor: (c) => <StatusBadge status={c.status} /> },
    { header: 'Budget', accessor: (c) => `${formatCurrency(c.budgetSpent)} / ${formatCurrency(c.budget)}` },
    { header: 'Creators', accessor: (c) => `${c.approvedCreatorCount} / ${c.maxCreators}` },
    { header: 'Period', accessor: (c) => `${formatDate(c.startDate)} – ${formatDate(c.endDate)}` },
  ];
  return <DataTable columns={columns} data={campaigns} onRowClick={onRowClick} />;
}

// ── Campaign detail ────────────────────────────────────
export function BrandCampaignDetailPage({ campaignId }: { campaignId: string }) {
  const { data: campaign, isLoading } = useCampaignDetail(campaignId);
  const { data: analytics } = useCampaignAnalytics(campaignId);
  const { data: applications } = useCampaignApplications(campaignId);
  const publish = usePublishCampaign();
  const approve = useApproveApplication();
  const reject = useRejectApplication();
  const approveSubmission = useApproveSubmission();
  const rejectSubmission = useRejectSubmission();
  const markManualPayoutSent = useMarkManualPayoutSent();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  if (isLoading || !campaign) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{campaign.name}</h1>
          <StatusBadge status={campaign.status} />
        </div>
        {campaign.status === 'Draft' && (
          <Button onClick={() => publish.mutateAsync(campaignId)} disabled={publish.isPending}>
            Publicera kampanj
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total views" value={formatNumber(campaign.totalViews)} />
        <StatCard label="Budget kvar" value={formatCurrency(campaign.budget - campaign.budgetSpent - campaign.budgetReserved)} />
        <StatCard label="Aktiva creators" value={`${campaign.approvedCreatorCount} / ${campaign.maxCreators}`} />
        <StatCard label="Utbetalningsmodell" value={campaign.payoutModel} />
      </div>

      <Card>
        <h2 className="font-semibold mb-2">Beskrivning</h2>
        <p className="text-sm text-muted-foreground">{campaign.description}</p>
      </Card>

      {analytics && (
        <Card>
          <h2 className="font-semibold mb-4">Creator-prestanda</h2>
          <div className="space-y-6">
            {analytics.creatorPerformance.map((cp: CreatorPerformance) => {
              const approvedCount = cp.videos.filter(v => v.status === 'Approved').length;
              const reqCount = campaign.requiredVideoCount ?? 1;
              const canMarkPaid = cp.payoutAmount > 0
                && approvedCount > 0
                && cp.payoutStatus !== 'Completed'
                && cp.payoutStatus !== 'Processing'
                && cp.payoutStatus !== 'Approved';
              return (
              <div key={cp.creatorId} className="border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{cp.displayName}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatNumber(cp.views)} views · {formatCurrency(cp.payoutAmount)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded bg-muted font-medium">
                        {approvedCount}/{reqCount} videos godkända
                      </span>
                      <StatusBadge status={cp.status} />
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={cp.payoutStatus} />
                      <span className="text-xs text-muted-foreground">{getPayoutStatusLabel(cp.payoutStatus)}</span>
                      {cp.paidAt && (
                        <span className="text-xs text-muted-foreground">{formatDate(cp.paidAt)}</span>
                      )}
                      {canMarkPaid && (
                        <Button
                          size="sm"
                          onClick={() => markManualPayoutSent.mutateAsync(cp.assignmentId)}
                          disabled={markManualPayoutSent.isPending}
                        >
                          {markManualPayoutSent.isPending ? 'Markerar...' : 'Betala manuellt'}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                {cp.payoutStatus === 'AwaitingThreshold' && (
                  <p className="text-xs text-muted-foreground">
                    Creatorn har godkända videos men har inte nått betalningsnivån ännu.
                  </p>
                )}
                {cp.videos && cp.videos.length > 0 ? (
                  <div className="space-y-4">
                    {cp.videos.map((v: CreatorVideo, i: number) => (
                      <div key={i} className="bg-muted/30 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>{formatNumber(v.views)} views</span>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={v.status} />
                            <span className="text-xs text-muted-foreground">{formatDate(v.createdAt)}</span>
                          </div>
                        </div>
                        <TikTokEmbed videoUrl={v.videoUrl} compact />
                        {v.rejectionReason && (
                          <p className="text-xs text-red-400">Anledning: {v.rejectionReason}</p>
                        )}
                        {v.submissionId && v.status !== 'Approved' && v.status !== 'Rejected' && (
                          <div className="flex items-center gap-2 pt-1">
                            <Button size="sm" onClick={() => approveSubmission.mutateAsync(v.submissionId!)}
                              disabled={approveSubmission.isPending}>
                              ✓ Godkänn
                            </Button>
                            {rejectingId === v.submissionId ? (
                              <div className="flex items-center gap-2 flex-1">
                                <input type="text" value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                                  placeholder="Anledning (valfritt)"
                                  className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm" />
                                <Button size="sm" variant="destructive"
                                  onClick={() => { rejectSubmission.mutateAsync({ id: v.submissionId!, reason: rejectReason || undefined }); setRejectingId(null); setRejectReason(''); }}
                                  disabled={rejectSubmission.isPending}>
                                  Neka
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => { setRejectingId(null); setRejectReason(''); }}>
                                  Avbryt
                                </Button>
                              </div>
                            ) : (
                              <Button size="sm" variant="destructive" onClick={() => setRejectingId(v.submissionId!)}>
                                ✗ Neka
                              </Button>
                            )}
                          </div>
                        )}
                        {v.status === 'Approved' && (
                          <span className="inline-block text-xs text-green-400 font-medium">✓ Godkänd</span>
                        )}
                        {v.status === 'Rejected' && (
                          <span className="inline-block text-xs text-red-400 font-medium">✗ Nekad</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Inga videos ännu</p>
                )}
              </div>
              );
            })}
            {analytics.creatorPerformance.length === 0 && (
              <EmptyState title="Inga aktiva creators" description="Godkänn ansökningar för att se creator-prestanda." />
            )}
          </div>
        </Card>
      )}

      {applications && (
        <Card>
          <h2 className="font-semibold mb-4">Ansökningar ({applications.totalCount})</h2>
          {applications.data.length ? (
            <div className="space-y-3">
              {applications.data.map((a: ApplicationItem) => (
                <div key={a.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{a.creatorName}</p>
                      {a.creatorCategory && <span className="text-xs bg-muted px-2 py-0.5 rounded">{a.creatorCategory}</span>}
                    </div>
                    {a.tikTokUsername && (
                      <a href={`https://www.tiktok.com/@${a.tikTokUsername}`} target="_blank" rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline">
                        @{a.tikTokUsername}
                      </a>
                    )}
                    {a.creatorBio && <p className="text-xs text-muted-foreground mt-1">{a.creatorBio}</p>}
                    <p className="text-sm text-muted-foreground">{a.message}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(a.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={a.status} />
                    {a.status === 'Pending' && (
                      <>
                        <Button size="sm" onClick={() => approve.mutateAsync({ id: a.id })}
                          disabled={approve.isPending}>
                          Godkänn
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => reject.mutateAsync({ id: a.id, reason: 'Avvisad av varumärke' })}
                          disabled={reject.isPending}>
                          Neka
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Inga ansökningar ännu" description="Väntar på att creators ska ansöka." />
          )}
        </Card>
      )}
    </div>
  );
}

// ── Brand Applications overview ────────────────────────
function CampaignApplicationsSection({ campaignId, campaignName }: { campaignId: string; campaignName: string }) {
  const [expanded, setExpanded] = useState(false);
  const { data: applications, isLoading } = useCampaignApplications(campaignId, undefined, 1);
  const approve = useApproveApplication();
  const reject = useRejectApplication();
  const navigate = useNavigate();

  const pendingCount = applications?.data.filter((a) => a.status === 'Pending').length ?? 0;
  const totalCount = applications?.totalCount ?? 0;

  if (!expanded) {
    return (
      <div className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(true)}>
        <div className="flex items-center gap-3">
          <h3 className="font-medium">{campaignName}</h3>
          {pendingCount > 0 && (
            <span className="bg-primary/20 text-primary text-xs font-bold px-2 py-0.5 rounded-full">
              {pendingCount} nya
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{totalCount} ansökningar</span>
          <span className="text-muted-foreground">▸</span>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold">{campaignName}</h3>
          {pendingCount > 0 && (
            <span className="bg-primary/20 text-primary text-xs font-bold px-2 py-0.5 rounded-full">
              {pendingCount} väntar
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/brand/campaigns/${campaignId}`)}>
            Visa kampanj
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setExpanded(false)}>▾ Minimera</Button>
        </div>
      </div>
      {isLoading ? <LoadingSpinner /> : applications?.data.length ? (
        <div className="space-y-3">
          {applications.data.map((a: ApplicationItem) => (
            <div key={a.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{a.creatorName}</p>
                  {a.creatorCategory && <span className="text-xs bg-muted px-2 py-0.5 rounded">{a.creatorCategory}</span>}
                </div>
                {a.tikTokUsername && (
                  <a href={`https://www.tiktok.com/@${a.tikTokUsername}`} target="_blank" rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline">@{a.tikTokUsername}</a>
                )}
                {a.creatorBio && <p className="text-xs text-muted-foreground mt-1">{a.creatorBio}</p>}
                {a.message && <p className="text-sm text-muted-foreground">{a.message}</p>}
                <p className="text-xs text-muted-foreground">{formatDate(a.createdAt)}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={a.status} />
                {a.status === 'Pending' && (
                  <>
                    <Button size="sm" onClick={() => approve.mutateAsync({ id: a.id })} disabled={approve.isPending}>
                      Godkänn
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => reject.mutateAsync({ id: a.id, reason: 'Avvisad av varumärke' })} disabled={reject.isPending}>
                      Neka
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="Inga ansökningar" description="Inga creators har ansökt till denna kampanj ännu." />
      )}
    </Card>
  );
}

export function BrandApplicationsPage() {
  const { data, isLoading } = useBrandCampaigns(undefined, 1);

  if (isLoading) return <LoadingSpinner />;
  const campaigns = data?.data ?? [];

  // Only show campaigns that are Active or Paused (where applications make sense)
  const relevantCampaigns = campaigns.filter((c) => ['Active', 'Paused', 'Draft'].includes(c.status));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Ansökningar</h1>
      <p className="text-muted-foreground">Hantera ansökningar från creators till dina kampanjer.</p>
      {relevantCampaigns.length ? (
        <div className="space-y-3">
          {relevantCampaigns.map((c) => (
            <CampaignApplicationsSection key={c.id} campaignId={c.id} campaignName={c.name} />
          ))}
        </div>
      ) : (
        <EmptyState title="Inga kampanjer" description="Skapa en kampanj för att börja ta emot ansökningar." />
      )}
    </div>
  );
}
