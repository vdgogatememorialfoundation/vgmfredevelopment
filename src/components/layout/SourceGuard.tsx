"use client";

import { useEffect } from "react";

function editable(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return Boolean(element.closest?.("input, textarea, select, [contenteditable='true'], [contenteditable='']"));
}

/** Turns off the right-click menu and the view-source / developer-tools shortcuts (text fields keep their menu). */
export function SourceGuard() {
  useEffect(() => {
    const onContextMenu = (event: MouseEvent) => {
      if (!editable(event.target)) event.preventDefault();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const mod = event.ctrlKey || event.metaKey;
      const blocked =
        key === "f12" ||
        (mod && (key === "u" || key === "s")) ||
        (mod && event.shiftKey && (key === "i" || key === "j" || key === "c" || key === "k")) ||
        (event.metaKey && event.altKey && (key === "i" || key === "j" || key === "c" || key === "u"));
      if (blocked) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const onDragStart = (event: DragEvent) => {
      if ((event.target as HTMLElement | null)?.tagName === "IMG") event.preventDefault();
    };
    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("dragstart", onDragStart);
    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("dragstart", onDragStart);
    };
  }, []);
  return null;
}
