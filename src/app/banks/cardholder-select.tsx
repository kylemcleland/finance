"use client";

import { useState, useTransition } from "react";
import { setCardholderAction } from "./actions";

/**
 * Saves as soon as the choice changes. Controlled and called directly rather
 * than through <form action>, because React resets a form's fields after its
 * action finishes, which made a saved choice look as if it had reverted.
 */
export function CardholderSelect({ accountId, value, me, her }: { accountId: string; value: string | null; me: string; her: string }) {
  const [choice, setChoice] = useState(value ?? "");
  const [saving, startSaving] = useTransition();
  const [failed, setFailed] = useState(false);

  function save(next: string) {
    const previous = choice;
    setChoice(next);
    setFailed(false);
    startSaving(async () => {
      const fd = new FormData();
      fd.set("id", accountId);
      fd.set("cardholder", next);
      try {
        await setCardholderAction(fd);
      } catch {
        setChoice(previous);
        setFailed(true);
      }
    });
  }

  return (
    <span className="sel">
      <select value={choice} aria-label="Cardholder" onChange={(e) => save(e.target.value)}>
        <option value="">Cardholder?</option>
        <option value="me">{me}</option>
        <option value="her">{her}</option>
        <option value="joint">Joint</option>
      </select>
      {saving ? <span className="meta"> saving…</span> : failed ? <span className="form-error"> not saved</span> : null}
    </span>
  );
}
