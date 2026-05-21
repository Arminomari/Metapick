import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, EmptyState, LoadingSpinner, Pagination, StatCard } from '@/components/ui';
import { TikTokEmbed } from '@/components/ui/TikTokEmbed';
import { useCreatorSearch, useCreatorPublicProfile, useCreatePrOffer } from '@/hooks/api';
import { formatNumber } from '@/lib/utils';
import { ALL_TAGS } from '@/lib/tags';
import type { CreatorDiscoveryItem, PortfolioItem } from '@/types';

const CATEGORIES = ['Övrigt', 'Mode', 'Skönhet', 'Mat', 'Teknik', 'Gaming', 'Sport', 'Musik', 'Resor', 'Livsstil', 'Humor'];

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
    <div className="space-y-6">
      <header className="grid grid-cols-12 gap-x-6 items-end">
        <div className="col-span-12 md:col-span-8">
          <p className="eyebrow">Brand desk · Hitta kreatörer</p>
          <h1 className="mt-3 text-display text-[clamp(2rem,4.5vw,3.25rem)]">
            Hitta rätt <span className="text-sunset">röst</span>.
          </h1>
        </div>
        <div className="col-span-12 md:col-span-4 md:text-right">
          <p className="text-sm text-muted-foreground col-prose md:ml-auto">
            Sök i hela kreatörsbasen, granska profiler och portföljer, och skicka PR-erbjudanden.
          </p>
        </div>
      </header>
      <div className="hairline" />

      {/* Filters */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-4">
            <label className="block text-xs font-medium mb-1 eyebrow">Sök</label>
            <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applySearch()}
              placeholder="Namn, bio eller kategori"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium mb-1 eyebrow">Kategori</label>
            <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="">Alla</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium mb-1 eyebrow">Land</label>
            <select value={country} onChange={(e) => { setCountry(e.target.value); setPage(1); }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="">Alla</option>
              <option value="SE">Sverige</option>
              <option value="NO">Norge</option>
              <option value="DK">Danmark</option>
              <option value="FI">Finland</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium mb-1 eyebrow">Min. följare</label>
            <input value={minFollowers} inputMode="numeric"
              onChange={(e) => { setMinFollowers(e.target.value.replace(/\D/g, '')); setPage(1); }}
              placeholder="t.ex. 5000"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium mb-1 eyebrow">Sortera</label>
            <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="followers">Flest följare</option>
              <option value="rating">Högst betyg</option>
              <option value="views">Snittvisningar</option>
              <option value="recent">Senast tillkomna</option>
            </select>
          </div>
          <div className="md:col-span-4">
            <label className="block text-xs font-medium mb-1 eyebrow">Expertis-tagg</label>
            <select value={tag} onChange={(e) => { setTag(e.target.value); setPage(1); }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="">Alla taggar</option>
              {ALL_TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <label className="md:col-span-4 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={openToPrOffers} onChange={(e) => { setOpenToPrOffers(e.target.checked); setPage(1); }} />
            Endast öppna för PR-erbjudanden
          </label>
          <div className="md:col-span-4">
            <Button className="w-full" onClick={applySearch}>Sök</Button>
          </div>
        </div>
      </Card>

      {isLoading ? <LoadingSpinner /> : data && data.data.length > 0 ? (
        <>
          <p className="text-sm text-muted-foreground">{data.totalCount} kreatörer</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {data.data.map((c) => <CreatorSearchCard key={c.id} creator={c} onOpen={() => navigate(`/brand/creators/${c.id}`)} />)}
          </div>
          <Pagination page={page} totalCount={data.totalCount} pageSize={data.pageSize} onPageChange={setPage} />
        </>
      ) : (
        <EmptyState title="Inga kreatörer matchade" description="Justera filtren eller sök på något annat." />
      )}
    </div>
  );
}

function CreatorSearchCard({ creator, onOpen }: { creator: CreatorDiscoveryItem; onOpen: () => void }) {
  const followers = Math.max(creator.followerCount, creator.tikTokFollowerCount, creator.instagramFollowerCount);
  return (
    <Card className="flex flex-col cursor-pointer hover:border-[hsl(var(--border-strong))] transition-colors" >
      <div className="flex items-center gap-3 mb-3">
        {creator.avatarUrl
          ? <img src={creator.avatarUrl} alt={creator.displayName} className="h-12 w-12 rounded-full object-cover border border-border" />
          : <div className="h-12 w-12 rounded-full bg-[hsl(var(--sand))] flex items-center justify-center text-lg font-bold">{creator.displayName.charAt(0)}</div>}
        <div className="min-w-0">
          <h3 className="font-bold leading-tight truncate">{creator.displayName}</h3>
          <p className="text-xs text-muted-foreground">{creator.category} · {creator.country}</p>
        </div>
      </div>
      {creator.bio && <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{creator.bio}</p>}
      <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3">
        <div><div className="font-bold text-sm">{formatNumber(followers)}</div><div className="text-muted-foreground">följare</div></div>
        <div><div className="font-bold text-sm">{creator.portfolioItemCount}</div><div className="text-muted-foreground">arbeten</div></div>
        <div><div className="font-bold text-sm">{creator.reviewCount > 0 ? creator.averageRating.toFixed(1) : '–'}</div><div className="text-muted-foreground">betyg</div></div>
      </div>
      <div className="flex flex-wrap gap-1 mb-4">
        {creator.profileTags.slice(0, 3).map((t) => (
          <span key={t} className="px-2 py-0.5 rounded-full text-[0.7rem] bg-[hsl(var(--primary)/0.08)] text-primary border border-[hsl(var(--primary)/0.18)]">{t}</span>
        ))}
        {creator.openToPrOffers && <span className="px-2 py-0.5 rounded-full text-[0.7rem] bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]">Öppen för PR</span>}
      </div>
      <Button className="mt-auto w-full" variant="secondary" onClick={onOpen}>Visa profil</Button>
    </Card>
  );
}

// ── Creator detail (brand view) ────────────────────────
export function BrandCreatorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: creator, isLoading } = useCreatorPublicProfile(id!);
  const [showPr, setShowPr] = useState(false);

  if (isLoading) return <LoadingSpinner />;
  if (!creator) return <EmptyState title="Kreatören hittades inte" description="Profilen kan ha tagits bort eller inte godkänts." />;

  const followers = Math.max(creator.followerCount, creator.tikTokFollowerCount, creator.instagramFollowerCount);

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/brand/creators')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Tillbaka till sök
      </button>

      <Card>
        <div className="flex flex-col md:flex-row md:items-start gap-5">
          {creator.avatarUrl
            ? <img src={creator.avatarUrl} alt={creator.displayName} className="h-20 w-20 rounded-full object-cover border border-border" />
            : <div className="h-20 w-20 rounded-full bg-[hsl(var(--sand))] flex items-center justify-center text-2xl font-bold">{creator.displayName.charAt(0)}</div>}
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{creator.displayName}</h1>
            <p className="text-sm text-muted-foreground">{creator.category} · {creator.country}</p>
            {creator.bio && <p className="text-sm mt-2 col-prose">{creator.bio}</p>}
            <div className="flex flex-wrap gap-3 mt-3 text-sm">
              {creator.tikTokUsername && (
                <a href={`https://www.tiktok.com/@${creator.tikTokUsername}`} target="_blank" rel="noopener noreferrer"
                  className="text-primary hover:underline">TikTok @{creator.tikTokUsername} ({formatNumber(creator.tikTokFollowerCount)})</a>
              )}
              {creator.instagramUsername && (
                <a href={`https://www.instagram.com/${creator.instagramUsername}`} target="_blank" rel="noopener noreferrer"
                  className="text-primary hover:underline">Instagram @{creator.instagramUsername} ({formatNumber(creator.instagramFollowerCount)})</a>
              )}
              {creator.website && (
                <a href={creator.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Webbplats</a>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {creator.profileTags.map((t) => (
                <span key={t} className="px-2 py-0.5 rounded-full text-[0.72rem] bg-[hsl(var(--primary)/0.08)] text-primary border border-[hsl(var(--primary)/0.18)]">{t}</span>
              ))}
            </div>
          </div>
          <div className="md:text-right">
            {creator.openToPrOffers ? (
              <Button onClick={() => setShowPr((v) => !v)}>{showPr ? 'Stäng' : 'Skicka PR-erbjudande'}</Button>
            ) : (
              <p className="text-xs text-muted-foreground">Tar inte emot PR-erbjudanden just nu</p>
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Följare" value={formatNumber(followers)} />
        <StatCard label="Snittvisningar" value={creator.averageViews ? formatNumber(creator.averageViews) : '–'} />
        <StatCard label="Genomförda kampanjer" value={creator.completedCampaigns} />
        <StatCard label="Betyg" value={creator.reviewCount > 0 ? `${creator.averageRating.toFixed(1)} ★` : '–'} subValue={creator.reviewCount > 0 ? `${creator.reviewCount} omdömen` : undefined} />
      </div>

      {showPr && id && <SendPrOfferForm creatorProfileId={id} onDone={() => setShowPr(false)} />}

      {/* Portfolio */}
      <Card>
        <h2 className="font-semibold mb-4">Portfölj ({creator.portfolio.length})</h2>
        {creator.portfolio.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {creator.portfolio.map((it) => <PortfolioCard key={it.id} item={it} />)}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Kreatören har inte lagt till några arbeten ännu.</p>
        )}
      </Card>

      {/* Reviews */}
      {creator.recentReviews.length > 0 && (
        <Card>
          <h2 className="font-semibold mb-4">Omdömen <Stars value={creator.averageRating} /> <span className="text-sm text-muted-foreground">({creator.averageRating.toFixed(1)} av {creator.reviewCount})</span></h2>
          <div className="space-y-3">
            {creator.recentReviews.map((r) => (
              <div key={r.id} className="border border-border rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{r.reviewerName} <span className="text-xs text-muted-foreground">({r.reviewerRole})</span></span>
                  <Stars value={r.stars} />
                </div>
                {r.comment && <p className="text-sm text-muted-foreground mt-1">{r.comment}</p>}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function PortfolioCard({ item }: { item: PortfolioItem }) {
  return (
    <div className="border border-border rounded-lg p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium leading-tight">{item.title}</p>
        {item.isFeatured && <span className="sticker sticker-hot !py-0.5 !px-2 !text-[0.7rem]">Utvald</span>}
      </div>
      {item.mediaType === 'TikTok' ? (
        <TikTokEmbed videoUrl={item.mediaUrl} compact />
      ) : (item.thumbnailUrl || item.mediaType === 'Image') ? (
        <a href={item.mediaUrl} target="_blank" rel="noopener noreferrer">
          <img src={item.thumbnailUrl || item.mediaUrl} alt={item.title} className="w-full h-36 object-cover rounded-md border border-border" />
        </a>
      ) : (
        <a href={item.mediaUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline break-all">{item.mediaUrl}</a>
      )}
      {item.description && <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>}
      <div className="flex gap-3 text-xs text-muted-foreground">
        {item.brandName && <span>{item.brandName}</span>}
        {item.views != null && <span>▶ {formatNumber(item.views)}</span>}
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
      <Card className="!border-[hsl(var(--success)/0.4)] !bg-[hsl(var(--success)/0.06)]">
        <p className="text-sm font-medium">✓ PR-erbjudandet har skickats! Du ser status under "PR-utskick".</p>
        <div className="mt-3"><Button size="sm" variant="secondary" onClick={onDone}>Stäng</Button></div>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="font-semibold mb-4">Skicka PR-erbjudande</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Rubrik *</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="t.ex. Prova vår nya meny" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Typ av erbjudande</label>
            <select value={form.offerType} onChange={(e) => setForm({ ...form, offerType: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="ProductGifting">Produkt / gåva</option>
              <option value="Paid">Betald</option>
              <option value="Hybrid">Produkt + betalt</option>
              <option value="Event">Event</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Kategori</label>
            <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="t.ex. Mat" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Meddelande *</label>
          <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={4} required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Beskriv samarbetet, vad ni vill ha, och vad kreatören får." />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Vad får kreatören? (PR-utbud)</label>
          <textarea value={form.productDescription} onChange={(e) => setForm({ ...form, productDescription: e.target.value })} rows={2}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="t.ex. Måltid för två + dryck" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Ersättning (SEK){needsCash ? ' *' : ''}</label>
            <input inputMode="numeric" value={form.compensationAmount}
              onChange={(e) => setForm({ ...form, compensationAmount: e.target.value.replace(/\D/g, '') })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="0" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Produktvärde (SEK)</label>
            <input inputMode="numeric" value={form.productValue}
              onChange={(e) => setForm({ ...form, productValue: e.target.value.replace(/\D/g, '') })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="t.ex. 500" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Deadline</label>
            <input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-3">
          <Button type="submit" disabled={create.isPending}>{create.isPending ? 'Skickar…' : 'Skicka erbjudande'}</Button>
          <Button type="button" variant="secondary" onClick={onDone}>Avbryt</Button>
        </div>
      </form>
    </Card>
  );
}
