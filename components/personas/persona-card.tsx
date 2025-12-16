"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Persona } from "@/lib/types";

interface PersonaCardProps {
  persona: Persona;
  onSetOperator: () => void;
  onDelete: () => void;
  isSettingOperator: boolean;
}

export function PersonaCard({
  persona,
  onSetOperator,
  onDelete,
  isSettingOperator,
}: PersonaCardProps) {
  return (
    <Card className={persona.is_operator ? "border-primary" : ""}>
      <CardContent className="pt-4">
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium">u/{persona.username}</p>
              {persona.is_operator && (
                <Badge variant="default" className="text-xs">
                  Operator
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-3">
              {persona.bio}
            </p>
          </div>
          <div className="flex gap-2 ml-2">
            {!persona.is_operator && (
              <Button
                variant="outline"
                size="sm"
                onClick={onSetOperator}
                disabled={isSettingOperator}
              >
                Set as Operator
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              Delete
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
