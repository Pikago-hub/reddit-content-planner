import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentWeekStart, getNextWeekStart } from "@/lib/planner";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const { weekStartDate, isNextWeek } = body;

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id, posts_per_week")
    .eq("id", campaignId)
    .single();

  if (campaignError || !campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const { count: personaCount } = await supabase
    .from("personas")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("is_active", true);

  if (!personaCount || personaCount === 0) {
    return NextResponse.json(
      { error: "No active personas found. Please add at least one persona." },
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
        error: "No active subreddits found. Please add at least one subreddit.",
      },
      { status: 400 }
    );
  }

  const { data: latestPlan } = await supabase
    .from("weekly_plans")
    .select("week_start_date")
    .eq("campaign_id", campaignId)
    .order("week_start_date", { ascending: false })
    .limit(1)
    .single();

  let startDate: Date;
  if (weekStartDate) {
    startDate = new Date(weekStartDate + "T00:00:00Z");
  } else if (isNextWeek && latestPlan) {
    startDate = new Date(latestPlan.week_start_date + "T00:00:00Z");
    startDate.setUTCDate(startDate.getUTCDate() + 7);
  } else if (isNextWeek) {
    startDate = getNextWeekStart();
  } else {
    startDate = getCurrentWeekStart();
  }

  const weekStartDateStr = startDate.toISOString().split("T")[0];

  const { data: weeklyPlan, error: planError } = await supabase
    .from("weekly_plans")
    .insert({
      campaign_id: campaignId,
      week_start_date: weekStartDateStr,
      status: "generating",
      plan_json: {
        created_at: new Date().toISOString(),
        total_posts: campaign.posts_per_week,
      },
    })
    .select()
    .single();

  if (planError || !weeklyPlan) {
    return NextResponse.json(
      { error: `Failed to create weekly plan: ${planError?.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    weeklyPlanId: weeklyPlan.id,
    weekStartDate: startDate.toISOString().split("T")[0],
    totalPosts: campaign.posts_per_week,
  });
}
