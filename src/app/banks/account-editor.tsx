"use client";

import { useState, useTransition } from "react";
import { setCardholderAction, setNicknameAction } from "./actions";

/**
 * One account on the Banks page: a nickname (saved when the box loses focus
 * or on Enter) and who carries the card (saved on change). Controlled and
 * called directly rather than through <form action>, because React resets a
 * form's fields after its action finishes, which made saved values look as
 * if they had reverted.
 */
export function AccountEditor(props: {
  accountId: string; bankName: string; mask: string | null;
  nickname: string | null; cardholder: string | null; me: string; her: string;
}) {
  const { accountId, bankName, mask, me, her } = props;
  const [nickname, setNickname] = useState(props.nickname ?? "");
  const [savedNickname, setSavedNickname] = useState(props.nickname ?? "");
  const [choice, setChoice] = useState(props.cardholder ?? "");
  const [saving, startSaving] = useTransition();
  const [failed, setFailed] = useState(false);

  function run(action: (fd: FormData) => Promise<void>, fields: Record<string, string>, undo: () => void) {
    setFailed(false);
    startSaving(async () => {
      const fd = new FormData();
      fd.set("id", accountId);
      for (const [k, v] of Object.entries(fields)) fd.set(k, v);
      try {
        await action(fd);
      } catch {
        undo();
        setFailed(true);
      }
    });
  }

  function saveNickname() {
    const next = nickname.trim();
    if (next === savedNickname) return;
    const previous = savedNickname;
    setSavedNickname(next);
    run(setNicknameAction, { nickname: next }, () => { setSavedNickname(previous); setNickname(previous); });
  }

  function saveCardholder(next: string) {
    const previous = choice;
    setChoice(next);
    run(setCardholderAction, { cardholder: next }, () => setChoice(previous));
  }

  return (
    <div className="row acct">
      <span className="m">
        <input className="nick" value={nickname} maxLength={40} placeholder="Name this card" aria-label={`Nickname for ${bankName}`}
          onChange={(e) => setNickname(e.target.value)} onBlur={saveNickname}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
        <span className="meta">{bankName}{mask ? ` ****${mask}` : ""}
          {saving ? " · saving…" : null}{failed ? <span className="form-error"> · not saved</span> : null}</span>
      </span>
      <span className="sel">
        <select value={choice} aria-label="Cardholder" onChange={(e) => saveCardholder(e.target.value)}>
          <option value="">Cardholder?</option>
          <option value="me">{me}</option>
          <option value="her">{her}</option>
          <option value="joint">Joint</option>
        </select>
      </span>
    </div>
  );
}
