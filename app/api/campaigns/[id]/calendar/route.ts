import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await params;
  const { searchParams } = new URL(request.url);
  const weeklyPlanId = searchParams.get("weeklyPlanId");

  if (!weeklyPlanId) {
    return NextResponse.json(
      { error: "weeklyPlanId is required" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("weekly_plans")
    .delete()
    .eq("id", weeklyPlanId)
    .eq("campaign_id", campaignId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await params;
  const { searchParams } = new URL(request.url);
  const weeklyPlanId = searchParams.get("weeklyPlanId");

  let plansQuery = supabase
    .from("weekly_plans")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("week_start_date", { ascending: false });

  if (weeklyPlanId) {
    plansQuery = plansQuery.eq("id", weeklyPlanId);
  }

  const { data: plans, error: plansError } = await plansQuery;

  if (plansError) {
    return NextResponse.json({ error: plansError.message }, { status: 500 });
  }

  if (!plans || plans.length === 0) {
    return NextResponse.json({ plans: [], posts: [], comments: [] });
  }

  const planIds = plans.map((p) => p.id);

  const { data: posts, error: postsError } = await supabase
    .from("planned_posts")
    .select("*")
    .in("weekly_plan_id", planIds)
    .order("scheduled_at", { ascending: true });

  if (postsError) {
    return NextResponse.json({ error: postsError.message }, { status: 500 });
  }

  const postIds = (posts || []).map((p) => p.id);
  const { data: comments, error: commentsError } = await supabase
    .from("planned_comments")
    .select("*")
    .in("planned_post_id", postIds)
    .order("scheduled_at", { ascending: true });

  if (commentsError) {
    return NextResponse.json({ error: commentsError.message }, { status: 500 });
  }

  const { data: personas } = await supabase
    .from("personas")
    .select("id, username")
    .eq("campaign_id", campaignId);

  const personaMap = new Map((personas || []).map((p) => [p.id, p]));

  const enrichedPosts = (posts || []).map((post) => ({
    ...post,
    author: personaMap.get(post.author_persona_id),
  }));

  const enrichedComments = (comments || []).map((comment) => ({
    ...comment,
    author: personaMap.get(comment.author_persona_id),
  }));

  return NextResponse.json({
    plans,
    posts: enrichedPosts,
    comments: enrichedComments,
  });
}
