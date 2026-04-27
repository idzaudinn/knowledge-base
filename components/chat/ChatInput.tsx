"use client";

import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Mode = "feed" | "ask";

type Props = {
  mode: Mode;
  onModeChange: (m: Mode) => void;
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
};

export function ChatInput({ mode, onModeChange, value, onChange, onSend, disabled }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">Mode</span>
          <div className="inline-flex rounded-lg border border-slate-700 p-0.5">
            <button
              type="button"
              onClick={() => onModeChange("feed")}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                mode === "feed" ? "bg-emerald-600/90 text-white" : "text-slate-400 hover:text-slate-200"
              )}
            >
              Feed
            </button>
            <button
              type="button"
              onClick={() => onModeChange("ask")}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                mode === "ask" ? "bg-sky-600/90 text-white" : "text-slate-400 hover:text-slate-200"
              )}
            >
              Ask
            </button>
          </div>
        </div>
        <p className="text-[10px] text-slate-500">
          {mode === "feed" ? "Adds knowledge" : "Answers from your base only"}
        </p>
      </div>
      <Textarea
        className="min-h-[80px] resize-y"
        placeholder={
          mode === "feed" ? "Type facts to add to the graph…" : "Ask about what you have stored…"
        }
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onSend();
          }
        }}
      />
      <div className="flex justify-end">
        <Button type="button" onClick={onSend} disabled={disabled || !value.trim()} className="gap-2">
          <Send className="h-4 w-4" />
          Send
        </Button>
      </div>
    </div>
  );
}
