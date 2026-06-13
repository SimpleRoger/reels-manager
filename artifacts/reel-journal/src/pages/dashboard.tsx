import { useGetDashboardSummary, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { formatNumber, formatDateTime } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Instagram, PlaySquare, Heart, MessageCircle, Share2, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VideoThumb } from "@/components/video-thumb";

export default function Dashboard() {
  const { data: summary, isLoading } = useGetDashboardSummary({
    query: {
      queryKey: getGetDashboardSummaryQueryKey()
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!summary?.connected) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-center space-y-6 animate-in fade-in zoom-in duration-500">
        <div className="w-20 h-20 bg-card border rounded-2xl flex items-center justify-center text-muted-foreground shadow-sm">
          <Instagram className="w-10 h-10" />
        </div>
        <div className="max-w-md space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">Connect Your Account</h2>
          <p className="text-muted-foreground">
            Reel Journal needs to connect to your Instagram account to pull your Reels and performance data.
          </p>
        </div>
        <Link href="/settings">
          <Button size="lg" className="font-semibold tracking-wide">
            Go to Settings
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm font-mono uppercase tracking-wider">
            {summary.totalReels} REELS TRACKED &bull; LAST SYNC {formatDateTime(summary.lastSynced)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card hover-elevate">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-mono uppercase tracking-wider flex items-center gap-2">
              <Heart className="w-3 h-3 text-primary" /> Avg Likes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-card-foreground">
              {formatNumber(summary.averages.avgLikes)}
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card hover-elevate">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-mono uppercase tracking-wider flex items-center gap-2">
              <MessageCircle className="w-3 h-3 text-primary" /> Avg Comments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-card-foreground">
              {formatNumber(summary.averages.avgComments)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card hover-elevate">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-mono uppercase tracking-wider flex items-center gap-2">
              <Share2 className="w-3 h-3 text-primary" /> Avg Shares
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-card-foreground">
              {formatNumber(summary.averages.avgShares)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card hover-elevate">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-mono uppercase tracking-wider flex items-center gap-2">
              <Bookmark className="w-3 h-3 text-primary" /> Avg Saves
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-card-foreground">
              {formatNumber(summary.averages.avgSaves)}
            </div>
          </CardContent>
        </Card>
      </div>

      {summary.latestReel && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight">Latest Reel</h2>
          <Card className="bg-card border-card-border overflow-hidden">
            <div className="flex flex-col md:flex-row">
              <div className="md:w-1/3 bg-muted relative aspect-[9/16] md:aspect-auto border-r border-border">
                <div className="absolute inset-0">
                  <VideoThumb thumbnailUrl={summary.latestReel.thumbnailUrl} videoUrl={summary.latestReel.mediaUrl} permalink={summary.latestReel.permalink} />
                </div>
                <div className="absolute top-4 right-4">
                  <StatusBadge status={summary.latestReel.performanceStatus} />
                </div>
              </div>
              <div className="p-6 md:w-2/3 flex flex-col">
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground font-mono mb-2 uppercase tracking-wider">
                    Posted {formatDateTime(summary.latestReel.postedAt)}
                  </div>
                  <p className="text-card-foreground text-sm line-clamp-3 mb-6">
                    {summary.latestReel.caption || "No caption"}
                  </p>
                  
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1 uppercase font-mono tracking-wider">Plays</div>
                      <div className="font-semibold text-lg">{formatNumber(summary.latestReel.plays)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1 uppercase font-mono tracking-wider">Likes</div>
                      <div className="font-semibold text-lg">{formatNumber(summary.latestReel.likeCount)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1 uppercase font-mono tracking-wider">Comments</div>
                      <div className="font-semibold text-lg">{formatNumber(summary.latestReel.commentsCount)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1 uppercase font-mono tracking-wider">Shares</div>
                      <div className="font-semibold text-lg">{formatNumber(summary.latestReel.shares)}</div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <Link href={`/reels/${summary.latestReel.id}`}>
                    <Button variant="secondary" className="w-full md:w-auto font-mono uppercase tracking-wider text-xs">
                      Analyze Performance <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
