"use client";

import { Suspense, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerAgencySchema } from "@isytask/shared";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import { Loader2, CheckCircle2, Check } from "lucide-react";
import { GoogleReCaptchaProvider, useGoogleReCaptcha } from "react-google-recaptcha-v3";

type RegisterForm = z.infer<typeof registerAgencySchema>;

const PLAN_LABELS: Record<string, string> = {
  basic: "Basico — $29/mes",
  pro: "Pro — $79/mes",
};

function RegistroForm() {
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") || "";
  const [success, setSuccess] = useState(false);
  const [successEmail, setSuccessEmail] = useState("");
  const [emailSent, setEmailSent] = useState(true);
  const { executeRecaptcha } = useGoogleReCaptcha();

  const registerMutation = trpc.auth.registerAgency.useMutation({
    onSuccess: (data) => {
      setSuccessEmail(data.email);
      setEmailSent(data.emailSent ?? true);
      setSuccess(true);
    },
  });

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerAgencySchema),
    defaultValues: { honeypot: "" },
  });

  const onSubmit = useCallback(async (data: RegisterForm) => {
    if (!executeRecaptcha) {
      setError("root", { message: "reCAPTCHA no disponible. Recarga la página." });
      return;
    }
    const recaptchaToken = await executeRecaptcha("register");
    registerMutation.mutate({ ...data, recaptchaToken });
  }, [executeRecaptcha, registerMutation, setError]);

  if (success) {
    return (
      <Card className="border-green-200 bg-green-50 dark:bg-green-950/30 w-full max-w-md relative glass-card shadow-soft">
        <CardContent className="pt-6 pb-8 space-y-4">
          {/* Checkmark + title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
              <Check className="w-5 h-5 text-white" />
            </div>
            <h3 className="font-semibold text-green-900 dark:text-green-100 text-lg">
              ¡Agencia creada!
            </h3>
          </div>

          {/* Instructions */}
          <div className="space-y-3 text-sm text-green-900 dark:text-green-100">
            {emailSent ? (
              <>
                <p>Hemos enviado un email de verificación a:</p>
                <p className="font-mono text-xs bg-white dark:bg-black/30 p-2 rounded border border-green-200 dark:border-green-800">
                  {successEmail}
                </p>

                <div className="space-y-2 pt-2">
                  <p className="font-medium">Próximos pasos:</p>
                  <ol className="list-decimal list-inside space-y-1 ml-1">
                    <li>Revisa tu bandeja de entrada</li>
                    <li>Busca el email de verificación (revisa Spam si no lo ves)</li>
                    <li>Haz click en el enlace para verificar tu cuenta</li>
                    <li>Vuelve e inicia sesión</li>
                  </ol>
                </div>

                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded p-3 mt-3">
                  <p className="text-xs text-amber-900 dark:text-amber-100">
                    💡 <strong>Consejo:</strong> Si no recibes el email en 5 minutos, revisa tu carpeta de Spam o contacta soporte.
                  </p>
                </div>
              </>
            ) : (
              <>
                <p>Tu agencia fue creada exitosamente, pero hubo un problema enviando el email de verificación.</p>
                <p className="font-mono text-xs bg-white dark:bg-black/30 p-2 rounded border border-green-200 dark:border-green-800">
                  {successEmail}
                </p>

                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded p-3">
                  <p className="text-xs text-red-900 dark:text-red-100">
                    <strong>Atención:</strong> No pudimos enviar el email de verificación. Por favor contacta a soporte en soporte@isytask.com para completar tu verificación.
                  </p>
                </div>

                <div className="space-y-2 pt-2">
                  <p className="font-medium">Mientras tanto:</p>
                  <ol className="list-decimal list-inside space-y-1 ml-1">
                    <li>Tu agencia está lista para usar</li>
                    <li>Contacta a soporte para verificar tu email</li>
                    <li>Una vez verificado, podrás iniciar sesión</li>
                  </ol>
                </div>
              </>
            )}
          </div>

          {/* Button */}
          <Link href="/login" className="block w-full">
            <Button className="w-full mt-4 gradient-primary text-white font-semibold h-11">
              Ir a iniciar sesión
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md relative glass-card shadow-soft">
      <CardHeader className="text-center space-y-3 pb-2">
        <Link href="/" className="flex justify-center">
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
        </Link>
        <div>
          <h1 className="font-display text-xl font-bold">
            Crea tu agencia gratis
          </h1>
          <CardDescription className="text-sm">
            14 dias de prueba gratuita. Sin tarjeta de credito.
          </CardDescription>
        </div>
        {plan && PLAN_LABELS[plan] && (
          <Badge variant="secondary" className="mx-auto">
            Plan seleccionado: {PLAN_LABELS[plan]}
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Honeypot — invisible para humanos, bots lo llenan */}
          <input
            {...register("honeypot")}
            type="text"
            tabIndex={-1}
            aria-hidden="true"
            autoComplete="off"
            style={{ position: "absolute", left: "-9999px", opacity: 0, height: 0, width: 0 }}
          />

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Nombre de la agencia
            </label>
            <Input
              {...register("agencyName")}
              placeholder="Mi Agencia Creativa"
              className="h-11 rounded-lg"
            />
            {errors.agencyName && (
              <p className="text-xs text-destructive">
                {errors.agencyName.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Tu nombre</label>
            <Input
              {...register("adminName")}
              placeholder="Juan Perez"
              className="h-11 rounded-lg"
            />
            {errors.adminName && (
              <p className="text-xs text-destructive">
                {errors.adminName.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Correo electronico
            </label>
            <Input
              {...register("email")}
              type="email"
              placeholder="tu@email.com"
              className="h-11 rounded-lg"
            />
            {errors.email && (
              <p className="text-xs text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Contrasena</label>
              <Input
                {...register("password")}
                type="password"
                placeholder="Min. 8 caracteres"
                className="h-11 rounded-lg"
              />
              {errors.password && (
                <p className="text-xs text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Confirmar</label>
              <Input
                {...register("confirmPassword")}
                type="password"
                placeholder="Repite tu contrasena"
                className="h-11 rounded-lg"
              />
              {errors.confirmPassword && (
                <p className="text-xs text-destructive">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>
          </div>

          {(registerMutation.error || errors.root) && (
            <p className="text-sm text-destructive text-center">
              {registerMutation.error?.message || errors.root?.message}
            </p>
          )}

          <Button
            type="submit"
            className="w-full h-11 rounded-lg gradient-primary text-white font-semibold shadow-md hover:opacity-90 transition-opacity"
            disabled={registerMutation.isPending}
          >
            {registerMutation.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Crear mi agencia gratis
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Al registrarte aceptas nuestra{" "}
            <Link
              href="/privacidad"
              className="underline hover:text-foreground transition-colors"
            >
              Politica de Privacidad
            </Link>
            .
          </p>
        </form>

        <div className="mt-6 pt-4 border-t text-center">
          <p className="text-sm text-muted-foreground">
            Ya tienes cuenta?{" "}
            <Link
              href="/login"
              className="font-medium text-primary hover:underline"
            >
              Inicia sesion
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function RegistroPage() {
  return (
    <GoogleReCaptchaProvider reCaptchaKey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY!}>
      <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
        {/* Background */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-1/2 -left-1/4 w-[600px] h-[600px] rounded-full bg-[hsl(262,83%,58%)] opacity-[0.04] blur-[100px]" />
          <div className="absolute -bottom-1/2 -right-1/4 w-[600px] h-[600px] rounded-full bg-[hsl(185,80%,50%)] opacity-[0.04] blur-[100px]" />
        </div>

        <Suspense
          fallback={
            <Card className="w-full max-w-md glass-card shadow-soft p-8 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
            </Card>
          }
        >
          <RegistroForm />
        </Suspense>
      </div>
    </GoogleReCaptchaProvider>
  );
}
