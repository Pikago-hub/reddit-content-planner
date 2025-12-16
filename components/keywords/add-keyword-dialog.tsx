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

interface AddKeywordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (texts: string[]) => Promise<void>;
  isPending: boolean;
}

export function AddKeywordDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
}: AddKeywordDialogProps) {
  const [keywordInput, setKeywordInput] = useState("");
  const [pendingKeywords, setPendingKeywords] = useState<string[]>([]);

  const handleAddToPending = () => {
    const text = keywordInput.trim();
    if (!text) return;

    if (pendingKeywords.includes(text)) {
      toast.error("Already added");
      return;
    }

    setPendingKeywords([...pendingKeywords, text]);
    setKeywordInput("");
  };

  const handleRemoveFromPending = (text: string) => {
    setPendingKeywords(pendingKeywords.filter((k) => k !== text));
  };

  const handleSubmit = async () => {
    if (pendingKeywords.length === 0) {
      toast.error("Add at least one keyword");
      return;
    }

    await onSubmit(pendingKeywords);
    setPendingKeywords([]);
    setKeywordInput("");
  };

  const handleClose = () => {
    onOpenChange(false);
    setPendingKeywords([]);
    setKeywordInput("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">+ Add Keywords</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Keywords</DialogTitle>
          <DialogDescription>
            Add keywords or search queries to target. Codes (K1, K2, etc.) will
            be auto-generated.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="keywordText">Keyword / Search Query</Label>
            <div className="flex gap-2">
              <Input
                id="keywordText"
                placeholder="e.g., best ai presentation maker"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
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

          {pendingKeywords.length > 0 && (
            <div className="grid gap-2">
              <Label>Keywords to add ({pendingKeywords.length})</Label>
              <div className="flex flex-wrap gap-2">
                {pendingKeywords.map((text) => (
                  <Badge
                    key={text}
                    variant="secondary"
                    className="cursor-pointer hover:bg-destructive hover:text-white"
                    onClick={() => handleRemoveFromPending(text)}
                  >
                    {text} ×
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
            disabled={isPending || pendingKeywords.length === 0}
          >
            {isPending && <Spinner size="sm" />}
            {isPending
              ? "Adding..."
              : `Add ${pendingKeywords.length || ""} Keyword${pendingKeywords.length !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
