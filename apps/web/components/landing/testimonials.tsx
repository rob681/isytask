"use client";

import { Star } from "lucide-react";
import { ScrollAnimation } from "./scroll-animation";

const testimonials = [
  {
    quote:
      "Pasamos de usar hojas de calculo a tener todo organizado en un solo lugar. Nuestros clientes ahora pueden ver el estado de sus proyectos sin tener que llamarnos.",
    name: "Carolina Mendez",
    role: "Directora Creativa",
    company: "Estudio Lumina",
    initials: "CM",
    rating: 5,
  },
  {
    quote:
      "Lo que mas me gusta es el portal de clientes. Antes perdiamos tiempo explicando el estado de cada tarea. Ahora el cliente lo ve solo y nos enfocamos en producir.",
    name: "Andres Rios",
    role: "CEO",
    company: "RioMedia Agency",
    initials: "AR",
    rating: 5,
  },
  {
    quote:
      "Los reportes de rentabilidad me abrieron los ojos. Descubri que algunos servicios nos costaban mas de lo que cobramos. Ajustamos precios y mejoramos un 30% nuestro margen.",
    name: "Valentina Torres",
    role: "Gerente de Operaciones",
    company: "Grupo Nexo Digital",
    initials: "VT",
    rating: 5,
  },
];

export function Testimonials() {
  return (
    <section className="section-padding bg-muted/30">
      <div className="container-landing">
        <ScrollAnimation className="text-center mb-16">
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Lo que dicen{" "}
            <span className="gradient-text">nuestros usuarios</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Agencias reales que transformaron su operacion con Isytask.
          </p>
        </ScrollAnimation>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <ScrollAnimation key={testimonial.name} delay={index * 0.1}>
              <div className="glass-card card-hover p-6 md:p-8 h-full flex flex-col">
                {/* Stars */}
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: testimonial.rating }).map((_, i) => (
                    <Star
                      key={i}
                      className="h-4 w-4 fill-amber-400 text-amber-400"
                    />
                  ))}
                </div>

                {/* Quote */}
                <p className="text-sm text-muted-foreground leading-relaxed flex-1 mb-6">
                  &ldquo;{testimonial.quote}&rdquo;
                </p>

                {/* Author */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {testimonial.initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{testimonial.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {testimonial.role}, {testimonial.company}
                    </p>
                  </div>
                </div>
              </div>
            </ScrollAnimation>
          ))}
        </div>
      </div>
    </section>
  );
}
