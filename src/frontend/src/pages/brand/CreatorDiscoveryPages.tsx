import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Pagination } from '@/components/ui';
import { TikTokEmbed } from '@/components/ui/TikTokEmbed';
import { useCreatorSearch, useCreatorPublicProfile, useCreatePrOffer } from '@/hooks/api';
import { formatNumber } from '@/lib/utils';
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
          <h1 className="page-title">Hitta rätt <em>röst</em></h1>
          <p className="page-sub">Sök i hela kreatörsbasen, granska profiler och portföljer, och skicka PR-erbjudanden.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
          <div className="field"><label>Sök</label><input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && applySearch()} placeholder="Namn, bio eller kategori" /></div>
          <div className="field"><label>Kategori</label><select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}><option value="">Alla</option>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
          <div className="field"><label>Land</label><select value={country} onChange={(e) => { setCountry(e.target.value); setPage(1); }}><option value="">Alla</option><option value="SE">Sverige</option><option value="NO">Norge</option><option value="DK">Danmark</option><option value="FI">Finland</option></select></div>
          <div className="field"><label>Min. följare</label><input value={minFollowers} inputMode="numeric" onChange={(e) => { setMinFollowers(e.target.value.replace(/\D/g, '')); setPage(1); }} placeholder="t.ex. 5000" /></div>
          <div className="field"><label>Sortera</label><select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}><option value="followers">Flest följare</option><option value="rating">Högst betyg</option><option value="views">Snittvisningar</option><option value="recent">Senast tillkomna</option></select></div>
          <div className="field"><label>Expertis-tagg</label><select value={tag} onChange={(e) => { setTag(e.target.value); setPage(1); }}><option value="">Alla taggar</option>{ALL_TAGS.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
          <div className="field full checkrow" style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <label className="checkrow" style={{ margin: 0 }}><input type="checkbox" checked={openToPrOffers} onChange={(e) => { setOpenToPrOffers(e.target.checked); setPage(1); }} /> Endast öppna för PR-erbjudanden</label>
            <button className="btn-apply" style={{ width: 'auto', padding: '11px 28px' }} onClick={applySearch}>Sök</button>
          </div>
        </div>
      </div>

      {isLoading ? <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 16 }}><CardSkeleton rows={3} /><CardSkeleton rows={3} /><CardSkeleton rows={3} /></div> : data && data.data.length > 0 ? (
        <>
          <div className="results-meta"><div className="cnt"><span className="live-dot" />{data.totalCount} kreatörer</div></div>
          <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 16 }}>
            {data.data.map((c) => <CreatorSearchCard key={c.id} creator={c} onOpen={() => navigate(`/brand/creators/${c.id}`)} />)}
          </div>
          <Pagination page={page} totalCount={data.totalCount} pageSize={data.pageSize} onPageChange={setPage} />
        </>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '54px 24px' }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Inga kreatörer matchade</div>
          <div style={{ color: 'var(--muted)', fontSize: 14, marginTop: 8 }}>Justera filtren eller sök på något annat.</div>
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
        {creator.openToPrOffers && <span className="badge green">Öppen för PR</span>}
      </div>
      {creator.bio && <div className="desc">{creator.bio}</div>}
      <div className="meta-cols">
        <div className="mc"><div className="k">Följare</div><div className="v">{formatNumber(followers)}</div></div>
        <div className="mc"><div className="k">Arbeten</div><div className="v">{creator.portfolioItemCount}</div></div>
        <div className="mc"><div className="k">Betyg</div><div className="v">{creator.reviewCount > 0 ? creator.averageRating.toFixed(1) : '–'}</div></div>
      </div>
      <div className="tags" style={{ marginBottom: 14 }}>
        {creator.profileTags.slice(0, 3).map((t) => <span key={t} className="tag g">{t}</span>)}
      </div>
      <button className="btn-outline" style={{ width: '100%' }} onClick={onOpen}>Visa profil</button>
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
      <div style={{ fontSize: 18, fontWeight: 700 }}>Kreatören hittades inte</div>
      <div style={{ color: 'var(--muted)', fontSize: 14, marginTop: 8 }}>Profilen kan ha tagits bort eller inte godkänts.</div>
    </div></section>
  );

  const followers = Math.max(creator.followerCount, creator.tikTokFollowerCount, creator.instagramFollowerCount);

  return (
    <section className="view active reveal">
      <button onClick={() => navigate('/brand/creators')} className="view-all" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 18 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg> Tillbaka till sök
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
              {creator.website && <a href={creator.website} target="_blank" rel="noopener noreferrer" style={{ color: '#C26A4A', fontWeight: 600 }}>Webbplats</a>}
            </div>
            <div className="tags" style={{ marginTop: 12 }}>{creator.profileTags.map((t) => <span key={t} className="tag g">{t}</span>)}</div>
          </div>
          <div>
            {creator.openToPrOffers
              ? <button className="btn-apply" style={{ width: 'auto', padding: '12px 22px' }} onClick={() => setShowPr((v) => !v)}>{showPr ? 'Stäng' : 'Skicka PR-erbjudande'}</button>
              : <p style={{ fontSize: 12, color: 'var(--muted)' }}>Tar inte emot PR-erbjudanden just nu</p>}
          </div>
        </div>
      </div>

      <div className="stat-row">
        <div className="card stat"><div className="top"><div className="ico soft"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3" /><circle cx="16" cy="9" r="2.5" /><path d="M3 19a6 6 0 0 1 12 0M14 18a5 5 0 0 1 7-1" /></svg></div><div><div className="lbl">Följare</div><div className="val">{formatNumber(followers)}</div></div></div></div>
        <div className="card stat"><div className="top"><div className="ico soft"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg></div><div><div className="lbl">Snittvisningar</div><div className="val">{creator.averageViews ? formatNumber(creator.averageViews) : '–'}</div></div></div></div>
        <div className="card stat"><div className="top"><div className="ico soft"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 7" /></svg></div><div><div className="lbl">Genomförda kampanjer</div><div className="val">{creator.completedCampaigns}</div></div></div></div>
        <div className="card stat"><div className="top"><div className="ico amber"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m12 4 2.3 4.8 5.2.7-3.8 3.6.9 5.1L12 16l-4.6 2.8.9-5.1L4.5 9.5l5.2-.7z" /></svg></div><div><div className="lbl">Betyg</div><div className="val">{creator.reviewCount > 0 ? creator.averageRating.toFixed(1) : '–'}</div></div></div></div>
      </div>

      {showPr && id && <SendPrOfferForm creatorProfileId={id} onDone={() => setShowPr(false)} />}

      <div className="card" style={{ marginTop: 16 }}>
        <div className="sec-head"><h3>Portfölj ({creator.portfolio.length})</h3></div>
        {creator.portfolio.length > 0 ? (
          <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 16 }}>
            {creator.portfolio.map((it) => <PortfolioCard key={it.id} item={it} />)}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Kreatören har inte lagt till några arbeten ännu.</p>
        )}
      </div>

      {creator.recentReviews.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="sec-head"><h3>Omdömen <Stars value={creator.averageRating} /> <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 400 }}>({creator.averageRating.toFixed(1)} av {creator.reviewCount})</span></h3></div>
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
          {item.isFeatured && <div className="pf-flag">Utvald</div>}
        </a>
      ) : (
        <div className="pf-img" style={{ background: grad(item.title), display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          {item.isFeatured && <div className="pf-flag">Utvald</div>}
          <a href={item.mediaUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#fff', fontWeight: 700, textAlign: 'center', wordBreak: 'break-all', fontSize: 13 }}>{item.title}</a>
        </div>
      )}
      <div className="pf-body">
        <div className="t">{item.title}</div>
        <div className="s">{[item.brandName, item.views != null ? `${formatNumber(item.views)} views` : null].filter(Boolean).join(' · ')}</div>
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
    if (!form.title.trim()) { setError('Rubrik krävs'); return; }
    if (!form.message.trim()) { setError('Meddelande krävs'); return; }
    if (needsCash && (!form.compensationAmount || Number(form.compensationAmount) <= 0)) {
      setError('Betalda erbjudanden kräver ett ersättningsbelopp'); return;
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
      setError(err?.response?.data?.error?.message ?? 'Kunde inte skicka erbjudandet');
    }
  };

  if (done) {
    return (
      <div className="card" style={{ marginTop: 16, borderColor: 'rgba(126,224,160,.4)' }}>
        <p style={{ fontSize: 14, fontWeight: 600 }}>PR-erbjudandet har skickats! Du ser status under "PR Outreach".</p>
        <button className="btn-outline" style={{ marginTop: 12 }} onClick={onDone}>Stäng</button>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="sec-head"><h3>Skicka PR-erbjudande</h3></div>
      <form onSubmit={handleSubmit} className="form-grid">
        <div className="field full"><label>Rubrik *</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="t.ex. Prova vår nya meny" /></div>
        <div className="field"><label>Typ av erbjudande</label>
          <select value={form.offerType} onChange={(e) => setForm({ ...form, offerType: e.target.value })}>
            <option value="ProductGifting">Produkt / gåva</option><option value="Paid">Betald</option><option value="Hybrid">Produkt + betalt</option><option value="Event">Event</option>
          </select>
        </div>
        <div className="field"><label>Kategori</label><input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="t.ex. Mat" /></div>
        <div className="field full"><label>Meddelande *</label><textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={4} required placeholder="Beskriv samarbetet, vad ni vill ha, och vad kreatören får." /></div>
        <div className="field full"><label>Vad får kreatören? (PR-utbud)</label><textarea value={form.productDescription} onChange={(e) => setForm({ ...form, productDescription: e.target.value })} rows={2} placeholder="t.ex. Måltid för två + dryck" /></div>
        <div className="field"><label>Ersättning (SEK){needsCash ? ' *' : ''}</label><input inputMode="numeric" value={form.compensationAmount} onChange={(e) => setForm({ ...form, compensationAmount: e.target.value.replace(/\D/g, '') })} placeholder="0" /></div>
        <div className="field"><label>Produktvärde (SEK)</label><input inputMode="numeric" value={form.productValue} onChange={(e) => setForm({ ...form, productValue: e.target.value.replace(/\D/g, '') })} placeholder="t.ex. 500" /></div>
        <div className="field"><label>Deadline</label><input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></div>
        <div className="field full">
          {error && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 8 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" className="btn-apply" style={{ width: 'auto', padding: '12px 22px' }} disabled={create.isPending}>{create.isPending ? 'Skickar…' : 'Skicka erbjudande'}</button>
            <button type="button" className="btn-outline" onClick={onDone}>Avbryt</button>
          </div>
        </div>
      </form>
    </div>
  );
}
