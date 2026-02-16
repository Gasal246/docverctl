"use client";

import { useEffect } from "react";

export interface ContextMenuItem {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

interface CustomContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function CustomContextMenu({ x, y, items, onClose }: CustomContextMenuProps) {
  useEffect(() => {
    const close = () => onClose();
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("click", close);
    window.addEventListener("contextmenu", close);
    window.addEventListener("keydown", onEscape);

    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("contextmenu", close);
      window.removeEventListener("keydown", onEscape);
    };
  }, [onClose]);

  return (
    <div
      className="fixed z-[100] min-w-48 rounded-md border bg-card py-1 shadow-lg"
      style={{ left: x, top: y }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          className="flex w-full items-center px-3 py-1.5 text-left text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          onClick={(event) => {
            event.stopPropagation();
            item.onClick();
            onClose();
          }}
          disabled={item.disabled}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
