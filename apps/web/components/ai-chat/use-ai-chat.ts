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

  // Use refs to avoid stale closures in the async sendMessage callback
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  const formDataRef = useRef<Record<string, any>>({});
  formDataRef.current = formData;

  const onFieldsUpdateRef = useRef(onFieldsUpdate);
  onFieldsUpdateRef.current = onFieldsUpdate;

  const sendMessage = useCallback(
    async (userMessage: string) => {
      if (!userMessage.trim() || isStreaming) return;

      const newUserMsg: ChatMessage = { role: "user", content: userMessage.trim() };

      // Use ref for current messages to avoid stale closure
      const currentMessages = messagesRef.current;
      const updatedMessages = [...currentMessages, newUserMsg];

      // Add user message + empty assistant placeholder
      const assistantMsg: ChatMessage = { role: "assistant", content: "" };
      setMessages([...updatedMessages, assistantMsg]);
      setIsStreaming(true);

      try {
        const controller = new AbortController();
        abortRef.current = controller;

        const response = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serviceId,
            messages: updatedMessages,
            currentFormState: formDataRef.current,
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
        let hadToolCall = false;

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
                  hadToolCall = true;
                  onFieldsUpdateRef.current(data.arguments);
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

        // Deduplicate: if the response text is exactly repeated, trim to one copy
        const trimmed = assistantContent.trim();
        if (trimmed.length > 20) {
          const half = Math.floor(trimmed.length / 2);
          const firstHalf = trimmed.slice(0, half);
          const secondHalf = trimmed.slice(half);
          if (firstHalf === secondHalf) {
            assistantContent = firstHalf;
            setMessages((prev) => {
              const copy = [...prev];
              copy[copy.length - 1] = {
                role: "assistant",
                content: assistantContent,
              };
              return copy;
            });
          }
        }

        // If the AI only called a tool (no text), show a confirmation message
        if (hadToolCall && !assistantContent.trim()) {
          assistantContent = "He actualizado los campos del formulario con la información proporcionada. ¿Hay algo más que necesites ajustar?";
          setMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = {
              role: "assistant",
              content: assistantContent,
            };
            return copy;
          });
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
    // Only depend on serviceId and isStreaming — refs handle the rest
    [serviceId, isStreaming]
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
