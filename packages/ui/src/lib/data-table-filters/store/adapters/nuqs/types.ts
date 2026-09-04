import type { CreateAdapterOptions } from "../../adapter/types";

/**
 * nuqs-specific adapter options
 */
export interface NuqsAdapterOptions<
  T extends Record<string, unknown>,
> extends CreateAdapterOptions<T> {
  /**
   * Use shallow routing (default: true)
   */
  shallow?: boolean;

  /**
   * History mode: 'push' | 'replace' (default: 'push')
   */
  history?: "push" | "replace";

  /**
   * Scroll to top on change (default: false)
   */
  scroll?: boolean;

  /**
   * Throttle URL updates in milliseconds (default: 50)
   */
  throttleMs?: number;
}
