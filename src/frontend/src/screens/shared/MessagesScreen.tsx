/**
 * Meddelanden: Chatt (with VYRLE Support pinned) plus
 *   creator → Förfrågningar (PR offers and community invites, answered inline)
 *   brand   → Erbjudanden  (sent PR offers and their status)
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LifeBuoy, MessageCircle } from 'lucide-react';
import api from '@/lib/api';
import { t } from '@/lib/i18n';
import { money, formatDate } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useActionCounts, useChatConversations, useReceivedPrOffers, useRespondPrOffer, useMarkPrViewed, useSentPrOffers, useWithdrawPrOffer } from '@/hooks/api';
import { usePendingCommunityInvites, useSupportThread } from '@/hooks/extra';
import { useToast } from '@/components/vyrle/Toast';
import type { PrOffer } from '@/types';
import { Avatar, Badge, Button, Card, Chip, Chips, Count, EmptyState, Field, List, ListRow, Page, PageHead, SegmentedControl, SkeletonList, StatusBadge } from '@/components/ds';
import { ConversationList, ChatThread, Composer, ThreadHeader } from '@/components/app/Chat';
import { MoreMenu, NotifBell, ago, apiMessage } from '@/components/app/common';

const OFFER_TYPE: Record<string, string> = { ProductGifting: 'Produkt / gåva', Paid: 'Betald', Hybrid: 'Produkt + betalt', Event: 'Event' };

export function MessagesScreen() {
  const { role } = useAuthStore();
  const brand = role === 'Brand';
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === (brand ? 'offers' : 'requests') ? 'second' : 'chat';
  const thread = params.get('thread');
  const { data: convos = [] } = useChatConversations();
  const { data: counts } = useActionCounts(brand ? 'brand' : 'creator');
  const { data: received } = useReceivedPrOffers();
  const { data: invites = [] } = usePendingCommunityInvites();
  const unreadChat = convos.reduce((s, c) => s + (c.unreadCount || 0), 0) + (counts?.unreadSupport ?? 0);
  const pendingRequests = brand ? 0 : (received?.data ?? []).filter((o) => o.status === 'Sent').length + invites.length;

  if (thread) {
    const convo = convos.find((c) => c.threadId === thread);
    return (
      <Page>
        <PageHead title={thread === 'support' ? 'VYRLE Support' : convo?.counterpartName ?? t('Konversation')} back={{ onClick: () => setParams({}, { replace: true }) }} />
        {thread === 'support' ? <SupportThread /> : (
          <Card>
            {convo && <ThreadHeader convo={convo} />}
            <ChatThread threadId={thread} />
          </Card>
        )}
      </Page>
    );
  }

  return (
    <Page>
      <PageHead title={t('Meddelanden')} actions={<NotifBell />} />
      <SegmentedControl segments={[{ key: 'chat', label: t('Chatt'), count: unreadChat }, { key: 'second', label: brand ? t('Erbjudanden') : t('Förfrågningar'), count: pendingRequests }]} value={tab} onChange={(k) => setParams(k === 'chat' ? {} : { tab: brand ? 'offers' : 'requests' }, { replace: true })} />
      {tab === 'chat' ? (
        <ConversationList onOpen={(c) => setParams({ thread: c.threadId })} pinned={<ListRow leading={<Avatar name="V" size="md" />} title="VYRLE Support" badge={(counts?.unreadSupport ?? 0) > 0 ? <Count n={counts!.unreadSupport} /> : undefined} subtitle={t('Frågor om konto, utbetalningar eller något annat')} onClick={() => setParams({ thread: 'support' })} />} />
      ) : brand ? <SentOffers /> : <Requests />}
    </Page>
  );
}

/* ── Support ──────────────────────────────────────────────── */
function SupportThread() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data: messages = [], isLoading } = useSupportThread();
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (messages.length) qc.invalidateQueries({ queryKey: ['action-counts'] }); }, [messages.length, qc]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [messages.length]);
  const reply = useMutation({
    mutationFn: async (text: string) => (await api.post('/messages', { body: text })).data.data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['support-thread'] }); toast.push(t('Skickat! VYRLE-teamet får en notis direkt.'), 'success'); },
    onError: (e) => toast.push(apiMessage(e, t('Kunde inte skicka meddelandet')), 'error'),
  });
  return (
    <Card>
      <div style={{ display: 'flex', flexDirection: 'column', height: 'min(60vh, 520px)' }}>
        <div className="ds-thread" style={{ overflowY: 'auto', flex: 1 }}>
          {isLoading ? <div className="ds-caption ds-muted" style={{ textAlign: 'center' }}>{t('Laddar…')}</div> : messages.length === 0 ? (
            <EmptyState icon={<LifeBuoy />} title={t('Inga meddelanden ännu')} description={t('Har du en fråga om ditt konto, en utbetalning eller något annat? Skriv nedan så svarar teamet så fort de kan.')} />
          ) : messages.map((m) => (
            <div key={m.id} className={`ds-bubble ${m.fromAdmin ? 'ds-bubble--them' : 'ds-bubble--me'}`}>{m.body}<div className="ds-bubble-meta">{formatDate(m.createdAt)}</div></div>
          ))}
          <div ref={endRef} />
        </div>
        <Composer busy={reply.isPending} placeholder={t('Skriv till VYRLE-teamet…')} onSend={(text) => reply.mutateAsync(text).then(() => undefined)} />
      </div>
    </Card>
  );
}

/* ── Creator: Förfrågningar ───────────────────────────────── */
function Requests() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [history, setHistory] = useState(false);
  const { data, isLoading } = useReceivedPrOffers();
  const { data: invites = [] } = usePendingCommunityInvites();
  const answer = useMutation({
    mutationFn: async ({ id, accept }: { id: string; accept: boolean }) => (await api.post(`/creator/communities/${id}/${accept ? 'accept' : 'decline'}`)).data,
    onSuccess: (_d, v) => { ['my-communities', 'creator-taps', 'action-counts', 'brand-public'].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); toast.push(v.accept ? t('Du är med i communityn — deras öppna kranar finns under Kampanjer.') : t('Inbjudan avböjd'), 'success'); },
    onError: (e) => toast.push(apiMessage(e, t('Kunde inte svara på inbjudan')), 'error'),
  });
  const offers = data?.data ?? [];
  const open = offers.filter((o) => o.status === 'Sent' || o.status === 'Viewed');
  const past = offers.filter((o) => !['Sent', 'Viewed'].includes(o.status));
  if (isLoading) return <SkeletonList rows={3} />;
  return (
    <>
      <Chips><Chip selected={!history} onClick={() => setHistory(false)}>{t('Nya')}</Chip><Chip selected={history} onClick={() => setHistory(true)}>{t('Historik')}</Chip></Chips>
      {!history && invites.length === 0 && open.length === 0 && <Card><EmptyState icon={<MessageCircle />} title={t('Inga förfrågningar just nu')} description={t('När ett företag skickar ett PR-erbjudande eller bjuder in dig till sitt community dyker det upp här. Håll din profil uppdaterad så fler hittar dig.')} /></Card>}
      {!history && invites.map((r) => (
        <Card key={r.brandProfileId}>
          <ListRow className="ds-listrow--flush" leading={<Avatar name={r.brandName} src={r.brandLogoUrl} rounded />} title={r.brandName} subtitle={`${t('Inbjudan till community')} · ${formatDate(r.joinedAt)}`} chevron onClick={() => navigate(`/creator/brands/${r.brandProfileId}`)} />
          <p className="ds-body ds-muted" style={{ margin: '4px 0 12px' }}>{t('Som medlem kan du publicera när du vill och få betalt per verifierad view ur företagets öppna kranar.')}</p>
          <div className="ds-row"><Button onClick={() => answer.mutate({ id: r.brandProfileId, accept: true })} loading={answer.isPending}>{t('Acceptera')}</Button><Button variant="secondary" onClick={() => answer.mutate({ id: r.brandProfileId, accept: false })} disabled={answer.isPending}>{t('Avböj')}</Button></div>
        </Card>
      ))}
      {(history ? past : open).map((o) => <OfferCard key={o.id} offer={o} />)}
      {history && past.length === 0 && <Card><EmptyState title={t('Inget här ännu')} /></Card>}
    </>
  );
}

function OfferCard({ offer }: { offer: PrOffer }) {
  const navigate = useNavigate();
  const toast = useToast();
  const respond = useRespondPrOffer();
  const markViewed = useMarkPrViewed();
  const [open, setOpen] = useState(offer.status === 'Viewed');
  const [message, setMessage] = useState('');
  const canRespond = offer.status === 'Sent' || offer.status === 'Viewed';
  const expand = () => { setOpen(true); if (offer.status === 'Sent') markViewed.mutate(offer.id); };
  const send = (accept: boolean) => respond.mutateAsync({ id: offer.id, accept, responseMessage: message.trim() || undefined }).then(() => toast.push(accept ? t('Du tackade ja — företaget får en notis.') : t('Du tackade nej.'), 'success')).catch((e) => toast.push(apiMessage(e, t('Kunde inte svara')), 'error'));
  return (
    <Card>
      <ListRow className="ds-listrow--flush" leading={<Avatar name={offer.brandName} src={offer.brandLogoUrl} rounded />} title={offer.title} badge={offer.status === 'Sent' ? <Badge tone="accent">{t('Ny')}</Badge> : !canRespond ? <StatusBadge status={offer.status} /> : undefined} subtitle={`${offer.brandName} · ${t(OFFER_TYPE[offer.offerType] ?? offer.offerType)} · ${ago(offer.createdAt)}`} chevron onClick={() => navigate(`/creator/brands/${offer.brandProfileId}`)} />
      {!open ? <Button variant="secondary" full onClick={expand} style={{ marginTop: 8 }}>{t('Läs erbjudande')}</Button> : (
        <div className="ds-stack" style={{ gap: 12, marginTop: 8 }}>
          <p className="ds-prose">{offer.message}</p>
          <div className="ds-facts">
            {offer.compensationAmount != null && offer.compensationAmount > 0 && <div className="ds-fact"><span>{t('Ersättning')}</span><span className="ds-num">{money(offer.compensationAmount)}</span></div>}
            {offer.productDescription && <div className="ds-fact"><span>{t('Du får')}</span><span>{offer.productDescription}{offer.productValue ? ` (${money(offer.productValue)})` : ''}</span></div>}
            {offer.deadline && <div className="ds-fact"><span>Deadline</span><span>{formatDate(offer.deadline)}</span></div>}
          </div>
          {canRespond ? (
            <>
              <Field label={t('Meddelande till företaget (valfritt)')}><textarea rows={2} value={message} onChange={(e) => setMessage(e.target.value)} /></Field>
              <div className="ds-row"><Button onClick={() => void send(true)} loading={respond.isPending}>{t('Tacka ja')}</Button><Button variant="secondary" onClick={() => void send(false)} disabled={respond.isPending}>{t('Tacka nej')}</Button></div>
            </>
          ) : (
            <p className="ds-caption ds-muted">{offer.status === 'Accepted' ? t('Du tackade ja.') : offer.status === 'Declined' ? t('Du tackade nej.') : offer.status === 'Completed' ? t('Slutfört.') : ''}{offer.responseMessage ? ` — “${offer.responseMessage}”` : ''}</p>
          )}
        </div>
      )}
    </Card>
  );
}

/* ── Brand: Erbjudanden ───────────────────────────────────── */
function SentOffers() {
  const toast = useToast();
  const [status, setStatus] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useSentPrOffers(status, undefined, page);
  const withdraw = useWithdrawPrOffer();
  const rows = data?.data ?? [];
  const pages = data ? Math.ceil(data.totalCount / data.pageSize) : 1;
  const chips: [string | undefined, string][] = [[undefined, t('Alla')], ['Sent', t('Skickade')], ['Viewed', t('Sedda')], ['Accepted', t('Accepterade')], ['Declined', t('Nekade')]];
  return (
    <>
      <Chips>{chips.map(([k, l]) => <Chip key={l} selected={status === k} onClick={() => { setStatus(k); setPage(1); }}>{l}</Chip>)}</Chips>
      {isLoading ? <SkeletonList rows={3} /> : rows.length === 0 ? <Card><EmptyState title={t('Inga PR-erbjudanden här')} description={t('Skicka ett erbjudande från en creators profil så följer du svaret här.')} action={<Button to="/brand/creators?tab=find">{t('Hitta creators')}</Button>} /></Card> : (
        <List>
          {rows.map((o) => <SentRow key={o.id} offer={o} onWithdraw={() => withdraw.mutate(o.id, { onSuccess: () => toast.push(t('Erbjudandet är tillbakadraget'), 'success') })} />)}
        </List>
      )}
      {pages > 1 && <div className="ds-row" style={{ justifyContent: 'space-between' }}><Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t('Föregående')}</Button><span className="ds-caption ds-muted">{page} / {pages}</span><Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>{t('Nästa')}</Button></div>}
    </>
  );
}

function SentRow({ offer, onWithdraw }: { offer: PrOffer; onWithdraw: () => void }) {
  const [open, setOpen] = useState(false);
  const canWithdraw = offer.status === 'Sent' || offer.status === 'Viewed';
  return (
    <div>
      <ListRow leading={<Avatar name={offer.creatorName} src={offer.creatorAvatarUrl} />} title={offer.title} badge={<StatusBadge status={offer.status} />} subtitle={`${t('Till')} ${offer.creatorName} · ${t(OFFER_TYPE[offer.offerType] ?? offer.offerType)} · ${formatDate(offer.createdAt)}`} chevron={false} onClick={() => setOpen((v) => !v)}
        trailing={<MoreMenu items={[{ label: t('Visa profil'), to: `/brand/creators/${offer.creatorProfileId}` }, { label: t('Dra tillbaka'), danger: true, hidden: !canWithdraw, onClick: onWithdraw }]} />} />
      {open && (
        <div style={{ padding: '0 16px 14px 72px' }} className="ds-stack">
          <p className="ds-prose ds-muted">{offer.message}</p>
          <div className="ds-caption ds-muted">
            {offer.compensationAmount ? `${t('Ersättning')} ${money(offer.compensationAmount)} · ` : ''}{offer.productDescription ? `${offer.productDescription} · ` : ''}{offer.viewedAt ? `${t('Sedd')} ${formatDate(offer.viewedAt)} · ` : ''}{offer.respondedAt ? `${t('Svar')} ${formatDate(offer.respondedAt)}` : ''}
          </div>
          {offer.responseMessage && <p className="ds-body">“{offer.responseMessage}”</p>}
        </div>
      )}
    </div>
  );
}
