import { useState, type FormEvent as ReactFormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useBrandCampaigns, useCampaignDetail, useCampaignAnalytics, useCampaignApplications, usePublishCampaign, useCreateCampaign, useApproveApplication, useRejectApplication, useApproveSubmission, useRejectSubmission, useMarkManualPayoutSent, useBrandProfile, useUpdateBrandProfile, useChangePassword, useAssignmentDetail, useChatMessages } from '@/hooks/api';
import { Button, Card, DataTable, LoadingSpinner, Pagination, StatCard, StatusBadge, type Column } from '@/components/ui';
import { DateInput } from '@/components/ui/DateInput';
import { TagSelector } from '@/components/ui/TagSelector';
import { ChatPanel } from '@/components/ui/ChatPanel';
import { ReviewSection } from '@/components/ui/ReviewSection';
import { TikTokEmbed } from '@/components/ui/TikTokEmbed';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';
import { PLATFORM_TAGS, NICHE_TAGS } from '@/lib/tags';
import { CardSkeleton } from '@/components/vyrle/Toast';
import { ImagePicker } from '@/components/auth/ImagePicker';
import type { CampaignListItem, ApplicationItem, CreateCampaignRequest, CreatorPerformance, CreatorVideo } from '@/types';

const GRADS = [
  'linear-gradient(135deg,#FFD8C7,#F1A88F)',
  'linear-gradient(135deg,#cdb8f2,#9c7de0)',
  'linear-gradient(135deg,#F2C58A,#e0a04e)',
  'linear-gradient(135deg,#a9dcc0,#5fb98a)',
];
const grad = (s: string) => GRADS[((s || '').charCodeAt(0) || 0) % GRADS.length];
const initial = (s: string) => (s?.[0] || '?').toUpperCase();

function getPayoutStatusLabel(status: string) {
  if (status === 'ReadyForManualPayment') return 'Redo att betalas';
  if (status === 'AwaitingThreshold') return 'Väntar på views';
  if (status === 'Completed') return 'Pengar skickade';
  if (status === 'Approved') return 'Godkänd för utbetalning';
  if (status === 'Pending') return 'Väntar';
  if (status === 'Processing') return 'Bearbetas';
  return status;
}

function CreatorInlineChat({ assignmentId }: { assignmentId: string }) {
  const { data: messages = [] } = useChatMessages(assignmentId);
  const unreadFromCreator = messages.filter((m) => m.senderRole === 'Creator' && !m.isRead).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Direktchatt</h3>
        {unreadFromCreator > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            +{unreadFromCreator} nytt
          </span>
        )}
      </div>
      <ChatPanel assignmentId={assignmentId} />
    </div>
  );
}

// ── Brand Dashboard ────────────────────────────────────
export function BrandDashboard() {
  const { data, isLoading } = useBrandCampaigns();

  if (isLoading) return <LoadingSpinner />;
  const campaigns = data?.data ?? [];
  const active = campaigns.filter((c) => c.status === 'Active');
  const totalBudget = campaigns.reduce((sum, c) => sum + c.budget, 0);
  const totalSpent  = campaigns.reduce((sum, c) => sum + c.budgetSpent, 0);

  return (
    <div className="space-y-12">
      {/* Header */}
      <header className="grid grid-cols-12 gap-x-6 items-end">
        <div className="col-span-12 md:col-span-8">
          <p className="eyebrow">Brand desk · Dashboard</p>
          <h1 className="mt-3 text-display text-[clamp(2.25rem,5vw,3.75rem)]">
            Dina <span className="text-sunset">kampanjer</span>,<br />
            live just nu.
          </h1>
        </div>
        <div className="col-span-12 md:col-span-4 md:text-right">
          <p className="text-sm text-muted-foreground col-prose md:ml-auto">
            Lägesbild över aktiva briefs, budget i rörelse, och vad som väntar härnäst.
          </p>
        </div>
      </header>

      <div className="hairline" />

      {/* Asymmetric stat row */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-4">
          <StatCard label="Aktiva kampanjer"        value={active.length} />
        </div>
        <div className="col-span-6  md:col-span-2">
          <StatCard label="Totalt"                  value={campaigns.length} />
        </div>
        <div className="col-span-6  md:col-span-3">
          <StatCard label="Total budget"            value={formatCurrency(totalBudget)} />
        </div>
        <div className="col-span-12 md:col-span-3">
          <StatCard label="Spenderat"               value={formatCurrency(totalSpent)} subValue={totalBudget ? `${Math.round((totalSpent / totalBudget) * 100)}% av budget` : undefined} />
        </div>
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="px-6 pt-6 pb-2 flex items-baseline justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Senaste kampanjer</h2>
          <span className="eyebrow">{campaigns.length} totalt</span>
        </div>
        <div className="px-2 pb-4">
          <BrandCampaignTable campaigns={campaigns.slice(0, 5)} />
        </div>
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

  const tabs: { label: string; val?: string }[] = [
    { label: 'Alla', val: undefined }, { label: 'Utkast', val: 'Draft' }, { label: 'Aktiva', val: 'Active' }, { label: 'Pausade', val: 'Paused' }, { label: 'Avslutade', val: 'Completed' },
  ];

  return (
    <section className="view active reveal">
      <div className="page-head">
        <div>
          <h1 className="page-title">Mina <em>kampanjer</em></h1>
          <p className="page-sub">Alla dina briefs på ett ställe. Spåra budget, creators och status i realtid.</p>
        </div>
        <button className="btn-apply" style={{ width: 'auto', padding: '12px 22px', display: 'inline-flex', alignItems: 'center', gap: 8 }} onClick={() => navigate('/brand/campaigns/new')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg> Ny kampanj
        </button>
      </div>

      <div className="tabs">
        {tabs.map((t) => (
          <button key={t.label} className={`tab${status === t.val ? ' active' : ''}`} onClick={() => { setStatus(t.val); setPage(1); }}>{t.label}</button>
        ))}
      </div>

      {isLoading ? <CardSkeleton rows={4} /> : (
        <div className="card">
          {data?.data.length ? (
            <>
              <div className="sec-head"><h3>{data.totalCount} kampanj{data.totalCount === 1 ? '' : 'er'}</h3></div>
              {data.data.map((c) => {
                const pct = c.budget ? Math.round((c.budgetSpent / c.budget) * 100) : 0;
                return (
                  <div key={c.id} className="vcamp" onClick={() => navigate(`/brand/campaigns/${c.id}`)}>
                    <span className="vcamp-thumb" style={{ background: grad(c.name) }}><span className="brand-mono">{initial(c.name)}</span></span>
                    <div className="vcamp-main">
                      <div className="vcamp-b">{c.name}</div>
                      <div className="vcamp-m">{c.category} · {formatDate(c.startDate)} – {formatDate(c.endDate)}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><StatusBadge status={c.status} /><div className="progress-line" style={{ flex: 1, maxWidth: 160, marginTop: 0 }}><span style={{ width: `${pct}%` }} /></div><span style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>{pct}%</span></div>
                    </div>
                    <div className="vcamp-end"><div className="vcamp-k">Creators</div><div className="vcamp-v">{c.approvedCreatorCount}/{c.maxCreators}</div></div>
                    <div className="vcamp-end"><div className="vcamp-k">Budget</div><div className="vcamp-v">{formatCurrency(c.budgetSpent)}</div></div>
                  </div>
                );
              })}
              <Pagination page={page} totalCount={data.totalCount} pageSize={data.pageSize} onPageChange={setPage} />
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '44px 24px' }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Inga kampanjer än</div>
              <div style={{ color: 'var(--muted)', fontSize: 14, marginTop: 8 }}>Skapa din första kampanj för att komma igång.</div>
              <button className="btn-apply" style={{ width: 'auto', display: 'inline-block', padding: '11px 22px', marginTop: 16 }} onClick={() => navigate('/brand/campaigns/new')}>Skapa kampanj</button>
            </div>
          )}
        </div>
      )}
    </section>
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
    perks: '', contentTags: [],
  });

  const set = (key: keyof CreateCampaignRequest) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const val = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
    setForm({ ...form, [key]: val });
  };

  const setNum = (key: keyof CreateCampaignRequest) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '');
    setForm({ ...form, [key]: digits ? Number(digits) : 0 });
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

  const handleSubmit = async (e: ReactFormEvent) => {
    e.preventDefault();
    setError('');

    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      setError('Slutdatumet måste vara efter startdatumet.');
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    if (form.endDate && form.endDate <= today) {
      setError('Slutdatumet måste vara i framtiden.');
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
      const payload = {
        ...form,
        startDate: form.startDate ? `${form.startDate}T00:00:00` : form.startDate,
        endDate: form.endDate ? `${form.endDate}T00:00:00` : form.endDate,
      };
      const result = await create.mutateAsync(payload as unknown as Record<string, unknown>);
      navigate(`/brand/campaigns/${result.id}`);
    } catch (err: any) {
      const resp = err?.response?.data;
      if (resp?.errors) {
        const msgs = Object.values(resp.errors).flat() as string[];
        setError(msgs.join('. '));
      } else if (resp?.error?.message) {
        setError(resp.error.message);
      } else if (resp?.title) {
        setError(resp.title + (resp?.detail ? `: ${resp.detail}` : ''));
      } else if (err?.response?.status === 401) {
        setError('Sessionen har gått ut. Logga ut och in igen.');
      } else {
        setError(`Fel ${err?.response?.status ?? '?'}: ${JSON.stringify(resp ?? err?.message ?? 'okänt fel')}`);
      }
    }
  };

  return (
    <section className="view active reveal">
      <button onClick={() => navigate('/brand/campaigns')} className="view-all" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg> Mina kampanjer
      </button>
      <div className="page-head">
        <div>
          <h1 className="page-title">Skapa ny <em>kampanj</em></h1>
          <p className="page-sub">Sätt upp brief, budget och ersättningsmodell. Kreatörer kan ansöka så snart kampanjen är godkänd.</p>
        </div>
      </div>
      <div className="card" style={{ maxWidth: 760 }}>
        <form onSubmit={handleSubmit} className="form-grid">
          <div className="field full"><label>Kampanjnamn *</label><input type="text" value={form.name} onChange={set('name')} required /></div>
          <div className="field full"><label>Beskrivning *</label><textarea value={form.description} onChange={set('description')} required rows={3} /></div>
          <div className="field"><label>Kategori</label>
            <select value={form.category} onChange={set('category')}>
              {['Övrigt', 'Mode', 'Skönhet', 'Mat', 'Teknik', 'Gaming', 'Sport', 'Musik', 'Resor'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field"><label>Hashtag *</label><input type="text" value={form.requiredHashtag} onChange={set('requiredHashtag')} required placeholder="#mittvarumärke" /></div>
          <div className="field"><label>Startdatum *</label><DateInput value={form.startDate} onChange={v => setForm({ ...form, startDate: v })} required className="" /></div>
          <div className="field"><label>Slutdatum *</label><DateInput value={form.endDate} onChange={v => setForm({ ...form, endDate: v })} required className="" /></div>
          <div className="field"><label>Total budget (SEK) *</label><input type="text" inputMode="numeric" value={form.budget || ''} required onChange={setNum('budget')} placeholder="t.ex. 10000" /></div>
          <div className="field"><label>Max antal creators</label><input type="text" inputMode="numeric" value={form.maxCreators || ''} onChange={setNum('maxCreators')} placeholder="t.ex. 10" /></div>
          <div className="field"><label>Antal videos per creator</label><input type="text" inputMode="numeric" value={form.requiredVideoCount || ''} onChange={setNum('requiredVideoCount')} placeholder="t.ex. 1" /><span className="hint" style={{ alignSelf: 'flex-start', color: 'var(--muted)' }}>Hur många videos varje creator ska leverera</span></div>

          {/* ── Payout Configuration ── */}
          <div className="field full" style={{ border: '1px solid rgba(241,168,143,.18)', borderRadius: 16, padding: 18, background: 'rgba(255,255,255,.4)', gap: 14 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>Utbetalningsmodell</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
              {([
                { value: 'Fixed', label: 'Fast belopp', desc: 'En fast summa per creator som når tröskeln' },
                { value: 'CPM', label: 'Per visning', desc: 'Betala per 1 000 visningar' },
                { value: 'Tiered', label: 'Trappsteg', desc: 'Olika belopp vid olika visningsmål' },
              ] as const).map((opt) => (
                <button key={opt.value} type="button"
                  className={`vmetric${form.payoutModel === opt.value ? ' active' : ''}`} style={{ alignItems: 'flex-start' }}
                  onClick={() => handlePayoutModelChange(opt.value)}>
                  <span className="vm-v" style={{ fontSize: 14 }}>{opt.label}</span>
                  <span className="vm-l">{opt.desc}</span>
                </button>
              ))}
            </div>

            {/* Fixed model */}
            {form.payoutModel === 'Fixed' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14 }}>
                  <div className="field"><label>Belopp per creator (SEK)</label>
                    <input type="text" inputMode="numeric" value={form.payoutRules[0]?.amount || ''}
                      onChange={(e) => updateRule(0, { amount: Number(e.target.value.replace(/\D/g, '')) || 0 })}
                      placeholder="t.ex. 500" />
                  </div>
                  <div className="field"><label>Minsta antal views</label>
                    <input type="text" inputMode="numeric" value={form.payoutRules[0]?.minViews || ''}
                      onChange={(e) => updateRule(0, { minViews: Number(e.target.value.replace(/\D/g, '')) || 0 })}
                      placeholder="t.ex. 1000" />
                  </div>
                </div>
                <p className="auth-hint">Creatorn får {form.payoutRules[0]?.amount ?? 0} kr när videon når {formatNumber(form.payoutRules[0]?.minViews ?? 0)} views.</p>
              </>
            )}

            {/* CPM model */}
            {form.payoutModel === 'CPM' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14 }}>
                  <div className="field"><label>Pris per 1 000 views (SEK)</label>
                    <input type="text" inputMode="numeric" value={form.payoutRules[0]?.amount || ''}
                      onChange={(e) => updateRule(0, { amount: Number(e.target.value.replace(/\D/g, '')) || 0 })}
                      placeholder="t.ex. 50" />
                  </div>
                  <div className="field"><label>Max per creator (SEK, valfritt)</label>
                    <input type="text" inputMode="numeric" value={form.payoutRules[0]?.maxPayoutPerCreator ?? ''}
                      onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); updateRule(0, { maxPayoutPerCreator: v ? Number(v) : undefined }); }}
                      placeholder="Ingen gräns" />
                  </div>
                </div>
                <p className="auth-hint">
                  {(() => {
                    const amt = form.payoutRules[0]?.amount ?? 50;
                    const cap = form.payoutRules[0]?.maxPayoutPerCreator;
                    const ex10k = (10000 / 1000) * amt;
                    return `Exempel: 10 000 views = ${formatCurrency(ex10k)}${cap ? ` (max ${formatCurrency(cap)} per creator)` : ''}`;
                  })()}
                </p>
              </>
            )}

            {/* Tiered model */}
            {form.payoutModel === 'Tiered' && (
              <>
                {form.payoutRules.map((rule, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 34px', gap: 10, alignItems: 'end' }}>
                    <div className="field"><label>{idx === 0 ? 'Från views' : ''}</label>
                      <input type="text" inputMode="numeric" value={rule.minViews || ''}
                        onChange={(e) => updateRule(idx, { minViews: Number(e.target.value.replace(/\D/g, '')) || 0 })}
                        placeholder="t.ex. 1000" />
                    </div>
                    <div className="field"><label>{idx === 0 ? 'Till views' : ''}</label>
                      <input type="text" inputMode="numeric" value={rule.maxViews ?? ''}
                        onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); updateRule(idx, { maxViews: v ? Number(v) : undefined }); }}
                        placeholder="∞" />
                    </div>
                    <div className="field"><label>{idx === 0 ? 'Belopp (SEK)' : ''}</label>
                      <input type="text" inputMode="numeric" value={rule.amount || ''}
                        onChange={(e) => updateRule(idx, { amount: Number(e.target.value.replace(/\D/g, '')) || 0 })}
                        placeholder="t.ex. 500" />
                    </div>
                    <button type="button" onClick={() => removeTier(idx)} className="lt-icbtn" aria-label="Ta bort steg" title="Ta bort steg" style={{ marginBottom: 4 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
                <button type="button" onClick={addTier} className="view-all" style={{ alignSelf: 'flex-start' }}>+ Lägg till steg</button>
              </>
            )}

            {/* Summary */}
            {payoutSummary() && (
              <div className="vy-alert info" style={{ padding: '12px 15px' }}>
                <span className="va-ic" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M8 6h8M8 10h2m2 0h2m2 0h0M8 14h2m2 0h2m2 0h0M8 18h2m2 0h4" /></svg>
                </span>
                <div>
                  <b>Sammanfattning:</b> {payoutSummary()}
                  {estimatedMaxCost() > 0 && (
                    <div style={{ marginTop: 3, fontSize: 12, color: 'var(--muted)' }}>Uppskattad maxkostnad ({form.maxCreators} creators): {formatCurrency(estimatedMaxCost())}</div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="field full"><label>Instruktioner till creators</label><textarea value={form.contentInstructions ?? ''} onChange={set('contentInstructions')} rows={2} placeholder="Beskriv vad creators ska göra..." /></div>

          {/* ── Content Tags ── */}
          <div className="field full" style={{ border: '1px solid rgba(241,168,143,.18)', borderRadius: 16, padding: 18, background: 'rgba(255,255,255,.4)', gap: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600 }}>Innehållstaggar <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 12.5 }}>— vilken typ av innehåll söker ni?</span></h3>
            <TagSelector label="Plattform & format" tags={PLATFORM_TAGS} selected={form.contentTags ?? []} onChange={tags => setForm({ ...form, contentTags: tags })} />
            <TagSelector label="Nisch & kategori" tags={NICHE_TAGS} selected={form.contentTags ?? []} onChange={tags => setForm({ ...form, contentTags: tags })} />
          </div>

          {/* ── Perks & PR ── */}
          <div className="field full" style={{ border: '1px solid rgba(241,168,143,.18)', borderRadius: 16, padding: 18, background: 'rgba(255,255,255,.4)', gap: 8 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600 }}>Förmåner & PR <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 12.5 }}>— valfritt</span></h3>
            <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>Beskriv vad godkända creators får utöver ersättningen, t.ex. rabattkod, PR-utskick, gratisprodukt</p>
            <textarea value={form.perks ?? ''} onChange={set('perks')} rows={3} placeholder="Exempel: 30% rabattkod på hela sortimentet + PR-paket med produkter värda 500 kr"
              style={{ border: '1px solid rgba(241,168,143,.22)', borderRadius: 13, padding: '12px 14px', fontSize: 13.5, fontFamily: 'inherit', background: 'rgba(255,255,255,.7)', resize: 'vertical' }} />
          </div>

          <div className="field full">
            {error && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 8 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" className="btn-apply" style={{ width: 'auto', padding: '12px 22px' }} disabled={create.isPending}>{create.isPending ? 'Skapar…' : 'Skicka för granskning'}</button>
              <button type="button" className="btn-outline" onClick={() => navigate('/brand/campaigns')}>Avbryt</button>
            </div>
          </div>
        </form>
      </div>
    </section>
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
  const navigate = useNavigate();
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
    <section className="view active reveal">
      <button onClick={() => navigate('/brand/campaigns')} className="view-all" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg> Mina kampanjer
      </button>
      <div className="page-head">
        <div>
          <h1 className="page-title">{campaign.name}</h1>
          <div style={{ marginTop: 10 }}><StatusBadge status={campaign.status} /></div>
        </div>
        {campaign.status === 'Draft' && (
          <button className="btn-apply" style={{ width: 'auto', padding: '12px 22px' }} onClick={() => publish.mutateAsync(campaignId)} disabled={publish.isPending}>{publish.isPending ? 'Skickar…' : 'Skicka för granskning'}</button>
        )}
        {campaign.status === 'PendingReview' && (
          <span className="badge amber" style={{ alignSelf: 'center' }}>Väntar på granskning av admin</span>
        )}
      </div>

      <div className="stat-row">
        <div className="card stat"><div className="top"><div className="ico soft"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg></div><div><div className="lbl">Total views</div><div className="val">{formatNumber(campaign.totalViews)}</div></div></div></div>
        <div className="card stat"><div className="top"><div className="ico soft"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="9" cy="7" rx="6" ry="3" /><path d="M3 7v5c0 1.7 2.7 3 6 3" /><ellipse cx="15" cy="14" rx="6" ry="3" /></svg></div><div><div className="lbl">Budget kvar</div><div className="val">{formatCurrency(campaign.budget - campaign.budgetSpent - campaign.budgetReserved)}</div></div></div></div>
        <div className="card stat"><div className="top"><div className="ico soft"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3" /><circle cx="16" cy="9" r="2.5" /><path d="M3 19a6 6 0 0 1 12 0M14 18a5 5 0 0 1 7-1" /></svg></div><div><div className="lbl">Aktiva creators</div><div className="val">{campaign.approvedCreatorCount} / {campaign.maxCreators}</div></div></div></div>
        <div className="card stat"><div className="top"><div className="ico soft"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" /></svg></div><div><div className="lbl">Utbetalningsmodell</div><div className="val" style={{ fontSize: 20 }}>{campaign.payoutModel}</div></div></div></div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="sec-head"><h3>Beskrivning</h3></div>
        <p className="text-sm text-muted-foreground">{campaign.description}</p>
      </div>

      {(campaign.contentTags?.length > 0 || campaign.perks) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16, marginBottom: 16 }}>
          {campaign.contentTags?.length > 0 && (
            <div className="card">
              <div className="sec-head"><h3>Innehållstaggar</h3></div>
              <div className="tags">{campaign.contentTags.map(tag => <span key={tag} className="tag g">{tag}</span>)}</div>
            </div>
          )}
          {campaign.perks && (
            <div className="card">
              <div className="sec-head"><h3>Förmåner för creators</h3></div>
              <p className="text-sm text-muted-foreground" style={{ whiteSpace: 'pre-line' }}>{campaign.perks}</p>
            </div>
          )}
        </div>
      )}

      {analytics && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="sec-head"><h3>Creator-prestanda</h3></div>
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
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                  <div className="xl:col-span-2">
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
                  <div className="xl:col-span-1">
                    <CreatorInlineChat assignmentId={cp.assignmentId} />
                  </div>
                </div>
              </div>
              );
            })}
            {analytics.creatorPerformance.length === 0 && (
              <div style={{ textAlign: 'center', padding: '34px 24px', color: 'var(--muted)' }}>Inga aktiva creators. Godkänn ansökningar för att se creator-prestanda.</div>
            )}
          </div>
        </div>
      )}

      {applications && (
        <div className="card">
          <div className="sec-head"><h3>Ansökningar ({applications.totalCount})</h3></div>
          {applications.data.length ? (
            applications.data.map((a: ApplicationItem) => (
              <div key={a.id} className="list-row" style={{ gap: 14 }}>
                <span className="mono" style={{ background: grad(a.creatorName) }}>{initial(a.creatorName)}</span>
                <div className="row-main" style={{ flex: 1 }}>
                  <div className="t" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{a.creatorName}{a.creatorCategory && <span className="badge grey">{a.creatorCategory}</span>}</div>
                  {a.tikTokUsername && <a href={`https://www.tiktok.com/@${a.tikTokUsername}`} target="_blank" rel="noopener noreferrer" className="s" style={{ color: '#C26A4A' }}>@{a.tikTokUsername}</a>}
                  {a.message && <div className="s">{a.message}</div>}
                  <div className="s" style={{ color: 'var(--muted-2)' }}>{formatDate(a.createdAt)}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 0 auto' }}>
                  <StatusBadge status={a.status} />
                  {a.status === 'Pending' && (
                    <>
                      <button className="btn-apply" style={{ width: 'auto', padding: '9px 16px', fontSize: 12.5 }} onClick={() => approve.mutateAsync({ id: a.id })} disabled={approve.isPending}>Godkänn</button>
                      <button className="btn-outline" style={{ padding: '9px 16px', fontSize: 12.5 }} onClick={() => reject.mutateAsync({ id: a.id, reason: 'Avvisad av varumärke' })} disabled={reject.isPending}>Neka</button>
                    </>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: '34px 24px', color: 'var(--muted)' }}>Inga ansökningar ännu. Väntar på att creators ska ansöka.</div>
          )}
        </div>
      )}
    </section>
  );
}

// ── Brand Applications overview ────────────────────────
function CampaignApplicationsSection({ campaignId, campaignName }: { campaignId: string; campaignName: string }) {
  const [expanded, setExpanded] = useState(false);
  const { data: applications, isLoading } = useCampaignApplications(campaignId, undefined, 1);
  const approve = useApproveApplication();
  const reject = useRejectApplication();
  const navigate = useNavigate();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const handleReject = async (id: string) => {
    const reason = rejectReason.trim();
    if (!reason) return;
    await reject.mutateAsync({ id, reason });
    setRejectingId(null);
    setRejectReason('');
  };

  const pendingCount = applications?.data.filter((a) => a.status === 'Pending').length ?? 0;
  const totalCount = applications?.totalCount ?? 0;

  if (!expanded) {
    return (
      <div className="vcamp" style={{ borderTop: 'none', padding: '16px 14px', border: '1px solid rgba(241,168,143,.16)', borderRadius: 16, marginBottom: 12, background: 'rgba(255,255,255,.55)' }}
        onClick={() => setExpanded(true)}>
        <span className="vcamp-thumb" style={{ background: grad(campaignName) }}><span className="brand-mono">{initial(campaignName)}</span></span>
        <div className="vcamp-main">
          <div className="vcamp-b" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{campaignName}
            {pendingCount > 0 && <span className="vcamp-tag prog">{pendingCount} NYA</span>}
          </div>
          <div className="vcamp-m">{totalCount} ansökning{totalCount === 1 ? '' : 'ar'}</div>
        </div>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="sec-head">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{campaignName}
          {pendingCount > 0 && <span className="badge green">{pendingCount} väntar</span>}
        </h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="view-all" onClick={() => navigate(`/brand/campaigns/${campaignId}`)}>Visa kampanj</button>
          <button className="view-all" onClick={() => setExpanded(false)}>Minimera</button>
        </div>
      </div>
      {isLoading ? <CardSkeleton rows={2} /> : applications?.data.length ? (
        applications.data.map((a: ApplicationItem) => (
          <div key={a.id} className="list-row" style={{ gap: 14 }}>
            <span className="mono" style={{ background: grad(a.creatorName) }}>{initial(a.creatorName)}</span>
            <div className="row-main" style={{ flex: 1 }}>
              <div className="t" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{a.creatorName}
                {a.creatorCategory && <span className="badge grey">{a.creatorCategory}</span>}
              </div>
              {a.tikTokUsername && <a href={`https://www.tiktok.com/@${a.tikTokUsername}`} target="_blank" rel="noopener noreferrer" className="s" style={{ color: '#C26A4A' }}>@{a.tikTokUsername}</a>}
              {a.message && <div className="s">{a.message}</div>}
              <div className="s" style={{ color: 'var(--muted-2)' }}>{formatDate(a.createdAt)}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 0 auto' }}>
              <StatusBadge status={a.status} />
              {a.status === 'Pending' && rejectingId !== a.id && (
                <>
                  <button className="btn-apply" style={{ width: 'auto', padding: '9px 16px', fontSize: 12.5 }} onClick={() => approve.mutateAsync({ id: a.id })} disabled={approve.isPending}>Godkänn</button>
                  <button className="btn-outline" style={{ padding: '9px 16px', fontSize: 12.5 }} onClick={() => { setRejectingId(a.id); setRejectReason(''); }} disabled={reject.isPending}>Neka</button>
                </>
              )}
              {a.status === 'Pending' && rejectingId === a.id && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="text" autoFocus value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Anledning…"
                    style={{ border: '1px solid rgba(241,168,143,.3)', borderRadius: 10, padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', background: 'rgba(255,255,255,.7)' }} />
                  <button className="btn-outline" style={{ padding: '9px 14px', fontSize: 12.5 }} onClick={() => handleReject(a.id)} disabled={reject.isPending || !rejectReason.trim()}>Bekräfta</button>
                  <button className="view-all" onClick={() => { setRejectingId(null); setRejectReason(''); }}>Avbryt</button>
                </div>
              )}
            </div>
          </div>
        ))
      ) : (
        <div style={{ padding: '24px 6px', textAlign: 'center', color: 'var(--muted)' }}>Inga creators har ansökt till denna kampanj ännu.</div>
      )}
    </div>
  );
}

export function BrandApplicationsPage() {
  const { data, isLoading } = useBrandCampaigns(undefined, 1);

  if (isLoading) return <LoadingSpinner />;
  const campaigns = data?.data ?? [];

  // Only show campaigns that are Active or Paused (where applications make sense)
  const relevantCampaigns = campaigns.filter((c) => ['Active', 'Paused', 'Draft'].includes(c.status));

  return (
    <section className="view active reveal">
      <div className="page-head">
        <div>
          <h1 className="page-title">Ansökningar</h1>
          <p className="page-sub">Hantera ansökningar från creators till dina kampanjer. Godkänn de som passar din brief, neka resten.</p>
        </div>
      </div>
      {relevantCampaigns.length ? (
        relevantCampaigns.map((c) => (
          <CampaignApplicationsSection key={c.id} campaignId={c.id} campaignName={c.name} />
        ))
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '54px 24px' }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Inga kampanjer</div>
          <div style={{ color: 'var(--muted)', fontSize: 14, marginTop: 8 }}>Skapa en kampanj för att börja ta emot ansökningar.</div>
        </div>
      )}
    </section>
  );
}

// ── Brand Settings ─────────────────────────────────────
export function BrandSettingsPage() {
  const { data: profile, isLoading } = useBrandProfile();
  const updateProfile = useUpdateBrandProfile();
  const changePassword = useChangePassword();
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');
  const [profileForm, setProfileForm] = useState({ companyName: '', website: '', industry: '', description: '', contactPhone: '', logoUrl: null as string | null });
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [profileError, setProfileError] = useState('');
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState('');
  const [pwError, setPwError] = useState('');

  // Populate form once profile loads
  if (profile && !profileLoaded) {
    setProfileForm({
      companyName: profile.companyName ?? '',
      website: profile.website ?? '',
      industry: profile.industry ?? '',
      description: profile.description ?? '',
      contactPhone: profile.contactPhone ?? '',
      logoUrl: profile.logoUrl ?? null,
    });
    setProfileLoaded(true);
  }

  const handleProfileSave = async (e: ReactFormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileMsg('');
    try {
      // null logo means "removed" — send empty string so the backend clears it.
      await updateProfile.mutateAsync({ ...profileForm, logoUrl: profileForm.logoUrl ?? '' });
      setProfileMsg('Profilen sparades!');
    } catch {
      setProfileError('Kunde inte spara profilen.');
    }
  };

  const handlePasswordChange = async (e: ReactFormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwMsg('');
    if (pwForm.newPassword !== pwForm.confirm) {
      setPwError('Lösenorden matchar inte.');
      return;
    }
    if (pwForm.newPassword.length < 8) {
      setPwError('Lösenordet måste vara minst 8 tecken.');
      return;
    }
    try {
      await changePassword.mutateAsync({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      setPwMsg('Lösenordet ändrades!');
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message;
      setPwError(msg ?? 'Kunde inte ändra lösenordet. Kontrollera ditt nuvarande lösenord.');
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <section className="view active reveal">
      <div className="page-head">
        <div>
          <h1 className="page-title">Inställningar</h1>
          <p className="page-sub">Hantera er företagsprofil och säkerhet. {profile?.status === 'Approved' ? 'Verifierat konto.' : profile?.status}</p>
        </div>
      </div>

      <div className="tabs">
        {([['profile', 'Profil'], ['security', 'Lösenord']] as const).map(([key, label]) => (
          <button key={key} className={`tab${activeTab === key ? ' active' : ''}`} onClick={() => setActiveTab(key)}>{label}</button>
        ))}
      </div>

      {activeTab === 'profile' && (
        <div className="card" style={{ maxWidth: 720 }}>
          <div className="sec-head"><h3>Företagsprofil</h3></div>
          <form onSubmit={handleProfileSave} className="form-grid">
            <div className="field full">
              <ImagePicker label="Logotyp" shape="rounded" value={profileForm.logoUrl}
                onChange={(v) => setProfileForm({ ...profileForm, logoUrl: v })}
                hint="Visas för kreatörer på era kampanjer och PR-erbjudanden." />
            </div>
            <div className="field full"><label>Företagsnamn *</label><input type="text" value={profileForm.companyName} required onChange={e => setProfileForm({ ...profileForm, companyName: e.target.value })} /></div>
            <div className="field"><label>Bransch</label>
              <select value={profileForm.industry} onChange={e => setProfileForm({ ...profileForm, industry: e.target.value })}>
                {['Övrigt', 'Mode', 'Skönhet', 'Mat & Dryck', 'Teknik', 'Gaming', 'Sport', 'Musik', 'Resor', 'Hälsa'].map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div className="field"><label>Telefon</label><input type="tel" value={profileForm.contactPhone} onChange={e => setProfileForm({ ...profileForm, contactPhone: e.target.value })} /></div>
            <div className="field full"><label>Webbplats</label><input type="url" value={profileForm.website} placeholder="https://mittföretag.se" onChange={e => setProfileForm({ ...profileForm, website: e.target.value })} /></div>
            <div className="field full"><label>Beskrivning</label><textarea value={profileForm.description} rows={3} onChange={e => setProfileForm({ ...profileForm, description: e.target.value })} placeholder="Berätta om ert företag..." /></div>
            <div className="field full">
              {profileError && <p style={{ color: 'var(--red)', fontSize: 13 }}>{profileError}</p>}
              {profileMsg && <p style={{ color: '#2f9d5b', fontSize: 13 }}>{profileMsg}</p>}
              <button type="submit" className="btn-apply" style={{ width: 'auto', padding: '12px 22px', marginTop: 4 }} disabled={updateProfile.isPending}>{updateProfile.isPending ? 'Sparar…' : 'Spara ändringar'}</button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="card" style={{ maxWidth: 720 }}>
          <div className="sec-head"><h3>Byt lösenord</h3></div>
          <form onSubmit={handlePasswordChange} className="form-grid">
            <div className="field full"><label>Nuvarande lösenord</label><input type="password" value={pwForm.currentPassword} required autoComplete="current-password" onChange={e => setPwForm({ ...pwForm, currentPassword: e.target.value })} /></div>
            <div className="field"><label>Nytt lösenord</label><input type="password" value={pwForm.newPassword} required autoComplete="new-password" minLength={8} onChange={e => setPwForm({ ...pwForm, newPassword: e.target.value })} /></div>
            <div className="field"><label>Bekräfta nytt lösenord</label><input type="password" value={pwForm.confirm} required autoComplete="new-password" onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })} /></div>
            <div className="field full">
              {pwError && <p style={{ color: 'var(--red)', fontSize: 13 }}>{pwError}</p>}
              {pwMsg && <p style={{ color: '#2f9d5b', fontSize: 13 }}>{pwMsg}</p>}
              <button type="submit" className="btn-apply" style={{ width: 'auto', padding: '12px 22px', marginTop: 4 }} disabled={changePassword.isPending}>{changePassword.isPending ? 'Ändrar…' : 'Byt lösenord'}</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

// ── Brand Assignment Detail (chat + review per creator) ─
export function BrandAssignmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: assignment, isLoading } = useAssignmentDetail(id!);

  if (isLoading || !assignment) return <LoadingSpinner />;

  return (
    <section className="view active reveal" style={{ maxWidth: 760 }}>
      <button onClick={() => navigate(-1)} className="view-all" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg> Tillbaka
      </button>
      <div className="page-head">
        <div><h1 className="page-title" style={{ fontSize: 32 }}>{assignment.campaignName} — {assignment.creatorName ?? 'Creator'}</h1></div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <StatusBadge status={assignment.status} />
          <span className="text-sm text-muted-foreground">{formatNumber(assignment.totalVerifiedViews)} views</span>
          <span className="text-sm text-muted-foreground">{formatCurrency(assignment.currentPayoutAmount)}</span>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="sec-head"><h3>Meddelanden</h3></div>
        <ChatPanel assignmentId={assignment.id} />
      </div>

      <div className="card">
        <div className="sec-head"><h3>Omdöme</h3></div>
        <ReviewSection assignmentId={assignment.id} revieweeUserId={assignment.creatorUserId} assignmentCompleted={assignment.status === 'Completed'} />
      </div>
    </section>
  );
}
