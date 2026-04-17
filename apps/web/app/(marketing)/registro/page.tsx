"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function RegistroPage() {
  const [formData, setFormData] = useState({
    agencyName: "",
    adminName: "",
    email: "",
    password: "",
    confirmPassword: "",
    honeypot: "",
  });
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | null>(null);

  const registerMutation = trpc.auth.registerAgency.useMutation({
    onSuccess: (data) => {
      console.log("✓ Registration successful:", data);
      setMessageType("success");
      setMessage(`✓ ¡Agencia creada! Email enviado a: ${data.email}`);
      setFormData({
        agencyName: "",
        adminName: "",
        email: "",
        password: "",
        confirmPassword: "",
        honeypot: "",
      });
    },
    onError: (error) => {
      console.error("✗ Registration error:", error);
      setMessageType("error");
      setMessage(`✗ Error: ${error.message}`);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setMessageType(null);

    console.log("Form submitted with data:", formData);

    try {
      // Use a test reCAPTCHA token for development
      const recaptchaToken = "temp-test-token-for-debugging";

      registerMutation.mutate({
        ...formData,
        recaptchaToken,
      });
    } catch (error) {
      console.error("Catch error:", error);
      setMessageType("error");
      setMessage(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-2">
          <h1 className="text-2xl font-bold mb-2">Crea tu agencia gratis</h1>
          <p className="text-muted-foreground text-sm">14 días de prueba gratuita. Sin tarjeta de crédito.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {message && messageType && (
              <div className={`p-3 rounded text-sm ${messageType === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                {message}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">Nombre de la agencia</label>
              <Input
                type="text"
                placeholder="Mi Agencia"
                value={formData.agencyName}
                onChange={(e) => setFormData({ ...formData, agencyName: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Tu nombre</label>
              <Input
                type="text"
                placeholder="Juan Pérez"
                value={formData.adminName}
                onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Correo electrónico</label>
              <Input
                type="email"
                placeholder="tu@email.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium mb-1">Contraseña</label>
                <Input
                  type="password"
                  placeholder="Min. 8 caracteres"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Confirmar</label>
                <Input
                  type="password"
                  placeholder="Repite tu contraseña"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Honeypot field */}
            <input
              type="text"
              name="honeypot"
              value={formData.honeypot}
              onChange={(e) => setFormData({ ...formData, honeypot: e.target.value })}
              style={{ display: "none" }}
            />

            <Button
              type="submit"
              disabled={registerMutation.isPending}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              {registerMutation.isPending ? "Creando..." : "Crear mi agencia gratis"}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Al registrarte aceptas nuestra{" "}
              <a href="/privacidad" className="underline hover:text-foreground">
                Política de Privacidad
              </a>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
