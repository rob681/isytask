import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Isytask - Gestión de Tareas",
    template: "%s | Isytask",
  },
  description: "Plataforma de gestión de solicitudes y tareas para agencias. Organiza, asigna y da seguimiento a tus proyectos.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Isytask - Gestión de Tareas",
    description: "Plataforma de gestión de solicitudes y tareas para agencias.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
