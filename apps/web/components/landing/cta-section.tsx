"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollAnimation } from "./scroll-animation";

export function CtaSection() {
  return (
    <section className="py-20 md:py-28">
      <div className="container-landing">
        <ScrollAnimation>
          <div className="relative overflow-hidden rounded-3xl gradient-primary p-8 md:p-16 text-center">
            {/* Decorative circles */}
            <div className="absolute top-0 left-0 w-64 h-64 rounded-full bg-white/10 -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-white/5 translate-x-1/3 translate-y-1/3" />

            <div className="relative z-10">
              <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight mb-4">
                Listo para organizar tu agencia?
              </h2>
              <p className="text-lg text-white/80 max-w-xl mx-auto mb-8">
                Empieza tu prueba gratuita de 14 dias hoy. Sin tarjeta de
                credito, sin compromisos.
              </p>
              <Link href="/registro">
                <Button
                  size="lg"
                  className="bg-white text-foreground font-semibold shadow-lg hover:bg-white/90 transition-colors h-12 px-8 text-base"
                >
                  Crear mi cuenta gratis
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </ScrollAnimation>
      </div>
    </section>
  );
}
