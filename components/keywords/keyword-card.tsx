"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Keyword } from "@/lib/types";

interface KeywordCardProps {
  keyword: Keyword;
  onDelete: () => void;
}

export function KeywordCard({ keyword, onDelete }: KeywordCardProps) {
  return (
    <Card>
      <CardContent className="py-3 flex justify-between items-center">
        <div>
          <Badge variant="outline" className="mr-2 font-mono">
            {keyword.keyword_code}
          </Badge>
          <span>{keyword.keyword_text}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          Delete
        </Button>
      </CardContent>
    </Card>
  );
}
