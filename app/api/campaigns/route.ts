import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const {
    name,
    company_name,
    company_info,
    posts_per_week,
    start_date,
    timezone,
  } = body;

  if (!name || !company_name) {
    return NextResponse.json(
      { error: "name and company_name are required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      name,
      company_name,
      company_info: company_info || {},
      posts_per_week: posts_per_week || 3,
      start_date: start_date || new Date().toISOString().split("T")[0],
      timezone: timezone || "America/New_York",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
