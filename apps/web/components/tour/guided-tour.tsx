"use client";

import { useEffect, useState, useCallback } from "react";
import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { useSession } from "next-auth/react";

const TOUR_STORAGE_KEY = "isytask_tour_completed";

// ─── Admin Tour Steps ────────────────────────────
const adminSteps: DriveStep[] = [
  {
    popover: {
      title: "¡Bienvenido a Isytask! 🎉",
      description:
        "Te guiaremos por las principales funciones del panel de administración. Este tour solo se muestra una vez.",
      side: "over",
      align: "center",
    },
  },
  {
    element: 'a[href="/admin"]',
    popover: {
      title: "Dashboard",
      description:
        "Aquí verás un resumen general: tareas activas, estadísticas por estado, tendencias mensuales y actividad reciente.",
      side: "right",
      align: "start",
    },
  },
  {
    element: 'a[href="/admin/equipo"]',
    popover: {
      title: "Gestión de Equipo",
      description:
        "Administra colaboradores, asigna permisos y visualiza la carga de trabajo de cada miembro.",
      side: "right",
      align: "start",
    },
  },
  {
    element: 'a[href="/admin/clientes"]',
    popover: {
      title: "Gestión de Clientes",
      description:
        "Configura perfiles de clientes, límites mensuales, servicios permitidos y asigna colaboradores.",
      side: "right",
      align: "start",
    },
  },
  {
    element: 'a[href="/admin/servicios"]',
    popover: {
      title: "Servicios",
      description:
        "Define los tipos de servicio que ofreces, con campos de formulario dinámicos personalizados y horas estimadas.",
      side: "right",
      align: "start",
    },
  },
  {
    element: 'a[href="/admin/tareas"]',
    popover: {
      title: "Tareas",
      description:
        "Vista completa de todas las tareas. Filtra por estado, categoría o cliente. También puedes usar el tablero Kanban.",
      side: "right",
      align: "start",
    },
  },
  {
    element: 'a[href="/admin/plantillas"]',
    popover: {
      title: "Plantillas",
      description:
        "Crea plantillas predefinidas para que los clientes puedan crear tareas más rápido con información pre-llenada.",
      side: "right",
      align: "start",
    },
  },
  {
    element: 'a[href="/admin/reportes"]',
    popover: {
      title: "Reportes de Rentabilidad",
      description:
        "Analiza horas estimadas vs. reales por servicio, colaborador o cliente. Exporta a PDF para presentaciones.",
      side: "right",
      align: "start",
    },
  },
  {
    element: 'a[href="/admin/configuracion"]',
    popover: {
      title: "Configuración",
      description:
        "Configura horarios de atención, zona horaria, formato de fecha, logos y preferencias generales.",
      side: "right",
      align: "start",
    },
  },
  {
    popover: {
      title: "¡Listo! 🚀",
      description:
        "Ya conoces las funciones principales. Usa ⌘K para buscar rápidamente en cualquier momento. ¡A trabajar!",
      side: "over",
      align: "center",
    },
  },
];

// ─── Colaborador Tour Steps ──────────────────────
const colaboradorSteps: DriveStep[] = [
  {
    popover: {
      title: "¡Bienvenido al Equipo! 👋",
      description:
        "Te mostraremos las herramientas principales que tienes disponible. Este tour solo se muestra una vez.",
      side: "over",
      align: "center",
    },
  },
  {
    element: 'a[href="/equipo"]',
    popover: {
      title: "Mis Tareas",
      description:
        "Aquí verás tu dashboard personal con KPIs, estadísticas de rendimiento y tu lista de tareas asignadas.",
      side: "right",
      align: "start",
    },
  },
  {
    element: 'a[href="/notificaciones"]',
    popover: {
      title: "Notificaciones",
      description:
        "Recibe alertas de nuevas asignaciones, cambios de estado y comentarios de los clientes.",
      side: "right",
      align: "start",
    },
  },
  {
    popover: {
      title: "¡Listo! 🎯",
      description:
        "Ya conoces tus herramientas. Haz clic en cualquier tarea para ver detalles, cambiar estado y agregar comentarios. Usa ⌘K para búsqueda rápida.",
      side: "over",
      align: "center",
    },
  },
];

// ─── Cliente Tour Steps ──────────────────────────
const clienteSteps: DriveStep[] = [
  {
    popover: {
      title: "¡Bienvenido! 🎉",
      description:
        "Te mostraremos cómo funciona el sistema para crear y dar seguimiento a tus tareas. Este tour solo se muestra una vez.",
      side: "over",
      align: "center",
    },
  },
  {
    element: 'a[href="/cliente/dashboard"]',
    popover: {
      title: "Tu Dashboard",
      description:
        "Aquí verás un resumen de tus tareas: activas, completadas, uso mensual y tendencias.",
      side: "right",
      align: "start",
    },
  },
  {
    element: 'a[href="/cliente"]',
    popover: {
      title: "Cola de Tareas",
      description:
        "Visualiza tu posición en la cola. Tus tareas aparecen resaltadas con todos los detalles de progreso.",
      side: "right",
      align: "start",
    },
  },
  {
    element: 'a[href="/cliente/nueva-tarea"]',
    popover: {
      title: "Nueva Tarea",
      description:
        "Crea nuevas solicitudes. Puedes usar plantillas predefinidas para acelerar el proceso.",
      side: "right",
      align: "start",
    },
  },
  {
    element: 'a[href="/cliente/tareas"]',
    popover: {
      title: "Mis Tareas",
      description:
        "Revisa el historial completo de tus tareas, filtra por estado y haz clic para ver detalles y comentarios.",
      side: "right",
      align: "start",
    },
  },
  {
    popover: {
      title: "¡Listo! ✨",
      description:
        "Ya conoces el sistema. Recuerda que puedes agregar comentarios en tus tareas y recibirás notificaciones de cada actualización.",
      side: "over",
      align: "center",
    },
  },
];

const TOUR_STEPS: Record<string, DriveStep[]> = {
  ADMIN: adminSteps,
  COLABORADOR: colaboradorSteps,
  CLIENTE: clienteSteps,
};

export function GuidedTour() {
  const { data: session } = useSession();
  const [hasRun, setHasRun] = useState(false);

  const role = (session?.user as any)?.role as string | undefined;
  const userId = session?.user?.email;

  const startTour = useCallback(() => {
    if (!role) return;

    const steps = TOUR_STEPS[role];
    if (!steps) return;

    const driverObj = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      overlayColor: "rgba(0, 0, 0, 0.6)",
      stagePadding: 8,
      stageRadius: 8,
      popoverClass: "isytask-tour-popover",
      nextBtnText: "Siguiente →",
      prevBtnText: "← Anterior",
      doneBtnText: "¡Entendido!",
      progressText: "{{current}} de {{total}}",
      steps,
      onDestroyStarted: () => {
        // Mark tour as completed
        if (userId) {
          const key = `${TOUR_STORAGE_KEY}_${userId}`;
          localStorage.setItem(key, "true");
        }
        driverObj.destroy();
      },
    });

    // Small delay to ensure the sidebar has rendered
    setTimeout(() => {
      driverObj.drive();
    }, 800);
  }, [role, userId]);

  useEffect(() => {
    if (hasRun || !role || !userId) return;

    const key = `${TOUR_STORAGE_KEY}_${userId}`;
    const completed = localStorage.getItem(key);

    if (!completed) {
      setHasRun(true);
      startTour();
    }
  }, [role, userId, hasRun, startTour]);

  return null; // This is a side-effect component, renders nothing
}

/** Hook to manually trigger the tour (for a "Help" or "Tour" button) */
export function useTourReset() {
  const { data: session } = useSession();
  const userId = session?.user?.email;

  return useCallback(() => {
    if (userId) {
      const key = `${TOUR_STORAGE_KEY}_${userId}`;
      localStorage.removeItem(key);
      window.location.reload();
    }
  }, [userId]);
}
