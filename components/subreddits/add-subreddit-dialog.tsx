"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

interface AddSubredditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (names: string[]) => Promise<void>;
  isPending: boolean;
}

export function AddSubredditDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
}: AddSubredditDialogProps) {
  const [subredditInput, setSubredditInput] = useState("");
  const [pendingSubreddits, setPendingSubreddits] = useState<string[]>([]);

  const handleAddToPending = () => {
    const name = subredditInput.trim().replace(/^r\//, "");
    if (!name) return;

    if (pendingSubreddits.includes(name)) {
      toast.error("Already added");
      return;
    }

    setPendingSubreddits([...pendingSubreddits, name]);
    setSubredditInput("");
  };

  const handleRemoveFromPending = (name: string) => {
    setPendingSubreddits(pendingSubreddits.filter((n) => n !== name));
  };

  const handleSubmit = async () => {
    if (pendingSubreddits.length === 0) {
      toast.error("Add at least one subreddit");
      return;
    }

    await onSubmit(pendingSubreddits);
    setPendingSubreddits([]);
    setSubredditInput("");
  };

  const handleClose = () => {
    onOpenChange(false);
    setPendingSubreddits([]);
    setSubredditInput("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">+ Add Subreddits</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Subreddits</DialogTitle>
          <DialogDescription>
            Add subreddits to target for this campaign.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="subredditName">Subreddit Name</Label>
            <div className="flex gap-2">
              <Input
                id="subredditName"
                placeholder="e.g., PowerPoint"
                value={subredditInput}
                onChange={(e) => setSubredditInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddToPending();
                  }
                }}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleAddToPending}
              >
                Add
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Press Enter or click Add to add to list
            </p>
          </div>

          {pendingSubreddits.length > 0 && (
            <div className="grid gap-2">
              <Label>Subreddits to add ({pendingSubreddits.length})</Label>
              <div className="flex flex-wrap gap-2">
                {pendingSubreddits.map((name) => (
                  <Badge
                    key={name}
                    variant="secondary"
                    className="cursor-pointer hover:bg-destructive hover:text-white"
                    onClick={() => handleRemoveFromPending(name)}
                  >
                    r/{name} ×
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || pendingSubreddits.length === 0}
          >
            {isPending && <Spinner size="sm" />}
            {isPending
              ? "Adding..."
              : `Add ${pendingSubreddits.length || ""} Subreddit${pendingSubreddits.length !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
