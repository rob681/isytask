"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc/client";
import {
  Sparkles, ArrowRight, ArrowLeft, Check, Loader2,
  Briefcase, Users, Wand2, Trash2, Plus, GripVertical,
} from "lucide-react";

type SuggestedService = {
  name: string;
  description: string;
  estimatedHours: number;
  slaHours: number | null;
  fields: Array<{
    fieldName: string;
    label: string;
    fieldType: string;
    isRequired: boolean;
    placeholder?: string;
    options?: string[];
  }>;
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [agencyType, setAgencyType] = useState("");
  const [agencyDescription, setAgencyDescription] = useState("");
  const [teamSize, setTeamSize] = useState<number | undefined>();
  const [services, setServices] = useState<SuggestedService[]>([]);
  const [selectedServices, setSelectedServices] = useState<Set<number>>(new Set());

  const { data: agencyTypes } = trpc.onboarding.getAgencyTypes.useQuery();
  const { data: status } = trpc.onboarding.getStatus.useQuery();

  const suggestMutation = trpc.onboarding.suggestServices.useMutation({
    onSuccess: (data) => {
      setServices(data.services);
      setSelectedServices(new Set(data.services.map((_, i) => i)));
      setStep(3);
    },
  });

  const createMutation = trpc.onboarding.createServices.useMutation({
    onSuccess: (data) => {
      setStep(4);
    },
  });

  const handleSuggest = () => {
    if (!agencyType) return;
    suggestMutation.mutate({
      agencyType,
      agencyDescription: agencyDescription || undefined,
      teamSize,
    });
    setStep(2); // Show loading state
  };

  const handleCreate = () => {
    const selectedList = services.filter((_, i) => selectedServices.has(i));
    if (selectedList.length === 0) return;
    createMutation.mutate({ services: selectedList });
  };

  const toggleService = (index: number) => {
    setSelectedServices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const removeService = (index: number) => {
    setServices((prev) => prev.filter((_, i) => i !== index));
    setSelectedServices((prev) => {
      const next = new Set<number>();
      for (const i of prev) {
        if (i < index) next.add(i);
        else if (i > index) next.add(i - 1);
      }
      return next;
    });
  };

  // If already has services, show completion state
  if (status?.completed && step === 1) {
    return (
      <>
        <Topbar title="Configuración Inicial" />
        <div className="p-6 max-w-2xl mx-auto">
          <Card className="text-center">
            <CardContent className="py-12">
              <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold mb-2">Configuración completada</h2>
              <p className="text-muted-foreground mb-6">
                Ya tienes {status.serviceCount} servicio(s) configurado(s). Puedes agregar más
                desde la sección de Servicios.
              </p>
              <div className="flex gap-3 justify-center">
                <Button onClick={() => router.push("/admin/servicios")}>
                  Ir a Servicios
                </Button>
                <Button variant="outline" onClick={() => setStep(1)}>
                  Agregar más servicios con IA
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar title="Configuración Inicial" />
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        {/* Progress steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  step >= s
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {step > s ? <Check className="h-4 w-4" /> : s}
              </div>
              {s < 4 && (
                <div
                  className={`w-12 h-0.5 ${
                    step > s ? "bg-primary" : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Agency info */}
        {step === 1 && (
          <Card>
            <CardHeader className="text-center">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
                <Briefcase className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-xl">Cuéntanos sobre tu agencia</CardTitle>
              <CardDescription>
                Con esta información, la IA sugerirá servicios personalizados para tu equipo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo de agencia *</label>
                <div className="grid grid-cols-2 gap-2">
                  {agencyTypes?.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setAgencyType(type.value)}
                      className={`p-3 rounded-lg border text-left text-sm transition-colors ${
                        agencyType === type.value
                          ? "border-primary bg-primary/5 text-primary font-medium"
                          : "border-input hover:border-primary/50 hover:bg-muted/50"
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Descripción adicional
                  <span className="text-muted-foreground font-normal ml-1">(opcional)</span>
                </label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
                  placeholder="Ej: Nos especializamos en e-commerce y branding para restaurantes..."
                  value={agencyDescription}
                  onChange={(e) => setAgencyDescription(e.target.value)}
                  maxLength={500}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Tamaño del equipo
                  <span className="text-muted-foreground font-normal ml-1">(opcional)</span>
                </label>
                <Input
                  type="number"
                  placeholder="Ej: 5"
                  min={1}
                  max={100}
                  value={teamSize ?? ""}
                  onChange={(e) =>
                    setTeamSize(e.target.value ? Number(e.target.value) : undefined)
                  }
                />
              </div>

              <Button
                onClick={handleSuggest}
                disabled={!agencyType}
                className="w-full"
                size="lg"
              >
                <Wand2 className="h-4 w-4 mr-2" />
                Generar servicios con IA
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Loading */}
        {step === 2 && (
          <Card>
            <CardContent className="py-16 text-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2">
                Generando servicios personalizados...
              </h2>
              <p className="text-muted-foreground text-sm">
                La IA está analizando tu tipo de agencia para sugerir los mejores servicios
              </p>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Review services */}
        {step === 3 && (
          <>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Servicios sugeridos</CardTitle>
                    <CardDescription>
                      Revisa y selecciona los servicios que deseas crear.
                      Puedes modificarlos después.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {services.map((svc, index) => {
                  const isSelected = selectedServices.has(index);
                  return (
                    <div
                      key={index}
                      className={`relative rounded-lg border p-4 transition-colors cursor-pointer ${
                        isSelected
                          ? "border-primary/50 bg-primary/5"
                          : "border-input opacity-60"
                      }`}
                      onClick={() => toggleService(index)}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 h-5 w-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                            isSelected
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-muted-foreground/30"
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium">{svc.name}</h3>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {svc.description}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span>{svc.estimatedHours}h estimadas</span>
                            {svc.slaHours && <span>SLA: {svc.slaHours}h</span>}
                            <span>{svc.fields.length} campos</span>
                          </div>
                          {isSelected && svc.fields.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {svc.fields.map((field) => (
                                <span
                                  key={field.fieldName}
                                  className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                                >
                                  {field.label}
                                  {field.isRequired && (
                                    <span className="text-destructive ml-0.5">*</span>
                                  )}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeService(index);
                          }}
                          className="p-1 rounded hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {services.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No se generaron servicios. Intenta de nuevo.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver
              </Button>
              <Button
                onClick={handleCreate}
                disabled={selectedServices.size === 0 || createMutation.isLoading}
                className="flex-1"
                size="lg"
              >
                {createMutation.isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Crear {selectedServices.size} servicio(s)
              </Button>
            </div>
          </>
        )}

        {/* Step 4: Done */}
        {step === 4 && (
          <Card className="text-center">
            <CardContent className="py-12">
              <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold mb-2">
                ¡Servicios creados exitosamente!
              </h2>
              <p className="text-muted-foreground mb-6">
                Tus servicios están listos. Los clientes ya pueden crear tareas
                usando estos servicios.
              </p>
              <div className="flex gap-3 justify-center">
                <Button onClick={() => router.push("/admin/servicios")}>
                  Ver mis servicios
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push("/admin")}
                >
                  Ir al Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Skip option (only on step 1) */}
        {step === 1 && (
          <p className="text-center text-sm text-muted-foreground">
            ¿Prefieres configurar manualmente?{" "}
            <button
              onClick={() => router.push("/admin/servicios")}
              className="text-primary hover:underline"
            >
              Ir a Servicios
            </button>
          </p>
        )}
      </div>
    </>
  );
}
