import React from 'react';
import { FEATURES } from '@/lib/features';
import { Navigate, Route, BrowserRouter as Router, Routes, useLocation, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VersionGuard } from '@/lib/versionGuard';
import { homeFor, rememberReturnTo } from '@/lib/session';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ToastProvider } from '@/components/vyrle/Toast';
import { useAuthStore } from '@/stores/authStore';
import { useAssignmentDetail } from '@/hooks/api';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage, VerifyEmailPage } from '@/pages/auth/AuthPages';
import { TikTokCallbackPage } from '@/pages/auth/TikTokCallbackPage';
import { TikTokSigninPage } from '@/pages/auth/TikTokSigninPage';
import { TermsPage, PrivacyPage } from '@/pages/LegalPages';
import { AdminDashboardPage } from '@/pages/admin/AdminPages';
import { DesignPreviewPage } from '@/pages/DesignPreview';

// ── The redesigned app (Phase 4) ─────────────────────────
import { CreatorShell, BrandShell } from '@/components/app/AppShell';
import { NotificationsScreen } from '@/screens/shared/NotificationsScreen';
import { MessagesScreen } from '@/screens/shared/MessagesScreen';
import { CollabScreen } from '@/screens/shared/CollabScreen';
import { BrandPublicScreen } from '@/screens/shared/BrandPublicScreen';
import { NotFoundScreen } from '@/screens/shared/NotFoundScreen';
import { CreatorHomeScreen } from '@/screens/creator/HomeScreen';
import { CreatorWorkScreen } from '@/screens/creator/WorkScreen';
import { CreatorCampaignDetailScreen } from '@/screens/creator/CampaignDetailScreen';
import { AssignmentScreen } from '@/screens/creator/AssignmentScreen';
import { CreatorOrderScreen } from '@/screens/creator/OrderScreen';
import { CreatorProfileScreen, CreatorProfileEditScreen } from '@/screens/creator/ProfileScreen';
import { EarningsScreen, VerificationScreen } from '@/screens/creator/EarningsScreen';
import { CreatorAnalyticsScreen } from '@/screens/creator/AnalyticsScreen';
import { LevelsScreen, SavedScreen, SettingsScreen, SettingsTikTokScreen, SettingsUgcScreen, SettingsAccountScreen, LinksScreen } from '@/screens/creator/MoreScreens';
import { BrandHomeScreen } from '@/screens/brand/HomeScreen';
import { BrandProgramsScreen } from '@/screens/brand/ProgramsScreen';
import { BrandCreatorsScreen } from '@/screens/brand/CreatorsScreen';
import { BrandCreatorDetailScreen } from '@/screens/brand/CreatorDetailScreen';
import { TapDetailScreen, TapFormScreen } from '@/screens/brand/TapScreens';
import { BrandCampaignDetailScreen, CampaignCreatorScreen } from '@/screens/brand/CampaignScreens';
import { CampaignFormScreen } from '@/screens/brand/CampaignFormScreen';
import { ReviewQueueScreen } from '@/screens/brand/ReviewQueueScreen';
import { BrandOrderDetailScreen, BrandOrderFormScreen } from '@/screens/brand/OrderScreens';
import { BrandProfileScreen, BrandProfileEditScreen } from '@/screens/brand/ProfileScreen';
import { BrandAnalyticsScreen } from '@/screens/brand/AnalyticsScreen';
import { BrandSettingsScreen, BrandSettingsAccountScreen } from '@/screens/brand/SettingsScreen';

function VyrleFrame({ src, title }: { src: string; title: string }) {
  return <iframe src={src} title={title} style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', border: 'none' }} />;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, throwOnError: false },
    mutations: { throwOnError: false },
  },
});

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { isAuthenticated, role } = useAuthStore();
  if (!isAuthenticated) {
    rememberReturnTo(window.location.pathname + window.location.search);
    return <Navigate to="/login" replace />;
  }
  if (allowedRoles && role && !allowedRoles.includes(role)) return <Navigate to={homeFor(role)} replace />;
  return <>{children}</>;
}

/** Login and register are for guests. Someone already signed in goes to their app. */
function GuestOnly({ children }: { children: React.ReactNode }) {
  const [signedIn] = React.useState(() => useAuthStore.getState().isAuthenticated);
  const role = useAuthStore.getState().role;
  if (signedIn && role) return <Navigate to={homeFor(role)} replace />;
  return <>{children}</>;
}

/** Old links keep working: same query string, new path. */
function Moved({ to }: { to: string }) {
  const loc = useLocation();
  const [path, query] = to.split('?');
  const merged = new URLSearchParams(loc.search);
  new URLSearchParams(query ?? '').forEach((v, k) => merged.set(k, v));
  const qs = merged.toString();
  return <Navigate to={`${path}${qs ? `?${qs}` : ''}${loc.hash}`} replace />;
}

/** `/brand/assignments/:id` used to be an orphan; it now lives under its campaign. */
function BrandAssignmentMoved() {
  const { id = '' } = useParams<{ id: string }>();
  const { data } = useAssignmentDetail(id);
  if (!data) return null;
  return <Navigate to={`/brand/campaigns/${data.campaignId}/creators/${id}`} replace />;
}

/** Stripe sends creators back to the profile with `?onboarding=done`; the verification screen handles it. */
function OnboardingAware({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  if (new URLSearchParams(loc.search).has('onboarding')) return <Navigate to={`/creator/earnings/verification${loc.search}`} replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Router>
        <VersionGuard />
        <Routes>
          {/* Public landing — the VYRLE marketing site */}
          <Route path="/" element={<VyrleFrame src="/vyrle.html" title="VYRLE" />} />
          <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
          <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/auth/tiktok/signin" element={<TikTokSigninPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/design" element={<DesignPreviewPage />} />
          <Route path="/auth/tiktok/callback" element={<ProtectedRoute allowedRoles={['Creator']}><TikTokCallbackPage /></ProtectedRoute>} />

          {/* Admin — standalone layout, unchanged */}
          <Route path="/admin" element={<ProtectedRoute allowedRoles={['Admin']}><AdminDashboardPage /></ProtectedRoute>} />
          <Route path="/admin/ugc/collabs/:id" element={<ProtectedRoute allowedRoles={['Admin']}><div className="ds-root"><ToastProvider><CollabScreen /></ToastProvider></div></ProtectedRoute>} />

          {/* Brand */}
          <Route element={<ProtectedRoute allowedRoles={['Brand']}><BrandShell /></ProtectedRoute>}>
            <Route path="/brand" element={<BrandHomeScreen />} />
            <Route path="/brand/notifications" element={<NotificationsScreen />} />
            <Route path="/brand/campaigns" element={<BrandProgramsScreen />} />
            <Route path="/brand/campaigns/new" element={<CampaignFormScreen />} />
            <Route path="/brand/campaigns/:id" element={<BrandCampaignDetailScreen />} />
            <Route path="/brand/campaigns/:id/creators/:assignmentId" element={<CampaignCreatorScreen />} />
            <Route path="/brand/tap/new" element={<TapFormScreen />} />
            <Route path="/brand/tap/:id" element={<TapDetailScreen />} />
            <Route path="/brand/tap/:id/edit" element={<TapFormScreen />} />
            <Route path="/brand/review" element={<ReviewQueueScreen />} />
            <Route path="/brand/creators" element={<BrandCreatorsScreen />} />
            <Route path="/brand/creators/:id" element={<BrandCreatorDetailScreen />} />
            <Route path="/brand/ugc/campaigns/new" element={<BrandOrderFormScreen />} />
            <Route path="/brand/ugc/campaigns/:id" element={<BrandOrderDetailScreen />} />
            <Route path="/brand/ugc/campaigns/:id/edit" element={<BrandOrderFormScreen />} />
            <Route path="/brand/ugc/collabs/:id" element={<CollabScreen />} />
            <Route path="/brand/messages" element={<MessagesScreen />} />
            <Route path="/brand/profile" element={<BrandProfileScreen />} />
            <Route path="/brand/profile/edit" element={<BrandProfileEditScreen />} />
            <Route path="/brand/analytics" element={<BrandAnalyticsScreen />} />
            <Route path="/brand/settings" element={<BrandSettingsScreen />} />
            <Route path="/brand/settings/account" element={<BrandSettingsAccountScreen />} />
            {/* Old addresses */}
            <Route path="/brand/tap" element={<Moved to="/brand/campaigns?tab=taps" />} />
            <Route path="/brand/community" element={<Moved to="/brand/creators?tab=community" />} />
            <Route path="/brand/applications" element={<Moved to="/brand/creators?tab=applications" />} />
            <Route path="/brand/ugc" element={<Moved to="/brand/campaigns?tab=orders" />} />
            <Route path="/brand/ugc/pipeline" element={<Moved to="/brand/campaigns?tab=orders" />} />
            <Route path="/brand/ugc/invite" element={<Moved to="/brand/ugc/campaigns/new" />} />
            <Route path="/brand/pr" element={<Moved to="/brand/messages?tab=offers" />} />
            <Route path="/brand/public-profile" element={<Moved to="/brand/profile" />} />
            <Route path="/brand/assignments/:id" element={<BrandAssignmentMoved />} />
            <Route path="/brand/*" element={<NotFoundScreen />} />
          </Route>

          {/* Creator */}
          <Route element={<ProtectedRoute allowedRoles={['Creator']}><CreatorShell /></ProtectedRoute>}>
            <Route path="/creator" element={<CreatorHomeScreen />} />
            <Route path="/creator/notifications" element={<NotificationsScreen />} />
            <Route path="/creator/assignments" element={<CreatorWorkScreen segment="mine" />} />
            <Route path="/creator/browse" element={<CreatorWorkScreen segment="discover" />} />
            <Route path="/creator/campaigns/:id" element={<CreatorCampaignDetailScreen />} />
            <Route path="/creator/assignments/:id" element={<AssignmentScreen />} />
            <Route path="/creator/ugc/orders/:id" element={<CreatorOrderScreen />} />
            <Route path="/creator/ugc/collabs/:id" element={<CollabScreen />} />
            <Route path="/creator/brands/:id" element={<BrandPublicScreen />} />
            <Route path="/creator/messages" element={<MessagesScreen />} />
            <Route path="/creator/profile" element={<OnboardingAware><CreatorProfileScreen /></OnboardingAware>} />
            <Route path="/creator/profile/edit" element={<CreatorProfileEditScreen />} />
            <Route path="/creator/earnings" element={<EarningsScreen />} />
            <Route path="/creator/earnings/verification" element={<VerificationScreen />} />
            <Route path="/creator/analytics" element={<CreatorAnalyticsScreen />} />
            <Route path="/creator/levels" element={<LevelsScreen />} />
            <Route path="/creator/saved" element={<SavedScreen />} />
            <Route path="/creator/settings" element={<OnboardingAware><SettingsScreen /></OnboardingAware>} />
            <Route path="/creator/settings/tiktok" element={<SettingsTikTokScreen />} />
            <Route path="/creator/settings/ugc" element={<SettingsUgcScreen />} />
            <Route path="/creator/settings/account" element={<SettingsAccountScreen />} />
            {FEATURES.linkTree && <Route path="/creator/links" element={<LinksScreen />} />}
            {/* Old addresses */}
            <Route path="/creator/taps" element={<Moved to="/creator/assignments#kranar" />} />
            <Route path="/creator/ugc" element={<Moved to="/creator/browse?type=video" />} />
            <Route path="/creator/ugc/applications" element={<Moved to="/creator/assignments#ansokta" />} />
            <Route path="/creator/ugc/collabs" element={<Moved to="/creator/assignments#video" />} />
            <Route path="/creator/ugc/profile" element={<Moved to="/creator/settings/ugc" />} />
            <Route path="/creator/pr" element={<Moved to="/creator/messages?tab=requests" />} />
            <Route path="/creator/portfolio" element={<Moved to="/creator/profile" />} />
            <Route path="/creator/*" element={<NotFoundScreen />} />
          </Route>

          {/* Redirect dashboard based on role */}
          <Route path="/dashboard" element={<RoleRedirect />} />
          {/* Mail CTAs land here and bounce to the right shell */}
          <Route path="/messages" element={<MessagesRedirect />} />
          <Route path="/ugc" element={<UgcRedirect />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Router>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}

function UgcRedirect() {
  const { isAuthenticated, role } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  switch (role) {
    case 'Brand': return <Navigate to="/brand/campaigns?tab=orders" replace />;
    case 'Creator': return <Navigate to="/creator/assignments#video" replace />;
    case 'Admin': return <Navigate to="/admin?section=ugc" replace />;
    default: return <Navigate to="/" replace />;
  }
}

function MessagesRedirect() {
  const { isAuthenticated, role } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  switch (role) {
    case 'Brand': return <Navigate to="/brand/messages" replace />;
    case 'Creator': return <Navigate to="/creator/messages" replace />;
    case 'Admin': return <Navigate to="/admin?section=users" replace />;
    default: return <Navigate to="/" replace />;
  }
}

function RoleRedirect() {
  const { isAuthenticated, role } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/" replace />;
  switch (role) {
    case 'Admin': return <Navigate to="/admin" replace />;
    case 'Brand': return <Navigate to="/brand" replace />;
    case 'Creator': return <Navigate to="/creator" replace />;
    default: return <Navigate to="/" replace />;
  }
}
