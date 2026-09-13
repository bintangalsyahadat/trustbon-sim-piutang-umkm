"use client";

import { useEffect, useId, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";

const emptySubscribe = () => () => {};

const primaryButtonClass =
  "px-4 py-2.5 rounded-lg bg-violet-500 hover:bg-violet-600 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-violet-500 text-white font-semibold text-xs shadow-md shadow-violet-500/30 dark:shadow-black/30 transition-all flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1a1625]";

const dangerButtonClass =
  "px-3.5 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold shadow-md shadow-rose-500/30 dark:shadow-black/30 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1a1625]";

const neutralButtonClass =
  "px-3.5 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/10 disabled:opacity-60 disabled:cursor-not-allowed text-xs font-semibold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#1a1625]";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Glass-modal confirmation dialog, portalled to `document.body` after
 * hydration. Actions are caller-owned: confirming never closes the dialog on
 * its own, so the caller decides what happens next.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  actions = [],
  onDismiss,
  dismissible = true,
}) {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const cardRef = useRef(null);
  const buttonRefs = useRef([]);
  const onDismissRef = useRef(onDismiss);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  const loading = actions.some((action) => action.loading);

  let initialFocusIndex = 0;
  for (let index = actions.length - 1; index >= 0; index -= 1) {
    if (actions[index].tone !== "danger") {
      initialFocusIndex = index;
      break;
    }
  }

  useEffect(() => {
    if (!open || !mounted) return;
    const previouslyFocused = document.activeElement;
    const target = buttonRefs.current[initialFocusIndex];
    if (target) target.focus();
    return () => {
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus();
      }
    };
  }, [open, mounted, initialFocusIndex]);

  useEffect(() => {
    if (!open || !mounted) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open, mounted]);

  useEffect(() => {
    if (!open || !mounted) return;
    function onKeyDown(event) {
      if (event.key === "Escape") {
        if (dismissible) {
          event.preventDefault();
          onDismissRef.current?.();
        }
        return;
      }
      if (event.key !== "Tab") return;
      const card = cardRef.current;
      if (!card) return;
      const focusable = card.querySelectorAll(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      const inside = card.contains(active);
      if (event.shiftKey) {
        if (!inside || active === first) {
          event.preventDefault();
          last.focus();
        }
        return;
      }
      if (!inside || active === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, mounted, dismissible]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        if (!dismissible) return;
        onDismissRef.current?.();
      }}
    >
      <div
        ref={cardRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="w-full max-w-md glass-card rounded-2xl border border-white/40 dark:border-white/10 shadow-xl p-5 sm:p-6 animate-fadeIn bg-white/95 dark:bg-[#1a1625]/95"
      >
        <h2
          id={titleId}
          className="text-base font-bold text-gray-900 dark:text-white"
        >
          {title}
        </h2>
        <p
          id={descriptionId}
          className="mt-2 text-sm text-gray-600 dark:text-gray-300 break-words"
        >
          {description}
        </p>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {actions.map((action, index) => {
            const toneClass =
              action.tone === "danger"
                ? dangerButtonClass
                : action.tone === "neutral"
                  ? neutralButtonClass
                  : primaryButtonClass;
            return (
              <button
                key={`${action.label}-${index}`}
                ref={(element) => {
                  buttonRefs.current[index] = element;
                }}
                type="button"
                disabled={loading}
                onClick={action.onClick}
                className={`${toneClass} w-full sm:w-auto flex items-center justify-center gap-2`}
              >
                {action.loading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : null}
                {action.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
