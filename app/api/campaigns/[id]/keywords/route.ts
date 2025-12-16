import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await params;
  const body = await request.json();

  const { keyword_text, texts } = body;
  const keywordTexts: string[] = texts || (keyword_text ? [keyword_text] : []);

  if (keywordTexts.length === 0) {
    return NextResponse.json(
      { error: "At least one keyword text is required" },
      { status: 400 }
    );
  }

  const { count } = await supabase
    .from("keywords")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId);

  const startIndex = (count || 0) + 1;

  const records = keywordTexts.map((text, i) => ({
    campaign_id: campaignId,
    keyword_code: `K${startIndex + i}`,
    keyword_text: text.trim(),
    intent: "informational",
    is_active: true,
  }));

  const { data, error } = await supabase
    .from("keywords")
    .insert(records)
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
      { error: "keyword id is required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("keywords")
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
  const keywordId = searchParams.get("keywordId");

  if (!keywordId) {
    return NextResponse.json(
      { error: "keywordId is required" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("keywords")
    .delete()
    .eq("id", keywordId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
