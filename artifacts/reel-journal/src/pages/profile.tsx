import { useState } from "react";
import { formatNumber } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Users, Eye, Heart, MessageCircle, Share2, Bookmark, Sparkles, Wand2, TrendingUp, UserPlus, Lightbulb, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface ProfileData {
  username: string;
  accountType: string | null;
  biography: string | null;
  followersCount: number | null;
  mediaCount: number | null;
  avgReach: number | null;
  avgLikes: number | null;
  avgComments: number | null;
  avgSaves: number | null;
  avgShares: number | null;
  engagementRate: number | null;
  reachToFollowerRatio: number | null;
  estimatedActiveAudience: number | null;
}

interface AITips {
  growthAssessment: string;
  profileTips: string;
  contentStrategy: string;
  followerGrowthTips: string;
  retentionTips: string;
}

function TipsBlock({ label, text, icon: Icon, numbered = false }: { label: string; text: string; icon: React.ElementType; numbered?: boolean }) {
  const lines = text.split(/\\n|\n/).map(l => l.trim()).filter(Boolean);
  const isMultiLine = lines.length > 1;
  return (
    <div className="flex flex-col">
      <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
        <Icon className="w-3 h-3 text-primary" /> {label}
      </h4>
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

export default function Profile() {
  const { toast } = useToast();
  const [tips, setTips] = useState<AITips | null>(null);

  const { data: profile, isLoading } = useQuery<ProfileData>({
    queryKey: ["profile"],
    queryFn: async () => {
      const resp = await fetch(`${BASE}/api/profile`);
      if (!resp.ok) throw new Error("Failed to load profile");
      return resp.json();
    },
  });

  const tipsMutation = useMutation({
    mutationFn: async () => {
      const resp = await fetch(`${BASE}/api/profile/ai-tips`, { method: "POST" });
      if (!resp.ok) throw new Error("Failed to generate tips");
      return resp.json() as Promise<AITips>;
    },
    onSuccess: (data) => {
      setTips(data);
    },
    onError: () => {
      toast({ title: "Failed to generate tips", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
        <Users className="w-12 h-12 text-muted-foreground" />
        <p className="text-muted-foreground">Connect your Instagram account in Settings first.</p>
      </div>
    );
  }

  const engagementPct = profile.engagementRate != null
    ? profile.engagementRate.toFixed(2) + "%"
    : "—";

  const reachRatio = profile.reachToFollowerRatio != null
    ? profile.reachToFollowerRatio.toFixed(2) + "x"
    : "—";

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Profile Intelligence</h1>
        <p className="text-muted-foreground text-sm font-mono uppercase tracking-wider">
          @{profile.username} &bull; {profile.accountType ?? "creator"}
        </p>
        {profile.biography && (
          <p className="text-sm text-muted-foreground max-w-xl pt-1">{profile.biography}</p>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card hover-elevate">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-mono uppercase tracking-wider flex items-center gap-2">
              <Users className="w-3 h-3 text-primary" /> Followers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatNumber(profile.followersCount)}</div>
            <p className="text-xs text-muted-foreground mt-1">Real follower count</p>
          </CardContent>
        </Card>

        <Card className="bg-card hover-elevate">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-mono uppercase tracking-wider flex items-center gap-2">
              <Eye className="w-3 h-3 text-primary" /> Avg Reach
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatNumber(profile.estimatedActiveAudience)}</div>
            <p className="text-xs text-muted-foreground mt-1">Unique viewers per Reel</p>
          </CardContent>
        </Card>

        <Card className="bg-card hover-elevate">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-mono uppercase tracking-wider flex items-center gap-2">
              <Heart className="w-3 h-3 text-primary" /> Engagement Rate
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{engagementPct}</div>
            <p className="text-xs text-muted-foreground mt-1">Likes + comments / followers</p>
          </CardContent>
        </Card>

        <Card className="bg-card hover-elevate">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-mono uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-3 h-3 text-primary" /> Reach Multiplier
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{reachRatio}</div>
            <p className="text-xs text-muted-foreground mt-1">Reach vs followers ratio</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Avg Likes", icon: Heart, value: profile.avgLikes },
          { label: "Avg Comments", icon: MessageCircle, value: profile.avgComments },
          { label: "Avg Shares", icon: Share2, value: profile.avgShares },
          { label: "Avg Saves", icon: Bookmark, value: profile.avgSaves },
          { label: "Total Posts", icon: Target, value: profile.mediaCount },
        ].map(({ label, icon: Icon, value }) => (
          <Card key={label} className="bg-card">
            <CardHeader className="pb-1">
              <CardDescription className="text-xs font-mono uppercase tracking-wider flex items-center gap-1">
                <Icon className="w-3 h-3 text-primary" /> {label}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(value)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-card border-card-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" /> AI Growth Strategy
            </CardTitle>
            <CardDescription>Personalised tips based on your actual account data</CardDescription>
          </div>
          <Button
            onClick={() => tipsMutation.mutate()}
            disabled={tipsMutation.isPending}
            className="font-mono uppercase tracking-wider text-xs"
          >
            <Wand2 className="w-4 h-4 mr-2" />
            {tipsMutation.isPending ? "Analysing..." : tips ? "Regenerate" : "Generate Tips"}
          </Button>
        </CardHeader>
        <CardContent>
          {tipsMutation.isPending ? (
            <div className="space-y-4">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : tips ? (
            <div className="space-y-6">
              <div>
                <h4 className="text-xs font-mono uppercase tracking-wider text-primary mb-2">Growth Assessment</h4>
                <p className="text-sm text-card-foreground leading-relaxed bg-background p-4 rounded-md border">{tips.growthAssessment}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TipsBlock label="Profile Tips" text={tips.profileTips} icon={UserPlus} />
                <TipsBlock label="Content to Post Next" text={tips.contentStrategy} icon={Lightbulb} numbered />
                <TipsBlock label="Follower Growth Tactics" text={tips.followerGrowthTips} icon={TrendingUp} numbered />
                <TipsBlock label="Convert Reach to Followers" text={tips.retentionTips} icon={Target} />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Sparkles className="w-12 h-12 text-muted mb-4" />
              <p className="text-muted-foreground max-w-sm">
                Generate personalised AI growth tips based on your follower count, engagement rate, and top performing content.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
