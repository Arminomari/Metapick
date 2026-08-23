import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { DateInput } from '@/components/ui/DateInput';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Pagination } from '@/components/ui';
import { TikTokEmbed } from '@/components/ui/TikTokEmbed';
import { useCreatorSearch, useCreatorPublicProfile, useCreatePrOffer } from '@/hooks/api';
import { formatNumber } from '@/lib/utils';
import { t } from '@/lib/i18n';
import { ALL_TAGS } from '@/lib/tags';
import type { CreatorDiscoveryItem, PortfolioItem } from '@/types';
import { CardSkeleton, PageSkeleton } from '@/components/vyrle/Toast';

const CATEGORIES = ['Övrigt', 'Mode', 'Skönhet', 'Mat', 'Teknik', 'Gaming', 'Sport', 'Musik', 'Resor', 'Livsstil', 'Humor'];

const GRADS = ['linear-gradient(135deg,#FFD8C7,#F1A88F)', 'linear-gradient(135deg,#cdb8f2,#9c7de0)', 'linear-gradient(135deg,#F2C58A,#e0a04e)', 'linear-gradient(135deg,#a9dcc0,#5fb98a)'];
const grad = (s: string) => GRADS[((s || '').charCodeAt(0) || 0) % GRADS.length];

function Stars({ value }: { value: number }) {
  return <span className="text-[hsl(var(--primary))]">{'★'.repeat(Math.round(value))}<span className="text-muted-foreground">{'★'.repeat(5 - Math.round(value))}</span></span>;
}

// ── Search / discovery ─────────────────────────────────
export function DiscoverCreatorsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [category, setCategory] = useState('');
  const [country, setCountry] = useState('');
  const [minFollowers, setMinFollowers] = useState('');
  const [tag, setTag] = useState('');
  const [openToPrOffers, setOpenToPrOffers] = useState(false);
  const [sort, setSort] = useState('followers');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useCreatorSearch({
    search: search || undefined,
    category: category || undefined,
    country: country || undefined,
    minFollowers: minFollowers ? Number(minFollowers) : undefined,
    tag: tag || undefined,
    openToPrOffers: openToPrOffers || undefined,
    sort,
    page,
  });

  const applySearch = () => { setSearch(searchInput); setPage(1); };

  return (
    <section className="view active reveal">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('Hitta rätt')} <em>{t('röst')}</em></h1>
          <p className="page-sub">{t('Sök i hela kreatörsbasen, granska profiler och portföljer, och skicka PR-erbjudanden.')}</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
          <div className="field"><label>{t('Sök')}</label><input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && applySearch()} placeholder={t('Namn, bio eller kategori')} /></div>
          <div className="field"><label>{t('Kategori')}</label><select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}><option value="">{t('Alla')}</option>{CATEGORIES.map((c) => <option key={c} value={c}>{t(c)}</option>)}</select></div>
          <div className="field"><label>{t('Land')}</label><select value={country} onChange={(e) => { setCountry(e.target.value); setPage(1); }}><option value="">{t('Alla')}</option><option value="SE">{t('Sverige')}</option><option value="NO">{t('Norge')}</option><option value="DK">{t('Danmark')}</option><option value="FI">{t('Finland')}</option></select></div>
          <div className="field"><label>{t('Min. följare')}</label><input value={minFollowers} inputMode="numeric" onChange={(e) => { setMinFollowers(e.target.value.replace(/\D/g, '')); setPage(1); }} placeholder={t('t.ex. 5000')} /></div>
          <div className="field"><label>{t('Sortera')}</label><select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}><option value="followers">{t('Flest följare')}</option><option value="rating">{t('Högst betyg')}</option><option value="views">{t('Snittvisningar')}</option><option value="recent">{t('Senast tillkomna')}</option></select></div>
          <div className="field"><label>{t('Expertis-tagg')}</label><select value={tag} onChange={(e) => { setTag(e.target.value); setPage(1); }}><option value="">{t('Alla taggar')}</option>{ALL_TAGS.map((tg) => <option key={tg} value={tg}>{tg}</option>)}</select></div>
          <div className="field full checkrow" style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <label className="checkrow" style={{ margin: 0 }}><input type="checkbox" checked={openToPrOffers} onChange={(e) => { setOpenToPrOffers(e.target.checked); setPage(1); }} /> {t('Endast öppna för PR-erbjudanden')}</label>
            <button className="btn-apply" style={{ width: 'auto', padding: '11px 28px' }} onClick={applySearch}>{t('Sök')}</button>
          </div>
        </div>
      </div>

      {isLoading ? <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 16 }}><CardSkeleton rows={3} /><CardSkeleton rows={3} /><CardSkeleton rows={3} /></div> : data && data.data.length > 0 ? (
        <>
          <div className="results-meta"><div className="cnt"><span className="live-dot" />{data.totalCount} {t('kreatörer')}</div></div>
          <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 16 }}>
            {data.data.map((c) => <CreatorSearchCard key={c.id} creator={c} onOpen={() => navigate(`/brand/creators/${c.id}`)} />)}
          </div>
          <Pagination page={page} totalCount={data.totalCount} pageSize={data.pageSize} onPageChange={setPage} />
        </>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '54px 24px' }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{t('Inga kreatörer matchade')}</div>
          <div style={{ color: 'var(--muted)', fontSize: 14, marginTop: 8 }}>{t('Justera filtren eller sök på något annat.')}</div>
        </div>
      )}
    </section>
  );
}

function CreatorSearchCard({ creator, onOpen }: { creator: CreatorDiscoveryItem; onOpen: () => void }) {
  const followers = Math.max(creator.followerCount, creator.tikTokFollowerCount, creator.instagramFollowerCount);
  return (
    <div className="camp-card">
      <div className="ch">
        {creator.avatarUrl
          ? <img src={creator.avatarUrl} alt={creator.displayName} className="mono" style={{ objectFit: 'cover' }} />
          : <span className="mono" style={{ background: grad(creator.displayName) }}>{creator.displayName.charAt(0).toUpperCase()}</span>}
        <div style={{ flex: 1, minWidth: 0 }}><div className="ttl">{creator.displayName}</div><div className="brand">{creator.category} · {creator.country}</div></div>
        {creator.openToPrOffers && <span className="badge green">{t('Öppen för PR')}</span>}
      </div>
      {creator.bio && <div className="desc">{creator.bio}</div>}
      <div className="meta-cols">
        <div className="mc"><div className="k">{t('Följare')}</div><div className="v">{formatNumber(followers)}</div></div>
        <div className="mc"><div className="k">{t('Arbeten')}</div><div className="v">{creator.portfolioItemCount}</div></div>
        <div className="mc"><div className="k">{t('Betyg')}</div><div className="v">{creator.reviewCount > 0 ? creator.averageRating.toFixed(1) : '–'}</div></div>
      </div>
      <div className="tags" style={{ marginBottom: 14 }}>
        {creator.profileTags.slice(0, 3).map((tg) => <span key={tg} className="tag g">{tg}</span>)}
      </div>
      <button className="btn-outline" style={{ width: '100%' }} onClick={onOpen}>{t('Visa profil')}</button>
    </div>
  );
}

// ── Creator detail (brand view) ────────────────────────
export function BrandCreatorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: creator, isLoading } = useCreatorPublicProfile(id!);
  const [showPr, setShowPr] = useState(false);

  if (isLoading) return <PageSkeleton />;
  if (!creator) return (
    <section className="view active reveal"><div className="card" style={{ textAlign: 'center', padding: '54px 24px' }}>
      <div style={{ fontSize: 18, fontWeight: 700 }}>{t('Kreatören hittades inte')}</div>
      <div style={{ color: 'var(--muted)', fontSize: 14, marginTop: 8 }}>{t('Profilen kan ha tagits bort eller inte godkänts.')}</div>
    </div></section>
  );

  const followers = Math.max(creator.followerCount, creator.tikTokFollowerCount, creator.instagramFollowerCount);

  return (
    <section className="view active reveal">
      <button onClick={() => navigate('/brand/creators')} className="view-all" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 18 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg> {t('Tillbaka till sök')}
      </button>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {creator.avatarUrl
            ? <img src={creator.avatarUrl} alt={creator.displayName} style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover' }} />
            : <span className="mono" style={{ width: 80, height: 80, fontSize: 30, flex: '0 0 80px', background: grad(creator.displayName) }}>{creator.displayName.charAt(0).toUpperCase()}</span>}
          <div style={{ flex: 1, minWidth: 240 }}>
            <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--ink)' }}>{creator.displayName}</h1>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>{creator.category} · {creator.country}</p>
            {creator.bio && <p style={{ fontSize: 14, marginTop: 8, color: 'var(--ink-2)', lineHeight: 1.5 }}>{creator.bio}</p>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 12, fontSize: 13 }}>
              {creator.tikTokUsername && <a href={`https://www.tiktok.com/@${creator.tikTokUsername}`} target="_blank" rel="noopener noreferrer" style={{ color: '#C26A4A', fontWeight: 600 }}>TikTok @{creator.tikTokUsername} ({formatNumber(creator.tikTokFollowerCount)})</a>}
              {creator.instagramUsername && <a href={`https://www.instagram.com/${creator.instagramUsername}`} target="_blank" rel="noopener noreferrer" style={{ color: '#C26A4A', fontWeight: 600 }}>Instagram @{creator.instagramUsername} ({formatNumber(creator.instagramFollowerCount)})</a>}
              {creator.website && <a href={creator.website} target="_blank" rel="noopener noreferrer" style={{ color: '#C26A4A', fontWeight: 600 }}>{t('Webbplats')}</a>}
            </div>
            <div className="tags" style={{ marginTop: 12 }}>{creator.profileTags.map((tg) => <span key={tg} className="tag g">{tg}</span>)}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
            <InviteToCommunityButton creatorProfileId={creator.id} />
            {creator.openToPrOffers
              ? <button className="btn-apply" style={{ width: 'auto', padding: '12px 22px' }} onClick={() => setShowPr((v) => !v)}>{showPr ? t('Stäng') : t('Skicka PR-erbjudande')}</button>
              : <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>{t('Tar inte emot PR-erbjudanden just nu')}</p>}
          </div>
        </div>
      </div>

      <div className="stat-row">
        <div className="card stat"><div className="top"><div className="ico soft"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3" /><circle cx="16" cy="9" r="2.5" /><path d="M3 19a6 6 0 0 1 12 0M14 18a5 5 0 0 1 7-1" /></svg></div><div><div className="lbl">{t('Följare')}</div><div className="val">{formatNumber(followers)}</div></div></div></div>
        <div className="card stat"><div className="top"><div className="ico soft"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg></div><div><div className="lbl">{t('Snittvisningar')}</div><div className="val">{creator.averageViews ? formatNumber(creator.averageViews) : '–'}</div></div></div></div>
        <div className="card stat"><div className="top"><div className="ico soft"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 7" /></svg></div><div><div className="lbl">{t('Genomförda kampanjer')}</div><div className="val">{creator.completedCampaigns}</div></div></div></div>
        <div className="card stat"><div className="top"><div className="ico amber"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m12 4 2.3 4.8 5.2.7-3.8 3.6.9 5.1L12 16l-4.6 2.8.9-5.1L4.5 9.5l5.2-.7z" /></svg></div><div><div className="lbl">{t('Betyg')}</div><div className="val">{creator.reviewCount > 0 ? creator.averageRating.toFixed(1) : '–'}</div></div></div></div>
      </div>

      <div className="card" style={{ marginTop: 16, background: 'linear-gradient(160deg,#fff,#FFF6F0)' }}>
        <div className="sec-head"><h3>{t('Verifierat engagemang')}</h3><span style={{ fontSize: 12, color: 'var(--muted)' }}>{t('Uppmätt av VYRLE på kampanjvideos — inte självrapporterat')}</span></div>
        {(creator.totalVerifiedViews ?? 0) > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
            {[
              [t('Views'), formatNumber(creator.totalVerifiedViews ?? 0), true],
              [t('Gilla'), formatNumber(creator.totalLikes ?? 0), false],
              [t('Kommentarer'), formatNumber(creator.totalComments ?? 0), false],
              [t('Delningar'), formatNumber(creator.totalShares ?? 0), false],
              [t('Engagemang'), `${(creator.engagementRate ?? 0).toFixed(1)}%`, false],
            ].map(([lbl, val, hi]) => (
              <div key={lbl as string} style={{ padding: '12px 14px', borderRadius: 14, textAlign: 'center', background: hi ? 'linear-gradient(140deg,#FFE3D3,#FFD3BC)' : 'rgba(255,244,236,.75)', border: '1px solid rgba(241,168,143,.2)' }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: hi ? '#9c4f31' : 'var(--muted)' }}>{lbl}</div>
                <div style={{ fontWeight: 800, fontSize: 18, color: '#0B0F17', marginTop: 2 }}>{val}</div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>{t('Inga verifierade kampanjvideos ännu — siffrorna dyker upp när kreatören kört sin första kampanj.')}</p>
        )}
      </div>

      {showPr && id && <SendPrOfferForm creatorProfileId={id} onDone={() => setShowPr(false)} />}

      <div className="card" style={{ marginTop: 16 }}>
        <div className="sec-head"><h3>{t('Portfölj')} ({creator.portfolio.length})</h3></div>
        {creator.portfolio.length > 0 ? (
          <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 16 }}>
            {creator.portfolio.map((it) => <PortfolioCard key={it.id} item={it} />)}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>{t('Kreatören har inte lagt till några arbeten ännu.')}</p>
        )}
      </div>

      {creator.recentReviews.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="sec-head"><h3>{t('Omdömen')} <Stars value={creator.averageRating} /> <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 400 }}>({creator.averageRating.toFixed(1)} {t('av')} {creator.reviewCount})</span></h3></div>
          {creator.recentReviews.map((r) => (
            <div key={r.id} className="list-row">
              <div className="row-main" style={{ flex: 1 }}>
                <div className="t">{r.reviewerName} <span style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 400 }}>({r.reviewerRole})</span></div>
                {r.comment && <div className="s">{r.comment}</div>}
              </div>
              <Stars value={r.stars} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function PortfolioCard({ item }: { item: PortfolioItem }) {
  return (
    <div className="pf-card">
      {item.mediaType === 'TikTok' ? (
        <div className="pf-img" style={{ height: 'auto', background: 'transparent' }}><TikTokEmbed videoUrl={item.mediaUrl} compact /></div>
      ) : (item.thumbnailUrl || item.mediaType === 'Image') ? (
        <a href={item.mediaUrl} target="_blank" rel="noopener noreferrer" className="pf-img" style={{ display: 'block', backgroundImage: `url(${item.thumbnailUrl || item.mediaUrl})` }}>
          {item.isFeatured && <div className="pf-flag">{t('Utvald')}</div>}
        </a>
      ) : (
        <div className="pf-img" style={{ background: grad(item.title), display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          {item.isFeatured && <div className="pf-flag">{t('Utvald')}</div>}
          <a href={item.mediaUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#fff', fontWeight: 700, textAlign: 'center', wordBreak: 'break-all', fontSize: 13 }}>{item.title}</a>
        </div>
      )}
      <div className="pf-body">
        <div className="t">{item.title}</div>
        <div className="s">{[item.brandName, item.views != null ? `${formatNumber(item.views)} ${t('views (uppgivet)')}` : null].filter(Boolean).join(' · ')}</div>
        {item.description && <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 8, lineHeight: 1.5 }}>{item.description}</p>}
      </div>
    </div>
  );
}

function SendPrOfferForm({ creatorProfileId, onDone }: { creatorProfileId: string; onDone: () => void }) {
  const create = useCreatePrOffer();
  const [form, setForm] = useState({
    title: '', message: '', offerType: 'ProductGifting', category: 'Mat',
    compensationAmount: '', productDescription: '', productValue: '', deadline: '',
  });
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const needsCash = form.offerType === 'Paid' || form.offerType === 'Hybrid';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) { setError(t('Rubrik krävs')); return; }
    if (!form.message.trim()) { setError(t('Meddelande krävs')); return; }
    if (needsCash && (!form.compensationAmount || Number(form.compensationAmount) <= 0)) {
      setError(t('Betalda erbjudanden kräver ett ersättningsbelopp')); return;
    }
    try {
      await create.mutateAsync({
        creatorProfileId,
        title: form.title.trim(),
        message: form.message.trim(),
        offerType: form.offerType,
        category: form.category.trim(),
        compensationAmount: form.compensationAmount ? Number(form.compensationAmount) : null,
        currency: 'SEK',
        productDescription: form.productDescription.trim() || null,
        productValue: form.productValue ? Number(form.productValue) : null,
        deadline: form.deadline ? `${form.deadline}T00:00:00` : null,
        campaignId: null,
      });
      setDone(true);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? t('Kunde inte skicka erbjudandet'));
    }
  };

  if (done) {
    return (
      <div className="card" style={{ marginTop: 16, borderColor: 'rgba(126,224,160,.4)' }}>
        <p style={{ fontSize: 14, fontWeight: 600 }}>{t('PR-erbjudandet har skickats! Du ser status under "PR Outreach".')}</p>
        <button className="btn-outline" style={{ marginTop: 12 }} onClick={onDone}>{t('Stäng')}</button>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="sec-head"><h3>{t('Skicka PR-erbjudande')}</h3></div>
      <form onSubmit={handleSubmit} className="form-grid">
        <div className="field full"><label>{t('Rubrik')} *</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder={t('t.ex. Prova vår nya meny')} /></div>
        <div className="field"><label>{t('Typ av erbjudande')}</label>
          <select value={form.offerType} onChange={(e) => setForm({ ...form, offerType: e.target.value })}>
            <option value="ProductGifting">{t('Produkt / gåva')}</option><option value="Paid">{t('Betald')}</option><option value="Hybrid">{t('Produkt + betalt')}</option><option value="Event">{t('Event')}</option>
          </select>
        </div>
        <div className="field"><label>{t('Kategori')}</label><input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder={t('t.ex. Mat')} /></div>
        <div className="field full"><label>{t('Meddelande')} *</label><textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={4} required placeholder={t('Beskriv samarbetet, vad ni vill ha, och vad kreatören får.')} /></div>
        <div className="field full"><label>{t('Vad får kreatören? (PR-utbud)')}</label><textarea value={form.productDescription} onChange={(e) => setForm({ ...form, productDescription: e.target.value })} rows={2} placeholder={t('t.ex. Måltid för två + dryck')} /></div>
        <div className="field"><label>{t('Ersättning (SEK)')}{needsCash ? ' *' : ''}</label><input inputMode="numeric" value={form.compensationAmount} onChange={(e) => setForm({ ...form, compensationAmount: e.target.value.replace(/\D/g, '') })} placeholder="0" /></div>
        <div className="field"><label>{t('Produktvärde (SEK)')}</label><input inputMode="numeric" value={form.productValue} onChange={(e) => setForm({ ...form, productValue: e.target.value.replace(/\D/g, '') })} placeholder={t('t.ex. 500')} /></div>
        <div className="field"><label>{t('Deadline')}</label><DateInput value={form.deadline} onChange={(v) => setForm({ ...form, deadline: v })} className="" /></div>
        <div className="field full">
          {error && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 8 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" className="btn-apply" style={{ width: 'auto', padding: '12px 22px' }} disabled={create.isPending}>{create.isPending ? t('Skickar…') : t('Skicka erbjudande')}</button>
            <button type="button" className="btn-outline" onClick={onDone}>{t('Avbryt')}</button>
          </div>
        </div>
      </form>
    </div>
  );
}

function InviteToCommunityButton({ creatorProfileId }: { creatorProfileId: string }) {
  const qc = useQueryClient();
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const invite = useMutation({
    mutationFn: async () => (await api.post('/brand/community/invite', { creatorProfileId })).data.data,
    onSuccess: () => { setDone(true); qc.invalidateQueries({ queryKey: ['brand-community'] }); },
    onError: (e: any) => setErr(e?.response?.data?.error?.message ?? t('Kunde inte bjuda in')),
  });
  if (done) return <span className="badge green" style={{ padding: '8px 14px' }}>✓ {t('I ditt community')}</span>;
  return (
    <div style={{ textAlign: 'right' }}>
      <button className="btn-outline" style={{ width: 'auto', padding: '11px 20px' }} onClick={() => invite.mutate()} disabled={invite.isPending}>
        {invite.isPending ? t('Bjuder in…') : `＋ ${t('Bjud in till community')}`}
      </button>
      {err && <div style={{ fontSize: 12, color: '#cf4b4b', marginTop: 4 }}>{err}</div>}
    </div>
  );
}

