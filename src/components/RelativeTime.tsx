"use client";
import { useEffect, useState } from "react";
import { formatTimeAgo } from "@/lib/timeAgo";

export default function RelativeTime({ date, className = "" }: { date: Date | string | number; className?: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);
  const d = new Date(date);
  return (
    <time dateTime={d.toISOString()} title={d.toLocaleString()} className={`text-cocoa/70 ${className}`}>
      {formatTimeAgo(date)}
    </time>
  );
}
