"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { WeeklyPlanCard } from "./weekly-plan-card";
import type { WeeklyPlan } from "@/lib/types";

interface CalendarTabProps {
  weeklyPlans: WeeklyPlan[];
  campaignId: string;
  onDeleteWeeklyPlan: (id: string) => Promise<unknown>;
  isDeletingWeeklyPlan: boolean;
}

export function CalendarTab({
  weeklyPlans,
  campaignId,
  onDeleteWeeklyPlan,
  isDeletingWeeklyPlan,
}: CalendarTabProps) {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const handleDeleteWeeklyPlan = async () => {
    if (!pendingDeleteId) return;
    try {
      await onDeleteWeeklyPlan(pendingDeleteId);
      setPendingDeleteId(null);
      toast.success("Content calendar deleted");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete calendar";
      toast.error(message);
    }
  };

  if (weeklyPlans.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">
            No calendars generated yet. Go to Overview to generate one.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {weeklyPlans.map((plan) => (
          <WeeklyPlanCard
            key={plan.id}
            plan={plan}
            campaignId={campaignId}
            onDelete={() => setPendingDeleteId(plan.id)}
          />
        ))}
      </div>

      <ConfirmDialog
        open={!!pendingDeleteId}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        title="Delete Content Calendar"
        description="Are you sure you want to delete this weekly content calendar? All posts and comments in this calendar will be permanently deleted. This action cannot be undone."
        onConfirm={handleDeleteWeeklyPlan}
        confirmText="Delete Calendar"
        variant="destructive"
      />
    </>
  );
}
