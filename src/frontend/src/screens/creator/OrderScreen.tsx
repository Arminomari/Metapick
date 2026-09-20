/** A video order (UGC campaign) as a creator sees it, with the bid sheet. */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { t } from '@/lib/i18n';
import { plural, money } from '@/lib/utils';
import { useToast } from '@/components/vyrle/Toast';
import { useUgcCreatorCampaign, useUgcCreatorProfile, useApplyToUgcCampaign, formatOre, kronorToOre, oreToKronor, COMPENSATION_LABEL, RIGHTS_LABEL, apiError, type UgcBrief } from '@/hooks/ugc';
import { Avatar, Badge, BottomSheet, Button, Card, EmptyState, Field, Page, PageHead, Section, SkeletonList, StatRow, StatTile, StickyAction } from '@/components/ds';

export function BriefView({ b }: { b: UgcBrief }) {
  const L = ({ k, v }: { k: string; v: React.ReactNode }) => <div className="ds-body" style={{ marginBottom: 6 }}><strong>{k}:</strong> {v}</div>;
  return (
    <div>
      <L k={t('Mål')} v={b.goal} />
      <L k={t('Format')} v={`${b.format}, ${b.lengthSeconds} s, ${b.videoCount} ${b.videoCount === 1 ? t('video') : t('videor')}`} />
      {b.hooks.length > 0 && <L k={t('Hooks')} v={<ul style={{ margin: '2px 0 0 18px' }}>{b.hooks.map((h, i) => <li key={i}>{h}</li>)}</ul>} />}
      <L k={t('Call to action')} v={b.callToAction} />
      {b.dos.length > 0 && <L k={t('Gör')} v={b.dos.join(' · ')} />}
      {b.donts.length > 0 && <L k={t('Undvik')} v={b.donts.join(' · ')} />}
      {b.referenceUrls.length > 0 && <L k={t('Referenser')} v={b.referenceUrls.map((u, i) => <a key={i} href={u} target="_blank" rel="noopener noreferrer" className="ds-link" style={{ display: 'block', overflowWrap: 'anywhere' }}>{u}</a>)} />}
      {b.extraNotes && <L k={t('Övrigt')} v={b.extraNotes} />}
    </div>
  );
}

export function CreatorOrderScreen() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: c, isLoading } = useUgcCreatorCampaign(id);
  const { data: profile } = useUgcCreatorProfile();
  const apply = useApplyToUgcCampaign();
  const [open, setOpen] = useState(false);
  const [bid, setBid] = useState('');
  const [pitch, setPitch] = useState('');
  if (isLoading || !c) return <Page><PageHead title="" back={{ to: '/creator/browse?type=video' }} /><SkeletonList rows={3} /></Page>;
  const product = c.compensation === 'ProductExchange';
  const blocked = (product ? profile?.canTakeProduct : profile?.canTakePaid) === false;
  const start = () => { setBid(oreToKronor(product ? 0 : Math.round((c.budgetMinOre + c.budgetMaxOre) / 2))); setPitch(''); setOpen(true); };
  const send = () => apply.mutate({ campaignId: c.id, bidOre: kronorToOre(bid), pitch }, { onSuccess: () => { toast.push(t('Ansökan är skickad. Företaget får en notis.'), 'success'); setOpen(false); }, onError: (e) => toast.push(apiError(e, t('Kunde inte skicka ansökan')), 'error') });
  const spots = c.slots - c.hiredCount;

  return (
    <Page>
      <PageHead title={c.title} back={{ to: '/creator/browse?type=video' }} />
      <Card>
        <div className="ds-row"><Avatar name={c.brandName} src={c.brandLogoUrl} rounded /><div className="ds-grow"><div className="ds-heading">{c.brandName}</div><div className="ds-caption ds-muted">{c.region ? `${c.region} · ` : ''}{t(COMPENSATION_LABEL[c.compensation])} · {t(RIGHTS_LABEL[c.rightsPackage])}</div></div>{c.briefGeneratedByAi && <Badge>AI</Badge>}</div>
        <div style={{ marginTop: 12 }}>
          <StatRow cols={3}>
            <StatTile plain label={t('Ersättning')} value={product ? t('Produkt') : `${money(c.budgetMinOre / 100)}–${money(c.budgetMaxOre / 100)}`} />
            <StatTile plain label={t('Format')} value={`${c.brief.lengthSeconds} s · ${c.brief.videoCount} st`} />
            <StatTile plain label={t('Leverans')} value={`${c.deadlineDays} ${t('dagar')}`} hint={spots > 0 ? plural(spots, t('plats kvar'), t('platser kvar')) : t('fullbokad')} />
          </StatRow>
        </div>
        {product && c.productDescription && <p className="ds-body" style={{ marginTop: 10 }}><strong>{t('Du får')}:</strong> {c.productDescription}{c.productValueOre ? ` (${t('värde')} ${formatOre(c.productValueOre)})` : ''}</p>}
      </Card>
      <Section title={t('Brief')}><Card><BriefView b={c.brief} /></Card></Section>
      {c.myApplicationStatus && !c.myCollabId && <Card><EmptyState title={c.myApplicationStatus === 'Rejected' ? t('Ansökan antogs inte') : c.myApplicationStatus === 'Withdrawn' ? t('Ansökan återtagen') : t('Ansökan skickad')} description={c.myBidOre ? `${t('Ditt bud')}: ${formatOre(c.myBidOre)}` : undefined} /></Card>}

      <StickyAction>
        {c.myCollabId ? <Button full to={`/creator/ugc/collabs/${c.myCollabId}`}>{t('Anlitad — öppna uppdraget')}</Button>
          : c.myApplicationStatus ? <Button full variant="secondary" to="/creator/assignments#ansokta">{t('Se din ansökan')}</Button>
          : blocked ? <Button full variant="secondary" onClick={() => { toast.push(profile?.blocker ?? t('Verifiera dig under Profil › Intäkter först.'), 'error'); navigate('/creator/earnings/verification'); }}>{t('Verifiera dig först')}</Button>
          : <Button full disabled={!profile || spots <= 0} onClick={start}>{spots <= 0 ? t('Fullbokad') : t('Ansök')}</Button>}
      </StickyAction>

      <BottomSheet open={open} onClose={() => setOpen(false)} title={`${t('Ansök om')} ${c.title}`} footer={<><Button variant="secondary" onClick={() => setOpen(false)}>{t('Avbryt')}</Button><Button loading={apply.isPending} disabled={pitch.trim().length < 20} onClick={send}>{t('Skicka ansökan')}</Button></>}>
        {!product && <Field label={`${t('Ditt pris per video (kr)')} · ${formatOre(c.budgetMinOre)}–${formatOre(c.budgetMaxOre)}`} hint={t('Du får exakt det här beloppet — VYRLE:s avgift läggs ovanpå för företaget.')}><input inputMode="decimal" value={bid} onChange={(e) => setBid(e.target.value)} /></Field>}
        <Field label={t('Pitch — varför just du?')} hint={pitch.trim().length < 20 ? t('Minst 20 tecken.') : `${pitch.length}/2000`}><textarea rows={4} maxLength={2000} value={pitch} onChange={(e) => setPitch(e.target.value)} placeholder={t('Vad du brukar göra, vem som följer dig, och hur du skulle lösa just den här briefen…')} /></Field>
      </BottomSheet>
    </Page>
  );
}
