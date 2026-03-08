import { type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  compact?: boolean;
}

export function EmptyState({ icon, title, description, action, compact }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center px-4 text-center animate-in ${compact ? "py-8" : "py-16"}`}>
      <div className={`rounded-2xl bg-gradient-to-br from-primary/5 to-primary/10 flex items-center justify-center mb-5 text-primary/40 ${compact ? "h-14 w-14" : "h-20 w-20"}`}>
        {icon}
      </div>
      <h3 className={`font-semibold mb-1.5 ${compact ? "text-sm" : "text-base"}`}>{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-[320px] leading-relaxed">{description}</p>
      )}
      {action && (
        action.href ? (
          <Link href={action.href}>
            <Button size="sm" className="mt-5 gradient-primary text-white shadow-md hover:shadow-lg transition-shadow">
              {action.label}
            </Button>
          </Link>
        ) : (
          <Button size="sm" className="mt-5 gradient-primary text-white shadow-md hover:shadow-lg transition-shadow" onClick={action.onClick}>
            {action.label}
          </Button>
        )
      )}
    </div>
  );
}
