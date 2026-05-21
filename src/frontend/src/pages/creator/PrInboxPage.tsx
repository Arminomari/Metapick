import { useState } from 'react';
import { Button, Card, EmptyState, LoadingSpinner, StatusBadge } from '@/components/ui';
import { useReceivedPrOffers, useRespondPrOffer, useMarkPrViewed } from '@/hooks/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { PrOffer } from '@/types';

const OFFER_TYPE_LABELS: Record<string, string> = {
  ProductGifting: 'Produkt / gåva',
  Paid: 'Betald',
  Hybrid: 'Produkt + betalt',
  Event: 'Event',
};

function OfferCard({ offer }: { offer: PrOffer }) {
  const respond = useRespondPrOffer();
  const markViewed = useMarkPrViewed();
  const [open, setOpen] = useState(false);
  const [responseMessage, setResponseMessage] = useState('');
  const [error, setError] = useState('');

  const canRespond = offer.status === 'Sent' || offer.status === 'Viewed';

  const expand = () => {
    setOpen(true);
    if (offer.status === 'Sent') markViewed.mutate(offer.id);
  };

  const handleRespond = async (accept: boolean) => {
    setError('');
    try {
      await respond.mutateAsync({ id: offer.id, accept, responseMessage: responseMessage.trim() || undefined });
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Kunde inte svara');
    }
  };

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {offer.brandLogoUrl
            ? <img src={offer.brandLogoUrl} alt={offer.brandName} className="h-10 w-10 rounded-full object-cover border border-border" />
            : <div className="h-10 w-10 rounded-full bg-[hsl(var(--sand))] flex items-center justify-center text-sm font-bold">{offer.brandName.charAt(0)}</div>}
          <div>
            <h3 className="font-bold leading-tight">{offer.title}</h3>
            <p className="text-sm text-muted-foreground">{offer.brandName}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusBadge status={offer.status} />
          {offer.status === 'Sent' && <span className="text-[0.7rem] font-semibold text-primary">Ny</span>}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 text-xs">
        <span className="chip">{OFFER_TYPE_LABELS[offer.offerType] ?? offer.offerType}</span>
        <span className="chip">{offer.category}</span>
        {offer.campaignName && <span className="chip">Kampanj: {offer.campaignName}</span>}
      </div>

      {!open ? (
        <Button variant="secondary" size="sm" onClick={expand}>Läs erbjudande</Button>
      ) : (
        <>
          <p className="text-sm whitespace-pre-line">{offer.message}</p>
          <div className="grid grid-cols-2 gap-3 text-sm bg-[hsl(var(--sand)/0.4)] rounded-lg p-3">
            {offer.compensationAmount != null && offer.compensationAmount > 0 && (
              <div><span className="text-muted-foreground">Ersättning:</span> <strong>{formatCurrency(offer.compensationAmount)}</strong></div>
            )}
            {offer.productDescription && (
              <div className="col-span-2"><span className="text-muted-foreground">Du får:</span> {offer.productDescription}
                {offer.productValue ? ` (värde ${formatCurrency(offer.productValue)})` : ''}</div>
            )}
            {offer.deadline && (
              <div><span className="text-muted-foreground">Deadline:</span> {formatDate(offer.deadline)}</div>
            )}
          </div>

          {canRespond ? (
            <div className="space-y-2">
              <textarea value={responseMessage} onChange={(e) => setResponseMessage(e.target.value)} rows={2}
                placeholder="Meddelande till företaget (valfritt)"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleRespond(true)} disabled={respond.isPending}>✓ Tacka ja</Button>
                <Button size="sm" variant="destructive" onClick={() => handleRespond(false)} disabled={respond.isPending}>Tacka nej</Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {offer.status === 'Accepted' && '✓ Du tackade ja.'}
              {offer.status === 'Declined' && 'Du tackade nej.'}
              {offer.status === 'Completed' && '✓ Slutfört.'}
              {offer.responseMessage && ` — "${offer.responseMessage}"`}
            </p>
          )}
        </>
      )}
    </Card>
  );
}

export function CreatorPrInboxPage() {
  const [status, setStatus] = useState<string>();
  const { data, isLoading } = useReceivedPrOffers(status);

  return (
    <div className="space-y-6">
      <header className="grid grid-cols-12 gap-x-6 items-end">
        <div className="col-span-12 md:col-span-8">
          <p className="eyebrow">Creator studio · PR-erbjudanden</p>
          <h1 className="mt-3 text-display text-[clamp(2rem,4.5vw,3.25rem)]">
            Dina <span className="text-sunset">erbjudanden</span>.
          </h1>
        </div>
        <div className="col-span-12 md:col-span-4 md:text-right">
          <p className="text-sm text-muted-foreground col-prose md:ml-auto">
            Direkta PR-erbjudanden från företag och restauranger. Tacka ja eller nej.
          </p>
        </div>
      </header>
      <div className="hairline" />

      <div className="flex flex-wrap gap-2">
        {['Alla', 'Sent', 'Viewed', 'Accepted', 'Declined'].map((s) => (
          <Button key={s} variant={status === (s === 'Alla' ? undefined : s) ? 'primary' : 'secondary'} size="sm"
            onClick={() => setStatus(s === 'Alla' ? undefined : s)}>
            {s === 'Alla' ? 'Alla' : s === 'Sent' ? 'Nya' : s === 'Viewed' ? 'Sedda' : s === 'Accepted' ? 'Accepterade' : 'Nekade'}
          </Button>
        ))}
      </div>

      {isLoading ? <LoadingSpinner /> : data && data.data.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {data.data.map((offer) => <OfferCard key={offer.id} offer={offer} />)}
        </div>
      ) : (
        <EmptyState title="Inga PR-erbjudanden ännu"
          description="När företag skickar dig ett PR-erbjudande dyker det upp här. Se till att din profil och portfölj är uppdaterad!" />
      )}
    </div>
  );
}
