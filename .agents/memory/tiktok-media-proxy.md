---
name: TikTok media proxy
description: TikTok CDN hostnames needed in the media-proxy allowlist for thumbnails to load
---

## Rule
The media proxy at `artifacts/api-server/src/routes/media-proxy.ts` has an `ALLOWED_HOSTS` allowlist. TikTok thumbnail/video CDN hostnames must be in this list or all TikTok media returns 403.

Required entries: `tiktokcdn.com`, `tiktokcdn-us.com`, `tiktok.com`.

**Why:** The frontend `VideoThumb` component proxies all CDN URLs through `/api/media-proxy`. Without the TikTok hostnames in ALLOWED_HOSTS, the proxy rejects them with 403, causing thumbnails to fall through to the grey placeholder.

**How to apply:** Whenever a new media source is added (e.g. YouTube Shorts, Pinterest), add its CDN hostname to ALLOWED_HOSTS in `media-proxy.ts`.
