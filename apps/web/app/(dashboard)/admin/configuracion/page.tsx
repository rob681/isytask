"use client";

import { useState, useEffect, useRef } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc/client";
import {
  Settings, Save, Building2, ListTodo, Bell, ImageIcon, Upload,
  Trash2, Loader2, Clock, Globe, Plus, X, Mail, Smartphone, Key, Bot,
} from "lucide-react";
import { CardListSkeleton } from "@/components/ui/skeleton";

// ─── Day labels ────────────────────────────────────────
const DAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const DAY_LABELS: Record<string, string> = {
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miércoles",
  thursday: "Jueves",
  friday: "Viernes",
  saturday: "Sábado",
  sunday: "Domingo",
};

// ─── Common timezone list ────────────────────────────────
const COMMON_TIMEZONES = [
  "America/Mexico_City",
  "America/Cancun",
  "America/Monterrey",
  "America/Tijuana",
  "America/Bogota",
  "America/Lima",
  "America/Santiago",
  "America/Buenos_Aires",
  "America/Sao_Paulo",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/Madrid",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "UTC",
];

type TimeBlock = { start: string; end: string };
type DayConfig = { enabled: boolean; blocks: TimeBlock[] };
type BusinessHours = Record<string, DayConfig>;

export default function ConfiguracionPage() {
  const { data: config, isLoading } = trpc.config.getAll.useQuery();
  const { data: agencyLogo } = trpc.agencies.getMyAgencyLogo.useQuery();
  const utils = trpc.useUtils();

  const [values, setValues] = useState<Record<string, any>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingLogoWhite, setUploadingLogoWhite] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const logoWhiteInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (config) {
      setValues((prev) => ({
        ...config,
        // Load agency logos instead of global config
        company_logo_url: prev.company_logo_url ?? agencyLogo?.logoUrl ?? config.company_logo_url,
        company_logo_white_url: prev.company_logo_white_url ?? agencyLogo?.logoWhiteUrl ?? config.company_logo_white_url,
      }));
    }
  }, [config, agencyLogo]);

  // ─── Logo upload handler ────────────────────────────────
  async function handleLogoUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    key: "company_logo_url" | "company_logo_white_url",
    setUploading: (v: boolean) => void
  ) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("El archivo excede 2MB");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "logo");

      const res = await fetch("/api/uploads/image", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Error al subir imagen");
        return;
      }

      const { url } = await res.json();
      updateValue(key, url);
    } catch {
      alert("Error al subir imagen");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  const saveMutation = trpc.config.setMany.useMutation({
    onSuccess: () => {
      utils.config.getAll.invalidate();
      utils.config.getPublic.invalidate();
      setHasChanges(false);
    },
  });

  const saveLogoMutation = trpc.agencies.updateMyAgencyLogo.useMutation({
    onSuccess: () => {
      utils.agencies.getMyAgencyLogo.invalidate();
    },
  });

  const updateValue = (key: string, value: any) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    // Save logos to agency (per-agency), everything else to system config (global)
    const { company_logo_url, company_logo_white_url, ...configValues } = values;

    // Save agency logos
    saveLogoMutation.mutate({
      logoUrl: company_logo_url ?? null,
      logoWhiteUrl: company_logo_white_url ?? null,
    });

    // Save other config values
    saveMutation.mutate(configValues);
  };

  // ─── Business Hours helpers ────────────────────────────
  const businessHours: BusinessHours = values.business_hours ?? {};

  const updateDayEnabled = (day: string, enabled: boolean) => {
    const updated = {
      ...businessHours,
      [day]: {
        ...businessHours[day],
        enabled,
        blocks: enabled && (!businessHours[day]?.blocks || businessHours[day].blocks.length === 0)
          ? [{ start: "09:00", end: "18:00" }]
          : businessHours[day]?.blocks ?? [],
      },
    };
    updateValue("business_hours", updated);
  };

  const addTimeBlock = (day: string) => {
    const blocks = [...(businessHours[day]?.blocks ?? []), { start: "09:00", end: "18:00" }];
    updateValue("business_hours", {
      ...businessHours,
      [day]: { ...businessHours[day], blocks },
    });
  };

  const updateTimeBlock = (day: string, idx: number, field: "start" | "end", val: string) => {
    const blocks = [...(businessHours[day]?.blocks ?? [])];
    blocks[idx] = { ...blocks[idx], [field]: val };
    updateValue("business_hours", {
      ...businessHours,
      [day]: { ...businessHours[day], blocks },
    });
  };

  const removeTimeBlock = (day: string, idx: number) => {
    const blocks = (businessHours[day]?.blocks ?? []).filter((_: TimeBlock, i: number) => i !== idx);
    updateValue("business_hours", {
      ...businessHours,
      [day]: { ...businessHours[day], blocks },
    });
  };

  if (isLoading) {
    return (
      <>
        <Topbar title="Configuración" />
        <div className="p-6">
          <CardListSkeleton cards={3} />
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar title="Configuración" />
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Configura los valores por defecto del sistema
            </p>
          </div>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saveMutation.isLoading}
          >
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isLoading ? "Guardando..." : "Guardar Cambios"}
          </Button>
        </div>

        {/* General */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">General</CardTitle>
                <CardDescription>Configuración general del sistema</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nombre de la empresa</label>
                <Input
                  value={values.company_name ?? ""}
                  onChange={(e) => updateValue("company_name", e.target.value)}
                  placeholder="Nombre de tu empresa"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Company Logo */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">Logo de la Empresa</CardTitle>
                <CardDescription>
                  Sube el logo principal y una versión en blanco para el modo oscuro
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Main logo */}
              <div className="space-y-3">
                <label className="text-sm font-medium">Logo principal</label>
                <div className="border rounded-lg p-4 flex flex-col items-center gap-3 min-h-[140px] justify-center bg-muted/30">
                  {values.company_logo_url ? (
                    <>
                      <img
                        src={values.company_logo_url}
                        alt="Logo principal"
                        className="max-h-16 max-w-[200px] object-contain"
                      />
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => logoInputRef.current?.click()}
                          disabled={uploadingLogo}
                        >
                          {uploadingLogo ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <Upload className="h-3 w-3 mr-1" />
                          )}
                          Cambiar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => updateValue("company_logo_url", null)}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Eliminar
                        </Button>
                      </div>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={uploadingLogo}
                    >
                      {uploadingLogo ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      Subir logo
                    </Button>
                  )}
                </div>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={(e) =>
                    handleLogoUpload(e, "company_logo_url", setUploadingLogo)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  PNG, JPG, SVG o WebP. Máximo 2MB.
                </p>
              </div>

              {/* White logo (for dark mode) */}
              <div className="space-y-3">
                <label className="text-sm font-medium">Logo versión blanca</label>
                <div className="border rounded-lg p-4 flex flex-col items-center gap-3 min-h-[140px] justify-center bg-gray-900">
                  {values.company_logo_white_url ? (
                    <>
                      <img
                        src={values.company_logo_white_url}
                        alt="Logo blanco"
                        className="max-h-16 max-w-[200px] object-contain"
                      />
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => logoWhiteInputRef.current?.click()}
                          disabled={uploadingLogoWhite}
                        >
                          {uploadingLogoWhite ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <Upload className="h-3 w-3 mr-1" />
                          )}
                          Cambiar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-300"
                          onClick={() =>
                            updateValue("company_logo_white_url", null)
                          }
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Eliminar
                        </Button>
                      </div>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => logoWhiteInputRef.current?.click()}
                      disabled={uploadingLogoWhite}
                    >
                      {uploadingLogoWhite ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      Subir logo blanco
                    </Button>
                  )}
                </div>
                <input
                  ref={logoWhiteInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={(e) =>
                    handleLogoUpload(
                      e,
                      "company_logo_white_url",
                      setUploadingLogoWhite
                    )
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Para modo oscuro. PNG, JPG, SVG o WebP. Máximo 2MB.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Business Hours */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">Horario de Atención</CardTitle>
                <CardDescription>
                  Configura los horarios de trabajo de la empresa. Los clientes podrán ver estos horarios.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {DAY_KEYS.map((day) => {
              const dayConf = businessHours[day] ?? { enabled: false, blocks: [] };
              return (
                <div key={day} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={dayConf.enabled}
                        onChange={(e) => updateDayEnabled(day, e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span className="text-sm font-medium">{DAY_LABELS[day]}</span>
                    </label>
                    {dayConf.enabled && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => addTimeBlock(day)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Bloque
                      </Button>
                    )}
                  </div>
                  {dayConf.enabled && dayConf.blocks.length > 0 && (
                    <div className="space-y-2 ml-6">
                      {dayConf.blocks.map((block: TimeBlock, idx: number) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="time"
                            value={block.start}
                            onChange={(e) => updateTimeBlock(day, idx, "start", e.target.value)}
                            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                          />
                          <span className="text-xs text-muted-foreground">a</span>
                          <input
                            type="time"
                            value={block.end}
                            onChange={(e) => updateTimeBlock(day, idx, "end", e.target.value)}
                            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                          />
                          {dayConf.blocks.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeTimeBlock(day, idx)}
                              className="text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {dayConf.enabled && dayConf.blocks.length === 0 && (
                    <p className="text-xs text-muted-foreground ml-6">
                      Sin bloques horarios definidos
                    </p>
                  )}
                  {!dayConf.enabled && (
                    <p className="text-xs text-muted-foreground ml-6">
                      Cerrado
                    </p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Regional Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">Configuración Regional</CardTitle>
                <CardDescription>
                  Zona horaria, formato de hora, fecha e idioma del sistema
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Zona horaria</label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={values.timezone ?? "America/Mexico_City"}
                  onChange={(e) => updateValue("timezone", e.target.value)}
                >
                  {COMMON_TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Formato de hora</label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={values.time_format ?? "24h"}
                  onChange={(e) => updateValue("time_format", e.target.value)}
                >
                  <option value="24h">24 horas (14:30)</option>
                  <option value="12h">12 horas (2:30 PM)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Formato de fecha</label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={values.date_format ?? "DD/MM/YYYY"}
                  onChange={(e) => updateValue("date_format", e.target.value)}
                >
                  <option value="DD/MM/YYYY">DD/MM/YYYY (07/03/2026)</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY (03/07/2026)</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD (2026-03-07)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Idioma</label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={values.language ?? "es"}
                  onChange={(e) => updateValue("language", e.target.value)}
                >
                  <option value="es">Español</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Task defaults */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ListTodo className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">Valores por Defecto de Tareas</CardTitle>
                <CardDescription>
                  Estos valores se aplican a nuevos clientes automáticamente
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Límite mensual de tareas</label>
                <Input
                  type="number"
                  min={1}
                  value={values.default_monthly_task_limit ?? 10}
                  onChange={(e) =>
                    updateValue("default_monthly_task_limit", parseInt(e.target.value) || 10)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Máximo de tareas que un cliente puede crear por mes
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Límite de revisiones por tarea</label>
                <Input
                  type="number"
                  min={0}
                  value={values.default_revision_limit_per_task ?? 3}
                  onChange={(e) =>
                    updateValue("default_revision_limit_per_task", parseInt(e.target.value) || 3)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Número de revisiones permitidas después de completar una tarea
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">Notificaciones</CardTitle>
                <CardDescription>Canales de notificación habilitados</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 pb-3 border-b">
              <label className="text-sm font-medium">Recordatorio de tareas pendientes</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={168}
                  className="w-24"
                  value={values.pending_task_reminder_hours ?? 24}
                  onChange={(e) =>
                    updateValue("pending_task_reminder_hours", parseInt(e.target.value) || 24)
                  }
                />
                <span className="text-sm text-muted-foreground">horas</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Si una tarea asignada no es activada después de este tiempo, se enviará un recordatorio al colaborador responsable
              </p>
            </div>

            {[
              { key: "notification_inapp_enabled", label: "Notificaciones in-app", desc: "Notificaciones dentro de la aplicación" },
              { key: "notification_email_enabled", label: "Email", desc: "Enviar notificaciones por correo electrónico (requiere Resend)" },
              { key: "notification_push_enabled", label: "Push en navegador", desc: "Notificaciones push del navegador (requiere claves VAPID)" },
              { key: "notification_whatsapp_enabled", label: "WhatsApp", desc: "Enviar notificaciones por WhatsApp Business API" },
            ].map((channel) => (
              <div key={channel.key}>
                <label className="flex items-center justify-between p-3 rounded-md border cursor-pointer hover:bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">{channel.label}</p>
                    <p className="text-xs text-muted-foreground">{channel.desc}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={values[channel.key] ?? false}
                    onChange={(e) => updateValue(channel.key, e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                </label>
                {/* VAPID keys inline — shown right below the push toggle */}
                {channel.key === "notification_push_enabled" && (
                  <VapidInlineSection values={values} updateValue={updateValue} />
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Email Configuration — Now managed by Super Admin */}
        <Card className="opacity-70">
          <CardHeader>
            <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg mb-3">
              <span className="text-blue-600">ℹ️</span>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                La configuracion de Email, IA y WhatsApp Business es gestionada por el administrador de la plataforma.
                Aqui solo puedes activar o desactivar los canales de notificacion.
              </p>
            </div>
          </CardHeader>
        </Card>

        {/* Email Configuration (Resend) — HIDDEN: managed by Super Admin */}
        <Card className="hidden">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">Configuración de Email</CardTitle>
                <CardDescription>
                  Configura el envío de emails con Resend. Obtén tu API Key en{" "}
                  <a href="https://resend.com" target="_blank" rel="noreferrer" className="text-primary underline">
                    resend.com
                  </a>
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Resend API Key</label>
              <Input
                type="password"
                value={values.resend_api_key ?? ""}
                onChange={(e) => updateValue("resend_api_key", e.target.value)}
                placeholder="re_xxxxxxxxxx"
              />
              <p className="text-xs text-muted-foreground">
                Tu clave de API de Resend. Se mantiene encriptada.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email remitente</label>
                <Input
                  value={values.email_from_address ?? "noreply@isytask.com"}
                  onChange={(e) => updateValue("email_from_address", e.target.value)}
                  placeholder="noreply@tudominio.com"
                />
                <p className="text-xs text-muted-foreground">
                  Debe ser un dominio verificado en Resend
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Nombre del remitente</label>
                <Input
                  value={values.email_from_name ?? "Isytask"}
                  onChange={(e) => updateValue("email_from_name", e.target.value)}
                  placeholder="Nombre de tu empresa"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Push Notification Configuration — now inline inside Notifications card above */}

        {/* WhatsApp Configuration (Twilio) */}
        {values.notification_whatsapp_enabled && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle className="text-base">Configuración de WhatsApp</CardTitle>
                  <CardDescription>
                    Envía notificaciones por WhatsApp usando Twilio. Configura tu cuenta en{" "}
                    <a href="https://www.twilio.com/whatsapp" target="_blank" rel="noreferrer" className="text-primary underline">
                      twilio.com/whatsapp
                    </a>
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Account SID</label>
                <Input
                  type="password"
                  value={values.twilio_account_sid ?? ""}
                  onChange={(e) => updateValue("twilio_account_sid", e.target.value)}
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Auth Token</label>
                <Input
                  type="password"
                  value={values.twilio_auth_token ?? ""}
                  onChange={(e) => updateValue("twilio_auth_token", e.target.value)}
                  placeholder="Tu Twilio Auth Token"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Número de WhatsApp remitente</label>
                <Input
                  value={values.twilio_whatsapp_from ?? ""}
                  onChange={(e) => updateValue("twilio_whatsapp_from", e.target.value)}
                  placeholder="whatsapp:+14155238886"
                />
                <p className="text-xs text-muted-foreground">
                  Para pruebas usa el sandbox de Twilio. En producción, tu número aprobado de WhatsApp Business.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* AI Agent Configuration — HIDDEN: managed by Super Admin */}
        <Card className="hidden">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">Agente IA</CardTitle>
                <CardDescription>
                  Configura un agente de IA para asistir a los clientes al crear tareas.
                  Usa OpenRouter para acceder a múltiples modelos. Obtén tu API Key en{" "}
                  <a href="https://openrouter.ai" target="_blank" rel="noreferrer" className="text-primary underline">
                    openrouter.ai
                  </a>
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center justify-between p-3 rounded-md border cursor-pointer hover:bg-muted/50">
              <div>
                <p className="text-sm font-medium">Habilitar Agente IA</p>
                <p className="text-xs text-muted-foreground">
                  Permite que un agente IA asista a los clientes durante la creación de tareas
                </p>
              </div>
              <input
                type="checkbox"
                checked={values.ai_agent_enabled ?? false}
                onChange={(e) => updateValue("ai_agent_enabled", e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
            </label>

            <div className="space-y-2">
              <label className="text-sm font-medium">OpenRouter API Key</label>
              <Input
                type="password"
                value={values.openrouter_api_key ?? ""}
                onChange={(e) => updateValue("openrouter_api_key", e.target.value)}
                placeholder="sk-or-v1-xxxxxxxxxx"
              />
              <p className="text-xs text-muted-foreground">
                Tu clave de API de OpenRouter.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Modelo por defecto</label>
              <Input
                value={values.ai_agent_default_model ?? "openai/gpt-4o-mini"}
                onChange={(e) => updateValue("ai_agent_default_model", e.target.value)}
                placeholder="openai/gpt-4o-mini"
              />
              <p className="text-xs text-muted-foreground">
                Modelo de OpenRouter a usar. Puede ser sobrescrito por servicio.
                Ejemplos: openai/gpt-4o-mini, anthropic/claude-3.5-sonnet, google/gemini-2.0-flash-001
              </p>
            </div>
          </CardContent>
        </Card>

        {saveMutation.error && (
          <p className="text-sm text-destructive">{saveMutation.error.message}</p>
        )}

        {saveMutation.isSuccess && !hasChanges && (
          <p className="text-sm text-green-600">Configuración guardada correctamente</p>
        )}
      </div>
    </>
  );
}

// ─── VAPID Inline Section ───────────────────────────────
// Shown directly below the "Push en navegador" toggle
function VapidInlineSection({
  values,
  updateValue,
}: {
  values: Record<string, any>;
  updateValue: (key: string, value: any) => void;
}) {
  const [generating, setGenerating] = useState(false);
  const generateVapidMutation = trpc.push.generateVapidKeys.useMutation({
    onSuccess: (data) => {
      updateValue("vapid_public_key", data.publicKey);
      setGenerating(false);
    },
    onError: () => setGenerating(false),
  });

  const hasVapidKeys = !!(values.vapid_public_key);

  return (
    <div className="ml-3 mr-0 mb-1 mt-0 space-y-3 border-x border-b rounded-b-md px-3 pb-3 pt-2 bg-muted/20">
      {/* VAPID key status */}
      {hasVapidKeys ? (
        <div className="flex items-center gap-2 p-2.5 rounded-md bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
          <Key className="h-3.5 w-3.5 text-green-600 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-green-700 dark:text-green-300">Claves VAPID activas</p>
            <p className="text-xs text-green-600 dark:text-green-400 font-mono truncate">
              {(values.vapid_public_key as string)?.substring(0, 44)}…
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto shrink-0 h-7 text-xs"
            onClick={() => {
              setGenerating(true);
              generateVapidMutation.mutate();
            }}
            disabled={generating}
          >
            {generating ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Key className="h-3 w-3 mr-1" />}
            Regenerar
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between p-2.5 rounded-md bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
          <div>
            <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Claves VAPID requeridas</p>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Genera las claves para activar el push en navegador
            </p>
          </div>
          <Button
            size="sm"
            className="ml-3 h-7 text-xs shrink-0"
            onClick={() => {
              setGenerating(true);
              generateVapidMutation.mutate();
            }}
            disabled={generating}
          >
            {generating ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Key className="h-3 w-3 mr-1" />}
            Generar claves
          </Button>
        </div>
      )}

      {/* VAPID contact email */}
      <div className="flex items-center gap-3">
        <label className="text-xs font-medium text-muted-foreground w-36 shrink-0">Email de contacto</label>
        <Input
          className="h-7 text-xs"
          value={values.vapid_subject ?? "mailto:admin@isytask.com"}
          onChange={(e) => updateValue("vapid_subject", e.target.value)}
          placeholder="mailto:tu@email.com"
        />
      </div>
    </div>
  );
}
