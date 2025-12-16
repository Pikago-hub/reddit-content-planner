"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AddSubredditDialog } from "./add-subreddit-dialog";
import { SubredditCard } from "./subreddit-card";
import type { Subreddit } from "@/lib/types";

interface SubredditsTabProps {
  subreddits: Subreddit[];
  onAddSubreddits: (names: string[]) => Promise<void>;
  onDeleteSubreddit: (id: string) => Promise<void>;
  isAddingSubreddit: boolean;
  isDeletingSubreddit: boolean;
}

export function SubredditsTab({
  subreddits,
  onAddSubreddits,
  onDeleteSubreddit,
  isAddingSubreddit,
  isDeletingSubreddit,
}: SubredditsTabProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const handleAddSubreddits = async (names: string[]) => {
    await onAddSubreddits(names);
    setShowAddDialog(false);
  };

  const handleDeleteSubreddit = async () => {
    if (!pendingDeleteId) return;
    try {
      await onDeleteSubreddit(pendingDeleteId);
      setPendingDeleteId(null);
      toast.success("Subreddit deleted");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete subreddit";
      toast.error(message);
    }
  };

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <p className="text-muted-foreground">Add subreddits to target</p>
        <AddSubredditDialog
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          onSubmit={handleAddSubreddits}
          isPending={isAddingSubreddit}
        />
      </div>

      <div className="space-y-2">
        {subreddits.map((subreddit) => (
          <SubredditCard
            key={subreddit.id}
            subreddit={subreddit}
            onDelete={() => setPendingDeleteId(subreddit.id)}
          />
        ))}
      </div>

      <ConfirmDialog
        open={!!pendingDeleteId}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        title="Delete Subreddit"
        description="Are you sure you want to delete this subreddit? This action cannot be undone."
        onConfirm={handleDeleteSubreddit}
        confirmText="Delete"
        variant="destructive"
      />
    </>
  );
}
