import { useEffect, useState } from "react";
import { Play } from "lucide-react";

// API server base — needed for proxy/fresh-thumbnail calls.
// VITE_API_URL is set in production; falls back to same-origin for local dev.
const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

function proxyUrl(url: string) {
  if (url.startsWith("data:")) return url;
  return `${API_BASE}/api/media-proxy?url=${encodeURIComponent(url)}`;
}

function extractShortcode(permalink?: string | null): string | null {
  if (!permalink) return null;
  return permalink.match(/instagram\.com\/(?:reel|p)\/([A-Za-z0-9_-]+)/)?.[1] ?? null;
}

function isTikTok(permalink?: string | null): boolean {
  return !!permalink && permalink.includes("tiktok.com");
}

function isInstagram(permalink?: string | null): boolean {
  return !!permalink && permalink.includes("instagram.com");
}

interface VideoThumbProps {
  thumbnailUrl?: string | null;
  videoUrl?: string | null;
  permalink?: string | null;
  instagramId?: string | null;
  referenceId?: number | null;
  className?: string;
}

type Stage = "thumb" | "graph-api" | "video" | "failed";

function initialStage(thumbnailUrl?: string | null, videoUrl?: string | null): Stage {
  if (thumbnailUrl) return "thumb";
  if (videoUrl) return "video";
  return "failed";
}

/**
 * Shows a thumbnail for a reel/TikTok. Fallback chain:
 *  1. Direct CDN thumbnailUrl  (fast, img loads without proxy — no CORS issues)
 *  2. Fresh thumbnail via Graph API refresh (Instagram only — updates DB too)
 *  3. First video frame captured from proxied videoUrl
 *  4. Dark placeholder with play icon
 */
export function VideoThumb({ thumbnailUrl, videoUrl, permalink, instagramId, referenceId, className = "" }: VideoThumbProps) {
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [freshUrl, setFreshUrl] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>(initialStage(thumbnailUrl, videoUrl));

  useEffect(() => {
    setFrameUrl(null);
    setFreshUrl(null);
    setStage(initialStage(thumbnailUrl, videoUrl));
  }, [thumbnailUrl, videoUrl, permalink, instagramId]);

  const handleThumbError = () => {
    const id = instagramId;
    if (id && (isInstagram(permalink) || id.match(/^\d+$/))) {
      // Own reel — refresh via Graph API (has instagramId)
      fetch(`${API_BASE}/api/instagram/fresh-thumbnail/${encodeURIComponent(id)}`)
        .then((r) => r.json())
        .then((data: { thumbnailUrl?: string | null }) => {
          if (data.thumbnailUrl) {
            setFreshUrl(data.thumbnailUrl);
            setStage("graph-api");
          } else {
            setStage(videoUrl ? "video" : "failed");
          }
        })
        .catch(() => setStage(videoUrl ? "video" : "failed"));
    } else if (referenceId) {
      // Saved reference — refresh thumbnail via snapsave (works for IG + TikTok)
      fetch(`${API_BASE}/api/references/${referenceId}/refresh-thumbnail`, { method: "POST" })
        .then((r) => r.ok ? r.json() : null)
        .then((data: { thumbnailUrl?: string | null } | null) => {
          if (data?.thumbnailUrl) {
            setFreshUrl(data.thumbnailUrl);
            setStage("graph-api");
          } else {
            setStage(videoUrl ? "video" : "failed");
          }
        })
        .catch(() => setStage(videoUrl ? "video" : "failed"));
    } else if (isTikTok(permalink)) {
      const url = `${API_BASE}/api/instagram/thumbnail?url=${encodeURIComponent(permalink!)}`;
      setFreshUrl(url);
      setStage("graph-api");
    } else {
      setStage(videoUrl ? "video" : "failed");
    }
  };

  // Stage 1: load CDN thumbnail directly (no proxy — <img> doesn't need CORS)
  if (stage === "thumb" && thumbnailUrl) {
    return (
      <img
        src={thumbnailUrl}
        alt=""
        className={`w-full h-full object-cover ${className}`}
        onError={handleThumbError}
      />
    );
  }

  // Stage 2: fresh URL from Graph API
  if (stage === "graph-api" && freshUrl) {
    return (
      <img
        src={freshUrl}
        alt=""
        className={`w-full h-full object-cover ${className}`}
        onError={() => setStage(videoUrl ? "video" : "failed")}
      />
    );
  }

  // Stage 3: capture first frame from proxied video (needs proxy for CORS/canvas)
  if (stage === "video" && videoUrl) {
    return <VideoFrameCapture videoUrl={videoUrl} className={className} onFail={() => setStage("failed")} onCapture={setFrameUrl} frameUrl={frameUrl} />;
  }

  // Stage 4: dark fallback
  return (
    <div className={`w-full h-full flex items-center justify-center bg-zinc-900 ${className}`}>
      <Play className="w-10 h-10 text-muted-foreground/30" />
    </div>
  );
}

interface FrameCaptureProps {
  videoUrl: string;
  frameUrl: string | null;
  onCapture: (url: string) => void;
  onFail: () => void;
  className?: string;
}

function VideoFrameCapture({ videoUrl, frameUrl, onCapture, onFail, className = "" }: FrameCaptureProps) {
  useEffect(() => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.src = proxyUrl(videoUrl);

    const cleanup = () => { video.src = ""; video.load(); };

    const onSeeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 568;
        const ctx = canvas.getContext("2d");
        if (!ctx) { onFail(); cleanup(); return; }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        if (dataUrl.length < 500) { onFail(); cleanup(); return; }
        onCapture(dataUrl);
        cleanup();
      } catch {
        onFail();
        cleanup();
      }
    };

    video.addEventListener("loadedmetadata", () => {
      video.currentTime = Math.min(0.5, video.duration || 0);
    });
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", () => { onFail(); cleanup(); });
    video.load();

    return cleanup;
  }, [videoUrl]);

  if (frameUrl) {
    return <img src={frameUrl} alt="" className={`w-full h-full object-cover ${className}`} />;
  }

  return <div className={`w-full h-full bg-zinc-900 animate-pulse ${className}`} />;
}
