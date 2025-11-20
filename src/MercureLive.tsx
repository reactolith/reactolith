import { useState, useEffect, ReactNode } from "react";
import { useApp } from "./provider/AppProvider";
import { HtxComponent } from "./HtxComponent";

/**
 * Component that subscribes to a Mercure topic and renders HTML updates.
 *
 * Use this for partial page updates that should be reflected across all pages,
 * like sidebars, notification areas, or live feeds.
 *
 * @example
 * ```tsx
 * <MercureLive topic="/sidebar">
 *   <sidebar-component>Initial content</sidebar-component>
 * </MercureLive>
 * ```
 *
 * Backend can push updates to this region:
 * ```php
 * $update = new Update('/sidebar', $sidebarHtml);
 * $hub->publish($update);
 * ```
 */
export interface MercureLiveProps {
  /** The Mercure topic to subscribe to */
  topic: string;
  /** Initial content to display before any updates */
  children: ReactNode;
}

export function MercureLive({ topic, children }: MercureLiveProps) {
  const app = useApp();
  const [content, setContent] = useState<ReactNode>(children);

  useEffect(() => {
    if (!app.mercureConfig) {
      console.warn(
        "MercureLive: app.mercureConfig is not set. Please configure it before using MercureLive.",
      );
      return;
    }

    const url = new URL(app.mercureConfig.hubUrl, window.location.origin);
    url.searchParams.append("topic", topic);

    const eventSource = new EventSource(url.toString(), {
      withCredentials: app.mercureConfig.withCredentials,
    });

    eventSource.onmessage = (event) => {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(event.data, "text/html");
        const element = doc.body.firstElementChild as HTMLElement;

        if (element) {
          setContent(
            <HtxComponent element={element} component={app.component} />,
          );
        } else {
          console.warn("MercureLive: No element found in Mercure message");
        }
      } catch (error) {
        console.error("MercureLive: Failed to parse message:", error);
      }
    };

    eventSource.onerror = (error) => {
      console.error("MercureLive: EventSource error:", error);
      // EventSource will automatically reconnect
    };

    return () => eventSource.close();
  }, [topic, app]);

  return <>{content}</>;
}
