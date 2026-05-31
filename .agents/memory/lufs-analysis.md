---
name: LUFS analysis quirks
description: How to correctly run ffmpeg ebur128 LUFS analysis on Instagram CDN video URLs
---

## Rule
When running `ffmpeg ebur128` on Instagram CDN media URLs:
1. **Download to temp file first** — do NOT pipe from stdin. MP4 containers need seeking; stdin is non-seekable so ffmpeg can't find the moov atom or produces -70 LUFS (absolute gate floor).
2. **Parse the Summary block only** — the per-frame output also contains `I: -70.0 LUFS` entries early in the file. Regex must extract from `Summary:([\s\S]+)$` first, then match `I:` within that block.
3. **True peak label is `dBFS` not `dBTP`** in the summary — regex should match `\bPeak:\s+([-\d.]+)\s+dB`.

**Why:** Instagram CDN serves progressive MP4 where moov is not always at the start; even with faststart, piping prevents seeking. Per-frame ebur128 lines start at -70 LUFS (below gate) and converge to real value — matching first `I:` gives wrong result.

**How to apply:** Any route that runs ffmpeg ebur128 on a remote URL should: `fetch(url) → writeFile(tmp) → spawn ffmpeg -i tmpFile → parse Summary block → unlink(tmp)`.

Temp file cleanup: use try/finally with `unlink(tmpFile, () => {})`.
