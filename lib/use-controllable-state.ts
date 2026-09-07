"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Local replacement for `@radix-ui/react-use-controllable-state`, kept on the
 * same `{ prop, defaultProp, onChange }` API so the two ai-elements components
 * that used it read unchanged. Base UI has no public equivalent to migrate to,
 * and this was the last thing holding a Radix package in the dependency list.
 *
 * A component is controlled while `prop` is not `undefined`: the caller owns the
 * value and only hears about intents through `onChange`. Otherwise the value
 * lives here and `onChange` fires as a notification.
 */
export function useControllableState<T>({
  prop,
  defaultProp,
  onChange,
}: {
  prop?: T | undefined;
  defaultProp: T;
  onChange?: ((value: T) => void) | undefined;
}): [T, (next: T | ((previous: T) => T)) => void] {
  const [uncontrolled, setUncontrolled] = useState<T>(defaultProp);
  const isControlled = prop !== undefined;
  const value = isControlled ? prop : uncontrolled;

  // Read through refs so the returned setter is stable across renders: it ends
  // up in `useMemo` context values, and a fresh identity every render would
  // re-render every consumer of those contexts.
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const isControlledRef = useRef(isControlled);
  isControlledRef.current = isControlled;

  const setValue = useCallback((next: T | ((previous: T) => T)) => {
    const resolved =
      typeof next === "function" ? (next as (previous: T) => T)(valueRef.current) : next;

    if (Object.is(resolved, valueRef.current)) return;

    if (!isControlledRef.current) {
      setUncontrolled(resolved);
    }
    onChangeRef.current?.(resolved);
  }, []);

  return [value, setValue];
}
