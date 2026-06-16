import * as React from 'react';

export interface ButtonProps {
  children?: React.ReactNode;
  /** Visual style. @default "primary" */
  variant?: 'primary' | 'p2' | 'glass' | 'ghost';
  /** @default "md" */
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  style?: React.CSSProperties;
}

/**
 * The arcade call-to-action button (cyan CTA, orange, glass, ghost).
 * @startingPoint section="Core" subtitle="Arcade CTA button" viewport="700x150"
 */
export function Button(props: ButtonProps): JSX.Element;
