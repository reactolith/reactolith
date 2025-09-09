import React, { ElementType, JSX, ReactNode } from "react";

const toPascalCase = (str: string) => {
  return str.replace(/(^\w|-\w)/g, (match) =>
    match.replace(/-/, "").toUpperCase(),
  );
};

const normalizePropName = (name: string) => {
  if (name.startsWith("json-")) {
    name = name.substring(5);
  }
  name = toPascalCase(name);
  return name.substring(0, 1).toLowerCase() + name.substring(1);
};

function getKey(element: HTMLElement): string | undefined {
  return element.attributes.getNamedItem("key")?.value;
}

function getProps(
  element: HTMLElement,
  component: ElementType,
): { [key: string]: unknown } {
  const props: { [key: string]: unknown } = {};
  Array.from(element.attributes).forEach((attr) => {
    if (attr.name !== "key" && !attr.name.startsWith("#")) {
      let value: ReactNode = attr.value;
      if (
        typeof value === "string" &&
        attr.value.startsWith("{") &&
        attr.value.endsWith("}")
      ) {
        value = React.createElement(component, {
          is: value.substring(1, value.length - 1),
        });
      }

      if (attr.name.startsWith("json-")) {
        props[normalizePropName(attr.name)] = JSON.parse(attr.value);
      } else {
        // Special case: Empty value will be transformed to bool true value
        if (typeof value === "string" && value.length === 0) {
          value = true;
        }

        props[
          attr.name === "class" ? "className" : normalizePropName(attr.name)
        ] = value;
      }
    }
  });
  return props;
}

function getSlots(
  element: HTMLElement,
  component: ElementType,
): Record<string, React.ReactNode[]> {
  const slots: Record<string, ReactNode[]> = {};
  Array.from(element.childNodes).forEach((child) => {
    if (child instanceof HTMLElement) {
      Array.from(child.attributes).forEach((attr) => {
        if (attr.name === "slot") {
          slots[attr.value] = getChildren(
            child instanceof HTMLTemplateElement ? child.content : child,
            component,
          );
        }
      });
    }
  });
  return slots;
}

function getChildren(
  element: HTMLElement | DocumentFragment,
  component: ElementType,
): ReactNode[] {
  return Array.from(element.childNodes)
    .map((child, index) => {
      if (child instanceof HTMLElement && child.hasAttribute("slot")) {
        return null;
      }

      if (child instanceof Text) {
        return child.textContent;
      } else if (child instanceof Element) {
        const key = child.hasAttribute("key")
          ? child.getAttribute("key")
          : index;
        return (
          <HtxComponent
            key={key}
            element={child as HTMLElement}
            component={component}
          />
        );
      }
      return null;
    })
    .filter(Boolean);
}

type HtxProps<T extends HTMLElement = HTMLElement> = React.HTMLAttributes<T> & {
  element?: HTMLElement;
  component: React.ElementType;
};

export const HtxComponent = React.forwardRef<HTMLElement, HtxProps>(
  ({ element, component: Component, ...props }, forwardedRef) => {
    if (!element) return null;

    const tagName = element.tagName.toLowerCase();
    const children = getChildren(element, Component);

    const isReactComponent =
      tagName.includes("-") ||
      document.createElement(tagName).constructor === HTMLUnknownElement;

    const type: React.ElementType = isReactComponent
      ? Component
      : (tagName as keyof JSX.IntrinsicElements);

    const allProps = {
      ...getProps(element, Component),
      ...getSlots(element, Component),
      key: getKey(element),
      ...(isReactComponent ? { is: tagName } : {}),
      ...props,
      ref: forwardedRef,
    };

    return React.createElement(type, allProps, ...children);
  },
);

HtxComponent.displayName = "HtxComponent";
