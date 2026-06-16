import * as React from 'react';

export interface WaveBannerProps {
  /** @default 1 */
  wave?: number;
  /** Trolls remaining this wave. @default 0 */
  trollsLeft?: number;
  style?: React.CSSProperties;
}

/** Top-center wave readout: amber "HULLÁM N" + troll count. */
export function WaveBanner(props: WaveBannerProps): JSX.Element;
