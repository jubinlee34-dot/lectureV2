import { useRef } from "react";

type AnyFunction = (this: unknown, ...args: never[]) => unknown;

/**
 * usePersistFn instead of useCallback to reduce cognitive load
 */
export function usePersistFn<T extends AnyFunction>(fn: T): T {
  const fnRef = useRef<T>(fn);
  fnRef.current = fn;

  const persistFn = useRef<T | null>(null);
  if (!persistFn.current) {
    persistFn.current = function (this: ThisParameterType<T>, ...args: Parameters<T>): ReturnType<T> {
      return fnRef.current.apply(this, args) as ReturnType<T>;
    } as T;
  }

  return persistFn.current;
}
