import React from "react";

export interface ButtonProps {
  /** The variant of the button */
  variant?: "primary" | "secondary" | "danger";
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Size of the button */
  size?: "small" | "medium" | "large";
  /** Click handler */
  onClick?: () => void;
}

export function Button(props: ButtonProps) {
  return <button {...props}>Button</button>;
}
