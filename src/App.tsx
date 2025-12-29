import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import AppLayout from "@/components/layout/AppLayout";
import Login from "@/pages/Login";
import Install from "@/pages/Install";
import Onboarding from "@/pages/Onboarding";
import Home from "@/pages/Home";
import Profile from "@/pages/Profile";
import Leaders from "@/pages/Leaders";
import Team from "@/pages/Team";
import Passport from "@/pages/Passport";
import MyCabins from "@/pages/MyCabins";
import Schedule from "@/pages/Schedule";

import Admin from "@/pages/Admin";
import AdminSettings from "@/pages/AdminSettings";
import Nurse from "@/pages/Nurse";
import Fix from "@/pages/Fix";
import RopeControl from "@/pages/RopeControl";
import ComingSoon from "@/pages/ComingSoon";
import ImportantInfo from "@/pages/ImportantInfo";
import ParticipantStats from "@/pages/ParticipantStats";
import Checkout from "@/pages/Checkout";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { leader, isLoading, isProfileComplete } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Laster...</div>
      </div>
    );
  }

  if (!leader) {
    return <Navigate to="/login" replace />;
  }

  // Redirect to onboarding if profile is not complete
  if (!isProfileComplete) {
    return <Navigate to="/onboarding" replace />;
  }

  return <AppLayout>{children}</AppLayout>;
}

function OnboardingRoute({ children }: { children: React.ReactNode }) {
  const { leader, isLoading, isProfileComplete } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Laster...</div>
      </div>
    );
  }

  if (!leader) {
    return <Navigate to="/login" replace />;
  }

  // If profile is already complete, redirect to home
  if (isProfileComplete) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { leader, isLoading, isProfileComplete } = useAuth();
  const { isInstalled, hasDeclined } = usePWAInstall();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Laster...</div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Install route - shown first for non-installed users who haven't logged in */}
      <Route 
        path="/install" 
        element={
          leader ? (
            isProfileComplete ? <Navigate to="/" replace /> : <Navigate to="/onboarding" replace />
          ) : (
            <Install />
          )
        } 
      />
      
      {/* Login route */}
      <Route 
        path="/login" 
        element={
          leader ? (
            isProfileComplete ? <Navigate to="/" replace /> : <Navigate to="/onboarding" replace />
          ) : (
            // Show install page first if not installed and not declined
            !isInstalled && !hasDeclined ? <Navigate to="/install" replace /> : <Login />
          )
        } 
      />

      {/* Onboarding route - requires login but not complete profile */}
      <Route
        path="/onboarding"
        element={
          <OnboardingRoute>
            <Onboarding />
          </OnboardingRoute>
        }
      />

      {/* Protected routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/leaders"
        element={
          <ProtectedRoute>
            <Leaders />
          </ProtectedRoute>
        }
      />
      <Route
        path="/passport"
        element={
          <ProtectedRoute>
            <Passport />
          </ProtectedRoute>
        }
      />
      <Route
        path="/team/:team"
        element={
          <ProtectedRoute>
            <Team />
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-cabins"
        element={
          <ProtectedRoute>
            <MyCabins />
          </ProtectedRoute>
        }
      />
      <Route
        path="/schedule"
        element={
          <ProtectedRoute>
            <Schedule />
          </ProtectedRoute>
        }
      />
      <Route
        path="/important-info"
        element={
          <ProtectedRoute>
            <ImportantInfo />
          </ProtectedRoute>
        }
      />
      <Route
        path="/nurse"
        element={
          <ProtectedRoute>
            <Nurse />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <Admin />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/settings"
        element={
          <ProtectedRoute>
            <AdminSettings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/participant-stats"
        element={
          <ProtectedRoute>
            <ParticipantStats />
          </ProtectedRoute>
        }
      />
      <Route
        path="/checkout"
        element={
          <ProtectedRoute>
            <Checkout />
          </ProtectedRoute>
        }
      />
      <Route
        path="/fix"
        element={
          <ProtectedRoute>
            <Fix />
          </ProtectedRoute>
        }
      />
      <Route
        path="/rope-control"
        element={
          <ProtectedRoute>
            <RopeControl />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <OfflineIndicator />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
