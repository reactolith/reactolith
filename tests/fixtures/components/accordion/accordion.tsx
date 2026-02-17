import React, { ReactNode } from "react";

export interface AccordionProps {
  /** Whether multiple items can be open at once */
  multiple?: boolean;
  /** Accordion content */
  children?: ReactNode;
}

export function Accordion(props: AccordionProps) {
  return <div>{props.children}</div>;
}
