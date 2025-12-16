import { Subreddit, PlannedPost } from "../types";

interface SubredditSelection {
  subreddit: Subreddit;
  reason: string;
}

/**
 * Selects subreddits for the week's posts with simple variety logic.
 * Distributes posts across subreddits to avoid overposting.
 */
export function selectSubredditsForWeek(
  subreddits: Subreddit[],
  postsPerWeek: number,
  existingPostsThisWeek: PlannedPost[]
): SubredditSelection[] {
  const activeSubreddits = subreddits.filter((s) => s.is_active);

  if (activeSubreddits.length === 0) {
    throw new Error("No active subreddits available");
  }

  const postsPerSubreddit = new Map<string, number>();
  for (const post of existingPostsThisWeek) {
    const count = postsPerSubreddit.get(post.subreddit_name) || 0;
    postsPerSubreddit.set(post.subreddit_name, count + 1);
  }

  const selections: SubredditSelection[] = [];
  const usedThisSelection = new Map<string, number>();

  for (let i = 0; i < postsPerWeek; i++) {
    const scoredSubreddits = activeSubreddits
      .map((subreddit) => {
        const existingCount = postsPerSubreddit.get(subreddit.name) || 0;
        const selectedCount = usedThisSelection.get(subreddit.name) || 0;
        const totalCount = existingCount + selectedCount;

        let score = 100;
        score -= totalCount * 30;
        score += Math.random() * 20;

        return {
          subreddit,
          score,
          reason: totalCount === 0 ? "fresh_subreddit" : "available",
        };
      })
      .sort((a, b) => b.score - a.score);

    const selected = scoredSubreddits[0];
    selections.push({
      subreddit: selected.subreddit,
      reason: selected.reason,
    });

    const count = usedThisSelection.get(selected.subreddit.name) || 0;
    usedThisSelection.set(selected.subreddit.name, count + 1);
  }

  return selections;
}
