import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import ReelsLog from "@/pages/reels";
import ReelDetail from "@/pages/reel-detail";
import Playbook from "@/pages/playbook";
import ViralFinder from "@/pages/viral-finder";
import RemakeList from "@/pages/remake-list";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/reels" component={ReelsLog} />
        <Route path="/reels/:id" component={ReelDetail} />
        <Route path="/playbook" component={Playbook} />
        <Route path="/viral-finder" component={ViralFinder} />
        <Route path="/remake-list" component={RemakeList} />
        <Route path="/settings" component={Settings} />
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
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
