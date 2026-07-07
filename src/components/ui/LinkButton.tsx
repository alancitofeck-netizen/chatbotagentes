import Link from "next/link";
import type { ComponentProps } from "react";
import { buttonClassName, type ButtonSize, type ButtonVariant } from "./Button";

interface LinkButtonProps extends ComponentProps<typeof Link> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

/** A Link styled exactly like <Button> — for navigation, not form submission. */
export function LinkButton({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
  ...props
}: LinkButtonProps) {
  return <Link className={buttonClassName({ variant, size, fullWidth, className })} {...props} />;
}
