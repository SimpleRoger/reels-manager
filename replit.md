# Workspace

## Overview

**Reel Journal** — A personal Instagram Reel performance tracker and journal for content creators. Built as a pnpm workspace monorepo using TypeScript.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifacts/reel-journal) at `/`
- **API framework**: Express 5 (artifacts/api-server) at `/api`
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **AI**: OpenAI GPT-4o-mini (set OPENAI_API_KEY env var)
- **Instagram**: Meta Graph API (token stored in DB)

## Features

1. **Instagram Connect** — Paste a long-lived Graph API access token in Settings
2. **Reel Sync** — Fetches latest Reels with stats (likes, comments, reach, saves, shares, plays)
3. **Performance Status** — Underperforming / Normal / Overperforming based on account averages
4. **Notes & Journal** — Per-reel journal with hook, format, idea source, emotional reaction, etc.
5. **AI Analysis** — GPT-4o-mini analyzes Reel + notes to explain performance and suggest next ideas
6. **History Log** — Browse all Reels, sort by any metric, filter by tags
7. **Playbook** — Running lessons database with categories
8. **Viral Finder** — Search hashtags via Instagram API, sort by comment count
9. **Remake List** — Save reference Reels with notes on how to adapt them

## Pages

- `/` — Dashboard (latest Reel + stats + performance verdict)
- `/reels` — History log (sortable/filterable)
- `/reels/:id` — Reel detail (notes, AI analysis, tags)
- `/playbook` — Accumulated content lessons
- `/viral-finder` — Hashtag search tool
- `/remake-list` — Saved references
- `/settings` — Instagram connection + sync

## Setup

1. Go to `/settings` and paste your Instagram Graph API long-lived access token
2. Click "Sync Reels" to pull your latest Reels
3. Add OPENAI_API_KEY environment secret to enable AI analysis
4. Browse Dashboard, add notes to Reels, run AI analysis

## Getting an Instagram Access Token

1. Create a Meta Developer App at https://developers.facebook.com/
2. Add "Instagram Graph API" product
3. Connect your Instagram Professional (Business/Creator) account
4. Generate a long-lived User Access Token with instagram_basic + instagram_manage_insights permissions

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## DB Schema

- `instagram_accounts` — stored access token + username
- `reels` — fetched Reel data with stats and tags
- `reel_notes` — per-reel journal notes (1:1 with reels)
- `reel_analysis` — AI analysis results (1:1 with reels)
- `playbook_lessons` — accumulated creator insights
- `saved_references` — remake list references

## Environment Secrets Needed

- `OPENAI_API_KEY` — for AI analysis feature (optional but required for analysis)
- `DATABASE_URL` — auto-provisioned by Replit
- Instagram access token is stored in the database (entered via Settings UI)
