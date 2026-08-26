"use client";

import { useState } from "react";
import { MAX_HALF, MAX_STARS, formatStars } from "@/lib/rating";

/**
 * Ten stars, each split into two click targets, which is what a 0-10 scale in
 * half-star steps needs: 20 positions. The numeric value sits alongside so the
 * exact rating is never ambiguous.
 */

function Star({ fill, size }: { fill: number; size: number }) {
  // A clip-path would round to whole stars; a gradient stop renders 8.33 honestly.
  const id = `star-${Math.round(fill * 1000)}-${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id={id}>
          <stop offset={`${fill * 100}%`} stopColor="var(--color-accent)" />
          <stop offset={`${fill * 100}%`} stopColor="transparent" />
        </linearGradient>
      </defs>
      <path
        d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.3l-5.8 3.1 1.1-6.5L2.6 9.3l6.5-.9z"
        fill={`url(#${id})`}
        stroke="var(--color-muted)"
        strokeWidth="1"
      />
    </svg>
  );
}

export function StarDisplay({
  half,
  average,
  size = 14,
}: {
  half?: number | null;
  average?: number | null;
  size?: number;
}) {
  // An average is already in stars; a stored rating is in half units.
  const stars = average ?? (half != null ? half / 2 : null);
  if (stars == null) return null;

  return (
    <span className="inline-flex items-center gap-1" title={`${stars} out of ${MAX_STARS}`}>
      <span className="inline-flex">
        {Array.from({ length: MAX_STARS }, (_, index) => (
          <Star key={index} size={size} fill={Math.min(1, Math.max(0, stars - index))} />
        ))}
      </span>
    </span>
  );
}

export function StarInput({
  value,
  onChange,
  threshold,
  size = 18,
  disabled = false,
}: {
  value: number | null;
  onChange: (half: number) => void;
  /** Marks the point where a rating starts publishing to Best of. */
  threshold?: number | null;
  size?: number;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;

  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="inline-flex"
        onMouseLeave={() => setHover(null)}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={MAX_HALF}
        aria-valuenow={value ?? 0}
        aria-label="Rating"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === "ArrowRight") onChange(Math.min(MAX_HALF, (value ?? 0) + 1));
          if (event.key === "ArrowLeft") onChange(Math.max(0, (value ?? 0) - 1));
        }}
      >
        {Array.from({ length: MAX_STARS }, (_, index) => {
          const fullHalf = (index + 1) * 2;
          const halfHalf = fullHalf - 1;
          const isThreshold = threshold != null && threshold === fullHalf;

          return (
            <span
              key={index}
              className={`relative inline-flex ${
                isThreshold ? "border-l border-[var(--color-accent)] pl-px" : ""
              }`}
            >
              <Star size={size} fill={Math.min(1, Math.max(0, shown / 2 - index))} />
              {!disabled && (
                <>
                  <button
                    type="button"
                    aria-label={`${halfHalf / 2} stars`}
                    className="absolute inset-y-0 left-0 w-1/2 cursor-pointer"
                    onMouseEnter={() => setHover(halfHalf)}
                    onClick={() => onChange(halfHalf)}
                  />
                  <button
                    type="button"
                    aria-label={`${fullHalf / 2} stars`}
                    className="absolute inset-y-0 right-0 w-1/2 cursor-pointer"
                    onMouseEnter={() => setHover(fullHalf)}
                    onClick={() => onChange(fullHalf)}
                  />
                </>
              )}
            </span>
          );
        })}
      </span>
      <span className="text-sm tabular-nums text-[var(--color-muted)]">
        {formatStars(shown)} / {MAX_STARS}
      </span>
    </span>
  );
}
