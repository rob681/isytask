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

  // Refs to avoid stale closures in the async sendMessage callback
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  const isStreamingRef = useRef(false); // Use ref for guard — avoids stale closure in useCallback
  isStreamingRef.current = isStreaming;

  const formDataRef = useRef<Record<string, any>>({});
  formDataRef.current = formData;

  const onFieldsUpdateRef = useRef(onFieldsUpdate);
  onFieldsUpdateRef.current = onFieldsUpdate;

  // Prevent double-send (e.g. Enter + button click simultaneously)
  const sendingRef = useRef(false);

  const sendMessage = useCallback(
    async (userMessage: string) => {
      // Guard against stale isStreaming via ref, and against double-submit
      if (!userMessage.trim() || isStreamingRef.current || sendingRef.current) return;

      sendingRef.current = true;

      const newUserMsg: ChatMessage = { role: "user", content: userMessage.trim() };

      // Use ref for current messages to avoid stale closure
      const currentMessages = messagesRef.current;
      const updatedMessages = [...currentMessages, newUserMsg];

      // Add user message + empty assistant placeholder atomically
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
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) return;

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

        // If the AI only called a tool (no text), show a confirmation message
        if (hadToolCall && !assistantContent.trim()) {
          assistantContent =
            "He actualizado los campos del formulario con la información proporcionada. ¿Hay algo más que necesites ajustar?";
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
        sendingRef.current = false;
        abortRef.current = null;
      }
    },
    // serviceId is the only real dependency — all mutable values go through refs
    [serviceId]
  );

  const clearChat = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setMessages([]);
    setIsStreaming(false);
    sendingRef.current = false;
  }, []);

  return { messages, isStreaming, sendMessage, clearChat };
}
