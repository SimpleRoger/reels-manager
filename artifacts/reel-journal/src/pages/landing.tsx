import { Link } from "wouter";
import { Bookmark, Play, FileText, FolderOpen, Bell, Smartphone, Instagram, Youtube } from "lucide-react";
import { SiTiktok, SiReddit } from "react-icons/si";

const PLATFORMS = [
  { Icon: Instagram, label: "Instagram" },
  { Icon: SiTiktok, label: "TikTok" },
  { Icon: Youtube, label: "YouTube" },
  { Icon: SiReddit, label: "Reddit" },
];

const FEATURES = [
  {
    icon: Bookmark,
    title: "Everything in one place",
    body: "Your saves from Instagram, TikTok, YouTube, and Reddit, all in one library. No jumping between apps, no getting sucked into the feed.",
  },
  {
    icon: Play,
    title: "Watch it anytime",
    body: "Videos are stored permanently so you can watch them whenever you want, even if the original post gets deleted.",
  },
  {
    icon: FileText,
    title: "Summarise content",
    body: "Get a quick summary of any video or post so you can decide what's worth your full attention without sitting through everything.",
  },
  {
    icon: FolderOpen,
    title: "Stay organised",
    body: "Tag, sort, and search everything you've saved. Find that recipe, workout, or idea you bookmarked three months ago in seconds.",
  },
  {
    icon: Bell,
    title: "Subscribe to channels",
    body: "Follow your favourite YouTube channels, creators, or subreddits. New content lands in your library automatically. No algorithm, no noise.",
  },
  {
    icon: Smartphone,
    title: "Web & mobile",
    body: "Use Reel Journal in your browser or on your iPhone. Your saved content syncs instantly across every device you own.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: "var(--app-font-sans)" }}>
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 border-b border-border max-w-6xl mx-auto">
        <span className="font-bold text-lg tracking-tight">
          REEL <span className="text-primary">JOURNAL</span>
        </span>
        <Link href="/calendar">
          <span className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold cursor-pointer hover:opacity-90 transition-opacity">
            Open App →
          </span>
        </Link>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 flex flex-col items-center text-center gap-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-medium tracking-widest uppercase">
          One place · No distractions
        </div>
        <h1 className="text-5xl md:text-7xl font-bold leading-tight tracking-tight max-w-3xl" style={{ textWrap: "balance" }}>
          Your saves.<br />
          <span className="text-primary">One place. No feed.</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl" style={{ textWrap: "balance" }}>
          All your saved content. One place. No feed.
        </p>
        <div className="flex items-center gap-3 pt-2">
          <Link href="/calendar">
            <span className="px-6 py-3 rounded-md bg-primary text-primary-foreground font-semibold cursor-pointer hover:opacity-90 transition-opacity">
              Start saving for free
            </span>
          </Link>
        </div>
      </section>

      {/* Platform strip */}
      <section className="border-y border-border bg-card py-10">
        <p className="text-center text-xs text-muted-foreground uppercase tracking-widest mb-6">Works with</p>
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-center gap-12 flex-wrap">
          {PLATFORMS.map(({ Icon, label }) => (
            <div key={label} className="flex items-center gap-2.5 text-muted-foreground">
              <Icon size={22} />
              <span className="text-sm font-medium">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* The Problem */}
      <section className="max-w-3xl mx-auto px-6 py-24 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-4">The problem</p>
        <h2 className="text-3xl md:text-4xl font-bold mb-6" style={{ textWrap: "balance" }}>
          You already save content. You just never watch it.
        </h2>
        <p className="text-muted-foreground text-lg leading-relaxed" style={{ textWrap: "balance" }}>
          Every platform has a save button. But going back to watch that video means opening Instagram, getting hit with the feed, and losing 45 minutes you didn't plan to spend. Your saves are scattered across four different apps and you forget they even exist.
        </p>
      </section>

      {/* Enter Reel Journal */}
      <section className="border-t border-border bg-card py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-4">Enter Reel Journal</p>
          <h2 className="text-3xl md:text-4xl font-bold mb-6" style={{ textWrap: "balance" }}>
            One library. Every platform. Zero distraction.
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed" style={{ textWrap: "balance" }}>
            Reel Journal pulls your saved content from Instagram, TikTok, YouTube, and Reddit into a single, clean library. Watch, summarise, and organise everything without ever touching a feed.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-3" style={{ textWrap: "balance" }}>
            Your content, under control
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            The internet moves fast. Reel Journal makes sure you never lose the things worth keeping.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-6 flex flex-col gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
                <Icon size={18} className="text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border bg-card py-24">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4" style={{ textWrap: "balance" }}>
            Save in two seconds, any way you like
          </h2>
          <p className="text-muted-foreground mb-16">On iOS, use the share sheet. On web, just paste a link. That's it.</p>

          <div className="grid md:grid-cols-2 gap-6 text-left">
            {/* iOS flow */}
            <div className="rounded-xl border border-border bg-background p-6 flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📱</span>
                <h3 className="font-bold text-lg">On iPhone</h3>
              </div>
              <div className="flex flex-col gap-4">
                {[
                  { step: "1", text: "Open any video in Instagram, TikTok, YouTube, or Reddit." },
                  { step: "2", text: 'Tap the Share button, then select "Reel Journal" from the list.' },
                  { step: "3", text: "Done. It's saved to your library instantly." },
                ].map(({ step, text }) => (
                  <div key={step} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full border-2 border-primary shrink-0 flex items-center justify-center text-primary text-xs font-bold mt-0.5">
                      {step}
                    </div>
                    <p className="text-sm text-muted-foreground">{text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Web flow */}
            <div className="rounded-xl border border-border bg-background p-6 flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🌐</span>
                <h3 className="font-bold text-lg">On web</h3>
              </div>
              <div className="flex flex-col gap-4">
                {[
                  { step: "1", text: "Find a video or post you want to keep on any platform." },
                  { step: "2", text: "Copy the link and paste it into Reel Journal." },
                  { step: "3", text: "We fetch and store the content so it's yours forever." },
                ].map(({ step, text }) => (
                  <div key={step} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full border-2 border-primary shrink-0 flex items-center justify-center text-primary text-xs font-bold mt-0.5">
                      {step}
                    </div>
                    <p className="text-sm text-muted-foreground">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 py-24 text-center">
        <h2 className="text-4xl font-bold mb-4" style={{ textWrap: "balance" }}>
          Watch what you saved.<br />Without opening the app.
        </h2>
        <p className="text-muted-foreground mb-8">Free to use. No credit card required.</p>
        <Link href="/calendar">
          <span className="px-8 py-3 rounded-md bg-primary text-primary-foreground font-semibold cursor-pointer hover:opacity-90 transition-opacity">
            Get started free →
          </span>
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-8 text-center text-xs text-muted-foreground">
        © 2026 Reel Journal · Save the internet, one link at a time
      </footer>
    </div>
  );
}
