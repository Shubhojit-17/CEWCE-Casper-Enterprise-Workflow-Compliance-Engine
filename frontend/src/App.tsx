import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth';
import { useWalletStore } from './stores/wallet';

// Layouts
import { DashboardLayout } from './layouts/DashboardLayout';
import { AuthLayout } from './layouts/AuthLayout';

// Pages
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { WorkflowsPage } from './pages/workflows/WorkflowsPage';
import { WorkflowDetailPage } from './pages/workflows/WorkflowDetailPage';
import { CreateWorkflowPage } from './pages/workflows/CreateWorkflowPage';
import { TemplatesPage } from './pages/templates/TemplatesPage';
import { AuditLogPage } from './pages/audit/AuditLogPage';
import { SettingsPage } from './pages/settings/SettingsPage';
import { WalletPage } from './pages/wallet/WalletPage';
import { UsersPage } from './pages/users/UsersPage';
import VerifyCompliancePage from './pages/compliance/VerifyCompliancePage';

// Main Landing Page (scroll-driven narrative UX)
import { LandingPage } from './pages/LandingPage';

// Protected Route Wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-enterprise-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  return <>{children}</>;
}

// Public Route (redirect if authenticated)
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-enterprise-primary" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function App() {
  const { checkAuth } = useAuthStore();
  const { tryReconnect } = useWalletStore();

  // Check authentication status on app mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Attempt to auto-reconnect wallet if previously connected
  useEffect(() => {
    // Small delay to let wallet extension inject its provider
    const timer = setTimeout(() => {
      tryReconnect();
    }, 500);
    
    return () => clearTimeout(timer);
  }, [tryReconnect]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route
          path="/auth"
          element={
            <PublicRoute>
              <AuthLayout />
            </PublicRoute>
          }
        >
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
          <Route path="reset-password" element={<ResetPasswordPage />} />
        </Route>

        {/* Public Verification Page (no auth required) */}
        <Route path="/verify" element={<VerifyCompliancePage />} />

        {/* Main Landing Page (public, no auth required) */}
        <Route path="/landing" element={<LandingPage />} />

        {/* Protected Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="workflows" element={<WorkflowsPage />} />
          <Route path="workflows/new" element={<CreateWorkflowPage />} />
          <Route path="workflows/:id" element={<WorkflowDetailPage />} />
          <Route path="templates" element={<TemplatesPage />} />
          <Route path="audit" element={<AuditLogPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="wallet" element={<WalletPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* Fallback - redirect to landing for unknown routes */}
        <Route path="*" element={<Navigate to="/landing" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
