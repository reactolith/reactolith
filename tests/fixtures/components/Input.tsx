import React from "react";

export interface InputProps {
  /** Input type */
  type?: "text" | "email" | "password";
  /** Placeholder text */
  placeholder?: string;
  /** Whether the input is required */
  required?: boolean;
  /** Input value */
  value?: string;
}

const Input = (props: InputProps): JSX.Element => {
  return <input {...props} />;
};

export default Input;
