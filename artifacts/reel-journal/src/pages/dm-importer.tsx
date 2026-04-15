import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiClient } from "@workspace/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Download, CheckCircle2, AlertCircle, ChevronRight, ExternalLink, RefreshCw, Loader2 } from "lucide-react";

interface Conversation {
  id: string;
  name: string;
  updatedTime: string;
  participantCount: number;
}

interface ReelUrl {
  url: string;
  messageId: string;
  createdTime: string;
  from?: string;
}

interface ConversationsResponse {
  conversations: Conversation[];
}

interface MessagesResponse {
  totalMessages: number;
  reelUrls: ReelUrl[];
}

interface ImportResponse {
  imported: number;
  skipped: number;
  total: number;
}

function formatRelativeTime(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString();
}

export default function DmImporter() {
  const { toast } = useToast();
  const [selectedConvo, setSelectedConvo] = useState<Conversation | null>(null);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [importDone, setImportDone] = useState(false);

  const conversationsQuery = useQuery<ConversationsResponse>({
    queryKey: ["dm-importer-conversations"],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/dm-importer/conversations`);
      const data = await res.json();
      if (!res.ok) throw data;
      return data;
    },
    retry: false,
  });

  const messagesQuery = useQuery<MessagesResponse>({
    queryKey: ["dm-importer-messages", selectedConvo?.id],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/dm-importer/conversations/${selectedConvo!.id}/messages`);
      const data = await res.json();
      if (!res.ok) throw data;
      return data;
    },
    enabled: !!selectedConvo,
    retry: false,
  });

  const importMutation = useMutation<ImportResponse>({
    mutationFn: async () => {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/dm-importer/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: Array.from(selectedUrls) }),
      });
      const data = await res.json();
      if (!res.ok) throw data;
      return data;
    },
    onSuccess: (data) => {
      setImportDone(true);
      toast({
        title: `${data.imported} reels imported to Remake List`,
        description: data.skipped > 0 ? `${data.skipped} skipped (already in list)` : undefined,
      });
    },
    onError: (err: unknown) => {
      const msg = (err as { error?: string })?.error ?? "Import failed";
      toast({ title: "Import failed", description: msg, variant: "destructive" });
    },
  });

  const error = conversationsQuery.error as { error?: string; details?: string } | null;
  const msgError = messagesQuery.error as { error?: string } | null;
  const reelUrls = messagesQuery.data?.reelUrls ?? [];

  function toggleUrl(url: string) {
    setSelectedUrls((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
    setImportDone(false);
  }

  function toggleAll() {
    if (selectedUrls.size === reelUrls.length) {
      setSelectedUrls(new Set());
    } else {
      setSelectedUrls(new Set(reelUrls.map((r) => r.url)));
    }
    setImportDone(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">DM Reel Importer</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Scan your Instagram DMs for saved reels and add them to your Remake List in one click.
        </p>
      </div>

      {/* Permission error */}
      {error?.error === "Missing permission" && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="pt-6 space-y-3">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-300">Token needs an extra permission</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {error.details ?? "Your access token needs instagram_manage_messages. Follow the steps in Settings to generate a new token."}
                </p>
              </div>
            </div>
            <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1.5 ml-8">
              <li>Go to <a href="https://developers.facebook.com/tools/explorer" target="_blank" rel="noreferrer" className="text-orange-400 underline">Graph API Explorer</a></li>
              <li>Select your app and click <strong>Generate Access Token</strong></li>
              <li>Check both <code className="bg-muted px-1 rounded">instagram_manage_insights</code> <em>and</em> <code className="bg-muted px-1 rounded">instagram_manage_messages</code></li>
              <li>Exchange for a long-lived token (see Settings for the exact command)</li>
              <li>Paste the new token in <a href="/settings" className="text-orange-400 underline">Settings → Update Token</a></li>
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Generic error */}
      {error && error.error !== "Missing permission" && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="pt-6 flex gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">{error.error ?? "Failed to load conversations"}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversations panel */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold font-mono uppercase tracking-widest text-muted-foreground">Conversations</h2>
            {!conversationsQuery.isLoading && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => conversationsQuery.refetch()}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          {conversationsQuery.isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading conversations…
            </div>
          )}

          {conversationsQuery.data?.conversations.map((convo) => (
            <button
              key={convo.id}
              onClick={() => {
                setSelectedConvo(convo);
                setSelectedUrls(new Set());
                setImportDone(false);
              }}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                selectedConvo?.id === convo.id
                  ? "border-orange-500/60 bg-orange-500/10"
                  : "border-border hover:border-border/80 hover:bg-muted/50"
              }`}
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium truncate">{convo.name}</span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0" />
              </div>
              <p className="text-xs text-muted-foreground mt-1 ml-6">
                {formatRelativeTime(convo.updatedTime)}
              </p>
            </button>
          ))}

          {conversationsQuery.data?.conversations.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No conversations found</p>
          )}
        </div>

        {/* Messages / URLs panel */}
        <div className="lg:col-span-2 space-y-3">
          {!selectedConvo && !conversationsQuery.isLoading && !error && (
            <Card className="border-dashed">
              <CardContent className="pt-12 pb-12 text-center">
                <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Select a conversation to scan for reels</p>
              </CardContent>
            </Card>
          )}

          {selectedConvo && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold font-mono uppercase tracking-widest text-muted-foreground">
                    Reels in "{selectedConvo.name}"
                  </h2>
                  {messagesQuery.data && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Scanned {messagesQuery.data.totalMessages} messages · found {reelUrls.length} reel{reelUrls.length !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>
                {reelUrls.length > 0 && (
                  <Button variant="outline" size="sm" onClick={toggleAll}>
                    {selectedUrls.size === reelUrls.length ? "Deselect all" : "Select all"}
                  </Button>
                )}
              </div>

              {messagesQuery.isLoading && (
                <div className="flex items-center gap-2 text-muted-foreground text-sm py-12 justify-center">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Scanning messages…
                </div>
              )}

              {msgError && (
                <Card className="border-destructive/40">
                  <CardContent className="pt-6 flex gap-3">
                    <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <p className="text-sm text-muted-foreground">{msgError.error ?? "Failed to scan messages"}</p>
                  </CardContent>
                </Card>
              )}

              {messagesQuery.data && reelUrls.length === 0 && (
                <Card className="border-dashed">
                  <CardContent className="pt-12 pb-12 text-center">
                    <p className="text-sm text-muted-foreground">No Instagram reel links found in this conversation</p>
                  </CardContent>
                </Card>
              )}

              {reelUrls.map((item) => {
                const isSelected = selectedUrls.has(item.url);
                return (
                  <button
                    key={item.url}
                    onClick={() => toggleUrl(item.url)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      isSelected
                        ? "border-orange-500/60 bg-orange-500/10"
                        : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                        isSelected ? "border-orange-500 bg-orange-500" : "border-muted-foreground"
                      }`}>
                        {isSelected && <CheckCircle2 className="h-3 w-3 text-white" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-mono text-orange-400 truncate">{item.url}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          {item.from && (
                            <span className="text-xs text-muted-foreground">from {item.from}</span>
                          )}
                          <span className="text-xs text-muted-foreground">{formatRelativeTime(item.createdTime)}</span>
                        </div>
                      </div>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-muted-foreground hover:text-foreground mt-0.5"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </button>
                );
              })}

              {reelUrls.length > 0 && (
                <div className="pt-2 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {selectedUrls.size} of {reelUrls.length} selected
                  </p>
                  <Button
                    onClick={() => importMutation.mutate()}
                    disabled={selectedUrls.size === 0 || importMutation.isPending || importDone}
                    className="bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    {importMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importing…</>
                    ) : importDone ? (
                      <><CheckCircle2 className="h-4 w-4 mr-2" /> Imported</>
                    ) : (
                      <><Download className="h-4 w-4 mr-2" /> Add to Remake List</>
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
