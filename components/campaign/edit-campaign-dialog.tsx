"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

interface EditCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    name: string;
    company_name: string;
    company_url: string;
    company_description: string;
    posts_per_week: number;
  }) => Promise<void>;
  isPending: boolean;
  initialData: {
    name: string;
    company_name: string;
    company_url: string;
    company_description: string;
    posts_per_week: number;
  };
}

export function EditCampaignDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
  initialData,
}: EditCampaignDialogProps) {
  const [formData, setFormData] = useState(initialData);

  useEffect(() => {
    setFormData(initialData);
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Campaign</DialogTitle>
          <DialogDescription>
            Update your campaign settings and company information.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">
                Campaign Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-company">
                Company Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-company"
                value={formData.company_name}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    company_name: e.target.value,
                  })
                }
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-url">
                Company URL{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Input
                id="edit-url"
                value={formData.company_url}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    company_url: e.target.value,
                  })
                }
                placeholder="e.g., slideforge.ai"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-description">
                Company Description{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Textarea
                id="edit-description"
                value={formData.company_description}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    company_description: e.target.value,
                  })
                }
                placeholder="What does your company do? Who is your ICP?"
                className="h-24"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-posts">
                Posts per Week <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-posts"
                type="number"
                min="1"
                max="14"
                value={formData.posts_per_week}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    posts_per_week: parseInt(e.target.value),
                  })
                }
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Spinner size="sm" />}
              {isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
