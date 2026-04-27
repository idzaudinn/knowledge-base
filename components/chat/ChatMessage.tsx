"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { MessageType } from "@/lib/types";

type Role = "user" | "assistant";

export function ChatMessage({
  role,
  content,
  type,
  loading,
}: {
  role: Role;
  content: string;
  type: MessageType;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="mb-2 flex w-full flex-col items-end">
        <Skeleton className="h-4 w-3/4 max-w-sm" />
        <Skeleton className="mt-1 h-4 w-1/2 max-w-sm" />
      </div>
    );
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("mb-2 flex w-full", role === "user" ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[95%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
          role === "user"
            ? "bg-sky-900/50 text-sky-100"
            : "bg-slate-800/90 text-slate-100"
        )}
      >
        {type === "system" && (
          <span className="text-xs text-slate-500">[system] </span>
        )}
        <span className="whitespace-pre-wrap">{content}</span>
      </div>
    </motion.div>
  );
}
