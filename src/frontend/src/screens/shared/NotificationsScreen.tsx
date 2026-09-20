/** Notifications as a page. Deep links point at the new routes. */
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { t } from '@/lib/i18n';
import { useAuthStore } from '@/stores/authStore';
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '@/hooks/api';
import type { Notification } from '@/types';
import { Button, EmptyState, List, ListRow, Page, PageHead, SkeletonList } from '@/components/ds';
import { ago } from '@/components/app/common';

export function notifTarget(n: Pick<Notification, 'type' | 'referenceId' | 'referenceType'>, role: string | null): string | null {
  const brand = role === 'Brand';
  const id = n.referenceId ?? null;
  const collab = (cid: string) => brand ? `/brand/ugc/collabs/${cid}` : `/creator/ugc/collabs/${cid}`;
  switch (n.referenceType) {
    case 'UgcCollab': return id ? collab(id) : null;
    case 'UgcCampaign': return brand && id ? `/brand/ugc/campaigns/${id}` : brand ? '/brand/campaigns?tab=orders' : '/creator/browse?type=video';
    case 'UgcProfile': return '/creator/settings/ugc';
    case 'SupportThread': return brand ? '/brand/messages?thread=support' : '/creator/messages?thread=support';
    case 'CommunityInvite': return '/creator/messages?tab=requests';
    case 'Brand': return id ? `/creator/brands/${id}` : '/creator/browse';
    case 'BrandFollowers': return '/brand/profile';
    case 'Community': return '/brand/creators?tab=community';
    case 'Campaign': return id ? `/brand/campaigns/${id}` : '/brand/campaigns';
  }
  switch (n.type) {
    case 'NewApplication': return '/brand/creators?tab=applications';
    case 'ApplicationApproved': case 'ApplicationRejected': return '/creator/assignments';
    case 'SubmissionApproved': case 'SubmissionRejected': case 'VideoVerified': case 'CampaignStarted': case 'CampaignCompleted': return brand ? '/brand/campaigns' : '/creator/assignments';
    case 'PayoutReady': case 'PayoutCompleted': return brand ? '/brand/campaigns' : '/creator/earnings';
    case 'PrOfferReceived': return '/creator/messages?tab=requests';
    case 'PrOfferAccepted': case 'PrOfferDeclined': return '/brand/messages?tab=offers';
    case 'BrandApproved': return '/brand';
    case 'CreatorApproved': return '/creator';
    case 'FraudAlert': return brand ? '/brand/campaigns' : null;
    case 'UgcCampaignMatch': return '/creator/browse?type=video';
    case 'UgcNewApplication': return '/brand/campaigns?tab=orders';
    case 'UgcCancelled': return brand ? '/brand/campaigns?tab=orders' : '/creator/assignments';
    case 'UgcHired': case 'UgcContractAccepted': case 'UgcDelivered': case 'UgcRevisionRequested': case 'UgcApproved': case 'UgcPaid': case 'UgcDeadlineReminder': case 'UgcAutoApproveReminder': case 'UgcDispute':
      return id ? collab(id) : brand ? '/brand/campaigns?tab=orders' : '/creator/assignments';
    case 'SystemMessage': return brand ? '/brand/messages?thread=support' : '/creator/messages?thread=support';
    default: return brand ? '/brand' : '/creator';
  }
}

export function NotificationsScreen() {
  const navigate = useNavigate();
  const { role } = useAuthStore();
  const { data, isLoading } = useNotifications(false);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const items = data?.data ?? [];
  const unread = items.filter((n) => !n.isRead).length;
  return (
    <Page>
      <PageHead title={t('Notiser')} back={{ onClick: () => navigate(-1) }} actions={unread > 0 ? <Button variant="ghost" size="sm" onClick={() => markAll.mutate()} loading={markAll.isPending}>{t('Markera alla lästa')}</Button> : undefined} />
      {isLoading ? <SkeletonList rows={4} /> : items.length === 0 ? (
        <EmptyState icon={<Bell />} title={t('Inga notiser än')} description={t('Vi hör av oss här när något händer.')} />
      ) : (
        <List>
          {items.map((n) => {
            const to = notifTarget(n, role);
            return (
              <ListRow key={n.id}
                leading={<span className="ds-dot" style={{ opacity: n.isRead ? 0 : 1, flex: '0 0 8px' }} />}
                title={<span style={{ fontWeight: n.isRead ? 500 : 600 }}>{n.title}</span>}
                subtitle={n.message} wrapSubtitle
                trailing={<span className="ds-caption ds-muted">{ago(n.createdAt)}</span>}
                chevron={!!to}
                onClick={() => { if (!n.isRead) markRead.mutate(n.id); if (to) navigate(to); }} />
            );
          })}
        </List>
      )}
    </Page>
  );
}
