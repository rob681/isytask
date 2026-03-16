"use client";

import { useState, useRef, useEffect } from "react";
import { CheckSquare, Share2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc/client";
import { PRODUCTS, PLAN_TIERS } from "@isytask/shared";

const PRODUCT_ICONS = {
  ISYTASK: CheckSquare,
  ISYSOCIAL: Share2,
} as const;

interface ProductSelectorProps {
  collapsed?: boolean;
}

export function ProductSelector({ collapsed }: ProductSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data } = trpc.ecosystem.getProductSelector.useQuery(undefined, {
    staleTime: 30000,
  });

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Don't render if only one product or no data
  if (!data || data.availableProducts.length <= 1) return null;

  const current = data.availableProducts[0];
  const CurrentIcon = PRODUCT_ICONS[current.product as keyof typeof PRODUCT_ICONS] ?? CheckSquare;
  const productInfo = PRODUCTS[current.product as keyof typeof PRODUCTS];
  const planInfo = PLAN_TIERS[current.planTier as keyof typeof PLAN_TIERS];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent",
          collapsed && "justify-center px-2"
        )}
      >
        <CurrentIcon className="h-4 w-4 text-primary flex-shrink-0" />
        {!collapsed && (
          <>
            <span className="truncate">{productInfo?.name ?? current.product}</span>
            {planInfo && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                {planInfo.name}
              </span>
            )}
            <ChevronDown className={cn("h-3 w-3 ml-auto text-muted-foreground transition-transform", open && "rotate-180")} />
          </>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border bg-popover p-1 shadow-lg">
          {data.availableProducts.map((p, i) => {
            const Icon = PRODUCT_ICONS[p.product as keyof typeof PRODUCT_ICONS] ?? CheckSquare;
            const info = PRODUCTS[p.product as keyof typeof PRODUCTS];
            const plan = PLAN_TIERS[p.planTier as keyof typeof PLAN_TIERS];
            const isActive = i === 0;

            return (
              <button
                key={p.product}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent",
                  isActive && "bg-accent"
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <div className="flex-1 text-left">
                  <p className="font-medium">{info?.name ?? p.product}</p>
                  <p className="text-xs text-muted-foreground">{info?.description}</p>
                </div>
                {plan && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                    {plan.name}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
