import { describe, it, expect, vi } from "vitest";

vi.mock("../../openai", () => ({
  openai: {
    responses: {
      create: vi.fn(),
    },
  },
}));

import {
  calculateThreadQuality,
  calculateRiskScore,
  isContentClean,
  countDashes,
} from "../thread-planner";
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
  isAuthorReply = false,
  text = "Test comment content"
) {
  const baseTime = new Date("2025-12-15T10:00:00Z");
  return {
    authorPersona: persona,
    replyToIndex,
    text,
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

describe("calculateRiskScore", () => {
  const postAuthorId = "persona-riley_ops";
  const riley = createPersona("riley_ops");
  const jordan = createPersona("jordan_consults");
  const emily = createPersona("emily_econ");
  const alex = createPersona("alex_sells");

  describe("URL/Link detection (HIGH RISK)", () => {
    it("high risk for comments containing URLs", () => {
      const urlThread = [
        createComment(
          jordan,
          null,
          25,
          false,
          "Check out https://slideforge.ai for presentations!"
        ),
        createComment(riley, 0, 45, true, "Thanks!"),
      ];

      const risk = calculateRiskScore(urlThread, postAuthorId);

      // URLs are very risky
      expect(risk).toBeGreaterThanOrEqual(0.3);
    });

    it("high risk for posts containing domain names", () => {
      const thread = [
        createComment(jordan, null, 25, false, "Great question!"),
      ];

      const cleanRisk = calculateRiskScore(
        thread,
        postAuthorId,
        "Looking for presentation tools",
        "slideforge"
      );
      const domainRisk = calculateRiskScore(
        thread,
        postAuthorId,
        "Check slideforge.ai for help",
        "slideforge"
      );

      expect(domainRisk).toBeGreaterThan(cleanRisk);
    });

    it("multiple URLs = even higher risk", () => {
      const multiUrlThread = [
        createComment(jordan, null, 25, false, "Check www.slideforge.com"),
        createComment(emily, 0, 45, false, "Also try http://other.io"),
      ];

      const singleUrlThread = [
        createComment(jordan, null, 25, false, "Check slideforge.com"),
        createComment(emily, 0, 45, false, "Good tip!"),
      ];

      const multiRisk = calculateRiskScore(multiUrlThread, postAuthorId);
      const singleRisk = calculateRiskScore(singleUrlThread, postAuthorId);

      expect(multiRisk).toBeGreaterThan(singleRisk);
    });
  });

  describe("Product mention saturation (ASTROTURFING)", () => {
    it("low risk when only some comments mention product", () => {
      const thread = [
        createComment(jordan, null, 25, false, "I use Slideforge for this"),
        createComment(emily, 0, 45, false, "Good to know!"),
        createComment(riley, 1, 55, true, "Thanks for the tip"),
      ];

      const risk = calculateRiskScore(
        thread,
        postAuthorId,
        "Looking for tools",
        "slideforge"
      );

      // Only 1/4 mentions product = low risk
      expect(risk).toBeLessThan(0.3);
    });

    it("high risk when 50%+ content mentions product", () => {
      const thread = [
        createComment(jordan, null, 25, false, "Slideforge is great for this"),
        createComment(emily, 0, 45, false, "I also use Slideforge daily"),
        createComment(riley, 1, 55, true, "Thanks!"),
      ];

      const risk = calculateRiskScore(
        thread,
        postAuthorId,
        "Looking for tools",
        "slideforge"
      );

      // 2/4 = 50% mentions = higher risk
      expect(risk).toBeGreaterThanOrEqual(0.25);
    });

    it("very high risk when 75%+ content mentions product", () => {
      const thread = [
        createComment(jordan, null, 25, false, "Slideforge is perfect"),
        createComment(emily, 0, 45, false, "Slideforge saved me hours"),
        createComment(riley, 1, 55, true, "Slideforge sounds great!"),
      ];

      const risk = calculateRiskScore(
        thread,
        postAuthorId,
        "I need Slideforge help",
        "slideforge"
      );

      // 4/4 = 100% mentions = very high risk
      expect(risk).toBeGreaterThanOrEqual(0.4);
    });
  });

  describe("Coordinated shilling detection", () => {
    it("high risk when multiple non-OP users recommend same product", () => {
      const thread = [
        createComment(jordan, null, 25, false, "I recommend Slideforge"),
        createComment(
          emily,
          0,
          45,
          false,
          "Totally agree, Slideforge is great"
        ),
        createComment(riley, 1, 55, true, "Thanks for the tips!"),
      ];

      const risk = calculateRiskScore(
        thread,
        postAuthorId,
        "Looking for tools",
        "slideforge"
      );

      // Two non-OP users recommending same product = coordinated
      expect(risk).toBeGreaterThanOrEqual(0.4);
    });

    it("lower risk when only one user mentions product", () => {
      const thread = [
        createComment(jordan, null, 25, false, "I recommend Slideforge"),
        createComment(emily, 0, 45, false, "What's that? Never heard of it."),
        createComment(riley, 1, 55, true, "Interesting, thanks!"),
      ];

      const risk = calculateRiskScore(
        thread,
        postAuthorId,
        "Looking for tools",
        "slideforge"
      );

      // Only one recommender = less suspicious
      expect(risk).toBeLessThan(0.4);
    });
  });

  describe("OP fishing detection", () => {
    it("adds risk when OP asks follow-up questions about product", () => {
      const thread = [
        createComment(jordan, null, 25, false, "I use Slideforge for this"),
        createComment(
          riley,
          0,
          45,
          true,
          "How does export work? Can you share files easily?"
        ),
      ];

      const fishingRisk = calculateRiskScore(
        thread,
        postAuthorId,
        "Looking for tools",
        "slideforge"
      );

      // OP asking follow-up questions = fishing for more product info
      const noQuestionThread = [
        createComment(jordan, null, 25, false, "I use Slideforge for this"),
        createComment(riley, 0, 45, true, "Thanks for the tip!"),
      ];

      const normalRisk = calculateRiskScore(
        noQuestionThread,
        postAuthorId,
        "Looking for tools",
        "slideforge"
      );

      expect(fishingRisk).toBeGreaterThan(normalRisk);
    });
  });

  describe("Marketing buzzwords detection", () => {
    it("adds risk for marketing buzzwords", () => {
      const buzzwordThread = [
        createComment(
          jordan,
          null,
          25,
          false,
          "This tool is a game-changer, absolutely love it!"
        ),
      ];

      const normalThread = [
        createComment(jordan, null, 25, false, "This tool works for me"),
      ];

      const buzzwordRisk = calculateRiskScore(buzzwordThread, postAuthorId);
      const normalRisk = calculateRiskScore(normalThread, postAuthorId);

      expect(buzzwordRisk).toBeGreaterThan(normalRisk);
    });
  });

  describe("Length check (AI writes too much)", () => {
    it("adds risk for overly long comments (>50 words)", () => {
      // This comment has 60+ words - way over the 50 word limit
      const longComment =
        "I used Slideforge for a classroom pitch and a small grant deck, it gives really clean layouts and is great for tidying visuals quickly. I still fed my notes and kept control of the sequencing, the tool just expressed the story so I saved evenings aligning headers and polishing slides. This is exactly what I needed for my workflow.";
      const shortComment = "works great lol";

      const longThread = [createComment(jordan, null, 25, false, longComment)];

      const shortThread = [
        createComment(jordan, null, 25, false, shortComment),
      ];

      const longRisk = calculateRiskScore(longThread, postAuthorId);
      const shortRisk = calculateRiskScore(shortThread, postAuthorId);

      // Long comment should add at least 0.1 risk
      expect(longRisk).toBeGreaterThanOrEqual(0.1);
      expect(longRisk).toBeGreaterThan(shortRisk);
    });

    it("adds risk for overly long post body (>100 words)", () => {
      const longPost =
        "I run ops at a small startup so presentation design is my weird superpower, but I'm suddenly on the hook for a pitch deck for a school project and a small grant application and I'm out of my usual tools. I have lesson notes and a rough narrative, and I want something that looks intentional without me spending evenings aligning headers. Anyone using alternatives to traditional slide software that work well for classroom or grant pitches, something that gives clean layouts and helps with hierarchy? Also curious about workflows, specifically whether people get better results feeding notes into AI writing models to craft slide text, or using AI slide generators that try to assemble slides directly.";
      const shortPost = "Best AI Presentation Maker? Any help appreciated.";

      const thread = [createComment(jordan, null, 25, false, "nice")];

      const longPostRisk = calculateRiskScore(thread, postAuthorId, longPost);
      const shortPostRisk = calculateRiskScore(thread, postAuthorId, shortPost);

      expect(longPostRisk).toBeGreaterThan(shortPostRisk);
    });
  });

  describe("Formal language detection (sounds corporate)", () => {
    it("adds risk for corporate/formal language", () => {
      const formalThread = [
        createComment(
          jordan,
          null,
          25,
          false,
          "I run ops at a fast growing startup and need to optimize our workflow hierarchy."
        ),
      ];

      const casualThread = [
        createComment(jordan, null, 25, false, "yea this tool helped me lol"),
      ];

      const formalRisk = calculateRiskScore(formalThread, postAuthorId);
      const casualRisk = calculateRiskScore(casualThread, postAuthorId);

      expect(formalRisk).toBeGreaterThan(casualRisk);
    });

    it("flags 'quick question' pattern", () => {
      const thread = [
        createComment(
          jordan,
          null,
          25,
          false,
          "Quick question, how do you handle this?"
        ),
      ];

      const risk = calculateRiskScore(thread, postAuthorId);
      expect(risk).toBeGreaterThan(0);
    });
  });

  describe("Authenticity markers (casual language reduces risk)", () => {
    it("reduces risk when content has casual markers like lol", () => {
      // Both threads have the same formal pattern to create baseline risk
      // The casual one gets bonus reduction
      const casualThread = [
        createComment(
          jordan,
          null,
          25,
          false,
          "yea this works lol, helped me optimize stuff"
        ),
        createComment(emily, 0, 45, false, "haha same tbh"),
      ];

      const formalThread = [
        createComment(
          jordan,
          null,
          25,
          false,
          "This works, helped me optimize my workflow."
        ),
        createComment(emily, 0, 45, false, "I agree with this assessment."),
      ];

      const casualRisk = calculateRiskScore(casualThread, postAuthorId);
      const formalRisk = calculateRiskScore(formalThread, postAuthorId);

      // Casual should have lower risk due to authenticity bonus
      expect(casualRisk).toBeLessThan(formalRisk);
    });

    it("recognizes +1 ProductName as authentic", () => {
      const thread = [createComment(jordan, null, 25, false, "+1 Slideforge")];

      const risk = calculateRiskScore(
        thread,
        postAuthorId,
        undefined,
        "slideforge"
      );
      // Should not be flagged as high risk despite product mention
      expect(risk).toBeLessThan(0.5);
    });

    it("recognizes double exclamation as authentic", () => {
      // Both have some baseline formality, casual gets bonus
      const casualThread = [
        createComment(
          jordan,
          null,
          25,
          false,
          "Sweet I'll check it out!! gonna optimize my workflow"
        ),
      ];

      const formalThread = [
        createComment(
          jordan,
          null,
          25,
          false,
          "Thank you, I will optimize my workflow methodology."
        ),
      ];

      const casualRisk = calculateRiskScore(casualThread, postAuthorId);
      const formalRisk = calculateRiskScore(formalThread, postAuthorId);

      expect(casualRisk).toBeLessThan(formalRisk);
    });
  });

  describe("edge cases", () => {
    it("empty thread has zero risk", () => {
      const risk = calculateRiskScore([], postAuthorId);
      expect(risk).toBe(0);
    });

    it("risk is always between 0 and 1", () => {
      // Test with various extreme configurations
      const extremeThread = [
        createComment(
          jordan,
          null,
          25,
          false,
          "https://slideforge.ai is a game-changer revolutionary must-have!"
        ),
        createComment(
          emily,
          0,
          45,
          false,
          "www.slideforge.com absolutely love it, can't live without it!"
        ),
        createComment(
          alex,
          1,
          55,
          false,
          "Slideforge.io is incredible, highly recommend Slideforge!"
        ),
      ];

      const risk = calculateRiskScore(
        extremeThread,
        postAuthorId,
        "Check Slideforge at slideforge.ai",
        "slideforge"
      );

      expect(risk).toBeGreaterThanOrEqual(0);
      expect(risk).toBeLessThanOrEqual(1);
    });
  });
});

describe("isContentClean", () => {
  describe("should return false for prohibited content", () => {
    it("detects https URLs", () => {
      expect(isContentClean("Check out https://example.com")).toBe(false);
    });

    it("detects http URLs", () => {
      expect(isContentClean("Visit http://mysite.org")).toBe(false);
    });

    it("detects www prefixed URLs", () => {
      expect(isContentClean("Go to www.company.net")).toBe(false);
    });

    it("detects .com domains", () => {
      expect(isContentClean("Try slideforge.com for help")).toBe(false);
    });

    it("detects .io domains", () => {
      expect(isContentClean("Check example.io")).toBe(false);
    });

    it("detects .ai domains", () => {
      expect(isContentClean("Use slideforge.ai")).toBe(false);
    });

    it("detects .co domains", () => {
      expect(isContentClean("Visit company.co")).toBe(false);
    });

    it("detects .app domains", () => {
      expect(isContentClean("Download from app.app")).toBe(false);
    });
  });

  describe("should return true for clean content", () => {
    it("allows product names without domains", () => {
      expect(isContentClean("I use Slideforge for presentations")).toBe(true);
    });

    it("allows general helpful advice", () => {
      expect(isContentClean("Try searching for AI presentation tools")).toBe(
        true
      );
    });

    it("detects domains even in casual mentions", () => {
      expect(isContentClean("I found it on example.com yesterday")).toBe(false);
    });

    it("allows normal sentences", () => {
      expect(isContentClean("This helped me save 3 hours of work")).toBe(true);
    });

    it("allows abbreviations that look like domains but aren't", () => {
      expect(isContentClean("I work in the A.I. field")).toBe(true);
    });
  });
});

describe("countDashes", () => {
  describe("detects AI-like dash patterns", () => {
    it("detects em-dashes (—)", () => {
      expect(countDashes(["This tool — which I love — is great"])).toBe(2);
    });

    it("detects en-dashes (–)", () => {
      expect(countDashes(["Pages 1–10 are the best"])).toBe(1);
    });

    it("detects spaced hyphens ( - )", () => {
      expect(countDashes(["This tool - the best one - works"])).toBe(2);
    });

    it("detects double hyphens (--)", () => {
      expect(countDashes(["I tried it -- and it worked"])).toBe(1);
    });

    it("detects mixed dash types", () => {
      expect(countDashes(["This — is great - really -- amazing"])).toBe(3);
    });
  });

  describe("does NOT penalize normal hyphens", () => {
    it("allows hyphenated words like 'well-known'", () => {
      expect(countDashes(["It's a well-known fact"])).toBe(0);
    });

    it("allows compound words", () => {
      expect(
        countDashes(["I use AI-powered tools for my day-to-day work"])
      ).toBe(0);
    });

    it("allows numbers with hyphens", () => {
      expect(countDashes(["Call 1-800-555-1234"])).toBe(0);
    });
  });

  describe("risk score penalizes dashes", () => {
    const postAuthorId = "persona-riley_ops";
    const riley = {
      id: "persona-riley_ops",
      campaign_id: "campaign-1",
      username: "riley_ops",
      bio: "I do ops",
      is_active: true,
      is_operator: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    it("adds risk for content with em-dashes", () => {
      const dashThread = [
        {
          authorPersona: riley,
          text: "This tool — honestly — saved me hours",
          replyToIndex: null,
          scheduledAt: new Date(),
          isAuthorReply: false,
        },
      ];
      const cleanThread = [
        {
          authorPersona: riley,
          text: "This tool honestly saved me hours",
          replyToIndex: null,
          scheduledAt: new Date(),
          isAuthorReply: false,
        },
      ];

      const dashRisk = calculateRiskScore(dashThread, postAuthorId);
      const cleanRisk = calculateRiskScore(cleanThread, postAuthorId);

      expect(dashRisk).toBeGreaterThan(cleanRisk);
    });

    it("higher risk for multiple dashes", () => {
      const manyDashes = [
        {
          authorPersona: riley,
          text: "This — I mean — really — is amazing",
          replyToIndex: null,
          scheduledAt: new Date(),
          isAuthorReply: false,
        },
      ];
      const oneDash = [
        {
          authorPersona: riley,
          text: "This — is amazing",
          replyToIndex: null,
          scheduledAt: new Date(),
          isAuthorReply: false,
        },
      ];

      const manyRisk = calculateRiskScore(manyDashes, postAuthorId);
      const oneRisk = calculateRiskScore(oneDash, postAuthorId);

      expect(manyRisk).toBeGreaterThan(oneRisk);
    });
  });
});
