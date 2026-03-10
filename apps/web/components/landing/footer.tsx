"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const footerLinks = {
  producto: [
    { label: "Funciones", href: "#funciones" },
    { label: "Precios", href: "#precios" },
    { label: "Casos de uso", href: "#casos-de-uso" },
    { label: "Registro", href: "/registro" },
  ],
  legal: [
    { label: "Politica de Privacidad", href: "/privacidad" },
    { label: "Terminos de Servicio", href: "/privacidad" },
  ],
};

export function Footer() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && theme === "dark";

  return (
    <footer className="border-t bg-card/50">
      <div className="container-landing py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12">
          {/* Brand */}
          <div className="md:col-span-2">
            <img
              src={isDark ? "/isytask-logo-white.svg" : "/isytask-logo.svg"}
              alt="Isytask"
              className="h-8 object-contain mb-4"
            />
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
              La plataforma todo-en-uno para agencias que quieren organizar
              tareas, clientes y equipos en un solo lugar.
            </p>
          </div>

          {/* Producto */}
          <div>
            <h4 className="font-display font-bold text-sm mb-4">Producto</h4>
            <ul className="space-y-2.5">
              {footerLinks.producto.map((link) => (
                <li key={link.label}>
                  {link.href.startsWith("#") ? (
                    <a
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-display font-bold text-sm mb-4">Legal</h4>
            <ul className="space-y-2.5">
              {footerLinks.legal.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <h4 className="font-display font-bold text-sm mt-6 mb-3">
              Contacto
            </h4>
            <a
              href="mailto:hola@isytask.com"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              hola@isytask.com
            </a>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Isytask. Todos los derechos
            reservados.
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="/privacidad"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Privacidad
            </Link>
            <Link
              href="/privacidad"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Terminos
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
