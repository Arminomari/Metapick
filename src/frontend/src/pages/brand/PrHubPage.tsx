import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, EmptyState, LoadingSpinner, Pagination, StatCard, StatusBadge } from '@/components/ui';
import { useSentPrOffers, usePrStats, useWithdrawPrOffer } from '@/hooks/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { PrOffer } from '@/types';

const OFFER_TYPE_LABELS: Record<string, string> = {
  ProductGifting: 'Produkt / gåva', Paid: 'Betald', Hybrid: 'Produkt + betalt', Event: 'Event',
};

export function BrandPrHubPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<string>();
  const [category, setCategory] = useState<string>();
  const [page, setPage] = useState(1);
  const { data: stats } = usePrStats();
  const { data, isLoading } = useSentPrOffers(status, category, page);
  const withdraw = useWithdrawPrOffer();

  return (
    <div className="space-y-6">
      <header className="grid grid-cols-12 gap-x-6 items-end">
        <div className="col-span-12 md:col-span-8">
          <p className="eyebrow">Brand desk · PR-utskick</p>
          <h1 className="mt-3 text-display text-[clamp(2rem,4.5vw,3.25rem)]">
            Din <span className="text-sunset">PR-hubb</span>.
          </h1>
        </div>
        <div className="col-span-12 md:col-span-4 md:text-right">
          <Button onClick={() => navigate('/brand/creators')}>+ Hitta kreatörer</Button>
        </div>
      </header>
      <div className="hairline" />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Totalt skickade" value={stats?.totalSent ?? 0} />
        <StatCard label="Väntar (osedda)" value={stats?.pending ?? 0} />
        <StatCard label="Sedda" value={stats?.viewed ?? 0} />
        <StatCard label="Accepterade" value={stats?.accepted ?? 0} />
        <StatCard label="Nekade" value={stats?.declined ?? 0} />
      </div>

      {stats && stats.byCategory.length > 0 && (
        <Card>
          <h2 className="font-semibold mb-3">Per kategori</h2>
          <div className="flex flex-wrap gap-2">
            {stats.byCategory.map((c) => (
              <button key={c.category}
                onClick={() => { setCategory(category === c.category ? undefined : c.category); setPage(1); }}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${category === c.category
                  ? 'bg-primary border-primary text-white'
                  : 'bg-transparent border-border text-muted-foreground hover:border-primary'}`}>
                {c.category} <span className="font-bold ml-1">{c.count}</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Status filter */}
      <div className="flex flex-wrap gap-2">
        {['Alla', 'Sent', 'Viewed', 'Accepted', 'Declined', 'Withdrawn'].map((s) => (
          <Button key={s} variant={status === (s === 'Alla' ? undefined : s) ? 'primary' : 'secondary'} size="sm"
            onClick={() => { setStatus(s === 'Alla' ? undefined : s); setPage(1); }}>
            {s === 'Alla' ? 'Alla' : s}
          </Button>
        ))}
      </div>

      {isLoading ? <LoadingSpinner /> : data && data.data.length > 0 ? (
        <>
          <div className="space-y-3">
            {data.data.map((offer) => <SentOfferRow key={offer.id} offer={offer} onWithdraw={() => withdraw.mutate(offer.id)} withdrawing={withdraw.isPending} />)}
          </div>
          <Pagination page={page} totalCount={data.totalCount} pageSize={data.pageSize} onPageChange={setPage} />
        </>
      ) : (
        <EmptyState title="Inga PR-erbjudanden skickade"
          description="Hitta kreatörer och skicka ditt första PR-erbjudande."
          action={<Button onClick={() => navigate('/brand/creators')}>Hitta kreatörer</Button>} />
      )}
    </div>
  );
}

function SentOfferRow({ offer, onWithdraw, withdrawing }: { offer: PrOffer; onWithdraw: () => void; withdrawing: boolean }) {
  const [open, setOpen] = useState(false);
  const canWithdraw = offer.status === 'Sent' || offer.status === 'Viewed';
  return (
    <Card>
      <div className="flex items-center justify-between gap-3 cursor-pointer" onClick={() => setOpen((v) => !v)}>
        <div className="flex items-center gap-3 min-w-0">
          {offer.creatorAvatarUrl
            ? <img src={offer.creatorAvatarUrl} alt={offer.creatorName} className="h-9 w-9 rounded-full object-cover border border-border" />
            : <div className="h-9 w-9 rounded-full bg-[hsl(var(--sand))] flex items-center justify-center text-sm font-bold">{offer.creatorName.charAt(0)}</div>}
          <div className="min-w-0">
            <p className="font-medium truncate">{offer.title}</p>
            <p className="text-xs text-muted-foreground">Till {offer.creatorName} · {OFFER_TYPE_LABELS[offer.offerType] ?? offer.offerType} · {offer.category}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-muted-foreground hidden md:inline">{formatDate(offer.createdAt)}</span>
          <StatusBadge status={offer.status} />
        </div>
      </div>
      {open && (
        <div className="mt-3 pt-3 border-t border-border space-y-2 text-sm">
          <p className="whitespace-pre-line">{offer.message}</p>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            {offer.compensationAmount != null && offer.compensationAmount > 0 && <span>Ersättning: {formatCurrency(offer.compensationAmount)}</span>}
            {offer.productDescription && <span>Utbud: {offer.productDescription}</span>}
            {offer.deadline && <span>Deadline: {formatDate(offer.deadline)}</span>}
            {offer.viewedAt && <span>Sedd: {formatDate(offer.viewedAt)}</span>}
            {offer.respondedAt && <span>Svar: {formatDate(offer.respondedAt)}</span>}
          </div>
          {offer.responseMessage && <p className="text-sm">Kreatörens svar: <em>"{offer.responseMessage}"</em></p>}
          {canWithdraw && (
            <Button size="sm" variant="ghost" onClick={onWithdraw} disabled={withdrawing}>Dra tillbaka</Button>
          )}
        </div>
      )}
    </Card>
  );
}
