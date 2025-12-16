import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateWeeklyCalendar } from "@/lib/planner";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; weekId: string }> }
) {
  const { id: campaignId, weekId: weeklyPlanId } = await params;

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id")
    .eq("id", campaignId)
    .single();

  if (campaignError || !campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const { data: weeklyPlan, error: planError } = await supabase
    .from("weekly_plans")
    .select("*")
    .eq("id", weeklyPlanId)
    .eq("campaign_id", campaignId)
    .single();

  if (planError || !weeklyPlan) {
    return NextResponse.json(
      { error: "Weekly plan not found" },
      { status: 404 }
    );
  }

  const { count: personaCount } = await supabase
    .from("personas")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("is_active", true);

  if (!personaCount || personaCount === 0) {
    return NextResponse.json(
      {
        error:
          "No active personas found. Please add at least one persona before regenerating.",
      },
      { status: 400 }
    );
  }

  const { count: subredditCount } = await supabase
    .from("subreddits")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("is_active", true);

  if (!subredditCount || subredditCount === 0) {
    return NextResponse.json(
      {
        error:
          "No active subreddits found. Please add at least one subreddit before regenerating.",
      },
      { status: 400 }
    );
  }

  const { count: keywordCount } = await supabase
    .from("keywords")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("is_active", true);

  if (!keywordCount || keywordCount === 0) {
    return NextResponse.json(
      {
        error:
          "No active keywords found. Please add at least one keyword before regenerating.",
      },
      { status: 400 }
    );
  }

  try {
    const { data: existingPosts } = await supabase
      .from("planned_posts")
      .select("id")
      .eq("weekly_plan_id", weeklyPlanId);

    if (existingPosts && existingPosts.length > 0) {
      const postIds = existingPosts.map((p) => p.id);
      await supabase
        .from("planned_comments")
        .delete()
        .in("planned_post_id", postIds);
      await supabase
        .from("planned_posts")
        .delete()
        .eq("weekly_plan_id", weeklyPlanId);
    }

    await supabase.from("weekly_plans").delete().eq("id", weeklyPlanId);

    const weekStartDate = new Date(weeklyPlan.week_start_date + "T00:00:00Z");
    const planResult = await generateWeeklyCalendar(campaignId, weekStartDate);

    return NextResponse.json({
      success: true,
      weeklyPlanId: planResult.weeklyPlanId,
      weekStartDate: weekStartDate.toISOString().split("T")[0],
      postsGenerated: planResult.postsGenerated,
      commentsGenerated: planResult.commentsGenerated,
      errors: planResult.errors,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
