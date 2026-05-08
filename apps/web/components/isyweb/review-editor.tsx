"use client";

/**
 * Isyweb — Review Editor (Phase 3)
 *
 * Renders the iframe of project.devUrl with a floating draggable toolbar
 * and an absolute SVG/HTML overlay for visual annotations (pins, postits,
 * arrows, circles, rectangles, freehand, highlights, text, emojis,
 * priority pins, area captures).
 *
 * The widget.js running inside the iframe is responsible for picking
 * DOM elements (selector + xpath + text snippet) so annotations remain
 * anchored when the dev site is updated.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  MousePointer2,
  MapPin,
  Flag,
  StickyNote,
  Smile,
  Camera,
  ArrowRight as ArrowIcon,
  Circle,
  Square,
  Pencil,
  Highlighter,
  Type,
  Undo2,
  Trash2,
  Send,
  Monitor,
  Tablet,
  Smartphone,
  Loader2,
} from "lucide-react";

type Tool =
  | "select"
  | "pin"
  | "priority"
  | "postit"
  | "emoji"
  | "capture"
  | "arrow"
  | "circle"
  | "rect"
  | "freehand"
  | "highlight"
  | "text";

type Viewport = "DESKTOP" | "TABLET" | "MOBILE";

const COLORS = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6"];
const EMOJIS = ["👍", "❤️", "🔥", "⭐", "😍", "😕", "❓", "⚠️", "✅", "❌", "💡", "🚀"];

const TOOL_BUTTONS: Array<{ tool: Tool; label: string; icon: any; shortcut: string }> = [
  { tool: "select", label: "Seleccionar / Mover", icon: MousePointer2, shortcut: "V" },
  { tool: "pin", label: "Pin con nota", icon: MapPin, shortcut: "P" },
  { tool: "priority", label: "Prioridad P1/P2/P3", icon: Flag, shortcut: "Shift+P" },
  { tool: "postit", label: "Postit", icon: StickyNote, shortcut: "N" },
  { tool: "emoji", label: "Emoji reaction", icon: Smile, shortcut: "E" },
  { tool: "capture", label: "Captura de área", icon: Camera, shortcut: "K" },
  { tool: "arrow", label: "Flecha", icon: ArrowIcon, shortcut: "A" },
  { tool: "circle", label: "Círculo", icon: Circle, shortcut: "C" },
  { tool: "rect", label: "Rectángulo", icon: Square, shortcut: "R" },
  { tool: "freehand", label: "Dibujo libre", icon: Pencil, shortcut: "D" },
  { tool: "highlight", label: "Resaltador", icon: Highlighter, shortcut: "H" },
  { tool: "text", label: "Texto", icon: Type, shortcut: "T" },
];

const VIEWPORT_SIZES: Record<Viewport, { w: number; label: string; icon: any }> = {
  DESKTOP: { w: 1280, label: "Desktop", icon: Monitor },
  TABLET: { w: 768, label: "Tablet", icon: Tablet },
  MOBILE: { w: 390, label: "Móvil", icon: Smartphone },
};

export function ReviewEditor({
  projectId,
  projectName,
  devUrl,
  onBack,
}: {
  projectId: string;
  projectName: string;
  devUrl: string;
  onBack: () => void;
}) {
  const utils = trpc.useUtils();
  const { data: revision } = trpc.isyweb.currentRevision.useQuery({ projectId });
  const { data: annotations = [] } = trpc.isyweb.annotationsList.useQuery(
    { projectId, revisionId: revision?.id },
    { enabled: !!revision }
  );

  const createAnn = trpc.isyweb.annotationCreate.useMutation({
    onSuccess: () => utils.isyweb.annotationsList.invalidate(),
  });
  const updateAnn = trpc.isyweb.annotationUpdate.useMutation({
    onSuccess: () => utils.isyweb.annotationsList.invalidate(),
  });
  const deleteAnn = trpc.isyweb.annotationDelete.useMutation({
    onSuccess: () => utils.isyweb.annotationsList.invalidate(),
  });

  const [tool, setTool] = useState<Tool>("select");
  const [color, setColor] = useState(COLORS[0]);
  const [priorityLevel, setPriorityLevel] = useState<1 | 2 | 3>(1);
  const [emoji, setEmoji] = useState("👍");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [viewport, setViewport] = useState<Viewport>("DESKTOP");
  const [iframeReady, setIframeReady] = useState(false);
  const [iframeUrl, setIframeUrl] = useState(devUrl);

  const overlayRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [drawing, setDrawing] = useState<any | null>(null);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);

  // Toolbar drag
  const [toolbarPos, setToolbarPos] = useState({ x: 16, y: 100 });
  const toolbarDrag = useRef<{ ox: number; oy: number } | null>(null);

  // Listen to messages from the widget inside iframe
  useEffect(() => {
    function onMsg(ev: MessageEvent) {
      const m = ev.data;
      if (!m || m.source !== "isyweb-widget") return;
      if (m.type === "READY") {
        setIframeReady(true);
        setIframeUrl(m.data.url);
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const map: Record<string, Tool> = {
      v: "select",
      p: "pin",
      n: "postit",
      e: "emoji",
      k: "capture",
      a: "arrow",
      c: "circle",
      r: "rect",
      d: "freehand",
      h: "highlight",
      t: "text",
    };
    function onKey(ev: KeyboardEvent) {
      if (
        (ev.target as HTMLElement)?.tagName === "INPUT" ||
        (ev.target as HTMLElement)?.tagName === "TEXTAREA"
      )
        return;
      if (ev.shiftKey && ev.key.toLowerCase() === "p") {
        setTool("priority");
        return;
      }
      const t = map[ev.key.toLowerCase()];
      if (t) setTool(t);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Toolbar drag handlers
  useEffect(() => {
    function onMove(ev: MouseEvent) {
      if (!toolbarDrag.current) return;
      setToolbarPos({
        x: ev.clientX - toolbarDrag.current.ox,
        y: ev.clientY - toolbarDrag.current.oy,
      });
    }
    function onUp() {
      toolbarDrag.current = null;
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  // Get position relative to overlay
  const getPos = (ev: React.MouseEvent | MouseEvent) => {
    const rect = overlayRef.current!.getBoundingClientRect();
    return {
      x: (ev as MouseEvent).clientX - rect.left,
      y: (ev as MouseEvent).clientY - rect.top,
    };
  };

  // Persist a finalized annotation
  const persist = (input: any) => {
    if (!revision) return;
    createAnn.mutate({
      projectId,
      revisionId: revision.id,
      pageUrl: iframeUrl,
      viewport,
      color,
      ...input,
    });
  };

  // Drawing logic
  const onOverlayMouseDown = (ev: React.MouseEvent) => {
    if (tool === "select") return;
    if (ev.target !== overlayRef.current && (ev.target as HTMLElement).dataset?.ann) return;

    const pos = getPos(ev);
    setDrawStart(pos);

    if (tool === "pin") {
      const note = prompt("Nota para este pin (opcional):") ?? "";
      persist({ type: "PIN", x: pos.x, y: pos.y, text: note });
      setDrawStart(null);
    } else if (tool === "priority") {
      persist({ type: "PRIORITY", x: pos.x, y: pos.y, priorityLevel });
      setDrawStart(null);
    } else if (tool === "postit") {
      persist({ type: "POSTIT", x: pos.x, y: pos.y, text: "", width: 180, height: 180 });
      setDrawStart(null);
    } else if (tool === "emoji") {
      persist({ type: "EMOJI", x: pos.x, y: pos.y, emoji });
      setDrawStart(null);
    } else if (tool === "text") {
      const t = prompt("Texto:");
      if (t) persist({ type: "TEXT", x: pos.x, y: pos.y, text: t });
      setDrawStart(null);
    } else if (tool === "freehand") {
      setDrawing({ type: "FREEHAND", points: [pos] });
    } else if (["arrow", "circle", "rect", "highlight", "capture"].includes(tool)) {
      setDrawing({ type: tool.toUpperCase(), x: pos.x, y: pos.y, width: 0, height: 0 });
    }
  };

  const onOverlayMouseMove = (ev: React.MouseEvent) => {
    if (!drawing || !drawStart) return;
    const pos = getPos(ev);
    if (drawing.type === "FREEHAND") {
      setDrawing({ ...drawing, points: [...drawing.points, pos] });
    } else {
      setDrawing({
        ...drawing,
        x: Math.min(drawStart.x, pos.x),
        y: Math.min(drawStart.y, pos.y),
        width: Math.abs(pos.x - drawStart.x),
        height: Math.abs(pos.y - drawStart.y),
        x2: pos.x,
        y2: pos.y,
      });
    }
  };

  const onOverlayMouseUp = () => {
    if (!drawing) return;
    if (drawing.type === "FREEHAND") {
      persist({ type: "FREEHAND", x: drawing.points[0].x, y: drawing.points[0].y, pathData: drawing.points });
    } else if (drawing.type === "ARROW") {
      persist({
        type: "ARROW",
        x: drawStart!.x,
        y: drawStart!.y,
        width: drawing.x2 - drawStart!.x,
        height: drawing.y2 - drawStart!.y,
      });
    } else if (drawing.type === "CAPTURE") {
      const note = prompt("¿Qué quieres anotar sobre esta área?") ?? "";
      if (note) {
        persist({
          type: "CAPTURE",
          x: drawing.x,
          y: drawing.y,
          width: drawing.width,
          height: drawing.height,
          text: note,
        });
      }
    } else {
      persist({
        type: drawing.type,
        x: drawing.x,
        y: drawing.y,
        width: drawing.width,
        height: drawing.height,
      });
    }
    setDrawing(null);
    setDrawStart(null);
  };

  // Drag existing annotation in select mode
  const dragAnn = useRef<{ id: string; ox: number; oy: number } | null>(null);
  useEffect(() => {
    function onMove(ev: MouseEvent) {
      if (!dragAnn.current) return;
      const rect = overlayRef.current!.getBoundingClientRect();
      const x = ev.clientX - rect.left - dragAnn.current.ox;
      const y = ev.clientY - rect.top - dragAnn.current.oy;
      // Optimistic visual update via DOM (no re-render until mouseup)
      const el = document.querySelector(`[data-ann="${dragAnn.current.id}"]`) as HTMLElement | null;
      if (el) {
        el.style.left = x + "px";
        el.style.top = y + "px";
      }
    }
    function onUp(ev: MouseEvent) {
      if (!dragAnn.current) return;
      const rect = overlayRef.current!.getBoundingClientRect();
      const x = ev.clientX - rect.left - dragAnn.current.ox;
      const y = ev.clientY - rect.top - dragAnn.current.oy;
      updateAnn.mutate({ id: dragAnn.current.id, x, y });
      dragAnn.current = null;
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [updateAnn]);

  const startDragAnn = (id: string, ev: React.MouseEvent) => {
    if (tool !== "select") return;
    const target = ev.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    dragAnn.current = {
      id,
      ox: ev.clientX - rect.left,
      oy: ev.clientY - rect.top,
    };
    ev.preventDefault();
  };

  // Last annotation undo
  const handleUndo = () => {
    const last = annotations[annotations.length - 1];
    if (last) deleteAnn.mutate({ id: last.id });
  };

  const handleClear = () => {
    if (!confirm("¿Eliminar TODAS las anotaciones de esta ronda?")) return;
    annotations.forEach((a: any) => deleteAnn.mutate({ id: a.id }));
  };

  const vp = VIEWPORT_SIZES[viewport];

  return (
    <div className="fixed inset-0 bg-gray-100 flex flex-col">
      {/* Top bar */}
      <div className="h-14 bg-white border-b flex items-center justify-between px-4 z-30">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver
          </Button>
          <div>
            <div className="font-semibold text-sm">{projectName}</div>
            <div className="text-xs text-muted-foreground">
              Revisión · {annotations.length} anotaciones
              {!iframeReady && (
                <span className="ml-2 inline-flex items-center gap-1 text-amber-600">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Esperando widget…
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Viewport toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            {(Object.keys(VIEWPORT_SIZES) as Viewport[]).map((v) => {
              const Icon = VIEWPORT_SIZES[v].icon;
              return (
                <button
                  key={v}
                  onClick={() => setViewport(v)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1 ${
                    viewport === v ? "bg-white shadow" : "text-gray-600"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {VIEWPORT_SIZES[v].label}
                </button>
              );
            })}
          </div>
          <Button size="sm">
            <Send className="h-4 w-4 mr-1" />
            Enviar revisión
          </Button>
        </div>
      </div>

      {/* Canvas area */}
      <div className="flex-1 relative overflow-auto">
        <div className="min-h-full flex justify-center items-start p-6">
          <div
            className="relative bg-white shadow-lg rounded-lg transition-all"
            style={{ width: vp.w, maxWidth: "100%" }}
          >
            <iframe
              ref={iframeRef}
              src={devUrl}
              className="w-full rounded-lg"
              style={{ height: "calc(100vh - 120px)", border: "none" }}
              title="Sitio en revisión"
            />

            {/* Annotation overlay */}
            <div
              ref={overlayRef}
              className="absolute inset-0"
              style={{
                pointerEvents: tool === "select" ? "none" : "auto",
                cursor: tool !== "select" ? "crosshair" : "default",
              }}
              onMouseDown={onOverlayMouseDown}
              onMouseMove={onOverlayMouseMove}
              onMouseUp={onOverlayMouseUp}
            >
              {/* SVG layer for shapes */}
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{ overflow: "visible" }}
              >
                <defs>
                  {COLORS.map((c) => (
                    <marker
                      key={c}
                      id={`ah-${c.replace("#", "")}`}
                      markerWidth="10"
                      markerHeight="10"
                      refX="9"
                      refY="3"
                      orient="auto"
                    >
                      <polygon points="0 0, 10 3, 0 6" fill={c} />
                    </marker>
                  ))}
                </defs>

                {/* Persisted SVG annotations */}
                {annotations.map((a: any) => (
                  <SvgAnnotation key={a.id} a={a} />
                ))}

                {/* Drawing preview */}
                {drawing && <DrawingPreview drawing={drawing} drawStart={drawStart} color={color} />}
              </svg>

              {/* DOM annotations (pins, postits, emojis, texts, captures) */}
              {annotations.map((a: any) => (
                <DomAnnotation
                  key={a.id}
                  a={a}
                  selectable={tool === "select"}
                  onMouseDown={(ev) => startDragAnn(a.id, ev)}
                  onUpdateText={(text) => updateAnn.mutate({ id: a.id, text })}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating draggable toolbar */}
      <div
        className="fixed bg-white rounded-2xl shadow-xl z-40"
        style={{ left: toolbarPos.x, top: toolbarPos.y }}
      >
        {/* Drag handle */}
        <div
          className="h-5 flex items-center justify-center cursor-grab active:cursor-grabbing rounded-t-2xl bg-gray-50"
          onMouseDown={(ev) => {
            const rect = (ev.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
            toolbarDrag.current = { ox: ev.clientX - rect.left, oy: ev.clientY - rect.top };
            ev.preventDefault();
          }}
        >
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="w-1 h-1 rounded-full bg-gray-300" />
            ))}
          </div>
        </div>

        <div className="p-1.5 flex flex-col gap-0.5">
          {TOOL_BUTTONS.map(({ tool: t, label, icon: Icon }) => (
            <button
              key={t}
              onClick={() => {
                if (t === "emoji") {
                  setEmojiOpen((o) => !o);
                  if (!emojiOpen) return;
                }
                if (t === "priority" && tool === "priority") {
                  setPriorityLevel(((priorityLevel % 3) + 1) as 1 | 2 | 3);
                  return;
                }
                setTool(t);
                setEmojiOpen(false);
              }}
              className={`relative w-10 h-10 rounded-lg flex items-center justify-center transition ${
                tool === t ? "bg-blue-500 text-white" : "hover:bg-gray-100 text-gray-700"
              }`}
              title={`${label} (${TOOL_BUTTONS.find((b) => b.tool === t)?.shortcut})`}
            >
              <Icon className="h-5 w-5" />
              {t === "priority" && (
                <span
                  className={`absolute top-0.5 right-0.5 text-[9px] font-bold px-1 rounded ${
                    priorityLevel === 1
                      ? "bg-red-500"
                      : priorityLevel === 2
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                  } text-white`}
                >
                  P{priorityLevel}
                </span>
              )}
            </button>
          ))}

          {/* Emoji popover */}
          {emojiOpen && (
            <div className="absolute left-full top-0 ml-2 bg-white rounded-xl shadow-lg p-2 grid grid-cols-4 gap-1">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => {
                    setEmoji(e);
                    setTool("emoji");
                    setEmojiOpen(false);
                  }}
                  className="w-9 h-9 hover:bg-gray-100 rounded-md text-xl"
                >
                  {e}
                </button>
              ))}
            </div>
          )}

          <div className="h-px bg-gray-200 my-1 mx-1" />

          {/* Color picker */}
          <div className="flex flex-col gap-1 items-center py-1">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full border-2 ${
                  color === c ? "border-gray-900" : "border-white"
                }`}
                style={{ background: c, boxShadow: "0 0 0 1px #e5e7eb" }}
              />
            ))}
          </div>

          <div className="h-px bg-gray-200 my-1 mx-1" />

          <button
            onClick={handleUndo}
            className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-gray-100 text-gray-700"
            title="Deshacer"
          >
            <Undo2 className="h-5 w-5" />
          </button>
          <button
            onClick={handleClear}
            className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-gray-100 text-gray-700"
            title="Limpiar todo"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Status bar */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded-full text-xs flex items-center gap-3 shadow-lg z-30">
        <Badge className="bg-blue-500 text-white">{annotations.length}</Badge>
        <span>anotaciones · Ronda {revision?.roundNumber ?? "—"}</span>
        <span className="text-gray-400">
          {tool === "select" ? "Modo Seleccionar — arrastra anotaciones" : `Herramienta: ${tool}`}
        </span>
      </div>
    </div>
  );
}

// ── Sub-components ──

function SvgAnnotation({ a }: { a: any }) {
  if (a.type === "ARROW") {
    return (
      <line
        x1={a.x}
        y1={a.y}
        x2={a.x + (a.width ?? 0)}
        y2={a.y + (a.height ?? 0)}
        stroke={a.color}
        strokeWidth={4}
        strokeLinecap="round"
        markerEnd={`url(#ah-${a.color.replace("#", "")})`}
      />
    );
  }
  if (a.type === "CIRCLE") {
    return (
      <ellipse
        cx={a.x + (a.width ?? 0) / 2}
        cy={a.y + (a.height ?? 0) / 2}
        rx={(a.width ?? 0) / 2}
        ry={(a.height ?? 0) / 2}
        stroke={a.color}
        strokeWidth={3}
        fill="none"
      />
    );
  }
  if (a.type === "RECTANGLE") {
    return (
      <rect
        x={a.x}
        y={a.y}
        width={a.width ?? 0}
        height={a.height ?? 0}
        stroke={a.color}
        strokeWidth={3}
        fill="none"
        rx={6}
      />
    );
  }
  if (a.type === "HIGHLIGHT") {
    return (
      <rect
        x={a.x}
        y={a.y}
        width={a.width ?? 0}
        height={a.height ?? 0}
        fill={a.color}
        opacity={0.3}
        rx={4}
      />
    );
  }
  if (a.type === "FREEHAND" && Array.isArray(a.pathData)) {
    const d = a.pathData
      .map((p: any, i: number) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
      .join(" ");
    return (
      <path
        d={d}
        stroke={a.color}
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  }
  return null;
}

function DrawingPreview({ drawing, drawStart, color }: any) {
  if (!drawing) return null;
  if (drawing.type === "ARROW" && drawStart) {
    return (
      <line
        x1={drawStart.x}
        y1={drawStart.y}
        x2={drawing.x2 ?? drawStart.x}
        y2={drawing.y2 ?? drawStart.y}
        stroke={color}
        strokeWidth={4}
        strokeLinecap="round"
      />
    );
  }
  if (drawing.type === "CIRCLE") {
    return (
      <ellipse
        cx={drawing.x + drawing.width / 2}
        cy={drawing.y + drawing.height / 2}
        rx={drawing.width / 2}
        ry={drawing.height / 2}
        stroke={color}
        strokeWidth={3}
        fill="none"
      />
    );
  }
  if (drawing.type === "RECT" || drawing.type === "RECTANGLE") {
    return (
      <rect
        x={drawing.x}
        y={drawing.y}
        width={drawing.width}
        height={drawing.height}
        stroke={color}
        strokeWidth={3}
        fill="none"
        rx={6}
      />
    );
  }
  if (drawing.type === "HIGHLIGHT") {
    return (
      <rect
        x={drawing.x}
        y={drawing.y}
        width={drawing.width}
        height={drawing.height}
        fill={color}
        opacity={0.3}
      />
    );
  }
  if (drawing.type === "CAPTURE") {
    return (
      <rect
        x={drawing.x}
        y={drawing.y}
        width={drawing.width}
        height={drawing.height}
        stroke={color}
        strokeWidth={3}
        strokeDasharray="6 4"
        fill={color}
        fillOpacity={0.08}
      />
    );
  }
  if (drawing.type === "FREEHAND") {
    const d = drawing.points
      .map((p: any, i: number) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
      .join(" ");
    return (
      <path
        d={d}
        stroke={color}
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  }
  return null;
}

function DomAnnotation({
  a,
  selectable,
  onMouseDown,
  onUpdateText,
}: {
  a: any;
  selectable: boolean;
  onMouseDown: (ev: React.MouseEvent) => void;
  onUpdateText: (text: string) => void;
}) {
  const baseStyle: React.CSSProperties = {
    position: "absolute",
    left: a.x,
    top: a.y,
    pointerEvents: "auto",
    cursor: selectable ? "move" : "default",
  };

  if (a.type === "PIN") {
    return (
      <div
        data-ann={a.id}
        onMouseDown={onMouseDown}
        title={a.text || ""}
        style={{
          ...baseStyle,
          width: 32,
          height: 32,
          background: a.color,
          color: "#fff",
          borderRadius: "50% 50% 50% 0",
          transform: "rotate(-45deg) translate(-16px, -32px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 8px rgba(0,0,0,0.25)",
        }}
      >
        <MapPin className="h-4 w-4" style={{ transform: "rotate(45deg)" }} />
      </div>
    );
  }
  if (a.type === "PRIORITY") {
    const colors = ["#ef4444", "#f59e0b", "#10b981"];
    const c = colors[(a.priorityLevel ?? 1) - 1];
    return (
      <div
        data-ann={a.id}
        onMouseDown={onMouseDown}
        style={{
          ...baseStyle,
          background: c,
          color: "#fff",
          padding: "4px 10px",
          borderRadius: 8,
          transform: "translate(-50%, -32px)",
          fontWeight: 700,
          fontSize: 13,
          border: "2px solid #fff",
          boxShadow: "0 4px 8px rgba(0,0,0,0.25)",
        }}
      >
        P{a.priorityLevel}
      </div>
    );
  }
  if (a.type === "POSTIT") {
    const colorMap: Record<string, string> = {
      "#ef4444": "#fef3c7",
      "#3b82f6": "#dbeafe",
      "#10b981": "#d1fae5",
      "#f59e0b": "#fed7aa",
      "#8b5cf6": "#fce7f3",
    };
    const textMap: Record<string, string> = {
      "#ef4444": "#78350f",
      "#3b82f6": "#1e3a8a",
      "#10b981": "#065f46",
      "#f59e0b": "#7c2d12",
      "#8b5cf6": "#831843",
    };
    return (
      <div
        data-ann={a.id}
        onMouseDown={(ev) => {
          if ((ev.target as HTMLElement).tagName === "TEXTAREA") return;
          onMouseDown(ev);
        }}
        style={{
          ...baseStyle,
          width: a.width ?? 180,
          minHeight: a.height ?? 180,
          background: colorMap[a.color] ?? "#fef3c7",
          color: textMap[a.color] ?? "#78350f",
          padding: 16,
          boxShadow: "0 6px 14px rgba(0,0,0,0.18), 0 1px 3px rgba(0,0,0,0.08)",
          transform: "rotate(-2deg)",
          fontFamily: '"Comic Sans MS", "Marker Felt", cursive',
          fontSize: 14,
          lineHeight: 1.4,
        }}
      >
        <textarea
          defaultValue={a.text ?? ""}
          onBlur={(e) => onUpdateText(e.target.value)}
          placeholder="Escribe tu nota…"
          style={{
            width: "100%",
            minHeight: 130,
            background: "transparent",
            border: "none",
            outline: "none",
            resize: "none",
            font: "inherit",
            color: "inherit",
          }}
        />
      </div>
    );
  }
  if (a.type === "EMOJI") {
    return (
      <div
        data-ann={a.id}
        onMouseDown={onMouseDown}
        style={{
          ...baseStyle,
          fontSize: 32,
          transform: "translate(-50%, -50%)",
          filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.15))",
        }}
      >
        {a.emoji}
      </div>
    );
  }
  if (a.type === "TEXT") {
    return (
      <div
        data-ann={a.id}
        onMouseDown={onMouseDown}
        style={{
          ...baseStyle,
          background: "rgba(255,255,255,0.95)",
          padding: "6px 10px",
          borderRadius: 6,
          border: `2px solid ${a.color}`,
          color: a.color,
          fontWeight: 600,
          fontSize: 14,
          boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
        }}
      >
        {a.text}
      </div>
    );
  }
  if (a.type === "CAPTURE") {
    return (
      <div
        data-ann={a.id}
        onMouseDown={onMouseDown}
        style={{
          ...baseStyle,
          width: a.width ?? 0,
          height: a.height ?? 0,
          border: `3px dashed ${a.color}`,
          background: `${a.color}14`,
          borderRadius: 6,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -8,
            right: -8,
            background: a.color,
            color: "#fff",
            width: 28,
            height: 28,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
          }}
        >
          📸
        </div>
        {a.text && (
          <div
            style={{
              position: "absolute",
              left: "100%",
              top: "50%",
              transform: "translate(8px, -50%)",
              background: "#fff",
              padding: "8px 12px",
              borderRadius: 8,
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              fontSize: 13,
              maxWidth: 200,
              borderLeft: `3px solid ${a.color}`,
            }}
          >
            {a.text}
          </div>
        )}
      </div>
    );
  }
  return null;
}
