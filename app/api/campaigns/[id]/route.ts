import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .single();

  if (campaignError) {
    return NextResponse.json({ error: campaignError.message }, { status: 404 });
  }

  const [personas, subreddits, keywords, weeklyPlans] = await Promise.all([
    supabase.from("personas").select("*").eq("campaign_id", id),
    supabase.from("subreddits").select("*").eq("campaign_id", id),
    supabase.from("keywords").select("*").eq("campaign_id", id),
    supabase
      .from("weekly_plans")
      .select("*")
      .eq("campaign_id", id)
      .order("week_start_date", { ascending: false }),
  ]);

  return NextResponse.json({
    ...campaign,
    personas: personas.data || [],
    subreddits: subreddits.data || [],
    keywords: keywords.data || [],
    weekly_plans: weeklyPlans.data || [],
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const { data, error } = await supabase
    .from("campaigns")
    .update({
      ...body,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { error } = await supabase.from("campaigns").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
