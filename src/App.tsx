import { Suspense, lazy } from "react";
import { StatusPopupProvider } from "@/hooks/useStatusPopup";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
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
const loadProfile = () => import("@/pages/Profile");
const loadLeaders = () => import("@/pages/Leaders");
const loadPassport = () => import("@/pages/Passport");
const loadChat = () => import("@/pages/Chat");
const loadMore = () => import("@/pages/More");

const Profile = lazy(loadProfile);
const Leaders = lazy(loadLeaders);
const Team = lazy(() => import("@/pages/Team"));
const Passport = lazy(loadPassport);
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
const Morder = lazy(() => import("@/pages/Morder"));
const Gensere = lazy(() => import("@/pages/Gensere"));
const Hendelser = lazy(() => import("@/pages/Hendelser"));
const Chat = lazy(loadChat);
const More = lazy(loadMore);
const LederpassPage = lazy(() => import("@/pages/Lederpass"));
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

// Warm the primary tabs after startup so the first tab switch feels immediate.
if (typeof window !== 'undefined') {
  setTimeout(() => {
    void Promise.allSettled([
      loadProfile(),
      loadLeaders(),
      loadPassport(),
      loadChat(),
      loadMore(),
    ]);
  }, 800);
}

// Loading fallback for lazy-loaded pages
function PageLoader() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background">
      <div className="animate-pulse text-muted-foreground">Laster...</div>
    </div>
  );
}

function ProtectedRoute() {
  const { leader, isLoading, isInitialized, isProfileComplete, authError, deactivatedMessage, retryAuth, isSuperAdmin } = useAuth();
  const { mode } = useAppMode();
  const location = useLocation();

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
    const allowed = ['/', '/chat', '/profile'];
    if (!allowed.includes(location.pathname)) {
      return <Navigate to="/" replace />;
    }
  }

  return <AppLayout />;
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

        {/* Protected routes share one persistent app shell. */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Home />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/leaders" element={<Leaders />} />
          <Route path="/passport" element={<Passport />} />
          <Route path="/passport/activity" element={<PassportActivity />} />
          <Route path="/team/:team" element={<Team />} />
          <Route path="/my-cabins" element={<MyCabins />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/my-shifts" element={<MyShifts />} />
          <Route path="/important-info" element={<ImportantInfo />} />
          <Route path="/nurse" element={<Nurse />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/settings" element={<AdminSettings />} />
          <Route path="/admin/shifts" element={<ShiftPlanner />} />
          <Route path="/admin/shifts-mini" element={<ShiftPlannerMini />} />
          <Route path="/admin/dynga" element={<Dynga />} />
          <Route path="/arkiv" element={<PeriodArchive />} />
          <Route path="/gjenglemt" element={<Gjenglemt />} />
          <Route path="/roulette" element={<Roulette />} />
          <Route path="/morder" element={<Morder />} />
          <Route path="/gensere" element={<Gensere />} />
          <Route path="/participant-stats" element={<ParticipantStats />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/fix" element={<Fix />} />
          <Route path="/rope-control" element={<RopeControl />} />
          <Route path="/skjaer" element={<Skjaer />} />
          <Route path="/stories" element={<Stories />} />
          <Route path="/hendelser" element={<Hendelser />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/mer" element={<More />} />
          <Route path="/lederpass" element={<LederpassPage />} />
        </Route>

        {/* Public routes */}
        <Route path="/gjenglemt-admin" element={<GjenglemtAdmin />} />
        <Route path="/gjenglemt/:slug" element={<PublicGjenglemt />} />
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
