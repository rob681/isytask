"use client";

import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Receipt, TrendingUp } from "lucide-react";

export default function SuscripcionesPage() {
  return (
    <>
      <Topbar title="Suscripciones" />
      <div className="p-4 md:p-6 space-y-6">
        <div className="text-center py-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-4">
            <CreditCard className="h-5 w-5" />
            <span className="font-medium">Integracion con Stripe</span>
          </div>
          <h2 className="text-2xl font-bold mb-2">Proximamente</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            La gestion de suscripciones y pagos recurrentes estara disponible con la integracion de Stripe.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="opacity-60">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> MRR
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-muted-foreground">$0.00</p>
              <Badge variant="outline" className="mt-2">Requiere Stripe</Badge>
            </CardContent>
          </Card>
          <Card className="opacity-60">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <CreditCard className="h-4 w-4" /> Pagos activos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-muted-foreground">0</p>
              <Badge variant="outline" className="mt-2">Requiere Stripe</Badge>
            </CardContent>
          </Card>
          <Card className="opacity-60">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Receipt className="h-4 w-4" /> Facturas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-muted-foreground">0</p>
              <Badge variant="outline" className="mt-2">Requiere Stripe</Badge>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
