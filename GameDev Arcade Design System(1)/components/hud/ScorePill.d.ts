import * as React from 'react';

export interface ScorePillProps {
  /** @default 0 */
  value?: number | string;
  /** Caption under the number. @default "pont" */
  label?: string;
  /** @default "right" */
  align?: 'left' | 'right' | 'center';
  style?: React.CSSProperties;
}

/** Score readout: big cyan number + uppercase caption. */
export function ScorePill(props: ScorePillProps): JSX.Element;
