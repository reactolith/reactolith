import React, { ReactNode } from "react";

interface BadgeProps {
  color?: string;
  children?: ReactNode;
}

export function Badge({ color, children }: BadgeProps) {
  return <span style={{ color }}>{children}</span>;
}
