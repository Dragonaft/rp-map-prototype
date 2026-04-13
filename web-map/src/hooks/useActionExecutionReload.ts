import { useEffect, useRef } from 'react';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

/**
 * Subscribes to the BE execution-stream SSE endpoint.
 * When a batch finishes after processing was observed, reloads the page so map/actions data is fresh.
 */
export function useActionExecutionReload(): void {
  const sawProcessingRef = useRef(false);

  useEffect(() => {
    const es = new EventSource(`${apiBaseUrl}/actions/execution-stream`);

    es.onmessage = (event: MessageEvent<string>) => {
      try {
        const data: { processing: boolean } = JSON.parse(event.data);
        if (data.processing) {
          sawProcessingRef.current = true;
        } else if (sawProcessingRef.current) {
          window.location.reload();
        }
      } catch {
        /* ignore malformed messages */
      }
    };

    return () => es.close();
  }, []);
}
