"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ScrollAnimation } from "./scroll-animation";

const plans = [
  {
    name: "Basico",
    price: "$29",
    period: "/mes",
    description: "Para agencias pequenas que estan empezando.",
    features: [
      "Hasta 5 usuarios",
      "Gestion de tareas",
      "Portal de clientes",
      "Formularios dinamicos",
      "Notificaciones por email",
      "Soporte por email",
    ],
    cta: "Empezar gratis",
    href: "/registro?plan=basic",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$79",
    period: "/mes",
    description: "Para agencias en crecimiento que necesitan mas.",
    features: [
      "Hasta 20 usuarios",
      "Todo en Basico +",
      "Kanban y vistas multiples",
      "Reportes de rentabilidad",
      "Tareas recurrentes",
      "SLA y alertas",
      "Plantillas de tareas",
      "Soporte prioritario",
    ],
    cta: "Empezar gratis",
    href: "/registro?plan=pro",
    highlighted: true,
    badge: "Mas popular",
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "Para agencias grandes con necesidades especificas.",
    features: [
      "Usuarios ilimitados",
      "Todo en Pro +",
      "Multi-agencia",
      "API personalizada",
      "Onboarding dedicado",
      "Soporte 24/7",
      "SLA garantizado",
      "Facturacion personalizada",
    ],
    cta: "Contactar ventas",
    href: "mailto:ventas@isytask.com?subject=Isytask Enterprise",
    highlighted: false,
  },
];

export function Pricing() {
  return (
    <section id="precios" className="section-padding">
      <div className="container-landing">
        <ScrollAnimation className="text-center mb-16">
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Planes simples,{" "}
            <span className="gradient-text">sin sorpresas</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Todos los planes incluyen 14 dias de prueba gratis. Sin tarjeta de
            credito.
          </p>
        </ScrollAnimation>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
            <ScrollAnimation key={plan.name} delay={index * 0.1}>
              <div
                className={cn(
                  "rounded-2xl border p-6 md:p-8 h-full flex flex-col transition-all duration-300",
                  plan.highlighted
                    ? "gradient-border bg-card shadow-lg scale-[1.02] md:scale-105"
                    : "bg-card/80 hover:shadow-md"
                )}
              >
                {/* Header */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-display font-bold text-xl">
                      {plan.name}
                    </h3>
                    {plan.badge && (
                      <Badge className="gradient-primary text-white border-0 text-xs">
                        {plan.badge}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    {plan.description}
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span className="font-display text-4xl font-extrabold">
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span className="text-muted-foreground text-sm">
                        {plan.period}
                      </span>
                    )}
                  </div>
                  {plan.price !== "Custom" && (
                    <p className="text-xs text-muted-foreground mt-1">
                      14 dias gratis incluidos
                    </p>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-3 flex-1 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-muted-foreground">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Link href={plan.href}>
                  <Button
                    className={cn(
                      "w-full h-11 font-semibold",
                      plan.highlighted
                        ? "gradient-primary text-white shadow-md hover:opacity-90 transition-opacity"
                        : ""
                    )}
                    variant={plan.highlighted ? "default" : "outline"}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            </ScrollAnimation>
          ))}
        </div>
      </div>
    </section>
  );
}
