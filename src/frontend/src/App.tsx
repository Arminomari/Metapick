import React from 'react';
import { Navigate, Route, BrowserRouter as Router, Routes, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { AppLayout } from '@/components/layout/AppLayout';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LoginPage, RegisterPage } from '@/pages/auth/AuthPages';
import { TikTokCallbackPage } from '@/pages/auth/TikTokCallbackPage';
import { LandingPage } from '@/pages/LandingPage';
import { TermsPage, PrivacyPage } from '@/pages/LegalPages';
import { AdminDashboardPage } from '@/pages/admin/AdminPages';
import { BrandDashboard, BrandCampaignListPage, BrandCampaignDetailPage, CreateCampaignPage, BrandApplicationsPage, BrandSettingsPage, BrandAssignmentDetailPage } from '@/pages/brand/BrandPages';
import { CreatorDashboard, BrowseCampaignsPage, CreatorAssignmentsPage, AssignmentDetailPage, EarningsPage, CreatorProfilePage } from '@/pages/creator/CreatorPages';

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
          {/* Public routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/auth/tiktok/callback" element={<ProtectedRoute allowedRoles={['Creator']}><TikTokCallbackPage /></ProtectedRoute>} />

          {/* Admin routes – standalone layout */}
          <Route path="/admin" element={<ProtectedRoute allowedRoles={['Admin']}><AdminDashboardPage /></ProtectedRoute>} />

          {/* Protected routes inside AppLayout */}
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            {/* Brand routes */}
            <Route path="/brand" element={<ProtectedRoute allowedRoles={['Brand']}><BrandDashboard /></ProtectedRoute>} />
            <Route path="/brand/campaigns" element={<ProtectedRoute allowedRoles={['Brand']}><BrandCampaignListPage /></ProtectedRoute>} />
            <Route path="/brand/campaigns/new" element={<ProtectedRoute allowedRoles={['Brand']}><CreateCampaignPage /></ProtectedRoute>} />
            <Route path="/brand/campaigns/:id" element={<ProtectedRoute allowedRoles={['Brand']}><CampaignDetailWrapper /></ProtectedRoute>} />
            <Route path="/brand/applications" element={<ProtectedRoute allowedRoles={['Brand']}><BrandApplicationsPage /></ProtectedRoute>} />
            <Route path="/brand/settings" element={<ProtectedRoute allowedRoles={['Brand']}><BrandSettingsPage /></ProtectedRoute>} />
            <Route path="/brand/assignments/:id" element={<ProtectedRoute allowedRoles={['Brand']}><BrandAssignmentDetailPage /></ProtectedRoute>} />

            {/* Creator routes */}
            <Route path="/creator" element={<ProtectedRoute allowedRoles={['Creator']}><CreatorDashboard /></ProtectedRoute>} />
            <Route path="/creator/browse" element={<ProtectedRoute allowedRoles={['Creator']}><BrowseCampaignsPage /></ProtectedRoute>} />
            <Route path="/creator/assignments" element={<ProtectedRoute allowedRoles={['Creator']}><CreatorAssignmentsPage /></ProtectedRoute>} />
            <Route path="/creator/assignments/:id" element={<ProtectedRoute allowedRoles={['Creator']}><AssignmentDetailPage /></ProtectedRoute>} />
            <Route path="/creator/earnings" element={<ProtectedRoute allowedRoles={['Creator']}><EarningsPage /></ProtectedRoute>} />
            <Route path="/creator/profile" element={<ProtectedRoute allowedRoles={['Creator']}><CreatorProfilePage /></ProtectedRoute>} />
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
