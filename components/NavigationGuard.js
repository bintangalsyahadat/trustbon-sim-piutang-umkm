"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const NavigationGuardContext = createContext(null);

const DIALOG_TITLE = "Perubahan belum disimpan";
const DIALOG_DESCRIPTION =
  "Anda punya perubahan pada halaman ini yang belum disimpan. Simpan dulu, atau tinggalkan tanpa menyimpan?";

export function useNavigationGuard() {
  const context = useContext(NavigationGuardContext);
  if (!context) {
    throw new Error(
      "useNavigationGuard must be used within a NavigationGuardProvider"
    );
  }
  return context;
}

/**
 * Tracks whether the current page has unsaved changes and intercepts
 * client-side navigation, F5 / Ctrl+R reloads and browser unloads with a
 * confirmation dialog.
 *
 * The registered `save` handler resolves to one of three outcomes:
 *   - `true`      → the change was saved; clear `dirty`, close the dialog and
 *                   continue to the pending destination.
 *   - `false`     → validation/action error; keep the dialog open, stay dirty.
 *   - `"handled"` → the page has taken over navigation itself (e.g. a sign-out
 *                   redirect); clear `dirty` and close the dialog without
 *                   continuing to the pending destination.
 * A thrown error clears the loading state and leaves the dialog open.
 */
export function NavigationGuardProvider({ children }) {
  const router = useRouter();
  const [dirty, setDirty] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const pendingRef = useRef(null);
  const handlersRef = useRef({});

  const register = useCallback(({ save, discard }) => {
    handlersRef.current = { save, discard };
  }, []);

  const continuePending = useCallback(() => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (!pending) return;
    if (pending.reload) {
      window.location.reload();
      return;
    }
    router.push(pending.href);
  }, [router]);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
  }, []);

  const requestNavigation = useCallback(
    (href) => {
      if (!dirty) {
        router.push(href);
        return;
      }
      pendingRef.current = { href };
      setDialogOpen(true);
    },
    [dirty, router]
  );

  useEffect(() => {
    if (!dirty) return;
    function onKeyDown(event) {
      const isReload =
        event.key === "F5" ||
        ((event.ctrlKey || event.metaKey) &&
          (event.key === "r" || event.key === "R"));
      if (!isReload) return;
      event.preventDefault();
      pendingRef.current = { reload: true };
      setDialogOpen(true);
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(event) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  async function saveAndProceed() {
    const save = handlersRef.current.save;
    setSaving(true);
    try {
      const saved = save ? await save() : true;
      if (saved === "handled") {
        // The page already navigated (e.g. email-change sign-out).
        setDirty(false);
        setDialogOpen(false);
        setSaving(false);
        return;
      }
      if (!saved) {
        setSaving(false);
        return;
      }
      setDirty(false);
      setDialogOpen(false);
      setSaving(false);
      continuePending();
    } catch {
      setSaving(false);
    }
  }

  function discardAndProceed() {
    const discard = handlersRef.current.discard;
    if (discard) discard();
    setDirty(false);
    setDialogOpen(false);
    continuePending();
  }

  const actions = [
    { label: "Tetap di sini", tone: "neutral", onClick: closeDialog },
    {
      label: "Batalkan perubahan",
      tone: "danger",
      onClick: discardAndProceed,
    },
    {
      label: "Simpan",
      tone: "primary",
      loading: saving,
      onClick: saveAndProceed,
    },
  ];

  const value = useMemo(
    () => ({ dirty, setDirty, register, requestNavigation }),
    [dirty, register, requestNavigation]
  );

  return (
    <NavigationGuardContext.Provider value={value}>
      {children}
      <ConfirmDialog
        open={dialogOpen}
        title={DIALOG_TITLE}
        description={DIALOG_DESCRIPTION}
        actions={actions}
        onDismiss={closeDialog}
      />
    </NavigationGuardContext.Provider>
  );
}

/**
 * Convenience hook for page-level forms: syncs the passed `dirty` flag into the
 * guard and registers the save/discard handlers. Handlers are read through
 * refs so re-registration stays stable across renders.
 */
export function useUnsavedChangesGuard({ dirty, save, discard }) {
  const { setDirty, register } = useNavigationGuard();
  const saveRef = useRef(save);
  const discardRef = useRef(discard);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    discardRef.current = discard;
  }, [discard]);

  useEffect(() => {
    register({
      save: () => (saveRef.current ? saveRef.current() : true),
      discard: () => {
        discardRef.current?.();
      },
    });
  }, [register]);

  useEffect(() => {
    setDirty(dirty);
  }, [dirty, setDirty]);

  useEffect(
    () => () => {
      setDirty(false);
    },
    [setDirty]
  );
}
