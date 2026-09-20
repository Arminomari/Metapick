/**
 * A campaign as a creator sees it before applying. New in the redesign:
 * search, notifications and saved cards now land here instead of the grid.
 */
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { t } from '@/lib/i18n';
import { formatDate, categoryLabel, countryName, payoutSummaryText, plural } from '@/lib/utils';
import { useCampaignDetail, useMyApplications, useSavedCampaignIds, useToggleSaveCampaign, useApplyToCampaign, useCreatorAssignments, useSavedCampaigns } from '@/hooks/api';
import type { ApiResponse, CampaignBrowseItem, PagedResult } from '@/types';
import { useToast } from '@/components/vyrle/Toast';
import { Avatar, Badge, BottomSheet, Button, Card, Field, Page, PageHead, Section, SkeletonList, StatRow, StatTile, StickyAction } from '@/components/ds';
import { MoreMenu, apiMessage, daysLeft } from '@/components/app/common';
import { PayoutEstimator, PayoutTerms, payoutHeadline } from '@/components/app/PayoutTerms';

/** The browse card for one campaign: brand, spots and payout summary live only there. */
function useBrowseItem(id: string) {
  const { data: saved } = useSavedCampaigns();
  const q = useQuery({
    queryKey: ['global-search-campaigns', 'Creator'],
    queryFn: async () => (await api.get<ApiResponse<PagedResult<CampaignBrowseItem>>>('/campaigns/browse', { params: { page: 1, pageSize: 50 } })).data.data.data,
    staleTime: 60_000,
  });
  return q.data?.find((c) => c.id === id) ?? saved?.find((s) => s.campaignId === id)?.campaign;
}

export function CreatorCampaignDetailScreen() {
  const { id = '' } = useParams<{ id: string }>();
  const toast = useToast();
  const { data: c, isLoading } = useCampaignDetail(id);
  const item = useBrowseItem(id);
  const { data: apps } = useMyApplications();
  const { data: asg } = useCreatorAssignments(undefined, 1, 100);
  const { data: savedIds } = useSavedCampaignIds();
  const toggleSave = useToggleSaveCampaign();
  const apply = useApplyToCampaign();
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState('');
  const [calc, setCalc] = useState(false);
  if (isLoading || !c) return <Page><PageHead title="" back={{ to: '/creator/browse' }} /><SkeletonList rows={3} /></Page>;

  const status = (apps?.data ?? []).find((a) => a.campaignId === id)?.status;
  const assignment = (asg?.data ?? []).find((a) => a.campaignId === id);
  const saved = (savedIds ?? []).includes(id);
  const spots = item?.spotsLeft;
  const full = spots != null && spots <= 0;
  const left = daysLeft(c.endDate);
  const send = async () => {
    try { await apply.mutateAsync({ campaignId: id, message: message.trim() }); toast.push(t('Ansökan skickad!'), 'success'); setApplying(false); }
    catch (e) { toast.push(apiMessage(e, t('Kunde inte skicka ansökan')), 'error'); }
  };

  return (
    <Page>
      <PageHead title={c.name} back={{ to: '/creator/browse' }} actions={<MoreMenu items={[
        { label: saved ? t('Ta bort från sparade') : t('Spara kampanj'), onClick: () => toggleSave.mutate({ campaignId: id, save: !saved }, { onSuccess: () => toast.push(saved ? t('Borttagen från Sparat') : t('Sparad'), 'success') }) },
        { label: t('Visa företaget'), hidden: !item?.brandProfileId, to: item?.brandProfileId ? `/creator/brands/${item.brandProfileId}` : undefined },
      ]} />} />

      <Card>
        <div className="ds-row">
          <Avatar name={item?.brandName || c.name} rounded />
          <div className="ds-grow">
            <div className="ds-heading">{item?.brandName ?? t('Kampanj')}</div>
            <div className="ds-caption ds-muted">{categoryLabel(c.category)} · {countryName(c.country)}</div>
          </div>
          {status === 'Approved' ? <Badge tone="ok">{t('Godkänd')}</Badge> : status === 'Pending' ? <Badge tone="warn">{t('Ansökt')}</Badge> : status === 'Rejected' ? <Badge tone="bad">{t('Nekad')}</Badge> : null}
        </div>
        <div style={{ marginTop: 12 }}>
          <StatRow cols={3}>
            <StatTile plain label={t('Ersättning')} value={item ? payoutSummaryText(item.payoutSummary) : payoutHeadline(c.payoutModel, c.payoutRules)} />
            <StatTile plain label={t('Platser')} value={spots != null ? `${spots} / ${c.maxCreators}` : String(c.maxCreators)} />
            <StatTile plain label={left != null ? t('Slutar om') : t('Slutdatum')} value={left != null ? `${left} ${t('dgr')}` : formatDate(c.endDate)} />
          </StatRow>
        </div>
        <p className="ds-prose" style={{ marginTop: 12 }}>{c.description}</p>
      </Card>

      <Section title={t('Brief')}>
        <Card>
          {c.contentInstructions && <p className="ds-prose">{c.contentInstructions}</p>}
          {c.requirements?.length > 0 && <ul className="ds-body" style={{ margin: '8px 0 0', paddingLeft: 18 }}>{c.requirements.map((r, i) => <li key={i}>{r.value || r.requirementType}{r.isRequired ? ` (${t('krav')})` : ''}</li>)}</ul>}
          {c.requiredHashtag && <p className="ds-body" style={{ marginTop: 8 }}><strong>{t('Hashtag')}:</strong> #{c.requiredHashtag.replace(/^#/, '')}</p>}
          {c.perks && <p className="ds-body" style={{ marginTop: 8 }}><strong>{t('Förmåner')}:</strong> {c.perks}</p>}
          {c.contentTags?.length > 0 && <div className="ds-tags" style={{ marginTop: 10 }}>{c.contentTags.map((tg) => <span key={tg} className="ds-tag">{tg}</span>)}</div>}
          {!c.contentInstructions && !c.requirements?.length && !c.perks && <p className="ds-body ds-muted">{t('Företaget har inte lagt till några extra instruktioner.')}</p>}
        </Card>
      </Section>

      <Section title={t('Ersättning')} action={(c.payoutRules?.length ?? 0) > 0 ? <Button variant="ghost" size="sm" onClick={() => setCalc((v) => !v)}>{calc ? t('Dölj kalkylen') : t('Räkna på din ersättning')}</Button> : undefined}>
        <Card>
          <PayoutTerms rules={c.payoutRules ?? []} minViews={c.minViews} />
          {calc && <div style={{ marginTop: 12 }}><PayoutEstimator model={c.payoutModel} rules={c.payoutRules ?? []} /></div>}
          <p className="ds-caption ds-muted" style={{ marginTop: 10 }}>{t('Period')}: {formatDate(c.startDate)} – {formatDate(c.endDate)}{spots != null ? ` · ${plural(spots, t('plats kvar'), t('platser kvar'))}` : ''}</p>
        </Card>
      </Section>

      <StickyAction>
        {status === 'Approved' ? <Button full to={assignment ? `/creator/assignments/${assignment.id}` : '/creator/assignments'}>{t('Godkänd — öppna uppdraget')}</Button>
          : status === 'Pending' ? <Button full variant="secondary" disabled>{t('Ansökan skickad — väntar på svar')}</Button>
          : status === 'Rejected' ? <Button full variant="secondary" disabled>{t('Ansökan nekad')}</Button>
          : full ? <Button full variant="secondary" disabled>{t('Fullbokad')}</Button>
          : <Button full onClick={() => setApplying(true)}>{t('Ansök')}</Button>}
      </StickyAction>

      <BottomSheet open={applying} onClose={() => setApplying(false)} title={`${t('Ansök till')} ${c.name}`} footer={<><Button variant="secondary" onClick={() => setApplying(false)}>{t('Avbryt')}</Button><Button loading={apply.isPending} disabled={message.trim().length < 10} onClick={() => void send()}>{t('Skicka ansökan')}</Button></>}>
        <p className="ds-caption ds-muted">{item?.brandName ? `${item.brandName} · ` : ''}{t('Det du skriver här är det första företaget läser om dig.')}</p>
        <Field label={t('Varför passar just du för den här kampanjen?')} hint={message.trim().length < 10 ? t('Minst 10 tecken.') : `${message.length}/1000`}><textarea rows={5} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} autoFocus placeholder={t('Berätta kort: vad du skapar, vem som följer dig och varför den här produkten känns rätt för din publik…')} /></Field>
      </BottomSheet>
    </Page>
  );
}
