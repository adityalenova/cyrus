"use client";
/* ══ useQueryState.ts — sync state with URL search parameters ════════ */
import { useCallback, useTransition } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

export function useQueryState(key: string, defaultValue = "") {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const value = searchParams.get(key) || defaultValue;

  const setValue = useCallback(
    (newValue: string) => {
      startTransition(() => {
        const params = new URLSearchParams(searchParams.toString());
        if (!newValue || newValue === defaultValue) {
          params.delete(key);
        } else {
          params.set(key, newValue);
        }
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [key, defaultValue, searchParams, router, pathname]
  );

  return [value, setValue] as const;
}
