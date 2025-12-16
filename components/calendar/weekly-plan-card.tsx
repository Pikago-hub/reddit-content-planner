"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { WeeklyPlan } from "@/lib/types";

interface WeeklyPlanCardProps {
  plan: WeeklyPlan;
  campaignId: string;
  onDelete: () => void;
}

export function WeeklyPlanCard({
  plan,
  campaignId,
  onDelete,
}: WeeklyPlanCardProps) {
  return (
    <Card className="hover:border-primary transition-colors">
      <CardContent className="py-4 flex justify-between items-center">
        <Link
          href={`/campaigns/${campaignId}/calendar/${plan.id}`}
          className="flex-1"
        >
          <p className="font-medium">
            Week of {new Date(plan.week_start_date).toLocaleDateString()}
          </p>
          <p className="text-sm text-muted-foreground">
            {plan.plan_json.posts_count || 0} posts •{" "}
            {plan.plan_json.comments_count || 0} comments
          </p>
        </Link>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          Delete
        </Button>
      </CardContent>
    </Card>
  );
}
