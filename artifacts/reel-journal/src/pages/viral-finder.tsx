import { useState } from "react";
import { useSearchHashtag, useCreateReference, getSearchHashtagQueryKey, getListReferencesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/format";
import { Search, Heart, MessageCircle, ExternalLink, BookmarkPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ViralFinder() {
  const [hashtag, setHashtag] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  
  const { data, isLoading, error } = useSearchHashtag(
    { hashtag: searchQuery },
    { query: { enabled: !!searchQuery, queryKey: getSearchHashtagQueryKey({ hashtag: searchQuery }) } }
  );

  const createRefMutation = useCreateReference();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!hashtag.trim()) return;
    setSearchQuery(hashtag.replace(/^#/, '').trim());
  }

  function handleSaveReference(media: any) {
    if (!media.permalink) return;
    
    createRefMutation.mutate({ 
      data: {
        url: media.permalink,
        caption: media.caption,
        likeCount: media.likeCount,
        commentsCount: media.commentsCount
      } 
    }, {
      onSuccess: () => {
        toast({ title: "Saved to Remake List" });
        queryClient.invalidateQueries({ queryKey: getListReferencesQueryKey() });
      },
      onError: () => {
        toast({ title: "Failed to save reference", variant: "destructive" });
      }
    });
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Viral Finder</h1>
        <p className="text-muted-foreground text-sm">Search Instagram hashtags to find top performing content.</p>
      </div>

      <Card className="bg-card border-card-border">
        <CardContent className="p-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search hashtag (e.g. contentcreator)" 
                value={hashtag}
                onChange={(e) => setHashtag(e.target.value)}
                className="pl-9 bg-background font-mono"
              />
            </div>
            <Button type="submit" disabled={isLoading} className="font-mono uppercase tracking-wider text-xs">
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <div className="p-4 bg-destructive/10 text-destructive border border-destructive/20 rounded-md text-sm">
          {error.error || "Failed to search hashtag. Make sure your Instagram account is connected."}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-xl" />
          ))}
        </div>
      ) : data ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            Results for #{data.hashtag}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {data.media.map((item, i) => (
              <Card key={item.id || i} className="overflow-hidden bg-card hover-elevate group flex flex-col h-full">
                <div className="p-4 flex-1 flex flex-col">
                  <p className="text-xs text-card-foreground line-clamp-4 mb-4 flex-1">
                    {item.caption || "No caption"}
                  </p>
                  <div className="flex justify-between items-center text-xs font-mono text-muted-foreground mb-4 border-t pt-2">
                    <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {formatNumber(item.likeCount)}</span>
                    <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" /> {formatNumber(item.commentsCount)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-auto">
                    {item.permalink && (
                      <a href={item.permalink} target="_blank" rel="noopener noreferrer" className="w-full">
                        <Button variant="outline" size="sm" className="w-full font-mono text-[10px] uppercase h-8">
                          <ExternalLink className="w-3 h-3 mr-1" /> View
                        </Button>
                      </a>
                    )}
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      className="w-full font-mono text-[10px] uppercase h-8"
                      onClick={() => handleSaveReference(item)}
                    >
                      <BookmarkPlus className="w-3 h-3 mr-1" /> Save
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
            {data.media.length === 0 && (
              <div className="col-span-full py-12 text-center text-muted-foreground border border-dashed rounded-xl bg-card">
                No results found for this hashtag.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center border rounded-xl bg-card border-dashed">
          <Search className="w-12 h-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">Enter a hashtag to discover trending content.</p>
        </div>
      )}
    </div>
  );
}
