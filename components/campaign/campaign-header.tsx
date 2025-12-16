"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EditCampaignDialog } from "@/components/campaign/edit-campaign-dialog";
import type { Campaign } from "@/lib/types";

interface CampaignHeaderProps {
  campaign: Campaign;
  onUpdate: (data: {
    name: string;
    company_name: string;
    company_url: string;
    company_description: string;
    posts_per_week: number;
  }) => Promise<void>;
  onDelete: () => Promise<void>;
  isUpdating: boolean;
  isDeleting: boolean;
}

export function CampaignHeader({
  campaign,
  onUpdate,
  onDelete,
  isUpdating,
  isDeleting,
}: CampaignHeaderProps) {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const editCampaignData = {
    name: campaign.name,
    company_name: campaign.company_name,
    company_url: campaign.company_info?.website || "",
    company_description: campaign.company_info?.description || "",
    posts_per_week: campaign.posts_per_week,
  };

  const handleUpdate = async (data: {
    name: string;
    company_name: string;
    company_url: string;
    company_description: string;
    posts_per_week: number;
  }) => {
    try {
      await onUpdate(data);
      setShowEditDialog(false);
      toast.success("Campaign updated!");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update campaign";
      toast.error(message);
    }
  };

  const handleDelete = async () => {
    try {
      await onDelete();
      toast.success("Campaign deleted");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete campaign";
      toast.error(message);
    }
  };

  return (
    <>
      <header className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {campaign.name}
            </h1>
            <p className="text-muted-foreground">
              {campaign.company_name}
              {campaign.company_info?.website && (
                <> • {campaign.company_info.website}</>
              )}
              {" • "}
              {campaign.posts_per_week} posts/week
            </p>
            {campaign.company_info?.description && (
              <p className="text-sm text-muted-foreground mt-2 max-w-2xl line-clamp-2">
                {campaign.company_info.description}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEditDialog(true)}
            >
              Edit Campaign
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setShowDeleteConfirm(true)}
            >
              Delete
            </Button>
          </div>
        </div>
      </header>

      <EditCampaignDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onSubmit={handleUpdate}
        isPending={isUpdating}
        initialData={editCampaignData}
      />

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete Campaign"
        description="Are you sure you want to delete this campaign? All personas, subreddits, keywords, and generated content will be permanently deleted. This action cannot be undone."
        onConfirm={handleDelete}
        confirmText="Delete Campaign"
        variant="destructive"
      />
    </>
  );
}
