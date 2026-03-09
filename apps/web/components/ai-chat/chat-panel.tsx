"use client";

import { useEffect, useRef } from "react";
import { Bot, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";
import { useAIChat } from "./use-ai-chat";

interface ChatPanelProps {
  serviceId: string;
  serviceName: string;
  formData: Record<string, any>;
  onFieldsUpdate: (updates: Record<string, any>) => void;
}

export function ChatPanel({
  serviceId,
  serviceName,
  formData,
  onFieldsUpdate,
}: ChatPanelProps) {
  const { messages, isStreaming, sendMessage, clearChat } = useAIChat({
    serviceId,
    formData,
    onFieldsUpdate,
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] min-h-[500px] rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full gradient-primary flex items-center justify-center">
            <Bot className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold">Asistente IA</p>
            <p className="text-xs text-muted-foreground">{serviceName}</p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearChat} disabled={isStreaming}>
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Limpiar
          </Button>
        )}
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <Bot className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm font-medium mb-1">Asistente de {serviceName}</p>
            <p className="text-xs max-w-xs">
              Escribe un mensaje para comenzar. El asistente te ayudará a completar
              el formulario haciendo preguntas sobre tu proyecto.
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <ChatMessage
              key={idx}
              role={msg.role}
              content={msg.content}
              isStreaming={isStreaming && idx === messages.length - 1 && msg.role === "assistant"}
            />
          ))
        )}
      </div>

      {/* Input */}
      <ChatInput
        onSend={sendMessage}
        disabled={isStreaming}
        placeholder="Describe tu proyecto..."
      />
    </div>
  );
}
