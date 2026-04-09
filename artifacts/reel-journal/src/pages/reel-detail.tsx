import { useState, useEffect, useRef } from "react";
import { useLocation, useParams, Link } from "wouter";
import { 
  useGetReel, getGetReelQueryKey,
  useGetReelNotes, getGetReelNotesQueryKey,
  useSaveReelNotes,
  useGetReelAnalysis, getGetReelAnalysisQueryKey,
  useAnalyzeReel,
  useUpdateReelTags
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { formatNumber, formatDateTime } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
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
import { PlaySquare, Heart, MessageCircle, Share2, Bookmark, Eye, ArrowLeft, Wand2, Sparkles, Tag as TagIcon, ExternalLink } from "lucide-react";

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

  const form = useForm<z.infer<typeof notesSchema>>({
    resolver: zodResolver(notesSchema),
    defaultValues: {
      hook: "", format: "", ideaSource: "", whyItWorked: "", whyItFailed: "",
      emotionalReaction: "", contentType: "", wouldRemake: false, inspirationLink: "", extraNotes: ""
    },
  });

  const [tagInput, setTagInput] = useState("");
  const initializedForId = useRef<number | null>(null);

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
      onSuccess: () => {
        toast({ title: "Analysis complete", description: "AI has processed this reel." });
        queryClient.invalidateQueries({ queryKey: getGetReelAnalysisQueryKey(reelId) });
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
              {reel.thumbnailUrl ? (
                <img 
                  src={reel.thumbnailUrl} 
                  alt="Thumbnail" 
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <PlaySquare className="w-12 h-12 text-muted-foreground/30" />
                </div>
              )}
              <div className="absolute top-4 right-4">
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
        </div>

        {/* Right Column: Journal & Analysis */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="journal" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="journal" className="font-mono uppercase text-xs tracking-wider">Creator Journal</TabsTrigger>
              <TabsTrigger value="analysis" className="font-mono uppercase text-xs tracking-wider flex items-center gap-2">
                <Sparkles className="w-3 h-3" /> AI Analysis
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
          </Tabs>
        </div>
      </div>
    </div>
  );
}
