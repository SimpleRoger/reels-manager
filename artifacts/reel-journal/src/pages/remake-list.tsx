import { useState } from "react";
import {
  useListReferences,
  getListReferencesQueryKey,
  useCreateReference,
  useUpdateReference,
  useDeleteReference,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, ExternalLink, Bookmark, Check, Plus, Link2, Loader2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function RemakeList() {
  const { data, isLoading } = useListReferences({
    query: { queryKey: getListReferencesQueryKey() },
  });

  const createMutation = useCreateReference();
  const updateMutation = useUpdateReference();
  const deleteMutation = useDeleteReference();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [addMode, setAddMode] = useState<"single" | "batch" | null>(null);
  const [singleUrl, setSingleUrl] = useState("");
  const [batchUrls, setBatchUrls] = useState("");
  const [addingBatch, setAddingBatch] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<{
    whyItsgood: string;
    whatToChange: string;
    howToRemake: string;
  }>({ whyItsgood: "", whatToChange: "", howToRemake: "" });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: getListReferencesQueryKey() });
  }

  function startEditing(ref: any) {
    setEditingId(ref.id);
    setEditValues({
      whyItsgood: ref.whyItsgood || "",
      whatToChange: ref.whatToChange || "",
      howToRemake: ref.howToRemake || "",
    });
  }

  function handleSave(id: number) {
    updateMutation.mutate(
      { id, data: editValues },
      {
        onSuccess: () => {
          setEditingId(null);
          toast({ title: "Notes saved" });
          invalidate();
        },
      }
    );
  }

  function handleDelete(id: number) {
    if (!confirm("Remove this reel from your list?")) return;
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Removed" });
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
        onError: () => {
          toast({ title: "Failed to add reel", variant: "destructive" });
        },
      }
    );
  }

  async function handleAddBatch() {
    const urls = batchUrls
      .split("\n")
      .map((u) => u.trim())
      .filter((u) => u.length > 0);

    if (urls.length === 0) return;
    setAddingBatch(true);

    let added = 0;
    let failed = 0;
    for (const url of urls) {
      try {
        await createMutation.mutateAsync({ data: { url } });
        added++;
      } catch {
        failed++;
      }
    }

    setAddingBatch(false);
    setBatchUrls("");
    setAddMode(null);
    invalidate();
    toast({
      title: `${added} reel${added !== 1 ? "s" : ""} added${failed > 0 ? `, ${failed} failed` : ""}`,
    });
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Remake List</h1>
          <p className="text-muted-foreground text-sm">
            Save reels you want to study, remake, or reference.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
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

      {addMode === "single" && (
        <Card className="bg-card border-card-border">
          <CardContent className="p-4 space-y-3">
            <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Paste a reel URL
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="https://www.instagram.com/reel/..."
                value={singleUrl}
                onChange={(e) => setSingleUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddSingle()}
                className="font-mono text-xs bg-background"
                autoFocus
              />
              <Button
                onClick={handleAddSingle}
                disabled={!singleUrl.trim() || createMutation.isPending}
                size="sm"
                className="font-mono text-xs uppercase tracking-wider shrink-0"
              >
                {createMutation.isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  "Add"
                )}
              </Button>
              <Button
                onClick={() => { setAddMode(null); setSingleUrl(""); }}
                variant="ghost"
                size="sm"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {addMode === "batch" && (
        <Card className="bg-card border-card-border">
          <CardContent className="p-4 space-y-3">
            <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Paste reel URLs — one per line
            </p>
            <Textarea
              placeholder={"https://www.instagram.com/reel/abc123...\nhttps://www.instagram.com/reel/def456...\nhttps://www.instagram.com/reel/ghi789..."}
              value={batchUrls}
              onChange={(e) => setBatchUrls(e.target.value)}
              className="font-mono text-xs bg-background min-h-[120px] resize-none"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button
                onClick={() => { setAddMode(null); setBatchUrls(""); }}
                variant="ghost"
                size="sm"
                className="font-mono text-xs uppercase tracking-wider"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddBatch}
                disabled={!batchUrls.trim() || addingBatch}
                size="sm"
                className="font-mono text-xs uppercase tracking-wider"
              >
                {addingBatch ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="w-3 h-3 mr-1" />
                    Add {batchUrls.trim().split("\n").filter(u => u.trim()).length} Reels
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-xl" />
          ))}
        </div>
      ) : data?.references.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border rounded-xl bg-card border-dashed">
          <Bookmark className="w-12 h-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground font-medium">Your remake list is empty</p>
          <p className="text-muted-foreground/60 text-sm mt-1">
            Paste a reel link above to get started
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {data?.references.map((ref) => (
            <Card
              key={ref.id}
              className="bg-card hover-elevate border-card-border overflow-hidden flex flex-col h-full"
            >
              <div className="p-4 bg-muted/30 border-b border-border flex justify-between items-start gap-4">
                <a
                  href={ref.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-mono text-xs truncate flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  {ref.url}
                </a>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => handleDelete(ref.id)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>

              <CardContent className="p-5 flex-1 flex flex-col">
                {ref.caption && (
                  <div className="text-xs text-muted-foreground line-clamp-2 mb-4 bg-background p-2 rounded border">
                    {ref.caption}
                  </div>
                )}

                {editingId === ref.id ? (
                  <div className="space-y-3 flex-1 flex flex-col">
                    {(
                      [
                        { key: "whyItsgood", label: "Why It's Good" },
                        { key: "whatToChange", label: "What to Change" },
                        { key: "howToRemake", label: "How to Remake" },
                      ] as const
                    ).map(({ key, label }) => (
                      <div key={key} className="space-y-1 flex-1">
                        <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                          {label}
                        </label>
                        <Textarea
                          value={editValues[key]}
                          onChange={(e) =>
                            setEditValues((prev) => ({
                              ...prev,
                              [key]: e.target.value,
                            }))
                          }
                          className="h-20 text-xs resize-none bg-background"
                        />
                      </div>
                    ))}
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        onClick={() => handleSave(ref.id)}
                        className="flex-1 font-mono uppercase text-[10px] tracking-wider h-8"
                      >
                        <Check className="w-3 h-3 mr-1" /> Save Notes
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingId(null)}
                        className="flex-1 font-mono uppercase text-[10px] tracking-wider h-8"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="space-y-4 flex-1 flex flex-col cursor-pointer group"
                    onClick={() => startEditing(ref)}
                  >
                    {(
                      [
                        { key: "whyItsgood", label: "Why It's Good" },
                        { key: "whatToChange", label: "What to Change" },
                        { key: "howToRemake", label: "How to Remake", accent: true },
                      ] as const
                    ).map(({ key, label, accent }) => (
                      <div key={key} className="flex-1">
                        <h4
                          className={`text-[10px] font-mono uppercase tracking-wider mb-1 ${
                            accent ? "text-primary" : "text-muted-foreground"
                          }`}
                        >
                          {label}
                        </h4>
                        <p className="text-sm">
                          {(ref as any)[key] || (
                            <span className="text-muted-foreground italic text-xs">
                              Click to add notes...
                            </span>
                          )}
                        </p>
                      </div>
                    ))}
                    <div className="pt-2 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-primary">
                        Click anywhere to edit
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
