"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Search, ListTodo, UserCircle, Users, X, Hash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import { TASK_STATUS_LABELS, TASK_STATUS_COLORS } from "@isytask/shared";

export function GlobalSearch() {
  const router = useRouter();
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce the query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results, isFetching } = trpc.search.global.useQuery(
    { query: debouncedQuery, limit: 8 },
    { enabled: debouncedQuery.length >= 1, keepPreviousData: true }
  );

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Keyboard shortcut: Ctrl+K or Cmd+K to open search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const navigateTo = useCallback(
    (path: string) => {
      router.push(path);
      setOpen(false);
      setQuery("");
    },
    [router]
  );

  const getTaskHref = (taskId: string) => {
    if (role === "ADMIN") return `/admin/tareas/${taskId}`;
    if (role === "COLABORADOR") return `/equipo/tareas/${taskId}`;
    return `/cliente/tareas/${taskId}`;
  };

  const hasResults =
    results &&
    (results.tasks.length > 0 ||
      results.clients.length > 0 ||
      results.colaboradores.length > 0);

  return (
    <div className="relative" ref={containerRef}>
      {/* Search trigger button */}
      <button
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className="flex items-center gap-2 rounded-lg border bg-background px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent transition-colors"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Buscar...</span>
        <kbd className="hidden md:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      {/* Search dropdown */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/20" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-lg mx-4 rounded-xl border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 border-b px-4 py-3">
              <Search className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar tareas, clientes, colaboradores..."
                className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
                autoFocus
              />
              {query && (
                <button
                  onClick={() => {
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <kbd
                className="hidden sm:inline-flex h-6 items-center rounded border bg-muted px-1.5 text-[11px] font-mono text-muted-foreground cursor-pointer"
                onClick={() => setOpen(false)}
              >
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div className="max-h-80 overflow-y-auto">
              {!debouncedQuery && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Escribe para buscar tareas{role === "ADMIN" ? ", clientes y colaboradores" : ""}
                </div>
              )}

              {debouncedQuery && !hasResults && !isFetching && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No se encontraron resultados para &quot;{debouncedQuery}&quot;
                </div>
              )}

              {/* Tasks */}
              {results && results.tasks.length > 0 && (
                <div className="p-2">
                  <p className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Tareas
                  </p>
                  {results.tasks.map((task) => (
                    <button
                      key={task.id}
                      onClick={() => navigateTo(getTaskHref(task.id))}
                      className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-accent transition-colors"
                    >
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary flex-shrink-0">
                        <Hash className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-muted-foreground">
                            #{task.taskNumber}
                          </span>
                          <span className="text-sm font-medium truncate">
                            {task.title}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {task.client.companyName || task.client.user.name} · {task.service.name}
                        </p>
                      </div>
                      <Badge
                        className={`text-[10px] ${TASK_STATUS_COLORS[task.status]}`}
                        variant="outline"
                      >
                        {TASK_STATUS_LABELS[task.status]}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}

              {/* Clients */}
              {results && results.clients.length > 0 && (
                <div className="p-2 border-t">
                  <p className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Clientes
                  </p>
                  {results.clients.map((client) => (
                    <button
                      key={client.id}
                      onClick={() => navigateTo("/admin/clientes")}
                      className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-accent transition-colors"
                    >
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400 flex-shrink-0">
                        <UserCircle className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {client.companyName || client.userName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {client.email}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Colaboradores */}
              {results && results.colaboradores.length > 0 && (
                <div className="p-2 border-t">
                  <p className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Equipo
                  </p>
                  {results.colaboradores.map((colab) => (
                    <button
                      key={colab.id}
                      onClick={() => navigateTo("/admin/equipo")}
                      className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-accent transition-colors"
                    >
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 flex-shrink-0">
                        <Users className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {colab.userName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {colab.email}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {isFetching && debouncedQuery && (
                <div className="px-4 py-3 text-center text-xs text-muted-foreground">
                  Buscando...
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
