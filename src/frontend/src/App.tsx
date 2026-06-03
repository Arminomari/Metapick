import React from 'react';
import { Navigate, Route, BrowserRouter as Router, Routes, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { CreatorShell, BrandShell } from '@/components/layout/VyrleShell';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LoginPage, RegisterPage } from '@/pages/auth/AuthPages';
import { TikTokCallbackPage } from '@/pages/auth/TikTokCallbackPage';
import { TermsPage, PrivacyPage } from '@/pages/LegalPages';
import { AdminDashboardPage } from '@/pages/admin/AdminPages';
import { BrandStudioDashboard } from '@/pages/brand/BrandStudio';
import { BrandCampaignListPage, BrandCampaignDetailPage, CreateCampaignPage, BrandApplicationsPage, BrandSettingsPage, BrandAssignmentDetailPage } from '@/pages/brand/BrandPages';
import { DiscoverCreatorsPage, BrandCreatorDetailPage } from '@/pages/brand/CreatorDiscoveryPages';
import { BrandPrHubPage } from '@/pages/brand/PrHubPage';
import { BrandAnalyticsPage } from '@/pages/brand/AnalyticsPage';
import { CreatorStudioDashboard } from '@/pages/creator/CreatorStudio';
import { BrowseCampaignsPage, CreatorAssignmentsPage, AssignmentDetailPage, EarningsPage, CreatorProfilePage } from '@/pages/creator/CreatorPages';
import { CreatorPortfolioPage } from '@/pages/creator/PortfolioPage';
import { CreatorPrInboxPage } from '@/pages/creator/PrInboxPage';
import { CreatorAnalyticsPage, CreatorLinksPage, CreatorLevelsPage, CreatorSavedPage } from '@/pages/creator/CreatorExtraPages';

function VyrleFrame({ src, title }: { src: string; title: string }) {
  return (
    <iframe
      src={src}
      title={title}
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', border: 'none' }}
    />
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      throwOnError: false,
    },
    mutations: {
      throwOnError: false,
    },
  },
});

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { isAuthenticated, role } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (allowedRoles && role && !allowedRoles.includes(role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function CampaignDetailWrapper() {
  const { id } = useParams<{ id: string }>();
  return <BrandCampaignDetailPage campaignId={id!} />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Router>
        <Routes>
          {/* Public landing — the VYRLE marketing site */}
          <Route path="/" element={<VyrleFrame src="/vyrle.html" title="VYRLE" />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/auth/tiktok/callback" element={<ProtectedRoute allowedRoles={['Creator']}><TikTokCallbackPage /></ProtectedRoute>} />

          {/* Admin — standalone layout */}
          <Route path="/admin" element={<ProtectedRoute allowedRoles={['Admin']}><AdminDashboardPage /></ProtectedRoute>} />

          {/* Brand area — VYRLE shell */}
          <Route element={<ProtectedRoute allowedRoles={['Brand']}><BrandShell /></ProtectedRoute>}>
            <Route path="/brand" element={<BrandStudioDashboard />} />
            <Route path="/brand/analytics" element={<BrandAnalyticsPage />} />
            <Route path="/brand/campaigns" element={<BrandCampaignListPage />} />
            <Route path="/brand/campaigns/new" element={<CreateCampaignPage />} />
            <Route path="/brand/campaigns/:id" element={<CampaignDetailWrapper />} />
            <Route path="/brand/applications" element={<BrandApplicationsPage />} />
            <Route path="/brand/creators" element={<DiscoverCreatorsPage />} />
            <Route path="/brand/creators/:id" element={<BrandCreatorDetailPage />} />
            <Route path="/brand/pr" element={<BrandPrHubPage />} />
            <Route path="/brand/settings" element={<BrandSettingsPage />} />
            <Route path="/brand/assignments/:id" element={<BrandAssignmentDetailPage />} />
          </Route>

          {/* Creator area — VYRLE shell */}
          <Route element={<ProtectedRoute allowedRoles={['Creator']}><CreatorShell /></ProtectedRoute>}>
            <Route path="/creator" element={<CreatorStudioDashboard />} />
            <Route path="/creator/browse" element={<BrowseCampaignsPage />} />
            <Route path="/creator/assignments" element={<CreatorAssignmentsPage />} />
            <Route path="/creator/assignments/:id" element={<AssignmentDetailPage />} />
            <Route path="/creator/portfolio" element={<CreatorPortfolioPage />} />
            <Route path="/creator/analytics" element={<CreatorAnalyticsPage />} />
            <Route path="/creator/pr" element={<CreatorPrInboxPage />} />
            <Route path="/creator/links" element={<CreatorLinksPage />} />
            <Route path="/creator/earnings" element={<EarningsPage />} />
            <Route path="/creator/levels" element={<CreatorLevelsPage />} />
            <Route path="/creator/saved" element={<CreatorSavedPage />} />
            <Route path="/creator/profile" element={<CreatorProfilePage />} />
          </Route>

          {/* Redirect dashboard based on role */}
          <Route path="/dashboard" element={<RoleRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </QueryClientProvider>
    </ErrorBoundary>
  );
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
