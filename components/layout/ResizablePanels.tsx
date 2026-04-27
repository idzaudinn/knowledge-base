"use client";

import { Group, Panel, Separator } from "react-resizable-panels";
import { cn } from "@/lib/utils";
import { GripVertical } from "lucide-react";

type Props = {
  left: React.ReactNode;
  right: React.ReactNode;
  className?: string;
  defaultLeft?: number;
};

export function ResizablePanels({ left, right, className, defaultLeft = 65 }: Props) {
  return (
    <Group
      orientation="horizontal"
      className={cn("h-full w-full", className)}
      defaultLayout={{ left: defaultLeft, right: 100 - defaultLeft }}
    >
      <Panel id="left" defaultSize={defaultLeft} minSize={25} className="min-w-0">
        {left}
      </Panel>
      <Separator className="group flex w-2 items-center justify-center border-x border-slate-800/60 bg-slate-950/40 data-[active]:bg-slate-900">
        <GripVertical className="h-4 w-4 text-slate-600" />
      </Separator>
      <Panel id="right" defaultSize={100 - defaultLeft} minSize={20} className="min-w-0">
        {right}
      </Panel>
    </Group>
  );
}
