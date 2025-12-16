import { openai } from "../openai";
import { Persona, Subreddit, Keyword, CompanyInfo } from "../types";

interface GeneratedPost {
  title: string;
  body: string;
}

interface GeneratedComment {
  text: string;
}

/**
 * Generates a Reddit post in the persona's voice that feels natural
 */
export async function generatePostContent(
  persona: Persona,
  subreddit: Subreddit,
  topic: string,
  angle: string,
  keywords: Keyword[],
  _companyInfo: CompanyInfo
): Promise<GeneratedPost> {
  const keywordTexts = keywords.map((k) => k.keyword_text).join(", ");

  const prompt = `You are ${persona.username}, posting on Reddit in r/${subreddit.name}.

YOUR BACKGROUND:
${persona.bio || "A regular Reddit user"}

YOUR WRITING STYLE:
${getVoiceDescription(persona)}

THE POST:
- Topic: ${topic}
- Angle/Question: ${angle}
- Subreddit: r/${subreddit.name}

IMPORTANT GUIDELINES:
1. Write as if you are genuinely asking for help or starting a discussion
2. Use your personal experience and background naturally
3. Do NOT mention any specific product or company name in the original post
4. The post should attract people searching for: ${keywordTexts}
5. Keep it concise, Reddit posts shouldn't be essays
6. Match the tone of r/${subreddit.name}
7. Sound like a real person, not a marketer
8. NEVER use dashes (-) anywhere in the text. Use commas, periods, or reword instead. Dashes look too AI-generated.

Generate a Reddit post with a title and body.

Respond in JSON format:
{
  "title": "Your post title",
  "body": "Your post body (2-4 paragraphs max)"
}`;

  try {
    const response = await openai.responses.create({
      model: "gpt-5-mini",
      input: [
        {
          role: "system",
          content: `You are ${persona.username}, a real Reddit user. Write authentically in your voice. Always respond with valid JSON only, no markdown.`,
        },
        { role: "user", content: prompt },
      ],
      reasoning: { effort: "low" },
      text: { verbosity: "low" },
    });

    const content = response.output_text || "{}";

    try {
      const parsed = JSON.parse(content);
      return {
        title: parsed.title || topic,
        body: parsed.body || angle,
      };
    } catch (parseError) {
      console.error("JSON Parse Error (Post):", parseError, content);
      throw parseError;
    }
  } catch (error) {
    console.error("Error generating post:", error);
    return {
      title: topic,
      body: angle,
    };
  }
}

/**
 * Generates a comment in the persona's voice
 *
 * @param intent - Optional intent from the orchestrator describing what angle/purpose this comment should have
 */
export async function generateCommentContent(
  persona: Persona,
  postTitle: string,
  postBody: string,
  parentComment: string | null,
  isAuthorReply: boolean,
  companyInfo: CompanyInfo,
  intent?: string
): Promise<GeneratedComment> {
  const companyName = companyInfo.website?.replace(/\..*/, "") || "the tool";

  const context = parentComment
    ? `You are replying to this comment: "${parentComment}"`
    : `You are leaving a top-level comment on the post`;

  const productMention = isAuthorReply
    ? "You should NOT mention any product - just thank them or ask a follow-up question"
    : `You can naturally mention ${companyName} if it fits your experience, but don't be pushy. A brief mention is fine.`;

  const intentGuidance = intent
    ? `\nYOUR GOAL FOR THIS COMMENT: ${intent}`
    : "";

  const prompt = `You are ${persona.username}, commenting on a Reddit post.

YOUR BACKGROUND:
${persona.bio || "A regular Reddit user"}

YOUR WRITING STYLE:
${getVoiceDescription(persona)}
${intentGuidance}

THE POST:
Title: ${postTitle}
Body: ${postBody}

${context}

GUIDELINES:
1. Write a natural Reddit comment in your voice
2. Share from your genuine experience
3. ${productMention}
4. Keep it concise (1-3 sentences typically)
5. Sound helpful, not salesy
6. ${isAuthorReply ? "As the original poster, you're responding to helpful advice" : "You're sharing your experience or opinion"}
7. NEVER use dashes (-) anywhere in the text. Use commas, periods, or reword instead. Dashes look too AI-generated.
${intent ? `8. Make sure your comment achieves this goal: ${intent}` : ""}

Respond in JSON format:
{
  "text": "Your comment text"
}`;

  try {
    const response = await openai.responses.create({
      model: "gpt-5-mini",
      input: [
        {
          role: "system",
          content: `You are ${persona.username}, a real Reddit user. Write short, authentic comments. Always respond with valid JSON only, no markdown.`,
        },
        { role: "user", content: prompt },
      ],
      reasoning: { effort: "low" },
      text: { verbosity: "low" },
    });

    const content = response.output_text || "{}";

    try {
      const parsed = JSON.parse(content);
      return {
        text: parsed.text || "Thanks for sharing!",
      };
    } catch (parseError) {
      console.error("JSON Parse Error (Comment):", parseError, content);
      throw parseError;
    }
  } catch (error) {
    console.error("Error generating comment:", error);
    return {
      text: "Thanks for sharing!",
    };
  }
}

function getVoiceDescription(_persona: Persona): string {
  return "Write authentically based on the background and personality in your bio. Let your voice emerge naturally from who you are.";
}

export function generateDedupeHash(
  subredditName: string,
  topicKey: string,
  title: string
): string {
  const str = `${subredditName}:${topicKey}:${title.toLowerCase().slice(0, 50)}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}
