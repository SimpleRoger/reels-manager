import { useState, useEffect, useRef } from "react";
import { useLocation, useParams, Link } from "wouter";
import { 
  useGetReel, getGetReelQueryKey,
  useGetReelNotes, getGetReelNotesQueryKey,
  useSaveReelNotes,
  useGetReelAnalysis, getGetReelAnalysisQueryKey,
  useAnalyzeReel,
  useUpdateReelTags,
  useCreatePlaybookLesson,
  useUpdatePlaybookLesson,
} from "@workspace/api-client-react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { formatNumber, formatDateTime } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { VideoThumb } from "@/components/video-thumb";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { PlaySquare, Heart, MessageCircle, Share2, Bookmark, Eye, ArrowLeft, Wand2, Sparkles, Tag as TagIcon, ExternalLink, Video, Star, BookOpen, Plus, X, Check, ChevronDown } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface VideoAnalysis {
  id: number;
  reelId: number;
  hookRating: string;
  hookFeedback: string;
  pacing: string;
  pacingFeedback: string;
  audio: string;
  audioFeedback: string;
  onScreenText: string;
  onScreenTextFeedback: string;
  contentType: string;
  contentTypeFeedback: string;
  overallScore: string;
  suggestions: string;
  createdAt: string;
}

function RatingBadge({ value }: { value: string }) {
  const v = value.toLowerCase();
  const isStrong = v.includes("strong") || v.includes("fast") || v.includes("present") || v.includes("trending") || v.includes("mixed");
  const isWeak = v.includes("weak") || v.includes("slow") || v.includes("none") || v.includes("silent");
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-semibold ${
      isStrong ? "bg-green-900/50 text-green-300 border border-green-700/50" :
      isWeak ? "bg-red-900/40 text-red-300 border border-red-700/50" :
      "bg-orange-900/40 text-orange-300 border border-orange-700/50"
    }`}>
      {value}
    </span>
  );
}

function VideoAnalysisDimension({ icon, label, rating, feedback }: { icon: string; label: string; rating: string; feedback: string }) {
  return (
    <div className="bg-background rounded-lg border p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{label}</span>
        </div>
        <RatingBadge value={rating} />
      </div>
      <p className="text-sm text-card-foreground leading-relaxed">{feedback}</p>
    </div>
  );
}

const notesSchema = z.object({
  hook: z.string().optional().nullable(),
  format: z.string().optional().nullable(),
  ideaSource: z.string().optional().nullable(),
  whyItWorked: z.string().optional().nullable(),
  whyItFailed: z.string().optional().nullable(),
  emotionalReaction: z.string().optional().nullable(),
  contentType: z.string().optional().nullable(),
  wouldRemake: z.boolean().optional().nullable(),
  inspirationLink: z.string().url().optional().nullable().or(z.literal('')),
  extraNotes: z.string().optional().nullable(),
});

function AnalysisBlock({ label, text, numbered = false }: { label: string; text: string; numbered?: boolean }) {
  const lines = text.split(/\\n|\n/).map(l => l.trim()).filter(Boolean);
  const isMultiLine = lines.length > 1;
  return (
    <div className="flex flex-col">
      <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">{label}</h4>
      <div className="text-sm text-card-foreground bg-background p-3 rounded-md border flex-1">
        {isMultiLine ? (
          <ul className="space-y-2">
            {lines.map((line, i) => (
              <li key={i} className="flex gap-2 leading-relaxed">
                {numbered ? (
                  <span className="text-primary font-mono shrink-0">{i + 1}.</span>
                ) : (
                  <span className="text-primary shrink-0 mt-1">›</span>
                )}
                <span>{line}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="leading-relaxed">{text}</p>
        )}
      </div>
    </div>
  );
}

export default function ReelDetail() {
  const { id } = useParams();
  const reelId = parseInt(id || "0", 10);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: reel, isLoading: isReelLoading } = useGetReel(reelId, {
    query: { enabled: !!reelId, queryKey: getGetReelQueryKey(reelId) }
  });

  const { data: notes, isLoading: isNotesLoading } = useGetReelNotes(reelId, {
    query: { enabled: !!reelId, queryKey: getGetReelNotesQueryKey(reelId) }
  });

  const { data: analysis, isLoading: isAnalysisLoading } = useGetReelAnalysis(reelId, {
    query: { enabled: !!reelId, queryKey: getGetReelAnalysisQueryKey(reelId) }
  });

  const saveNotesMutation = useSaveReelNotes();
  const analyzeMutation = useAnalyzeReel();
  const updateTagsMutation = useUpdateReelTags();

  const { data: videoAnalysis, isLoading: isVideoAnalysisLoading } = useQuery<VideoAnalysis>({
    queryKey: ["video-analysis", reelId],
    queryFn: async () => {
      const resp = await fetch(`${BASE}/api/reels/${reelId}/video-analysis`);
      if (resp.status === 404) return null as any;
      if (!resp.ok) throw new Error("Failed to load video analysis");
      return resp.json();
    },
    enabled: !!reelId,
    retry: false,
  });

  const videoAnalyzeMutation = useMutation({
    mutationFn: async () => {
      const resp = await fetch(`${BASE}/api/reels/${reelId}/video-analyze`, { method: "POST" });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Analysis failed" }));
        throw new Error(err.error ?? "Analysis failed");
      }
      return resp.json() as Promise<VideoAnalysis>;
    },
    onSuccess: (data) => {
      toast({ title: "Video analysis complete", description: "Gemini has analysed your reel." });
      queryClient.setQueryData(["video-analysis", reelId], data);
    },
    onError: (err: Error) => {
      toast({ title: "Video analysis failed", description: err.message, variant: "destructive" });
    },
  });

  const form = useForm<z.infer<typeof notesSchema>>({
    resolver: zodResolver(notesSchema),
    defaultValues: {
      hook: "", format: "", ideaSource: "", whyItWorked: "", whyItFailed: "",
      emotionalReaction: "", contentType: "", wouldRemake: false, inspirationLink: "", extraNotes: ""
    },
  });

  const [tagInput, setTagInput] = useState("");
  const initializedForId = useRef<number | null>(null);

  // ── Add to Playbook ──────────────────────────────────────────────────────────
  const createLessonMutation = useCreatePlaybookLesson();
  const updateLessonMutation = useUpdatePlaybookLesson();
  const [playbookOpen, setPlaybookOpen] = useState(false);
  const [playbookLesson, setPlaybookLesson] = useState("");
  const [playbookCategory, setPlaybookCategory] = useState("");
  const [playbookSaved, setPlaybookSaved] = useState(false);

  function handleAddToPlaybook() {
    if (!playbookLesson.trim() || !reel) return;
    createLessonMutation.mutate(
      {
        data: {
          lesson: playbookLesson.trim(),
          category: playbookCategory.trim() || undefined,
          proofUrl: reel.permalink ?? undefined,
        },
      },
      {
        onSuccess: (created) => {
          const lessonId = (created as any).id as number | undefined;
          // Pre-fill stats from reel data so we don't wait for Apify
          if (lessonId && reel) {
            updateLessonMutation.mutate({
              id: lessonId,
              data: {
                proofViewCount: reel.plays ?? undefined,
                proofLikeCount: reel.likeCount ?? undefined,
                proofCommentsCount: reel.commentsCount ?? undefined,
                proofThumbnailUrl: reel.thumbnailUrl ?? undefined,
                proofMediaUrl: reel.mediaUrl ?? undefined,
              },
            });
          }
          setPlaybookSaved(true);
          setPlaybookLesson("");
          setPlaybookCategory("");
          toast({ title: "Added to Playbook", description: "Lesson saved with this reel as proof." });
          setTimeout(() => { setPlaybookSaved(false); setPlaybookOpen(false); }, 2000);
        },
        onError: () => toast({ title: "Failed to add to Playbook", variant: "destructive" }),
      }
    );
  }

  useEffect(() => {
    if (notes && initializedForId.current !== reelId) {
      initializedForId.current = reelId;
      form.reset({
        hook: notes.hook || "",
        format: notes.format || "",
        ideaSource: notes.ideaSource || "",
        whyItWorked: notes.whyItWorked || "",
        whyItFailed: notes.whyItFailed || "",
        emotionalReaction: notes.emotionalReaction || "",
        contentType: notes.contentType || "",
        wouldRemake: notes.wouldRemake || false,
        inspirationLink: notes.inspirationLink || "",
        extraNotes: notes.extraNotes || "",
      });
    }
  }, [notes, reelId, form]);

  function onSubmitNotes(values: z.infer<typeof notesSchema>) {
    saveNotesMutation.mutate({ id: reelId }, { data: values }, {
      onSuccess: () => {
        toast({ title: "Notes saved successfully" });
        queryClient.invalidateQueries({ queryKey: getGetReelNotesQueryKey(reelId) });
      },
      onError: () => toast({ title: "Failed to save notes", variant: "destructive" })
    });
  }

  function handleAnalyze() {
    analyzeMutation.mutate({ id: reelId }, {
      onSuccess: (data) => {
        toast({ title: "Analysis complete", description: "AI has processed this reel." });
        queryClient.setQueryData(getGetReelAnalysisQueryKey(reelId), data);
      },
      onError: () => toast({ title: "Analysis failed", variant: "destructive" })
    });
  }

  function handleAddTag() {
    if (!tagInput.trim() || !reel) return;
    const currentTags = reel.tags || [];
    if (currentTags.includes(tagInput.trim())) return;
    
    const newTags = [...currentTags, tagInput.trim()];
    updateTagsMutation.mutate({ id: reelId }, { data: { tags: newTags } }, {
      onSuccess: (data) => {
        setTagInput("");
        queryClient.setQueryData(getGetReelQueryKey(reelId), (old: any) => 
          old ? { ...old, tags: data.tags } : old
        );
      }
    });
  }

  function handleRemoveTag(tagToRemove: string) {
    if (!reel) return;
    const newTags = (reel.tags || []).filter(t => t !== tagToRemove);
    updateTagsMutation.mutate({ id: reelId }, { data: { tags: newTags } }, {
      onSuccess: (data) => {
        queryClient.setQueryData(getGetReelQueryKey(reelId), (old: any) => 
          old ? { ...old, tags: data.tags } : old
        );
      }
    });
  }

  if (isReelLoading) {
    return <div className="space-y-4"><Skeleton className="h-10 w-32" /><Skeleton className="h-96 w-full" /></div>;
  }

  if (!reel) {
    return <div>Reel not found.</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <Link href="/reels">
        <Button variant="ghost" size="sm" className="mb-2 -ml-3 text-muted-foreground font-mono uppercase text-xs tracking-wider">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Log
        </Button>
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Reel Preview & Core Stats */}
        <div className="space-y-6">
          <Card className="overflow-hidden bg-card border-card-border shadow-md">
            <div className="aspect-[9/16] relative bg-muted border-b border-border">
              {reel.mediaUrl ? (
                <video
                  src={reel.mediaUrl}
                  poster={reel.thumbnailUrl ?? undefined}
                  controls
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0">
                  <VideoThumb thumbnailUrl={reel.thumbnailUrl} videoUrl={reel.mediaUrl} permalink={reel.permalink} />
                </div>
              )}
              <div className="absolute top-4 right-4 pointer-events-none">
                <StatusBadge status={reel.performanceStatus} />
              </div>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                {formatDateTime(reel.postedAt)}
              </div>
              <p className="text-sm text-card-foreground leading-relaxed whitespace-pre-wrap">
                {reel.caption}
              </p>
              {reel.permalink && (
                <a href={reel.permalink} target="_blank" rel="noopener noreferrer">
                  <Button variant="secondary" className="w-full font-mono text-xs uppercase tracking-wider mt-2">
                    View on Instagram <ExternalLink className="w-3 h-3 ml-2" />
                  </Button>
                </a>
              )}
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-card hover-elevate">
              <CardContent className="p-4 flex flex-col items-center text-center justify-center">
                <Eye className="w-4 h-4 text-primary mb-2" />
                <div className="text-2xl font-bold">{formatNumber(reel.plays)}</div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Plays</div>
              </CardContent>
            </Card>
            <Card className="bg-card hover-elevate">
              <CardContent className="p-4 flex flex-col items-center text-center justify-center">
                <Heart className="w-4 h-4 text-primary mb-2" />
                <div className="text-2xl font-bold">{formatNumber(reel.likeCount)}</div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Likes</div>
              </CardContent>
            </Card>
            <Card className="bg-card hover-elevate">
              <CardContent className="p-4 flex flex-col items-center text-center justify-center">
                <MessageCircle className="w-4 h-4 text-primary mb-2" />
                <div className="text-2xl font-bold">{formatNumber(reel.commentsCount)}</div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Comments</div>
              </CardContent>
            </Card>
            <Card className="bg-card hover-elevate">
              <CardContent className="p-4 flex flex-col items-center text-center justify-center">
                <Share2 className="w-4 h-4 text-primary mb-2" />
                <div className="text-2xl font-bold">{formatNumber(reel.shares)}</div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Shares</div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-card border-card-border">
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2 font-mono uppercase tracking-wider">
                <TagIcon className="w-4 h-4 text-primary" /> Tags
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="flex flex-wrap gap-2 mb-3">
                {reel.tags?.map(tag => (
                  <Badge key={tag} variant="secondary" className="px-2 py-0.5 text-xs font-normal">
                    #{tag}
                    <button onClick={() => handleRemoveTag(tag)} className="ml-1 text-muted-foreground hover:text-destructive">
                      &times;
                    </button>
                  </Badge>
                ))}
                {(!reel.tags || reel.tags.length === 0) && (
                  <span className="text-xs text-muted-foreground italic">No tags</span>
                )}
              </div>
              <div className="flex gap-2">
                <Input 
                  placeholder="Add a tag..." 
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                  className="h-8 text-xs font-mono bg-background"
                />
                <Button size="sm" onClick={handleAddTag} className="h-8 font-mono text-[10px] uppercase tracking-wider" disabled={updateTagsMutation.isPending}>Add</Button>
              </div>
            </CardContent>
          </Card>
          {/* Add to Playbook */}
          <Card className="bg-card border-card-border overflow-hidden">
            <button
              onClick={() => { setPlaybookOpen((v) => !v); setPlaybookSaved(false); }}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
            >
              <span className="flex items-center gap-2 text-sm font-mono uppercase tracking-wider text-muted-foreground">
                <BookOpen className="w-4 h-4 text-primary" /> Add to Playbook
              </span>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${playbookOpen ? "rotate-180" : ""}`} />
            </button>

            {playbookOpen && (
              <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                {playbookSaved ? (
                  <div className="flex items-center justify-center gap-2 py-4 text-green-400 font-mono text-sm">
                    <Check className="w-4 h-4" /> Lesson added to Playbook
                  </div>
                ) : (
                  <>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        What did this reel teach you?
                      </label>
                      <Textarea
                        placeholder="e.g. Crowd-reaction hooks drive 3× more shares..."
                        value={playbookLesson}
                        onChange={(e) => setPlaybookLesson(e.target.value)}
                        className="resize-none h-20 bg-background text-sm"
                        autoFocus
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        Category (optional)
                      </label>
                      <Input
                        placeholder="Hook, Format, Strategy..."
                        value={playbookCategory}
                        onChange={(e) => setPlaybookCategory(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddToPlaybook()}
                        className="h-8 text-xs bg-background"
                      />
                    </div>
                    {/* Proof preview */}
                    <div className="flex items-center gap-2 rounded-md bg-muted/40 border px-3 py-2 text-[11px] font-mono text-muted-foreground">
                      <BookOpen className="w-3 h-3 shrink-0 text-primary" />
                      <span className="truncate">Proof: this reel · {reel.plays ? `${(reel.plays / 1000).toFixed(0)}K plays` : "no stats yet"}</span>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        className="flex-1 font-mono text-[10px] uppercase tracking-wider"
                        onClick={handleAddToPlaybook}
                        disabled={createLessonMutation.isPending || !playbookLesson.trim()}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        {createLessonMutation.isPending ? "Saving..." : "Add Rule"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="font-mono text-[10px] uppercase tracking-wider"
                        onClick={() => setPlaybookOpen(false)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Journal & Analysis */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="journal" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="journal" className="font-mono uppercase text-xs tracking-wider">Journal</TabsTrigger>
              <TabsTrigger value="analysis" className="font-mono uppercase text-xs tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" /> AI Analysis
              </TabsTrigger>
              <TabsTrigger value="video" className="font-mono uppercase text-xs tracking-wider flex items-center gap-1.5">
                <Video className="w-3 h-3" /> Video AI
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="journal" className="space-y-4">
              <Card className="bg-card border-card-border">
                <CardHeader>
                  <CardTitle>Post-Mortem Notes</CardTitle>
                  <CardDescription>Deconstruct why this reel performed the way it did.</CardDescription>
                </CardHeader>
                <CardContent>
                  {isNotesLoading ? (
                    <div className="space-y-4"><Skeleton className="h-20 w-full"/><Skeleton className="h-20 w-full"/></div>
                  ) : (
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmitNotes)} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField control={form.control} name="hook" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-mono uppercase tracking-wider text-muted-foreground">The Hook</FormLabel>
                              <FormControl><Textarea placeholder="What was the first 3 seconds?" className="resize-none h-20 bg-background" {...field} value={field.value || ""} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="format" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Format / Style</FormLabel>
                              <FormControl><Input placeholder="Talking head, trend, vlog..." className="bg-background" {...field} value={field.value || ""} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="whyItWorked" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Why It Worked (or didn't)</FormLabel>
                              <FormControl><Textarea placeholder="Your hypothesis..." className="resize-none h-20 bg-background" {...field} value={field.value || ""} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="contentType" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Content Type</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value || ""}>
                                <FormControl><SelectTrigger className="bg-background"><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                                <SelectContent>
                                  <SelectItem value="funny">Funny</SelectItem>
                                  <SelectItem value="controversial">Controversial</SelectItem>
                                  <SelectItem value="relatable">Relatable</SelectItem>
                                  <SelectItem value="educational">Educational</SelectItem>
                                  <SelectItem value="aesthetic">Aesthetic</SelectItem>
                                  <SelectItem value="vlog">Vlog / Story</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>
                        
                        <FormField control={form.control} name="wouldRemake" render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-background">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base font-medium">Would you remake this?</FormLabel>
                              <CardDescription>Is this a format worth repeating?</CardDescription>
                            </div>
                            <FormControl><Switch checked={!!field.value} onCheckedChange={field.onChange} /></FormControl>
                          </FormItem>
                        )} />

                        <Button type="submit" disabled={saveNotesMutation.isPending} className="w-full font-mono uppercase tracking-wider text-xs">
                          {saveNotesMutation.isPending ? "Saving..." : "Save Journal Entry"}
                        </Button>
                      </form>
                    </Form>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analysis" className="space-y-4">
              <Card className="bg-card border-card-border min-h-[400px]">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>AI Performance Analysis</CardTitle>
                    <CardDescription>Deep dive into metrics, caption, and context.</CardDescription>
                  </div>
                  {!analysis && !isAnalysisLoading && (
                    <Button onClick={handleAnalyze} disabled={analyzeMutation.isPending} className="font-mono uppercase tracking-wider text-xs">
                      <Wand2 className="w-4 h-4 mr-2" /> {analyzeMutation.isPending ? "Analyzing..." : "Run Analysis"}
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {isAnalysisLoading || analyzeMutation.isPending ? (
                    <div className="space-y-4">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-20 w-full" />
                      <Skeleton className="h-20 w-full" />
                    </div>
                  ) : analysis ? (
                    <div className="space-y-6">
                      <div>
                        <h4 className="text-xs font-mono uppercase tracking-wider text-primary mb-2">Summary</h4>
                        <p className="text-sm text-card-foreground leading-relaxed bg-background p-4 rounded-md border">{analysis.summary}</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <AnalysisBlock label="Performance Drivers" text={analysis.performanceDrivers} />
                        <AnalysisBlock label="Lessons Learned" text={analysis.lessonsLearned} numbered />
                        <AnalysisBlock label="Next Ideas" text={analysis.nextIdeas} numbered />
                        <AnalysisBlock label="Variables to Repeat" text={analysis.variablesToRepeat} />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Sparkles className="w-12 h-12 text-muted mb-4" />
                      <p className="text-muted-foreground max-w-sm">No analysis has been generated for this reel yet. Run an analysis to uncover performance drivers and patterns.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="video" className="space-y-4">
              <Card className="bg-card border-card-border min-h-[400px]">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Video className="w-4 h-4 text-primary" /> Gemini Video Analysis
                    </CardTitle>
                    <CardDescription>AI watches your actual reel and breaks down hook, pacing, audio, text, and content type.</CardDescription>
                  </div>
                  {!reel.mediaUrl ? null : (
                    <Button
                      onClick={() => videoAnalyzeMutation.mutate()}
                      disabled={videoAnalyzeMutation.isPending}
                      className="font-mono uppercase tracking-wider text-xs shrink-0"
                    >
                      <Video className="w-4 h-4 mr-2" />
                      {videoAnalyzeMutation.isPending ? "Analysing..." : videoAnalysis ? "Re-analyse" : "Analyse Video"}
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {!reel.mediaUrl && (
                    <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                      <Video className="w-10 h-10 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground max-w-sm">No video URL available for this reel. Re-sync your Instagram account to refresh CDN links.</p>
                    </div>
                  )}

                  {reel.mediaUrl && (isVideoAnalysisLoading || videoAnalyzeMutation.isPending) && (
                    <div className="space-y-3">
                      <Skeleton className="h-4 w-1/4" />
                      <Skeleton className="h-24 w-full" />
                      <Skeleton className="h-24 w-full" />
                      <Skeleton className="h-24 w-full" />
                      {videoAnalyzeMutation.isPending && (
                        <p className="text-xs text-muted-foreground font-mono text-center pt-2 animate-pulse">
                          Gemini is watching your reel — this takes 15–30 seconds...
                        </p>
                      )}
                    </div>
                  )}

                  {reel.mediaUrl && !isVideoAnalysisLoading && !videoAnalyzeMutation.isPending && videoAnalysis && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                        <Star className="w-4 h-4 text-primary shrink-0" />
                        <p className="text-sm font-semibold text-foreground">{videoAnalysis.overallScore}</p>
                      </div>

                      <div className="grid grid-cols-1 gap-3">
                        <VideoAnalysisDimension icon="🎣" label="Hook (First 3 Seconds)" rating={videoAnalysis.hookRating} feedback={videoAnalysis.hookFeedback} />
                        <VideoAnalysisDimension icon="⚡" label="Pacing & Edit Rhythm" rating={videoAnalysis.pacing} feedback={videoAnalysis.pacingFeedback} />
                        <VideoAnalysisDimension icon="🎵" label="Audio" rating={videoAnalysis.audio} feedback={videoAnalysis.audioFeedback} />
                        <VideoAnalysisDimension icon="📝" label="On-Screen Text" rating={videoAnalysis.onScreenText} feedback={videoAnalysis.onScreenTextFeedback} />
                        <VideoAnalysisDimension icon="🎬" label="Content Type" rating={videoAnalysis.contentType} feedback={videoAnalysis.contentTypeFeedback} />
                      </div>

                      <div className="bg-background rounded-lg border p-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-base">💡</span>
                          <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Improvement Suggestions</span>
                        </div>
                        <ul className="space-y-2">
                          {videoAnalysis.suggestions.split(/\\n|\n/).map((s, i) => s.trim()).filter(Boolean).map((suggestion, i) => (
                            <li key={i} className="flex gap-2 text-sm text-card-foreground leading-relaxed">
                              <span className="text-primary font-mono shrink-0">{i + 1}.</span>
                              <span>{suggestion}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <p className="text-[10px] text-muted-foreground font-mono text-center">
                        Analysed by Gemini 2.5 Flash · {new Date(videoAnalysis.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  )}

                  {reel.mediaUrl && !isVideoAnalysisLoading && !videoAnalyzeMutation.isPending && !videoAnalysis && (
                    <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                      <Video className="w-12 h-12 text-muted-foreground/30" />
                      <p className="text-muted-foreground max-w-sm text-sm">Click "Analyse Video" and Gemini will watch this reel and give you a detailed breakdown of hook, pacing, audio, text overlays, and content type.</p>
                      <p className="text-[10px] text-muted-foreground font-mono">Analysis takes ~15–30 seconds</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
