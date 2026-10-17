import { EMPTY_NOTEPAD, parseNotepadState, type NotepadState } from "./notepad-model.ts";

// Identity and policy come from server props, never from these storage records.
export type NotebookOwner = { email: string; isDeveloper: boolean };
export type NotebookStorage = { local: Storage; session: Storage };
export const NOTEBOOK_OWNER_KEY = "apu-site:notebook-owner:v3";
export const OWNED_NOTEBOOK_PREFIX = "apu-site:owned-notebook:v3:";
export function notebookOwnerId(owner: Pick<NotebookOwner, "email">) { return owner.email.trim().toLocaleLowerCase("en-US"); }
export function notebookStorageKey(owner: NotebookOwner) { return OWNED_NOTEBOOK_PREFIX + encodeURIComponent(notebookOwnerId(owner)); }
export function notebookEpochKey(owner: NotebookOwner) { return "apu-site:notebook-epoch:v1:" + encodeURIComponent(notebookOwnerId(owner)); }

export function createNotebookStorage(owner: NotebookOwner, storage: NotebookStorage) {
  const id = notebookOwnerId(owner), key = notebookStorageKey(owner), epochKey = notebookEpochKey(owner);
  const target = owner.isDeveloper ? storage.local : storage.session;
  let closed = !id;
  let epoch: string | null = null;
  try {
    // Same-tab account/role switches must not revive an earlier session copy.
    const previous = storage.session.getItem(NOTEBOOK_OWNER_KEY);
    const binding = JSON.stringify({ owner: id, developer: owner.isDeveloper });
    if (previous !== binding) {
      for (let i = storage.session.length - 1; i >= 0; i--) {
        const oldKey = storage.session.key(i);
        if (oldKey?.startsWith(OWNED_NOTEBOOK_PREFIX)) storage.session.removeItem(oldKey);
      }
      storage.session.setItem(NOTEBOOK_OWNER_KEY, binding);
    }
    epoch = storage.local.getItem(epochKey);
  } catch { /* In-memory use remains available when storage is blocked. */ }
  const current = () => {
    if (closed) return false;
    try { return storage.local.getItem(epochKey) === epoch; }
    catch { return true; }
  };
  return {
    read(): NotepadState {
      if (!current()) return structuredClone(EMPTY_NOTEPAD);
      try {
        const value = JSON.parse(target.getItem(key) ?? "null");
        return value?.owner === id && value?.epoch === epoch
          ? parseNotepadState(value.entries) ?? structuredClone(EMPTY_NOTEPAD) : structuredClone(EMPTY_NOTEPAD);
      } catch { return structuredClone(EMPTY_NOTEPAD); }
    },
    write(entries: NotepadState) {
      if (!current()) return;
      try { target.setItem(key, JSON.stringify({ owner: id, epoch, entries })); }
      catch { /* Keep the in-memory Notebook if storage is unavailable. */ }
    },
    invalidate(logout: boolean) {
      closed = true; // Close before resetting React state or notifying other tabs.
      try { storage.session.removeItem(key); } catch { /* Best effort. */ }
      if (logout) {
        try { storage.local.setItem(epochKey, crypto.randomUUID()); } catch { /* Best effort. */ }
        try { storage.local.removeItem(key); } catch { /* Best effort. */ }
      }
    },
    close() { closed = true; },
  };
}
