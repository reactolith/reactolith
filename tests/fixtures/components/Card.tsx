import React, { ReactNode } from "react";

export interface CardProps {
  /** The title of the card */
  title: string;
  /** Card content */
  children?: ReactNode;
  /** Optional header slot */
  header?: ReactNode;
  /** Optional footer slot */
  footer?: ReactNode;
}

export const Card = (props: CardProps) => {
  return (
    <div>
      {props.header}
      <h2>{props.title}</h2>
      {props.children}
      {props.footer}
    </div>
  );
};
