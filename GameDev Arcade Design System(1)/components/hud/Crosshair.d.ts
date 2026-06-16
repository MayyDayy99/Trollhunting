import * as React from 'react';

export interface CrosshairProps {
  /** Bow draw 0→1; ticks fly apart as it rises. @default 0 */
  spread?: number;
  /** Equipped element — tints the ticks. @default "base" */
  element?: 'base' | 'fire' | 'ice' | 'poison' | 'lightning';
  /** @default 22 */
  size?: number;
  style?: React.CSSProperties;
}

/** First-person aiming reticle that expands with bow charge. */
export function Crosshair(props: CrosshairProps): JSX.Element;
