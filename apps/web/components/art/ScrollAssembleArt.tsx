"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Wraps a piece of decorative SVG art (docs/DESIGN.md "Motion" #2) and
 * toggles `.gp-assembled` the first time it scrolls into view, which drives
 * the `.gp-fragment` CSS transition in globals.css. Plain
 * `IntersectionObserver`, not a scroll-linked animation library - fires
 * once, then disconnects, so it costs nothing on repeat scrolls.
 *
 * `prefers-reduced-motion` doesn't need special handling here: globals.css's
 * reduced-motion override already forces `.gp-fragment` to its assembled
 * end state regardless of this class.
 */
export function ScrollAssembleArt({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [assembled, setAssembled] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setAssembled(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`${className ?? ""} ${assembled ? "gp-assembled" : ""}`}>
      {children}
    </div>
  );
}
