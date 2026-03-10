import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";

export const metadata: Metadata = {
  title: "Politica de Privacidad",
  description: "Politica de privacidad de Isytask. Conoce como protegemos tus datos.",
};

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-28 pb-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mb-2">
            Politica de Privacidad
          </h1>
          <p className="text-sm text-muted-foreground mb-10">
            Ultima actualizacion: 9 de marzo de 2026
          </p>

          <div className="prose prose-sm dark:prose-invert max-w-none space-y-8">
            <section>
              <h2 className="font-display text-xl font-bold mb-3">
                1. Informacion que Recopilamos
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                Recopilamos la informacion que nos proporcionas directamente al
                crear tu cuenta y usar nuestros servicios:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>
                  <strong className="text-foreground">Datos de cuenta:</strong>{" "}
                  nombre, correo electronico, nombre de la agencia
                </li>
                <li>
                  <strong className="text-foreground">Datos de uso:</strong>{" "}
                  tareas creadas, comentarios, archivos subidos
                </li>
                <li>
                  <strong className="text-foreground">Datos tecnicos:</strong>{" "}
                  direccion IP, tipo de navegador, dispositivo
                </li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-xl font-bold mb-3">
                2. Como Usamos tu Informacion
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                Utilizamos la informacion recopilada para:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Proporcionar, mantener y mejorar nuestros servicios</li>
                <li>Procesar transacciones y enviar notificaciones relacionadas</li>
                <li>Enviar comunicaciones tecnicas, actualizaciones y alertas de seguridad</li>
                <li>Responder a tus comentarios, preguntas y solicitudes de soporte</li>
                <li>Monitorear y analizar tendencias de uso para mejorar la experiencia</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-xl font-bold mb-3">
                3. Comparticion de Datos
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                No vendemos, alquilamos ni compartimos tu informacion personal
                con terceros con fines comerciales. Solo compartimos datos en los
                siguientes casos:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground mt-3">
                <li>Con tu consentimiento explicito</li>
                <li>Con proveedores de servicios que nos ayudan a operar la plataforma (hosting, email)</li>
                <li>Cuando sea requerido por ley o para proteger nuestros derechos legales</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-xl font-bold mb-3">
                4. Cookies y Tecnologias Similares
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Utilizamos cookies esenciales para el funcionamiento de la
                plataforma (autenticacion, preferencias de tema). No utilizamos
                cookies de seguimiento publicitario ni compartimos datos de
                cookies con terceros.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-bold mb-3">
                5. Seguridad de Datos
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Implementamos medidas de seguridad tecnicas y organizativas para
                proteger tu informacion, incluyendo encriptacion de contrasenas
                (bcrypt), conexiones HTTPS, y controles de acceso basados en
                roles. Sin embargo, ningun metodo de transmision por Internet es
                100% seguro.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-bold mb-3">
                6. Tus Derechos
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                Tienes derecho a:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Acceder a tu informacion personal</li>
                <li>Corregir datos inexactos</li>
                <li>Solicitar la eliminacion de tu cuenta y datos</li>
                <li>Exportar tus datos en un formato portable</li>
                <li>Retirar tu consentimiento en cualquier momento</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-xl font-bold mb-3">
                7. Retencion de Datos
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Conservamos tu informacion mientras tu cuenta este activa o
                mientras sea necesario para proporcionarte servicios. Si
                solicitas la eliminacion de tu cuenta, eliminaremos tus datos
                personales dentro de los 30 dias siguientes, salvo que debamos
                retenerlos por obligaciones legales.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-bold mb-3">
                8. Cambios a esta Politica
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Podemos actualizar esta politica de privacidad periodicamente. Te
                notificaremos de cualquier cambio significativo publicando la
                nueva politica en esta pagina y, cuando sea apropiado, mediante
                notificacion por email.
              </p>
            </section>

            <section>
              <h2 className="font-display text-xl font-bold mb-3">
                9. Contacto
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Si tienes preguntas sobre esta politica de privacidad o sobre el
                tratamiento de tus datos, puedes contactarnos en:{" "}
                <a
                  href="mailto:privacidad@isytask.com"
                  className="text-primary hover:underline"
                >
                  privacidad@isytask.com
                </a>
              </p>
            </section>
          </div>

          <div className="mt-12 pt-6 border-t">
            <Link
              href="/"
              className="text-sm text-primary hover:underline"
            >
              &larr; Volver al inicio
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
