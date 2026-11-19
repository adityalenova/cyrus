"use client";
import { useState, type ReactNode } from "react";

export default function FlipCard({ front, back }: { front: ReactNode; back: ReactNode }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div onClick={() => setFlipped(!flipped)} className="cursor-pointer">
      {flipped ? back : front}
    </div>
  );
}
