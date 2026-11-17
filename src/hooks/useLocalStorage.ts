"use client";
import { useState, useEffect, useCallback } from "react";

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item !== null) setStoredValue(JSON.parse(item));
    } catch {}
  }, [key]);
  const setValue = useCallback((value: T | ((val: T) => T)) => {
    setStoredValue((prev) => {
      const val = value instanceof Function ? value(prev) : value;
      window.localStorage.setItem(key, JSON.stringify(val));
      return val;
    });
  }, [key]);
  return [storedValue, setValue] as const;
}
