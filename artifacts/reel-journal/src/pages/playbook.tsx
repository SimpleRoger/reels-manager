import { useState, useEffect } from "react";
import {
  useListPlaybookLessons,
  getListPlaybookLessonsQueryKey,
  useCreatePlaybookLesson,
  useUpdatePlaybookLesson,
  useDeletePlaybookLesson,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDateTime, formatNumber } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Trash2, BookOpen, Plus, Link2, Eye, Heart, MessageCircle,
  Play, X, Loader2, ExternalLink, Pencil, Check
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

type Lesson = {
  id: number;
  lesson: string;
  category?: string | null;
  proofUrl?: string | null;
  proofThumbnailUrl?: string | null;
  proofMediaUrl?: string | null;
  proofViewCount?: number | null;
  proofLikeCount?: number | null;
  proofCommentsCount?: number | null;
  proofAccountName?: string | null;
  createdAt: string;
};

// ─── Proof Video Modal ────────────────────────────────────────────────────────

function ProofModal({ lesson, onClose }: { lesson: Lesson; onClose: () => void }) {
  const shortcode = lesson.proofUrl?.match(/instagram\.com\/(?:reel|p)\/([A-Za-z0-9_-]+)/)?.[1];
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm mx-4 rounded-2xl overflow-hidden bg-black shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 text-white/70 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="relative aspect-[9/16] w-full bg-black">
          {lesson.proofMediaUrl ? (
            <video
              src={lesson.proofMediaUrl}
              controls
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            />
          ) : shortcode ? (
            <iframe
              src={`https://www.instagram.com/reel/${shortcode}/embed/`}
              className="w-full h-full"
              style={{ border: "none" }}
              allowFullScreen
              scrolling="no"
              allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/40">
              <Play className="w-12 h-12" />
            </div>
          )}
        </div>
        {/* Stats bar */}
        <div className="bg-black/90 px-4 py-3 flex items-center gap-4 text-xs font-mono text-white/70">
          {lesson.proofAccountName && (
            <span className="text-primary font-semibold">@{lesson.proofAccountName}</span>
          )}
          {lesson.proofViewCount != null && (
            <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{formatNumber(lesson.proofViewCount)}</span>
          )}
          {lesson.proofLikeCount != null && (
            <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{formatNumber(lesson.proofLikeCount)}</span>
          )}
          {lesson.proofCommentsCount != null && (
            <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />{formatNumber(lesson.proofCommentsCount)}</span>
          )}
          {lesson.proofUrl && (
            <a href={lesson.proofUrl} target="_blank" rel="noopener noreferrer" className="ml-auto hover:text-primary">
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Lesson Card ──────────────────────────────────────────────────────────────

function LessonCard({ lesson, onDelete }: { lesson: Lesson; onDelete: () => void }) {
  const queryClient = useQueryClient();
  const updateMutation = useUpdatePlaybookLesson();
  const { toast } = useToast();
  const [watchOpen, setWatchOpen] = useState(false);
  const [editingProof, setEditingProof] = useState(false);
  const [proofInput, setProofInput] = useState(lesson.proofUrl ?? "");

  const hasPendingStats =
    lesson.proofUrl &&
    lesson.proofViewCount == null &&
    lesson.proofLikeCount == null &&
    lesson.proofCommentsCount == null;

  function saveProofUrl() {
    if (!proofInput.trim()) return;
    updateMutation.mutate(
      { id: lesson.id, data: { proofUrl: proofInput.trim() } },
      {
        onSuccess: () => {
          setEditingProof(false);
          toast({ title: "Proof reel saved — fetching stats..." });
          queryClient.invalidateQueries({ queryKey: getListPlaybookLessonsQueryKey() });
        },
        onError: () => toast({ title: "Failed to save proof URL", variant: "destructive" }),
      }
    );
  }

  function removeProofUrl() {
    updateMutation.mutate(
      { id: lesson.id, data: { proofUrl: null, proofThumbnailUrl: null, proofMediaUrl: null, proofViewCount: null, proofLikeCount: null, proofCommentsCount: null, proofAccountName: null } },
      {
        onSuccess: () => {
          setProofInput("");
          queryClient.invalidateQueries({ queryKey: getListPlaybookLessonsQueryKey() });
        },
      }
    );
  }

  return (
    <>
      {watchOpen && <ProofModal lesson={lesson} onClose={() => setWatchOpen(false)} />}

      <Card className="bg-card hover:border-primary/40 transition-colors group border-card-border overflow-hidden">
        <CardContent className="p-0">
          <div className="flex gap-0">
            {/* Proof thumbnail strip */}
            {lesson.proofUrl && (
              <div
                className="relative w-20 shrink-0 bg-muted overflow-hidden cursor-pointer"
                onClick={() => setWatchOpen(true)}
              >
                {lesson.proofThumbnailUrl ? (
                  <img
                    src={lesson.proofThumbnailUrl}
                    alt="proof"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center min-h-[100px]">
                    {hasPendingStats ? (
                      <Loader2 className="w-5 h-5 text-muted-foreground/50 animate-spin" />
                    ) : (
                      <Play className="w-5 h-5 text-muted-foreground/50" />
                    )}
                  </div>
                )}
                {/* Play overlay */}
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Play className="w-6 h-6 text-white fill-white" />
                </div>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 p-4 flex flex-col gap-2 min-w-0">
              {/* Top row: category + date + delete */}
              <div className="flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  {lesson.category && (
                    <Badge variant="secondary" className="text-[10px] uppercase font-mono tracking-wider py-0 px-1.5 h-4 shrink-0">
                      {lesson.category}
                    </Badge>
                  )}
                  <span className="text-[10px] text-muted-foreground font-mono truncate">
                    {formatDateTime(lesson.createdAt)}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onDelete}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity h-6 w-6 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>

              {/* Lesson text */}
              <p className="text-card-foreground text-sm font-medium leading-relaxed">{lesson.lesson}</p>

              {/* Proof section */}
              {lesson.proofUrl ? (
                <div className="flex items-center gap-3 mt-1">
                  {/* Stats */}
                  {hasPendingStats ? (
                    <span className="text-[10px] font-mono text-muted-foreground/60 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Fetching stats...
                    </span>
                  ) : (
                    <div className="flex items-center gap-3 text-[11px] font-mono text-muted-foreground">
                      {lesson.proofAccountName && (
                        <span className="text-primary font-semibold">@{lesson.proofAccountName}</span>
                      )}
                      {lesson.proofViewCount != null && (
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />{formatNumber(lesson.proofViewCount)}
                        </span>
                      )}
                      {lesson.proofLikeCount != null && (
                        <span className="flex items-center gap-1">
                          <Heart className="w-3 h-3" />{formatNumber(lesson.proofLikeCount)}
                        </span>
                      )}
                      {lesson.proofCommentsCount != null && (
                        <span className="flex items-center gap-1">
                          <MessageCircle className="w-3 h-3" />{formatNumber(lesson.proofCommentsCount)}
                        </span>
                      )}
                    </div>
                  )}
                  {/* Edit / remove proof buttons */}
                  <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setProofInput(lesson.proofUrl ?? ""); setEditingProof(true); }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button onClick={removeProofUrl} className="text-muted-foreground hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ) : editingProof ? (
                <div className="flex gap-1 mt-1">
                  <Input
                    value={proofInput}
                    onChange={(e) => setProofInput(e.target.value)}
                    placeholder="https://www.instagram.com/reel/..."
                    className="h-7 text-xs font-mono bg-background flex-1"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") saveProofUrl(); if (e.key === "Escape") setEditingProof(false); }}
                  />
                  <Button size="icon" className="h-7 w-7 shrink-0" onClick={saveProofUrl} disabled={updateMutation.isPending}>
                    <Check className="w-3 h-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setEditingProof(false)}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => setEditingProof(true)}
                  className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/50 hover:text-primary flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all mt-1"
                >
                  <Link2 className="w-3 h-3" /> Attach proof reel
                </button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Playbook() {
  const { data, isLoading } = useListPlaybookLessons({
    query: { queryKey: getListPlaybookLessonsQueryKey() },
  });

  const createMutation = useCreatePlaybookLesson();
  const deleteMutation = useDeletePlaybookLesson();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [lessonInput, setLessonInput] = useState("");
  const [categoryInput, setCategoryInput] = useState("");
  const [proofUrlInput, setProofUrlInput] = useState("");
  const [filter, setFilter] = useState("");

  const categories = Array.from(
    new Set(data?.lessons?.map((l) => l.category).filter(Boolean) as string[])
  );

  const filteredLessons = (data?.lessons as Lesson[] | undefined)?.filter(
    (l) => !filter || l.category === filter
  );

  // Auto-poll every 8s while any lesson has a proofUrl but no stats yet
  useEffect(() => {
    const hasPending = (data?.lessons as Lesson[] | undefined)?.some(
      (l) =>
        l.proofUrl &&
        l.proofViewCount == null &&
        l.proofLikeCount == null &&
        l.proofCommentsCount == null
    );
    if (!hasPending) return;
    const timer = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: getListPlaybookLessonsQueryKey() });
    }, 8_000);
    return () => clearInterval(timer);
  }, [data?.lessons]);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!lessonInput.trim()) return;
    createMutation.mutate(
      {
        data: {
          lesson: lessonInput,
          category: categoryInput || undefined,
          proofUrl: proofUrlInput.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          toast({
            title: proofUrlInput.trim()
              ? "Lesson added — fetching proof stats..."
              : "Lesson added",
          });
          setLessonInput("");
          setCategoryInput("");
          setProofUrlInput("");
          queryClient.invalidateQueries({ queryKey: getListPlaybookLessonsQueryKey() });
        },
      }
    );
  }

  function handleDelete(id: number) {
    if (!confirm("Delete this lesson?")) return;
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () =>
          queryClient.invalidateQueries({ queryKey: getListPlaybookLessonsQueryKey() }),
      }
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Playbook</h1>
        <p className="text-muted-foreground text-sm">Your accumulated knowledge and strategy rules.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Add form */}
        <div className="md:col-span-1 space-y-6">
          <Card className="bg-card border-card-border sticky top-6">
            <CardHeader>
              <CardTitle className="text-lg">Add New Lesson</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                    The Lesson
                  </label>
                  <Input
                    placeholder="e.g. Hooks under 2s perform better..."
                    value={lessonInput}
                    onChange={(e) => setLessonInput(e.target.value)}
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                    Category (Optional)
                  </label>
                  <Input
                    placeholder="e.g. Editing, Hooks, Strategy"
                    value={categoryInput}
                    onChange={(e) => setCategoryInput(e.target.value)}
                    className="bg-background"
                    list="categories"
                  />
                  <datalist id="categories">
                    {categories.map((c) => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Link2 className="w-3 h-3" /> Proof Reel URL (Optional)
                  </label>
                  <Input
                    placeholder="https://www.instagram.com/reel/..."
                    value={proofUrlInput}
                    onChange={(e) => setProofUrlInput(e.target.value)}
                    className="bg-background font-mono text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground/60">
                    Paste a reel that proves this lesson works — we'll pull the view count automatically.
                  </p>
                </div>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="w-full font-mono text-xs uppercase tracking-wider"
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Rule
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Lesson list */}
        <div className="md:col-span-2 space-y-4">
          {/* Category filter */}
          <div className="flex gap-2 pb-2 overflow-x-auto no-scrollbar flex-wrap">
            <Badge
              variant={filter === "" ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setFilter("")}
            >
              All
            </Badge>
            {categories.map((c) => (
              <Badge
                key={c}
                variant={filter === c ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setFilter(c)}
              >
                {c}
              </Badge>
            ))}
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : filteredLessons?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center border rounded-xl bg-card border-dashed">
              <BookOpen className="w-12 h-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                No lessons found. Add one to start building your playbook.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLessons?.map((lesson) => (
                <LessonCard
                  key={lesson.id}
                  lesson={lesson}
                  onDelete={() => handleDelete(lesson.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
