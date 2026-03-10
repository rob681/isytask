"use client";

import { ScrollAnimation } from "./scroll-animation";
import { Clock, MessageCircle, Eye } from "lucide-react";

const mockTasks = [
  {
    position: 1,
    title: "Diseno de logo corporativo",
    service: "Branding",
    category: "NORMAL",
    status: "EN_PROGRESO",
    statusLabel: "En progreso",
    time: "4 Hrs.",
    progress: 65,
    comments: 3,
    isOwn: false,
  },
  {
    position: 2,
    title: "Campana redes sociales Q2",
    service: "Marketing Digital",
    category: "URGENTE",
    status: "EN_PROGRESO",
    statusLabel: "En progreso",
    time: "8 Hrs.",
    progress: 30,
    comments: 5,
    isOwn: false,
  },
  {
    position: 3,
    title: "Rediseno pagina de inicio",
    service: "Desarrollo Web",
    category: "NORMAL",
    status: "RECIBIDA",
    statusLabel: "Recibida",
    time: "12 Hrs.",
    progress: 0,
    comments: 1,
    isOwn: true,
  },
  {
    position: 4,
    title: "Manual de identidad de marca",
    service: "Branding",
    category: "LARGO_PLAZO",
    status: "RECIBIDA",
    statusLabel: "En cola",
    time: "20 Hrs.",
    progress: 0,
    comments: 0,
    isOwn: false,
  },
];

const STATUS_COLORS: Record<string, string> = {
  EN_PROGRESO: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  RECIBIDA: "bg-slate-100 text-slate-600 dark:bg-slate-800/40 dark:text-slate-300",
  FINALIZADA: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
};

const CATEGORY_DOTS: Record<string, string> = {
  URGENTE: "bg-red-500",
  NORMAL: "bg-blue-500",
  LARGO_PLAZO: "bg-purple-500",
};

export function ClientPortal() {
  return (
    <section className="section-padding bg-muted/30">
      <div className="container-landing">
        <ScrollAnimation className="text-center mb-12 md:mb-16">
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4">
            Para tus clientes:{" "}
            <span className="gradient-text">transparencia total</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Tus clientes ven su posicion en la cola y el progreso de sus tareas
            en tiempo real, sin necesidad de preguntar.
          </p>
        </ScrollAnimation>

        <ScrollAnimation>
          <div className="glass-card overflow-hidden max-w-3xl mx-auto shadow-soft">
            {/* Browser chrome */}
            <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/50">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-400/80" />
                <div className="w-3 h-3 rounded-full bg-green-400/80" />
              </div>
              <div className="flex-1 text-center">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-background/80 text-xs text-muted-foreground">
                  <Eye className="h-3 w-3" />
                  tuagencia.isytask.app/cliente
                </div>
              </div>
            </div>

            {/* Queue content */}
            <div className="p-4 md:p-6 space-y-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-bold text-base">Cola de Tareas</h3>
                <span className="text-xs text-muted-foreground">4 tareas activas</span>
              </div>

              {mockTasks.map((task, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    task.isOwn
                      ? "border-primary/50 bg-primary/5 dark:bg-primary/10"
                      : "border-border hover:border-border/80"
                  }`}
                >
                  {/* Position */}
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
                    {task.position}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${CATEGORY_DOTS[task.category]} shrink-0`} />
                      <p className="font-medium text-sm truncate">{task.title}</p>
                      {task.isOwn && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-medium shrink-0">
                          Tu tarea
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-muted-foreground">{task.service}</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {task.time}
                      </span>
                      {task.comments > 0 && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <MessageCircle className="h-3 w-3" /> {task.comments}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status + Progress */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[task.status]}`}
                    >
                      {task.statusLabel}
                    </span>
                    {task.progress > 0 && (
                      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ScrollAnimation>
      </div>
    </section>
  );
}
