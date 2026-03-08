"use client";

import { useState } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import {
  Plus,
  RefreshCw,
  Trash2,
  Pause,
  Play,
  Clock,
  Calendar,
  UserPlus,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { TASK_CATEGORY_LABELS, TASK_CATEGORY_BADGE_COLORS } from "@isytask/shared";
import { CardListSkeleton } from "@/components/ui/skeleton";

const RECURRENCE_LABELS: Record<string, string> = {
  DAILY: "Diaria",
  WEEKLY: "Semanal",
  MONTHLY: "Mensual",
};

const DAY_OF_WEEK_LABELS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

export default function TareasRecurrentesPage() {
  const [showForm, setShowForm] = useState(false);
  const utils = trpc.useUtils();

  const { data: recurringTasks, isLoading } = trpc.recurring.list.useQuery();
  const { data: clients } = trpc.clients.list.useQuery({ page: 1, pageSize: 100 });
  const { data: services } = trpc.services.list.useQuery();
  const { data: teamMembers } = trpc.users.list.useQuery({
    role: "COLABORADOR",
    page: 1,
    pageSize: 50,
  });

  // Form state
  const [formData, setFormData] = useState({
    clientId: "",
    serviceId: "",
    colaboradorId: "",
    title: "",
    description: "",
    category: "NORMAL" as "URGENTE" | "NORMAL" | "LARGO_PLAZO",
    recurrenceType: "WEEKLY" as "DAILY" | "WEEKLY" | "MONTHLY",
    recurrenceDay: 1,
    recurrenceTime: "09:00",
  });

  const createMutation = trpc.recurring.create.useMutation({
    onSuccess: () => {
      utils.recurring.list.invalidate();
      setShowForm(false);
      setFormData({
        clientId: "",
        serviceId: "",
        colaboradorId: "",
        title: "",
        description: "",
        category: "NORMAL",
        recurrenceType: "WEEKLY",
        recurrenceDay: 1,
        recurrenceTime: "09:00",
      });
    },
  });

  const updateMutation = trpc.recurring.update.useMutation({
    onSuccess: () => utils.recurring.list.invalidate(),
  });

  const deleteMutation = trpc.recurring.delete.useMutation({
    onSuccess: () => utils.recurring.list.invalidate(),
  });

  const executeMutation = trpc.recurring.executeDue.useMutation({
    onSuccess: (data) => {
      utils.recurring.list.invalidate();
      alert(`Se ejecutaron ${data.executed} tareas recurrentes`);
    },
  });

  const handleCreate = () => {
    const { colaboradorId, ...rest } = formData;
    createMutation.mutate({
      ...rest,
      recurrenceDay: formData.recurrenceType === "DAILY" ? undefined : formData.recurrenceDay,
      ...(colaboradorId && { colaboradorId }),
    });
  };

  const toggleActive = (id: string, currentActive: boolean) => {
    updateMutation.mutate({ id, isActive: !currentActive });
  };

  return (
    <>
      <Topbar title="Tareas Recurrentes" />
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground">
            Programa tareas que se crean automáticamente
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => executeMutation.mutate()}
              disabled={executeMutation.isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${executeMutation.isLoading ? "animate-spin" : ""}`} />
              Ejecutar pendientes
            </Button>
            <Button onClick={() => setShowForm(!showForm)}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Recurrente
            </Button>
          </div>
        </div>

        {/* Create Form */}
        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Nueva Tarea Recurrente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Cliente</label>
                    <select
                      className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                      value={formData.clientId}
                      onChange={(e) =>
                        setFormData({ ...formData, clientId: e.target.value })
                      }
                    >
                      <option value="">Seleccionar cliente...</option>
                      {clients?.clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.companyName || c.user.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Servicio</label>
                    <select
                      className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                      value={formData.serviceId}
                      onChange={(e) =>
                        setFormData({ ...formData, serviceId: e.target.value })
                      }
                    >
                      <option value="">Seleccionar servicio...</option>
                      {services?.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-1">
                    <UserPlus className="h-4 w-4" />
                    Asignar encargado (opcional)
                  </label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={formData.colaboradorId}
                    onChange={(e) =>
                      setFormData({ ...formData, colaboradorId: e.target.value })
                    }
                  >
                    <option value="">Auto-asignar según carga</option>
                    {teamMembers?.users
                      .filter((u) => u.colaboradorProfile)
                      .map((u) => (
                        <option key={u.colaboradorProfile!.id} value={u.colaboradorProfile!.id}>
                          {u.name}
                        </option>
                      ))}
                  </select>
                  <p className="text-[11px] text-muted-foreground">
                    Si no seleccionas, se asignará automáticamente al colaborador con menos carga.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Título de la tarea</label>
                    <Input
                      value={formData.title}
                      onChange={(e) =>
                        setFormData({ ...formData, title: e.target.value })
                      }
                      placeholder="Ej: Reporte semanal de métricas"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Categoría</label>
                    <select
                      className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                      value={formData.category}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          category: e.target.value as any,
                        })
                      }
                    >
                      {Object.entries(TASK_CATEGORY_LABELS).map(
                        ([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Descripción (opcional)</label>
                  <Input
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Descripción de la tarea recurrente"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Frecuencia</label>
                    <select
                      className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                      value={formData.recurrenceType}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          recurrenceType: e.target.value as any,
                        })
                      }
                    >
                      <option value="DAILY">Diaria</option>
                      <option value="WEEKLY">Semanal</option>
                      <option value="MONTHLY">Mensual</option>
                    </select>
                  </div>

                  {formData.recurrenceType === "WEEKLY" && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Día de la semana</label>
                      <select
                        className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                        value={formData.recurrenceDay}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            recurrenceDay: Number(e.target.value),
                          })
                        }
                      >
                        {DAY_OF_WEEK_LABELS.map((label, i) => (
                          <option key={i} value={i}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {formData.recurrenceType === "MONTHLY" && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Día del mes</label>
                      <Input
                        type="number"
                        min="1"
                        max="31"
                        value={formData.recurrenceDay}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            recurrenceDay: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Hora de ejecución</label>
                    <Input
                      type="time"
                      value={formData.recurrenceTime}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          recurrenceTime: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleCreate}
                    disabled={
                      createMutation.isLoading ||
                      !formData.clientId ||
                      !formData.serviceId ||
                      !formData.title
                    }
                  >
                    {createMutation.isLoading ? "Creando..." : "Crear Tarea Recurrente"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowForm(false)}
                  >
                    Cancelar
                  </Button>
                </div>
                {createMutation.error && (
                  <p className="text-sm text-destructive">
                    {createMutation.error.message}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* List */}
        {isLoading ? (
          <CardListSkeleton cards={3} />
        ) : !recurringTasks || recurringTasks.length === 0 ? (
          <Card className="p-8 text-center">
            <RefreshCw className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">
              No hay tareas recurrentes configuradas
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {recurringTasks.map((rt) => (
              <Card key={rt.id} className={!rt.isActive ? "opacity-60" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{rt.title}</h3>
                        <Badge
                          className={
                            TASK_CATEGORY_BADGE_COLORS[
                              rt.category as keyof typeof TASK_CATEGORY_BADGE_COLORS
                            ]
                          }
                        >
                          {TASK_CATEGORY_LABELS[rt.category as keyof typeof TASK_CATEGORY_LABELS]}
                        </Badge>
                        <Badge variant={rt.isActive ? "default" : "secondary"}>
                          {rt.isActive ? "Activa" : "Pausada"}
                        </Badge>
                      </div>
                      {rt.description && (
                        <p className="text-sm text-muted-foreground">
                          {rt.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {RECURRENCE_LABELS[rt.recurrenceType]}
                          {rt.recurrenceType === "WEEKLY" &&
                            rt.recurrenceDay != null &&
                            ` — ${DAY_OF_WEEK_LABELS[rt.recurrenceDay]}`}
                          {rt.recurrenceType === "MONTHLY" &&
                            rt.recurrenceDay != null &&
                            ` — Día ${rt.recurrenceDay}`}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {rt.recurrenceTime}
                        </span>
                        <span>
                          Cliente: {rt.client.user.name}
                        </span>
                        <span>
                          Servicio: {rt.service.name}
                        </span>
                        {(rt as any).colaborador && (
                          <span className="flex items-center gap-1">
                            <UserPlus className="h-3 w-3" />
                            {(rt as any).colaborador.user.name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                        {rt.lastRunAt && (
                          <span>
                            Última ejecución:{" "}
                            {formatDistanceToNow(new Date(rt.lastRunAt), {
                              addSuffix: true,
                              locale: es,
                            })}
                          </span>
                        )}
                        {rt.nextRunAt && (
                          <span>
                            Próxima:{" "}
                            {new Date(rt.nextRunAt).toLocaleDateString("es-MX", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleActive(rt.id, rt.isActive)}
                        title={rt.isActive ? "Pausar" : "Activar"}
                      >
                        {rt.isActive ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm("¿Eliminar esta tarea recurrente?")) {
                            deleteMutation.mutate({ id: rt.id });
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
