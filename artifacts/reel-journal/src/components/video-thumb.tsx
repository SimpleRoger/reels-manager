import { useEffect, useState } from "react";
import { Play } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function proxyUrl(url: string) {
  return `${BASE}/api/media-proxy?url=${encodeURIComponent(url)}`;
}

interface VideoThumbProps {
  /** CDN thumbnail image URL — tried first via proxy */
  thumbnailUrl?: string | null;
  /** CDN video URL — used to capture a frame if thumbnail fails */
  videoUrl?: string | null;
  className?: string;
}

/**
 * Shows a thumbnail for a reel when the direct CDN URL is blocked by CORP.
 * Strategy:
 *  1. Try to load thumbnailUrl through the server proxy (strips CORP headers)
 *  2. If that fails, try to capture the first video frame through the server proxy
 *  3. Fall back to a dark placeholder with a play icon
 */
export function VideoThumb({ thumbnailUrl, videoUrl, className = "" }: VideoThumbProps) {
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [stage, setStage] = useState<"thumb" | "video" | "failed">("thumb");

  useEffect(() => {
    setFrameUrl(null);
    setStage(thumbnailUrl ? "thumb" : videoUrl ? "video" : "failed");
  }, [thumbnailUrl, videoUrl]);

  // Stage 1: try proxied thumbnail image
  if (stage === "thumb" && thumbnailUrl) {
    return (
      <img
        src={proxyUrl(thumbnailUrl)}
        alt="thumbnail"
        className={`w-full h-full object-cover ${className}`}
        onError={() => setStage(videoUrl ? "video" : "failed")}
      />
    );
  }

  // Stage 2: try to capture first frame from proxied video
  if (stage === "video" && videoUrl) {
    return <VideoFrameCapture videoUrl={videoUrl} className={className} onFail={() => setStage("failed")} onCapture={setFrameUrl} frameUrl={frameUrl} />;
  }

  // Stage 3: plain dark fallback
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

  // While loading show shimmer
  return <div className={`w-full h-full bg-zinc-900 animate-pulse ${className}`} />;
}
