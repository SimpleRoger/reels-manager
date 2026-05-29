import { useState, useEffect } from "react";
import {
  useListReferences,
  getListReferencesQueryKey,
  useCreateReference,
  useUpdateReference,
  useDeleteReference,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, ExternalLink, Bookmark, Plus, Link2, Loader2, X, Play, Eye, Heart, MessageCircle, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { InlinePlayer } from "@/components/inline-player";
import { VideoThumb } from "@/components/video-thumb";

type Ref = {
  id: number;
  url: string;
  accountName?: string | null;
  thumbnailUrl?: string | null;
  mediaUrl?: string | null;
  caption?: string | null;
  viewCount?: number | null;
  likeCount?: number | null;
  commentsCount?: number | null;
  whyItsgood?: string | null;
  whatToChange?: string | null;
  howToRemake?: string | null;
};

// ─── Notes Modal ──────────────────────────────────────────────────────────────

function NotesModal({
  reference: r,
  onClose,
  onSave,
  onDelete,
}: {
  reference: Ref;
  onClose: () => void;
  onSave: (id: number, data: { whyItsgood: string; whatToChange: string; howToRemake: string }) => void;
  onDelete: (id: number) => void;
}) {
  const [form, setForm] = useState({
    whyItsgood: r.whyItsgood ?? "",
    whatToChange: r.whatToChange ?? "",
    howToRemake: r.howToRemake ?? "",
  });
  const [playing, setPlaying] = useState(true);

  function set(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col sm:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Video side ── */}
        <div className="relative bg-black sm:w-[280px] shrink-0 aspect-[9/16] sm:aspect-auto sm:h-auto">
          <div className="absolute inset-0">
            {playing ? (
              <InlinePlayer
                mediaUrl={r.mediaUrl}
                thumbnailUrl={r.thumbnailUrl}
                instagramUrl={r.url}
                onClose={() => setPlaying(false)}
                className="absolute inset-0"
              />
            ) : (
              <>
                <VideoThumb
                  thumbnailUrl={r.thumbnailUrl ?? null}
                  videoUrl={r.mediaUrl ?? null}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <button
                    onClick={() => setPlaying(true)}
                    className="w-14 h-14 rounded-full bg-primary/90 hover:bg-primary flex items-center justify-center shadow-xl transition-transform hover:scale-110"
                  >
                    <Play className="w-6 h-6 text-black fill-black ml-1" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Notes side ── */}
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-card border-b border-border px-5 py-3.5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              {r.accountName && (
                <span className="text-sm font-semibold truncate">@{r.accountName}</span>
              )}
              <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                {r.viewCount != null && (
                  <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" />{r.viewCount.toLocaleString()}</span>
                )}
                {r.likeCount != null && (
                  <span className="flex items-center gap-0.5"><Heart className="w-3 h-3" />{r.likeCount.toLocaleString()}</span>
                )}
                {r.commentsCount != null && (
                  <span className="flex items-center gap-0.5"><MessageCircle className="w-3 h-3" />{r.commentsCount.toLocaleString()}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                title="Open in Instagram"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={() => { if (confirm("Remove from remake list?")) onDelete(r.id); }}
                className="p-1.5 rounded-md hover:bg-destructive/20 transition-colors text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4 flex-1">
            {r.caption && (
              <p className="text-xs text-muted-foreground bg-background border rounded-lg p-3 line-clamp-3">
                {r.caption}
              </p>
            )}

            {(
              [
                { key: "whyItsgood", label: "Why It's Good" },
                { key: "whatToChange", label: "What to Change" },
                { key: "howToRemake", label: "How to Remake" },
              ] as const
            ).map(({ key, label }) => (
              <div key={key} className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  {label}
                </label>
                <Textarea
                  value={form[key]}
                  onChange={(e) => set(key, e.target.value)}
                  className="h-16 text-xs resize-none bg-background"
                  placeholder={`Add notes about ${label.toLowerCase()}...`}
                />
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-card border-t border-border px-5 py-3 shrink-0">
            <Button
              size="sm"
              onClick={() => { onSave(r.id, form); onClose(); }}
              className="w-full font-mono uppercase text-[10px] tracking-wider"
            >
              Save Notes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RemakeList() {
  const { data, isLoading } = useListReferences({
    query: { queryKey: getListReferencesQueryKey() },
  });

  const createMutation = useCreateReference();
  const updateMutation = useUpdateReference();
  const deleteMutation = useDeleteReference();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [playingId, setPlayingId] = useState<number | null>(null);
  const [notesId, setNotesId] = useState<number | null>(null);
  const [addMode, setAddMode] = useState<"single" | "batch" | null>(null);
  const [singleUrl, setSingleUrl] = useState("");
  const [batchUrls, setBatchUrls] = useState("");
  const [addingBatch, setAddingBatch] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: getListReferencesQueryKey() });
  }

  useEffect(() => {
    const hasPending = data?.references.some(
      (r) => r.viewCount == null && r.likeCount == null && r.commentsCount == null
    );
    if (!hasPending) return;
    const timer = setInterval(invalidate, 8_000);
    return () => clearInterval(timer);
  }, [data?.references]);

  function handleSave(id: number, values: { whyItsgood: string; whatToChange: string; howToRemake: string }) {
    updateMutation.mutate(
      { id, data: values },
      {
        onSuccess: () => {
          toast({ title: "Notes saved" });
          invalidate();
        },
      }
    );
  }

  function handleDelete(id: number) {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Removed" });
          setNotesId(null);
          invalidate();
        },
      }
    );
  }

  function handleAddSingle() {
    const url = singleUrl.trim();
    if (!url) return;
    createMutation.mutate(
      { data: { url } },
      {
        onSuccess: () => {
          setSingleUrl("");
          setAddMode(null);
          toast({ title: "Reel added to your list" });
          invalidate();
        },
        onError: () => toast({ title: "Failed to add reel", variant: "destructive" }),
      }
    );
  }

  async function handleAddBatch() {
    const urls = batchUrls.split("\n").map((u) => u.trim()).filter(Boolean);
    if (!urls.length) return;
    setAddingBatch(true);
    let added = 0, failed = 0;
    for (const url of urls) {
      try { await createMutation.mutateAsync({ data: { url } }); added++; }
      catch { failed++; }
    }
    setAddingBatch(false);
    setBatchUrls("");
    setAddMode(null);
    invalidate();
    toast({ title: `${added} reel${added !== 1 ? "s" : ""} added${failed > 0 ? `, ${failed} failed` : ""}` });
  }

  async function handleRefreshThumbnails() {
    setRefreshing(true);
    try {
      await fetch("/api/references/refresh-all", { method: "POST" });
      toast({ title: "Refreshing thumbnails in background — check back in ~2 min" });
      const start = Date.now();
      const poll = setInterval(() => {
        invalidate();
        if (Date.now() - start > 180_000) clearInterval(poll);
      }, 10_000);
    } catch {
      toast({ title: "Failed to start refresh", variant: "destructive" });
    } finally {
      setRefreshing(false);
    }
  }

  const selectedRef = notesId != null
    ? data?.references.find((r) => r.id === notesId) as Ref | undefined
    : undefined;

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Remake List</h1>
          <p className="text-muted-foreground text-sm">Save reels you want to study or remake.</p>
        </div>
        <div className="flex gap-2 flex-wrap sm:shrink-0 sm:justify-end">
          <Button
            size="sm"
            variant="ghost"
            className="font-mono text-xs uppercase tracking-wider text-muted-foreground"
            onClick={handleRefreshThumbnails}
            disabled={refreshing}
          >
            {refreshing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
            Refresh Thumbs
          </Button>
          <Button
            size="sm"
            variant={addMode === "single" ? "secondary" : "outline"}
            className="font-mono text-xs uppercase tracking-wider"
            onClick={() => setAddMode(addMode === "single" ? null : "single")}
          >
            <Plus className="w-3 h-3 mr-1" /> Add Reel
          </Button>
          <Button
            size="sm"
            variant={addMode === "batch" ? "secondary" : "outline"}
            className="font-mono text-xs uppercase tracking-wider"
            onClick={() => setAddMode(addMode === "batch" ? null : "batch")}
          >
            <Link2 className="w-3 h-3 mr-1" /> Batch Import
          </Button>
        </div>
      </div>

      {/* Add forms */}
      {addMode === "single" && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Paste a reel URL</p>
          <div className="flex gap-2">
            <Input
              placeholder="https://www.instagram.com/reel/..."
              value={singleUrl}
              onChange={(e) => setSingleUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddSingle()}
              className="font-mono text-xs bg-background"
              autoFocus
            />
            <Button onClick={handleAddSingle} disabled={!singleUrl.trim() || createMutation.isPending} size="sm">
              {createMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Add"}
            </Button>
            <Button onClick={() => { setAddMode(null); setSingleUrl(""); }} variant="ghost" size="sm">
              <X className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}

      {addMode === "batch" && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Paste reel URLs — one per line</p>
          <Textarea
            placeholder={"https://www.instagram.com/reel/abc...\nhttps://www.instagram.com/reel/def..."}
            value={batchUrls}
            onChange={(e) => setBatchUrls(e.target.value)}
            className="font-mono text-xs bg-background min-h-[100px] resize-none"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <Button onClick={() => { setAddMode(null); setBatchUrls(""); }} variant="ghost" size="sm">Cancel</Button>
            <Button onClick={handleAddBatch} disabled={!batchUrls.trim() || addingBatch} size="sm">
              {addingBatch ? <><Loader2 className="w-3 h-3 animate-spin mr-1" />Adding...</> : <><Plus className="w-3 h-3 mr-1" />Add {batchUrls.trim().split("\n").filter(u => u.trim()).length} Reels</>}
            </Button>
          </div>
        </div>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {[...Array(10)].map((_, i) => <Skeleton key={i} className="aspect-[9/16] w-full rounded-xl" />)}
        </div>
      ) : data?.references.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border rounded-xl bg-card border-dashed">
          <Bookmark className="w-12 h-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground font-medium">Your remake list is empty</p>
          <p className="text-muted-foreground/60 text-sm mt-1">Paste a reel link above to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {data?.references.map((ref) => {
            const isPlaying = playingId === ref.id;
            const hasNotes = !!(ref as any).whyItsgood || !!(ref as any).whatToChange || !!(ref as any).howToRemake;

            return (
              <div
                key={ref.id}
                className="relative aspect-[9/16] bg-muted rounded-xl overflow-hidden group cursor-pointer"
                onClick={() => !isPlaying && setNotesId(ref.id)}
              >
                {isPlaying ? (
                  <InlinePlayer
                    mediaUrl={ref.mediaUrl}
                    thumbnailUrl={ref.thumbnailUrl}
                    instagramUrl={ref.url}
                    onClose={(e?: React.MouseEvent) => { e?.stopPropagation(); setPlayingId(null); }}
                    className="absolute inset-0"
                  />
                ) : (
                  <>
                    <VideoThumb
                      thumbnailUrl={ref.thumbnailUrl ?? null}
                      videoUrl={ref.mediaUrl ?? null}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />

                    {/* Gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

                    {/* Pending stats spinner */}
                    {ref.viewCount == null && ref.likeCount == null && (
                      <div className="absolute top-2 left-2">
                        <Loader2 className="w-3 h-3 animate-spin text-white/60" />
                      </div>
                    )}

                    {/* Notes indicator */}
                    {hasNotes && (
                      <div className="absolute top-2 left-2 bg-primary/80 rounded-full p-1">
                        <FileText className="w-2.5 h-2.5 text-black" />
                      </div>
                    )}

                    {/* Play button on hover */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <button
                        onClick={(e) => { e.stopPropagation(); setPlayingId(ref.id); }}
                        className="w-12 h-12 rounded-full bg-primary/90 hover:bg-primary flex items-center justify-center shadow-xl transition-transform hover:scale-110"
                      >
                        <Play className="w-5 h-5 text-black fill-black ml-0.5" />
                      </button>
                    </div>

                    {/* Bottom stats */}
                    <div className="absolute bottom-0 left-0 right-0 p-2 space-y-1">
                      {ref.accountName && (
                        <p className="text-[10px] font-semibold text-white/90 truncate">@{ref.accountName}</p>
                      )}
                      <div className="flex items-center gap-2 text-[9px] font-mono text-white/70">
                        {ref.viewCount != null && (
                          <span className="flex items-center gap-0.5"><Eye className="w-2.5 h-2.5" />{ref.viewCount.toLocaleString()}</span>
                        )}
                        {ref.likeCount != null && (
                          <span className="flex items-center gap-0.5"><Heart className="w-2.5 h-2.5" />{ref.likeCount.toLocaleString()}</span>
                        )}
                        {ref.commentsCount != null && (
                          <span className="flex items-center gap-0.5"><MessageCircle className="w-2.5 h-2.5" />{ref.commentsCount.toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Notes modal */}
      {selectedRef && (
        <NotesModal
          reference={selectedRef}
          onClose={() => setNotesId(null)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
