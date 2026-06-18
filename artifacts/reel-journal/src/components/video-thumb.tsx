import { useEffect, useState } from "react";
import { Play } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function proxyUrl(url: string) {
  // Data URLs and same-server /api/ paths need no proxy
  if (url.startsWith("data:") || url.startsWith("/api/")) return `${BASE}${url}`;
  return `${BASE}/api/media-proxy?url=${encodeURIComponent(url)}`;
}

function extractShortcode(permalink?: string | null): string | null {
  if (!permalink) return null;
  return permalink.match(/instagram\.com\/(?:reel|p)\/([A-Za-z0-9_-]+)/)?.[1] ?? null;
}

function isTikTok(permalink?: string | null): boolean {
  return !!permalink && permalink.includes("tiktok.com");
}

/** URL that fetches a fresh thumbnail — Instagram via og:image scrape, TikTok via embed resolution */
function freshThumbUrl(permalink: string): string {
  const shortcode = extractShortcode(permalink);
  if (shortcode) {
    return `${BASE}/api/instagram/thumbnail?shortcode=${encodeURIComponent(shortcode)}`;
  }
  // TikTok or other: pass the full URL and let the server resolve it
  return `${BASE}/api/instagram/thumbnail?url=${encodeURIComponent(permalink)}`;
}

interface VideoThumbProps {
  thumbnailUrl?: string | null;
  videoUrl?: string | null;
  /** Source URL (reel permalink / TikTok URL) — used to fetch a fresh thumbnail when CDN expires */
  permalink?: string | null;
  className?: string;
}

type Stage = "thumb" | "fresh" | "video" | "failed";

function initialStage(thumbnailUrl?: string | null, permalink?: string | null, videoUrl?: string | null): Stage {
  if (thumbnailUrl) return "thumb";
  if (permalink) return "fresh";
  if (videoUrl) return "video";
  return "failed";
}

/**
 * Shows a thumbnail for a reel/TikTok. Fallback chain:
 *  1. Proxied CDN thumbnailUrl  (fast, breaks when CDN URL expires)
 *  2. Fresh thumbnail via server scrape (Instagram og:image or TikTok resolution)
 *  3. First video frame captured from proxied videoUrl
 *  4. Dark placeholder with play icon
 */
export function VideoThumb({ thumbnailUrl, videoUrl, permalink, className = "" }: VideoThumbProps) {
  const canFresh = !!permalink && (!!extractShortcode(permalink) || isTikTok(permalink));
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>(initialStage(thumbnailUrl, canFresh ? permalink : null, videoUrl));

  useEffect(() => {
    setFrameUrl(null);
    setStage(initialStage(thumbnailUrl, canFresh ? permalink : null, videoUrl));
  }, [thumbnailUrl, videoUrl, permalink]);

  // Stage 1: try proxied CDN thumbnail
  if (stage === "thumb" && thumbnailUrl) {
    return (
      <img
        src={proxyUrl(thumbnailUrl)}
        alt="thumbnail"
        className={`w-full h-full object-cover ${className}`}
        onError={() => setStage(canFresh ? "fresh" : videoUrl ? "video" : "failed")}
      />
    );
  }

  // Stage 2: fetch a fresh thumbnail via server-side scrape (Instagram og:image or TikTok)
  if (stage === "fresh" && permalink && canFresh) {
    return (
      <img
        src={freshThumbUrl(permalink)}
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
