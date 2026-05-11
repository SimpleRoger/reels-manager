import { useState, useRef } from "react";
import {
  useListCalendarPosts,
  useCreateCalendarPost,
  useUpdateCalendarPost,
  useDeleteCalendarPost,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus, Trash2, X, CheckSquare, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

// ─── Types ───────────────────────────────────────────────────────────────────

type AccountType = "ig_reel" | "clothing" | "dancing";
type Status = "idea" | "filmed" | "edited" | "posted";

interface CalendarPost {
  id: number;
  title: string;
  accountType: string;
  status: string;
  scheduledDate: string;
  hook?: string | null;
  caption?: string | null;
  outfit?: string | null;
  location?: string | null;
  audio?: string | null;
  notes?: string | null;
  result?: string | null;
  linkedReelId?: number | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCOUNT_CONFIG: Record<AccountType, { label: string; color: string; bg: string; border: string }> = {
  ig_reel: {
    label: "IG Reel",
    color: "text-orange-400",
    bg: "bg-orange-500/15",
    border: "border-orange-500/30",
  },
  clothing: {
    label: "Clothing",
    color: "text-violet-400",
    bg: "bg-violet-500/15",
    border: "border-violet-500/30",
  },
  dancing: {
    label: "Dancing",
    color: "text-rose-400",
    bg: "bg-rose-500/15",
    border: "border-rose-500/30",
  },
};

const STATUS_CONFIG: Record<Status, { label: string; color: string }> = {
  idea: { label: "Idea", color: "bg-zinc-600 text-zinc-200" },
  filmed: { label: "Filmed", color: "bg-blue-600/70 text-blue-100" },
  edited: { label: "Edited", color: "bg-amber-600/70 text-amber-100" },
  posted: { label: "Posted", color: "bg-emerald-600/70 text-emerald-100" },
};

// Recurring schedule: day of week (0=Sun) → account type
const SCHEDULE: Record<number, AccountType> = {
  0: "ig_reel",   // Sun
  2: "ig_reel",   // Tue
  3: "dancing",   // Wed
  4: "clothing",  // Thu
  6: "clothing",  // Sat
};

const SCHEDULE_ITEMS = [
  { day: "Tue", type: "ig_reel" as AccountType },
  { day: "Wed", type: "dancing" as AccountType },
  { day: "Thu", type: "clothing" as AccountType },
  { day: "Sat", type: "clothing" as AccountType },
  { day: "Sun", type: "ig_reel" as AccountType },
];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getMonthRange(year: number, month: number) {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return { start: toDateStr(start), end: toDateStr(end) };
}

// ─── Weekly Checklist ─────────────────────────────────────────────────────────

function getThisWeekDates(): Record<string, string> {
  const today = new Date();
  const dow = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dow + 6) % 7));

  const result: Record<string, string> = {};
  const dayMap: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  for (const [day] of Object.entries(dayMap)) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + dayMap[day]);
    result[day] = toDateStr(d);
  }
  return result;
}

interface WeeklyChecklistProps {
  posts: CalendarPost[];
}

function WeeklyChecklist({ posts }: WeeklyChecklistProps) {
  const weekDates = getThisWeekDates();
  const postsByDate = new Map<string, CalendarPost[]>();
  for (const p of posts) {
    const arr = postsByDate.get(p.scheduledDate) ?? [];
    arr.push(p);
    postsByDate.set(p.scheduledDate, arr);
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 shrink-0">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">This Week</p>
      <div className="space-y-2">
        {SCHEDULE_ITEMS.map(({ day, type }) => {
          const date = weekDates[day];
          const dayPosts = (date ? postsByDate.get(date) ?? [] : []).filter(
            (p) => p.accountType === type
          );
          const isPosted = dayPosts.some((p) => p.status === "posted");
          const hasPost = dayPosts.length > 0;
          const cfg = ACCOUNT_CONFIG[type];

          return (
            <div key={day} className="flex items-center gap-2.5">
              {isPosted ? (
                <CheckSquare className="h-4 w-4 text-emerald-400 shrink-0" />
              ) : (
                <Square className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <span className={`text-xs font-mono w-7 ${isPosted ? "text-emerald-400" : "text-foreground"}`}>{day}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color} font-medium`}>
                {cfg.label}
              </span>
              {hasPost && !isPosted && (
                <span className="text-[10px] text-muted-foreground truncate">
                  {STATUS_CONFIG[dayPosts[0].status as Status]?.label ?? dayPosts[0].status}
                </span>
              )}
              {!hasPost && (
                <span className="text-[10px] text-muted-foreground">—</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Post Card ────────────────────────────────────────────────────────────────

interface PostCardProps {
  post: CalendarPost;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
}

function PostCard({ post, onClick, onDragStart }: PostCardProps) {
  const acct = ACCOUNT_CONFIG[post.accountType as AccountType] ?? ACCOUNT_CONFIG.ig_reel;
  const status = STATUS_CONFIG[post.status as Status] ?? STATUS_CONFIG.idea;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`cursor-grab active:cursor-grabbing rounded-md px-2 py-1.5 border text-left w-full select-none ${acct.bg} ${acct.border} border hover:brightness-110 transition-all`}
    >
      <div className="flex items-start justify-between gap-1 mb-1">
        <span className={`text-[10px] font-semibold ${acct.color}`}>{acct.label}</span>
        <span className={`text-[9px] px-1 py-0.5 rounded font-medium shrink-0 ${status.color}`}>{status.label}</span>
      </div>
      <p className="text-xs text-foreground leading-tight line-clamp-2">{post.title}</p>
    </div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

interface DetailModalProps {
  post: CalendarPost | null;
  onClose: () => void;
  onSave: (data: Partial<CalendarPost>) => void;
  onDelete: () => void;
}

function DetailModal({ post, onClose, onSave, onDelete }: DetailModalProps) {
  const [form, setForm] = useState<Partial<CalendarPost>>(post ?? {});
  const isNew = !post?.id;

  function set(field: keyof CalendarPost, value: string | null) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSave() {
    onSave(form);
  }

  if (!post && !isNew) return null;

  const acct = ACCOUNT_CONFIG[(form.accountType ?? "ig_reel") as AccountType] ?? ACCOUNT_CONFIG.ig_reel;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded ${acct.bg} ${acct.color} font-semibold`}>{acct.label}</span>
            <span className={`text-xs px-2 py-0.5 rounded font-semibold ${STATUS_CONFIG[(form.status ?? "idea") as Status]?.color}`}>
              {STATUS_CONFIG[(form.status ?? "idea") as Status]?.label}
            </span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Title */}
          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Title *</label>
            <Input
              value={form.title ?? ""}
              onChange={(e) => set("title", e.target.value)}
              placeholder="What is this post about?"
              className="text-sm"
            />
          </div>

          {/* Account type + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Account</label>
              <select
                value={form.accountType ?? "ig_reel"}
                onChange={(e) => set("accountType", e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="ig_reel">IG Reel</option>
                <option value="clothing">Clothing</option>
                <option value="dancing">Dancing</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Status</label>
              <select
                value={form.status ?? "idea"}
                onChange={(e) => set("status", e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="idea">Idea</option>
                <option value="filmed">Filmed</option>
                <option value="edited">Edited</option>
                <option value="posted">Posted</option>
              </select>
            </div>
          </div>

          {/* Scheduled date */}
          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Scheduled Date</label>
            <Input
              type="date"
              value={form.scheduledDate ?? ""}
              onChange={(e) => set("scheduledDate", e.target.value)}
              className="text-sm"
            />
          </div>

          {/* Hook */}
          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Hook</label>
            <Input
              value={form.hook ?? ""}
              onChange={(e) => set("hook", e.target.value || null)}
              placeholder="Opening line or attention grabber"
              className="text-sm"
            />
          </div>

          {/* Caption */}
          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Caption</label>
            <Textarea
              value={form.caption ?? ""}
              onChange={(e) => set("caption", e.target.value || null)}
              placeholder="Post caption with hashtags"
              className="text-sm min-h-[80px]"
            />
          </div>

          {/* Outfit */}
          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Outfit / Clothes Featured</label>
            <Input
              value={form.outfit ?? ""}
              onChange={(e) => set("outfit", e.target.value || null)}
              placeholder="What are you wearing?"
              className="text-sm"
            />
          </div>

          {/* Location */}
          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Location</label>
            <Input
              value={form.location ?? ""}
              onChange={(e) => set("location", e.target.value || null)}
              placeholder="Where is this filmed?"
              className="text-sm"
            />
          </div>

          {/* Audio */}
          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Audio / Sound</label>
            <Input
              value={form.audio ?? ""}
              onChange={(e) => set("audio", e.target.value || null)}
              placeholder="Song name or voice-over"
              className="text-sm"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Notes</label>
            <Textarea
              value={form.notes ?? ""}
              onChange={(e) => set("notes", e.target.value || null)}
              placeholder="Anything else to remember"
              className="text-sm min-h-[70px]"
            />
          </div>

          {/* Result */}
          {(form.status === "posted" || post?.result) && (
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Result After Posting</label>
              <Textarea
                value={form.result ?? ""}
                onChange={(e) => set("result", e.target.value || null)}
                placeholder="How did it perform? Views, likes, comments, saves..."
                className="text-sm min-h-[70px]"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-card border-t border-border px-5 py-4 flex items-center justify-between gap-3">
          {post?.id ? (
            <button
              onClick={onDelete}
              className="text-xs text-destructive hover:text-destructive/80 flex items-center gap-1"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSave}>
              {isNew ? "Create Post" : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── New Post Prefill ─────────────────────────────────────────────────────────

function defaultPostForDate(dateStr: string): Partial<CalendarPost> {
  const d = new Date(dateStr + "T12:00:00");
  const dow = d.getDay();
  const accountType: AccountType = SCHEDULE[dow] ?? "ig_reel";
  return { scheduledDate: dateStr, accountType, status: "idea", title: "" };
}

// ─── Main Calendar Page ───────────────────────────────────────────────────────

export default function Calendar() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedPost, setSelectedPost] = useState<CalendarPost | "new" | null>(null);
  const [newPostDate, setNewPostDate] = useState<string>("");
  const [dragPostId, setDragPostId] = useState<number | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { start, end } = getMonthRange(year, month);
  const { data } = useListCalendarPosts({ start, end });
  const posts: CalendarPost[] = (data?.posts ?? []) as CalendarPost[];

  const createMutation = useCreateCalendarPost();
  const updateMutation = useUpdateCalendarPost();
  const deleteMutation = useDeleteCalendarPost();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/calendar"] });

  // ── Calendar grid ──
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const postsByDate = new Map<string, CalendarPost[]>();
  for (const p of posts) {
    const arr = postsByDate.get(p.scheduledDate) ?? [];
    arr.push(p);
    postsByDate.set(p.scheduledDate, arr);
  }

  const todayStr = toDateStr(today);

  // ── Handlers ──
  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  async function handleSave(data: Partial<CalendarPost>) {
    if (!data.title?.trim() || !data.scheduledDate) return;
    if (selectedPost === "new") {
      await createMutation.mutateAsync({
        data: {
          title: data.title,
          scheduledDate: data.scheduledDate,
          accountType: data.accountType ?? "ig_reel",
          status: data.status ?? "idea",
          hook: data.hook ?? null,
          caption: data.caption ?? null,
          outfit: data.outfit ?? null,
          location: data.location ?? null,
          audio: data.audio ?? null,
          notes: data.notes ?? null,
          result: data.result ?? null,
        },
      });
    } else if (selectedPost && typeof selectedPost !== "string") {
      await updateMutation.mutateAsync({ id: selectedPost.id, data });
    }
    invalidate();
    setSelectedPost(null);
  }

  async function handleDelete() {
    if (selectedPost && typeof selectedPost !== "string") {
      await deleteMutation.mutateAsync({ id: selectedPost.id });
      invalidate();
      setSelectedPost(null);
    }
  }

  function handleDragStart(e: React.DragEvent, postId: number) {
    setDragPostId(postId);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent, dateStr: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverDate(dateStr);
  }

  async function handleDrop(e: React.DragEvent, dateStr: string) {
    e.preventDefault();
    if (dragPostId == null) return;
    await updateMutation.mutateAsync({ id: dragPostId, data: { scheduledDate: dateStr } });
    invalidate();
    setDragPostId(null);
    setDragOverDate(null);
  }

  function handleDragEnd() {
    setDragPostId(null);
    setDragOverDate(null);
  }

  const modalPost: CalendarPost | null =
    selectedPost === "new"
      ? ({ ...defaultPostForDate(newPostDate), id: 0, createdAt: "", updatedAt: "" } as CalendarPost)
      : selectedPost;

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Content Calendar</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Tue · Thu · Sat · Sun posting schedule</p>
        </div>
        <Button
          size="sm"
          onClick={() => { setNewPostDate(todayStr); setSelectedPost("new"); }}
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" />
          New Post
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 min-h-0">
        {/* ── Calendar ── */}
        <div className="flex-1 min-w-0">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-3">
            <button onClick={prevMonth} className="p-1.5 rounded-md hover:bg-accent transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h2 className="text-base font-semibold">{MONTHS[month]} {year}</h2>
            <button onClick={nextMonth} className="p-1.5 rounded-md hover:bg-accent transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((d) => {
              const isScheduled = Object.keys(SCHEDULE).map(Number).some(
                (dow) => DAYS[dow] === d
              );
              return (
                <div
                  key={d}
                  className={`text-center text-[11px] font-medium py-1.5 ${
                    isScheduled ? "text-orange-400" : "text-muted-foreground"
                  }`}
                >
                  {d}
                </div>
              );
            })}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden border border-border">
            {cells.map((day, i) => {
              if (day === null) {
                return <div key={`empty-${i}`} className="bg-background min-h-[120px] p-1.5" />;
              }

              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const d = new Date(dateStr + "T12:00:00");
              const dow = d.getDay();
              const isScheduledDay = dow in SCHEDULE;
              const scheduledType = SCHEDULE[dow];
              const dayPosts = postsByDate.get(dateStr) ?? [];
              const isToday = dateStr === todayStr;
              const isDragTarget = dragOverDate === dateStr;

              return (
                <div
                  key={dateStr}
                  onDragOver={(e) => handleDragOver(e, dateStr)}
                  onDrop={(e) => handleDrop(e, dateStr)}
                  onDragEnd={handleDragEnd}
                  className={`bg-background min-h-[120px] p-1.5 transition-colors cursor-pointer group
                    ${isDragTarget ? "bg-accent/50" : ""}
                    ${isScheduledDay ? "bg-background" : "bg-muted/20"}
                  `}
                  onClick={() => { setNewPostDate(dateStr); setSelectedPost("new"); }}
                >
                  {/* Date + scheduled dot */}
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full
                        ${isToday ? "bg-primary text-primary-foreground" : "text-foreground"}
                      `}
                    >
                      {day}
                    </span>
                    {isScheduledDay && (
                      <span
                        className={`text-[9px] px-1 py-0.5 rounded font-semibold opacity-50 group-hover:opacity-100 transition-opacity
                          ${ACCOUNT_CONFIG[scheduledType].bg} ${ACCOUNT_CONFIG[scheduledType].color}
                        `}
                      >
                        {ACCOUNT_CONFIG[scheduledType].label}
                      </span>
                    )}
                  </div>

                  {/* Posts */}
                  <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
                    {dayPosts.map((post) => (
                      <PostCard
                        key={post.id}
                        post={post}
                        onClick={() => setSelectedPost(post)}
                        onDragStart={(e) => handleDragStart(e, post.id)}
                      />
                    ))}
                  </div>

                  {/* Add button on hover */}
                  {dayPosts.length === 0 && isScheduledDay && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setNewPostDate(dateStr); setSelectedPost("new"); }}
                      className="w-full mt-1 flex items-center justify-center opacity-0 group-hover:opacity-40 hover:!opacity-100 transition-opacity"
                    >
                      <Plus className="h-3 w-3 text-muted-foreground" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-3 flex-wrap">
            {Object.entries(ACCOUNT_CONFIG).map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-full ${cfg.bg} border ${cfg.border}`} />
                <span className="text-xs text-muted-foreground">{cfg.label}</span>
              </div>
            ))}
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-1.5">
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${cfg.color}`}>{cfg.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Weekly Checklist Sidebar ── */}
        <div className="w-full lg:w-52 shrink-0">
          <WeeklyChecklist posts={posts} />
        </div>
      </div>

      {/* Detail / Create Modal */}
      {selectedPost !== null && (
        <DetailModal
          post={modalPost}
          onClose={() => setSelectedPost(null)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
