import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; weekId: string }> }
) {
  const { id: campaignId, weekId: weeklyPlanId } = await params;

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id, posts_per_week")
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
    // Delete existing posts and comments
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

    // Delete the old weekly plan
    await supabase.from("weekly_plans").delete().eq("id", weeklyPlanId);

    // Create a new weekly plan with "generating" status (same week start date)
    const weekStartDate = new Date(weeklyPlan.week_start_date + "T00:00:00Z");
    const weekStartDateStr = weekStartDate.toISOString().split("T")[0];

    const { data: newPlan, error: newPlanError } = await supabase
      .from("weekly_plans")
      .insert({
        campaign_id: campaignId,
        week_start_date: weekStartDateStr,
        status: "generating",
        plan_json: {
          created_at: new Date().toISOString(),
          total_posts: campaign.posts_per_week,
          regenerated_from: weeklyPlanId,
        },
      })
      .select()
      .single();

    if (newPlanError || !newPlan) {
      return NextResponse.json(
        { error: `Failed to create weekly plan: ${newPlanError?.message}` },
        { status: 500 }
      );
    }

    // Return immediately - frontend will start SSE streaming
    return NextResponse.json({
      success: true,
      weeklyPlanId: newPlan.id,
      weekStartDate: weekStartDateStr,
      totalPosts: campaign.posts_per_week,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
