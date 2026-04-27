"use client";

import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import type { MessageType } from "@/lib/types";
import { cn } from "@/lib/utils";

export type UiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  messageType: MessageType;
};

type Props = {
  messages: UiMessage[];
  mode: "feed" | "ask";
  onModeChange: (m: "feed" | "ask") => void;
  input: string;
  onInput: (s: string) => void;
  onSend: () => void;
  busy?: boolean;
  className?: string;
  compact?: boolean;
};

export function ChatPanel({
  messages,
  mode,
  onModeChange,
  input,
  onInput,
  onSend,
  busy,
  className,
  compact,
}: Props) {
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);
  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="mb-1 text-xs text-slate-500">
        {compact ? "Chat" : "Add knowledge or ask questions. Cmd/Ctrl+Enter to send."}
      </div>
      <ScrollArea className={cn("min-h-0 flex-1 pr-1", compact ? "h-[200px]" : "flex-1")}>
        <div className="pr-2 pt-1">
          {messages.map((m) => (
            <ChatMessage
              key={m.id}
              role={m.role}
              content={m.content}
              type={m.messageType}
            />
          ))}
          {busy && <ChatMessage role="assistant" content="" type="system" loading />}
          <div ref={bottom} />
        </div>
      </ScrollArea>
      <div className="mt-2 border-t border-slate-800 pt-2">
        <ChatInput
          mode={mode}
          onModeChange={onModeChange}
          value={input}
          onChange={onInput}
          onSend={onSend}
          disabled={busy}
        />
      </div>
    </div>
  );
}
