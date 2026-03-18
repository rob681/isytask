"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import {
  CreditCard, ExternalLink, CheckCircle, AlertTriangle,
  XCircle, Clock, Loader2, Sparkles, ArrowRight,
} from "lucide-react";
import { CardListSkeleton } from "@/components/ui/skeleton";
import { PRODUCTS, PLAN_TIERS } from "@isytask/shared";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle; className: string }> = {
  active: { label: "Activa", icon: CheckCircle, className: "text-green-600 bg-green-50" },
  trial: { label: "Prueba", icon: Clock, className: "text-blue-600 bg-blue-50" },
  past_due: { label: "Pago pendiente", icon: AlertTriangle, className: "text-yellow-600 bg-yellow-50" },
  canceled: { label: "Cancelada", icon: XCircle, className: "text-red-600 bg-red-50" },
};

export default function BillingPage() {
  return (
    <Suspense fallback={<><Topbar title="Facturación" /><div className="p-6"><CardListSkeleton /></div></>}>
      <BillingContent />
    </Suspense>
  );
}

function BillingContent() {
  const searchParams = useSearchParams();
  const success = searchParams.get("success");
  const canceled = searchParams.get("canceled");

  const { data, isLoading } = trpc.billing.getBillingOverview.useQuery();
  const { data: plans } = trpc.billing.getPlans.useQuery();

  const portalMutation = trpc.billing.createPortalSession.useMutation({
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
  });

  const checkoutMutation = trpc.billing.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
  });

  if (isLoading) {
    return (
      <>
        <Topbar title="Facturación" />
        <div className="p-6"><CardListSkeleton /></div>
      </>
    );
  }

  const activeProducts = (data?.subscriptions ?? [])
    .filter((s: any) => ["active", "trial"].includes(s.status))
    .map((s: any) => s.product);

  const missingProducts = (["ISYTASK", "ISYSOCIAL"] as const).filter(
    (p) => !activeProducts.includes(p)
  );

  return (
    <>
      <Topbar title="Facturación" />
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Success / Cancel banners */}
        {success && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 border border-green-200 text-green-800">
            <CheckCircle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm font-medium">
              ¡Suscripción activada exitosamente! Tu plan ya está activo.
            </p>
          </div>
        )}
        {canceled && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800">
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm font-medium">
              El proceso de pago fue cancelado. Puedes intentarlo de nuevo cuando quieras.
            </p>
          </div>
        )}

        {/* Current subscriptions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Mis Suscripciones
            </CardTitle>
            <CardDescription>
              Gestiona tus suscripciones activas y métodos de pago
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!data?.subscriptions?.length ? (
              <div className="text-center py-8 text-muted-foreground">
                <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No tienes suscripciones activas</p>
                <p className="text-sm mt-1">Elige un plan para comenzar</p>
              </div>
            ) : (
              <div className="space-y-4">
                {data.subscriptions.map((sub: any) => {
                  const statusConf = STATUS_CONFIG[sub.status] || STATUS_CONFIG.active;
                  const StatusIcon = statusConf.icon;
                  const productInfo = PRODUCTS[sub.product as keyof typeof PRODUCTS];
                  const planInfo = PLAN_TIERS[sub.planTier as keyof typeof PLAN_TIERS];

                  return (
                    <div
                      key={sub.id}
                      className="flex items-center justify-between p-4 rounded-lg border"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <CreditCard className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {productInfo?.name ?? sub.product}{" "}
                            <span className="text-muted-foreground">—</span>{" "}
                            {planInfo?.name ?? sub.planTier}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${statusConf.className}`}
                            >
                              <StatusIcon className="h-3 w-3" />
                              {statusConf.label}
                            </span>
                            {sub.currentPeriodEnd && (
                              <span className="text-xs text-muted-foreground">
                                Próxima facturación:{" "}
                                {format(new Date(sub.currentPeriodEnd), "d MMM yyyy", {
                                  locale: es,
                                })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {planInfo?.price && (
                        <p className="text-lg font-bold">
                          ${planInfo.price}
                          <span className="text-sm font-normal text-muted-foreground">/mes</span>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Stripe Portal button */}
            {data?.hasStripeCustomer && (
              <div className="mt-6 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => portalMutation.mutate()}
                  disabled={portalMutation.isLoading}
                >
                  {portalMutation.isLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ExternalLink className="h-4 w-4 mr-2" />
                  )}
                  Gestionar en Stripe
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Cambiar plan, actualizar tarjeta, ver facturas o cancelar
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add product CTA */}
        {missingProducts.length > 0 && (
          <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">
                    Potencia tu agencia con{" "}
                    {missingProducts
                      .map((p) => PRODUCTS[p as keyof typeof PRODUCTS]?.name)
                      .join(" y ")}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Obtén un 10% de descuento al tener ambos productos activos
                  </p>
                </div>
                <Button
                  onClick={() => {
                    const product = missingProducts[0];
                    checkoutMutation.mutate({ product, planTier: "pro" });
                  }}
                  disabled={checkoutMutation.isLoading}
                >
                  {checkoutMutation.isLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4 mr-2" />
                  )}
                  Ver planes
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pricing cards */}
        {plans && (
          <Card>
            <CardHeader>
              <CardTitle>Planes disponibles</CardTitle>
              <CardDescription>
                {plans.hasMultipleProducts
                  ? `Descuento del ${plans.crossProductDiscount}% aplicado por tener múltiples productos`
                  : "Elige el plan que mejor se adapte a tu agencia"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                {plans.plans.map((plan) => {
                  const isCurrentForAny = plans.currentSubscriptions.some(
                    (s: any) => s.planTier === plan.tier
                  );

                  return (
                    <div
                      key={plan.tier}
                      className={`relative rounded-xl border p-6 ${
                        plan.popular ? "border-primary shadow-md ring-1 ring-primary/20" : ""
                      }`}
                    >
                      {plan.popular && (
                        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                          Popular
                        </span>
                      )}
                      <h3 className="font-bold text-lg">{plan.name}</h3>
                      <div className="mt-2">
                        {plan.price ? (
                          <p className="text-3xl font-bold">
                            ${plan.price}
                            <span className="text-sm font-normal text-muted-foreground">
                              /mes
                            </span>
                          </p>
                        ) : (
                          <p className="text-xl font-bold text-muted-foreground">
                            Personalizado
                          </p>
                        )}
                      </div>
                      <ul className="mt-4 space-y-2">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-start gap-2 text-sm">
                            <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-6">
                        {isCurrentForAny ? (
                          <Button variant="outline" className="w-full" disabled>
                            Plan actual
                          </Button>
                        ) : plan.price ? (
                          <Button
                            className={`w-full ${plan.popular ? "gradient-primary text-white" : ""}`}
                            variant={plan.popular ? "default" : "outline"}
                            onClick={() =>
                              checkoutMutation.mutate({
                                product: "ISYTASK",
                                planTier: plan.tier as "basic" | "pro" | "enterprise",
                              })
                            }
                            disabled={checkoutMutation.isLoading}
                          >
                            {checkoutMutation.isLoading ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : null}
                            Elegir {plan.name}
                          </Button>
                        ) : (
                          <Button variant="outline" className="w-full" asChild>
                            <a href="mailto:soporte@isytask.com">Contactar ventas</a>
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
