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
  _keywords: Keyword[],
  _companyInfo: CompanyInfo
): Promise<GeneratedPost> {
  const prompt = `You are ${persona.username}, posting on Reddit in r/${subreddit.name}.

YOUR BACKGROUND:
${persona.bio || "A regular Reddit user"}

THE POST:
- Topic: ${topic}
- Angle/Question: ${angle}
- Subreddit: r/${subreddit.name}

CRITICAL STYLE RULES (follow exactly):
1. Keep it SHORT. Title: 5-10 words. Body: 1-2 sentences MAX, under 30 words total.
2. Write casually like real Reddit. Use "lol", "!!", "tbh", "sorta", "gonna" etc.
3. Be imperfect. Use fragments. Skip proper grammar sometimes.
4. NO corporate speak. Never say "workflow", "optimize", "leverage", "hierarchy".
5. Do NOT explain your background. Just ask the question directly.
6. NO product names in the post. You're asking for recommendations.
7. NO URLs or links ever.
8. NO dashes. Reword instead.

GOOD EXAMPLES:
- "Best AI Presentation Maker?" / "Just like it says in the title, what is the best AI Presentation Maker? Looking for something that makes slides I can edit. Any help appreciated."
- "Slideforge vs Canva for slides?" / "I love Canva but trying to automate more of my slides. Heard about Slideforge but unsure if it's any good."

BAD EXAMPLES (too long, too formal):
- "I run ops at a small startup so presentation design is my weird superpower..." (nobody talks like this)
- "I'm curious about workflows, specifically whether..." (too corporate)

Respond in JSON:
{
  "title": "Short punchy title?",
  "body": "2-3 casual sentences max"
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
      const fixed = fixNewlinesInJsonStrings(content);
      const parsed = JSON.parse(fixed);
      return {
        title: parsed.title || topic,
        body: parsed.body || angle,
      };
    } catch (parseError) {
      console.error("JSON Parse Error (Post):", parseError);
      console.error("Raw content:", JSON.stringify(content));
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
 * Length styles for comment variety
 */
type CommentLength = "ultra_short" | "short" | "medium";

const LENGTH_GUIDANCE: Record<CommentLength, string> = {
  ultra_short: `LENGTH: Ultra short (1-5 words). Just "+1 ProductName" or "Same!!" or "This ^" or "lol yea"`,
  short: `LENGTH: Short (5-10 words). One quick sentence or fragment.`,
  medium: `LENGTH: Medium (10-18 words). One full sentence, maybe two short ones.`,
};

const LENGTH_EXAMPLES: Record<CommentLength, string[]> = {
  ultra_short: ["+1 Slideforge", "Same!!", "This ^", "lol yea", "^ seconded"],
  short: [
    "Sweet I'll check it out!!",
    "Yea it's pretty solid tbh",
    "I use it for decks lol",
  ],
  medium: [
    "Yea Claude's slide output always looks really funky lol",
    "I hate picking fonts lol. Slideforge's defaults save my sanity.",
  ],
};

/**
 * Generates a comment in the persona's voice
 *
 * @param intent - Optional intent from the orchestrator describing what angle/purpose this comment should have
 * @param commentIndex - Position in the thread (0, 1, 2...) to vary comment lengths
 */
export async function generateCommentContent(
  persona: Persona,
  postTitle: string,
  postBody: string,
  parentComment: string | null,
  isAuthorReply: boolean,
  companyInfo: CompanyInfo,
  intent?: string,
  commentIndex: number = 0
): Promise<GeneratedComment> {
  const companyName = companyInfo.website?.replace(/\..*/, "") || "the tool";

  const context = parentComment
    ? `You are replying to this comment: "${parentComment}"`
    : `You are leaving a top-level comment on the post`;

  const productMention = isAuthorReply
    ? "You should NOT mention any product - just thank them or ask a follow-up question"
    : `You can naturally mention "${companyName}" by name only if it fits your experience, but don't be pushy. A brief mention is fine. NEVER include a URL or link to the product.`;

  const intentGuidance = intent ? `\nYOUR GOAL: ${intent}` : "";

  // Vary comment lengths for natural thread appearance
  // Pattern: first comment medium, second ultra-short or short, third varies
  const lengthPatterns: CommentLength[][] = [
    ["medium", "ultra_short", "short"],
    ["short", "ultra_short", "medium"],
    ["medium", "short", "ultra_short"],
  ];
  const patternIndex = Math.floor(Math.random() * lengthPatterns.length);
  const pattern = lengthPatterns[patternIndex];
  const targetLength = pattern[commentIndex % pattern.length];

  const lengthRule = LENGTH_GUIDANCE[targetLength];
  const examples = LENGTH_EXAMPLES[targetLength];

  const prompt = `You are ${persona.username}, commenting on Reddit.
${intentGuidance}

POST: "${postTitle}"
${context}

CRITICAL RULES:
1. ${lengthRule}
2. Use casual language: "lol", "!!", "yea", "tbh", "sorta" etc.
3. Fragments OK. Skip grammar rules sometimes.
4. ${productMention}
5. NO corporate words: "workflow", "leverage", "hierarchy", "functionality"
6. NO URLs ever.
7. NO dashes.

GOOD EXAMPLES for this length:
${examples.map((e) => `- "${e}"`).join("\n")}

BAD (too long/formal):
- "I used Slideforge for a classroom pitch and a small grant deck, it gives really clean layouts" (way too long)
- "Thanks, really helpful. Which template did you use?" (too polite/formal)

Respond in JSON:
{
  "text": "your comment here"
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
      const fixed = fixNewlinesInJsonStrings(content);
      const parsed = JSON.parse(fixed);
      return {
        text: parsed.text || "Thanks for sharing!",
      };
    } catch (parseError) {
      console.error("JSON Parse Error (Comment):", parseError);
      console.error("Raw content:", JSON.stringify(content));
      throw parseError;
    }
  } catch (error) {
    console.error("Error generating comment:", error);
    return {
      text: "Thanks for sharing!",
    };
  }
}

function fixNewlinesInJsonStrings(content: string): string {
  let result = "";
  let inString = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (char === '"' && (i === 0 || content[i - 1] !== "\\")) {
      inString = !inString;
      result += char;
    } else if (char === "\n" && inString) {
      result += "\\n";
    } else {
      result += char;
    }
  }

  return result;
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
