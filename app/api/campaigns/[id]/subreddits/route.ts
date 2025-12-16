import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await params;
  const body = await request.json();

  const { name, names } = body;

  let subredditNames: string[] = [];
  if (names && Array.isArray(names)) {
    subredditNames = names;
  } else if (name) {
    subredditNames = [name];
  }

  if (subredditNames.length === 0) {
    return NextResponse.json(
      { error: "name or names is required" },
      { status: 400 }
    );
  }

  const cleanNames = [
    ...new Set(
      subredditNames
        .map((n) => n.trim().replace(/^r\//, ""))
        .filter((n) => n.length > 0)
    ),
  ];

  if (cleanNames.length === 0) {
    return NextResponse.json(
      { error: "No valid subreddit names provided" },
      { status: 400 }
    );
  }

  const insertData = cleanNames.map((n) => ({
    campaign_id: campaignId,
    name: n,
    is_active: true,
  }));

  const { data, error } = await supabase
    .from("subreddits")
    .insert(insertData)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json(
      { error: "subreddit id is required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("subreddits")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const subredditId = searchParams.get("subredditId");

  if (!subredditId) {
    return NextResponse.json(
      { error: "subredditId is required" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("subreddits")
    .delete()
    .eq("id", subredditId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
