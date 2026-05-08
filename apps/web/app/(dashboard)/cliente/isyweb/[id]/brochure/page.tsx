"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import {
  ArrowLeft,
  Sparkles,
  ClipboardList,
  Send,
  CheckCircle2,
  Loader2,
  Bot,
  User as UserIcon,
} from "lucide-react";

type Mode = "AI_ASSISTED" | "MANUAL";

const SITE_TYPE_LABELS: Record<string, string> = {
  LANDING: "Landing page",
  ONE_PAGE: "One page",
  MULTI_PAGE: "Multi-página",
  ECOMMERCE: "E-commerce",
  WEBAPP: "Web app",
  BLOG: "Blog",
  OTHER: "Otro",
};

export default function BrochurePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const router = useRouter();
  const utils = trpc.useUtils();

  const { data: brochure, isLoading } = trpc.isyweb.brochureGet.useQuery({
    projectId,
  });
  const { data: project } = trpc.isyweb.getById.useQuery({ id: projectId });

  const [chosenMode, setChosenMode] = useState<Mode | null>(null);
  const [answer, setAnswer] = useState("");
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [completedJustNow, setCompletedJustNow] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const startMutation = trpc.isyweb.brochureStart.useMutation({
    onSuccess: () => utils.isyweb.brochureGet.invalidate({ projectId }),
  });
  const answerMutation = trpc.isyweb.brochureAnswer.useMutation({
    onSuccess: (res) => {
      utils.isyweb.brochureGet.invalidate({ projectId });
      setAnswer("");
      setAiSummary(res.summary ?? null);
      if (res.done) {
        setCompletedJustNow(true);
        utils.isyweb.getById.invalidate({ id: projectId });
      }
    },
  });
  const setFieldMutation = trpc.isyweb.brochureSetField.useMutation({
    onSuccess: () => utils.isyweb.brochureGet.invalidate({ projectId }),
  });
  const completeMutation = trpc.isyweb.brochureComplete.useMutation({
    onSuccess: () => {
      utils.isyweb.brochureGet.invalidate({ projectId });
      utils.isyweb.getById.invalidate({ id: projectId });
      setCompletedJustNow(true);
    },
  });

  // Scroll chat to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [brochure?.session?.questions?.length, aiSummary]);

  if (isLoading) {
    return (
      <>
        <Topbar title="Brochure" />
        <div className="p-6">Cargando…</div>
      </>
    );
  }

  const session = brochure?.session;
  const fieldDefs = brochure?.fieldDefs ?? [];
  const fields = session?.fields ?? [];
  const fieldsByKey = Object.fromEntries(fields.map((f: any) => [f.key, f]));
  const currentMode: Mode | null = (session?.mode as Mode) ?? chosenMode;
  const isCompleted = session?.status === "completed";

  // Mode picker (no session yet)
  if (!session && !chosenMode) {
    return (
      <>
        <Topbar title="Brochure" />
        <div className="p-6 max-w-3xl mx-auto space-y-6">
          <Button variant="ghost" onClick={() => router.push(`/cliente/isyweb/${projectId}`)}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver al proyecto
          </Button>

          <div>
            <h1 className="text-2xl font-bold">¿Cómo quieres llenar el brochure?</h1>
            <p className="text-muted-foreground mt-2">
              Elige el método con el que te sientas más cómodo.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-blue-500"
              onClick={() => {
                setChosenMode("AI_ASSISTED");
                startMutation.mutate({ projectId, mode: "AI_ASSISTED" });
              }}
            >
              <CardContent className="p-6 text-center">
                <div className="h-14 w-14 mx-auto rounded-full bg-blue-100 flex items-center justify-center mb-4">
                  <Sparkles className="h-7 w-7 text-blue-600" />
                </div>
                <h3 className="font-semibold text-lg mb-1">Con ayuda de IA</h3>
                <p className="text-sm text-muted-foreground">
                  Conversa con un asistente que te hará preguntas simples y completará
                  el brochure por ti.
                </p>
                <Badge className="mt-3 bg-blue-100 text-blue-700">Recomendado</Badge>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-gray-400"
              onClick={() => {
                setChosenMode("MANUAL");
                startMutation.mutate({ projectId, mode: "MANUAL" });
              }}
            >
              <CardContent className="p-6 text-center">
                <div className="h-14 w-14 mx-auto rounded-full bg-gray-100 flex items-center justify-center mb-4">
                  <ClipboardList className="h-7 w-7 text-gray-600" />
                </div>
                <h3 className="font-semibold text-lg mb-1">Llenar manualmente</h3>
                <p className="text-sm text-muted-foreground">
                  Si ya tienes claro lo que quieres, llena un formulario directo con
                  todos los campos.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar title="Brochure del proyecto" />
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => router.push(`/cliente/isyweb/${projectId}`)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Volver al proyecto
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          {/* Main content (chat or form) */}
          <div>
            {currentMode === "AI_ASSISTED" ? (
              <AIChat
                session={session}
                answer={answer}
                setAnswer={setAnswer}
                aiSummary={aiSummary}
                isCompleted={isCompleted}
                completedJustNow={completedJustNow}
                isPending={answerMutation.isPending}
                messagesEndRef={messagesEndRef}
                onSubmit={(questionId: string) => {
                  if (!answer.trim() || !session) return;
                  answerMutation.mutate({
                    sessionId: session.id,
                    questionId,
                    answer: answer.trim(),
                  });
                }}
              />
            ) : (
              <ManualForm
                project={project}
                fieldDefs={fieldDefs}
                fieldsByKey={fieldsByKey}
                isCompleted={isCompleted}
                onChange={(key: string, value: any) =>
                  setFieldMutation.mutate({ projectId, key, value })
                }
                onComplete={() => completeMutation.mutate({ projectId })}
              />
            )}
          </div>

          {/* Right panel: extracted fields */}
          <div className="lg:sticky lg:top-4 self-start">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Información capturada
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 max-h-[70vh] overflow-y-auto">
                {fields.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">
                    Aún no hay datos. Conforme respondas, se irán llenando aquí.
                  </p>
                ) : (
                  fieldDefs
                    .filter((def: any) => fieldsByKey[def.key])
                    .map((def: any) => {
                      const f = fieldsByKey[def.key];
                      const display =
                        def.key === "site_type"
                          ? SITE_TYPE_LABELS[f.value as string] ?? f.value
                          : Array.isArray(f.value)
                          ? (f.value as any[]).join(", ")
                          : typeof f.value === "object"
                          ? JSON.stringify(f.value)
                          : String(f.value);
                      return (
                        <div key={def.key}>
                          <p className="text-xs text-muted-foreground">{def.label}</p>
                          <p className="text-sm font-medium">{display}</p>
                        </div>
                      );
                    })
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

// ── AI CHAT ──

function AIChat({
  session,
  answer,
  setAnswer,
  aiSummary,
  isCompleted,
  completedJustNow,
  isPending,
  messagesEndRef,
  onSubmit,
}: any) {
  if (!session) return null;
  const questions = session.questions ?? [];
  const lastUnanswered = [...questions].reverse().find((q: any) => !q.answer);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-blue-600" />
          Asistente IA
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Messages */}
        <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-2 mb-4">
          {questions.map((q: any) => (
            <div key={q.id} className="space-y-3">
              {/* Bot question */}
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4 text-blue-600" />
                </div>
                <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm flex-1">
                  {q.question}
                </div>
              </div>
              {/* User answer */}
              {q.answer && (
                <div className="flex gap-3 flex-row-reverse">
                  <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                    <UserIcon className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div className="bg-blue-500 text-white rounded-lg px-4 py-3 text-sm flex-1">
                    {q.answer}
                  </div>
                </div>
              )}
            </div>
          ))}
          {aiSummary && (
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="bg-emerald-50 text-emerald-900 rounded-lg px-4 py-2 text-sm flex-1">
                {aiSummary}
              </div>
            </div>
          )}
          {isPending && (
            <div className="flex gap-3 items-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Pensando…
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input or completion banner */}
        {isCompleted || completedJustNow ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
            <p className="font-medium text-emerald-900">¡Brochure completado!</p>
            <p className="text-sm text-emerald-700 mt-1">
              Tu agencia ya tiene toda la información para empezar a desarrollar.
            </p>
          </div>
        ) : lastUnanswered ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit(lastUnanswered.id);
            }}
            className="flex gap-2"
          >
            <Input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Escribe tu respuesta…"
              disabled={isPending}
              autoFocus
            />
            <Button type="submit" disabled={isPending || !answer.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ── MANUAL FORM ──

function ManualForm({
  project,
  fieldDefs,
  fieldsByKey,
  isCompleted,
  onChange,
  onComplete,
}: any) {
  const requiredKeys = fieldDefs.filter((d: any) => d.required).map((d: any) => d.key);
  const allRequiredFilled = requiredKeys.every((k: string) => {
    const v = fieldsByKey[k]?.value;
    return v !== undefined && v !== null && v !== "";
  });

  // Conditional: show ECOMMERCE-only fields only when site_type === ECOMMERCE
  const siteType = fieldsByKey.site_type?.value;
  const visibleDefs = fieldDefs.filter((def: any) => {
    if (!def.dependsOn) return true;
    const [k, v] = Object.entries(def.dependsOn)[0];
    return fieldsByKey[k]?.value === v;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Brochure del sitio</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {visibleDefs.map((def: any) => {
          const current = fieldsByKey[def.key]?.value;
          return (
            <FieldRow
              key={def.key}
              def={def}
              value={current}
              onChange={(v: any) => onChange(def.key, v)}
              disabled={isCompleted}
            />
          );
        })}

        {!isCompleted && (
          <div className="pt-4 border-t">
            <Button
              onClick={onComplete}
              disabled={!allRequiredFilled}
              className="w-full"
            >
              {allRequiredFilled
                ? "Marcar brochure como completado"
                : `Completa los campos requeridos primero`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FieldRow({ def, value, onChange, disabled }: any) {
  return (
    <div>
      <label className="text-sm font-medium block mb-1">
        {def.label}
        {def.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {def.type === "textarea" ? (
        <textarea
          className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder=""
        />
      ) : def.type === "select" ? (
        <select
          className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        >
          <option value="">— elige —</option>
          {def.options?.map((o: string) => (
            <option key={o} value={o}>
              {SITE_TYPE_LABELS[o] ?? o}
            </option>
          ))}
        </select>
      ) : def.type === "color" ? (
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={value ?? "#000000"}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="h-10 w-14 rounded cursor-pointer"
          />
          <Input
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder="#0a8cba"
            className="flex-1"
          />
        </div>
      ) : def.type === "tags" || def.type === "url_list" ? (
        <Input
          value={Array.isArray(value) ? value.join(", ") : value ?? ""}
          onChange={(e) =>
            onChange(
              e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            )
          }
          disabled={disabled}
          placeholder={
            def.type === "tags"
              ? "moderno, minimalista, elegante"
              : "https://ejemplo.com, https://otra.com"
          }
        />
      ) : def.type === "number" ? (
        <Input
          type="number"
          value={value ?? ""}
          onChange={(e) => onChange(parseInt(e.target.value, 10) || null)}
          disabled={disabled}
        />
      ) : def.type === "page_list" ? (
        <Input
          value={Array.isArray(value) ? value.join(", ") : value ?? ""}
          onChange={(e) =>
            onChange(
              e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            )
          }
          disabled={disabled}
          placeholder="Inicio, Servicios, Productos, Contacto"
        />
      ) : (
        <Input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      )}
    </div>
  );
}
