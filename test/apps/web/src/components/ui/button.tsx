import * as React from "react";

import { cn } from "@/lib/utils";

type ButtonVariant = "default" | "outline" | "ghost";

const variantClassName: Record<ButtonVariant, string> = {
  default: "ui-btn ui-btn-primary",
  outline: "ui-btn ui-btn-outline",
  ghost: "ui-btn ui-btn-ghost",
};

export function buttonClassName(
  variant: ButtonVariant = "default",
  className?: string,
) {
  return cn(variantClassName[variant], className);
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export function Button({
  className,
  variant = "default",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClassName(variant, className)}
      {...props}
    />
  );
}
