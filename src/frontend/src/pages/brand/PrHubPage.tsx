import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pagination, StatusBadge } from '@/components/ui';
import { useSentPrOffers, usePrStats, useWithdrawPrOffer } from '@/hooks/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { PrOffer } from '@/types';

const OFFER_TYPE_LABELS: Record<string, string> = {
  ProductGifting: 'Produkt / gåva', Paid: 'Betald', Hybrid: 'Produkt + betalt', Event: 'Event',
};
const GRADS = ['linear-gradient(135deg,#FFD8C7,#F1A88F)', 'linear-gradient(135deg,#cdb8f2,#9c7de0)', 'linear-gradient(135deg,#F2C58A,#e0a04e)', 'linear-gradient(135deg,#a9dcc0,#5fb98a)'];
const grad = (s: string) => GRADS[((s || '').charCodeAt(0) || 0) % GRADS.length];

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card stat"><div className="top"><div className="ico soft"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg></div><div><div className="lbl">{label}</div><div className="val">{value}</div></div></div></div>
  );
}

export function BrandPrHubPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<string>();
  const [category, setCategory] = useState<string>();
  const [page, setPage] = useState(1);
  const { data: stats } = usePrStats();
  const { data, isLoading } = useSentPrOffers(status, category, page);
  const withdraw = useWithdrawPrOffer();

  const tabs: { label: string; val?: string }[] = [
    { label: 'Alla', val: undefined }, { label: 'Skickade', val: 'Sent' }, { label: 'Sedda', val: 'Viewed' }, { label: 'Accepterade', val: 'Accepted' }, { label: 'Nekade', val: 'Declined' }, { label: 'Tillbakadragna', val: 'Withdrawn' },
  ];

  return (
    <section className="view active reveal" data-view="proffers">
      <div className="page-head">
        <div>
          <h1 className="page-title">Din <em>PR-hubb</em></h1>
          <p className="page-sub">Skicka direkta PR-erbjudanden till kreatörer och följ varje utskick — sett, accepterat, nekat.</p>
        </div>
        <button className="btn-apply" style={{ width: 'auto', padding: '12px 22px', display: 'inline-flex', alignItems: 'center', gap: 8 }} onClick={() => navigate('/brand/creators')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3" /><circle cx="16" cy="9" r="2.5" /><path d="M3 19a6 6 0 0 1 12 0M14 18a5 5 0 0 1 7-1" /></svg> Hitta kreatörer
        </button>
      </div>

      <div className="stat-row" style={{ gridTemplateColumns: 'repeat(5,minmax(0,1fr))' }}>
        <Stat label="Totalt skickade" value={stats?.totalSent ?? 0} />
        <Stat label="Väntar (osedda)" value={stats?.pending ?? 0} />
        <Stat label="Sedda" value={stats?.viewed ?? 0} />
        <Stat label="Accepterade" value={stats?.accepted ?? 0} />
        <Stat label="Nekade" value={stats?.declined ?? 0} />
      </div>

      {stats && stats.byCategory.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="sec-head"><h3>Per kategori</h3></div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {stats.byCategory.map((c) => (
              <button key={c.category} className={`tab${category === c.category ? ' active' : ''}`} onClick={() => { setCategory(category === c.category ? undefined : c.category); setPage(1); }}>
                {c.category} <b style={{ marginLeft: 4 }}>{c.count}</b>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="tabs">
        {tabs.map((t) => <button key={t.label} className={`tab${status === t.val ? ' active' : ''}`} onClick={() => { setStatus(t.val); setPage(1); }}>{t.label}</button>)}
      </div>

      {isLoading ? <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>Laddar…</div> : data && data.data.length > 0 ? (
        <div className="card">
          {data.data.map((offer) => <SentOfferRow key={offer.id} offer={offer} onWithdraw={() => withdraw.mutate(offer.id)} withdrawing={withdraw.isPending} />)}
          <Pagination page={page} totalCount={data.totalCount} pageSize={data.pageSize} onPageChange={setPage} />
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '54px 24px' }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Inga PR-erbjudanden skickade</div>
          <div style={{ color: 'var(--muted)', fontSize: 14, marginTop: 8 }}>Hitta kreatörer och skicka ditt första PR-erbjudande.</div>
          <button className="btn-apply" style={{ width: 'auto', display: 'inline-block', padding: '11px 22px', marginTop: 16 }} onClick={() => navigate('/brand/creators')}>Hitta kreatörer</button>
        </div>
      )}
    </section>
  );
}

function SentOfferRow({ offer, onWithdraw, withdrawing }: { offer: PrOffer; onWithdraw: () => void; withdrawing: boolean }) {
  const [open, setOpen] = useState(false);
  const canWithdraw = offer.status === 'Sent' || offer.status === 'Viewed';
  return (
    <div className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 0 }}>
      <div className="vcamp" style={{ borderTop: 'none', paddingTop: 0, paddingBottom: open ? 12 : 0 }} onClick={() => setOpen((v) => !v)}>
        {offer.creatorAvatarUrl
          ? <img src={offer.creatorAvatarUrl} alt={offer.creatorName} className="vcamp-thumb" style={{ objectFit: 'cover' }} />
          : <span className="vcamp-thumb" style={{ background: grad(offer.creatorName) }}><span className="brand-mono">{offer.creatorName.charAt(0).toUpperCase()}</span></span>}
        <div className="vcamp-main">
          <div className="vcamp-b">{offer.title}</div>
          <div className="vcamp-m">Till {offer.creatorName} · {OFFER_TYPE_LABELS[offer.offerType] ?? offer.offerType} · {offer.category}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '0 0 auto' }}>
          <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{formatDate(offer.createdAt)}</span>
          <StatusBadge status={offer.status} />
        </div>
      </div>
      {open && (
        <div style={{ paddingTop: 12, borderTop: '1px solid rgba(241,168,143,.12)', fontSize: 13.5 }}>
          <p style={{ whiteSpace: 'pre-line', color: 'var(--ink-2)', lineHeight: 1.5 }}>{offer.message}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
            {offer.compensationAmount != null && offer.compensationAmount > 0 && <span>Ersättning: {formatCurrency(offer.compensationAmount)}</span>}
            {offer.productDescription && <span>Utbud: {offer.productDescription}</span>}
            {offer.deadline && <span>Deadline: {formatDate(offer.deadline)}</span>}
            {offer.viewedAt && <span>Sedd: {formatDate(offer.viewedAt)}</span>}
            {offer.respondedAt && <span>Svar: {formatDate(offer.respondedAt)}</span>}
          </div>
          {offer.responseMessage && <p style={{ marginTop: 8 }}>Kreatörens svar: <em>"{offer.responseMessage}"</em></p>}
          {canWithdraw && <button className="btn-outline" style={{ marginTop: 10, padding: '8px 16px', fontSize: 12.5 }} onClick={onWithdraw} disabled={withdrawing}>Dra tillbaka</button>}
        </div>
      )}
    </div>
  );
}
