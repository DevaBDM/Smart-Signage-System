import { useEffect, useRef, useState } from "react";

/** Build a localStorage key scoped to the signed-in user when userId is provided. */
export function userScopedKey(baseKey, userId) {
  const uid = userId != null && userId !== "" ? String(userId) : "guest";
  return `${baseKey}.${uid}`;
}

export default function usePersistentState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : initialValue;
    } catch {
      return initialValue;
    }
  });

  // Track the key the current `value` belongs to so we never persist one
  // user's in-memory state under another user's (or `guest`) key when the
  // scoped key flips on login/logout.
  const lastKeyRef = useRef(key);

  useEffect(() => {
    // When the scoped key flips (login/logout), reload the new key's stored
    // value INSTEAD of writing. This avoids a same-commit race where the
    // re-sync effect would update `lastKeyRef` and the write effect would
    // then persist the previous user's still-stale `value` onto the new key.
    if (lastKeyRef.current !== key) {
      lastKeyRef.current = key;
      try {
        const stored = localStorage.getItem(key);
        setValue(stored ? JSON.parse(stored) : initialValue);
      } catch {
        setValue(initialValue);
      }
      return;
    }
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore storage quota/private-mode errors; the form should still work.
    }
  }, [key, value, initialValue]);

  const clear = () => {
    localStorage.removeItem(key);
    setValue(initialValue);
  };

  return [value, setValue, clear];
}
