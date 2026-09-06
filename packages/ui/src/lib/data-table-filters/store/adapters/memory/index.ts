"use client";

import { useCallback, useMemo, useRef } from "react";

import type { InternalStoreAdapter } from "../../adapter/types";
import { getSchemaDefaults } from "../../schema/serialization";
import type { SchemaDefinition, StoreSnapshot } from "../../schema/types";

export function useMemoryAdapter<T extends Record<string, unknown>>(
  schema: SchemaDefinition,
  options?: { id?: string },
): InternalStoreAdapter<T> {
  const defaults = useMemo(() => getSchemaDefaults(schema) as T, [schema]);

  const stateRef = useRef<T>({ ...defaults });
  const versionRef = useRef(0);
  const listenersRef = useRef(new Set<() => void>());
  const pausedRef = useRef(false);
  const pendingRef = useRef<Partial<T> | null>(null);

  // Cached so getServerSnapshot() is referentially stable for useSyncExternalStore
  const serverSnapshotRef = useRef<StoreSnapshot<T>>({
    state: { ...defaults } as T,
    version: 0,
  });

  const notify = useCallback(() => {
    for (const listener of listenersRef.current) {
      listener();
    }
  }, []);

  const adapter = useMemo<InternalStoreAdapter<T>>(() => {
    return {
      subscribe(listener: () => void) {
        listenersRef.current.add(listener);
        return () => {
          listenersRef.current.delete(listener);
        };
      },

      getSnapshot(): StoreSnapshot<T> {
        return {
          state: stateRef.current,
          version: versionRef.current,
        };
      },

      getServerSnapshot(): StoreSnapshot<T> {
        return serverSnapshotRef.current;
      },

      setState(partial: Partial<T>) {
        if (pausedRef.current) {
          pendingRef.current = {
            ...pendingRef.current,
            ...partial,
          } as Partial<T>;
          return;
        }

        stateRef.current = { ...stateRef.current, ...partial };
        versionRef.current++;
        notify();
      },

      setField<K extends keyof T>(key: K, value: T[K]) {
        this.setState({ [key]: value } as unknown as Partial<T>);
      },

      reset(fields?: (keyof T)[]) {
        if (fields) {
          const resetPartial: Partial<T> = {};
          for (const field of fields) {
            resetPartial[field] = defaults[field];
          }
          this.setState(resetPartial);
        } else {
          // Through setState so a reset while paused is queued like any update
          this.setState({ ...defaults });
        }
      },

      pause() {
        pausedRef.current = true;
      },

      resume() {
        pausedRef.current = false;
        if (pendingRef.current) {
          const pending = pendingRef.current;
          pendingRef.current = null;
          this.setState(pending);
        }
      },

      isPaused() {
        return pausedRef.current;
      },

      destroy() {
        listenersRef.current.clear();
      },

      getTableId() {
        return options?.id ?? "memory";
      },

      getSchema() {
        return schema;
      },

      getDefaults() {
        return defaults;
      },
    };
  }, [schema, defaults, notify]);

  return adapter;
}
