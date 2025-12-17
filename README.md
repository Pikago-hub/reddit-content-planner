# Reddit Content Planner

An algorithm that generates natural-looking Reddit content calendars where multiple personas post and comment on each other's threads.

## What I Built

A content calendar generator that takes company info, personas, subreddits, and keywords as input, and outputs weekly schedules of posts with threaded comment conversations.

**Key features:**

- LLM-orchestrated conversation planning (decides who replies to whom)
- Risk scoring to detect AI-sounding or promotional content
- Quality scoring to evaluate thread naturalness
- Safeguards against overposting, topic overlap, and coordinated shilling
- SSE streaming for real-time generation progress

## How It Works

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Weekly Calendar Generation                    │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│  1. SUBREDDIT SELECTOR                                              │
│     - Distributes posts across subreddits                           │
│     - Penalizes overposting (max 1-2 per subreddit/week)            │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│  2. PERSONA SELECTOR                                                │
│     - Picks post author (operator persona or least-used)            │
│     - Matches personas to subreddits by bio relevance               │
│     - Enforces limits: max 2 posts, 10 comments per persona/week    │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│  3. TOPIC GENERATOR                                                 │
│     - LLM generates topics matching subreddit + keywords            │
│     - Dedupes against previously used topics                        │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│  4. CONTENT GENERATOR                                               │
│     - Generates post in persona's voice                             │
│     - Short, casual Reddit style (no corporate speak)               │
│     - Varies comment lengths (ultra-short / short / medium)         │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│  5. THREAD PLANNER (LLM Orchestrator)                               │
│     - Plans conversation tree: who replies to whom                  │
│     - Outputs intents like "shares experience" or "+1 endorsement"  │
│     - Content generator writes actual text from intents             │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│  6. QUALITY + RISK SCORING                                          │
│     - Quality: thread structure, variety, depth, timing             │
│     - Risk: AI patterns, marketing buzzwords, product saturation    │
│     - Both saved to DB for review                                   │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. Two-Stage LLM Architecture

**What:** Thread planning is split into (1) structure planning and (2) content generation.

**Why:** A single LLM call producing full threads led to repetitive, robotic conversations. Separating structure from content lets the orchestrator focus on _who_ and _why_, while content generation focuses on authentic voice.

### 2. Risk Scoring (Astroturfing Detection)

**What:** Every thread gets a 0-1 risk score based on:

- URL/link detection
- Marketing buzzwords ("game-changer", "revolutionary")
- AI-like phrases ("I switched to X", "as someone who")
- Formal language ("utilize", "leverage", "workflow")
- Dash usage (AI loves em-dashes)
- Product mention saturation
- Coordinated shilling (multiple non-OP users recommending same product)

**Why:** The goal is content that looks real. High-risk threads would get flagged by Reddit mods or users. Scoring surfaces problems before posting.

### 3. Quality Scoring (Thread Naturalness)

**What:** Separate 0-1 quality score for thread structure:

- Commenter variety (2-4 unique commenters)
- First commenter ≠ post author
- Mix of top-level and replies
- Conversation depth (nested replies)
- OP participation
- Comment length variety (some short, some medium)

**Why:** Risk tells you if content sounds fake. Quality tells you if the conversation _structure_ looks organic.

### 4. Comment Length Variety

**What:** Comments are assigned lengths: `ultra_short` (1-5 words), `short` (5-10), `medium` (10-18).

**Why:** Real Reddit threads have "+1" and "Same!!" comments mixed with longer explanations. Uniform length is an AI tell.

### 5. Safeguards Against Overposting

**What:**

- Max 2 posts per persona per week
- Max 10 comments per persona per week
- Max 1-2 posts per subreddit per week
- Topic deduplication across weeks

**Why:** Repeated posting from same accounts in same subreddits = obvious astroturfing.

### 6. Operator Persona Pattern

**What:** If a persona is marked `is_operator`, they become the "seeker" who makes ALL posts (asking questions). Other personas are "helpers" who reply.

**Why:** This mirrors real astroturfing patterns where one account asks and others recommend. Makes thread structure more predictable and natural.

## Testing Approach

Tests focus on scoring functions since they're pure and deterministic:

```bash
bun test
```

**What's tested:**

- `calculateThreadQuality` - Validates scoring across 20+ scenarios (high/medium/low quality threads)
- `calculateRiskScore` - Tests detection of AI patterns, marketing language, URLs, coordinated mentions
- `isContentClean` - URL and domain detection
- `countDashes` - AI dash usage detection

**Why unit tests on scoring?**

- LLM output is non-deterministic, hard to test directly
- Scoring functions are pure: same input → same output
- Edge cases (overposting, overlapping topics, awkward back-and-forth) are caught by scoring
- Easy to add new cases as patterns emerge

**Manual testing:**

- Vary personas, subreddits, company info
- Check generated calendars for natural flow
- Look for AI tells (formal language, long comments, dashes)

## Tech Stack

- **Next.js 16** (App Router) + **React 19**
- **Supabase** (database)
- **OpenAI** (gpt-5-mini with reasoning)
- **Tailwind CSS v4**
- **Vitest** (testing)

## Getting Started

```bash
cp .env.example .env  # Add OPENAI_API_KEY + SUPABASE keys
bun install
bun dev               # http://localhost:3000
```

## Commands

```bash
bun dev     # Start dev server
bun build   # Production build
bun lint    # Run ESLint
bun test    # Run tests
```
