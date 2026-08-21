import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { OnboardingModal } from "@/components/onboarding-modal";
import { PlayerProvider } from "@/context/player";
import { MiniPlayer } from "@/components/mini-player";

// Pages & Components
import { NavBar } from "@/components/nav-bar";
import AuthPage from "@/pages/auth";
import Dashboard from "@/pages/dashboard";
import ProjectDetail from "@/pages/project";
import AccountPage from "@/pages/account";
import Charter from "@/pages/charter";
import EventsPage from "@/pages/events";
import MinistryPage from "@/pages/ministry";
import ProfilePage from "@/pages/profile";
import FeedPage from "@/pages/feed";
import MessagesPage from "@/pages/messages";
import PlaylistsPage from "@/pages/playlists";
import LibraryPage from "@/pages/library";
import ResetPasswordPage from "@/pages/reset-password";
import VerifyEmailPage from "@/pages/verify-email";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return <Component />;
}

function StripeReturnHandler() {
  const { user, verifyStripeSession } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (sessionId && user) {
      verifyStripeSession(sessionId).catch(() => {});
      params.delete("session_id");
      const newSearch = params.toString();
      const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : "");
      window.history.replaceState({}, "", newUrl);
    }
  }, [user]);

  return null;
}

function GlobalOnboardingGuard() {
  const { user } = useAuth();
  if (!user || user.onboardingComplete) return null;
  const handleAgreementComplete = (updatedUser: any) => {
    queryClient.setQueryData(["/api/auth/me"], updatedUser);
  };
  return (
    <OnboardingModal
      isOpen={true}
      isAlreadySubscribed={user.isSubscribed ?? false}
      onAgreementComplete={handleAgreementComplete}
    />
  );
}

function Router() {
  const { user } = useAuth();

  return (
    <>
      <StripeReturnHandler />
      <GlobalOnboardingGuard />
      <NavBar />
      <Switch>
        <Route path="/">
          {user ? <Dashboard /> : <AuthPage />}
        </Route>
        <Route path="/projects/:id">
          <ProtectedRoute component={ProjectDetail} />
        </Route>
        <Route path="/account">
          <ProtectedRoute component={AccountPage} />
        </Route>
        <Route path="/events">
          <ProtectedRoute component={EventsPage} />
        </Route>
        <Route path="/ministry">
          <ProtectedRoute component={MinistryPage} />
        </Route>
        <Route path="/feed">
          <ProtectedRoute component={FeedPage} />
        </Route>
        <Route path="/messages">
          <ProtectedRoute component={MessagesPage} />
        </Route>
        <Route path="/playlists">
          <ProtectedRoute component={PlaylistsPage} />
        </Route>
        <Route path="/profile/:username">
          <ProtectedRoute component={ProfilePage} />
        </Route>
        {/* Public: reachable from an emailed link without being signed in */}
        <Route path="/reset-password" component={ResetPasswordPage} />
        <Route path="/verify-email" component={VerifyEmailPage} />
        <Route path="/library" component={LibraryPage} />
        <Route path="/charter" component={Charter} />
        <Route component={NotFound} />
      </Switch>
      <MiniPlayer />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <PlayerProvider>
          <div className="min-h-screen bg-background text-foreground flex flex-col relative">
            {/* Global atmospheric background effect */}
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
              <div className="absolute top-[20%] left-[10%] w-[40vw] h-[40vw] rounded-full bg-primary/5 blur-[100px] opacity-50 mix-blend-screen" />
              <div className="absolute bottom-[10%] right-[10%] w-[30vw] h-[30vw] rounded-full bg-accent/5 blur-[100px] opacity-50 mix-blend-screen" />
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay" />
            </div>
            
            <div className="relative z-10 flex-1 flex flex-col">
              <Router />
            </div>
          </div>
          <Toaster />
        </PlayerProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
