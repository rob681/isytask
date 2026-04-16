"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  MailCheck,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";

export default function VerificarEmailPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <VerificarEmailPage />
    </Suspense>
  );
}

function VerificarEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const router = useRouter();

  const [resendEmail, setResendEmail] = useState("");
  const [resendSent, setResendSent] = useState(false);

  const verifyMutation = trpc.auth.verifyEmail.useMutation();
  const resendMutation = trpc.auth.resendVerification.useMutation({
    onSuccess: () => setResendSent(true),
  });

  // Auto-verify when token is present
  useEffect(() => {
    if (token) {
      verifyMutation.mutate({ token });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Auto-redirect to login after 4 seconds on success
  useEffect(() => {
    if (verifyMutation.isSuccess) {
      const t = setTimeout(() => router.push("/login"), 4000);
      return () => clearTimeout(t);
    }
  }, [verifyMutation.isSuccess, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <MailCheck className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">Verificación de correo</h1>
        </div>

        {/* Loading */}
        {token && verifyMutation.isPending && (
          <div className="rounded-xl border bg-card p-6 text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground">Verificando tu correo…</p>
          </div>
        )}

        {/* Success */}
        {verifyMutation.isSuccess && (
          <div className="rounded-xl border border-green-200 bg-green-50 dark:bg-green-950/30 p-6 text-center space-y-3">
            <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto" />
            <div>
              <p className="font-semibold text-green-800 dark:text-green-300">
                ¡Correo verificado!
              </p>
              <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                Tu cuenta está activa. Redirigiendo al login…
              </p>
            </div>
            <Link
              href="/login"
              className="inline-block rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Iniciar sesión ahora
            </Link>
          </div>
        )}

        {/* Error */}
        {verifyMutation.isError && (
          <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30 p-6 text-center space-y-3">
            <XCircle className="h-10 w-10 text-red-500 mx-auto" />
            <div>
              <p className="font-semibold text-red-700 dark:text-red-400">
                Enlace inválido o expirado
              </p>
              <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                {verifyMutation.error.message}
              </p>
            </div>
          </div>
        )}

        {/* No token — show resend form */}
        {!token && (
          <div className="rounded-xl border bg-card p-6 space-y-4">
            <div className="text-center space-y-1">
              <p className="font-medium">¿No recibiste el correo de verificación?</p>
              <p className="text-sm text-muted-foreground">
                Ingresa tu correo y te enviamos un nuevo enlace.
              </p>
            </div>
            {resendSent ? (
              <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 p-3 text-sm text-green-700 dark:text-green-400 text-center">
                ✓ Correo enviado. Revisa tu bandeja de entrada.
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (resendEmail) resendMutation.mutate({ email: resendEmail });
                }}
                className="space-y-3"
              >
                <input
                  type="email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  required
                  className="flex h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  type="submit"
                  disabled={resendMutation.isPending || !resendEmail}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {resendMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Reenviar correo de verificación
                </button>
              </form>
            )}
          </div>
        )}

        {/* Show resend form also on error */}
        {verifyMutation.isError && !resendSent && (
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <p className="text-sm text-center text-muted-foreground">
              Solicita un nuevo enlace de verificación:
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (resendEmail) resendMutation.mutate({ email: resendEmail });
              }}
              className="flex gap-2"
            >
              <input
                type="email"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                placeholder="tu@correo.com"
                required
                className="flex h-9 flex-1 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="submit"
                disabled={resendMutation.isPending || !resendEmail}
                className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {resendMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Reenviar"
                )}
              </button>
            </form>
            {resendSent && (
              <p className="text-sm text-center text-green-600">✓ Correo enviado.</p>
            )}
          </div>
        )}

        <p className="text-center text-sm text-muted-foreground">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
