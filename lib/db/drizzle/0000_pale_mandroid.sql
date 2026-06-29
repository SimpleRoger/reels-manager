CREATE TABLE "instagram_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" text,
	"username" text NOT NULL,
	"access_token" text,
	"page_access_token" text,
	"last_synced" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "instagram_accounts_account_id_unique" UNIQUE("account_id")
);
--> statement-breakpoint
CREATE TABLE "reels" (
	"id" serial PRIMARY KEY NOT NULL,
	"instagram_id" text NOT NULL,
	"caption" text,
	"permalink" text,
	"thumbnail_url" text,
	"media_url" text,
	"posted_at" timestamp with time zone,
	"like_count" integer,
	"comments_count" integer,
	"reach" integer,
	"saves" integer,
	"shares" integer,
	"plays" integer,
	"performance_status" text,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"lufs_integrated" real,
	"lufs_range" real,
	"lufs_true_peak" real,
	"lufs_analyzed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reels_instagram_id_unique" UNIQUE("instagram_id")
);
--> statement-breakpoint
CREATE TABLE "reel_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"reel_id" integer NOT NULL,
	"hook" text,
	"format" text,
	"idea_source" text,
	"why_it_worked" text,
	"why_it_failed" text,
	"emotional_reaction" text,
	"content_type" text,
	"would_remake" boolean,
	"inspiration_link" text,
	"extra_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reel_notes_reel_id_unique" UNIQUE("reel_id")
);
--> statement-breakpoint
CREATE TABLE "reel_analysis" (
	"id" serial PRIMARY KEY NOT NULL,
	"reel_id" integer NOT NULL,
	"summary" text NOT NULL,
	"performance_drivers" text NOT NULL,
	"retention_factors" text NOT NULL,
	"content_patterns" text NOT NULL,
	"lessons_learned" text NOT NULL,
	"next_ideas" text NOT NULL,
	"variables_to_repeat" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reel_analysis_reel_id_unique" UNIQUE("reel_id")
);
--> statement-breakpoint
CREATE TABLE "reel_video_analysis" (
	"id" serial PRIMARY KEY NOT NULL,
	"reel_id" integer NOT NULL,
	"hook_rating" text NOT NULL,
	"hook_feedback" text NOT NULL,
	"pacing" text NOT NULL,
	"pacing_feedback" text NOT NULL,
	"audio" text NOT NULL,
	"audio_feedback" text NOT NULL,
	"on_screen_text" text NOT NULL,
	"on_screen_text_feedback" text NOT NULL,
	"content_type" text NOT NULL,
	"content_type_feedback" text NOT NULL,
	"overall_score" text NOT NULL,
	"suggestions" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reel_video_analysis_reel_id_unique" UNIQUE("reel_id")
);
--> statement-breakpoint
CREATE TABLE "playbook_lessons" (
	"id" serial PRIMARY KEY NOT NULL,
	"lesson" text NOT NULL,
	"category" text,
	"source_reel_id" integer,
	"proof_url" text,
	"proof_thumbnail_url" text,
	"proof_media_url" text,
	"proof_view_count" integer,
	"proof_like_count" integer,
	"proof_comments_count" integer,
	"proof_account_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_references" (
	"id" serial PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"media_url" text,
	"thumbnail_url" text,
	"caption" text,
	"account_name" text,
	"why_its_good" text,
	"what_to_change" text,
	"how_to_remake" text,
	"view_count" integer,
	"comments_count" integer,
	"like_count" integer,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_calendar" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"account_type" text DEFAULT 'ig_reel' NOT NULL,
	"status" text DEFAULT 'idea' NOT NULL,
	"scheduled_date" date NOT NULL,
	"hook" text,
	"caption" text,
	"outfit" text,
	"location" text,
	"audio" text,
	"notes" text,
	"result" text,
	"linked_reel_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reel_notes" ADD CONSTRAINT "reel_notes_reel_id_reels_id_fk" FOREIGN KEY ("reel_id") REFERENCES "public"."reels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reel_analysis" ADD CONSTRAINT "reel_analysis_reel_id_reels_id_fk" FOREIGN KEY ("reel_id") REFERENCES "public"."reels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reel_video_analysis" ADD CONSTRAINT "reel_video_analysis_reel_id_reels_id_fk" FOREIGN KEY ("reel_id") REFERENCES "public"."reels"("id") ON DELETE cascade ON UPDATE no action;