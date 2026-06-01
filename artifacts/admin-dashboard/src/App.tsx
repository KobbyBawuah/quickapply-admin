import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { isAuthenticated } from "@/lib/auth";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import UsersPage from "@/pages/users";
import InactiveCampaignPage from "@/pages/campaigns-inactive";
import NewsletterCampaignPage from "@/pages/campaigns-newsletter";
import CampaignRunsPage from "@/pages/campaigns-runs";
import TemplatesPage from "@/pages/templates";
import LogsPage from "@/pages/logs";
import SettingsPage from "@/pages/settings";
import AiGeneratorPage from "@/pages/ai-generator";
import ApprovalQueuePage from "@/pages/approval-queue";
import ApprovedTemplatesPage from "@/pages/approved-templates";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: unknown) => {
        if (error && typeof error === "object" && "status" in error) {
          const status = (error as { status: number }).status;
          if (status === 401) {
            localStorage.removeItem("qap_admin_token");
            window.location.href = "/login";
            return false;
          }
          if (status >= 400 && status < 500) return false;
        }
        return failureCount < 2;
      },
    },
  },
});

function AuthGuard({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) return <Redirect to="/login" />;
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/">
        {isAuthenticated() ? <Redirect to="/dashboard" /> : <Redirect to="/login" />}
      </Route>
      <Route path="/dashboard"><AuthGuard><DashboardPage /></AuthGuard></Route>
      <Route path="/users"><AuthGuard><UsersPage /></AuthGuard></Route>
      <Route path="/campaigns/inactive"><AuthGuard><InactiveCampaignPage /></AuthGuard></Route>
      <Route path="/campaigns/newsletter"><AuthGuard><NewsletterCampaignPage /></AuthGuard></Route>
      <Route path="/campaigns/runs"><AuthGuard><CampaignRunsPage /></AuthGuard></Route>
      <Route path="/templates"><AuthGuard><TemplatesPage /></AuthGuard></Route>
      <Route path="/logs"><AuthGuard><LogsPage /></AuthGuard></Route>
      <Route path="/settings"><AuthGuard><SettingsPage /></AuthGuard></Route>
      <Route path="/ai/generator"><AuthGuard><AiGeneratorPage /></AuthGuard></Route>
      <Route path="/ai/queue"><AuthGuard><ApprovalQueuePage /></AuthGuard></Route>
      <Route path="/ai/approved"><AuthGuard><ApprovedTemplatesPage /></AuthGuard></Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster richColors position="top-right" />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
