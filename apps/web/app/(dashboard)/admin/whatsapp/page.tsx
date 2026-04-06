"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  Phone,
  Users,
  CheckCircle2,
  AlertCircle,
  Link2,
  Plus,
  Search,
  ArrowRight,
  ExternalLink,
} from "lucide-react";

export default function WhatsAppPage() {
  const [search, setSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  const { data: stats } = trpc.whatsapp.stats.useQuery();
  const { data: contactsData, refetch: refetchContacts } =
    trpc.whatsapp.listContacts.useQuery({
      search: search || undefined,
      page: 1,
      perPage: 20,
    });
  const { data: unmatchedData } = trpc.whatsapp.unmatchedMessages.useQuery({
    limit: 5,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">WhatsApp Integration</h1>
          <p className="text-muted-foreground">
            Los mensajes de WhatsApp de tus clientes se convierten
            automáticamente en comentarios de tarea
          </p>
        </div>
        <Button onClick={() => setShowAddForm(!showAddForm)}>
          <Plus className="h-4 w-4 mr-2" />
          Vincular Número
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard
          title="Contactos"
          value={stats?.totalContacts ?? 0}
          subtitle={`${stats?.linkedContacts ?? 0} vinculados`}
          icon={<Users className="h-5 w-5 text-blue-500" />}
        />
        <StatsCard
          title="Mensajes Hoy"
          value={stats?.todayMessages ?? 0}
          subtitle="mensajes recibidos"
          icon={<MessageSquare className="h-5 w-5 text-green-500" />}
        />
        <StatsCard
          title="Tasa de Match"
          value={`${stats?.matchRate ?? 0}%`}
          subtitle={`${stats?.matchedMessages ?? 0} vinculados a tareas`}
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />}
        />
        <StatsCard
          title="Sin Match"
          value={stats?.unmatchedMessages ?? 0}
          subtitle="requieren revisión"
          icon={<AlertCircle className="h-5 w-5 text-amber-500" />}
        />
      </div>

      {/* Add Contact Form */}
      {showAddForm && (
        <AddContactForm
          onClose={() => setShowAddForm(false)}
          onSuccess={() => {
            setShowAddForm(false);
            refetchContacts();
          }}
        />
      )}

      {/* Unmatched Messages */}
      {unmatchedData && unmatchedData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Mensajes sin Vincular
            </CardTitle>
            <CardDescription>
              Estos mensajes no pudieron ser vinculados automáticamente a una
              tarea
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {unmatchedData.map((msg: any) => (
                <div
                  key={msg.id}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-amber-50/50 dark:bg-amber-950/20"
                >
                  <Phone className="h-4 w-4 mt-1 text-amber-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">
                        {msg.contact.displayName ||
                          msg.contact.client?.companyName ||
                          msg.contact.phone}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(msg.createdAt).toLocaleString("es-MX")}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {msg.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contacts List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Contactos WhatsApp</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o teléfono..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!contactsData?.contacts?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Phone className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No hay contactos aún</p>
              <p className="text-sm">
                Los contactos se crearán automáticamente cuando un cliente envíe
                un mensaje, o puedes vincularlos manualmente.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {contactsData.contacts.map((contact: any) => (
                <div
                  key={contact.id}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                    <Phone className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {contact.displayName ||
                          contact.user?.name ||
                          contact.phone}
                      </span>
                      {contact.isVerified && (
                        <Badge
                          variant="outline"
                          className="text-green-600 border-green-200 text-xs"
                        >
                          Verificado
                        </Badge>
                      )}
                      {!contact.isActive && (
                        <Badge variant="secondary" className="text-xs">
                          Inactivo
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span>{contact.phone}</span>
                      {contact.client && (
                        <>
                          <ArrowRight className="h-3 w-3" />
                          <span className="flex items-center gap-1">
                            <Link2 className="h-3 w-3" />
                            {contact.client.companyName || "Cliente"}
                          </span>
                        </>
                      )}
                      <span>
                        {contact._count.messages} mensaje
                        {contact._count.messages !== 1 ? "s" : ""}
                      </span>
                      {contact.lastMessageAt && (
                        <span>
                          Último:{" "}
                          {new Date(contact.lastMessageAt).toLocaleDateString(
                            "es-MX"
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                  {!contact.clientId && (
                    <Badge variant="outline" className="text-amber-600 border-amber-200">
                      Sin vincular
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
          {contactsData && contactsData.total > 20 && (
            <p className="text-xs text-muted-foreground text-center mt-4">
              Mostrando {contactsData.contacts.length} de {contactsData.total}{" "}
              contactos
            </p>
          )}
        </CardContent>
      </Card>

      {/* Setup Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configuración de Twilio</CardTitle>
          <CardDescription>
            Sigue estos pasos para activar la integración de WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                1
              </span>
              <div>
                <p className="font-medium">Configura las credenciales de Twilio</p>
                <p className="text-muted-foreground">
                  En Configuración → Sistema, agrega: <code>twilio_account_sid</code>,{" "}
                  <code>twilio_auth_token</code>, y{" "}
                  <code>twilio_whatsapp_from</code>
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                2
              </span>
              <div>
                <p className="font-medium">Configura el Webhook en Twilio</p>
                <p className="text-muted-foreground">
                  En Twilio Console → WhatsApp → Sandbox (o número de
                  producción), configura el webhook "When a message comes in":
                </p>
                <code className="block mt-1 p-2 rounded bg-muted text-xs">
                  https://isytask-web.vercel.app/api/webhooks/whatsapp
                </code>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                3
              </span>
              <div>
                <p className="font-medium">Vincula los números de tus clientes</p>
                <p className="text-muted-foreground">
                  Asegúrate de que cada cliente tenga su número de teléfono en
                  su perfil, o vincúlalo manualmente aquí.
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                4
              </span>
              <div>
                <p className="font-medium">Activa WhatsApp</p>
                <p className="text-muted-foreground">
                  En Configuración → Sistema, establece{" "}
                  <code>notification_whatsapp_enabled</code> a{" "}
                  <code>true</code>
                </p>
              </div>
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Stats Card Component ───

function StatsCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">{title}</span>
          {icon}
        </div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

// ─── Add Contact Form ───

function AddContactForm({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [phone, setPhone] = useState("+52");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [error, setError] = useState("");

  const { data: clients } = trpc.clients.list.useQuery({
    search: "",
    page: 1,
    pageSize: 100,
  });

  const createContact = trpc.whatsapp.createContact.useMutation({
    onSuccess: () => onSuccess(),
    onError: (err) => setError(err.message),
  });

  const handleSubmit = () => {
    setError("");
    const client = (clients as any)?.clients?.find(
      (c: any) => c.id === selectedClientId
    );
    if (!client) {
      setError("Selecciona un cliente");
      return;
    }

    createContact.mutate({
      phone,
      clientId: client.id,
      userId: client.userId,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Vincular Número de WhatsApp</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="text-sm font-medium mb-1 block">
              Número de Teléfono (E.164)
            </label>
            <Input
              placeholder="+521234567890"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className="text-sm font-medium mb-1 block">Cliente</label>
            <select
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
            >
              <option value="">Selecciona un cliente...</option>
              {(clients as any)?.clients?.map((client: any) => (
                <option key={client.id} value={client.id}>
                  {client.companyName || client.user?.name || client.id}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={handleSubmit} disabled={createContact.isLoading}>
              Vincular
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </div>
        {error && (
          <p className="text-sm text-destructive mt-2">{error}</p>
        )}
      </CardContent>
    </Card>
  );
}
