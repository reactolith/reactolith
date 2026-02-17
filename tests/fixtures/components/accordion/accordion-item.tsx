import React, { ReactNode } from "react";

export interface AccordionItemProps {
  /** The title shown in the accordion header */
  title: string;
  /** Whether the item is initially open */
  defaultOpen?: boolean;
  /** Item content */
  children?: ReactNode;
}

export function AccordionItem(props: AccordionItemProps) {
  return (
    <div>
      <button>{props.title}</button>
      <div>{props.children}</div>
    </div>
  );
}
