"use client";

import { Download, Upload } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  activeKnowledgeBaseId: string;
  onImportResult?: (summary: string) => void;
};

export function Header({ className, activeKnowledgeBaseId, onImportResult }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <header
      className={cn(
        "flex items-center justify-between border-b border-slate-800/80 bg-slate-950/60 px-4 py-3",
        className
      )}
    >
      <h1 className="text-lg font-semibold tracking-tight text-slate-100">My Knowledge Base</h1>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <input
          type="file"
          accept="application/json,.json"
          className="hidden"
          ref={fileRef}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            try {
              const text = await f.text();
              const json = JSON.parse(text) as unknown;
              const payload =
                json && typeof json === "object" && !Array.isArray(json)
                  ? (json as Record<string, unknown>)
                  : {};
              const res = await fetch("/api/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...payload, knowledge_base_id: activeKnowledgeBaseId }),
              });
              const j = (await res.json().catch(() => ({}))) as {
                ok?: boolean;
                error?: string;
                message?: string;
              };
              if (!res.ok) throw new Error(j.error || "Import failed");
              if (j.message) {
                toast.success(j.message);
                onImportResult?.(j.message);
              }
            } catch (er) {
              toast.error(er instanceof Error ? er.message : "Invalid file");
            }
          }}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-1.5"
          disabled={!activeKnowledgeBaseId}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          Import
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-1.5"
          disabled={!activeKnowledgeBaseId}
          onClick={async () => {
            const res = await fetch(`/api/export/json?kbId=${encodeURIComponent(activeKnowledgeBaseId)}`);
            if (!res.ok) {
              toast.error("Export failed");
              return;
            }
            const b = await res.blob();
            const a = document.createElement("a");
            a.href = URL.createObjectURL(b);
            a.download = res.headers.get("Content-Disposition")?.split("filename=")[1]?.replace(/"/g, "") || "kb.json";
            a.click();
            URL.revokeObjectURL(a.href);
            toast.success("JSON downloaded");
          }}
        >
          <Download className="h-4 w-4" />
          Export JSON
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-1.5"
          disabled={!activeKnowledgeBaseId}
          onClick={async () => {
            const res = await fetch(`/api/export/md?kbId=${encodeURIComponent(activeKnowledgeBaseId)}`);
            if (!res.ok) {
              toast.error("Export failed");
              return;
            }
            const b = await res.blob();
            const a = document.createElement("a");
            a.href = URL.createObjectURL(b);
            a.download = "knowledge-base.md";
            a.click();
            URL.revokeObjectURL(a.href);
            toast.success("Markdown downloaded");
          }}
        >
          <Download className="h-4 w-4" />
          Export MD
        </Button>
      </div>
    </header>
  );
}
