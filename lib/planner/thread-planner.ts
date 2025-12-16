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
      planned.intent
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
 * Calculate a quality score for the thread based on naturalness
 */
export function calculateThreadQuality(
  comments: PlannedThreadComment[],
  postAuthorId: string
): number {
  let score = 0.5;

  const uniqueCommenters = new Set(comments.map((c) => c.authorPersona.id));
  if (uniqueCommenters.size >= 2 && uniqueCommenters.size <= 4) {
    score += 0.1;
  }

  if (comments.length > 0 && comments[0].authorPersona.id !== postAuthorId) {
    score += 0.1;
  }

  const topLevelCount = comments.filter((c) => c.replyToIndex === null).length;
  const replyCount = comments.length - topLevelCount;
  if (topLevelCount > 0 && replyCount > 0) {
    score += 0.15;
  }

  const hasDepth = comments.some(
    (c) => c.replyToIndex !== null && c.replyToIndex > 0
  );
  if (hasDepth) {
    score += 0.1;
  }

  const opParticipates = comments.some(
    (c) => c.authorPersona.id === postAuthorId
  );
  if (opParticipates) {
    score += 0.1;
  }

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

  return Math.max(0, Math.min(1, score));
}
