"use client";

import { useState, useEffect } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function PushNotificationToggle() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [loading, setLoading] = useState(false);

  const { data: vapidKey } = trpc.push.getPublicKey.useQuery();
  const { data: pushStatus, refetch: refetchStatus } = trpc.push.getStatus.useQuery();

  const subscribeMutation = trpc.push.subscribe.useMutation({
    onSuccess: () => refetchStatus(),
  });
  const unsubscribeMutation = trpc.push.unsubscribe.useMutation({
    onSuccess: () => refetchStatus(),
  });

  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      setSupported(true);
      setPermission(Notification.permission);
    }
  }, []);

  const handleSubscribe = async () => {
    if (!vapidKey) return;
    setLoading(true);

    try {
      // Register service worker
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        setLoading(false);
        return;
      }

      // Subscribe
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });

      const sub = subscription.toJSON();
      if (sub.endpoint && sub.keys) {
        await subscribeMutation.mutateAsync({
          endpoint: sub.endpoint,
          p256dh: sub.keys.p256dh!,
          auth: sub.keys.auth!,
        });
      }
    } catch (error) {
      console.error("[Push] Subscribe error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await unsubscribeMutation.mutateAsync({
            endpoint: subscription.endpoint,
          });
          await subscription.unsubscribe();
        }
      }
    } catch (error) {
      console.error("[Push] Unsubscribe error:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!supported) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <BellOff className="h-3.5 w-3.5" />
        Tu navegador no soporta notificaciones push
      </div>
    );
  }

  if (permission === "denied") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <BellOff className="h-3.5 w-3.5" />
        Notificaciones bloqueadas. Habilítalas en la configuración del navegador.
      </div>
    );
  }

  if (!vapidKey) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Bell className="h-3.5 w-3.5" />
        Push no configurado por el administrador
      </div>
    );
  }

  const isSubscribed = pushStatus?.subscribed ?? false;

  return (
    <div className="flex items-center gap-3">
      {isSubscribed ? (
        <Button
          variant="outline"
          size="sm"
          onClick={handleUnsubscribe}
          disabled={loading}
          className="gap-2"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <BellOff className="h-3.5 w-3.5" />
          )}
          Desactivar push
        </Button>
      ) : (
        <Button
          size="sm"
          onClick={handleSubscribe}
          disabled={loading}
          className="gap-2"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Bell className="h-3.5 w-3.5" />
          )}
          Activar notificaciones push
        </Button>
      )}
      {isSubscribed && (
        <span className="text-xs text-green-600 flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          Push activado
        </span>
      )}
    </div>
  );
}
