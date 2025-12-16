import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await params;
  const body = await request.json();

  const { username, bio } = body;

  if (!username) {
    return NextResponse.json(
      { error: "username is required" },
      { status: 400 }
    );
  }

  if (!bio) {
    return NextResponse.json({ error: "bio is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("personas")
    .insert({
      campaign_id: campaignId,
      username,
      bio,
      is_active: true,
    })
    .select()
    .single();

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
      { error: "persona id is required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("personas")
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
  const personaId = searchParams.get("personaId");

  if (!personaId) {
    return NextResponse.json(
      { error: "personaId is required" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("personas")
    .delete()
    .eq("id", personaId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await params;
  const body = await request.json();
  const { personaId } = body;

  if (!personaId) {
    return NextResponse.json(
      { error: "personaId is required" },
      { status: 400 }
    );
  }

  const { error: clearError } = await supabase
    .from("personas")
    .update({ is_operator: false, updated_at: new Date().toISOString() })
    .eq("campaign_id", campaignId);

  if (clearError) {
    return NextResponse.json({ error: clearError.message }, { status: 500 });
  }

  const { data, error: setError } = await supabase
    .from("personas")
    .update({ is_operator: true, updated_at: new Date().toISOString() })
    .eq("id", personaId)
    .eq("campaign_id", campaignId)
    .select()
    .single();

  if (setError) {
    return NextResponse.json({ error: setError.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
