"use client";

import { forwardRef } from "react";
import Graph from "react-force-graph-3d";
import type { ForceGraphProps, LinkObject, NodeObject } from "react-force-graph-3d";

export const ForceGraph3DClient = forwardRef<unknown, ForceGraphProps<NodeObject, LinkObject>>(
  function ForceGraph3DClient(props, ref) {
    return <Graph ref={ref as never} {...props} />;
  }
);
ForceGraph3DClient.displayName = "ForceGraph3DClient";
