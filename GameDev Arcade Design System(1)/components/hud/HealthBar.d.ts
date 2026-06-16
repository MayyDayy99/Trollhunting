import * as React from 'react';

export interface HealthBarProps {
  /** 0–100. @default 100 */
  value?: number;
  /** Uppercase label above the bar (e.g. "Életerő"). */
  label?: string;
  /** @default 280 */
  width?: number;
  /** @default 20 */
  height?: number;
  /** Override the orange→amber fill (e.g. a co-op player color). */
  color?: string;
  style?: React.CSSProperties;
}

/** Generic HP bar (player or enemy), orange→amber on a dark track. */
export function HealthBar(props: HealthBarProps): JSX.Element;
