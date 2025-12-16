import { NextRequest, NextResponse } from "next/server";
import { generateWeeklyCalendar, getCurrentWeekStart } from "@/lib/planner";
import { supabase } from "@/lib/supabase";
import { generateCalendarSchema, formatZodError } from "@/lib/validations";

export async function POST(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = generateCalendarSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: formatZodError(result.error) },
      { status: 400 }
    );
  }

  const { campaignId, weekStartDate } = result.data;

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id")
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
      {
        error:
          "No active personas found. Please add at least one persona before generating a calendar.",
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
          "No active subreddits found. Please add at least one subreddit before generating a calendar.",
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
          "No active keywords found. Please add at least one keyword before generating a calendar.",
      },
      { status: 400 }
    );
  }

  const startDate = weekStartDate
    ? new Date(weekStartDate)
    : getCurrentWeekStart();

  try {
    const planResult = await generateWeeklyCalendar(campaignId, startDate);

    return NextResponse.json({
      success: true,
      weeklyPlanId: planResult.weeklyPlanId,
      postsGenerated: planResult.postsGenerated,
      commentsGenerated: planResult.commentsGenerated,
      errors: planResult.errors,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
