"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { trpc } from "@/lib/trpc/client";
import { Clock, UserCircle, Users, Info } from "lucide-react";

export default function AdminNuevaTareaPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedColaboradorId, setSelectedColaboradorId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<"URGENTE" | "NORMAL" | "LARGO_PLAZO">("NORMAL");
  const [formData, setFormData] = useState<Record<string, any>>({});

  // Fetch data
  const { data: clientsData } = trpc.clients.list.useQuery({
    page: 1,
    pageSize: 100,
  });
  const { data: services } = trpc.services.list.useQuery();
  const { data: teamData } = trpc.users.list.useQuery({
    role: "COLABORADOR",
    page: 1,
    pageSize: 50,
  });

  const { data: formFields } = trpc.services.getFormFields.useQuery(
    { serviceId: selectedServiceId },
    { enabled: !!selectedServiceId }
  );

  const selectedService = services?.find((s) => s.id === selectedServiceId);
  const colaboradores = teamData?.users.filter((u) => u.colaboradorProfile) ?? [];

  const createMutation = trpc.tasks.createForClient.useMutation({
    onSuccess: () => {
      router.push("/admin/tareas");
    },
  });

  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId || !selectedServiceId || !title) return;

    const isUserAssign = selectedColaboradorId.startsWith("user:");
    createMutation.mutate({
      clientId: selectedClientId,
      serviceId: selectedServiceId,
      title,
      description,
      category,
      formData,
      ...(selectedColaboradorId && !isUserAssign && { colaboradorId: selectedColaboradorId }),
      ...(isUserAssign && { assignToUserId: selectedColaboradorId.replace("user:", "") }),
    });
  };

  return (
    <>
      <Topbar title="Crear Tarea" />
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Nueva Tarea</CardTitle>
            <CardDescription>
              Crea una tarea en nombre de un cliente o asignala directamente a un colaborador
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Client selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1">
                  <UserCircle className="h-4 w-4" />
                  Cliente
                </label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  required
                >
                  <option value="">Selecciona un cliente</option>
                  {clientsData?.clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.companyName
                        ? `${c.companyName} (${c.user.name})`
                        : c.user.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Service type */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo de servicio</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedServiceId}
                  onChange={(e) => {
                    setSelectedServiceId(e.target.value);
                    setFormData({});
                  }}
                  required
                >
                  <option value="">Selecciona un servicio</option>
                  {services?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                {selectedService && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Tiempo estimado: {selectedService.estimatedHours} hrs.
                    </p>
                    <p className="text-xs text-muted-foreground/80 flex items-start gap-1 pl-0.5">
                      <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      Los tiempos son aproximados y pueden variar según el tipo de tarea o ajustes por parte de los clientes.
                    </p>
                  </div>
                )}
              </div>

              {/* Collaborator (optional) */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  Asignar a colaborador
                  <span className="text-muted-foreground font-normal">(opcional)</span>
                </label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedColaboradorId}
                  onChange={(e) => setSelectedColaboradorId(e.target.value)}
                >
                  <option value="">Auto-asignar</option>
                  {(session?.user as any)?.id && (
                    <option value={`user:${(session?.user as any).id}`}>
                      Yo mismo (Admin)
                    </option>
                  )}
                  {colaboradores.map((c) => (
                    <option key={c.colaboradorProfile!.id} value={c.colaboradorProfile!.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Si no se selecciona, se asignará automáticamente al colaborador del cliente
                </p>
              </div>

              {/* Category */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Categoría</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                >
                  <option value="NORMAL">Normal</option>
                  <option value="URGENTE">Urgente</option>
                  <option value="LARGO_PLAZO">Largo plazo</option>
                </select>
              </div>

              {/* Title */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Título de la tarea</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej: Rediseño de la página de inicio"
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Descripción</label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe los detalles de la tarea..."
                />
              </div>

              {/* Dynamic form fields */}
              {formFields && formFields.length > 0 && (
                <div className="space-y-4 border-t pt-4">
                  <h3 className="font-medium">Detalles del servicio</h3>
                  {formFields.map((field) => (
                    <div key={field.id} className="space-y-2">
                      <label className="text-sm font-medium">
                        {field.label}
                        {field.isRequired && <span className="text-destructive ml-1">*</span>}
                      </label>

                      {field.fieldType === "TEXT" && (
                        <Input
                          placeholder={field.placeholder ?? ""}
                          value={formData[field.fieldName] ?? ""}
                          onChange={(e) => handleFieldChange(field.fieldName, e.target.value)}
                          required={field.isRequired}
                        />
                      )}

                      {field.fieldType === "TEXTAREA" && (
                        <textarea
                          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
                          placeholder={field.placeholder ?? ""}
                          value={formData[field.fieldName] ?? ""}
                          onChange={(e) => handleFieldChange(field.fieldName, e.target.value)}
                          required={field.isRequired}
                        />
                      )}

                      {field.fieldType === "NUMBER" && (
                        <Input
                          type="number"
                          placeholder={field.placeholder ?? ""}
                          value={formData[field.fieldName] ?? ""}
                          onChange={(e) => handleFieldChange(field.fieldName, Number(e.target.value))}
                          required={field.isRequired}
                          min={(field.validation as any)?.min}
                          max={(field.validation as any)?.max}
                        />
                      )}

                      {field.fieldType === "SELECT" && (
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={formData[field.fieldName] ?? ""}
                          onChange={(e) => handleFieldChange(field.fieldName, e.target.value)}
                          required={field.isRequired}
                        >
                          <option value="">Selecciona una opción</option>
                          {(field.options as string[])?.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      )}

                      {field.fieldType === "MULTISELECT" && (
                        <div className="flex flex-wrap gap-2">
                          {(field.options as string[])?.map((opt) => {
                            const selected = (formData[field.fieldName] as string[]) ?? [];
                            const isSelected = selected.includes(opt);
                            return (
                              <button
                                key={opt}
                                type="button"
                                className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                                  isSelected
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-background border-input hover:bg-accent"
                                }`}
                                onClick={() => {
                                  handleFieldChange(
                                    field.fieldName,
                                    isSelected
                                      ? selected.filter((s: string) => s !== opt)
                                      : [...selected, opt]
                                  );
                                }}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {field.fieldType === "URL" && (
                        <Input
                          type="url"
                          placeholder={field.placeholder ?? "https://"}
                          value={formData[field.fieldName] ?? ""}
                          onChange={(e) => handleFieldChange(field.fieldName, e.target.value)}
                          required={field.isRequired}
                        />
                      )}

                      {field.fieldType === "COLOR_PICKER" && (
                        <input
                          type="color"
                          className="h-10 w-20 rounded-md border border-input cursor-pointer"
                          value={formData[field.fieldName] ?? "#000000"}
                          onChange={(e) => handleFieldChange(field.fieldName, e.target.value)}
                        />
                      )}

                      {field.fieldType === "CHECKBOX" && (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-input"
                            checked={formData[field.fieldName] ?? false}
                            onChange={(e) => handleFieldChange(field.fieldName, e.target.checked)}
                          />
                          <span className="text-sm">{field.placeholder ?? "Sí"}</span>
                        </label>
                      )}

                      {field.fieldType === "DATE" && (
                        <Input
                          type="date"
                          value={formData[field.fieldName] ?? ""}
                          onChange={(e) => handleFieldChange(field.fieldName, e.target.value)}
                          required={field.isRequired}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Submit */}
              <div className="flex gap-2 pt-4 border-t">
                <Button type="submit" disabled={createMutation.isLoading}>
                  {createMutation.isLoading ? "Creando..." : "Crear Tarea"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                >
                  Cancelar
                </Button>
              </div>

              {createMutation.error && (
                <p className="text-sm text-destructive">
                  {createMutation.error.message}
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
