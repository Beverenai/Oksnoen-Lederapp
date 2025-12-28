import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import Login from "@/pages/Login";
import Home from "@/pages/Home";
import Profile from "@/pages/Profile";
import Leaders from "@/pages/Leaders";
import Team from "@/pages/Team";
import Passport from "@/pages/Passport";
import Wall from "@/pages/Wall";
import Admin from "@/pages/Admin";
import AdminSettings from "@/pages/AdminSettings";
import Nurse from "@/pages/Nurse";
import Fix from "@/pages/Fix";
import ComingSoon from "@/pages/ComingSoon";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { leader, isLoading } = useAuth();

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

  return <AppLayout>{children}</AppLayout>;
}

function AppRoutes() {
  const { leader, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Laster...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route 
        path="/login" 
        element={leader ? <Navigate to="/" replace /> : <Login />} 
      />
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
        path="/cabin"
        element={
          <ProtectedRoute>
            <ComingSoon title="Din Hytte" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/schedule"
        element={
          <ProtectedRoute>
            <ComingSoon title="Vaktplan" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/important-info"
        element={
          <ProtectedRoute>
            <ComingSoon title="Viktig info om deltagere" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/wall"
        element={
          <ProtectedRoute>
            <Wall />
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
        path="/fix"
        element={
          <ProtectedRoute>
            <Fix />
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
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
