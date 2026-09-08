import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { t } from '@/lib/i18n';
import { formatDate, formatNumber } from '@/lib/utils';
import { useToast, CardSkeleton, PageSkeleton } from '@/components/vyrle/Toast';
import { useCreatorPublicProfile } from '@/hooks/api';
import {
  useUgcBrandCampaigns, useUgcBrandCampaign, useSaveUgcCampaign, useUgcCampaignAction, useGenerateUgcBrief,
  useUgcCampaignApplications, useUgcApplicationDecision, useUgcCollabs, useUgcDirectInvite,
  formatOre, kronorToOre, oreToKronor, collabStatusLabel, COLLAB_TONE, COMPENSATION_LABEL, RIGHTS_LABEL, RIGHTS_HINT, UGC_CATEGORIES, UGC_REGIONS, apiError,
  type UgcBrief, type UgcCampaign, type UpsertUgcCampaign, type UgcCollabListItem, type UgcApplication,
} from '@/hooks/ugc';

const btn: React.CSSProperties = { width: 'auto', padding: '11px 20px', fontSize: 13.5 };
const input: React.CSSProperties = { width: '100%', minWidth: 0 };
const initial = (s: string) => (s?.[0] || '?').toUpperCase();

// ═══════════════════════════════════════════════════════════════════
// Overview: campaigns + what needs attention
// ═══════════════════════════════════════════════════════════════════
export function UgcBrandHomePage() {
  const navigate = useNavigate();
  const { data: campaigns = [], isLoading } = useUgcBrandCampaigns();
  const { data: collabs = [] } = useUgcCollabs('brand');
  const action = useUgcCampaignAction();
  const toast = useToast();

  const live = campaigns.filter((c) => c.status === 'Published');
  const drafts = campaigns.filter((c) => c.status === 'Draft');
  const closed = campaigns.filter((c) => c.status === 'Closed');
  const needsMe = collabs.filter((c) => c.needsMyAction);
  const active = collabs.filter((c) => !['Paid', 'Cancelled'].includes(c.status));
  const spent = collabs.filter((c) => c.status === 'Paid').reduce((s, c) => s + c.brandTotalOre, 0);

  return (
    <section className="view active reveal">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('Beställ')} <em>{t('video')}</em></h1>
          <p className="page-sub">{t('Korta UGC-videor till fast pris. Ni betalar när ni anlitar, pengarna hålls av VYRLE tills ni godkänt leveransen.')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn-outline" style={btn} onClick={() => navigate('/brand/ugc/pipeline')}>{t('Pipeline')} {needsMe.length > 0 && <span className="vy-badge neg" style={{ marginLeft: 6 }}>{needsMe.length}</span>}</button>
          <button className="btn-apply" style={btn} onClick={() => navigate('/brand/ugc/campaigns/new')}>+ {t('Ny beställning')}</button>
        </div>
      </div>

      <div className="vstat-row">
        <div className="card vstat" style={{ background: 'linear-gradient(160deg,#fff,#FFF6F0)' }}><div className="vstat-lbl">{t('Öppna beställningar')}</div><div className="vstat-val">{live.length}</div><div className="vstat-sub"><span className="vmut">{live.reduce((s, c) => s + c.pendingApplicationCount, 0)} {t('nya bud')}</span></div></div>
        <div className="card vstat"><div className="vstat-lbl">{t('Pågående uppdrag')}</div><div className="vstat-val">{active.length}</div><div className="vstat-sub"><span className="vmut">{needsMe.length} {t('väntar på dig')}</span></div></div>
        <div className="card vstat"><div className="vstat-lbl">{t('Levererade videos')}</div><div className="vstat-val">{collabs.filter((c) => c.status === 'Paid').length}</div><div className="vstat-sub"><span className="vmut">{formatOre(spent)} {t('totalt')}</span></div></div>
      </div>

      {needsMe.length > 0 && (
        <div className="card" style={{ marginBottom: 16, border: '1px solid rgba(212,155,46,.45)', background: 'linear-gradient(160deg,#fff,#FFF9F0)' }}>
          <div className="sec-head"><h3>{t('Väntar på dig')}</h3></div>
          {needsMe.map((c) => <CollabRow key={c.id} c={c} role="brand" onOpen={() => navigate(`/brand/ugc/collabs/${c.id}`)} />)}
        </div>
      )}

      {isLoading ? <CardSkeleton rows={3} /> : campaigns.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '54px 24px' }}>
          <div style={{ fontSize: 30, marginBottom: 10 }} aria-hidden>🎬</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{t('Ingen beställning ännu')}</div>
          <div style={{ color: 'var(--muted)', fontSize: 14, marginTop: 8, maxWidth: 460, marginInline: 'auto', lineHeight: 1.6 }}>
            {t('Skriv en brief (eller låt AI:n göra det), sätt en budget per video och publicera. Creators som passar lägger bud — ni väljer.')}
          </div>
          <button className="btn-apply" style={{ ...btn, marginTop: 16 }} onClick={() => navigate('/brand/ugc/campaigns/new')}>{t('Skapa första beställningen')}</button>
        </div>
      ) : (
        <>
          {[['Öppna', live], ['Utkast', drafts], ['Stängda', closed]].map(([label, list]) => (list as UgcCampaign[]).length > 0 && (
            <div className="card" key={label as string} style={{ marginBottom: 14 }}>
              <div className="sec-head"><h3>{t(label as string)}</h3><span style={{ fontSize: 13, color: 'var(--muted)' }}>{(list as UgcCampaign[]).length}</span></div>
              {(list as UgcCampaign[]).map((c) => (
                <div key={c.id} className="vcamp" onClick={() => navigate(c.status === 'Draft' ? `/brand/ugc/campaigns/${c.id}/edit` : `/brand/ugc/campaigns/${c.id}`)}>
                  <span className="vcamp-thumb"><span className="brand-mono">{initial(c.title)}</span></span>
                  <div className="vcamp-main">
                    <div className="vcamp-b" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {c.title}
                      {c.pendingApplicationCount > 0 && <span className="vy-badge pend">{c.pendingApplicationCount} {t('nya bud')}</span>}
                      {c.briefGeneratedByAi && <span className="vy-badge info">AI</span>}
                    </div>
                    <div className="vcamp-m">
                      {t(COMPENSATION_LABEL[c.compensation])} · {c.compensation === 'ProductExchange' ? c.productDescription : `${formatOre(c.budgetMinOre)}–${formatOre(c.budgetMaxOre)} / video`} · {c.hiredCount}/{c.slots} {t('anlitade')} · {formatDate(c.createdAt)}
                    </div>
                  </div>
                  {c.status === 'Draft' && (
                    <button className="btn-apply" style={{ ...btn, padding: '8px 14px', fontSize: 12.5 }} onClick={(e) => { e.stopPropagation(); action.mutate({ id: c.id, action: 'publish' }, { onSuccess: () => toast.push(t('Publicerad — creators som matchar får en notis.'), 'success'), onError: (err) => toast.push(apiError(err, t('Kunde inte publicera')), 'error') }); }}>
                      {t('Publicera')}
                    </button>
                  )}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
                </div>
              ))}
            </div>
          ))}
        </>
      )}
    </section>
  );
}

export function CollabRow({ c, role, onOpen }: { c: UgcCollabListItem; role: 'brand' | 'creator' | 'admin'; onOpen: () => void }) {
  const who = role === 'brand' ? c.creatorName : c.brandName;
  const avatar = role === 'brand' ? c.creatorAvatarUrl : c.brandLogoUrl;
  return (
    <div className="vcamp" onClick={onOpen}>
      {avatar ? <img src={avatar} alt="" className="vcamp-thumb" style={{ objectFit: 'cover' }} /> : <span className="vcamp-thumb"><span className="brand-mono">{initial(who)}</span></span>}
      <div className="vcamp-main">
        <div className="vcamp-b" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {c.title}
          <span className={`vy-badge ${COLLAB_TONE[c.status] ?? 'neu'}`}>{collabStatusLabel(c.status)}</span>
          {c.unreadMessages > 0 && <span className="vy-badge neg">{c.unreadMessages} ✉</span>}
        </div>
        <div className="vcamp-m">{who} · {c.compensation === 'ProductExchange' ? t('Produktbyte') : formatOre(role === 'brand' ? c.brandTotalOre : c.agreedAmountOre)}{c.deadlineAt && !['Paid', 'Cancelled', 'Submitted', 'Approved'].includes(c.status) ? ` · ${t('deadline')} ${formatDate(c.deadlineAt)}` : ''}{c.autoApproveAt && c.status === 'Submitted' ? ` · ${t('auto-godkänns')} ${formatDate(c.autoApproveAt)}` : ''}</div>
      </div>
      {c.needsMyAction && <span className="vy-badge pend">{t('Din tur')}</span>}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Pipeline (kanban)
// ═══════════════════════════════════════════════════════════════════
const COLUMNS: { key: string; statuses: string[] }[] = [
  { key: 'Inbjudna', statuses: ['Invited'] },
  { key: 'Pågår', statuses: ['Accepted', 'InProgress'] },
  { key: 'Att granska', statuses: ['Submitted'] },
  { key: 'Revision', statuses: ['RevisionRequested'] },
  { key: 'Tvist', statuses: ['Disputed'] },
  { key: 'Klara', statuses: ['Approved', 'Paid'] },
  { key: 'Avbrutna', statuses: ['Cancelled'] },
];

export function UgcPipelinePage({ role }: { role: 'brand' | 'creator' }) {
  const navigate = useNavigate();
  const { data: collabs = [], isLoading } = useUgcCollabs(role);
  const base = role === 'brand' ? '/brand/ugc/collabs' : '/creator/ugc/collabs';

  return (
    <section className="view active reveal">
      <div className="page-head">
        <div>
          <h1 className="page-title">{role === 'brand' ? t('Pipeline') : t('Mina')} <em>{role === 'brand' ? '' : t('videouppdrag')}</em></h1>
          <p className="page-sub">{role === 'brand' ? t('Varje uppdrag från inbjudan till betald leverans. Klicka på ett kort för att granska, chatta eller godkänna.') : t('Dina uppdrag från inbjudan till utbetalning.')}</p>
        </div>
      </div>
      {isLoading ? <CardSkeleton rows={4} /> : collabs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '54px 24px' }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{t('Inga uppdrag ännu')}</div>
          <div style={{ color: 'var(--muted)', fontSize: 14, marginTop: 8 }}>{role === 'brand' ? t('Anlita en creator från ett bud eller bjud in direkt från Hitta creators.') : t('Lägg bud på en beställning så dyker uppdraget upp här när du blir vald.')}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, alignItems: 'flex-start' }}>
          {COLUMNS.map((col) => {
            const items = collabs.filter((c) => col.statuses.includes(c.status));
            if (items.length === 0 && ['Tvist', 'Avbrutna'].includes(col.key)) return null;
            return (
              <div key={col.key} style={{ flex: '0 0 270px', minWidth: 270 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '0 4px' }}>
                  <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)' }}>{t(col.key)}</span>
                  <span className="vy-badge neu">{items.length}</span>
                </div>
                <div style={{ display: 'grid', gap: 10 }}>
                  {items.map((c) => {
                    const who = role === 'brand' ? c.creatorName : c.brandName;
                    return (
                      <div key={c.id} className="card" onClick={() => navigate(`${base}/${c.id}`)} style={{ cursor: 'pointer', padding: 14, border: c.needsMyAction ? '1px solid rgba(212,155,46,.5)' : undefined }}>
                        <div style={{ fontWeight: 700, fontSize: 14, wordBreak: 'break-word' }}>{c.title}</div>
                        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>{who}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: 13 }}>{c.compensation === 'ProductExchange' ? t('Produkt') : formatOre(role === 'brand' ? c.brandTotalOre : c.agreedAmountOre)}</span>
                          <span className={`vy-badge ${COLLAB_TONE[c.status] ?? 'neu'}`} style={{ fontSize: 10.5 }}>{collabStatusLabel(c.status)}</span>
                        </div>
                        {(c.deadlineAt && ['Accepted', 'InProgress', 'RevisionRequested'].includes(c.status)) && <div style={{ fontSize: 11.5, color: '#9c4f31', marginTop: 6 }}>⏱ {t('deadline')} {formatDate(c.deadlineAt)}</div>}
                        {c.autoApproveAt && c.status === 'Submitted' && <div style={{ fontSize: 11.5, color: '#9c6b1c', marginTop: 6 }}>⏱ {t('auto-godkänns')} {formatDate(c.autoApproveAt)}</div>}
                        {c.unreadMessages > 0 && <div style={{ fontSize: 11.5, color: '#b3402f', marginTop: 6, fontWeight: 700 }}>✉ {c.unreadMessages} {t('olästa')}</div>}
                        {c.needsMyAction && <div style={{ fontSize: 11.5, color: '#9c6b1c', marginTop: 6, fontWeight: 700 }}>→ {t('Din tur')}</div>}
                      </div>
                    );
                  })}
                  {items.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--muted-2)', padding: '12px 6px' }}>—</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Campaign builder (create / edit draft)
// ═══════════════════════════════════════════════════════════════════
const emptyBrief: UgcBrief = { goal: '', format: '9:16 vertikal, TikTok/Reels', lengthSeconds: 30, videoCount: 1, hooks: [], callToAction: '', referenceUrls: [], dos: [], donts: [], extraNotes: '' };

export function UgcCampaignBuilderPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: existing, isLoading } = useUgcBrandCampaign(id ?? '');
  const save = useSaveUgcCampaign();
  const action = useUgcCampaignAction();
  const gen = useGenerateUgcBrief();

  const [form, setForm] = useState<UpsertUgcCampaign>({
    title: '', brief: emptyBrief, region: '', categories: [], minFollowers: null, maxFollowers: null,
    compensation: 'Paid', budgetMinOre: 100_000, budgetMaxOre: 250_000, productDescription: '', productValueOre: null,
    rightsPackage: 'OrganicPlusAds6M', deadlineDays: 7, slots: 1, briefGeneratedByAi: false,
  });
  const [ai, setAi] = useState({ open: false, goal: '', productOrService: '', audience: '', tone: '' });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (existing && !loaded) {
      setForm({
        title: existing.title, brief: { ...existing.brief, extraNotes: existing.brief.extraNotes ?? '' }, region: existing.region ?? '', categories: existing.categories,
        minFollowers: existing.minFollowers, maxFollowers: existing.maxFollowers, compensation: existing.compensation,
        budgetMinOre: existing.budgetMinOre, budgetMaxOre: existing.budgetMaxOre, productDescription: existing.productDescription ?? '',
        productValueOre: existing.productValueOre, rightsPackage: existing.rightsPackage, deadlineDays: existing.deadlineDays, slots: existing.slots, briefGeneratedByAi: existing.briefGeneratedByAi,
      });
      setLoaded(true);
    }
  }, [existing, loaded]);

  const set = (patch: Partial<UpsertUgcCampaign>) => setForm((f) => ({ ...f, ...patch }));
  const setBrief = (patch: Partial<UgcBrief>) => setForm((f) => ({ ...f, brief: { ...f.brief, ...patch } }));
  const paid = form.compensation !== 'ProductExchange';

  const submit = async (publish: boolean) => {
    try {
      const saved = await save.mutateAsync({ id, body: { ...form, region: form.region || null, productDescription: form.productDescription || null } });
      if (publish) {
        await action.mutateAsync({ id: saved.id, action: 'publish' });
        toast.push(t('Publicerad — creators som matchar får en notis.'), 'success');
        navigate(`/brand/ugc/campaigns/${saved.id}`);
      } else {
        toast.push(t('Utkastet är sparat'), 'success');
        navigate('/brand/ugc');
      }
    } catch (e) { toast.push(apiError(e, t('Kunde inte spara')), 'error'); }
  };

  const runAi = () => gen.mutate({ goal: ai.goal, productOrService: ai.productOrService, audience: ai.audience, tone: ai.tone }, {
    onSuccess: (b) => { set({ brief: { ...b, extraNotes: b.extraNotes ?? '' }, briefGeneratedByAi: true }); setAi((a) => ({ ...a, open: false })); toast.push(t('Briefen är skriven — läs igenom och justera.'), 'success'); },
    onError: (e) => toast.push(apiError(e, t('AI:n kunde inte skriva briefen')), 'error'),
  });

  if (id && isLoading) return <PageSkeleton />;

  return (
    <section className="view active reveal">
      <button onClick={() => navigate('/brand/ugc')} className="view-all" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>← {t('Beställ video')}</button>
      <div className="page-head">
        <div>
          <h1 className="page-title">{id ? t('Redigera') : t('Ny')} <em>{t('beställning')}</em></h1>
          <p className="page-sub">{t('En bra brief är kort, konkret och filmbar. Creators lägger bud inom er budget — ni betalar först när ni anlitar.')}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="card">
            <div className="sec-head" style={{ flexWrap: 'wrap', gap: 8 }}>
              <h3>{t('Brief')}</h3>
              <button className="btn-outline" style={{ ...btn, padding: '8px 14px', fontSize: 12.5 }} onClick={() => setAi((a) => ({ ...a, open: !a.open }))}>✦ {t('Generera brief med AI')}</button>
            </div>
            {ai.open && (
              <div style={{ padding: '14px 16px', borderRadius: 14, background: 'rgba(237,225,255,.35)', border: '1px solid rgba(156,125,224,.3)', marginBottom: 14 }}>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 10 }}>{t('AI:n använder er företagsprofil (namn, bransch, beskrivning) plus det ni skriver här. Resultatet är ett utkast ni redigerar.')}</div>
                <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                  <div className="field"><label>{t('Mål')}</label><input style={input} value={ai.goal} onChange={(e) => setAi({ ...ai, goal: e.target.value })} placeholder={t('t.ex. fler lunchgäster på vardagar')} /></div>
                  <div className="field"><label>{t('Produkt/tjänst')}</label><input style={input} value={ai.productOrService} onChange={(e) => setAi({ ...ai, productOrService: e.target.value })} placeholder={t('t.ex. nya lunchmenyn')} /></div>
                  <div className="field"><label>{t('Målgrupp')}</label><input style={input} value={ai.audience} onChange={(e) => setAi({ ...ai, audience: e.target.value })} placeholder={t('t.ex. kontorsfolk på Södermalm')} /></div>
                  <div className="field"><label>{t('Ton')}</label><input style={input} value={ai.tone} onChange={(e) => setAi({ ...ai, tone: e.target.value })} placeholder={t('t.ex. varm, lite humor')} /></div>
                </div>
                <button className="btn-apply" style={{ ...btn, marginTop: 10 }} disabled={gen.isPending} onClick={runAi}>{gen.isPending ? t('Skriver…') : t('Skriv briefen')}</button>
              </div>
            )}
            <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
              <div className="field"><label>{t('Titel')} *</label><input style={input} value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder={t('t.ex. Lunchdeal-video för TikTok')} maxLength={200} /></div>
              <div className="field"><label>{t('Mål')} *</label><textarea rows={2} value={form.brief.goal} onChange={(e) => setBrief({ goal: e.target.value })} placeholder={t('Vad ska videon åstadkomma?')} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                <div className="field"><label>{t('Format')} *</label><input style={input} value={form.brief.format} onChange={(e) => setBrief({ format: e.target.value })} /></div>
                <div className="field"><label>{t('Längd (sek)')}</label><input style={input} type="number" min={5} max={180} value={form.brief.lengthSeconds} onChange={(e) => setBrief({ lengthSeconds: Number(e.target.value) })} /></div>
                <div className="field"><label>{t('Antal videor')}</label><input style={input} type="number" min={1} max={10} value={form.brief.videoCount} onChange={(e) => setBrief({ videoCount: Number(e.target.value) })} /></div>
              </div>
              <ListField label={t('Hooks (första meningen i bild)')} values={form.brief.hooks} onChange={(v) => setBrief({ hooks: v })} placeholder={t('Visste du att…')} />
              <div className="field"><label>{t('Call to action')} *</label><input style={input} value={form.brief.callToAction} onChange={(e) => setBrief({ callToAction: e.target.value })} placeholder={t('t.ex. Boka bord via länken i bion')} /></div>
              <ListField label={t('Gör')} values={form.brief.dos} onChange={(v) => setBrief({ dos: v })} placeholder={t('t.ex. Visa menyn i bild')} />
              <ListField label={t('Undvik')} values={form.brief.donts} onChange={(v) => setBrief({ donts: v })} placeholder={t('t.ex. Ingen musik med upphovsrätt')} />
              <ListField label={t('Referenser (länkar)')} values={form.brief.referenceUrls} onChange={(v) => setBrief({ referenceUrls: v })} placeholder="https://www.tiktok.com/@…/video/…" />
              <div className="field"><label>{t('Övrigt')}</label><textarea rows={2} value={form.brief.extraNotes ?? ''} onChange={(e) => setBrief({ extraNotes: e.target.value })} /></div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <div className="card">
            <div className="sec-head"><h3>{t('Ersättning & rättigheter')}</h3></div>
            <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
              <div className="field"><label>{t('Ersättningstyp')}</label>
                <select value={form.compensation} onChange={(e) => set({ compensation: e.target.value })}>
                  {Object.entries(COMPENSATION_LABEL).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
                </select>
              </div>
              {paid && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="field"><label>{t('Min per video (kr)')}</label><input style={input} inputMode="decimal" value={oreToKronor(form.budgetMinOre)} onChange={(e) => set({ budgetMinOre: kronorToOre(e.target.value) })} /></div>
                  <div className="field"><label>{t('Max per video (kr)')}</label><input style={input} inputMode="decimal" value={oreToKronor(form.budgetMaxOre)} onChange={(e) => set({ budgetMaxOre: kronorToOre(e.target.value) })} /></div>
                </div>
              )}
              {paid && <FeeNote amountOre={form.budgetMaxOre} />}
              {form.compensation !== 'Paid' && (
                <>
                  <div className="field"><label>{t('Produkt/tjänst creatorn får')} *</label><input style={input} value={form.productDescription ?? ''} onChange={(e) => set({ productDescription: e.target.value })} placeholder={t('t.ex. Middag för två')} /></div>
                  <div className="field"><label>{t('Ungefärligt värde (kr)')}</label><input style={input} inputMode="decimal" value={oreToKronor(form.productValueOre)} onChange={(e) => set({ productValueOre: kronorToOre(e.target.value) || null })} /></div>
                </>
              )}
              <div className="field"><label>{t('Rättighetspaket')}</label>
                <select value={form.rightsPackage} onChange={(e) => set({ rightsPackage: e.target.value })}>
                  {Object.entries(RIGHTS_LABEL).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
                </select>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{t(RIGHTS_HINT[form.rightsPackage])}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field"><label>{t('Leveranstid (dagar)')}</label><input style={input} type="number" min={1} max={60} value={form.deadlineDays} onChange={(e) => set({ deadlineDays: Number(e.target.value) })} /></div>
                <div className="field"><label>{t('Antal creators')}</label><input style={input} type="number" min={1} max={50} value={form.slots} onChange={(e) => set({ slots: Number(e.target.value) })} /></div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="sec-head"><h3>{t('Vilka creators')}</h3></div>
            <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
              <div className="field"><label>{t('Region')}</label>
                <select value={form.region ?? ''} onChange={(e) => set({ region: e.target.value })}><option value="">{t('Var som helst')}</option>{UGC_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}</select>
              </div>
              <div className="field"><label>{t('Kategorier')}</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {UGC_CATEGORIES.map((c) => { const on = form.categories?.includes(c); return <button key={c} type="button" className={`tag ${on ? 'g' : ''}`} style={{ cursor: 'pointer', border: on ? undefined : '1px solid rgba(183,188,200,.4)', background: on ? undefined : 'transparent' }} onClick={() => set({ categories: on ? form.categories!.filter((x) => x !== c) : [...(form.categories ?? []), c] })}>{c}</button>; })}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field"><label>{t('Min följare')}</label><input style={input} type="number" min={0} value={form.minFollowers ?? ''} onChange={(e) => set({ minFollowers: e.target.value ? Number(e.target.value) : null })} /></div>
                <div className="field"><label>{t('Max följare')}</label><input style={input} type="number" min={0} value={form.maxFollowers ?? ''} onChange={(e) => set({ maxFollowers: e.target.value ? Number(e.target.value) : null })} /></div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn-apply" style={btn} disabled={save.isPending || action.isPending} onClick={() => submit(true)}>{t('Publicera')}</button>
            <button className="btn-outline" style={btn} disabled={save.isPending} onClick={() => submit(false)}>{t('Spara utkast')}</button>
            {id && <button className="view-all" style={{ color: 'var(--red)' }} onClick={() => action.mutate({ id, action: 'delete' }, { onSuccess: () => navigate('/brand/ugc') })}>{t('Ta bort utkast')}</button>}
          </div>
        </div>
      </div>
    </section>
  );
}

function FeeNote({ amountOre }: { amountOre: number }) {
  const fee = Math.round(amountOre * 0.15);
  return (
    <div style={{ fontSize: 12.5, color: 'var(--muted)', padding: '10px 12px', borderRadius: 12, background: 'rgba(255,244,236,.7)', lineHeight: 1.55 }}>
      {t('Vid')} {formatOre(amountOre)} {t('till creatorn betalar ni')} <strong style={{ color: '#0B0F17' }}>{formatOre(amountOre + fee)}</strong> {t('inkl. VYRLE:s avgift')} (15 %, {formatOre(fee)}). {t('Creatorn får exakt sitt bud.')}
    </div>
  );
}

function ListField({ label, values, onChange, placeholder }: { label: string; values: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState('');
  const add = () => { const v = draft.trim(); if (!v) return; onChange([...values, v]); setDraft(''); };
  return (
    <div className="field">
      <label>{label}</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: values.length ? 6 : 0 }}>
        {values.map((v, i) => <span key={i} className="tag g" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', maxWidth: '100%' }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{v}</span><button type="button" onClick={() => onChange(values.filter((_, j) => j !== i))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}>×</button></span>)}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input style={{ flex: 1, minWidth: 0 }} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} placeholder={placeholder} />
        <button type="button" className="btn-outline" style={{ padding: '8px 14px', fontSize: 12.5 }} onClick={add}>+</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Campaign detail: bids ranked, preselect / hire
// ═══════════════════════════════════════════════════════════════════
export function UgcBrandCampaignPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: c, isLoading } = useUgcBrandCampaign(id);
  const { data: apps = [] } = useUgcCampaignApplications(id);
  const decide = useUgcApplicationDecision();
  const action = useUgcCampaignAction();
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [note, setNote] = useState('');

  if (isLoading || !c) return <PageSkeleton />;

  const run = (appId: string, act: 'preselect' | 'reject' | 'hire', n?: string) =>
    decide.mutate({ id: appId, action: act, note: n }, {
      onSuccess: (res: any) => {
        if (act === 'hire') { toast.push(t('Anlitad! Läs och acceptera kontraktet för att betala.'), 'success'); navigate(`/brand/ugc/collabs/${res.id}`); }
        else toast.push(act === 'preselect' ? t('Markerad som favorit') : t('Budet är avböjt'), 'success');
        setRejecting(null); setNote('');
      },
      onError: (e) => toast.push(apiError(e, t('Något gick fel')), 'error'),
    });

  const open = apps.filter((a) => a.status === 'Applied' || a.status === 'Preselected');
  const done = apps.filter((a) => !open.includes(a));

  return (
    <section className="view active reveal">
      <button onClick={() => navigate('/brand/ugc')} className="view-all" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>← {t('Beställ video')}</button>
      <div className="page-head">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>{c.title} <span className={`vy-badge ${c.status === 'Published' ? 'pos' : c.status === 'Draft' ? 'pend' : 'neu'}`}>{t(c.status === 'Published' ? 'Öppen' : c.status === 'Draft' ? 'Utkast' : 'Stängd')}</span></h1>
          <p className="page-sub">{t(COMPENSATION_LABEL[c.compensation])} · {c.compensation === 'ProductExchange' ? c.productDescription : `${formatOre(c.budgetMinOre)}–${formatOre(c.budgetMaxOre)} / video`} · {t(RIGHTS_LABEL[c.rightsPackage])} · {c.deadlineDays} {t('dagars leverans')} · {c.hiredCount}/{c.slots} {t('anlitade')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {c.status === 'Draft' && <Link to={`/brand/ugc/campaigns/${c.id}/edit`} className="btn-outline" style={{ ...btn, textDecoration: 'none' }}>{t('Redigera')}</Link>}
          {c.status === 'Draft' && <button className="btn-apply" style={btn} onClick={() => action.mutate({ id: c.id, action: 'publish' }, { onSuccess: () => toast.push(t('Publicerad'), 'success'), onError: (e) => toast.push(apiError(e, t('Kunde inte publicera')), 'error') })}>{t('Publicera')}</button>}
          {c.status === 'Published' && <button className="btn-outline" style={btn} onClick={() => action.mutate({ id: c.id, action: 'close' }, { onSuccess: () => toast.push(t('Stängd'), 'success') })}>{t('Stäng beställningen')}</button>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 16, alignItems: 'start' }}>
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="sec-head"><h3>{t('Bud')}</h3><span style={{ fontSize: 13, color: 'var(--muted)' }}>{open.length} {t('öppna')} · {t('sorterade på leveranshistorik, geografi och engagemang')}</span></div>
          {open.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 13.5, padding: '8px 0' }}>{c.status === 'Published' ? t('Inga bud ännu — creators som matchar har fått en notis.') : t('Inga öppna bud.')}</div>}
          {open.map((a) => (
            <BidRow key={a.id} a={a} onOpenProfile={() => navigate(`/brand/creators/${a.creatorProfileId}`)}>
              {rejecting === a.id ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('Anledning (valfritt)')} style={{ flex: '1 1 160px', minWidth: 0 }} />
                  <button className="btn-outline" style={{ ...btn, padding: '8px 14px', fontSize: 12.5, borderColor: 'var(--red)', color: 'var(--red)' }} disabled={decide.isPending} onClick={() => run(a.id, 'reject', note)}>{t('Avböj')}</button>
                  <button className="view-all" onClick={() => setRejecting(null)}>{t('Avbryt')}</button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn-apply" style={{ ...btn, padding: '9px 16px', fontSize: 12.5 }} disabled={decide.isPending || c.hiredCount >= c.slots} onClick={() => run(a.id, 'hire')}>{t('Anlita')} {a.bidOre > 0 ? formatOre(a.bidOre) : ''}</button>
                  {a.status !== 'Preselected' && <button className="btn-outline" style={{ ...btn, padding: '9px 14px', fontSize: 12.5 }} disabled={decide.isPending} onClick={() => run(a.id, 'preselect')}>☆ {t('Favorit')}</button>}
                  <button className="view-all" style={{ color: 'var(--red)' }} onClick={() => setRejecting(a.id)}>{t('Avböj')}</button>
                </div>
              )}
            </BidRow>
          ))}
          {done.length > 0 && (
            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--muted)' }}>{done.length} {t('hanterade bud')}</summary>
              {done.map((a) => <BidRow key={a.id} a={a} onOpenProfile={() => navigate(`/brand/creators/${a.creatorProfileId}`)}>{a.collabId ? <Link to={`/brand/ugc/collabs/${a.collabId}`} className="view-all">{t('Öppna uppdraget')} →</Link> : <span className="vy-badge neu">{t(a.status === 'Rejected' ? 'Avböjt' : a.status === 'Withdrawn' ? 'Återtaget' : a.status)}</span>}</BidRow>)}
            </details>
          )}
        </div>

        <div className="card">
          <div className="sec-head"><h3>{t('Brief')}</h3>{c.briefGeneratedByAi && <span className="vy-badge info">AI</span>}</div>
          <BriefView b={c.brief} />
        </div>
        <div className="card">
          <div className="sec-head"><h3>{t('Målgrupp')}</h3></div>
          <div style={{ fontSize: 13.5, lineHeight: 1.7 }}>
            <div><strong>{t('Region')}:</strong> {c.region || t('Var som helst')}</div>
            <div><strong>{t('Kategorier')}:</strong> {c.categories.length ? c.categories.join(', ') : t('Alla')}</div>
            <div><strong>{t('Följare')}:</strong> {c.minFollowers ?? 0}{c.maxFollowers ? `–${formatNumber(c.maxFollowers)}` : '+'}</div>
            <div><strong>{t('Publicerad')}:</strong> {c.publishedAt ? formatDate(c.publishedAt) : '–'}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function BriefView({ b }: { b: UgcBrief }) {
  const L = ({ k, v }: { k: string; v: React.ReactNode }) => <div style={{ marginBottom: 6 }}><strong>{k}:</strong> {v}</div>;
  return (
    <div style={{ fontSize: 13.5, lineHeight: 1.65, wordBreak: 'break-word' }}>
      <L k={t('Mål')} v={b.goal} />
      <L k={t('Format')} v={`${b.format}, ${b.lengthSeconds} s, ${b.videoCount} ${b.videoCount === 1 ? t('video') : t('videor')}`} />
      {b.hooks.length > 0 && <L k={t('Hooks')} v={<ul style={{ margin: '2px 0 0 18px' }}>{b.hooks.map((h, i) => <li key={i}>{h}</li>)}</ul>} />}
      <L k={t('Call to action')} v={b.callToAction} />
      {b.dos.length > 0 && <L k={t('Gör')} v={b.dos.join(' · ')} />}
      {b.donts.length > 0 && <L k={t('Undvik')} v={b.donts.join(' · ')} />}
      {b.referenceUrls.length > 0 && <L k={t('Referenser')} v={b.referenceUrls.map((u, i) => <a key={i} href={u} target="_blank" rel="noopener noreferrer" style={{ color: '#C26A4A', display: 'block' }}>{u}</a>)} />}
      {b.extraNotes && <L k={t('Övrigt')} v={b.extraNotes} />}
    </div>
  );
}

function BidRow({ a, onOpenProfile, children }: { a: UgcApplication; onOpenProfile: () => void; children: React.ReactNode }) {
  const onTime = a.deliveredCount > 0 ? Math.round((a.onTimeCount / a.deliveredCount) * 100) : null;
  return (
    <div className="list-row" style={{ gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <span role="button" tabIndex={0} onClick={onOpenProfile} style={{ cursor: 'pointer', flex: '0 0 auto' }}>
        {a.creatorAvatarUrl ? <img src={a.creatorAvatarUrl} alt="" className="mono" style={{ objectFit: 'cover' }} /> : <span className="mono">{initial(a.creatorName)}</span>}
      </span>
      <div className="row-main" style={{ flex: '1 1 260px', minWidth: 0 }}>
        <div className="t" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span role="button" tabIndex={0} onClick={onOpenProfile} style={{ cursor: 'pointer' }}>{a.creatorName}</span>
          {a.status === 'Preselected' && <span className="vy-badge info">☆ {t('Favorit')}</span>}
          {a.creatorStatus === 'Approved' && <span className="vy-badge pos">{t('Godkänd av VYRLE')}</span>}
          {a.bidOre > 0 && <span style={{ fontWeight: 800, color: '#9c4f31' }}>{formatOre(a.bidOre)}</span>}
        </div>
        <div className="s" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <span>{formatNumber(a.followers)} {t('följare')}</span>
          <span>L/F {(a.likeFollowerRatio * 100).toFixed(0)} %</span>
          <span>{a.deliveredCount} {t('leveranser')}{onTime != null ? ` · ${onTime} % ${t('i tid')}` : ''}</span>
          {a.ratingCount > 0 && <span>★ {a.averageRating.toFixed(1)}</span>}
          {(a.city || a.region) && <span>📍 {a.city || a.region}</span>}
        </div>
        <div className="s" style={{ marginTop: 6, padding: '8px 12px', borderRadius: 12, background: 'rgba(255,244,236,.8)', borderLeft: '3px solid #F1A88F', fontStyle: 'italic', color: '#2C333F', lineHeight: 1.55, whiteSpace: 'pre-line' }}>“{a.pitch}”</div>
        <div className="s" style={{ color: 'var(--muted-2)', marginTop: 4 }}>{formatDate(a.createdAt)}</div>
      </div>
      <div style={{ flex: '0 1 auto', minWidth: 0 }}>{children}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Direct invite from the catalogue
// ═══════════════════════════════════════════════════════════════════
export function UgcDirectInvitePage() {
  const [params] = useSearchParams();
  const creatorId = params.get('creator') ?? '';
  const navigate = useNavigate();
  const toast = useToast();
  const { data: creator } = useCreatorPublicProfile(creatorId);
  const invite = useUgcDirectInvite();
  const gen = useGenerateUgcBrief();

  const [form, setForm] = useState({ title: '', brief: emptyBrief, compensation: 'Paid', amountOre: 150_000, productDescription: '', productValueOre: null as number | null, rightsPackage: 'OrganicPlusAds6M', deadlineDays: 7 });
  const set = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }));
  const setBrief = (p: Partial<UgcBrief>) => setForm((f) => ({ ...f, brief: { ...f.brief, ...p } }));
  const paid = form.compensation !== 'ProductExchange';

  const send = () => invite.mutate({ creatorProfileId: creatorId, ...form, productDescription: form.productDescription || null }, {
    onSuccess: (c) => { toast.push(t('Inbjudan skickad — acceptera kontraktet för att betala.'), 'success'); navigate(`/brand/ugc/collabs/${c.id}`); },
    onError: (e) => toast.push(apiError(e, t('Kunde inte skicka inbjudan')), 'error'),
  });

  return (
    <section className="view active reveal">
      <button onClick={() => navigate(-1)} className="view-all" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>← {t('Tillbaka')}</button>
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('Beställ video av')} <em>{creator?.displayName ?? '…'}</em></h1>
          <p className="page-sub">{t('Direkt beställning utan öppen kampanj. Creatorn får ett kontrakt att acceptera när ni betalat.')}</p>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: 16, alignItems: 'start' }}>
        <div className="card">
          <div className="sec-head" style={{ flexWrap: 'wrap', gap: 8 }}><h3>{t('Brief')}</h3>
            <button className="btn-outline" style={{ ...btn, padding: '8px 14px', fontSize: 12.5 }} disabled={gen.isPending} onClick={() => gen.mutate({ goal: form.brief.goal || undefined }, { onSuccess: (b) => setBrief({ ...b, extraNotes: b.extraNotes ?? '' }), onError: (e) => toast.push(apiError(e, t('AI:n kunde inte skriva briefen')), 'error') })}>✦ {gen.isPending ? t('Skriver…') : t('Generera brief med AI')}</button>
          </div>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
            <div className="field"><label>{t('Titel')} *</label><input style={input} value={form.title} onChange={(e) => set({ title: e.target.value })} /></div>
            <div className="field"><label>{t('Mål')} *</label><textarea rows={2} value={form.brief.goal} onChange={(e) => setBrief({ goal: e.target.value })} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
              <div className="field"><label>{t('Format')}</label><input style={input} value={form.brief.format} onChange={(e) => setBrief({ format: e.target.value })} /></div>
              <div className="field"><label>{t('Längd (sek)')}</label><input style={input} type="number" value={form.brief.lengthSeconds} onChange={(e) => setBrief({ lengthSeconds: Number(e.target.value) })} /></div>
              <div className="field"><label>{t('Antal videor')}</label><input style={input} type="number" value={form.brief.videoCount} onChange={(e) => setBrief({ videoCount: Number(e.target.value) })} /></div>
            </div>
            <ListField label={t('Hooks (första meningen i bild)')} values={form.brief.hooks} onChange={(v) => setBrief({ hooks: v })} />
            <div className="field"><label>{t('Call to action')} *</label><input style={input} value={form.brief.callToAction} onChange={(e) => setBrief({ callToAction: e.target.value })} /></div>
            <ListField label={t('Gör')} values={form.brief.dos} onChange={(v) => setBrief({ dos: v })} />
            <ListField label={t('Undvik')} values={form.brief.donts} onChange={(v) => setBrief({ donts: v })} />
          </div>
        </div>
        <div className="card">
          <div className="sec-head"><h3>{t('Ersättning & rättigheter')}</h3></div>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
            <div className="field"><label>{t('Ersättningstyp')}</label><select value={form.compensation} onChange={(e) => set({ compensation: e.target.value })}>{Object.entries(COMPENSATION_LABEL).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}</select></div>
            {paid && <div className="field"><label>{t('Ersättning till creatorn (kr)')}</label><input style={input} inputMode="decimal" value={oreToKronor(form.amountOre)} onChange={(e) => set({ amountOre: kronorToOre(e.target.value) })} /></div>}
            {paid && <FeeNote amountOre={form.amountOre} />}
            {form.compensation !== 'Paid' && <div className="field"><label>{t('Produkt/tjänst creatorn får')} *</label><input style={input} value={form.productDescription} onChange={(e) => set({ productDescription: e.target.value })} /></div>}
            <div className="field"><label>{t('Rättighetspaket')}</label><select value={form.rightsPackage} onChange={(e) => set({ rightsPackage: e.target.value })}>{Object.entries(RIGHTS_LABEL).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}</select><div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{t(RIGHTS_HINT[form.rightsPackage])}</div></div>
            <div className="field"><label>{t('Leveranstid (dagar)')}</label><input style={input} type="number" min={1} max={60} value={form.deadlineDays} onChange={(e) => set({ deadlineDays: Number(e.target.value) })} /></div>
          </div>
          <button className="btn-apply" style={{ ...btn, marginTop: 12 }} disabled={invite.isPending || !creatorId} onClick={send}>{invite.isPending ? t('Skickar…') : t('Skicka inbjudan')}</button>
        </div>
      </div>
    </section>
  );
}
