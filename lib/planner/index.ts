import { supabase } from "../supabase";
import {
  Persona,
  Subreddit,
  Keyword,
  PlannedPost,
  PlannedComment,
  CompanyInfo,
} from "../types";
import { selectSubredditsForWeek } from "./subreddit-selector";
import { selectPostAuthor, selectCommenters } from "./persona-selector";
import { generateTopic, recordTopicUsage } from "./topic-generator";
import { generatePostContent, generateDedupeHash } from "./content-generator";
import {
  planCommentThread,
  calculateThreadQuality,
  calculateRiskScore,
} from "./thread-planner";

interface GenerationResult {
  weeklyPlanId: string;
  postsGenerated: number;
  commentsGenerated: number;
  errors: string[];
}

export interface ProgressEvent {
  step:
    | "plan_created"
    | "generating_topic"
    | "generating_post"
    | "generating_comments"
    | "post_complete";
  postIndex?: number;
  subredditName?: string;
  message: string;
}

type ProgressCallback = (event: ProgressEvent) => void;

/**
 * Main orchestrator for generating a weekly content calendar.
 *
 * This function coordinates all the planning modules to:
 * 1. Select appropriate subreddits for the week
 * 2. Assign personas to posts
 * 3. Generate unique topics
 * 4. Create natural post content
 * 5. Plan comment threads
 * 6. Save everything to the database
 */
export async function generateWeeklyCalendar(
  campaignId: string,
  weekStartDate: Date
): Promise<GenerationResult> {
  const errors: string[] = [];

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .single();

  if (campaignError || !campaign) {
    throw new Error(`Campaign not found: ${campaignError?.message}`);
  }

  const { data: personas } = await supabase
    .from("personas")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("is_active", true);

  const { data: subreddits } = await supabase
    .from("subreddits")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("is_active", true);

  const { data: keywords } = await supabase
    .from("keywords")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("is_active", true);

  if (!personas?.length) {
    throw new Error("No active personas found for campaign");
  }

  if (!subreddits?.length) {
    throw new Error("No active subreddits found for campaign");
  }

  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 7);

  const { data: existingPosts } = await supabase
    .from("planned_posts")
    .select("*")
    .eq("campaign_id", campaignId)
    .gte("scheduled_at", weekStartDate.toISOString())
    .lt("scheduled_at", weekEndDate.toISOString());

  const { data: existingComments } = await supabase
    .from("planned_comments")
    .select("*")
    .eq("campaign_id", campaignId);

  const { data: weeklyPlan, error: planError } = await supabase
    .from("weekly_plans")
    .insert({
      campaign_id: campaignId,
      week_start_date: weekStartDate.toISOString().split("T")[0],
      status: "generating",
      plan_json: { generated_at: new Date().toISOString() },
    })
    .select()
    .single();

  if (planError || !weeklyPlan) {
    throw new Error(`Failed to create weekly plan: ${planError?.message}`);
  }

  const subredditSelections = selectSubredditsForWeek(
    subreddits as Subreddit[],
    campaign.posts_per_week,
    (existingPosts || []) as PlannedPost[]
  );

  let postsGenerated = 0;
  let commentsGenerated = 0;
  const companyInfo: CompanyInfo = campaign.company_info || {};
  const usedKeywordCodes = new Set<string>();

  for (let i = 0; i < subredditSelections.length; i++) {
    const { subreddit } = subredditSelections[i];

    try {
      const dayOffset = Math.floor((i / subredditSelections.length) * 7);
      const postDate = new Date(weekStartDate);
      postDate.setUTCDate(postDate.getUTCDate() + dayOffset);
      postDate.setUTCHours(9 + Math.floor(Math.random() * 11));
      postDate.setUTCMinutes(Math.floor(Math.random() * 60));

      const authorSelection = selectPostAuthor(
        personas as Persona[],
        subreddit,
        (existingPosts || []) as PlannedPost[],
        (existingComments || []) as PlannedComment[]
      );

      if (!authorSelection) {
        errors.push(`No available author for subreddit ${subreddit.name}`);
        continue;
      }

      const topic = await generateTopic(
        subreddit,
        (keywords || []) as Keyword[],
        companyInfo,
        campaignId,
        usedKeywordCodes
      );

      topic.matchedKeywords.forEach((k) =>
        usedKeywordCodes.add(k.keyword_code)
      );

      const postContent = await generatePostContent(
        authorSelection.persona,
        subreddit,
        topic.topic,
        topic.angle,
        topic.matchedKeywords,
        companyInfo
      );

      const { data: post, error: postError } = await supabase
        .from("planned_posts")
        .insert({
          campaign_id: campaignId,
          weekly_plan_id: weeklyPlan.id,
          subreddit_name: subreddit.name,
          author_persona_id: authorSelection.persona.id,
          post_type: "post",
          title: postContent.title,
          body: postContent.body,
          target_keyword_codes: topic.matchedKeywords.map(
            (k) => k.keyword_code
          ),
          topic_key: topic.topicKey,
          scheduled_at: postDate.toISOString(),
          quality_score: 0.7,
          risk_score: 0.2,
          dedupe_hash: generateDedupeHash(
            subreddit.name,
            topic.topicKey,
            postContent.title
          ),
        })
        .select()
        .single();

      if (postError || !post) {
        errors.push(`Failed to create post: ${postError?.message}`);
        continue;
      }

      postsGenerated++;
      await recordTopicUsage(campaignId, topic.topicKey, subreddit.name);

      const commenterSelections = selectCommenters(
        personas as Persona[],
        authorSelection.persona.id,
        (existingPosts || []) as PlannedPost[],
        (existingComments || []) as PlannedComment[]
      );

      const threadPlan = await planCommentThread(
        postContent.title,
        postContent.body,
        authorSelection.persona,
        commenterSelections.map((s) => s.persona),
        postDate,
        companyInfo
      );

      const productName = companyInfo.website?.replace(/\..*/, "") || "";
      const threadQuality = calculateThreadQuality(
        threadPlan.comments,
        authorSelection.persona.id
      );
      const threadRisk = calculateRiskScore(
        threadPlan.comments,
        authorSelection.persona.id,
        postContent.body,
        productName
      );

      await supabase
        .from("planned_posts")
        .update({ quality_score: threadQuality, risk_score: threadRisk })
        .eq("id", post.id);

      const commentIdMap = new Map<number, string>();

      for (let j = 0; j < threadPlan.comments.length; j++) {
        const comment = threadPlan.comments[j];

        const replyToId =
          comment.replyToIndex !== null
            ? commentIdMap.get(comment.replyToIndex)
            : null;

        const { data: savedComment, error: commentError } = await supabase
          .from("planned_comments")
          .insert({
            campaign_id: campaignId,
            planned_post_id: post.id,
            author_persona_id: comment.authorPersona.id,
            reply_to_comment_id: replyToId,
            comment_text: comment.text,
            scheduled_at: comment.scheduledAt.toISOString(),
            quality_score: threadQuality,
          })
          .select()
          .single();

        if (commentError) {
          errors.push(`Failed to create comment: ${commentError.message}`);
        } else if (savedComment) {
          commentIdMap.set(j, savedComment.id);
          commentsGenerated++;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      errors.push(`Error generating post for ${subreddit.name}: ${message}`);
    }
  }

  await supabase
    .from("weekly_plans")
    .update({
      status: "ready",
      plan_json: {
        generated_at: new Date().toISOString(),
        posts_count: postsGenerated,
        comments_count: commentsGenerated,
      },
    })
    .eq("id", weeklyPlan.id);

  return {
    weeklyPlanId: weeklyPlan.id,
    postsGenerated,
    commentsGenerated,
    errors,
  };
}

/**
 * Generate content for an existing weekly plan (used by SSE streaming).
 * The weekly plan must already exist with status "generating".
 */
export async function generateContentForPlan(
  weeklyPlanId: string,
  onProgress?: ProgressCallback
): Promise<GenerationResult> {
  const errors: string[] = [];

  const { data: weeklyPlan, error: planError } = await supabase
    .from("weekly_plans")
    .select("*")
    .eq("id", weeklyPlanId)
    .single();

  if (planError || !weeklyPlan) {
    throw new Error(`Weekly plan not found: ${planError?.message}`);
  }

  const campaignId = weeklyPlan.campaign_id;
  const weekStartDate = new Date(weeklyPlan.week_start_date + "T00:00:00Z");

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .single();

  if (campaignError || !campaign) {
    throw new Error(`Campaign not found: ${campaignError?.message}`);
  }

  const { data: personas } = await supabase
    .from("personas")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("is_active", true);

  const { data: subreddits } = await supabase
    .from("subreddits")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("is_active", true);

  const { data: keywords } = await supabase
    .from("keywords")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("is_active", true);

  if (!personas?.length) {
    throw new Error("No active personas found for campaign");
  }

  if (!subreddits?.length) {
    throw new Error("No active subreddits found for campaign");
  }

  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 7);

  const { data: existingPosts } = await supabase
    .from("planned_posts")
    .select("*")
    .eq("campaign_id", campaignId)
    .gte("scheduled_at", weekStartDate.toISOString())
    .lt("scheduled_at", weekEndDate.toISOString());

  const { data: existingComments } = await supabase
    .from("planned_comments")
    .select("*")
    .eq("campaign_id", campaignId);

  onProgress?.({
    step: "plan_created",
    message: "🚀 Starting content generation...",
  });

  const subredditSelections = selectSubredditsForWeek(
    subreddits as Subreddit[],
    campaign.posts_per_week,
    (existingPosts || []) as PlannedPost[]
  );

  onProgress?.({
    step: "plan_created",
    message: `📋 Planning ${subredditSelections.length} posts across ${new Set(subredditSelections.map((s) => s.subreddit.name)).size} subreddits`,
  });

  let postsGenerated = 0;
  let commentsGenerated = 0;
  const companyInfo: CompanyInfo = campaign.company_info || {};
  const usedKeywordCodes = new Set<string>();

  for (let i = 0; i < subredditSelections.length; i++) {
    const { subreddit } = subredditSelections[i];

    try {
      onProgress?.({
        step: "generating_topic",
        postIndex: i + 1,
        subredditName: subreddit.name,
        message: `📝 [Post ${i + 1}/${subredditSelections.length}] Starting r/${subreddit.name}...`,
      });

      const dayOffset = Math.floor((i / subredditSelections.length) * 7);
      const postDate = new Date(weekStartDate);
      postDate.setUTCDate(postDate.getUTCDate() + dayOffset);
      postDate.setUTCHours(9 + Math.floor(Math.random() * 11));
      postDate.setUTCMinutes(Math.floor(Math.random() * 60));

      const authorSelection = selectPostAuthor(
        personas as Persona[],
        subreddit,
        (existingPosts || []) as PlannedPost[],
        (existingComments || []) as PlannedComment[]
      );

      if (!authorSelection) {
        errors.push(`No available author for subreddit ${subreddit.name}`);
        onProgress?.({
          step: "generating_topic",
          postIndex: i + 1,
          subredditName: subreddit.name,
          message: `⚠️ No available author for r/${subreddit.name}, skipping...`,
        });
        continue;
      }

      onProgress?.({
        step: "generating_topic",
        postIndex: i + 1,
        subredditName: subreddit.name,
        message: `🎭 Selected persona: u/${authorSelection.persona.username} (${authorSelection.reason})`,
      });

      onProgress?.({
        step: "generating_topic",
        postIndex: i + 1,
        subredditName: subreddit.name,
        message: `🧠 Generating topic for r/${subreddit.name}...`,
      });

      const topic = await generateTopic(
        subreddit,
        (keywords || []) as Keyword[],
        companyInfo,
        campaignId,
        usedKeywordCodes
      );

      topic.matchedKeywords.forEach((k) =>
        usedKeywordCodes.add(k.keyword_code)
      );

      const keywordDisplay =
        topic.matchedKeywords.length > 0
          ? topic.matchedKeywords.map((k) => k.keyword_code).join(", ")
          : "organic";
      onProgress?.({
        step: "generating_topic",
        postIndex: i + 1,
        subredditName: subreddit.name,
        message: `💡 Topic: "${topic.topic}" [${keywordDisplay}]`,
      });

      onProgress?.({
        step: "generating_post",
        postIndex: i + 1,
        subredditName: subreddit.name,
        message: `✍️ Writing post as u/${authorSelection.persona.username}...`,
      });

      const postContent = await generatePostContent(
        authorSelection.persona,
        subreddit,
        topic.topic,
        topic.angle,
        topic.matchedKeywords,
        companyInfo
      );

      const wordCount = postContent.body.split(/\s+/).length;
      onProgress?.({
        step: "generating_post",
        postIndex: i + 1,
        subredditName: subreddit.name,
        message: `📄 Generated post: "${postContent.title.slice(0, 50)}${postContent.title.length > 50 ? "..." : ""}" (${wordCount} words)`,
      });

      const { data: post, error: postError } = await supabase
        .from("planned_posts")
        .insert({
          campaign_id: campaignId,
          weekly_plan_id: weeklyPlanId,
          subreddit_name: subreddit.name,
          author_persona_id: authorSelection.persona.id,
          post_type: "post",
          title: postContent.title,
          body: postContent.body,
          target_keyword_codes: topic.matchedKeywords.map(
            (k) => k.keyword_code
          ),
          topic_key: topic.topicKey,
          scheduled_at: postDate.toISOString(),
          quality_score: 0.7,
          risk_score: 0.2,
          dedupe_hash: generateDedupeHash(
            subreddit.name,
            topic.topicKey,
            postContent.title
          ),
        })
        .select()
        .single();

      if (postError || !post) {
        errors.push(`Failed to create post: ${postError?.message}`);
        onProgress?.({
          step: "generating_post",
          postIndex: i + 1,
          subredditName: subreddit.name,
          message: `❌ Failed to save post: ${postError?.message}`,
        });
        continue;
      }

      postsGenerated++;
      await recordTopicUsage(campaignId, topic.topicKey, subreddit.name);

      onProgress?.({
        step: "generating_post",
        postIndex: i + 1,
        subredditName: subreddit.name,
        message: `💾 Saved post, scheduled for ${postDate.toLocaleDateString()}`,
      });

      onProgress?.({
        step: "generating_comments",
        postIndex: i + 1,
        subredditName: subreddit.name,
        message: `💬 Planning comment thread...`,
      });

      const commenterSelections = selectCommenters(
        personas as Persona[],
        authorSelection.persona.id,
        (existingPosts || []) as PlannedPost[],
        (existingComments || []) as PlannedComment[]
      );

      const commenterNames = commenterSelections
        .map((s) => `u/${s.persona.username}`)
        .join(", ");
      onProgress?.({
        step: "generating_comments",
        postIndex: i + 1,
        subredditName: subreddit.name,
        message: `👥 Selected commenters: ${commenterNames || "none"}`,
      });

      onProgress?.({
        step: "generating_comments",
        postIndex: i + 1,
        subredditName: subreddit.name,
        message: `🧵 Generating natural conversation thread...`,
      });

      const threadPlan = await planCommentThread(
        postContent.title,
        postContent.body,
        authorSelection.persona,
        commenterSelections.map((s) => s.persona),
        postDate,
        companyInfo
      );

      const productName = companyInfo.website?.replace(/\..*/, "") || "";
      const threadQuality = calculateThreadQuality(
        threadPlan.comments,
        authorSelection.persona.id
      );
      const threadRisk = calculateRiskScore(
        threadPlan.comments,
        authorSelection.persona.id,
        postContent.body,
        productName
      );

      onProgress?.({
        step: "generating_comments",
        postIndex: i + 1,
        subredditName: subreddit.name,
        message: `📊 Quality: ${Math.round(threadQuality * 100)}% | Risk: ${Math.round(threadRisk * 100)}%`,
      });

      await supabase
        .from("planned_posts")
        .update({ quality_score: threadQuality, risk_score: threadRisk })
        .eq("id", post.id);

      const commentIdMap = new Map<number, string>();

      for (let j = 0; j < threadPlan.comments.length; j++) {
        const comment = threadPlan.comments[j];
        const replyToId =
          comment.replyToIndex !== null
            ? commentIdMap.get(comment.replyToIndex)
            : null;

        const { data: savedComment, error: commentError } = await supabase
          .from("planned_comments")
          .insert({
            campaign_id: campaignId,
            planned_post_id: post.id,
            author_persona_id: comment.authorPersona.id,
            reply_to_comment_id: replyToId,
            comment_text: comment.text,
            scheduled_at: comment.scheduledAt.toISOString(),
            quality_score: threadQuality,
          })
          .select()
          .single();

        if (commentError) {
          errors.push(`Failed to create comment: ${commentError.message}`);
        } else if (savedComment) {
          commentIdMap.set(j, savedComment.id);
          commentsGenerated++;
        }
      }

      onProgress?.({
        step: "generating_comments",
        postIndex: i + 1,
        subredditName: subreddit.name,
        message: `💾 Saved ${threadPlan.comments.length} comments`,
      });

      onProgress?.({
        step: "post_complete",
        postIndex: i + 1,
        subredditName: subreddit.name,
        message: `✅ Completed post ${i + 1}/${subredditSelections.length} for r/${subreddit.name}`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      errors.push(`Error generating post for ${subreddit.name}: ${message}`);
    }
  }

  await supabase
    .from("weekly_plans")
    .update({
      status: "ready",
      plan_json: {
        generated_at: new Date().toISOString(),
        posts_count: postsGenerated,
        comments_count: commentsGenerated,
      },
    })
    .eq("id", weeklyPlanId);

  return {
    weeklyPlanId,
    postsGenerated,
    commentsGenerated,
    errors,
  };
}

/**
 * Get the start of the next week (Monday) in UTC
 */
export function getNextWeekStart(fromDate: Date = new Date()): Date {
  const date = new Date(fromDate);
  const day = date.getUTCDay();
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  date.setUTCDate(date.getUTCDate() + daysUntilMonday);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

/**
 * Get the start of the current week (Monday) in UTC
 */
export function getCurrentWeekStart(fromDate: Date = new Date()): Date {
  const date = new Date(fromDate);
  const day = date.getUTCDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}
