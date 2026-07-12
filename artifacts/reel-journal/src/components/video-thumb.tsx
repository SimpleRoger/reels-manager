import { useEffect, useState } from "react";
import { Play } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function proxyUrl(url: string) {
  if (url.startsWith("data:") || url.startsWith("/api/")) return `${BASE}${url}`;
  return `${BASE}/api/media-proxy?url=${encodeURIComponent(url)}`;
}

function extractShortcode(permalink?: string | null): string | null {
  if (!permalink) return null;
  return permalink.match(/instagram\.com\/(?:reel|p)\/([A-Za-z0-9_-]+)/)?.[1] ?? null;
}

function extractInstagramId(permalink?: string | null): string | null {
  return extractShortcode(permalink);
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
  /** Source URL (reel permalink / TikTok URL) — used to fetch a fresh thumbnail when CDN expires */
  permalink?: string | null;
  /** Instagram media ID — used to refresh thumbnail via Graph API when CDN URL expires */
  instagramId?: string | null;
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
 *  1. Proxied CDN thumbnailUrl  (fast, breaks when CDN URL expires)
 *  2. Fresh thumbnail via Graph API refresh (Instagram only — updates DB too)
 *  3. First video frame captured from proxied videoUrl
 *  4. Dark placeholder with play icon
 */
export function VideoThumb({ thumbnailUrl, videoUrl, permalink, instagramId, className = "" }: VideoThumbProps) {
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [freshUrl, setFreshUrl] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>(initialStage(thumbnailUrl, videoUrl));

  useEffect(() => {
    setFrameUrl(null);
    setFreshUrl(null);
    setStage(initialStage(thumbnailUrl, videoUrl));
  }, [thumbnailUrl, videoUrl, permalink, instagramId]);

  const handleThumbError = () => {
    // For Instagram reels, fetch a fresh URL from Graph API (updates DB too)
    const id = instagramId ?? (permalink ? extractInstagramId(permalink) : null);
    if (id && isInstagram(permalink ?? "")) {
      fetch(`${BASE}/api/instagram/fresh-thumbnail/${encodeURIComponent(id)}`)
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
    } else if (isTikTok(permalink)) {
      // For TikTok, fall through to og:image scrape via the existing thumbnail endpoint
      const url = `${BASE}/api/instagram/thumbnail?url=${encodeURIComponent(permalink!)}`;
      setFreshUrl(url);
      setStage("graph-api");
    } else {
      setStage(videoUrl ? "video" : "failed");
    }
  };

  // Stage 1: try proxied CDN thumbnail
  if (stage === "thumb" && thumbnailUrl) {
    return (
      <img
        src={proxyUrl(thumbnailUrl)}
        alt="thumbnail"
        className={`w-full h-full object-cover ${className}`}
        onError={handleThumbError}
      />
    );
  }

  // Stage 2: fresh URL from Graph API (or TikTok og:image)
  if (stage === "graph-api" && freshUrl) {
    return (
      <img
        src={proxyUrl(freshUrl)}
        alt="thumbnail"
        className={`w-full h-full object-cover ${className}`}
        onError={() => setStage(videoUrl ? "video" : "failed")}
      />
    );
  }

  // Stage 3: capture first frame from proxied video
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
    return <img src={frameUrl} alt="thumbnail" className={`w-full h-full object-cover ${className}`} />;
  }

  return <div className={`w-full h-full bg-zinc-900 animate-pulse ${className}`} />;
}
