"use client";

import { Megaphone, Palette, Briefcase, User } from "lucide-react";
import { ScrollAnimation } from "./scroll-animation";

const useCases = [
  {
    icon: <Megaphone className="h-7 w-7" />,
    title: "Agencias de Marketing",
    description:
      "Centraliza las solicitudes de todos tus clientes, asigna tareas a tu equipo creativo y mide tiempos de entrega.",
    bullets: [
      "Cola de tareas priorizada por urgencia",
      "Portal donde el cliente sube sus briefs",
      "Reportes de productividad por campana",
    ],
    color: "text-blue-500 bg-blue-100 dark:bg-blue-900/30",
  },
  {
    icon: <Palette className="h-7 w-7" />,
    title: "Estudios de Diseno",
    description:
      "Gestiona revisiones, aprobaciones y entregas de diseno con formularios adaptados a cada tipo de proyecto.",
    bullets: [
      "Formularios dinamicos por tipo de diseno",
      "Limite de revisiones por cliente",
      "Historial completo de cambios",
    ],
    color: "text-purple-500 bg-purple-100 dark:bg-purple-900/30",
  },
  {
    icon: <Briefcase className="h-7 w-7" />,
    title: "Consultorias",
    description:
      "Organiza proyectos de consultoria con hitos, entregables y seguimiento de horas para maximizar la rentabilidad.",
    bullets: [
      "Seguimiento de horas por tarea",
      "SLA configurables por servicio",
      "Dashboards de rentabilidad",
    ],
    color: "text-green-500 bg-green-100 dark:bg-green-900/30",
  },
  {
    icon: <User className="h-7 w-7" />,
    title: "Freelancers",
    description:
      "Profesionaliza la atencion a tus clientes con un portal propio, formularios y automatizaciones.",
    bullets: [
      "Imagen profesional con tu marca",
      "Tareas recurrentes automaticas",
      "Notificaciones por email y push",
    ],
    color: "text-orange-500 bg-orange-100 dark:bg-orange-900/30",
  },
];

export function UseCases() {
  return (
    <section id="casos-de-uso" className="section-padding">
      <div className="container-landing">
        <ScrollAnimation className="text-center mb-16">
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Disenado para{" "}
            <span className="gradient-text">profesionales como tu</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            No importa el tamano de tu equipo o tu industria. Isytask se adapta a
            tu forma de trabajar.
          </p>
        </ScrollAnimation>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {useCases.map((useCase, index) => (
            <ScrollAnimation
              key={useCase.title}
              delay={index * 0.1}
              direction={index % 2 === 0 ? "left" : "right"}
            >
              <div className="glass-card card-hover p-6 md:p-8 h-full">
                <div className="flex items-start gap-4 mb-4">
                  <div
                    className={`inline-flex p-3 rounded-xl flex-shrink-0 ${useCase.color}`}
                  >
                    {useCase.icon}
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-xl mb-1">
                      {useCase.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {useCase.description}
                    </p>
                  </div>
                </div>
                <ul className="space-y-2 ml-[68px]">
                  {useCase.bullets.map((bullet) => (
                    <li
                      key={bullet}
                      className="flex items-start gap-2 text-sm"
                    >
                      <span className="w-1.5 h-1.5 rounded-full gradient-primary flex-shrink-0 mt-1.5" />
                      <span className="text-muted-foreground">{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollAnimation>
          ))}
        </div>
      </div>
    </section>
  );
}
