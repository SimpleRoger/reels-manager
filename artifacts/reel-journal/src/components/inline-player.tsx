import { useRef, useEffect, useState } from "react";
import { X, ExternalLink } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface InlinePlayerProps {
  mediaUrl?: string | null;
  thumbnailUrl?: string | null;
  instagramUrl?: string | null;
  onClose: () => void;
  className?: string;
}

function extractShortcode(url?: string | null): string | null {
  if (!url) return null;
  return url.match(/instagram\.com\/(?:reel|p)\/([A-Za-z0-9_-]+)/)?.[1] ?? null;
}

function isTikTok(url?: string | null): boolean {
  return !!url && url.includes("tiktok.com");
}

export function InlinePlayer({ mediaUrl, thumbnailUrl, instagramUrl, onClose, className = "" }: InlinePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const [tiktokEmbedUrl, setTiktokEmbedUrl] = useState<string | null>(null);
  const [tiktokResolveFailed, setTiktokResolveFailed] = useState(false);

  useEffect(() => {
    setVideoFailed(false);
    setTiktokEmbedUrl(null);
    setTiktokResolveFailed(false);
  }, [mediaUrl]);

  useEffect(() => {
    if (videoRef.current && mediaUrl && !videoFailed) {
      videoRef.current.play().catch(() => {});
    }
  }, [mediaUrl, videoFailed]);

  // When CDN video fails and the source is TikTok, resolve the embed URL server-side
  useEffect(() => {
    if (videoFailed && isTikTok(instagramUrl) && !tiktokEmbedUrl && !tiktokResolveFailed) {
      fetch(`${BASE}/api/references/tiktok-embed?url=${encodeURIComponent(instagramUrl!)}`)
        .then((r) => r.json())
        .then((d: { embedUrl?: string }) => {
          if (d.embedUrl) setTiktokEmbedUrl(d.embedUrl);
          else setTiktokResolveFailed(true);
        })
        .catch(() => setTiktokResolveFailed(true));
    }
  }, [videoFailed, instagramUrl]);

  const shortcode = extractShortcode(instagramUrl);
  const useDirectVideo = mediaUrl && !videoFailed;

  return (
    <div className={`relative bg-black w-full h-full ${className}`}>
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-2 right-2 z-20 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white/80 hover:text-white hover:bg-black/80 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      {useDirectVideo ? (
        <video
          ref={videoRef}
          src={mediaUrl}
          poster={thumbnailUrl ?? undefined}
          controls
          playsInline
          preload="auto"
          className="w-full h-full object-contain"
          onClick={(e) => e.stopPropagation()}
          onError={() => setVideoFailed(true)}
        />
      ) : shortcode ? (
        // Fallback: Instagram embed iframe
        <iframe
          src={`https://www.instagram.com/reel/${shortcode}/embed/`}
          className="w-full h-full"
          style={{ border: "none" }}
          allowFullScreen
          scrolling="no"
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
        />
      ) : tiktokEmbedUrl ? (
        // Fallback: TikTok embed iframe
        <iframe
          src={tiktokEmbedUrl}
          className="w-full h-full"
          style={{ border: "none" }}
          allowFullScreen
          scrolling="no"
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
        />
      ) : isTikTok(instagramUrl) && !tiktokResolveFailed ? (
        // Resolving TikTok embed URL…
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
        </div>
      ) : instagramUrl ? (
        // Last resort: open in browser
        <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-white/60">
          <p className="text-xs font-mono">Video unavailable — open in app</p>
          <a
            href={instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="w-3 h-3" /> Open original
          </a>
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center text-white/40 text-xs font-mono">
          No video available
        </div>
      )}
    </div>
  );
}
