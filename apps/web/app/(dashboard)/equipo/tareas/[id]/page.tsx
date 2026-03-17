"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
  TASK_CATEGORY_LABELS,
  TASK_CATEGORY_COLORS,
  getAvailableTransitions,
} from "@isytask/shared";
import {
  ArrowLeft,
  Clock,
  User,
  Users,
  MessageCircle,
  Send,
  FileText,
  Play,
  HelpCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Circle,
  AlertCircle,
  Upload,
  Trash2,
  Paperclip,
  Eye,
  Star,
} from "lucide-react";
import { SlaIndicator } from "@/components/sla-indicator";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { DetailPageSkeleton } from "@/components/ui/skeleton";

const STATUS_ACTIONS: Record<
  string,
  { label: string; icon: React.ReactNode; variant: "default" | "destructive" | "outline" }
> = {
  EN_PROGRESO: {
    label: "Iniciar trabajo",
    icon: <Play className="h-4 w-4 mr-1" />,
    variant: "default",
  },
  DUDA: {
    label: "Marcar como duda",
    icon: <HelpCircle className="h-4 w-4 mr-1" />,
    variant: "outline",
  },
  REVISION: {
    label: "Enviar a revisión",
    icon: <Eye className="h-4 w-4 mr-1" />,
    variant: "default",
  },
  FINALIZADA: {
    label: "Marcar finalizada",
    icon: <CheckCircle className="h-4 w-4 mr-1" />,
    variant: "default",
  },
  CANCELADA: {
    label: "Cancelar",
    icon: <XCircle className="h-4 w-4 mr-1" />,
    variant: "destructive",
  },
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  RECIBIDA: <Circle className="h-4 w-4 text-yellow-600" />,
  EN_PROGRESO: <RefreshCw className="h-4 w-4 text-blue-600" />,
  DUDA: <AlertCircle className="h-4 w-4 text-orange-600" />,
  REVISION: <Eye className="h-4 w-4 text-purple-600" />,
  FINALIZADA: <CheckCircle className="h-4 w-4 text-green-600" />,
  CANCELADA: <XCircle className="h-4 w-4 text-red-600" />,
};

export default function EquipoTaskDetailPage() {
  const params = useParams();
  const taskId = params.id as string;

  const [comment, setComment] = useState("");
  const [isQuestion, setIsQuestion] = useState(false);
  const [statusNote, setStatusNote] = useState("");

  const utils = trpc.useUtils();
  const { data: task, isLoading } = trpc.tasks.getById.useQuery({ id: taskId });

  const updateStatus = trpc.tasks.updateStatus.useMutation({
    onSuccess: () => {
      utils.tasks.getById.invalidate({ id: taskId });
      setStatusNote("");
    },
  });

  const addComment = trpc.comments.create.useMutation({
    onSuccess: () => {
      utils.tasks.getById.invalidate({ id: taskId });
      setComment("");
      setIsQuestion(false);
    },
  });

  const [uploading, setUploading] = useState(false);

  const addAttachment = trpc.tasks.addAttachment.useMutation({
    onSuccess: () => {
      utils.tasks.getById.invalidate({ id: taskId });
    },
  });

  const deleteAttachment = trpc.tasks.deleteAttachment.useMutation({
    onSuccess: () => {
      utils.tasks.getById.invalidate({ id: taskId });
    },
  });

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/uploads/file", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json();
          alert(err.error || "Error al subir archivo");
          continue;
        }
        const data = await res.json();
        await addAttachment.mutateAsync({
          taskId,
          fileName: data.fileName,
          fileSize: data.fileSize,
          mimeType: data.mimeType,
          url: data.url,
          storagePath: data.storagePath,
          isDeliverable: false,
        });
      }
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) {
    return (
      <>
        <Topbar title="Detalle de Tarea" />
        <div className="p-6">
          <DetailPageSkeleton />
        </div>
      </>
    );
  }

  if (!task) {
    return (
      <>
        <Topbar title="Detalle de Tarea" />
        <div className="p-6">
          <p className="text-muted-foreground">Tarea no encontrada</p>
        </div>
      </>
    );
  }

  const availableTransitions = getAvailableTransitions(
    task.status as any,
    "COLABORADOR"
  );
  const formData = task.formData as Record<string, any> | null;

  return (
    <>
      <Topbar title="Detalle de Tarea" />
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/equipo">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold">{task.title}</h2>
              <Badge
                className={TASK_STATUS_COLORS[task.status]}
                variant="outline"
              >
                {TASK_STATUS_LABELS[task.status]}
              </Badge>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-sm text-muted-foreground">
                {task.client.user.name} &middot; {task.service.name} &middot;
                Tarea #{task.taskNumber}
              </p>
              {task.dueAt && (
                <SlaIndicator
                  dueAt={task.dueAt}
                  completedAt={task.completedAt}
                  status={task.status}
                />
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Status actions */}
            {availableTransitions.length > 0 && (
              <Card className="border-primary/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Cambiar estado</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                    placeholder="Nota (opcional)..."
                  />
                  <div className="flex flex-wrap gap-2">
                    {availableTransitions.map((status) => {
                      const action = STATUS_ACTIONS[status];
                      if (!action) return null;
                      return (
                        <Button
                          key={status}
                          variant={action.variant}
                          size="sm"
                          onClick={() => {
                            updateStatus.mutate({
                              taskId: task.id,
                              newStatus: status as any,
                              note: statusNote || undefined,
                            });
                          }}
                          disabled={updateStatus.isLoading}
                        >
                          {action.icon}
                          {action.label}
                        </Button>
                      );
                    })}
                  </div>
                  {updateStatus.error && (
                    <p className="text-sm text-destructive">
                      {updateStatus.error.message}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Task info */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                {task.description && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">
                      Descripción
                    </h4>
                    <p className="text-sm">{task.description}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">
                      Categoría
                    </h4>
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-3 h-3 rounded-full ${TASK_CATEGORY_COLORS[task.category]}`}
                      />
                      <span className="text-sm">
                        {TASK_CATEGORY_LABELS[task.category]}
                      </span>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">
                      Cliente
                    </h4>
                    <span className="text-sm flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {task.client.user.name}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">
                      Tiempo estimado
                    </h4>
                    <span className="text-sm flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {task.estimatedHours + task.extraHours} hrs
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">
                      Revisiones
                    </h4>
                    <span className="text-sm">
                      {task.revisionsUsed} / {task.revisionsLimit}
                    </span>
                  </div>
                </div>

                {/* Team assigned */}
                {(task as any).assignments?.length > 0 && (
                  <div className="pt-3 border-t">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      Equipo asignado
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {(task as any).assignments.map((a: any) => (
                        <div key={a.id} className="flex items-center gap-1.5 text-sm bg-muted/50 px-2 py-1 rounded-md">
                          <User className="h-3 w-3 text-muted-foreground" />
                          {a.colaborador.user.name}
                          {a.role === "PRIMARY" && <Star className="h-3 w-3 text-amber-500" />}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Form data — uses TaskResponse if available, fallback to formData */}
            {((task.responses && task.responses.length > 0) || (formData && Object.keys(formData).length > 0)) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    <FileText className="h-4 w-4 inline mr-2" />
                    Datos del formulario
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {task.responses && task.responses.length > 0
                      ? task.responses.map((resp: any) => {
                          if (resp.skipped) {
                            return (
                              <div key={resp.id}>
                                <h4 className="text-sm font-medium text-muted-foreground">
                                  {resp.field?.label ?? resp.fieldName}
                                </h4>
                                <p className="text-xs text-muted-foreground italic mt-0.5">No aplica</p>
                              </div>
                            );
                          }
                          const value = resp.value;
                          if (value === undefined || value === "" || value === null) return null;
                          let displayValue: string;
                          if (Array.isArray(value)) {
                            displayValue = value.join(", ");
                          } else if (typeof value === "boolean") {
                            displayValue = value ? "Sí" : "No";
                          } else {
                            displayValue = String(value);
                          }
                          return (
                            <div key={resp.id}>
                              <h4 className="text-sm font-medium text-muted-foreground">
                                {resp.field?.label ?? resp.fieldName}
                              </h4>
                              {resp.field?.fieldType === "COLOR_PICKER" ? (
                                <div className="flex items-center gap-2 mt-1">
                                  <div className="w-6 h-6 rounded border" style={{ backgroundColor: displayValue }} />
                                  <span className="text-sm">{displayValue}</span>
                                </div>
                              ) : (
                                <p className="text-sm mt-0.5">{displayValue}</p>
                              )}
                            </div>
                          );
                        })
                      : task.service.formFields.map((field) => {
                          const value = formData?.[field.fieldName];
                          if (value === undefined || value === "" || value === null) return null;
                          let displayValue: string;
                          if (Array.isArray(value)) {
                            displayValue = value.join(", ");
                          } else if (typeof value === "boolean") {
                            displayValue = value ? "Sí" : "No";
                          } else {
                            displayValue = String(value);
                          }
                          return (
                            <div key={field.id}>
                              <h4 className="text-sm font-medium text-muted-foreground">
                                {field.label}
                              </h4>
                              {field.fieldType === "COLOR_PICKER" ? (
                                <div className="flex items-center gap-2 mt-1">
                                  <div className="w-6 h-6 rounded border" style={{ backgroundColor: displayValue }} />
                                  <span className="text-sm">{displayValue}</span>
                                </div>
                              ) : (
                                <p className="text-sm mt-0.5">{displayValue}</p>
                              )}
                            </div>
                          );
                        })
                    }
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Comments */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  <MessageCircle className="h-4 w-4 inline mr-2" />
                  Comentarios ({task.comments.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {task.comments.map((c) => (
                  <div
                    key={c.id}
                    className={`p-3 rounded-lg ${
                      c.isQuestion
                        ? "bg-orange-50 border border-orange-200"
                        : c.isInternal
                        ? "bg-blue-50 border border-blue-200"
                        : "bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">
                        {c.author.name}
                        <Badge variant="outline" className="ml-2 text-xs">
                          {c.author.role === "ADMIN"
                            ? "Admin"
                            : c.author.role === "COLABORADOR"
                            ? "Equipo"
                            : "Cliente"}
                        </Badge>
                        {c.isQuestion && (
                          <Badge
                            variant="outline"
                            className="ml-1 text-xs bg-orange-100 text-orange-800"
                          >
                            Pregunta
                          </Badge>
                        )}
                        {c.isInternal && (
                          <Badge
                            variant="outline"
                            className="ml-1 text-xs bg-blue-100 text-blue-800"
                          >
                            Interno
                          </Badge>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(c.createdAt), "dd MMM yyyy, HH:mm", {
                          locale: es,
                        })}
                      </span>
                    </div>
                    <p className="text-sm">{c.content}</p>
                  </div>
                ))}

                {task.comments.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No hay comentarios aún
                  </p>
                )}

                {/* Add comment */}
                {!["CANCELADA"].includes(task.status) && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Escribe un comentario..."
                        className="flex-1"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            if (!comment.trim()) return;
                            addComment.mutate({
                              taskId: task.id,
                              content: comment,
                              isQuestion,
                            });
                          }
                        }}
                      />
                      <Button
                        size="icon"
                        disabled={addComment.isLoading || !comment.trim()}
                        onClick={() => {
                          if (!comment.trim()) return;
                          addComment.mutate({
                            taskId: task.id,
                            content: comment,
                            isQuestion,
                          });
                        }}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isQuestion}
                        onChange={(e) => setIsQuestion(e.target.checked)}
                        className="h-4 w-4 rounded"
                      />
                      Marcar como pregunta al cliente
                    </label>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right column: timeline */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Historial</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {task.statusLog.map((log, i) => (
                    <div key={log.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        {STATUS_ICONS[log.toStatus] ?? (
                          <Circle className="h-4 w-4" />
                        )}
                        {i < task.statusLog.length - 1 && (
                          <div className="w-px h-full bg-border mt-1" />
                        )}
                      </div>
                      <div className="pb-4">
                        <p className="text-sm font-medium">
                          {TASK_STATUS_LABELS[log.toStatus as keyof typeof TASK_STATUS_LABELS]}
                        </p>
                        {log.note && (
                          <p className="text-xs text-muted-foreground">
                            {log.note}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {format(
                            new Date(log.createdAt),
                            "dd MMM yyyy, HH:mm",
                            { locale: es }
                          )}
                          {log.changedBy && ` · ${log.changedBy.name}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Attachments */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  <Paperclip className="h-4 w-4 inline mr-2" />
                  Archivos ({task.attachments.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {task.attachments.length > 0 && (
                  <div className="space-y-2">
                    {task.attachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center gap-2 p-2 rounded hover:bg-muted text-sm group"
                      >
                        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <a
                          href={att.fileUrl ?? "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate flex-1 hover:underline"
                        >
                          {att.fileName}
                        </a>
                        {att.isDeliverable && (
                          <Badge variant="outline" className="text-xs flex-shrink-0">
                            Entregable
                          </Badge>
                        )}
                        <button
                          onClick={() => deleteAttachment.mutate({ attachmentId: att.id })}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity flex-shrink-0"
                          title="Eliminar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload area */}
                <label
                  className="flex flex-col items-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleFileUpload(e.dataTransfer.files);
                  }}
                >
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground text-center">
                    {uploading ? "Subiendo..." : "Arrastra archivos o haz clic para subir"}
                  </span>
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFileUpload(e.target.files)}
                    disabled={uploading}
                  />
                </label>
              </CardContent>
            </Card>

            {/* Dates */}
            <Card>
              <CardContent className="pt-6 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Creada</span>
                  <span>
                    {format(new Date(task.createdAt), "dd MMM yyyy", {
                      locale: es,
                    })}
                  </span>
                </div>
                {task.startedAt && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Iniciada</span>
                    <span>
                      {format(new Date(task.startedAt), "dd MMM yyyy", {
                        locale: es,
                      })}
                    </span>
                  </div>
                )}
                {task.completedAt && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Completada</span>
                    <span>
                      {format(new Date(task.completedAt), "dd MMM yyyy", {
                        locale: es,
                      })}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
