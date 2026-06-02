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

const VAL = (o: PrOffer) => (o.productValue ?? 0) + (o.compensationAmount ?? 0);

export function CreatorPrInboxPage() {
  const [tab, setTab] = useState<'all' | 'new' | 'active' | 'history'>('all');
  const { data, isLoading } = useReceivedPrOffers();
  const offers = data?.data ?? [];

  const accepted = offers.filter((o) => o.status === 'Accepted' || o.status === 'Completed');
  const inbox = offers.filter((o) => o.status === 'Sent' || o.status === 'Viewed');
  const history = offers.filter((o) => o.status === 'Declined' || o.status === 'Completed');
  const newCount = offers.filter((o) => o.status === 'Sent').length;
  const valueReceived = accepted.reduce((s, o) => s + VAL(o), 0);

  const shown = tab === 'new' ? inbox.filter((o) => o.status === 'Sent')
    : tab === 'active' ? accepted
    : tab === 'history' ? history
    : offers;

  const tabs: { key: typeof tab; label: string; n?: number }[] = [
    { key: 'all', label: 'Alla', n: offers.length }, { key: 'new', label: 'Nya', n: newCount }, { key: 'active', label: 'Aktiva', n: accepted.length }, { key: 'history', label: 'Historik', n: history.length },
  ];

  return (
    <section className="view active reveal" data-view="proffers">
      <div className="page-head">
        <div>
          <h1 className="page-title">Din <em>PR-hubb</em></h1>
          <p className="page-sub">Alla PR-erbjudanden du fått från företag, samlade. Acceptera, följ upp, och se det samlade värdet du behöver redovisa.</p>
        </div>
      </div>

      <div className="vstat-row">
        <div className="card vstat" style={{ background: 'linear-gradient(160deg,#fff,#FFF6F0)' }}>
          <div className="vstat-ico" style={{ background: 'linear-gradient(140deg,#d7f0e0,#a9dcc0)', color: '#2f7d52' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h4" /></svg></div>
          <div className="vstat-lbl">PR-värde mottaget</div>
          <div className="vstat-val">{formatCurrency(valueReceived)}</div>
          <div className="vstat-sub"><span className="vmut">att redovisa · skattepliktigt</span></div>
        </div>
        <div className="card vstat">
          <div className="vstat-ico" style={{ background: 'linear-gradient(140deg,#FFE3D3,#FFC2A6)', color: '#9c4f31' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 7" /></svg></div>
          <div className="vstat-lbl">Aktiva samarbeten</div>
          <div className="vstat-val">{accepted.length}</div>
          <div className="vstat-sub"><span className="vmut">accepterade PR</span></div>
        </div>
        <div className="card vstat">
          <div className="vstat-ico" style={{ background: 'linear-gradient(140deg,#EDE1FF,#cdb8f2)', color: '#6a4ea8' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m12 4 2.3 4.8 5.2.7-3.8 3.6.9 5.1L12 16l-4.6 2.8.9-5.1L4.5 9.5l5.2-.7z" /></svg></div>
          <div className="vstat-lbl">Nya erbjudanden</div>
          <div className="vstat-val">{newCount}</div>
          <div className="vstat-sub"><span className="vmut">väntar på svar</span></div>
        </div>
        <div className="card vstat">
          <div className="vstat-ico" style={{ background: 'linear-gradient(140deg,#FFE9D2,#F2C58A)', color: '#9c6b1c' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="m3 7 9 6 9-6" /></svg></div>
          <div className="vstat-lbl">Totalt mottagna</div>
          <div className="vstat-val">{offers.length}</div>
          <div className="vstat-sub"><span className="vmut">genom tiderna</span></div>
        </div>
      </div>

      <div className="tabs">
        {tabs.map((t) => <button key={t.key} className={`tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>{t.label}{t.n ? ` (${t.n})` : ''}</button>)}
      </div>

      {isLoading ? <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>Laddar…</div> : shown.length > 0 ? (
        <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 16 }}>
          {shown.map((offer) => <OfferCard key={offer.id} offer={offer} />)}
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '54px 24px' }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{tab === 'all' ? 'Inga PR-erbjudanden ännu' : 'Inget här ännu'}</div>
          <div style={{ color: 'var(--muted)', fontSize: 14, marginTop: 8, maxWidth: 440, marginInline: 'auto' }}>När företag skickar dig ett PR-erbjudande dyker det upp här. Se till att din profil och portfölj är uppdaterad så fler hittar dig.</div>
        </div>
      )}
    </section>
  );
}
