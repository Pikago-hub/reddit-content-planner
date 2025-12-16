import { describe, it, expect } from "vitest";
import { selectSubredditsForWeek } from "../subreddit-selector";
import { Subreddit, PlannedPost } from "../../types";

function createSubreddit(name: string, isActive = true): Subreddit {
  return {
    id: `sub-${name}`,
    campaign_id: "campaign-1",
    name,
    is_active: isActive,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function createPost(subredditName: string): PlannedPost {
  return {
    id: `post-${Math.random()}`,
    campaign_id: "campaign-1",
    weekly_plan_id: "plan-1",
    subreddit_name: subredditName,
    author_persona_id: "persona-1",
    post_type: "post",
    title: "Test Post",
    body: "Test body",
    target_keyword_codes: [],
    topic_key: "test-topic",
    scheduled_at: new Date().toISOString(),
    quality_score: 0.7,
    risk_score: 0.2,
    dedupe_hash: "hash",
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

describe("selectSubredditsForWeek", () => {
  describe("basic distribution", () => {
    it("distributes posts across multiple subreddits for variety", () => {
      const subreddits = [
        createSubreddit("powerpoint"),
        createSubreddit("consulting"),
        createSubreddit("entrepreneur"),
      ];

      const result = selectSubredditsForWeek(subreddits, 3, []);

      // Each subreddit should be used once when we have 3 posts and 3 subreddits
      const usedSubreddits = result.map((r) => r.subreddit.name);
      const uniqueSubreddits = new Set(usedSubreddits);

      // With 3 posts and 3 subreddits, we should use all 3
      expect(uniqueSubreddits.size).toBe(3);
    });

    it("returns correct number of selections", () => {
      const subreddits = [
        createSubreddit("powerpoint"),
        createSubreddit("consulting"),
      ];

      const result = selectSubredditsForWeek(subreddits, 5, []);

      expect(result.length).toBe(5);
    });
  });

  describe("overposting prevention", () => {
    it("avoids overposting to the same subreddit in one week", () => {
      const subreddits = [
        createSubreddit("powerpoint"),
        createSubreddit("consulting"),
        createSubreddit("entrepreneur"),
      ];

      const result = selectSubredditsForWeek(subreddits, 6, []);

      // Count posts per subreddit
      const postCounts = new Map<string, number>();
      for (const selection of result) {
        const count = postCounts.get(selection.subreddit.name) || 0;
        postCounts.set(selection.subreddit.name, count + 1);
      }

      // With 6 posts and 3 subreddits, each should have ~2 posts
      // No subreddit should have more than 3 (would be unbalanced)
      for (const [name, count] of postCounts) {
        expect(count).toBeLessThanOrEqual(3);
        expect(count).toBeGreaterThanOrEqual(1);
      }
    });

    it("respects existing posts when selecting subreddits", () => {
      const subreddits = [
        createSubreddit("powerpoint"),
        createSubreddit("consulting"),
        createSubreddit("entrepreneur"),
      ];

      // Powerpoint already has 2 posts this week
      const existingPosts = [
        createPost("powerpoint"),
        createPost("powerpoint"),
      ];

      const result = selectSubredditsForWeek(subreddits, 3, existingPosts);

      // Count how many times powerpoint was selected
      const powerpointCount = result.filter(
        (r) => r.subreddit.name === "powerpoint"
      ).length;

      // Powerpoint should be deprioritized since it already has 2 posts
      // Other subreddits should be preferred
      expect(powerpointCount).toBeLessThanOrEqual(1);
    });

    it("still uses heavily-used subreddit when it's the only option", () => {
      const subreddits = [createSubreddit("powerpoint")];

      const result = selectSubredditsForWeek(subreddits, 3, []);

      expect(result.length).toBe(3);
      expect(result.every((r) => r.subreddit.name === "powerpoint")).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("throws error when no active subreddits available", () => {
      const subreddits = [
        createSubreddit("powerpoint", false),
        createSubreddit("consulting", false),
      ];

      expect(() => selectSubredditsForWeek(subreddits, 3, [])).toThrow(
        "No active subreddits available"
      );
    });

    it("filters out inactive subreddits", () => {
      const subreddits = [
        createSubreddit("powerpoint", true),
        createSubreddit("consulting", false),
        createSubreddit("entrepreneur", true),
      ];

      const result = selectSubredditsForWeek(subreddits, 10, []);

      // Only active subreddits should be used
      const usedNames = result.map((r) => r.subreddit.name);
      expect(usedNames).not.toContain("consulting");
    });

    it("handles single subreddit correctly", () => {
      const subreddits = [createSubreddit("powerpoint")];

      const result = selectSubredditsForWeek(subreddits, 5, []);

      expect(result.length).toBe(5);
    });

    it("handles more subreddits than posts", () => {
      const subreddits = [
        createSubreddit("powerpoint"),
        createSubreddit("consulting"),
        createSubreddit("entrepreneur"),
        createSubreddit("productivity"),
        createSubreddit("marketing"),
      ];

      const result = selectSubredditsForWeek(subreddits, 2, []);

      expect(result.length).toBe(2);
      // Should still distribute (unique subreddits)
      const uniqueSubreddits = new Set(result.map((r) => r.subreddit.name));
      expect(uniqueSubreddits.size).toBe(2);
    });
  });
});
