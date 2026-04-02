import { useEffect, useRef } from 'react';
import { actionsApi } from '../api/actions';

const POLL_MS = 60_000;

/**
 * Polls action batch state. When a batch finishes after `processing` was true, reloads the page
 * so map/actions data matches the server (no WebSockets).
 */
export function useActionExecutionReload(): void {
  const sawProcessingRef = useRef(false);
  const lastSeqRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      try {
        const s = await actionsApi.getExecutionStatus();
        if (cancelled) return;

        if (s.processing) {
          sawProcessingRef.current = true;
          lastSeqRef.current = s.completedBatchSeq;
          return;
        }

        if (
          sawProcessingRef.current &&
          lastSeqRef.current !== null &&
          s.completedBatchSeq > lastSeqRef.current
        ) {
          window.location.reload();
          return;
        }

        lastSeqRef.current = s.completedBatchSeq;
      } catch {
        /* execution-status is allowlisted; ignore transient errors */
      }
    };

    void tick();
    const id = window.setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);
}
