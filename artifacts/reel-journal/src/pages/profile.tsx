import { useState } from "react";
import { formatNumber } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Users, Eye, Heart, MessageCircle, Share2, Bookmark, Sparkles, Wand2, TrendingUp, UserPlus, Lightbulb, Target, Clock, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

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

interface HourStat {
  hour: number;
  label: string;
  count: number;
  avgReach: number;
  avgLikes: number;
  avgPlays: number;
  overperformingCount: number;
}

interface ReelPoint {
  id: number;
  postedAt: string | null;
  plays: number | null;
  likeCount: number | null;
  reach: number | null;
  shares: number | null;
  saves: number | null;
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

const ORANGE = "#f97316";
const AMBER  = "#f59e0b";
const MUTED  = "#6b7280";

function formatShort(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(Math.round(n));
}

function PerformanceChart({ reels }: { reels: ReelPoint[] }) {
  const [range, setRange] = useState<1 | 2>(1);

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - range);

  const filtered = reels
    .filter(r => r.postedAt && new Date(r.postedAt) >= cutoff)
    .sort((a, b) => new Date(a.postedAt!).getTime() - new Date(b.postedAt!).getTime());

  const chartData = filtered.map(r => ({
    date: new Date(r.postedAt!).toLocaleDateString("en-AU", { day: "numeric", month: "short" }),
    Views: r.plays ?? 0,
    Reach: r.reach ?? 0,
    Likes: r.likeCount ?? 0,
  }));

  return (
    <Card className="bg-card border-card-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" /> Performance Over Time
          </CardTitle>
          <CardDescription>Views, reach, and likes per post — sorted by date</CardDescription>
        </div>
        <div className="flex gap-1 bg-background rounded-md p-1 border">
          {([1, 2] as const).map(m => (
            <button
              key={m}
              onClick={() => setRange(m)}
              className={`px-3 py-1 rounded text-xs font-mono uppercase tracking-wider transition-colors ${
                range === m ? "bg-primary text-black" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m}mo
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
            No posts in the last {range} month{range > 1 ? "s" : ""}.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gViews" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={ORANGE} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={ORANGE} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gReach" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={AMBER} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={AMBER} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gLikes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={MUTED} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={MUTED} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "#6b7280", fontFamily: "monospace" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={formatShort}
                tick={{ fontSize: 10, fill: "#6b7280", fontFamily: "monospace" }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <Tooltip
                contentStyle={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 6, fontSize: 12 }}
                labelStyle={{ color: "#f9fafb", fontFamily: "monospace", marginBottom: 4 }}
                itemStyle={{ color: "#d1d5db" }}
                formatter={(v: number) => formatShort(v)}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 11, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.05em" }}
              />
              <Area type="monotone" dataKey="Views" stroke={ORANGE} strokeWidth={2} fill="url(#gViews)" dot={{ r: 3, fill: ORANGE }} />
              <Area type="monotone" dataKey="Reach" stroke={AMBER}  strokeWidth={2} fill="url(#gReach)" dot={{ r: 3, fill: AMBER }} />
              <Area type="monotone" dataKey="Likes" stroke={MUTED}  strokeWidth={1.5} fill="url(#gLikes)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function PostingTimesChart({ hours, bestHour }: { hours: HourStat[]; bestHour: HourStat | null }) {
  const [metric, setMetric] = useState<"avgReach" | "avgLikes" | "avgPlays">("avgReach");
  const maxVal = Math.max(...hours.map((h) => h[metric]), 1);

  const labelMap = { avgReach: "Avg Reach", avgLikes: "Avg Likes", avgPlays: "Avg Views" };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const h = hours.find((x) => x.label === label);
    return (
      <div className="bg-[#111827] border border-[#1f2937] rounded-lg p-3 text-xs space-y-1">
        <p className="font-mono text-white font-semibold">{label}</p>
        <p className="text-orange-400">{labelMap[metric]}: {formatShort(payload[0].value)}</p>
        {h && h.count > 0 && (
          <>
            <p className="text-gray-400">{h.count} reel{h.count !== 1 ? "s" : ""} posted</p>
            {h.overperformingCount > 0 && (
              <p className="text-yellow-400">🔥 {h.overperformingCount} overperforming</p>
            )}
          </>
        )}
        {h && h.count === 0 && <p className="text-gray-500">No posts at this hour</p>}
      </div>
    );
  };

  return (
    <Card className="bg-card border-card-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" /> Best Posting Times
          </CardTitle>
          <CardDescription>
            Average performance by hour you post — based on your actual reel history (Sydney time)
          </CardDescription>
        </div>
        <div className="flex gap-1 bg-background rounded-md p-1 border">
          {(["avgReach", "avgLikes", "avgPlays"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`px-2.5 py-1 rounded text-[10px] font-mono uppercase tracking-wider transition-colors ${
                metric === m ? "bg-primary text-black" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "avgReach" ? "Reach" : m === "avgLikes" ? "Likes" : "Views"}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {bestHour && bestHour.count > 0 && (
          <div className="flex items-center gap-3 bg-primary/10 border border-primary/30 rounded-lg px-4 py-3">
            <Star className="w-5 h-5 text-primary shrink-0" />
            <div className="text-sm">
              <span className="font-semibold text-primary">{bestHour.label}</span>
              {" "}is your best performing time —{" "}
              <span className="font-mono">{formatShort(bestHour.avgReach)}</span> avg reach from{" "}
              <span className="font-mono">{bestHour.count}</span> reel{bestHour.count !== 1 ? "s" : ""}
              {bestHour.overperformingCount > 0 && `, ${bestHour.overperformingCount} overperforming`}.
            </div>
          </div>
        )}
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={hours} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barSize={14}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9, fill: "#6b7280", fontFamily: "monospace" }}
              tickLine={false}
              axisLine={false}
              interval={1}
            />
            <YAxis
              tickFormatter={formatShort}
              tick={{ fontSize: 9, fill: "#6b7280", fontFamily: "monospace" }}
              tickLine={false}
              axisLine={false}
              width={38}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(249,115,22,0.08)" }} />
            <Bar dataKey={metric} radius={[3, 3, 0, 0]}>
              {hours.map((h) => (
                <Cell
                  key={h.hour}
                  fill={
                    h.count === 0
                      ? "#1f2937"
                      : h.hour === bestHour?.hour
                      ? "#f97316"
                      : h[metric] / maxVal > 0.75
                      ? "#fb923c"
                      : h[metric] / maxVal > 0.4
                      ? "#c2410c"
                      : "#7c2d12"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="text-[10px] text-muted-foreground font-mono text-center">
          Hours with no bar = no posts recorded at that time yet. Post more at different times to get more data.
        </p>
      </CardContent>
    </Card>
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

  const { data: reelsData } = useQuery<{ reels: ReelPoint[] }>({
    queryKey: ["reels-for-chart"],
    queryFn: async () => {
      const resp = await fetch(`${BASE}/api/reels?sortBy=postedAt&sortOrder=asc&limit=200`);
      if (!resp.ok) throw new Error("Failed to load reels");
      return resp.json();
    },
  });

  const { data: postingTimesData } = useQuery<{ hours: HourStat[]; bestHour: HourStat | null; totalReels: number }>({
    queryKey: ["posting-times"],
    queryFn: async () => {
      const resp = await fetch(`${BASE}/api/profile/posting-times`);
      if (!resp.ok) throw new Error("Failed to load posting times");
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

      {reelsData && reelsData.reels.length > 0 && (
        <PerformanceChart reels={reelsData.reels} />
      )}

      {postingTimesData && postingTimesData.hours.length > 0 && (
        <PostingTimesChart hours={postingTimesData.hours} bestHour={postingTimesData.bestHour} />
      )}

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
