import { NextRequest } from "next/server";
import { generateContentForPlan } from "@/lib/planner";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { weeklyPlanId } = body;

  if (!weeklyPlanId) {
    return new Response(JSON.stringify({ error: "weeklyPlanId is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: weeklyPlan, error: planError } = await supabase
    .from("weekly_plans")
    .select("*, campaigns(*)")
    .eq("id", weeklyPlanId)
    .single();

  if (planError || !weeklyPlan) {
    return new Response(JSON.stringify({ error: "Weekly plan not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (weeklyPlan.status !== "generating") {
    return new Response(
      JSON.stringify({ error: "Weekly plan is not in generating status" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const campaign = weeklyPlan.campaigns;
  const totalPosts = campaign.posts_per_week;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const result = await generateContentForPlan(
          weeklyPlanId,
          (progress) => {
            sendEvent({
              type: "progress",
              ...progress,
              totalPosts,
            });
          }
        );

        sendEvent({
          type: "complete",
          weeklyPlanId: result.weeklyPlanId,
          postsGenerated: result.postsGenerated,
          commentsGenerated: result.commentsGenerated,
          errors: result.errors,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        sendEvent({ type: "error", error: message });

        await supabase
          .from("weekly_plans")
          .update({ status: "failed", plan_json: { error: message } })
          .eq("id", weeklyPlanId);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
