"use client";
/* ══ LazyOrgLogo.tsx — progressive lazy-loading org avatar/logo ══════ */
import { useState } from "react";
import Image from "next/image";

interface LazyOrgLogoProps {
  src: string;
  name: string;
  size?: number;
  className?: string;
}

export default function LazyOrgLogo({
  src,
  name,
  size = 48,
  className = "",
}: LazyOrgLogoProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (hasError || !src) {
    return (
      <div
        className={`flex items-center justify-center bg-line/60 text-cocoa font-bold text-xs rounded-xl ${className}`}
        style={{ width: size, height: size }}
        aria-label={`${name} logo placeholder`}
      >
        {initials}
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-line/30 ${className}`}
      style={{ width: size, height: size }}
    >
      {!isLoaded && (
        <div className="absolute inset-0 animate-pulse bg-line/60" />
      )}
      <Image
        src={src}
        alt={`${name} organization logo`}
        width={size}
        height={size}
        loading="lazy"
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
        className={`object-contain transition-opacity duration-300 ${
          isLoaded ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}
