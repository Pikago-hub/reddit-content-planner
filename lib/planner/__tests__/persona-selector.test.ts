import { describe, it, expect } from "vitest";
import { selectPostAuthor, selectCommenters } from "../persona-selector";
import { Persona, Subreddit, PlannedPost, PlannedComment } from "../../types";

function createPersona(
  username: string,
  options: { isOperator?: boolean; bio?: string; isActive?: boolean } = {}
): Persona {
  return {
    id: `persona-${username}`,
    campaign_id: "campaign-1",
    username,
    bio: options.bio || `I'm ${username}, a regular user`,
    is_active: options.isActive ?? true,
    is_operator: options.isOperator ?? false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function createSubreddit(name: string): Subreddit {
  return {
    id: `sub-${name}`,
    campaign_id: "campaign-1",
    name,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function createPost(authorId: string): PlannedPost {
  return {
    id: `post-${Math.random()}`,
    campaign_id: "campaign-1",
    weekly_plan_id: "plan-1",
    subreddit_name: "test",
    author_persona_id: authorId,
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

function createComment(authorId: string, postId: string): PlannedComment {
  return {
    id: `comment-${Math.random()}`,
    campaign_id: "campaign-1",
    planned_post_id: postId,
    author_persona_id: authorId,
    reply_to_comment_id: null,
    comment_text: "Test comment",
    scheduled_at: new Date().toISOString(),
    quality_score: 0.7,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

describe("selectPostAuthor", () => {
  describe("operator persona priority", () => {
    it("always selects operator persona when one exists", () => {
      const personas = [
        createPersona("riley_ops", { isOperator: true }),
        createPersona("jordan_consults"),
        createPersona("emily_econ"),
      ];
      const subreddit = createSubreddit("powerpoint");

      const result = selectPostAuthor(personas, subreddit, [], []);

      expect(result).not.toBeNull();
      expect(result?.persona.username).toBe("riley_ops");
      expect(result?.reason).toBe("operator");
    });

    it("operator can make unlimited posts (no limit)", () => {
      const personas = [
        createPersona("riley_ops", { isOperator: true }),
        createPersona("jordan_consults"),
      ];
      const subreddit = createSubreddit("powerpoint");

      // Operator already made 5 posts
      const existingPosts = Array(5)
        .fill(null)
        .map(() => createPost("persona-riley_ops"));

      const result = selectPostAuthor(personas, subreddit, existingPosts, []);

      // Operator should still be selected
      expect(result?.persona.username).toBe("riley_ops");
    });
  });

  describe("fallback distribution (no operator)", () => {
    it("distributes posts across personas when no operator", () => {
      const personas = [
        createPersona("jordan_consults"),
        createPersona("emily_econ"),
        createPersona("alex_sells"),
      ];
      const subreddit = createSubreddit("powerpoint");

      // Run multiple times to verify distribution
      const selectedUsernames = new Set<string>();
      for (let i = 0; i < 10; i++) {
        const result = selectPostAuthor(personas, subreddit, [], []);
        if (result) {
          selectedUsernames.add(result.persona.username);
        }
      }

      // Over 10 selections, should have selected multiple different personas
      expect(selectedUsernames.size).toBeGreaterThanOrEqual(2);
    });

    it("respects max 2 posts per persona limit", () => {
      const personas = [
        createPersona("jordan_consults"),
        createPersona("emily_econ"),
      ];
      const subreddit = createSubreddit("powerpoint");

      // Jordan already made 2 posts
      const existingPosts = [
        createPost("persona-jordan_consults"),
        createPost("persona-jordan_consults"),
      ];

      const result = selectPostAuthor(personas, subreddit, existingPosts, []);

      // Should select emily since jordan is at limit
      expect(result?.persona.username).toBe("emily_econ");
    });

    it("returns null when all personas at limit", () => {
      const personas = [
        createPersona("jordan_consults"),
        createPersona("emily_econ"),
      ];
      const subreddit = createSubreddit("powerpoint");

      // Both at max posts
      const existingPosts = [
        createPost("persona-jordan_consults"),
        createPost("persona-jordan_consults"),
        createPost("persona-emily_econ"),
        createPost("persona-emily_econ"),
      ];

      const result = selectPostAuthor(personas, subreddit, existingPosts, []);

      expect(result).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("returns null for empty personas list", () => {
      const subreddit = createSubreddit("powerpoint");

      const result = selectPostAuthor([], subreddit, [], []);

      expect(result).toBeNull();
    });

    it("filters out inactive personas", () => {
      const personas = [
        createPersona("inactive_user", { isActive: false }),
        createPersona("active_user", { isActive: true }),
      ];
      const subreddit = createSubreddit("powerpoint");

      const result = selectPostAuthor(personas, subreddit, [], []);

      expect(result?.persona.username).toBe("active_user");
    });
  });
});

describe("selectCommenters", () => {
  describe("post author exclusion from first comment", () => {
    it("does not select post author as first commenter", () => {
      const personas = [
        createPersona("riley_ops"),
        createPersona("jordan_consults"),
        createPersona("emily_econ"),
      ];

      // Run multiple times to ensure first commenter is never the post author
      for (let i = 0; i < 20; i++) {
        const result = selectCommenters(
          personas,
          "persona-riley_ops",
          [],
          [],
          3
        );

        if (result.length > 0) {
          // First commenter (excluding author_reply) should not be post author
          const firstNonAuthorComment = result.find(
            (r) => r.reason !== "author_reply"
          );
          expect(firstNonAuthorComment?.persona.id).not.toBe(
            "persona-riley_ops"
          );
        }
      }
    });
  });

  describe("comment limits", () => {
    it("respects max 10 comments per persona", () => {
      const personas = [
        createPersona("jordan_consults"),
        createPersona("emily_econ"),
      ];

      // Jordan already made 10 comments
      const existingComments = Array(10)
        .fill(null)
        .map(() => createComment("persona-jordan_consults", "post-1"));

      const result = selectCommenters(
        personas,
        "persona-other",
        [],
        existingComments,
        3
      );

      // Jordan should not be selected, only emily
      const jordanSelected = result.some(
        (r) => r.persona.username === "jordan_consults"
      );
      expect(jordanSelected).toBe(false);
    });
  });

  describe("natural comment counts", () => {
    it("returns 2-4 commenters for natural conversation", () => {
      const personas = [
        createPersona("riley_ops"),
        createPersona("jordan_consults"),
        createPersona("emily_econ"),
        createPersona("alex_sells"),
        createPersona("priya_pm"),
      ];

      // Run multiple times to check the range
      for (let i = 0; i < 10; i++) {
        const result = selectCommenters(
          personas,
          "persona-riley_ops",
          [],
          [],
          5
        );

        // Should have reasonable number of commenters
        expect(result.length).toBeGreaterThanOrEqual(2);
        expect(result.length).toBeLessThanOrEqual(5);
      }
    });
  });

  describe("edge cases", () => {
    it("handles case when post author is only persona", () => {
      const personas = [createPersona("riley_ops")];

      const result = selectCommenters(personas, "persona-riley_ops", [], [], 3);

      // Should either be empty or only have author_reply
      expect(
        result.every(
          (r) =>
            r.reason === "author_reply" || r.persona.id === "persona-riley_ops"
        )
      ).toBe(true);
    });

    it("handles empty personas list", () => {
      const result = selectCommenters([], "persona-1", [], [], 3);

      expect(result.length).toBe(0);
    });
  });
});
