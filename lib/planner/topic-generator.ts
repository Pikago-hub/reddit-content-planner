import { supabase } from "../supabase";
import { openai } from "../openai";
import { Keyword, Subreddit, TopicMemory, CompanyInfo } from "../types";

interface TopicSuggestion {
  topic: string;
  topicKey: string;
  matchedKeywords: Keyword[];
  angle: string;
}

/**
 * Generates a unique topic for a post that:
 * - Fits the subreddit's culture and topics
 * - Targets relevant keywords
 * - Hasn't been used recently (checks topic_memory)
 * - Feels like a genuine question/discussion, not an ad
 */
export async function generateTopic(
  subreddit: Subreddit,
  keywords: Keyword[],
  companyInfo: CompanyInfo,
  campaignId: string,
  usedKeywordCodes: Set<string> = new Set()
): Promise<TopicSuggestion> {
  const { data: topicMemory } = await supabase
    .from("topic_memory")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("last_used_at", { ascending: false })
    .limit(20);

  const recentTopics = (topicMemory || []).map((t: TopicMemory) => t.topic_key);

  const activeKeywords = keywords.filter((k) => k.is_active);
  const selectedKeywords = selectKeywordsForPost(
    activeKeywords,
    subreddit,
    usedKeywordCodes
  );

  const topic = await generateTopicWithLLM(
    subreddit,
    selectedKeywords,
    companyInfo,
    recentTopics
  );

  return topic;
}

/**
 * Select keywords using round-robin distribution.
 * Prefers keywords that haven't been used yet this week to ensure even coverage.
 */
function selectKeywordsForPost(
  keywords: Keyword[],
  _subreddit: Subreddit,
  usedKeywordCodes: Set<string>
): Keyword[] {
  if (keywords.length === 0) return [];

  const count = Math.min(3, keywords.length);

  const unused = keywords.filter((k) => !usedKeywordCodes.has(k.keyword_code));
  const pool = unused.length >= count ? unused : keywords;

  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Use LLM to generate a natural topic that fits the subreddit
 */
async function generateTopicWithLLM(
  subreddit: Subreddit,
  keywords: Keyword[],
  companyInfo: CompanyInfo,
  recentTopics: string[]
): Promise<TopicSuggestion> {
  const keywordTexts = keywords.map((k) => k.keyword_text).join(", ");

  const prompt = `You are helping create a Reddit post for r/${subreddit.name}.

The post should feel like a genuine question or discussion starter that a real Reddit user would make. It should NOT feel like an advertisement or marketing content.

Subreddit: r/${subreddit.name}
Subreddit focus: ${subreddit.name}

Keywords to naturally work into the discussion: ${keywordTexts}

Company context (for your background understanding, but don't make the post about this company):
- Product type: ${companyInfo.description || "AI-powered presentation tool"}

Topics to AVOID (already used recently):
${recentTopics.slice(0, 5).join("\n") || "None"}

Generate a topic that:
1. Asks a genuine question OR starts a real discussion
2. Would naturally attract people searching for: ${keywordTexts}
3. Fits r/${subreddit.name}'s culture
4. Does NOT directly mention any product or company name
5. Is different from the recent topics listed above
6. NEVER use dashes (-) anywhere in the text. Use commas, periods, or reword instead. Dashes look too AI-generated.

Respond in JSON format:
{
  "topic": "Brief topic description (3-5 words)",
  "topicKey": "unique_snake_case_identifier",
  "angle": "The specific angle or question being asked (1 sentence)"
}`;

  try {
    const response = await openai.responses.create({
      model: "gpt-5-mini",
      input: [
        {
          role: "system",
          content:
            "You generate natural Reddit discussion topics. Always respond with valid JSON only, no markdown.",
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
        topic: parsed.topic || "General discussion",
        topicKey: parsed.topicKey || `topic_${Date.now()}`,
        matchedKeywords: keywords,
        angle: parsed.angle || "Looking for recommendations",
      };
    } catch (parseError) {
      console.error("JSON Parse Error (Topic):", parseError, content);
      throw parseError;
    }
  } catch (error) {
    console.error("Error generating topic:", error);
    return {
      topic: "Tool recommendations",
      topicKey: `topic_${Date.now()}`,
      matchedKeywords: keywords,
      angle: `Looking for the best ${keywords[0]?.keyword_text || "tool"}`,
    };
  }
}

/**
 * Record that a topic was used (for deduplication)
 */
export async function recordTopicUsage(
  campaignId: string,
  topicKey: string,
  subredditName: string
): Promise<void> {
  const { data: existing } = await supabase
    .from("topic_memory")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("topic_key", topicKey)
    .single();

  if (existing) {
    await supabase
      .from("topic_memory")
      .update({
        last_used_at: new Date().toISOString(),
        times_used: (existing.times_used || 0) + 1,
        last_subreddit_name: subredditName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("topic_memory").insert({
      campaign_id: campaignId,
      topic_key: topicKey,
      last_used_at: new Date().toISOString(),
      times_used: 1,
      last_subreddit_name: subredditName,
    });
  }
}
