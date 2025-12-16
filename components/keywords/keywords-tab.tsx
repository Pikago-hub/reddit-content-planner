"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AddKeywordDialog } from "./add-keyword-dialog";
import { KeywordCard } from "./keyword-card";
import type { Keyword } from "@/lib/types";

interface KeywordsTabProps {
  keywords: Keyword[];
  onAddKeywords: (texts: string[]) => Promise<void>;
  onDeleteKeyword: (id: string) => Promise<void>;
  isAddingKeyword: boolean;
  isDeletingKeyword: boolean;
}

export function KeywordsTab({
  keywords,
  onAddKeywords,
  onDeleteKeyword,
  isAddingKeyword,
  isDeletingKeyword,
}: KeywordsTabProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const handleAddKeywords = async (texts: string[]) => {
    await onAddKeywords(texts);
    setShowAddDialog(false);
  };

  const handleDeleteKeyword = async () => {
    if (!pendingDeleteId) return;
    try {
      await onDeleteKeyword(pendingDeleteId);
      setPendingDeleteId(null);
      toast.success("Keyword deleted");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete keyword";
      toast.error(message);
    }
  };

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <p className="text-muted-foreground">
          Add keywords/queries to target (e.g., ChatGPT searches)
        </p>
        <AddKeywordDialog
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          onSubmit={handleAddKeywords}
          isPending={isAddingKeyword}
        />
      </div>

      <div className="space-y-2">
        {keywords.map((keyword) => (
          <KeywordCard
            key={keyword.id}
            keyword={keyword}
            onDelete={() => setPendingDeleteId(keyword.id)}
          />
        ))}
      </div>

      <ConfirmDialog
        open={!!pendingDeleteId}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        title="Delete Keyword"
        description="Are you sure you want to delete this keyword? This action cannot be undone."
        onConfirm={handleDeleteKeyword}
        confirmText="Delete"
        variant="destructive"
      />
    </>
  );
}
