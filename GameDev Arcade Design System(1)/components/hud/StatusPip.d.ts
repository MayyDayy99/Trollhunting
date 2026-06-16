import * as React from 'react';

export type StatusId = 'fire' | 'ice' | 'poison' | 'lightning';
export const STATUS: Record<StatusId, { color: string; label: string }>;

export interface StatusPipProps {
  /** @default "fire" */
  status?: StatusId;
  /** Dot diameter px. @default 12 */
  size?: number;
  /** Show the Hungarian status word. @default false */
  label?: boolean;
  style?: React.CSSProperties;
}

/** Pulsing dot marking an enemy's elemental status. */
export function StatusPip(props: StatusPipProps): JSX.Element;
