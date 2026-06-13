import { useEffect, useState } from "react";
import { Play } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function proxyUrl(url: string) {
  return `${BASE}/api/media-proxy?url=${encodeURIComponent(url)}`;
}

function extractShortcode(permalink?: string | null): string | null {
  if (!permalink) return null;
  return permalink.match(/instagram\.com\/(?:reel|p)\/([A-Za-z0-9_-]+)/)?.[1] ?? null;
}

function freshThumbUrl(shortcode: string) {
  return `${BASE}/api/instagram/thumbnail?shortcode=${encodeURIComponent(shortcode)}`;
}

interface VideoThumbProps {
  thumbnailUrl?: string | null;
  videoUrl?: string | null;
  /** Reel permalink — used to fetch a fresh thumbnail when CDN URL expires */
  permalink?: string | null;
  className?: string;
}

/**
 * Shows a thumbnail for a reel. Fallback chain:
 *  1. Proxied CDN thumbnailUrl  (fast, breaks when CDN URL expires)
 *  2. Fresh thumbnail via og:image scrape  (server fetches a live URL from IG page)
 *  3. First video frame captured from proxied videoUrl
 *  4. Dark placeholder with play icon
 */
export function VideoThumb({ thumbnailUrl, videoUrl, permalink, className = "" }: VideoThumbProps) {
  const shortcode = extractShortcode(permalink);
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [stage, setStage] = useState<"thumb" | "fresh" | "video" | "failed">("thumb");

  useEffect(() => {
    setFrameUrl(null);
    setStage(thumbnailUrl ? "thumb" : shortcode ? "fresh" : videoUrl ? "video" : "failed");
  }, [thumbnailUrl, videoUrl, permalink]);

  // Stage 1: try proxied CDN thumbnail
  if (stage === "thumb" && thumbnailUrl) {
    return (
      <img
        src={proxyUrl(thumbnailUrl)}
        alt="thumbnail"
        className={`w-full h-full object-cover ${className}`}
        onError={() => setStage(shortcode ? "fresh" : videoUrl ? "video" : "failed")}
      />
    );
  }

  // Stage 2: fetch a fresh thumbnail via server-side og:image scrape
  if (stage === "fresh" && shortcode) {
    return (
      <img
        src={freshThumbUrl(shortcode)}
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
