import { useGetInstagramStatus, useSyncReels, useConnectInstagram, getGetInstagramStatusQueryKey } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState } from "react";
import { formatDateTime } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Instagram, RefreshCw, AlertCircle, ExternalLink, Info, MessageSquare, Key, Zap } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const connectSchema = z.object({
  username: z.string().min(1, "Instagram username is required"),
  accessToken: z.string().optional(),
});

const pageTokenSchema = z.object({
  pageAccessToken: z.string().min(10, "Token is required"),
});


export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pageTokenSaved, setPageTokenSaved] = useState(false);
  const [pageTokenLoading, setPageTokenLoading] = useState(false);

  const { data: status, isLoading: isStatusLoading } = useGetInstagramStatus({
    query: { queryKey: getGetInstagramStatusQueryKey() }
  });

  const connectMutation = useConnectInstagram();
  const syncMutation = useSyncReels();

  const form = useForm<z.infer<typeof connectSchema>>({
    resolver: zodResolver(connectSchema),
    defaultValues: { username: "", accessToken: "" },
  });

  const pageTokenForm = useForm<z.infer<typeof pageTokenSchema>>({
    resolver: zodResolver(pageTokenSchema),
    defaultValues: { pageAccessToken: "" },
  });

  async function onPageTokenSubmit(values: z.infer<typeof pageTokenSchema>) {
    setPageTokenLoading(true);
    try {
      const r = await fetch(`${BASE}/api/dm-importer/page-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageAccessToken: values.pageAccessToken }),
      });
      const data = await r.json() as { success?: boolean; error?: string };
      if (!r.ok || !data.success) {
        throw new Error(data.error ?? "Failed to save token");
      }
      setPageTokenSaved(true);
      pageTokenForm.reset();
      toast({ title: "Facebook Page token saved — DM Importer is ready" });
    } catch (err) {
      toast({ title: "Failed to save token", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setPageTokenLoading(false);
    }
  }

  function onSubmit(values: z.infer<typeof connectSchema>) {
    connectMutation.mutate(
      { data: { username: values.username, accessToken: values.accessToken || undefined } },
      {
        onSuccess: (data) => {
          const tokenMsg = values.accessToken
            ? (data.tokenValid ? " — Graph API token validated ✓" : " — token invalid, using Apify fallback")
            : "";
          toast({ title: `Account saved${tokenMsg}. Click Sync Now to pull your Reels.` });
          queryClient.invalidateQueries({ queryKey: getGetInstagramStatusQueryKey() });
          form.reset();
        },
        onError: (error) => {
          toast({
            title: "Failed to save",
            description: error.error || "Please check the username.",
            variant: "destructive"
          });
        }
      }
    );
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

  const hasToken = !!(status as { hasToken?: boolean })?.hasToken;

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your Instagram connection and sync preferences.</p>
      </div>

      <Card className="bg-card border-card-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Instagram className="w-5 h-5" /> Instagram Account
          </CardTitle>
          <CardDescription>
            Enter your username to sync via Apify. Add a Graph API token for full stats and instant access to your newest Reels.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!isStatusLoading && status?.connected ? (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 flex items-start gap-4">
              <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm text-foreground flex items-center gap-2">
                  @{status.username}
                  {hasToken ? (
                    <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      <Zap className="w-3 h-3" /> Graph API
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                      Apify scraper
                    </span>
                  )}
                </h3>
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
                  Enter your Instagram username below to start syncing.
                </p>
              </div>
            </div>
          ) : null}

          {/* Sync mode info banner */}
          {!isStatusLoading && status?.connected && !hasToken && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-amber-200 leading-relaxed">
                  <strong>Apify mode:</strong> Only your public profile posts visible to Instagram's web view are synced (typically the last ~50 posts). To get your newest Reels and full stats (reach, saves, shares), add a Graph API token below.
                </p>
              </div>
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4 border-t border-border">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Instagram Username</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="roger.rari"
                        {...field}
                        className="bg-background"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="accessToken"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Key className="w-3.5 h-3.5" />
                      Graph API Token
                      <span className="text-xs font-normal text-muted-foreground">(optional but recommended)</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="EAAh85pxg5vE..."
                        type="password"
                        {...field}
                        className="font-mono text-xs bg-background"
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Enables full sync: all Reels, reach, saves, shares, plays. Long-lived tokens last 60 days.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="rounded-lg border border-blue-400/20 bg-blue-400/5 p-3 flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Get a token:{" "}
                  <a href="https://developers.facebook.com/tools/explorer" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                    Graph API Explorer <ExternalLink className="w-3 h-3" />
                  </a>{" "}
                  → select your app → select <strong className="text-foreground">User Token</strong> → add permissions{" "}
                  <code className="text-blue-400 bg-blue-400/10 px-1 rounded">instagram_basic</code>{" "}
                  <code className="text-blue-400 bg-blue-400/10 px-1 rounded">instagram_manage_insights</code> → Generate Token.
                  Then exchange it for a long-lived token using the debug tool.
                </p>
              </div>

              <Button
                type="submit"
                disabled={connectMutation.isPending}
                className="font-mono text-xs uppercase tracking-wider"
              >
                {status?.connected ? "Update Account" : "Connect Account"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="bg-card border-card-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-400" /> DM Importer — Facebook Page Token
          </CardTitle>
          <CardDescription>
            The DM Importer uses a separate Facebook Page access token to read Instagram conversations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pageTokenSaved && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-center gap-3">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
              <p className="text-sm text-foreground">Page token saved — DM Importer is ready to use.</p>
            </div>
          )}
          <Form {...pageTokenForm}>
            <form onSubmit={pageTokenForm.handleSubmit(onPageTokenSubmit)} className="space-y-4">
              <FormField
                control={pageTokenForm.control}
                name="pageAccessToken"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Facebook Page Access Token</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="EAAh85pxg5vE..."
                        type="password"
                        {...field}
                        className="font-mono text-xs bg-background"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="rounded-lg border border-blue-400/20 bg-blue-400/5 p-3 flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Go to <strong className="text-foreground">Graph API Explorer</strong> → select your app → click <strong className="text-foreground">User or Page</strong> dropdown → choose your Facebook Page → add permissions <code className="text-blue-400 bg-blue-400/10 px-1 rounded">instagram_manage_messages</code> + <code className="text-blue-400 bg-blue-400/10 px-1 rounded">pages_manage_metadata</code> → Generate Token.{" "}
                  <a href="https://developers.facebook.com/tools/explorer" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">Open Explorer <ExternalLink className="w-3 h-3" /></a>
                </p>
              </div>
              <Button type="submit" disabled={pageTokenLoading} className="font-mono text-xs uppercase tracking-wider">
                {pageTokenLoading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                Save Page Token
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

    </div>
  );
}
