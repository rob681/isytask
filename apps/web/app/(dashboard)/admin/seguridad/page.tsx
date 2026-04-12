"use client";

import { useState } from "react";
import { Shield, Smartphone, Key, CheckCircle, XCircle, Loader2, Eye, EyeOff, Download, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { QRCodeSVG } from "qrcode.react";
import { useSession, signOut } from "next-auth/react";

export default function SeguridadPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Seguridad de la cuenta</h1>
        <p className="text-muted-foreground mt-1">
          Administra la autenticación de dos factores y tu contraseña.
        </p>
      </div>

      <MfaSection />
      <PasswordSection />
      <GdprSection />
    </div>
  );
}

// ─── MFA Section ─────────────────────────────────────────────────────────────

function MfaSection() {
  const [step, setStep] = useState<"idle" | "setup" | "confirm" | "disable">("idle");
  const [otpauthUrl, setOtpauthUrl] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const utils = trpc.useUtils();
  const { data: status, isLoading } = trpc.mfa.getStatus.useQuery();

  const setupMutation = trpc.mfa.setupMfa.useMutation({
    onSuccess: (data) => {
      setOtpauthUrl(data.otpauthUrl);
      setStep("confirm");
      setError("");
    },
    onError: (e) => setError(e.message),
  });

  const confirmMutation = trpc.mfa.confirmMfa.useMutation({
    onSuccess: () => {
      setSuccess("¡Autenticación de dos factores activada!");
      setStep("idle");
      setCode("");
      utils.mfa.getStatus.invalidate();
    },
    onError: (e) => setError(e.message),
  });

  const disableMutation = trpc.mfa.disableMfa.useMutation({
    onSuccess: () => {
      setSuccess("Autenticación de dos factores desactivada.");
      setStep("idle");
      setCode("");
      utils.mfa.getStatus.invalidate();
    },
    onError: (e) => setError(e.message),
  });

  function startSetup() {
    setError("");
    setSuccess("");
    setCode("");
    setStep("setup");
    setupMutation.mutate();
  }

  function startDisable() {
    setError("");
    setSuccess("");
    setCode("");
    setStep("disable");
  }

  function handleConfirm() {
    if (code.length !== 6) {
      setError("El código debe tener 6 dígitos.");
      return;
    }
    setError("");
    confirmMutation.mutate({ code });
  }

  function handleDisable() {
    if (code.length !== 6) {
      setError("El código debe tener 6 dígitos.");
      return;
    }
    setError("");
    disableMutation.mutate({ code });
  }

  if (isLoading) return null;

  const mfaEnabled = status?.mfaEnabled ?? false;

  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Smartphone className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">Autenticación de dos factores (2FA)</h2>
            <p className="text-sm text-muted-foreground">
              Protege tu cuenta con una app autenticadora.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {mfaEnabled ? (
            <span className="flex items-center gap-1 text-sm font-medium text-green-600">
              <CheckCircle className="h-4 w-4" />
              Activado
            </span>
          ) : (
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <XCircle className="h-4 w-4" />
              Desactivado
            </span>
          )}
        </div>
      </div>

      {/* Success message */}
      {success && (
        <div className="rounded-md bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700">
          {success}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Step: idle — show activate/deactivate button */}
      {step === "idle" && (
        <div>
          {mfaEnabled ? (
            <button
              onClick={startDisable}
              className="rounded-md border border-destructive/40 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
            >
              Desactivar 2FA
            </button>
          ) : (
            <button
              onClick={startSetup}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Activar 2FA
            </button>
          )}
        </div>
      )}

      {/* Step: setup — loading spinner */}
      {step === "setup" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Generando código QR...
        </div>
      )}

      {/* Step: confirm — show QR + code input */}
      {step === "confirm" && otpauthUrl && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Escanea este código QR con tu app autenticadora (Google Authenticator, Authy, 1Password…)
          </p>
          <div className="flex justify-center p-4 bg-white rounded-lg border w-fit">
            <QRCodeSVG value={otpauthUrl} size={180} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Código de verificación</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="flex h-10 w-40 rounded-md border bg-background px-3 text-center text-lg tracking-widest outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground">
              Ingresa el código de 6 dígitos que muestra tu app.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              disabled={confirmMutation.isPending || code.length !== 6}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {confirmMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              Verificar y activar
            </button>
            <button
              onClick={() => { setStep("idle"); setError(""); setCode(""); }}
              className="rounded-md border px-4 py-2 text-sm hover:bg-accent transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Step: disable — require current TOTP code */}
      {step === "disable" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Para desactivar el 2FA, ingresa el código actual de tu app autenticadora.
          </p>
          <div className="space-y-2">
            <label className="text-sm font-medium">Código de verificación</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="flex h-10 w-40 rounded-md border bg-background px-3 text-center text-lg tracking-widest outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleDisable}
              disabled={disableMutation.isPending || code.length !== 6}
              className="rounded-md bg-destructive px-4 py-2 text-sm text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {disableMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              Desactivar 2FA
            </button>
            <button
              onClick={() => { setStep("idle"); setError(""); setCode(""); }}
              className="rounded-md border px-4 py-2 text-sm hover:bg-accent transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Password Section ─────────────────────────────────────────────────────────

function PasswordSection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const changePasswordMutation = trpc.users.changePassword.useMutation({
    onSuccess: () => {
      setSuccess("Contraseña actualizada correctamente.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setError("");
    },
    onError: (e) => {
      setError(e.message);
      setSuccess("");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword !== confirmPassword) {
      setError("Las contraseñas nuevas no coinciden.");
      return;
    }
    if (newPassword.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      setError("La contraseña debe contener al menos una letra mayúscula.");
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      setError("La contraseña debe contener al menos un número.");
      return;
    }
    if (!/[^A-Za-z0-9]/.test(newPassword)) {
      setError("La contraseña debe contener al menos un carácter especial.");
      return;
    }

    changePasswordMutation.mutate({ currentPassword, newPassword, confirmNewPassword: confirmPassword });
  }

  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Key className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold">Cambiar contraseña</h2>
          <p className="text-sm text-muted-foreground">
            Usa una contraseña fuerte con mayúsculas, números y símbolos.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {success && (
          <div className="rounded-md bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700">
            {success}
          </div>
        )}
        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium">Contraseña actual</label>
          <div className="relative">
            <input
              type={showCurrent ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="flex h-10 w-full rounded-md border bg-background px-3 pr-10 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Nueva contraseña</label>
          <div className="relative">
            <input
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              placeholder="Mín. 8 chars, mayúscula, número, símbolo"
              className="flex h-10 w-full rounded-md border bg-background px-3 pr-10 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {/* Visual strength indicators */}
          {newPassword && (
            <div className="space-y-1 text-xs">
              <PasswordCheck ok={newPassword.length >= 8} text="Mínimo 8 caracteres" />
              <PasswordCheck ok={/[A-Z]/.test(newPassword)} text="Al menos una mayúscula" />
              <PasswordCheck ok={/[0-9]/.test(newPassword)} text="Al menos un número" />
              <PasswordCheck ok={/[^A-Za-z0-9]/.test(newPassword)} text="Al menos un símbolo especial" />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Confirmar nueva contraseña</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="flex h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <button
          type="submit"
          disabled={changePasswordMutation.isPending || !currentPassword || !newPassword || !confirmPassword}
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {changePasswordMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
          Actualizar contraseña
        </button>
      </form>
    </div>
  );
}

function PasswordCheck({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className={`flex items-center gap-1.5 ${ok ? "text-green-600" : "text-muted-foreground"}`}>
      {ok ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {text}
    </div>
  );
}

// ─── GDPR Section ─────────────────────────────────────────────────────────────

function GdprSection() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const [showDeleteForm, setShowDeleteForm] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function handleExport() {
    window.location.href = "/api/gdpr/export";
  }

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    if (confirmText !== "ELIMINAR MI CUENTA") {
      setError('Escribe exactamente: ELIMINAR MI CUENTA');
      return;
    }
    setDeleting(true);
    setError("");
    try {
      const res = await fetch("/api/gdpr/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirm: confirmText }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error al eliminar cuenta");
        setDeleting(false);
        return;
      }
      // Success — sign out
      await signOut({ callbackUrl: "/login" });
    } catch {
      setError("Error de red. Intenta de nuevo.");
      setDeleting(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
          <Shield className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h2 className="font-semibold">Datos y privacidad (GDPR)</h2>
          <p className="text-sm text-muted-foreground">
            Exporta o elimina tus datos personales.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleExport}
          className="flex items-center gap-2 rounded-md border px-4 py-2 text-sm hover:bg-accent transition-colors"
        >
          <Download className="h-4 w-4" />
          Descargar mis datos (JSON)
        </button>

        {/* Only non-admin users can self-delete */}
        {role !== "ADMIN" && role !== "SUPER_ADMIN" && (
          <button
            onClick={() => setShowDeleteForm(!showDeleteForm)}
            className="flex items-center gap-2 rounded-md border border-destructive/40 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            Eliminar mi cuenta
          </button>
        )}
      </div>

      {showDeleteForm && (
        <form onSubmit={handleDelete} className="space-y-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm text-destructive font-medium">
            ⚠️ Esta acción es permanente. Tu cuenta será anonimizada y no podrás recuperarla.
          </p>

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Contraseña actual</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="flex h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Escribe <span className="font-mono text-destructive">ELIMINAR MI CUENTA</span> para confirmar
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="ELIMINAR MI CUENTA"
              required
              className="flex h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-destructive"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={deleting || confirmText !== "ELIMINAR MI CUENTA" || !password}
              className="flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleting && <Loader2 className="h-3 w-3 animate-spin" />}
              Eliminar mi cuenta permanentemente
            </button>
            <button
              type="button"
              onClick={() => { setShowDeleteForm(false); setError(""); setPassword(""); setConfirmText(""); }}
              className="rounded-md border px-4 py-2 text-sm hover:bg-accent transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
