"use client";

import { useState } from "react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

interface AddPersonaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (persona: { username: string; bio: string }) => Promise<void>;
  isPending: boolean;
}

export function AddPersonaDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
}: AddPersonaDialogProps) {
  const [newPersona, setNewPersona] = useState({
    username: "",
    bio: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(newPersona);
    setNewPersona({ username: "", bio: "" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">+ Add Persona</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Persona</DialogTitle>
          <DialogDescription>
            Create a new persona with their backstory and posting limits.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="username">
                Username <span className="text-destructive">*</span>
              </Label>
              <Input
                id="username"
                placeholder="e.g., riley_ops"
                value={newPersona.username}
                onChange={(e) =>
                  setNewPersona({
                    ...newPersona,
                    username: e.target.value,
                  })
                }
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bio">
                Bio / Backstory <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="bio"
                placeholder="Detailed background story that defines their voice, personality, and perspective..."
                value={newPersona.bio}
                onChange={(e) =>
                  setNewPersona({
                    ...newPersona,
                    bio: e.target.value,
                  })
                }
                className="h-32"
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
              {isPending ? "Adding..." : "Add Persona"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
