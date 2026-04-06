/**
 * Simple toast hook for Isytask
 * Provides a minimal toast notification interface for components
 */

export function useToast() {
  const toast = (props: {
    title?: string;
    description?: string;
    variant?: "default" | "destructive";
  }) => {
    // In a production app, you'd use a toast library like sonner, react-hot-toast, etc.
    // For now, just log to console in dev and silently succeed in production
    if (process.env.NODE_ENV === "development") {
      console.log("[Toast]", props.title || "", props.description || "");
    }
  };

  return { toast };
}
