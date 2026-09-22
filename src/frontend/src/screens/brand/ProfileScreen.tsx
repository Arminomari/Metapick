/** Profil tab for brands: own profile as creators see it, posts, and the menu. One edit form for the company. */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BarChart3, LogOut, Settings } from 'lucide-react';
import api from '@/lib/api';
import { t, statusLabel } from '@/lib/i18n';
import { formatDate } from '@/lib/utils';
import { maskOrgNr } from '@/lib/masks';
import { CATEGORIES } from '@/lib/categories';
import { useAuthStore } from '@/stores/authStore';
import { useBrandProfile, useUpdateBrandProfile, useVerifyOrg, useBrandCampaigns } from '@/hooks/api';
import { useToast } from '@/components/vyrle/Toast';
import { ImagePicker } from '@/components/auth/ImagePicker';
import { Badge, BottomSheet, Button, Card, Field, List, ListRow, Page, PageHead, SkeletonList } from '@/components/ds';
import { NotifBell, apiMessage } from '@/components/app/common';
import { BrandPublicView } from '@/screens/shared/BrandPublicScreen';
import { ProfileChecklist } from '@/components/app/ProfileChecklist';
import { useBrandTaps } from '@/hooks/extra';

function PostSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [body, setBody] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [withImage, setWithImage] = useState(false);
  const publish = useMutation({
    mutationFn: async () => api.post('/brand/posts', { body: body.trim(), imageUrl: image }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['brand-public'] }); toast.push(t('Inlägget publicerat — alla följare har notifierats.'), 'success'); setBody(''); setImage(null); setWithImage(false); onClose(); },
    onError: (e) => toast.push(apiMessage(e, t('Kunde inte publicera inlägget')), 'error'),
  });
  return (
    <BottomSheet open={open} onClose={onClose} title={t('Skriv uppdatering')} footer={<><Button variant="secondary" onClick={() => setWithImage((v) => !v)}>{withImage ? t('Utan bild') : t('Lägg till bild')}</Button><Button loading={publish.isPending} disabled={!body.trim()} onClick={() => publish.mutate()}>{t('Publicera')}</Button></>}>
      <Field label={t('Till alla som följer er')}><textarea rows={4} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} autoFocus placeholder={t('Vad händer hos er? Nyheter, kampanjsläpp, vad ni vill se mer av…')} /></Field>
      {withImage && <ImagePicker value={image} onChange={setImage} label={t('Bild')} shape="rounded" />}
    </BottomSheet>
  );
}

export function BrandProfileScreen() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const { logout } = useAuthStore();
  const { data: profile, isLoading } = useBrandProfile();
  const [post, setPost] = useState(params.get('post') === '1');
  useEffect(() => { if (params.get('post') === '1') { setPost(true); const n = new URLSearchParams(params); n.delete('post'); setParams(n, { replace: true }); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [params.get('post')]);
  const verify = useVerifyOrg();
  const { data: taps = [] } = useBrandTaps();
  const { data: campaignsRes } = useBrandCampaigns();
  const del = useMutation({ mutationFn: async (postId: string) => api.delete(`/brand/posts/${postId}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['brand-public'] }); toast.push(t('Inlägget är borttaget'), 'success'); }, onError: (e) => toast.push(apiMessage(e, t('Kunde inte ta bort')), 'error') });
  if (isLoading || !profile?.id) return <Page><PageHead title={t('Profil')} /><SkeletonList rows={3} /></Page>;
  return (
    <Page>
      <PageHead title={t('Profil')} actions={<NotifBell />} />
      <div className="ds-row ds-row--wrap"><Badge tone={profile.status === 'Approved' ? 'ok' : 'warn'}>{statusLabel(profile.status)}</Badge>{!profile.organizationNumber ? <Badge tone="warn">{t('Org.nr saknas')}</Badge> : profile.orgVerified ? <Badge tone="ok">{t('Org.nr verifierat')}</Badge> : <Badge tone="warn">{t('Org.nr ej verifierat')}</Badge>}<Button variant="ghost" size="sm" onClick={() => navigate('/brand/profile/edit')}>{t('Redigera profil')}</Button></div>
      {profile.organizationNumber && !profile.orgVerified && (
        <Card>
          <p className="ds-body">{t('Organisationsnumret kontrolleras mot momsregistret (VIES). Verifieringen krävs för att beställa video och visa "Verifierat företag".')}</p>
          {profile.orgVerificationCheckedAt && <p className="ds-caption ds-muted" style={{ marginTop: 6 }}>{t('Senast kontrollerat')} {formatDate(profile.orgVerificationCheckedAt)}</p>}
          <div style={{ marginTop: 10 }}><Button variant="secondary" loading={verify.isPending} onClick={() => verify.mutate(undefined, { onSuccess: () => toast.push(t('Organisationsnumret är verifierat'), 'success'), onError: (e) => toast.push(apiMessage(e, t('Kunde inte verifiera')), 'error') })}>{t('Verifiera igen')}</Button></div>
        </Card>
      )}
      {profile.orgVerified && profile.orgVerifiedName && <p className="ds-caption ds-muted">{t('Registrerat namn')}: {profile.orgVerifiedName} · {profile.orgVerificationSource === 'Admin' ? t('verifierat av VYRLE') : t('verifierat mot momsregistret')}{profile.orgVerifiedAt ? ` · ${formatDate(profile.orgVerifiedAt)}` : ''}</p>}
      <ProfileChecklist title={t('Gör företagsprofilen komplett')} items={[
        { key: 'org', label: t('Verifiera organisationsnumret'), done: !!profile.orgVerified, to: '/brand/profile/edit' },
        { key: 'logo', label: t('Lägg till logotyp'), done: !!profile.logoUrl, to: '/brand/profile/edit' },
        { key: 'cover', label: t('Lägg till cover'), done: !!profile.coverUrl, to: '/brand/profile/edit' },
        { key: 'desc', label: t('Beskriv företaget (minst 40 tecken)'), done: (profile.description ?? '').trim().length >= 40, to: '/brand/profile/edit' },
        { key: 'program', label: t('Öppna en kran eller skapa en kampanj'), done: taps.length > 0 || (campaignsRes?.totalCount ?? 0) > 0, to: '/brand/tap/new' },
      ]} />
      <BrandPublicView id={profile.id} ownView onDeletePost={(id) => del.mutate(id)} />
      <List>
        <ListRow leading={<BarChart3 />} title={t('Statistik')} to="/brand/analytics" />
        <ListRow leading={<Settings />} title={t('Inställningar')} subtitle={t('Konto, språk, support')} to="/brand/settings" />
        <ListRow leading={<LogOut />} title={t('Logga ut')} chevron={false} onClick={() => { logout(); navigate('/login'); }} />
      </List>
      <PostSheet open={post} onClose={() => setPost(false)} />
    </Page>
  );
}

export function BrandProfileEditScreen() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { data: profile, isLoading } = useBrandProfile();
  const update = useUpdateBrandProfile();
  const [form, setForm] = useState<null | { companyName: string; organizationNumber: string; website: string; industry: string; description: string; contactPhone: string; logoUrl: string | null; coverUrl: string | null }>(null);
  const [error, setError] = useState('');
  useEffect(() => { if (profile && !form) setForm({ companyName: profile.companyName ?? '', organizationNumber: profile.organizationNumber ?? '', website: profile.website ?? '', industry: profile.industry ?? '', description: profile.description ?? '', contactPhone: profile.contactPhone ?? '', logoUrl: profile.logoUrl ?? null, coverUrl: profile.coverUrl ?? null }); }, [profile, form]);
  if (isLoading || !form) return <Page><PageHead title={t('Företagsprofil')} back={{ to: '/brand/profile' }} /><SkeletonList rows={3} /></Page>;
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    const org = form.organizationNumber.trim();
    if (org && !/^\d{6}-?\d{4}$/.test(org)) { setError(t('Ange organisationsnummer i formatet XXXXXX-XXXX')); return; }
    try { await update.mutateAsync({ ...form, organizationNumber: org || null, logoUrl: form.logoUrl ?? '', coverUrl: form.coverUrl ?? '' }); await qc.invalidateQueries({ queryKey: ['brand-public'] }); toast.push(t('Profilen sparad'), 'success'); navigate('/brand/profile'); }
    catch (e2) { setError(apiMessage(e2, t('Kunde inte spara profilen.'))); }
  };
  return (
    <Page>
      <PageHead title={t('Företagsprofil')} back={{ to: '/brand/profile' }} />
      <form onSubmit={save} className="ds-stack" style={{ gap: 16 }}>
        <Card>
          <ImagePicker label={t('Logotyp')} shape="rounded" value={form.logoUrl} onChange={(v) => setForm({ ...form, logoUrl: v })} hint={t('Visas för creators på kampanjer, kranar och erbjudanden.')} />
          <ImagePicker label={t('Omslagsbild')} shape="wide" aspect={3} value={form.coverUrl} onChange={(v) => setForm({ ...form, coverUrl: v })} hint={t('Bred bild överst på profilen (3:1). Utan bild visas en färgad bakgrund.')} />
        </Card>
        <Card>
          <div className="ds-stack" style={{ gap: 12 }}>
            <Field label={t('Företagsnamn')}><input required value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} /></Field>
            <Field label={t('Organisationsnummer')} hint={t('Krävs för att beställa video.')} error={error}><input inputMode="numeric" value={form.organizationNumber} placeholder="556677-8899" onChange={(e) => setForm({ ...form, organizationNumber: maskOrgNr(e.target.value) })} /></Field>
            <div className="ds-kv">
              <Field label={t('Bransch')}><select value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })}>{CATEGORIES.map((i) => <option key={i} value={i}>{t(i)}</option>)}</select></Field>
              <Field label={t('Telefon')}><input type="tel" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} /></Field>
            </div>
            <Field label={t('Webbplats')}><input type="url" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://…" /></Field>
            <Field label={t('Beskrivning')} hint={t('Vilka är ni? Varför ska en creator jobba med er?')}><textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          </div>
        </Card>
        <div className="ds-sticky-action"><Button type="submit" full loading={update.isPending}>{t('Spara')}</Button></div>
      </form>
    </Page>
  );
}
