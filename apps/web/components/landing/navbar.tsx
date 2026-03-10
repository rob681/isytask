"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Menu, X, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navLinks = [
  { label: "Funciones", href: "#funciones" },
  { label: "Casos de uso", href: "#casos-de-uso" },
  { label: "Precios", href: "#precios" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isDark = theme === "dark";

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-background/80 backdrop-blur-lg border-b shadow-sm"
          : "bg-transparent"
      )}
    >
      <div className="container-landing">
        <nav className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link href="/" className="flex-shrink-0">
            {mounted ? (
              <img
                src={isDark ? "/isytask-logo-white.svg" : "/isytask-logo.svg"}
                alt="Isytask"
                className="h-8 md:h-9 object-contain"
              />
            ) : (
              <img
                src="/isytask-logo.svg"
                alt="Isytask"
                className="h-8 md:h-9 object-contain"
              />
            )}
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-3">
            {mounted && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(isDark ? "light" : "dark")}
                className="rounded-full"
              >
                {isDark ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </Button>
            )}
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Iniciar sesion
              </Button>
            </Link>
            <Link href="/registro">
              <Button
                size="sm"
                className="gradient-primary text-white font-semibold shadow-md hover:opacity-90 transition-opacity"
              >
                Prueba gratis
              </Button>
            </Link>
          </div>

          {/* Mobile hamburger */}
          <div className="flex md:hidden items-center gap-2">
            {mounted && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(isDark ? "light" : "dark")}
                className="rounded-full h-9 w-9"
              >
                {isDark ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="h-9 w-9"
            >
              {mobileOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </nav>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden pb-4 border-t pt-4 space-y-3 animate-in">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="block text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-2"
              >
                {link.label}
              </a>
            ))}
            <div className="flex flex-col gap-2 pt-2">
              <Link href="/login" onClick={() => setMobileOpen(false)}>
                <Button variant="outline" className="w-full">
                  Iniciar sesion
                </Button>
              </Link>
              <Link href="/registro" onClick={() => setMobileOpen(false)}>
                <Button className="w-full gradient-primary text-white font-semibold">
                  Prueba gratis
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
