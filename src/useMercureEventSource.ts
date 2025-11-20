import { useState, useEffect } from "react";
import { useApp } from "./provider/AppProvider";

/**
 * Generic hook for subscribing to a Mercure topic and receiving raw message data.
 * This is a low-level hook that handles EventSource connection management.
 *
 * @param topic - The Mercure topic to subscribe to
 * @param onMessage - Callback when a message is received
 * @param onError - Optional callback when an error occurs
 *
 * @internal This is a low-level hook. Use useMercureTopic or MercureLive instead.
 */
export function useMercureEventSource(
  topic: string,
  onMessage: (data: string) => void,
  onError?: (error: Event) => void,
): void {
  const app = useApp();

  useEffect(() => {
    if (!app.mercureConfig) {
      console.warn(
        `useMercureEventSource: app.mercureConfig is not set. Please configure it before using Mercure features.`,
      );
      return;
    }

    const url = new URL(app.mercureConfig.hubUrl);
    url.searchParams.append("topic", topic);

    const eventSource = new EventSource(url.toString(), {
      withCredentials: app.mercureConfig.withCredentials ?? false,
    });

    eventSource.onmessage = (event) => {
      onMessage(event.data);
    };

    eventSource.onerror = (error) => {
      if (onError) {
        onError(error);
      }
      // EventSource will automatically reconnect
    };

    return () => eventSource.close();
  }, [topic, app, onMessage, onError]);
}
