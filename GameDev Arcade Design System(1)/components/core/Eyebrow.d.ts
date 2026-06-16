import * as React from 'react';

export interface EyebrowProps {
  children?: React.ReactNode;
  /** Tint. @default "faint" */
  tone?: 'faint' | 'gold' | 'p1' | 'p2';
  style?: React.CSSProperties;
}

/** Small wide-tracked uppercase kicker above titles. */
export function Eyebrow(props: EyebrowProps): JSX.Element;
