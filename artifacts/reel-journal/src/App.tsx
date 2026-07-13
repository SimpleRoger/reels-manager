import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { useAuth } from "@clerk/react";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import Calendar from "@/pages/calendar";
import { useScheduledRefresh } from "@/hooks/use-scheduled-refresh";
import ReelsLog from "@/pages/reels";
import ReelDetail from "@/pages/reel-detail";
import Playbook from "@/pages/playbook";
import ViralFinder from "@/pages/viral-finder";
import RemakeList from "@/pages/remake-list";
import Profile from "@/pages/profile";
import Settings from "@/pages/settings";
import DmImporter from "@/pages/dm-importer";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import LoginPage from "@/pages/login";

const queryClient = new QueryClient();

function ClerkAuthBridge() {
  const { getToken, isSignedIn } = useAuth();
  useEffect(() => {
    setAuthTokenGetter(isSignedIn ? () => getToken() : null);
    return () => setAuthTokenGetter(null);
  }, [getToken, isSignedIn]);
  return null;
}

function ProtectedRouter() {
  const { isSignedIn, isLoaded } = useAuth();
  const [, navigate] = useLocation();
  useScheduledRefresh();

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-5 h-5 border-2 border-border border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  if (!isSignedIn) {
    navigate("/login");
    return null;
  }

  return (
    <Layout>
      <Switch>
        <Route path="/calendar" component={Calendar} />
        <Route path="/reels" component={ReelsLog} />
        <Route path="/reels/:id" component={ReelDetail} />
        <Route path="/playbook" component={Playbook} />
        <Route path="/viral-finder" component={ViralFinder} />
        <Route path="/remake-list" component={RemakeList} />
        <Route path="/profile" component={Profile} />
        <Route path="/settings" component={Settings} />
        <Route path="/dm-importer" component={DmImporter} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <ClerkAuthBridge />
          <Switch>
            <Route path="/" component={LandingPage} />
            <Route path="/login" component={LoginPage} />
            <Route component={ProtectedRouter} />
          </Switch>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
