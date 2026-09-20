"use client";
import * as React from "react";
import { Dialog as Primitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
export const Dialog = Primitive.Root;
export const DialogTrigger = Primitive.Trigger;
export const DialogTitle = Primitive.Title;
export const DialogDescription = Primitive.Description;
export function DialogContent({
  className,
  children,
  locked = false,
  ...props
}: React.ComponentProps<typeof Primitive.Content> & { locked?: boolean }) {
  return (
    <Primitive.Portal>
      <Primitive.Overlay className="dialog-overlay" />
      <Primitive.Content
        className={cn("dialog-content", className)}
        onEscapeKeyDown={(e) => {
          if (locked) e.preventDefault();
        }}
        onPointerDownOutside={(e) => {
          if (locked) e.preventDefault();
        }}
        {...props}
      >
        {children}
        <Primitive.Close
          className="dialog-close"
          aria-label="Close"
          disabled={locked}
        >
          <X size={20} />
        </Primitive.Close>
      </Primitive.Content>
    </Primitive.Portal>
  );
}
