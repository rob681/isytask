"use client";

import { useState, useRef, useEffect } from "react";
import { CheckSquare, Share2, ChevronDown, ExternalLink, Loader2 } from "lucide-react";
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
  const [navigating, setNavigating] = useState(false);
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

  async function handleSwitchToIsysocial() {
    setNavigating(true);
    setOpen(false);
    try {
      const res = await fetch("/api/sso/generate", { method: "POST" });
      const data = await res.json();
      if (data.redirectUrl) {
        window.open(data.redirectUrl, "_blank", "noopener,noreferrer");
      }
    } catch {
      // fallback — open directly
      window.open("https://www.isysocial.com", "_blank", "noopener,noreferrer");
    } finally {
      setNavigating(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          "bg-accent/50 hover:bg-accent border border-border/40",
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
        <div className="absolute left-0 top-full z-50 mt-1 w-60 rounded-lg border bg-popover shadow-lg overflow-hidden">
          <div className="p-1">
            {data.availableProducts.map((p, i) => {
              const Icon = PRODUCT_ICONS[p.product as keyof typeof PRODUCT_ICONS] ?? CheckSquare;
              const info = PRODUCTS[p.product as keyof typeof PRODUCTS];
              const plan = PLAN_TIERS[p.planTier as keyof typeof PLAN_TIERS];
              const isActive = i === 0;
              const isIsysocial = p.product === "ISYSOCIAL";

              return (
                <button
                  key={p.product}
                  onClick={() => {
                    if (isIsysocial) {
                      handleSwitchToIsysocial();
                    } else {
                      setOpen(false);
                    }
                  }}
                  className={cn(
                    "flex items-center gap-3 w-full rounded-md px-3 py-2.5 text-sm transition-colors text-left",
                    isActive
                      ? "bg-primary/10 text-foreground"
                      : "bg-muted/40 text-foreground hover:bg-accent"
                  )}
                >
                  <div className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md flex-shrink-0",
                    isActive ? "bg-primary/20" : "bg-muted"
                  )}>
                    <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{info?.name ?? p.product}</p>
                    <p className="text-xs text-muted-foreground truncate">{info?.description}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {plan && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                        {plan.name}
                      </span>
                    )}
                    {isIsysocial && (
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    )}
                    {isActive && (
                      <span className="text-[10px] text-primary font-medium">Activo</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* SSO info footer */}
          <div className="border-t bg-muted/30 px-3 py-2">
            <p className="text-[10px] text-muted-foreground">
              {navigating ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Iniciando sesión en Isysocial...
                </span>
              ) : (
                "Click en Isysocial para abrir con tu sesión actual"
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
