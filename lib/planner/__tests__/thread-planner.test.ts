import { describe, it, expect, vi } from "vitest";

vi.mock("../../openai", () => ({
  openai: {
    responses: {
      create: vi.fn(),
    },
  },
}));

import { calculateThreadQuality } from "../thread-planner";
import { Persona } from "../../types";

function createPersona(username: string): Persona {
  return {
    id: `persona-${username}`,
    campaign_id: "campaign-1",
    username,
    bio: `I'm ${username}`,
    is_active: true,
    is_operator: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function createComment(
  persona: Persona,
  replyToIndex: number | null,
  minutesAfterPost: number,
  isAuthorReply = false
) {
  const baseTime = new Date("2025-12-15T10:00:00Z");
  return {
    authorPersona: persona,
    replyToIndex,
    text: "Test comment content",
    scheduledAt: new Date(baseTime.getTime() + minutesAfterPost * 60 * 1000),
    isAuthorReply,
  };
}

describe("calculateThreadQuality", () => {
  const postAuthorId = "persona-riley_ops";
  const riley = createPersona("riley_ops");
  const jordan = createPersona("jordan_consults");
  const emily = createPersona("emily_econ");
  const alex = createPersona("alex_sells");

  describe("HIGH quality threads (should score >= 0.7)", () => {
    it("scores high for ideal conversation: multiple commenters, OP reply, good depth", () => {
      // Ideal thread:
      // - Jordan comments on post (top-level)
      // - Emily replies to Jordan
      // - OP (Riley) thanks Emily
      const comments = [
        createComment(jordan, null, 20), // Jordan replies to post
        createComment(emily, 0, 35), // Emily replies to Jordan
        createComment(riley, 1, 50, true), // OP replies to Emily
      ];

      const score = calculateThreadQuality(comments, postAuthorId);

      expect(score).toBeGreaterThanOrEqual(0.7);
    });

    it("scores high for branching conversation with variety", () => {
      // Branch pattern:
      // - Jordan comments on post
      // - Emily also comments on post (different branch)
      // - Alex replies to Jordan
      // - OP replies to Emily
      const comments = [
        createComment(jordan, null, 15), // Jordan replies to post
        createComment(emily, null, 25), // Emily replies to post (new branch)
        createComment(alex, 0, 40), // Alex replies to Jordan
        createComment(riley, 1, 55, true), // OP replies to Emily
      ];

      const score = calculateThreadQuality(comments, postAuthorId);

      expect(score).toBeGreaterThanOrEqual(0.7);
    });

    it("scores high when first comment is NOT from post author", () => {
      const comments = [
        createComment(jordan, null, 20), // Non-author first = good
        createComment(riley, 0, 35, true), // OP replies later
      ];

      const score = calculateThreadQuality(comments, postAuthorId);

      // Should get bonus for non-author first comment
      expect(score).toBeGreaterThanOrEqual(0.6);
    });
  });

  describe("MEDIUM quality threads (missing some quality signals)", () => {
    it("scores decent for thread with only top-level comments (no depth)", () => {
      // No thread depth - everyone just replies to post
      const comments = [
        createComment(jordan, null, 20),
        createComment(emily, null, 35),
        createComment(alex, null, 50),
      ];

      const score = calculateThreadQuality(comments, postAuthorId);

      // Good variety but missing depth bonus
      expect(score).toBeGreaterThanOrEqual(0.6);
      expect(score).toBeLessThanOrEqual(0.85);
    });

    it("scores decent when OP doesn't participate in comments", () => {
      const comments = [
        createComment(jordan, null, 20),
        createComment(emily, 0, 35),
      ];

      const score = calculateThreadQuality(comments, postAuthorId);

      // Has depth but missing OP participation bonus
      expect(score).toBeGreaterThanOrEqual(0.6);
      expect(score).toBeLessThanOrEqual(1.0);
    });
  });

  describe("LOW quality threads (should score LOWER than good threads)", () => {
    it("loses bonus when post author comments first (unnatural)", () => {
      // BAD: Post author commenting on their own post first
      const comments = [
        createComment(riley, null, 20, true), // OP first = loses bonus
        createComment(jordan, 0, 35),
      ];

      const score = calculateThreadQuality(comments, postAuthorId);

      // Good thread with non-OP first would get first-comment bonus
      // This thread should be lower (missing that +0.1)
      const goodThread = [
        createComment(jordan, null, 20),
        createComment(riley, 0, 35, true),
      ];
      const goodScore = calculateThreadQuality(goodThread, postAuthorId);

      expect(score).toBeLessThan(goodScore);
    });

    it("penalizes when same non-OP persona comments multiple times", () => {
      // BAD: Jordan spam-commenting
      const comments = [
        createComment(jordan, null, 20),
        createComment(jordan, 0, 35), // Same person again
        createComment(jordan, 1, 50), // And again!
      ];

      const score = calculateThreadQuality(comments, postAuthorId);

      // Should be penalized for repeat comments (-0.1 per repeat, -0.15 for >2)
      expect(score).toBeLessThanOrEqual(0.65);
    });

    it("loses timing bonus when too fast", () => {
      // BAD: Comments appearing too quickly (< 3 min gaps)
      const comments = [
        createComment(jordan, null, 1),
        createComment(emily, 0, 2), // 1 min gap = too fast
      ];

      const score = calculateThreadQuality(comments, postAuthorId);

      // Loses timing bonus (+0.05)
      expect(score).toBeLessThanOrEqual(0.9);
    });

    it("loses timing bonus when too slow", () => {
      // BAD: Massive gaps between comments (> 120 min)
      const comments = [
        createComment(jordan, null, 30),
        createComment(emily, 0, 200), // 170 min gap = too slow
      ];

      const score = calculateThreadQuality(comments, postAuthorId);

      // Loses timing bonus
      expect(score).toBeLessThanOrEqual(0.9);
    });

    it("scores lower for single commenter (no variety)", () => {
      // Only one person in the thread
      const singleComment = [createComment(jordan, null, 20)];
      const multiComment = [
        createComment(jordan, null, 20),
        createComment(emily, 0, 35),
      ];

      const singleScore = calculateThreadQuality(singleComment, postAuthorId);
      const multiScore = calculateThreadQuality(multiComment, postAuthorId);

      // Multiple commenters should score higher
      expect(singleScore).toBeLessThan(multiScore);
    });
  });

  describe("VERY LOW quality threads (spam detection)", () => {
    it("heavily penalizes when one persona dominates everything", () => {
      // TERRIBLE: One person posting 4+ times
      const spamThread = [
        createComment(jordan, null, 20),
        createComment(jordan, 0, 25),
        createComment(jordan, 1, 30),
        createComment(jordan, 2, 35),
      ];

      // Natural thread for comparison
      const naturalThread = [
        createComment(jordan, null, 20),
        createComment(emily, 0, 35),
        createComment(alex, 1, 50),
        createComment(riley, 2, 65, true),
      ];

      const spamScore = calculateThreadQuality(spamThread, postAuthorId);
      const naturalScore = calculateThreadQuality(naturalThread, postAuthorId);

      // Spam thread should score significantly lower
      expect(spamScore).toBeLessThan(naturalScore);
      expect(naturalScore - spamScore).toBeGreaterThan(0.2);
    });
  });

  describe("edge cases", () => {
    it("handles empty comments array with low score", () => {
      const score = calculateThreadQuality([], postAuthorId);

      // Base score + timing bonus (no comments = no bad timing)
      expect(score).toBeGreaterThanOrEqual(0.5);
      expect(score).toBeLessThanOrEqual(0.6);
    });

    it("score is always between 0 and 1", () => {
      // Test with various configurations
      const testCases = [
        [], // Empty
        [createComment(jordan, null, 20)], // Single comment
        // Spam scenario
        ...Array(10)
          .fill(null)
          .map(() => [createComment(jordan, null, Math.random() * 100)]),
      ];

      for (const comments of testCases) {
        const score = calculateThreadQuality(
          comments as Parameters<typeof calculateThreadQuality>[0],
          postAuthorId
        );
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      }
    });

    it("distinguishes between 3/10 and 9/10 quality threads", () => {
      // A "3/10" quality thread - manufactured looking
      const badThread = [
        createComment(riley, null, 5, true), // OP first (bad)
        createComment(jordan, null, 6), // Too fast
        createComment(jordan, 0, 7), // Same person again
      ];

      // A "9/10" quality thread - natural looking
      const goodThread = [
        createComment(jordan, null, 25), // Good timing, non-OP first
        createComment(emily, 0, 45), // Reply to first comment
        createComment(alex, 1, 65), // Creates depth
        createComment(riley, 2, 80, true), // OP participates naturally
      ];

      const badScore = calculateThreadQuality(badThread, postAuthorId);
      const goodScore = calculateThreadQuality(goodThread, postAuthorId);

      // Good thread should score significantly higher
      expect(goodScore).toBeGreaterThan(badScore);
      expect(goodScore - badScore).toBeGreaterThan(0.2); // At least 0.2 difference
    });
  });
});
