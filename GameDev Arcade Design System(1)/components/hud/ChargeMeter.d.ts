import * as React from 'react';

export interface ChargeMeterProps {
  /** Draw power 0–1. @default 0 */
  value?: number;
  /** Visible (fades in while drawing). @default true */
  show?: boolean;
  /** @default 170 */
  width?: number;
  style?: React.CSSProperties;
}

/** Bow draw-power meter (cyan→white). */
export function ChargeMeter(props: ChargeMeterProps): JSX.Element;
