import { useGetInstagramStatus, useSyncReels, useConnectInstagram, getGetInstagramStatusQueryKey } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { formatDateTime } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Instagram, RefreshCw, AlertCircle, Key, ExternalLink, Info } from "lucide-react";

const connectSchema = z.object({
  accessToken: z.string().min(1, "Access token is required"),
});

const STEPS = [
  {
    n: 1,
    title: "Open your Meta Developer App",
    body: "Go to developers.facebook.com → My Apps → open your Instagram app.",
    link: "https://developers.facebook.com/apps",
    linkLabel: "Open Meta Developer Portal",
  },
  {
    n: 2,
    title: "Add required permissions",
    body: "In the left sidebar: App Settings \u2192 Permissions & Features. Add all three: instagram_manage_insights (Reels analytics), instagram_business_basic, and instagram_business_manage_messages (DM Importer). In Development mode all are available for your own account without App Review.",
  },
  {
    n: 3,
    title: "Generate a new User Access Token",
    body: "Go to Tools → Graph API Explorer. In the top-right dropdown, select your app. Click Generate Access Token and check: instagram_basic, instagram_manage_insights, instagram_business_basic, and instagram_business_manage_messages.",
    link: "https://developers.facebook.com/tools/explorer",
    linkLabel: "Open Graph API Explorer",
  },
  {
    n: 4,
    title: "Exchange for a long-lived token",
    body: "Run this in your browser console or Postman, replacing the placeholders:",
    code: "GET https://graph.instagram.com/access_token\n  ?grant_type=ig_exchange_token\n  &client_id=YOUR_APP_ID\n  &client_secret=YOUR_APP_SECRET\n  &access_token=YOUR_SHORT_LIVED_TOKEN",
  },
  {
    n: 5,
    title: "Paste the new token below and sync",
    body: "Copy the access_token from the response, paste it below, then hit Sync Now.",
  },
];

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: status, isLoading: isStatusLoading } = useGetInstagramStatus({
    query: { queryKey: getGetInstagramStatusQueryKey() }
  });

  const connectMutation = useConnectInstagram();
  const syncMutation = useSyncReels();

  const form = useForm<z.infer<typeof connectSchema>>({
    resolver: zodResolver(connectSchema),
    defaultValues: { accessToken: "" },
  });

  function onSubmit(values: z.infer<typeof connectSchema>) {
    connectMutation.mutate({ data: { accessToken: values.accessToken } }, {
      onSuccess: () => {
        toast({ title: "Token saved — run Sync Now to pull your Reels data" });
        queryClient.invalidateQueries({ queryKey: getGetInstagramStatusQueryKey() });
        form.reset();
      },
      onError: (error) => {
        toast({
          title: "Connection failed",
          description: error.error || "Please check your access token.",
          variant: "destructive"
        });
      }
    });
  }

  function handleSync() {
    syncMutation.mutate(undefined, {
      onSuccess: (data) => {
        toast({
          title: "Sync Complete",
          description: data.message
        });
        queryClient.invalidateQueries({ queryKey: getGetInstagramStatusQueryKey() });
      },
      onError: (error) => {
        toast({
          title: "Sync failed",
          description: error.error || "Failed to sync reels.",
          variant: "destructive"
        });
      }
    });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your Instagram connection and sync preferences.</p>
      </div>

      <Card className="bg-card border-card-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Instagram className="w-5 h-5" /> Instagram Connection
          </CardTitle>
          <CardDescription>
            Connect your Instagram Creator or Business account via the Meta Graph API.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!isStatusLoading && status?.connected ? (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 flex items-start gap-4">
              <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm text-foreground">Connected as @{status.username}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Last synced: {formatDateTime(status.lastSynced) || "Never"}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSync}
                disabled={syncMutation.isPending}
                className="font-mono uppercase text-xs tracking-wider shrink-0"
              >
                {syncMutation.isPending
                  ? <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  : <RefreshCw className="w-4 h-4 mr-2" />}
                Sync Now
              </Button>
            </div>
          ) : !isStatusLoading ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 flex items-start gap-4">
              <AlertCircle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
              <div>
                <h3 className="font-medium text-sm text-destructive">Not Connected</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Follow the steps below to get your access token and connect.
                </p>
              </div>
            </div>
          ) : null}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4 border-t border-border">
              <FormField
                control={form.control}
                name="accessToken"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Access Token</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="EAAGm0PX4ZC..."
                        type="password"
                        {...field}
                        className="font-mono text-xs bg-background"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                disabled={connectMutation.isPending}
                className="font-mono text-xs uppercase tracking-wider"
              >
                {status?.connected ? "Update Token" : "Connect Account"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="bg-card border-card-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5 text-amber-400" />
            How to get a token with full insights access
          </CardTitle>
          <CardDescription>
            Reach, plays, saves, and shares require the <code className="text-amber-400 bg-amber-400/10 px-1 rounded text-xs">instagram_manage_insights</code> permission.
            Without it, the Insights API returns no data. Follow these steps to generate a correct token.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-4 flex items-start gap-3 mb-6">
            <Info className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              In <strong className="text-foreground">Development mode</strong> you can add this permission and test it with your own account immediately — no App Review required. If your Meta App is in Live mode, the permission is also available to any approved user.
            </p>
          </div>

          <ol className="space-y-6">
            {STEPS.map((step) => (
              <li key={step.n} className="flex gap-4">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary text-xs font-bold">
                  {step.n}
                </div>
                <div className="flex-1 min-w-0 pt-0.5 space-y-2">
                  <h4 className="text-sm font-semibold text-foreground">{step.title}</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">{step.body}</p>
                  {step.code && (
                    <pre className="text-xs bg-zinc-900 border border-border rounded-md p-3 overflow-x-auto text-green-400 font-mono leading-relaxed whitespace-pre-wrap break-all">
                      {step.code}
                    </pre>
                  )}
                  {step.link && (
                    <a
                      href={step.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {step.linkLabel}
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
