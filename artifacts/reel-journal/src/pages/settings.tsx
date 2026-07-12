import { useGetInstagramStatus, useSyncReels, useConnectInstagram, getGetInstagramStatusQueryKey } from "@workspace/api-client-react";
import type { InstagramAccount } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState, useEffect, useCallback } from "react";
import { formatDateTime } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Instagram, RefreshCw, AlertCircle, ExternalLink, Info, MessageSquare, Key, Zap, Trash2, Plus } from "lucide-react";

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
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data: status } = useGetInstagramStatus({
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

  const fetchAccounts = useCallback(async () => {
    try {
      setAccountsLoading(true);
      const r = await fetch(`${BASE}/api/instagram/accounts`);
      const data = await r.json() as InstagramAccount[];
      setAccounts(Array.isArray(data) ? data : []);
    } catch {
      setAccounts([]);
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "true") {
      toast({ title: "Instagram connected via OAuth ✓" });
      queryClient.invalidateQueries({ queryKey: getGetInstagramStatusQueryKey() });
      fetchAccounts();
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("error")) {
      toast({ title: "Instagram connection failed", description: params.get("error") ?? undefined, variant: "destructive" });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  async function handleAccountSync(id: number) {
    setSyncingId(id);
    try {
      const r = await fetch(`${BASE}/api/instagram/account/${id}/sync`, { method: "POST" });
      const data = await r.json() as { message?: string; error?: string };
      if (!r.ok) throw new Error(data.error ?? "Sync failed");
      toast({ title: "Sync complete", description: data.message });
      fetchAccounts();
    } catch (err) {
      toast({ title: "Sync failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setSyncingId(null);
    }
  }

  async function handleAccountDelete(id: number, username: string) {
    if (!confirm(`Remove @${username}? Their reels will stay in the database.`)) return;
    setDeletingId(id);
    try {
      await fetch(`${BASE}/api/instagram/account/${id}`, { method: "DELETE" });
      toast({ title: `@${username} disconnected` });
      fetchAccounts();
      queryClient.invalidateQueries({ queryKey: getGetInstagramStatusQueryKey() });
    } catch {
      toast({ title: "Failed to remove account", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  }

  async function onPageTokenSubmit(values: z.infer<typeof pageTokenSchema>) {
    setPageTokenLoading(true);
    try {
      const r = await fetch(`${BASE}/api/dm-importer/page-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageAccessToken: values.pageAccessToken }),
      });
      const data = await r.json() as { success?: boolean; error?: string };
      if (!r.ok || !data.success) throw new Error(data.error ?? "Failed to save token");
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
          fetchAccounts();
          form.reset();
        },
        onError: (error) => {
          toast({ title: "Failed to save", description: error.error || "Please check the username.", variant: "destructive" });
        }
      }
    );
  }

  const apiUrl = import.meta.env.VITE_API_URL ?? "";

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your Instagram connections and sync preferences.</p>
      </div>

      {/* Connected Accounts */}
      <Card className="bg-card border-card-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Instagram className="w-5 h-5" /> Connected Accounts
          </CardTitle>
          <CardDescription>
            Manage all connected Instagram accounts. Each account syncs independently.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {accountsLoading ? (
            <div className="space-y-2">
              {[1, 2].map(i => (
                <div key={i} className="h-16 rounded-lg bg-muted/50 animate-pulse" />
              ))}
            </div>
          ) : accounts.length === 0 ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 flex items-start gap-4">
              <AlertCircle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
              <div>
                <h3 className="font-medium text-sm text-destructive">No accounts connected</h3>
                <p className="text-xs text-muted-foreground mt-1">Add an account below to start syncing.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {accounts.map((account) => (
                <div key={account.id} className="rounded-lg border border-primary/20 bg-primary/5 p-4 flex items-center gap-4">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm text-foreground flex items-center gap-2">
                      @{account.username}
                      {account.hasToken ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          <Zap className="w-3 h-3" /> Graph API
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                          Apify
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Last synced: {formatDateTime(account.lastSynced) || "Never"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAccountSync(account.id)}
                      disabled={syncingId === account.id}
                      className="font-mono uppercase text-xs tracking-wider"
                    >
                      {syncingId === account.id
                        ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
                        : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
                      Sync
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAccountDelete(account.id, account.username)}
                      disabled={deletingId === account.id}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* OAuth connect button */}
          <div className="pt-4 border-t border-border space-y-3">
            <p className="text-sm font-medium flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Account via Instagram Login
            </p>
            <a href={`${apiUrl}/auth/instagram`}>
              <Button type="button" className="font-mono text-xs uppercase tracking-wider w-full flex items-center gap-2">
                <Instagram className="w-4 h-4" /> Connect with Instagram
              </Button>
            </a>
            <p className="text-xs text-muted-foreground">Securely connects via OAuth. Works for any Instagram account.</p>
          </div>

          {/* Manual connect form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4 border-t border-border">
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Plus className="w-4 h-4" /> Or add manually
              </p>
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Instagram Username</FormLabel>
                    <FormControl>
                      <Input placeholder="roger.rari" {...field} className="bg-background" />
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
                        placeholder="EAAh85pxg5vE... or IGAA..."
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
                </p>
              </div>
              <Button
                type="submit"
                disabled={connectMutation.isPending}
                className="font-mono text-xs uppercase tracking-wider"
              >
                {connectMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-2" /> : null}
                Add Account
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* DM Importer */}
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
