import * as React from 'react';

export interface BadgeProps {
  children?: React.ReactNode;
  /** @default "neutral" */
  tone?: 'neutral' | 'danger' | 'warn' | 'success' | 'fire' | 'ice' | 'poison' | 'lightning';
  style?: React.CSSProperties;
}

/** Small status pill / label, incl. the four elemental status tones. */
export function Badge(props: BadgeProps): JSX.Element;
