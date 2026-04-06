"use client";

import {
  ClipboardList,
  Users,
  FileText,
  MessageSquare,
  BarChart3,
  RefreshCw,
  ShieldCheck,
  Bell,
} from "lucide-react";
import { ScrollAnimation } from "./scroll-animation";

const features = [
  {
    icon: <ShieldCheck className="h-6 w-6" />,
    title: "IA de prediccion de riesgos",
    description:
      "Detecta proyectos en peligro antes de que se retrasen. Semaforo de salud con alertas y sugerencias automaticas.",
    isNew: true,
  },
  {
    icon: <MessageSquare className="h-6 w-6" />,
    title: "WhatsApp integrado",
    description:
      "Los mensajes de WhatsApp de tus clientes se convierten automaticamente en comentarios de tarea con IA.",
    isNew: true,
  },
  {
    icon: <ClipboardList className="h-6 w-6" />,
    title: "Gestion de tareas",
    description:
      "Crea, asigna y da seguimiento a todas las solicitudes de tus clientes con flujos de estado claros.",
  },
  {
    icon: <Users className="h-6 w-6" />,
    title: "Portal de clientes",
    description:
      "Tus clientes crean solicitudes y ven el avance en tiempo real desde su propio portal.",
  },
  {
    icon: <FileText className="h-6 w-6" />,
    title: "Formularios dinamicos",
    description:
      "Configura formularios personalizados por servicio con campos arrastables y validacion automatica.",
  },
  {
    icon: <BarChart3 className="h-6 w-6" />,
    title: "Reportes de rentabilidad",
    description:
      "Mide la rentabilidad por cliente, servicio o colaborador. Toma decisiones con datos reales.",
  },
  {
    icon: <RefreshCw className="h-6 w-6" />,
    title: "Automatizacion",
    description:
      "Programa tareas recurrentes y usa plantillas para ahorrar tiempo en procesos repetitivos.",
  },
  {
    icon: <Bell className="h-6 w-6" />,
    title: "SLA y alertas",
    description:
      "Define tiempos de respuesta por servicio y recibe alertas antes de que se venzan los plazos.",
  },
];

export function Features() {
  return (
    <section id="funciones" className="section-padding bg-muted/30">
      <div className="container-landing">
        <ScrollAnimation className="text-center mb-16">
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Todo lo que necesitas para{" "}
            <span className="gradient-text">tu agencia</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            IA predictiva, WhatsApp integrado y herramientas disenadas para que
            organices tu equipo y hagas crecer tu negocio.
          </p>
        </ScrollAnimation>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {features.map((feature, index) => (
            <ScrollAnimation key={feature.title} delay={index * 0.05}>
              <div className="glass-card card-hover p-6 h-full">
                <div className="flex items-start justify-between mb-4">
                  <div className="inline-flex p-2.5 rounded-xl bg-primary/10">
                    <span className="gradient-text">{feature.icon}</span>
                  </div>
                  {(feature as any).isNew && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full gradient-primary text-white">
                      Nuevo
                    </span>
                  )}
                </div>
                <h3 className="font-display font-bold text-base mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </ScrollAnimation>
          ))}
        </div>
      </div>
    </section>
  );
}
