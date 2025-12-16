export interface Campaign {
  id: string;
  name: string;
  company_name: string;
  company_info: CompanyInfo;
  posts_per_week: number;
  start_date: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface CompanyInfo {
  website?: string;
  description?: string;
  icp?: string;
}

export interface Persona {
  id: string;
  campaign_id: string;
  username: string;
  bio: string;
  is_active: boolean;
  is_operator: boolean;
  created_at: string;
  updated_at: string;
}

export interface Subreddit {
  id: string;
  campaign_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Keyword {
  id: string;
  campaign_id: string;
  keyword_code: string;
  keyword_text: string;
  intent: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WeeklyPlan {
  id: string;
  campaign_id: string;
  week_start_date: string;
  status: "generating" | "ready";
  plan_json: PlanJson;
  created_at: string;
  updated_at: string;
}

export interface PlanJson {
  generated_at?: string;
  posts_count?: number;
  comments_count?: number;
}

export interface PlannedPost {
  id: string;
  campaign_id: string;
  weekly_plan_id: string;
  subreddit_name: string;
  author_persona_id: string;
  post_type: "post" | "comment_thread_seed";
  title: string;
  body: string;
  target_keyword_codes: string[];
  topic_key: string;
  scheduled_at: string | null;
  quality_score: number;
  risk_score: number;
  dedupe_hash: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlannedComment {
  id: string;
  campaign_id: string;
  planned_post_id: string;
  author_persona_id: string;
  reply_to_comment_id: string | null;
  comment_text: string;
  scheduled_at: string | null;
  quality_score: number;
  created_at: string;
  updated_at: string;
}

export interface TopicMemory {
  id: string;
  campaign_id: string;
  topic_key: string;
  last_used_at: string | null;
  times_used: number;
  last_subreddit_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PostSlot {
  subreddit: Subreddit;
  author: Persona;
  keywords: Keyword[];
  topic: string;
  scheduledAt: Date;
}

export interface CommentSlot {
  author: Persona;
  replyToCommentIndex: number | null;
  scheduledAt: Date;
}

export interface ThreadPlan {
  post: PostSlot;
  comments: CommentSlot[];
}

export interface GenerateCalendarRequest {
  campaignId: string;
  weekStartDate?: string;
}

export interface GenerateCalendarResponse {
  weeklyPlanId: string;
  postsGenerated: number;
  commentsGenerated: number;
}
