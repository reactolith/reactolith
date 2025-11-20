import { useState, useCallback } from "react";
import { useMercureEventSource } from "./useMercureEventSource";

/**
 * Subscribe to a Mercure topic and receive live JSON data updates.
 *
 * @template T - The type of data expected from the topic
 * @param topic - The Mercure topic to subscribe to
 * @param initialValue - The initial value before any updates
 * @returns The current value from the topic
 *
 * @example
 * ```tsx
 * // Simple usage with type inference
 * const count = useMercureTopic('/notifications/count', 0);
 *
 * // With explicit type
 * const status = useMercureTopic<'online' | 'offline'>('/status', 'offline');
 *
 * // With complex type
 * interface Stats { visitors: number; sales: number; }
 * const stats = useMercureTopic<Stats>('/stats', { visitors: 0, sales: 0 });
 * ```
 */
export function useMercureTopic<T>(topic: string, initialValue: T): T {
  const [value, setValue] = useState<T>(initialValue);

  const handleMessage = useCallback((data: string) => {
    try {
      const parsed = JSON.parse(data);
      setValue(parsed);
    } catch (error) {
      console.error("Failed to parse Mercure message:", error);
    }
  }, []);

  useMercureEventSource(topic, handleMessage);

  return value;
}
