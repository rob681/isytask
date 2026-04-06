"use client";

import { trpc } from "@/lib/trpc/client";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TaskRiskBadgeProps {
  taskId: string;
}

export function TaskRiskBadge({ taskId }: TaskRiskBadgeProps) {
  const { data: risk } = trpc.risk.taskRisk.useQuery(
    { taskId },
    { staleTime: 5 * 60 * 1000 }
  );

  if (!risk) return null;

  const config = {
    GREEN: {
      label: "Bajo riesgo",
      className: "text-green-600 border-green-200 bg-green-50 dark:bg-green-950/30",
      dot: "bg-green-500",
    },
    YELLOW: {
      label: `${Math.round(risk.riskScore)}% riesgo`,
      className: "text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-950/30",
      dot: "bg-amber-400",
    },
    RED: {
      label: `${Math.round(risk.riskScore)}% riesgo`,
      className: "text-red-600 border-red-200 bg-red-50 dark:bg-red-950/30",
      dot: "bg-red-500",
    },
  }[risk.riskLevel];

  // Don't show badge for green tasks (no noise)
  if (risk.riskLevel === "GREEN") return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={`${config.className} text-xs gap-1`}>
            <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
            {config.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs whitespace-normal">
          <p className="text-sm font-medium mb-1">{risk.prediction}</p>
          {risk.suggestedAction && (
            <p className="text-xs text-muted-foreground">
              Sugerencia: {risk.suggestedAction}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
