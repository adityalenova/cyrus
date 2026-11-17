export function calculateStreak(timestamps: (string | number | Date)[]) {
  if (!timestamps || timestamps.length === 0) return { currentStreak: 0, longestStreak: 0, totalActiveDays: 0 };
  const uniqueDays = Array.from(new Set(timestamps.map(t => new Date(t).toISOString().split("T")[0]))).sort();
  return { currentStreak: uniqueDays.length > 0 ? 1 : 0, longestStreak: uniqueDays.length, totalActiveDays: uniqueDays.length };
}
