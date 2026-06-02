import { useState } from 'react';
import { StatusBadge } from '@/components/ui';
import { useReceivedPrOffers, useRespondPrOffer, useMarkPrViewed } from '@/hooks/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { PrOffer } from '@/types';

const GRADS = ['linear-gradient(135deg,#FFD8C7,#F1A88F)', 'linear-gradient(135deg,#cdb8f2,#9c7de0)', 'linear-gradient(135deg,#F2C58A,#e0a04e)', 'linear-gradient(135deg,#a9dcc0,#5fb98a)'];
const grad = (s: string) => GRADS[((s || '').charCodeAt(0) || 0) % GRADS.length];

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
    <div className="camp-card">
      <div className="ch">
        {offer.brandLogoUrl
          ? <img src={offer.brandLogoUrl} alt={offer.brandName} className="mono" style={{ objectFit: 'cover' }} />
          : <span className="mono" style={{ background: grad(offer.brandName) }}>{offer.brandName.charAt(0).toUpperCase()}</span>}
        <div style={{ flex: 1 }}><div className="ttl">{offer.title}</div><div className="brand">{offer.brandName}</div></div>
        {offer.status === 'Sent' ? <span className="badge green">Ny</span> : <StatusBadge status={offer.status} />}
      </div>

      <div className="tags" style={{ marginTop: 12 }}>
        <span className="tag g">{OFFER_TYPE_LABELS[offer.offerType] ?? offer.offerType}</span>
        <span className="tag">{offer.category}</span>
        {offer.campaignName && <span className="tag">{offer.campaignName}</span>}
      </div>

      {!open ? (
        <button className="btn-outline" style={{ width: '100%', marginTop: 14 }} onClick={expand}>Läs erbjudande</button>
      ) : (
        <>
          <p style={{ fontSize: 13.5, marginTop: 12, whiteSpace: 'pre-line', color: 'var(--ink-2)', lineHeight: 1.5 }}>{offer.message}</p>
          <div className="meta-cols" style={{ marginBottom: 14 }}>
            {offer.compensationAmount != null && offer.compensationAmount > 0 && (
              <div className="mc"><div className="k">Ersättning</div><div className="v green">{formatCurrency(offer.compensationAmount)}</div></div>
            )}
            {offer.deadline && <div className="mc"><div className="k">Deadline</div><div className="v">{formatDate(offer.deadline)}</div></div>}
            {offer.productDescription && <div className="mc"><div className="k">Du får</div><div className="v">{offer.productDescription}{offer.productValue ? ` (${formatCurrency(offer.productValue)})` : ''}</div></div>}
          </div>

          {canRespond ? (
            <div>
              <textarea value={responseMessage} onChange={(e) => setResponseMessage(e.target.value)} rows={2} placeholder="Meddelande till företaget (valfritt)"
                style={{ width: '100%', border: '1px solid rgba(241,168,143,.22)', borderRadius: 13, padding: '12px 14px', fontSize: 13.5, fontFamily: 'inherit', background: 'rgba(255,255,255,.7)', resize: 'vertical' }} />
              {error && <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 6 }}>{error}</p>}
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button className="btn-apply" style={{ flex: 1, padding: 10 }} onClick={() => handleRespond(true)} disabled={respond.isPending}>Tacka ja</button>
                <button className="btn-outline" style={{ flex: 1, padding: 10 }} onClick={() => handleRespond(false)} disabled={respond.isPending}>Tacka nej</button>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 10 }}>
              {offer.status === 'Accepted' && 'Du tackade ja.'}
              {offer.status === 'Declined' && 'Du tackade nej.'}
              {offer.status === 'Completed' && 'Slutfört.'}
              {offer.responseMessage && ` — "${offer.responseMessage}"`}
            </p>
          )}
        </>
      )}
    </div>
  );
}

export function CreatorPrInboxPage() {
  const [status, setStatus] = useState<string>();
  const { data, isLoading } = useReceivedPrOffers(status);

  const tabs: { label: string; val?: string }[] = [
    { label: 'Alla', val: undefined }, { label: 'Nya', val: 'Sent' }, { label: 'Sedda', val: 'Viewed' }, { label: 'Accepterade', val: 'Accepted' }, { label: 'Nekade', val: 'Declined' },
  ];

  return (
    <section className="view active reveal" data-view="proffers">
      <div className="page-head">
        <div>
          <h1 className="page-title">Dina <em>PR-erbjudanden</em></h1>
          <p className="page-sub">Direkta PR-erbjudanden från företag och restauranger. Läs detaljerna och tacka ja eller nej.</p>
        </div>
      </div>

      <div className="tabs">
        {tabs.map((t) => <button key={t.label} className={`tab${status === t.val ? ' active' : ''}`} onClick={() => setStatus(t.val)}>{t.label}</button>)}
      </div>

      {isLoading ? <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>Laddar…</div> : data && data.data.length > 0 ? (
        <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 16 }}>
          {data.data.map((offer) => <OfferCard key={offer.id} offer={offer} />)}
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '54px 24px' }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Inga PR-erbjudanden ännu</div>
          <div style={{ color: 'var(--muted)', fontSize: 14, marginTop: 8, maxWidth: 440, marginInline: 'auto' }}>När företag skickar dig ett PR-erbjudande dyker det upp här. Se till att din profil och portfölj är uppdaterad.</div>
        </div>
      )}
    </section>
  );
}
