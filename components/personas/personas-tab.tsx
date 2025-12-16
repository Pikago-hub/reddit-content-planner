"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AddPersonaDialog } from "./add-persona-dialog";
import { PersonaCard } from "./persona-card";
import type { Persona } from "@/lib/types";

interface PersonasTabProps {
  personas: Persona[];
  onAddPersona: (persona: { username: string; bio: string }) => Promise<void>;
  onDeletePersona: (id: string) => Promise<void>;
  onSetOperator: (id: string) => void;
  isAddingPersona: boolean;
  isDeletingPersona: boolean;
  isSettingOperator: boolean;
}

export function PersonasTab({
  personas,
  onAddPersona,
  onDeletePersona,
  onSetOperator,
  isAddingPersona,
  isDeletingPersona,
  isSettingOperator,
}: PersonasTabProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const handleAddPersona = async (persona: {
    username: string;
    bio: string;
  }) => {
    await onAddPersona(persona);
    setShowAddDialog(false);
  };

  const handleDeletePersona = async () => {
    if (!pendingDeleteId) return;
    try {
      await onDeletePersona(pendingDeleteId);
      setPendingDeleteId(null);
      toast.success("Persona deleted");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete persona";
      toast.error(message);
    }
  };

  const handleSetOperator = (persona: Persona) => {
    onSetOperator(persona.id);
    toast.success(`${persona.username} is now the operator`);
  };

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <p className="text-muted-foreground">
          Add personas that will post and comment on Reddit
        </p>
        <AddPersonaDialog
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          onSubmit={handleAddPersona}
          isPending={isAddingPersona}
        />
      </div>

      <div className="space-y-3">
        {personas.map((persona) => (
          <PersonaCard
            key={persona.id}
            persona={persona}
            onSetOperator={() => handleSetOperator(persona)}
            onDelete={() => setPendingDeleteId(persona.id)}
            isSettingOperator={isSettingOperator}
          />
        ))}
      </div>

      <ConfirmDialog
        open={!!pendingDeleteId}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        title="Delete Persona"
        description="Are you sure you want to delete this persona? This action cannot be undone."
        onConfirm={handleDeletePersona}
        confirmText="Delete"
        variant="destructive"
      />
    </>
  );
}
