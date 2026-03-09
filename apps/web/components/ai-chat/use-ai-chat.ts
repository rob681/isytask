"use client";

import { useState, useCallback, useRef } from "react";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface UseAIChatParams {
  serviceId: string;
  formData: Record<string, any>;
  onFieldsUpdate: (updates: Record<string, any>) => void;
}

export function useAIChat({ serviceId, formData, onFieldsUpdate }: UseAIChatParams) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (userMessage: string) => {
      if (!userMessage.trim() || isStreaming) return;

      const newUserMsg: ChatMessage = { role: "user", content: userMessage.trim() };
      const updatedMessages = [...messages, newUserMsg];
      setMessages(updatedMessages);
      setIsStreaming(true);

      // Add empty assistant message to stream into
      const assistantMsg: ChatMessage = { role: "assistant", content: "" };
      setMessages([...updatedMessages, assistantMsg]);

      try {
        const controller = new AbortController();
        abortRef.current = controller;

        const response = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serviceId,
            messages: updatedMessages,
            currentFormState: formData,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          setMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = {
              role: "assistant",
              content: `Lo siento, hubo un error: ${errorText}`,
            };
            return copy;
          });
          setIsStreaming(false);
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          setIsStreaming(false);
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";
        let assistantContent = "";
        let currentEvent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();

            if (trimmed.startsWith("event: ")) {
              currentEvent = trimmed.slice(7);
              continue;
            }

            if (trimmed.startsWith("data: ")) {
              const dataStr = trimmed.slice(6);
              try {
                const data = JSON.parse(dataStr);

                if (currentEvent === "token" && data.content) {
                  assistantContent += data.content;
                  setMessages((prev) => {
                    const copy = [...prev];
                    copy[copy.length - 1] = {
                      role: "assistant",
                      content: assistantContent,
                    };
                    return copy;
                  });
                }

                if (currentEvent === "tool_call" && data.arguments) {
                  onFieldsUpdate(data.arguments);
                }

                if (currentEvent === "error" && data.message) {
                  assistantContent += `\n\n_Error: ${data.message}_`;
                  setMessages((prev) => {
                    const copy = [...prev];
                    copy[copy.length - 1] = {
                      role: "assistant",
                      content: assistantContent,
                    };
                    return copy;
                  });
                }
              } catch {
                // Skip malformed JSON
              }
              currentEvent = "";
            }
          }
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = {
              role: "assistant",
              content: "Lo siento, hubo un error de conexión. Intenta de nuevo.",
            };
            return copy;
          });
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [serviceId, formData, messages, isStreaming, onFieldsUpdate]
  );

  const clearChat = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setMessages([]);
    setIsStreaming(false);
  }, []);

  return { messages, isStreaming, sendMessage, clearChat };
}
