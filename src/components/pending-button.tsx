"use client";

import { useFormStatus } from "react-dom";

/**
 * Submit button that shows it is working. Server actions run one at a time,
 * so while a slow one (Sync now) runs, every other button on the page waits;
 * without this the page just looks frozen.
 */
export function PendingButton({ children, pendingText, className = "primary" }: { children: React.ReactNode; pendingText: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? pendingText : children}
    </button>
  );
}
