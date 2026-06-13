import { useState } from "react";
import {
  useListReels,
  getListReelsQueryKey,
  useAnalyzeReelLoudness,
  useAnalyzeAllLoudness,
} from "@workspace/api-client-react";
import { Link } from "wouter";
import { formatNumber, formatDate } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InlinePlayer } from "@/components/inline-player";
import { VideoThumb } from "@/components/video-thumb";
import { PlaySquare, Filter, Play, LayoutGrid, Volume2, Loader2, CheckCircle2, AlertTriangle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ListReelsSortBy, ListReelsSortOrder, Reel } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

type ViewMode = "grid" | "loudness";

// ── True Peak helpers ─────────────────────────────────────────────────────────

function peakColor(tp: number): string {
  if (tp > -1)  return "#ef4444";  // red — clipping risk
  if (tp > -3)  return "#f97316";  // orange — hot
  if (tp > -6)  return "#f59e0b";  // amber — moderate
  return "#22c55e";                 // green — safe headroom
}

function peakLabel(tp: number): string {
  if (tp > -1)  return "Clipping";
  if (tp > -3)  return "Hot";
  if (tp > -6)  return "Moderate";
  return "Safe";
}

// Maps -20 dBTP → 0%, 0 dBTP → 100% (hotter = wider = more danger visible)
function peakBarPct(tp: number): number {
  return Math.min(100, Math.max(1, ((tp + 20) / 20) * 100));
}

// Danger zone marker at -1 dBTP = 95% along the bar
const DANGER_MARKER_PCT = (19 / 20) * 100;

// ── LoudnessRow ──────────────────────────────────────────────────────────────

function LoudnessRow({ reel, onAnalyzed }: { reel: Reel; onAnalyzed: () => void }) {
  const analyze   = useAnalyzeReelLoudness({ mutation: { onSuccess: onAnalyzed } });
  const hasData   = reel.lufsTruePeak != null;
  const tp        = reel.lufsTruePeak ?? null;
  const color     = tp != null ? peakColor(tp) : "#52525b";
  const barPct    = tp != null ? peakBarPct(tp) : 0;
  const isRunning = analyze.isPending;

  return (
    <div className="flex items-center gap-4 py-3 px-4 rounded-lg bg-card border border-border hover:border-primary/30 transition-colors">
      {/* thumbnail */}
      <div className="w-10 h-14 flex-none rounded overflow-hidden bg-zinc-900">
        <VideoThumb thumbnailUrl={reel.thumbnailUrl} videoUrl={reel.mediaUrl} permalink={reel.permalink} />
      </div>

      {/* caption + date */}
      <div className="w-36 flex-none hidden md:block">
        <p className="text-xs text-card-foreground line-clamp-2 leading-tight">
          {reel.caption || "No caption"}
        </p>
        <p className="text-[10px] font-mono text-muted-foreground mt-1">{formatDate(reel.postedAt)}</p>
      </div>

      {/* danger meter bar */}
      <div className="flex-1 min-w-0">
        {hasData ? (
          <div className="space-y-1">
            <div className="relative h-5 w-full bg-zinc-800 rounded-full overflow-visible">
              {/* filled bar — wider = hotter = more danger */}
              <div
                className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
                style={{ width: `${barPct}%`, backgroundColor: color }}
              />
              {/* -1 dBTP danger line */}
              <div
                className="absolute top-0 h-full w-px bg-white/40 z-10"
                style={{ left: `${DANGER_MARKER_PCT}%` }}
              />
            </div>
            <div className="relative h-3 flex">
              <div className="flex-1" />
              <div
                className="absolute flex flex-col items-center"
                style={{ left: `${DANGER_MARKER_PCT}%`, transform: "translateX(-50%)" }}
              >
                <span className="text-[8px] font-mono text-white/30">−1 limit</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-5 w-full bg-zinc-800/50 rounded-full border border-dashed border-zinc-700" />
        )}
      </div>

      {/* True Peak — primary metric */}
      <div className="w-44 flex-none text-right space-y-0.5">
        {hasData ? (
          <>
            <div className="flex items-center justify-end gap-1.5">
              <span
                className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                style={{ backgroundColor: `${color}22`, color }}
              >
                {peakLabel(tp!)}
              </span>
              <span className="text-lg font-bold tabular-nums" style={{ color }}>
                {tp!.toFixed(1)}
              </span>
              <span className="text-[10px] text-muted-foreground">dBTP</span>
            </div>
            <div className="flex items-center justify-end gap-3 text-[10px] font-mono text-muted-foreground">
              <span>LRA {reel.lufsRange?.toFixed(1) ?? "—"} LU</span>
              <span>{reel.lufsIntegrated?.toFixed(1) ?? "—"} LUFS</span>
            </div>
          </>
        ) : (
          <span className="text-[11px] text-muted-foreground/50">Not analyzed</span>
        )}
      </div>

      {/* action */}
      <div className="w-16 flex-none flex justify-end">
        {isRunning ? (
          <Loader2 className="w-4 h-4 text-primary animate-spin" />
        ) : hasData ? (
          <button
            onClick={() => analyze.mutate({ id: reel.id })}
            title="Re-analyze"
            className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" />
          </button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11px] px-2"
            onClick={() => analyze.mutate({ id: reel.id })}
          >
            Analyze
          </Button>
        )}
      </div>
    </div>
  );
}

// ── LoudnessView ─────────────────────────────────────────────────────────────

function LoudnessView({ reels, onRefresh }: { reels: Reel[]; onRefresh: () => void }) {
  const analyzeAll = useAnalyzeAllLoudness({ mutation: { onSuccess: onRefresh } });

  const analyzed  = reels.filter((r) => r.lufsTruePeak != null);
  const pending   = reels.filter((r) => r.lufsAnalyzedAt == null && r.mediaUrl);

  // Sort hottest first (closest to 0 = most dangerous at top)
  const sorted = [...reels].sort((a, b) => {
    const tpA = a.lufsTruePeak ?? -999;
    const tpB = b.lufsTruePeak ?? -999;
    return tpB - tpA;
  });

  const hottest  = analyzed.length > 0 ? Math.max(...analyzed.map((r) => r.lufsTruePeak!)) : null;
  const avgPeak  = analyzed.length > 0 ? analyzed.reduce((s, r) => s + r.lufsTruePeak!, 0) / analyzed.length : null;
  const clipping = analyzed.filter((r) => r.lufsTruePeak! > -1).length;
  const hot      = analyzed.filter((r) => r.lufsTruePeak! > -3 && r.lufsTruePeak! <= -1).length;

  return (
    <div className="space-y-5">
      {/* summary strip */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-6 flex-wrap">
          {hottest != null && (
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Hottest Peak</p>
              <p className="text-2xl font-bold tabular-nums" style={{ color: peakColor(hottest) }}>
                {hottest.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">dBTP</span>
              </p>
            </div>
          )}
          {avgPeak != null && (
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Avg Peak</p>
              <p className="text-2xl font-bold tabular-nums" style={{ color: peakColor(avgPeak) }}>
                {avgPeak.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">dBTP</span>
              </p>
            </div>
          )}
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Analyzed</p>
            <p className="text-2xl font-bold tabular-nums">
              {analyzed.length} <span className="text-sm font-normal text-muted-foreground">/ {reels.length}</span>
            </p>
          </div>
          {clipping > 0 && (
            <div className="flex items-center gap-1.5 text-red-400 self-end pb-1">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-mono font-bold">{clipping} clipping</span>
            </div>
          )}
          {hot > 0 && (
            <div className="flex items-center gap-1.5 text-orange-400 self-end pb-1">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-mono">{hot} hot</span>
            </div>
          )}
        </div>

        {pending.length > 0 && (
          <Button onClick={() => analyzeAll.mutate()} disabled={analyzeAll.isPending} className="gap-2">
            {analyzeAll.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing…</>
            ) : (
              <><Zap className="w-4 h-4" /> Analyze All ({pending.length})</>
            )}
          </Button>
        )}
      </div>

      {/* reference info */}
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground bg-card border rounded-lg px-4 py-2.5">
        <Volume2 className="w-3.5 h-3.5 flex-none" />
        <span>
          True Peak measures the absolute loudest sample. Keep below{" "}
          <strong className="text-foreground">−1 dBTP</strong> — platform re-encoding can push peaks up by 1–2 dB,
          so anything already near 0 will clip after Instagram/TikTok processes it.{" "}
          <span className="text-green-400">≤−6</span> is safe,{" "}
          <span className="text-amber-400">−3 to −6</span> moderate,{" "}
          <span className="text-orange-400">−1 to −3</span> hot,{" "}
          <span className="text-red-400">&gt;−1</span> clipping risk.
        </span>
      </div>

      {/* rows — sorted hottest first */}
      <div className="space-y-2">
        {sorted.map((reel) => (
          <LoudnessRow key={reel.id} reel={reel} onAnalyzed={onRefresh} />
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReelsLog() {
  const [sortBy, setSortBy]   = useState<ListReelsSortBy>("likeCount");
  const [sortOrder, setSortOrder] = useState<ListReelsSortOrder>("desc");
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [viewMode, setViewMode]   = useState<ViewMode>("grid");

  const queryClient = useQueryClient();
  const qKey = getListReelsQueryKey({ sortBy, sortOrder, limit: 500 });

  const { data, isLoading } = useListReels({ sortBy, sortOrder, limit: 500 }, {
    query: { queryKey: qKey },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: getListReelsQueryKey({ sortBy, sortOrder, limit: 500 }) });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Reels Log</h1>
          <p className="text-muted-foreground text-sm">Your complete content history.</p>
        </div>

        <div className="flex items-center gap-2">
          {/* view toggle */}
          <div className="flex items-center bg-card border rounded-md p-1 gap-0.5">
            <button
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono transition-colors ${
                viewMode === "grid"
                  ? "bg-primary text-black"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Grid
            </button>
            <button
              onClick={() => setViewMode("loudness")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono transition-colors ${
                viewMode === "loudness"
                  ? "bg-primary text-black"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Volume2 className="w-3.5 h-3.5" /> Loudness
            </button>
          </div>

          {/* sort — only in grid mode */}
          {viewMode === "grid" && (
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
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="aspect-[9/16] w-full rounded-xl" />
          ))}
        </div>
      ) : viewMode === "loudness" ? (
        <LoudnessView reels={data?.reels ?? []} onRefresh={refresh} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {data?.reels.map((reel) => {
            const isPlaying = playingId === reel.id;
            return (
              <Card key={reel.id} className="overflow-hidden bg-card hover:border-primary/50 transition-colors group cursor-pointer h-full flex flex-col hover-elevate">
                <div className="aspect-[9/16] relative bg-muted border-b border-border">
                  {isPlaying ? (
                    <InlinePlayer
                      mediaUrl={reel.mediaUrl}
                      thumbnailUrl={reel.thumbnailUrl}
                      instagramUrl={reel.permalink}
                      onClose={() => setPlayingId(null)}
                      className="absolute inset-0"
                    />
                  ) : (
                    <>
                      <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-105">
                        <VideoThumb thumbnailUrl={reel.thumbnailUrl} videoUrl={reel.mediaUrl} permalink={reel.permalink} />
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                      <div className="absolute top-2 right-2">
                        <StatusBadge status={reel.performanceStatus} />
                      </div>

                      {/* True Peak badge */}
                      {reel.lufsTruePeak != null && (
                        <div className="absolute bottom-2 left-2">
                          <span
                            className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-black/70"
                            style={{ color: peakColor(reel.lufsTruePeak) }}
                          >
                            {reel.lufsTruePeak.toFixed(1)} TP
                          </span>
                        </div>
                      )}

                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setPlayingId(reel.id);
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
                    </>
                  )}
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
            );
          })}
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
