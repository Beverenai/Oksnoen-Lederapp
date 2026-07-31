import { Suspense, lazy } from "react";
import { StatusPopupProvider } from "@/hooks/useStatusPopup";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { SplashScreen } from "@/components/SplashScreen";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import AppLayout from "@/components/layout/AppLayout";
import { useStatusBarTheme } from "@/hooks/useStatusBarTheme";
import { useAppMode } from "@/hooks/useAppMode";

// Critical path - load immediately
import Login from "@/pages/Login";
import Install from "@/pages/Install";
import Onboarding from "@/pages/Onboarding";
import Home from "@/pages/Home";
import NotFound from "@/pages/NotFound";

// Lazy load non-critical pages for better performance
const Profile = lazy(() => import("@/pages/Profile"));
const Leaders = lazy(() => import("@/pages/Leaders"));
const Team = lazy(() => import("@/pages/Team"));
const Passport = lazy(() => import("@/pages/Passport"));
const PassportActivity = lazy(() => import("@/pages/PassportActivity"));
const MyCabins = lazy(() => import("@/pages/MyCabins"));
const Schedule = lazy(() => import("@/pages/Schedule"));
const Skjaer = lazy(() => import("@/pages/Skjaer"));
const Stories = lazy(() => import("@/pages/Stories"));
const Admin = lazy(() => import("@/pages/admin/Admin"));
const AdminSettings = lazy(() => import("@/pages/admin/AdminSettings"));
const Nurse = lazy(() => import("@/pages/Nurse"));
const Fix = lazy(() => import("@/pages/Fix"));
const RopeControl = lazy(() => import("@/pages/RopeControl"));
const ImportantInfo = lazy(() => import("@/pages/ImportantInfo"));
const ParticipantStats = lazy(() => import("@/pages/admin/ParticipantStats"));
const Checkout = lazy(() => import("@/pages/admin/Checkout"));
const ShiftPlanner = lazy(() => import("@/pages/admin/ShiftPlanner"));
const ShiftPlannerMini = lazy(() => import("@/pages/admin/ShiftPlannerMini"));
const Dynga = lazy(() => import("@/pages/admin/Dynga"));
const MyShifts = lazy(() => import("@/pages/MyShifts"));
const Gjenglemt = lazy(() => import("@/pages/Gjenglemt"));
const PublicGjenglemt = lazy(() => import("@/pages/PublicGjenglemt"));
const GjenglemtAdmin = lazy(() => import("@/pages/GjenglemtAdmin"));
const Roulette = lazy(() => import("@/pages/Roulette"));
const Gensere = lazy(() => import("@/pages/Gensere"));
const Hendelser = lazy(() => import("@/pages/Hendelser"));
const Chat = lazy(() => import("@/pages/Chat"));
const More = lazy(() => import("@/pages/More"));
const PeriodArchive = lazy(() => import("@/pages/admin/PeriodArchive"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 min — data is fresh for 1 min, then re-fetched
      gcTime: 30 * 60 * 1000, // 30 min — keep data in memory longer
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchOnMount: true,
      retry: (failureCount) => {
        if (!navigator.onLine) return false;
        return failureCount < 2;
      },
    },
  },
});

// Preload frequently accessed pages after initial render
if (typeof window !== 'undefined') {
  setTimeout(() => {
    import("@/pages/Leaders");
    import("@/pages/Profile");
  }, 2000);
}

// Loading fallback for lazy-loaded pages
function PageLoader() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background">
      <div className="animate-pulse text-muted-foreground">Laster...</div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { leader, isLoading, isInitialized, isProfileComplete, authError, deactivatedMessage, retryAuth, isSuperAdmin } = useAuth();
  const { mode } = useAppMode();

  // Only show full-page loader during initial app load, never between page navigations
  if (!isInitialized && isLoading) {
    return <PageLoader />;
  }

  if (authError) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background gap-4 p-4 text-center">
        <p className="text-destructive">{authError}</p>
        <button onClick={retryAuth} className="px-4 py-2 rounded bg-primary text-primary-foreground">Prøv igjen</button>
      </div>
    );
  }

  if (deactivatedMessage) {
    return <Navigate to="/login" replace />;
  }

  if (!leader) {
    return <Navigate to="/login" replace />;
  }

  if (!isProfileComplete) {
    return <Navigate to="/onboarding" replace />;
  }

  // Inactive mode: hide all features for non-superadmins, only chat + profile allowed.
  if (mode === 'inactive' && !isSuperAdmin) {
    const path = window.location.pathname;
    const allowed = ['/', '/chat', '/profile'];
    if (!allowed.includes(path)) {
      return <Navigate to="/" replace />;
    }
  }

  return <AppLayout>{children}</AppLayout>;
}

function OnboardingRoute({ children }: { children: React.ReactNode }) {
  const { leader, isLoading, isInitialized, isProfileComplete } = useAuth();

  if (!isInitialized && isLoading) {
    return <PageLoader />;
  }

  if (!leader) {
    return <Navigate to="/login" replace />;
  }

  if (isProfileComplete) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { leader, isProfileComplete } = useAuth();
  const { isInstalled, hasDeclined, isIOS, isAndroid } = usePWAInstall();

  const isMobile = isIOS || isAndroid;
  const shouldShowInstall = isMobile && !isInstalled && !hasDeclined;

  // Determine redirect target once to avoid multiple redirects
  const getAuthRedirect = () => (isProfileComplete ? "/" : "/onboarding");

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Install route - simplified logic */}
        <Route 
          path="/install" 
          element={
            leader ? (
              <Navigate to={getAuthRedirect()} replace />
            ) : shouldShowInstall ? (
              <Install />
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />
        
        {/* Login route - simplified logic */}
        <Route 
          path="/login" 
          element={
            leader ? (
              <Navigate to={getAuthRedirect()} replace />
            ) : shouldShowInstall ? (
              <Navigate to="/install" replace />
            ) : (
              <Login />
            )
          } 
        />

        {/* Onboarding route */}
        <Route
          path="/onboarding"
          element={
            <OnboardingRoute>
              <Onboarding />
            </OnboardingRoute>
          }
        />

        {/* Protected routes */}
        <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/leaders" element={<ProtectedRoute><Leaders /></ProtectedRoute>} />
        <Route path="/passport" element={<ProtectedRoute><Passport /></ProtectedRoute>} />
        <Route path="/passport/activity" element={<ProtectedRoute><PassportActivity /></ProtectedRoute>} />
        <Route path="/team/:team" element={<ProtectedRoute><Team /></ProtectedRoute>} />
        <Route path="/my-cabins" element={<ProtectedRoute><MyCabins /></ProtectedRoute>} />
        <Route path="/schedule" element={<ProtectedRoute><Schedule /></ProtectedRoute>} />
        <Route path="/my-shifts" element={<ProtectedRoute><MyShifts /></ProtectedRoute>} />
        <Route path="/important-info" element={<ProtectedRoute><ImportantInfo /></ProtectedRoute>} />
        <Route path="/nurse" element={<ProtectedRoute><Nurse /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
        <Route path="/admin/settings" element={<ProtectedRoute><AdminSettings /></ProtectedRoute>} />
        <Route path="/admin/shifts" element={<ProtectedRoute><ShiftPlanner /></ProtectedRoute>} />
        <Route path="/admin/shifts-mini" element={<ProtectedRoute><ShiftPlannerMini /></ProtectedRoute>} />
        <Route path="/admin/dynga" element={<ProtectedRoute><Dynga /></ProtectedRoute>} />
        <Route path="/arkiv" element={<ProtectedRoute><PeriodArchive /></ProtectedRoute>} />
        <Route path="/gjenglemt" element={<ProtectedRoute><Gjenglemt /></ProtectedRoute>} />
        <Route path="/gjenglemt-admin" element={<GjenglemtAdmin />} />
        <Route path="/gjenglemt/:slug" element={<PublicGjenglemt />} />
        <Route path="/roulette" element={<ProtectedRoute><Roulette /></ProtectedRoute>} />
        <Route path="/gensere" element={<ProtectedRoute><Gensere /></ProtectedRoute>} />
        <Route path="/participant-stats" element={<ProtectedRoute><ParticipantStats /></ProtectedRoute>} />
        <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
        <Route path="/fix" element={<ProtectedRoute><Fix /></ProtectedRoute>} />
        <Route path="/rope-control" element={<ProtectedRoute><RopeControl /></ProtectedRoute>} />
        <Route path="/skjaer" element={<ProtectedRoute><Skjaer /></ProtectedRoute>} />
        <Route path="/stories" element={<ProtectedRoute><Stories /></ProtectedRoute>} />
        <Route path="/hendelser" element={<ProtectedRoute><Hendelser /></ProtectedRoute>} />
        <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
        <Route path="/mer" element={<ProtectedRoute><More /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

// Component that syncs status bar with theme
function StatusBarSync() {
  useStatusBarTheme();
  return null;
}

const App = () => (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <StatusBarSync />
        <TooltipProvider>
          <StatusPopupProvider>
            <SplashScreen />
            <OfflineIndicator />
            <BrowserRouter>
              <AuthProvider>
                <AppRoutes />
              </AuthProvider>
            </BrowserRouter>
          </StatusPopupProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
