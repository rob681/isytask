"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export default function PlatformConfigPage() {
  const configQuery = trpc.platformConfig.getAll.useQuery();
  const setManyMutation = trpc.platformConfig.setMany.useMutation({
    onSuccess: () => {
      configQuery.refetch();
      setMessage("Configuracion guardada");
      setTimeout(() => setMessage(""), 3000);
    },
  });
  const migrateMutation = trpc.platformConfig.migrateFromSystemConfig.useMutation({
    onSuccess: (data) => {
      configQuery.refetch();
      setMessage(`Migracion completada: ${data.migrated} keys migradas`);
    },
  });

  const [form, setForm] = useState<Record<string, any>>({});
  const [message, setMessage] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);

  const testResendMutation = trpc.platformConfig.testResendEmail.useMutation({
    onSuccess: (data) => {
      setTestResult(data);
      if (data.success) {
        setMessage("Email de prueba enviado exitosamente");
        setTimeout(() => setMessage(""), 5000);
      }
    },
    onError: (error) => {
      setTestResult({ success: false, error: error.message });
    },
  });

  useEffect(() => {
    if (configQuery.data) {
      setForm(configQuery.data);
    }
  }, [configQuery.data]);

  const updateField = (key: string, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    setManyMutation.mutate(form);
  };

  if (configQuery.isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Configuracion de Plataforma</h1>
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Configuracion de Plataforma</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configuracion global que aplica a todas las agencias. Solo Super Admin.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => migrateMutation.mutate()}
            disabled={migrateMutation.isPending}
            className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {migrateMutation.isPending ? "Migrando..." : "Migrar desde SystemConfig"}
          </button>
          <button
            onClick={handleSave}
            disabled={setManyMutation.isPending}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {setManyMutation.isPending ? "Guardando..." : "Guardar Cambios"}
          </button>
        </div>
      </div>

      {message && (
        <div className="mb-4 p-3 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm">
          {message}
        </div>
      )}

      {/* ── Email (Resend) ── */}
      <Section title="Email (Resend)" icon="📧" description="Configuracion global de envio de correos para todas las agencias">
        <Field
          label="Resend API Key"
          type="password"
          value={form.resend_api_key ?? ""}
          onChange={(v) => updateField("resend_api_key", v)}
          placeholder="re_..."
        />
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Email remitente"
            value={form.email_from_address ?? "noreply@isytask.com"}
            onChange={(v) => updateField("email_from_address", v)}
            placeholder="noreply@isytask.com"
          />
          <Field
            label="Nombre del remitente"
            value={form.email_from_name ?? "Isytask"}
            onChange={(v) => updateField("email_from_name", v)}
            placeholder="Isytask"
          />
        </div>

        {/* Test Resend Email */}
        <div className="mt-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-900">
          <h3 className="font-medium text-sm mb-3">Probar Configuración de Resend</h3>
          <div className="flex gap-2 mb-3">
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="tu@email.com"
              className="flex-1 px-3 py-2 border rounded-lg text-sm bg-background"
            />
            <button
              onClick={() => testResendMutation.mutate({ testEmail })}
              disabled={testResendMutation.isPending || !testEmail}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {testResendMutation.isPending ? "Enviando..." : "Enviar Test"}
            </button>
          </div>

          {testResult && (
            <div className={`p-3 rounded-lg text-sm flex gap-2 ${
              testResult.success
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}>
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-medium">{testResult.success ? "✓ Éxito" : "✗ Error"}</p>
                <p className="text-xs mt-0.5">{testResult.message || testResult.error}</p>
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* ── AI Agent (OpenRouter) ── */}
      <Section title="Agente IA (OpenRouter)" icon="🤖" description="Motor de IA para agentes inteligentes en servicios">
        <Field
          label="OpenRouter API Key"
          type="password"
          value={form.openrouter_api_key ?? ""}
          onChange={(v) => updateField("openrouter_api_key", v)}
          placeholder="sk-or-..."
        />
        <Field
          label="Modelo por defecto"
          value={form.ai_agent_default_model ?? "openai/gpt-4o-mini"}
          onChange={(v) => updateField("ai_agent_default_model", v)}
          placeholder="openai/gpt-4o-mini"
        />
        <Toggle
          label="Agente IA habilitado"
          description="Permite que los servicios usen agentes de IA"
          checked={form.ai_agent_enabled ?? false}
          onChange={(v) => updateField("ai_agent_enabled", v)}
        />
      </Section>

      {/* ── WhatsApp Platform (Meta Business API) ── */}
      <Section title="WhatsApp Plataforma (Meta)" icon="💬" description="WhatsApp Business API para notificaciones globales de Isytask">
        <Field
          label="Phone Number ID"
          value={form.meta_whatsapp_phone_number_id ?? ""}
          onChange={(v) => updateField("meta_whatsapp_phone_number_id", v)}
          placeholder="ID del numero de telefono de Meta"
        />
        <Field
          label="Access Token"
          type="password"
          value={form.meta_whatsapp_access_token ?? ""}
          onChange={(v) => updateField("meta_whatsapp_access_token", v)}
          placeholder="Token de acceso de Meta"
        />
        <Field
          label="Business Account ID"
          value={form.meta_whatsapp_business_id ?? ""}
          onChange={(v) => updateField("meta_whatsapp_business_id", v)}
          placeholder="ID de la cuenta de negocios"
        />
        <Field
          label="Webhook Verify Token"
          value={form.meta_whatsapp_verify_token ?? ""}
          onChange={(v) => updateField("meta_whatsapp_verify_token", v)}
          placeholder="Token de verificacion del webhook"
        />
        <Field
          label="Numero WhatsApp plataforma"
          value={form.platform_whatsapp_from ?? ""}
          onChange={(v) => updateField("platform_whatsapp_from", v)}
          placeholder="whatsapp:+521234567890"
        />
      </Section>

      {/* ── Platform General ── */}
      <Section title="General" icon="⚙️" description="Nombre y configuracion general de la plataforma">
        <Field
          label="Nombre de la plataforma"
          value={form.company_name ?? "Isytask"}
          onChange={(v) => updateField("company_name", v)}
        />
      </Section>
    </div>
  );
}

// ── Reusable Components ──

function Section({
  title,
  icon,
  description,
  children,
}: {
  title: string;
  icon: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-8 border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">{icon}</span>
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">{description}</p>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
      />
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`w-11 h-6 rounded-full transition-colors ${
          checked ? "bg-blue-600" : "bg-gray-300"
        }`}
      >
        <div
          className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
