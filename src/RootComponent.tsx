import React, { ElementType } from "react";
import { HtxComponent } from "./HtxComponent";

export const RootComponent: React.FC<{
  element: HTMLElement;
  component: ElementType;
}> = ({ element, component }) => {
  return (
    <>
      {Array.from(element.children)
        .filter((child) => child instanceof HTMLElement)
        .map((child, i) => (
          <HtxComponent key={i} element={child} component={component} />
        ))}
    </>
  );
};
