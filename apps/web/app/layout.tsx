import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "Isytask - Gestión de Tareas para Agencias",
    template: "%s | Isytask",
  },
  description: "La plataforma todo-en-uno para agencias que quieren organizar tareas, clientes y equipos en un solo lugar.",
  openGraph: {
    title: "Isytask - Gestión de Tareas para Agencias",
    description: "La plataforma todo-en-uno para agencias que quieren organizar tareas, clientes y equipos en un solo lugar.",
    type: "website",
    url: "https://isytask-web.vercel.app",
    siteName: "Isytask",
  },
  twitter: {
    card: "summary_large_image",
    title: "Isytask - Gestión de Tareas para Agencias",
    description: "La plataforma todo-en-uno para agencias.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.className} ${jakarta.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
