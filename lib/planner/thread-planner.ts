import { openai } from "../openai";
import { Persona, CompanyInfo } from "../types";
import { generateCommentContent } from "./content-generator";

interface PlannedThreadComment {
  authorPersona: Persona;
  replyToIndex: number | null;
  text: string;
  scheduledAt: Date;
  isAuthorReply: boolean;
}

interface ThreadPlan {
  comments: PlannedThreadComment[];
}

interface ThreadStructureItem {
  username: string;
  replies_to: "post" | number;
  intent: string;
}

interface OrchestratorOutput {
  thread_plan: ThreadStructureItem[];
}

/**
 * LLM Orchestrator: Plans the conversation tree structure intelligently.
 *
 * This decides:
 * - Who comments
 * - Who replies to whom (post vs other comments)
 * - What angle/intent each comment should have
 *
 * The actual content is generated separately based on this plan.
 */
async function planThreadStructure(
  postTitle: string,
  postBody: string,
  postAuthor: Persona,
  availableCommenters: Persona[],
  companyInfo: CompanyInfo,
  numComments: number = 3
): Promise<OrchestratorOutput> {
  const productName = companyInfo.website?.replace(/\..*/, "") || "the product";

  const personaDescriptions = availableCommenters
    .map(
      (p) =>
        `- ${p.username}: ${p.bio?.slice(0, 150) || "Regular Reddit user"}...`
    )
    .join("\n");

  const prompt = `You are planning a natural Reddit comment thread. The goal is to create an organic-looking conversation that subtly promotes ${productName}.

POST INFO:
- Title: "${postTitle}"
- Body: "${postBody}"
- Posted by: ${postAuthor.username}

AVAILABLE COMMENTERS:
${personaDescriptions}

TASK: Plan a thread with exactly ${numComments} comments. Design a natural conversation flow.

RULES:
1. First comment MUST be from someone other than ${postAuthor.username} (they posted it)
2. ${postAuthor.username} can reply ONCE to thank someone or ask a follow-up (optional but recommended)
3. Non-OP commenters can naturally mention ${productName} based on their experience
4. Create varied interaction patterns:
   - Chain: A replies to post → B replies to A → C replies to B
   - Branch: A replies to post → B and C both reply to A
   - Mixed: A replies to post → B replies to A → C replies to post separately
5. Comments should build on each other (agree, add info, share similar experience)
6. Keep intents short and specific (what they'll say, not how)

EXAMPLES OF GOOD INTENTS:
- "shares experience using ${productName} for similar problem"
- "agrees with previous comment, mentions they also switched to ${productName}"
- "OP thanks for the recommendation"
- "+1 endorsement of ${productName}"
- "asks clarifying question about the recommendation"
- "adds another perspective, prefers ${productName} for specific reason"

Respond ONLY with valid JSON:
{
  "thread_plan": [
    { "username": "persona_name", "replies_to": "post", "intent": "brief intent description" },
    { "username": "another_persona", "replies_to": 0, "intent": "brief intent" },
    { "username": "op_username", "replies_to": 1, "intent": "thanks for recommendation" }
  ]
}

NOTE: "replies_to" is "post" for top-level comments, or the index (0, 1, 2...) of the comment being replied to.`;

  try {
    const response = await openai.responses.create({
      model: "gpt-5-mini",
      input: [
        {
          role: "system",
          content:
            "You are a social media strategist planning natural Reddit conversations. Output valid JSON only.",
        },
        { role: "user", content: prompt },
      ],
      reasoning: { effort: "medium" },
    });

    const content = response.output_text || "{}";

    try {
      const parsed = JSON.parse(content) as OrchestratorOutput;

      if (!parsed.thread_plan || !Array.isArray(parsed.thread_plan)) {
        throw new Error("Invalid thread_plan structure");
      }

      for (const item of parsed.thread_plan) {
        if (!item.username || item.replies_to === undefined || !item.intent) {
          throw new Error("Missing required fields in thread_plan item");
        }
      }

      return parsed;
    } catch (parseError) {
      console.error("JSON Parse Error (Orchestrator):", parseError, content);
      return createFallbackStructure(
        postAuthor,
        availableCommenters,
        numComments
      );
    }
  } catch (error) {
    console.error("Error in thread orchestrator:", error);
    return createFallbackStructure(
      postAuthor,
      availableCommenters,
      numComments
    );
  }
}

/**
 * Creates a fallback thread structure if the LLM fails
 */
function createFallbackStructure(
  postAuthor: Persona,
  commenters: Persona[],
  numComments: number
): OrchestratorOutput {
  const nonAuthorCommenters = commenters.filter((c) => c.id !== postAuthor.id);
  const plan: ThreadStructureItem[] = [];

  if (nonAuthorCommenters.length === 0) {
    return { thread_plan: [] };
  }

  plan.push({
    username: nonAuthorCommenters[0].username,
    replies_to: "post",
    intent: "shares relevant experience or recommendation",
  });

  if (numComments >= 2 && nonAuthorCommenters.length >= 2) {
    plan.push({
      username: nonAuthorCommenters[1].username,
      replies_to: 0,
      intent: "agrees or adds to first comment",
    });
  }

  if (numComments >= 3) {
    plan.push({
      username: postAuthor.username,
      replies_to: plan.length - 1,
      intent: "thanks for the recommendation",
    });
  }

  return { thread_plan: plan };
}

/**
 * Plans a natural-looking comment thread for a post using LLM orchestration.
 *
 * This function:
 * 1. Calls the LLM orchestrator to plan the conversation structure
 * 2. Generates content for each planned comment based on the orchestrator's intent
 * 3. Returns the complete thread with timing
 */
export async function planCommentThread(
  postTitle: string,
  postBody: string,
  postAuthor: Persona,
  commenters: Persona[],
  postScheduledAt: Date,
  companyInfo: CompanyInfo
): Promise<ThreadPlan> {
  const comments: PlannedThreadComment[] = [];

  const allCommenters = commenters.some((c) => c.id === postAuthor.id)
    ? commenters
    : [...commenters, postAuthor];

  const structure = await planThreadStructure(
    postTitle,
    postBody,
    postAuthor,
    allCommenters,
    companyInfo,
    3
  );

  if (structure.thread_plan.length === 0) {
    return { comments: [] };
  }

  const personaMap = new Map<string, Persona>();
  for (const persona of allCommenters) {
    personaMap.set(persona.username.toLowerCase(), persona);
  }

  let currentTime = new Date(postScheduledAt);

  for (let i = 0; i < structure.thread_plan.length; i++) {
    const planned = structure.thread_plan[i];

    const persona = personaMap.get(planned.username.toLowerCase());
    if (!persona) {
      console.warn(`Persona not found: ${planned.username}, skipping`);
      continue;
    }

    const replyToIndex =
      planned.replies_to === "post" ? null : planned.replies_to;

    const parentComment =
      replyToIndex !== null && comments[replyToIndex]
        ? comments[replyToIndex].text
        : null;

    const isAuthorReply = persona.id === postAuthor.id;

    if (i === 0) {
      currentTime = addRandomMinutes(currentTime, 15, 45);
    } else {
      currentTime = addRandomMinutes(currentTime, 5, 25);
    }

    const commentContent = await generateCommentContent(
      persona,
      postTitle,
      postBody,
      parentComment,
      isAuthorReply,
      companyInfo,
      planned.intent,
      i // Pass comment index for length variety
    );

    comments.push({
      authorPersona: persona,
      replyToIndex,
      text: commentContent.text,
      scheduledAt: new Date(currentTime),
      isAuthorReply,
    });
  }

  return { comments };
}

/**
 * Add a random number of minutes to a date (UTC)
 */
function addRandomMinutes(date: Date, min: number, max: number): Date {
  const minutes = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Date(date.getTime() + minutes * 60 * 1000);
}

/**
 * Check if content contains prohibited patterns (URLs, links, domains)
 * Returns true if content is clean, false if it contains prohibited patterns
 */
export function isContentClean(text: string): boolean {
  // Check for URLs (http://, https://, www.)
  const urlPattern = /https?:\/\/|www\./i;
  if (urlPattern.test(text)) return false;

  // Check for domain patterns (word.com, word.io, word.ai, etc.)
  const domainPattern = /\b\w+\.(com|io|ai|co|org|net|app|dev|xyz)\b/i;
  if (domainPattern.test(text)) return false;

  return true;
}

/**
 * Count how many pieces of content contain prohibited patterns
 */
function countProhibitedContent(texts: string[]): number {
  return texts.filter((text) => !isContentClean(text)).length;
}

/**
 * Detect marketing buzzwords that make content look promotional
 */
const MARKETING_BUZZWORDS =
  /game.?changer|revolutionary|amazing tool|must.?have|incredible|best ever|life.?changing|absolutely love|highly recommend|can't live without|blown away|exceeded expectations/i;

/**
 * Detect AI-like phrases that sound robotic or templated
 * These are common patterns that AI generates and Reddit users will flag
 */
const AI_PATTERNS_STRONG = [
  // Templated recommendations
  /I switched to \w+/i,
  /I've been using \w+ for/i,
  /I started using \w+/i,
  /ever since I (started|switched|began)/i,

  // Robotic transitions
  /that being said/i,
  /with that in mind/i,
  /it's worth (noting|mentioning)/i,
  /speaking of which/i,
  /on that note/i,

  // Fake relatability
  /as someone who/i,
  /speaking as a/i,
  /as a fellow/i,

  // Time-saving claims (very AI-like when verbose)
  /saved me hours/i,
  /freed me (up )?to/i,
  /so I (can|could) focus on/i,

  // Perfect solution framing
  /I had the same (issue|problem)/i,
  /solved (this|my|the) problem/i,
  /exactly what I needed/i,
  /works perfectly/i,

  // Hedging language AI loves
  /I have to say/i,
  /I must say/i,

  // Overly helpful structure
  /here's (what|how)/i,
  /the (key|trick|secret) is/i,
  /pro tip:/i,
];

/**
 * Formal/corporate language that sounds unnatural on Reddit
 */
const FORMAL_PATTERNS = [
  /specifically whether/i,
  /with regard to/i,
  /in terms of/i,
  /in order to/i,
  /utilize/i,
  /leverage/i,
  /facilitate/i,
  /workflow/i,
  /streamline/i,
  /optimize/i,
  /hierarchy/i,
  /functionality/i,
  /implementation/i,
  /methodology/i,
  /subsequently/i,
  /aforementioned/i,
  /regarding/i,
  /pertaining to/i,
  /I run ops/i,
  /fast growing/i,
  /quick question/i,
];

/**
 * Authenticity markers - casual language real Redditors use
 * Presence of these REDUCES risk
 */
const AUTHENTICITY_MARKERS = [
  /\blol\b/i,
  /\blmao\b/i,
  /\bhaha\b/i,
  /!!/,
  /\byea\b/i,
  /\byeah\b/i,
  /\bsorta\b/i,
  /\bgonna\b/i,
  /\bwanna\b/i,
  /\bgotta\b/i,
  /\bkinda\b/i,
  /\bdunno\b/i,
  /\btbh\b/i,
  /\bimo\b/i,
  /\bimho\b/i,
  /\bfwiw\b/i,
  /\bbtw\b/i,
  /\bngl\b/i,
  /\bidk\b/i,
  /\bomg\b/i,
  /\^\s*this/i,
  /\+1\s+\w+/i, // "+1 ProductName" is natural
];

/**
 * Detect filler words that make content sound AI-generated
 */
const AI_FILLER_WORDS =
  /additionally|furthermore|moreover|essentially|certainly|obviously|clearly/i;

/**
 * Count how many AI patterns match in a text
 */
function countAiPatterns(text: string): number {
  let count = 0;
  for (const pattern of AI_PATTERNS_STRONG) {
    if (pattern.test(text)) {
      count++;
    }
  }
  return count;
}

/**
 * Count formal/corporate language patterns
 */
function countFormalPatterns(text: string): number {
  let count = 0;
  for (const pattern of FORMAL_PATTERNS) {
    if (pattern.test(text)) {
      count++;
    }
  }
  return count;
}

/**
 * Count authenticity markers (casual language)
 */
function countAuthenticityMarkers(text: string): number {
  let count = 0;
  for (const pattern of AUTHENTICITY_MARKERS) {
    if (pattern.test(text)) {
      count++;
    }
  }
  return count;
}

/**
 * Count words in text
 */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Check if text is too long for natural Reddit content
 * Posts should be < 80 words, comments < 30 words
 * Normal people don't write essays on Reddit lol
 */
function isContentTooLong(text: string, isPost: boolean): boolean {
  const wordCount = countWords(text);
  return isPost ? wordCount > 80 : wordCount > 30;
}

/**
 * Count dashes in text that indicate AI-generated content.
 * Detects: em-dashes (—), en-dashes (–), and spaced hyphens ( - )
 * Does NOT penalize normal hyphenated words like "well-known"
 */
export function countDashes(texts: string[]): number {
  let count = 0;
  for (const text of texts) {
    // Em-dash (—) - very common in AI text
    count += (text.match(/—/g) || []).length;
    // En-dash (–) - also common in AI text
    count += (text.match(/–/g) || []).length;
    // Spaced hyphen ( - ) used as dash punctuation, not in compound words
    count += (text.match(/\s-\s/g) || []).length;
    // Double hyphen (--) used as dash
    count += (text.match(/--/g) || []).length;
  }
  return count;
}

/**
 * Calculate RISK score - measures how likely content will be detected as AI/promotional
 *
 * Higher score = MORE risky (more likely to be flagged as astroturfing)
 * 0.0 = safe, natural content
 * 1.0 = obvious astroturfing, will get flagged
 */
export function calculateRiskScore(
  comments: PlannedThreadComment[],
  postAuthorId: string,
  postBody?: string,
  productName?: string
): number {
  let risk = 0;

  const allTexts = comments.map((c) => c.text);
  if (postBody) allTexts.push(postBody);
  const commentTexts = comments.map((c) => c.text);

  // === URL/LINK DETECTION (very risky) ===
  const prohibitedCount = countProhibitedContent(allTexts);
  if (prohibitedCount > 0) {
    risk += 0.3 * Math.min(prohibitedCount, 3);
  }

  // === MARKETING BUZZWORDS (sounds promotional) ===
  const buzzwordCount = allTexts.filter((t) =>
    MARKETING_BUZZWORDS.test(t)
  ).length;
  if (buzzwordCount > 0) {
    risk += 0.15 * Math.min(buzzwordCount, 2);
  }

  // === AI-LIKE PATTERNS (sounds robotic) ===
  let totalAiPatterns = 0;
  for (const text of commentTexts) {
    totalAiPatterns += countAiPatterns(text);
  }

  if (totalAiPatterns > 0) {
    if (totalAiPatterns >= 5) {
      risk += 0.4;
    } else if (totalAiPatterns >= 3) {
      risk += 0.25;
    } else {
      risk += 0.1 * totalAiPatterns;
    }
  }

  // === AI FILLER WORDS (sounds robotic) ===
  const fillerCount = commentTexts.filter((t) =>
    AI_FILLER_WORDS.test(t)
  ).length;
  if (fillerCount >= 2) {
    risk += 0.1;
  }

  // === LENGTH CHECK (AI writes too much) ===
  // Real Reddit comments are short. Long = AI.
  if (postBody && isContentTooLong(postBody, true)) {
    risk += 0.15; // Post body too long
  }
  const longComments = commentTexts.filter((t) => isContentTooLong(t, false));
  if (longComments.length > 0) {
    risk += 0.1 * Math.min(longComments.length, 3); // Each long comment adds risk
  }

  // === FORMAL LANGUAGE CHECK (sounds corporate, not Reddit) ===
  let totalFormalPatterns = 0;
  for (const text of allTexts) {
    totalFormalPatterns += countFormalPatterns(text);
  }
  if (totalFormalPatterns >= 3) {
    risk += 0.2; // Very formal
  } else if (totalFormalPatterns >= 1) {
    risk += 0.1 * totalFormalPatterns;
  }

  // === DASH DETECTION (AI-generated content often uses dashes) ===
  const dashCount = countDashes(allTexts);
  if (dashCount >= 3) {
    risk += 0.25; // Multiple dashes = very AI-like
  } else if (dashCount >= 1) {
    risk += 0.1 * dashCount;
  }

  // === AUTHENTICITY BONUS (casual language reduces risk) ===
  let totalAuthenticityMarkers = 0;
  for (const text of allTexts) {
    totalAuthenticityMarkers += countAuthenticityMarkers(text);
  }
  if (totalAuthenticityMarkers >= 2) {
    risk -= 0.15; // Multiple casual markers = more natural
  } else if (totalAuthenticityMarkers >= 1) {
    risk -= 0.05;
  }

  // === PRODUCT MENTION SATURATION (astroturfing signal) ===
  if (productName && productName.length > 0) {
    const productMentionCount = allTexts.filter((t) =>
      t.toLowerCase().includes(productName.toLowerCase())
    ).length;
    const mentionRatio = productMentionCount / allTexts.length;

    if (mentionRatio >= 0.75) {
      risk += 0.4;
    } else if (mentionRatio >= 0.5) {
      risk += 0.25;
    } else if (mentionRatio >= 0.25) {
      risk += 0.1;
    }
  }

  // === COORDINATED SHILLING (multiple non-OP users recommending same product) ===
  if (productName && productName.length > 0) {
    const nonOpMentioners = comments.filter(
      (c) =>
        c.authorPersona.id !== postAuthorId &&
        c.text.toLowerCase().includes(productName.toLowerCase())
    );
    if (nonOpMentioners.length >= 2) {
      risk += 0.2;
    }
  }

  // === OP FISHING (OP asks follow-up about the promoted product) ===
  if (productName && productName.length > 0) {
    const opComments = comments.filter(
      (c) => c.authorPersona.id === postAuthorId
    );
    const opMentionsProduct = opComments.some((c) =>
      c.text.toLowerCase().includes(productName.toLowerCase())
    );
    const opAsksQuestion = opComments.some(
      (c) => c.text.includes("?") && c.replyToIndex !== null
    );
    if (opAsksQuestion && !opMentionsProduct) {
      risk += 0.1;
    }
  }

  return Math.max(0, Math.min(1, risk));
}

/**
 * Calculate QUALITY score - measures thread structure and naturalness
 *
 * Higher score = better quality conversation structure
 * This is separate from risk - a thread can have good structure but still be risky
 */
export function calculateThreadQuality(
  comments: PlannedThreadComment[],
  postAuthorId: string
): number {
  let score = 0.5;

  // === COMMENTER VARIETY ===
  const uniqueCommenters = new Set(comments.map((c) => c.authorPersona.id));
  if (uniqueCommenters.size >= 2 && uniqueCommenters.size <= 4) {
    score += 0.1;
  }

  // === FIRST COMMENTER NOT OP ===
  if (comments.length > 0 && comments[0].authorPersona.id !== postAuthorId) {
    score += 0.1;
  }

  // === MIX OF TOP-LEVEL AND REPLIES ===
  const topLevelCount = comments.filter((c) => c.replyToIndex === null).length;
  const replyCount = comments.length - topLevelCount;
  if (topLevelCount > 0 && replyCount > 0) {
    score += 0.15;
  }

  // === CONVERSATION DEPTH ===
  const hasDepth = comments.some(
    (c) => c.replyToIndex !== null && c.replyToIndex > 0
  );
  if (hasDepth) {
    score += 0.1;
  }

  // === OP PARTICIPATES ===
  const opParticipates = comments.some(
    (c) => c.authorPersona.id === postAuthorId
  );
  if (opParticipates) {
    score += 0.1;
  }

  // === NATURAL TIMING ===
  let hasGoodTiming = true;
  for (let i = 1; i < comments.length; i++) {
    const gap =
      comments[i].scheduledAt.getTime() - comments[i - 1].scheduledAt.getTime();
    const gapMinutes = gap / (1000 * 60);
    if (gapMinutes < 3 || gapMinutes > 120) {
      hasGoodTiming = false;
      break;
    }
  }
  if (hasGoodTiming) {
    score += 0.05;
  }

  // === COMMENT FREQUENCY BALANCE ===
  const commentCounts = new Map<string, number>();
  for (const comment of comments) {
    const count = commentCounts.get(comment.authorPersona.id) || 0;
    commentCounts.set(comment.authorPersona.id, count + 1);
  }
  for (const [personaId, count] of commentCounts) {
    if (count > 1 && personaId !== postAuthorId) {
      score -= 0.1;
    }
    if (count > 2) {
      score -= 0.15;
    }
  }

  // === COMMENT LENGTH VARIETY ===
  if (comments.length >= 2) {
    const lengths = comments.map((c) => countWords(c.text));
    const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;

    const variance =
      lengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) /
      lengths.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev >= 5) {
      score += 0.1;
    } else if (stdDev < 3) {
      score -= 0.15;
    }

    const hasSuperShort = lengths.some((len) => len <= 5);
    if (hasSuperShort) {
      score += 0.05;
    }
  }

  return Math.max(0, Math.min(1, score));
}
