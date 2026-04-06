"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ScrollAnimation } from "./scroll-animation";

const plans = [
  {
    name: "Starter",
    price: 29,
    annualPrice: 23, // $278/año ÷ 12
    annualTotal: 278,
    description: "Para agencias pequeñas y freelancers que están comenzando.",
    features: [
      "Hasta 3 usuarios internos",
      "Colaboradores externos ilimitados",
      "Hasta 50 tareas/mes",
      "Formularios dinámicos",
      "Portal de clientes",
      "1 integración WhatsApp",
      "IA categorización básica",
      "Soporte por email",
    ],
    cta: "Comenzar gratis",
    href: "/registro?plan=basic",
    highlighted: false,
  },
  {
    name: "Profesional",
    price: 79,
    annualPrice: 63, // $758/año ÷ 12
    annualTotal: 758,
    description: "Para agencias en crecimiento con clientes activos.",
    features: [
      "Hasta 10 usuarios internos",
      "Colaboradores externos ilimitados",
      "Tareas ilimitadas",
      "Formularios dinámicos avanzados",
      "Kanban + vistas múltiples",
      "5 integraciones WhatsApp",
      "IA completa (chat + sugerencias)",
      "Analytics & predicción de riesgos",
      "Tareas recurrentes y plantillas",
      "SLA y alertas automáticas",
      "Soporte prioritario por Slack",
    ],
    cta: "Comenzar gratis",
    href: "/registro?plan=pro",
    highlighted: true,
    badge: "Más popular",
  },
  {
    name: "Enterprise",
    price: 199,
    annualPrice: 159, // $1,910/año ÷ 12
    annualTotal: 1910,
    description: "Para grandes agencias con necesidades específicas.",
    features: [
      "Usuarios internos ilimitados",
      "Colaboradores externos ilimitados",
      "Tareas ilimitadas",
      "Todo en Profesional +",
      "Multi-agencia",
      "API completo + webhooks",
      "SSO / SAML",
      "Custom branding",
      "Soporte prioritario 24/7",
      "SLA 99.9% garantizado",
      "Account manager dedicado",
    ],
    cta: "Contactar ventas",
    href: "mailto:ventas@isytask.com?subject=Isytask Enterprise",
    highlighted: false,
  },
];

const addons = [
  { icon: "👤", label: "Usuario extra", price: "$9/mes" },
  { icon: "💬", label: "WhatsApp Premium", price: "+$19/mes" },
  { icon: "🤖", label: "IA Avanzada", price: "+$29/mes" },
  { icon: "📱", label: "Isystory Studio", price: "+$39/mes" },
];

export function Pricing() {
  const [annual, setAnnual] = useState(false);

  return (
    <section id="precios" className="section-padding">
      <div className="container-landing">
        <ScrollAnimation className="text-center mb-12">
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Planes simples,{" "}
            <span className="gradient-text">sin sorpresas</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Todos los planes incluyen 14 días de prueba gratis. Sin tarjeta de crédito.
          </p>

          {/* Toggle mensual / anual */}
          <div className="inline-flex items-center gap-1 p-1 bg-muted rounded-xl">
            <button
              onClick={() => setAnnual(false)}
              className={cn(
                "px-5 py-2 rounded-lg text-sm font-medium transition-all",
                !annual
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Mensual
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={cn(
                "px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                annual
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Anual
              <Badge className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 border-0 font-semibold">
                -20%
              </Badge>
            </button>
          </div>
        </ScrollAnimation>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto">
          {plans.map((plan, index) => {
            const displayPrice = annual ? plan.annualPrice : plan.price;

            return (
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
                      <h3 className="font-display font-bold text-xl">{plan.name}</h3>
                      {plan.badge && (
                        <Badge className="gradient-primary text-white border-0 text-xs">
                          {plan.badge}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>
                    <div className="flex items-baseline gap-1">
                      <span className="font-display text-4xl font-extrabold">
                        ${displayPrice}
                      </span>
                      <span className="text-muted-foreground text-sm">/mes</span>
                    </div>
                    {annual ? (
                      <p className="text-xs text-green-600 font-medium mt-1">
                        ${plan.annualTotal}/año · ahorras ${(plan.price - plan.annualPrice) * 12}/año
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-1">
                        o ${plan.annualPrice}/mes con plan anual
                      </p>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-2.5 flex-1 mb-8">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5">
                        <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-muted-foreground">{feature}</span>
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
            );
          })}
        </div>

        {/* Add-ons */}
        <ScrollAnimation className="mt-12 max-w-4xl mx-auto">
          <div className="rounded-2xl border bg-card/60 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-sm">Add-ons opcionales — potencia tu plan</h4>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {addons.map((addon) => (
                <div key={addon.label} className="flex items-center gap-2 text-sm">
                  <span className="text-base">{addon.icon}</span>
                  <div>
                    <p className="font-medium text-xs">{addon.label}</p>
                    <p className="text-muted-foreground text-xs">{addon.price}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ScrollAnimation>

        {/* Guarantee row */}
        <ScrollAnimation className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">✅ 14 días gratis sin tarjeta</span>
          <span className="flex items-center gap-1.5">✅ Cancela cuando quieras</span>
          <span className="flex items-center gap-1.5">✅ Soporte en español</span>
          <span className="flex items-center gap-1.5">✅ Datos seguros con Supabase</span>
        </ScrollAnimation>
      </div>
    </section>
  );
}
