import * as React from 'react';

export interface PlayerCardProps {
  name?: string;
  /** Player's fletching-glow color (dot + HP fill). @default "#36c5ff" */
  color?: string;
  /** 0–100. @default 100 */
  hp?: number;
  /** Mark as the local player. @default false */
  you?: boolean;
  /** Greyed-out downed state. @default false */
  down?: boolean;
  style?: React.CSSProperties;
}

/** One row of the co-op archer list. */
export function PlayerCard(props: PlayerCardProps): JSX.Element;
