"use client";

import { Suspense, useState } from "react";
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
import { Loader2, CheckCircle2 } from "lucide-react";

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

  const registerMutation = trpc.auth.registerAgency.useMutation({
    onSuccess: (data) => {
      setSuccessEmail(data.email);
      setSuccess(true);
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerAgencySchema),
  });

  const onSubmit = (data: RegisterForm) => {
    registerMutation.mutate(data);
  };

  if (success) {
    return (
      <Card className="w-full max-w-md relative glass-card shadow-soft text-center">
        <CardContent className="pt-8 pb-8 space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full gradient-primary flex items-center justify-center mb-2">
            <CheckCircle2 className="h-8 w-8 text-white" />
          </div>
          <h1 className="font-display text-2xl font-bold">
            Tu agencia esta lista!
          </h1>
          <p className="text-muted-foreground text-sm">
            Hemos enviado un email de bienvenida a{" "}
            <span className="font-medium text-foreground">{successEmail}</span>.
            Ya puedes iniciar sesion.
          </p>
          <Link href="/login">
            <Button className="w-full gradient-primary text-white font-semibold h-11 mt-4">
              Iniciar sesion
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
            className="h-10 object-contain"
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

          {registerMutation.error && (
            <p className="text-sm text-destructive text-center">
              {registerMutation.error.message}
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
  );
}
