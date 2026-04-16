"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { trpc } from "@/lib/trpc/client";
import { useRef } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showResendSection, setShowResendSection] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const router = useRouter();
  const resendMutation = trpc.auth.resendVerification.useMutation();
  const resendEmailInputRef = useRef<HTMLInputElement>(null);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        // NextAuth passes the error message from authorize() throw
        setError(result.error);
      } else {
        router.push("/");
        router.refresh();
      }
    } catch {
      setError("Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = (e: React.FormEvent) => {
    e.preventDefault();
    const emailValue = resendEmail.trim();
    if (emailValue) {
      resendMutation.mutate({ email: emailValue });
      // Clear the input after submission
      setResendEmail("");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      {/* Subtle gradient background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/4 w-[600px] h-[600px] rounded-full bg-[hsl(262,83%,58%)] opacity-[0.04] blur-[100px]" />
        <div className="absolute -bottom-1/2 -right-1/4 w-[600px] h-[600px] rounded-full bg-[hsl(185,80%,50%)] opacity-[0.04] blur-[100px]" />
      </div>

      <Card className="w-full max-w-md relative glass-card shadow-soft">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="flex justify-center">
            <img
              src="/isytask-logo.svg"
              alt="Isytask"
              className="h-10 object-contain dark:hidden"
            />
            <img
              src="/isytask-logo-white.svg"
              alt="Isytask"
              className="h-10 object-contain hidden dark:block"
            />
          </div>
          <CardDescription className="text-sm">
            Ingresa tus credenciales para acceder
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Correo electrónico
              </label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium">
                  Contraseña
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="Tu contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11 rounded-lg"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}
            <Button
              type="submit"
              className="w-full h-11 rounded-lg gradient-primary text-white font-semibold shadow-md hover:opacity-90 transition-opacity"
              disabled={loading}
            >
              {loading ? "Iniciando sesión..." : "Iniciar sesión"}
            </Button>
          </form>

          {/* Resend verification email section */}
          <div className="mt-6 pt-6 border-t">
            {!showResendSection ? (
              <Button
                type="button"
                variant="outline"
                className="w-full text-xs h-9"
                onClick={() => setShowResendSection(true)}
              >
                ¿No recibiste el email de verificación?
              </Button>
            ) : (
              <form onSubmit={handleResendEmail} className="space-y-3">
                <p className="text-xs text-muted-foreground text-center">
                  Ingresa tu email para reenviar el enlace de verificación
                </p>
                <Input
                  ref={resendEmailInputRef}
                  type="email"
                  placeholder="tu@email.com"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  className="h-10 rounded-lg text-sm"
                  required
                />
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    variant="default"
                    className="flex-1 h-10"
                    disabled={resendMutation.isPending || !resendEmail.trim()}
                  >
                    {resendMutation.isPending ? "Enviando..." : "Reenviar"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="flex-1 h-10"
                    onClick={() => {
                      setShowResendSection(false);
                      setResendEmail("");
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
                {resendMutation.isSuccess && (
                  <p className="text-xs text-green-600 text-center font-medium">
                    ✓ Email enviado. Revisa tu bandeja de entrada.
                  </p>
                )}
                {resendMutation.error && (
                  <p className="text-xs text-red-600 text-center">
                    ✗ {resendMutation.error.message}
                  </p>
                )}
              </form>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
