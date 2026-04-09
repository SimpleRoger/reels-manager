import { useState } from "react";
import { useListReels, getListReelsQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { formatNumber, formatDate } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlaySquare, Filter, Play, X } from "lucide-react";
import { ListReelsSortBy, ListReelsSortOrder } from "@workspace/api-zod";

interface ReelItem {
  id: number;
  mediaUrl?: string | null;
  thumbnailUrl?: string | null;
  caption?: string | null;
  postedAt?: string | null;
  plays?: number | null;
  likeCount?: number | null;
  performanceStatus?: string | null;
}

function VideoModal({ reel, onClose }: { reel: ReelItem; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white/70 hover:text-white transition-colors flex items-center gap-1 text-sm font-mono"
        >
          <X className="w-4 h-4" /> Close
        </button>
        <div className="aspect-[9/16] rounded-xl overflow-hidden bg-black shadow-2xl">
          {reel.mediaUrl ? (
            <video
              src={reel.mediaUrl}
              poster={reel.thumbnailUrl ?? undefined}
              controls
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-white/50 gap-3">
              <PlaySquare className="w-16 h-16" />
              <p className="text-sm font-mono">No video available</p>
            </div>
          )}
        </div>
        {reel.caption && (
          <p className="mt-3 text-white/80 text-xs leading-relaxed line-clamp-3 px-1">{reel.caption}</p>
        )}
      </div>
    </div>
  );
}

export default function ReelsLog() {
  const [sortBy, setSortBy] = useState<ListReelsSortBy>("postedAt");
  const [sortOrder, setSortOrder] = useState<ListReelsSortOrder>("desc");
  const [playingReel, setPlayingReel] = useState<ReelItem | null>(null);

  const { data, isLoading } = useListReels({ sortBy, sortOrder }, {
    query: {
      queryKey: getListReelsQueryKey({ sortBy, sortOrder })
    }
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {playingReel && (
        <VideoModal reel={playingReel} onClose={() => setPlayingReel(null)} />
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Reels Log</h1>
          <p className="text-muted-foreground text-sm">Your complete content history.</p>
        </div>
        
        <div className="flex items-center gap-2 bg-card border rounded-md p-1">
          <Filter className="w-4 h-4 text-muted-foreground ml-2" />
          <Select 
            value={`${sortBy}-${sortOrder}`} 
            onValueChange={(val) => {
              const [by, order] = val.split("-") as [ListReelsSortBy, ListReelsSortOrder];
              setSortBy(by);
              setSortOrder(order);
            }}
          >
            <SelectTrigger className="w-[180px] border-0 focus:ring-0 text-xs font-mono uppercase tracking-wider bg-transparent">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="postedAt-desc">Newest First</SelectItem>
              <SelectItem value="postedAt-asc">Oldest First</SelectItem>
              <SelectItem value="likeCount-desc">Most Likes</SelectItem>
              <SelectItem value="commentsCount-desc">Most Comments</SelectItem>
              <SelectItem value="shares-desc">Most Shares</SelectItem>
              <SelectItem value="saves-desc">Most Saves</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="aspect-[9/16] w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {data?.reels.map((reel) => (
            <Card key={reel.id} className="overflow-hidden bg-card hover:border-primary/50 transition-colors group cursor-pointer h-full flex flex-col hover-elevate">
              <div className="aspect-[9/16] relative bg-muted border-b border-border">
                {reel.thumbnailUrl ? (
                  <img 
                    src={reel.thumbnailUrl} 
                    alt="Thumbnail" 
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <PlaySquare className="w-8 h-8 text-muted-foreground/30" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                <div className="absolute top-2 right-2">
                  <StatusBadge status={reel.performanceStatus} />
                </div>

                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setPlayingReel(reel);
                    }}
                    className="w-14 h-14 rounded-full bg-primary/90 hover:bg-primary flex items-center justify-center shadow-xl transition-transform hover:scale-110"
                  >
                    <Play className="w-6 h-6 text-black fill-black ml-1" />
                  </button>
                </div>

                <div className="absolute bottom-2 left-2 right-2 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="text-[10px] font-mono uppercase tracking-wider">
                    {formatDate(reel.postedAt)}
                  </div>
                </div>
              </div>
              <Link href={`/reels/${reel.id}`} className="flex-1 flex flex-col">
                <div className="p-3 flex-1 flex flex-col text-sm">
                  <div className="flex justify-between items-center mb-2 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                    <span>{formatNumber(reel.plays)} Plays</span>
                    <span>{formatNumber(reel.likeCount)} Likes</span>
                  </div>
                  <p className="line-clamp-2 text-xs text-card-foreground flex-1">
                    {reel.caption || "No caption"}
                  </p>
                </div>
              </Link>
            </Card>
          ))}
          {data?.reels.length === 0 && (
            <div className="col-span-full py-20 text-center text-muted-foreground border border-dashed rounded-xl bg-card">
              No reels found. Make sure your account is synced.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
