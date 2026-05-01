import { useRef, useEffect } from "react";
import { X } from "lucide-react";

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

export function InlinePlayer({ mediaUrl, thumbnailUrl, instagramUrl, onClose, className = "" }: InlinePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    videoRef.current?.play().catch(() => {});
  }, []);

  const shortcode = extractShortcode(instagramUrl);

  return (
    <div className={`relative bg-black w-full h-full ${className}`}>
      {/* Close button */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-2 right-2 z-20 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white/80 hover:text-white hover:bg-black/80 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      {shortcode ? (
        // Instagram's own embed player — handles auth, adaptive streaming, and CORS correctly
        <iframe
          src={`https://www.instagram.com/reel/${shortcode}/embed/`}
          className="w-full h-full"
          style={{ border: "none" }}
          allowFullScreen
          scrolling="no"
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
        />
      ) : mediaUrl ? (
        // Fallback: direct video element when no Instagram URL is available
        <video
          ref={videoRef}
          src={mediaUrl}
          poster={thumbnailUrl ?? undefined}
          controls
          playsInline
          preload="auto"
          className="w-full h-full object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-white/40 text-xs font-mono">
          No video available
        </div>
      )}
    </div>
  );
}
