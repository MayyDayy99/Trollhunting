import * as React from 'react';

export interface GlassPanelProps {
  children?: React.ReactNode;
  /** Surface weight. @default "panel" */
  tone?: 'panel' | 'raised' | 'scrim';
  /** @default "xl" */
  radius?: 'md' | 'lg' | 'xl' | 'pill';
  /** CSS padding (number = px). @default 24 */
  padding?: number | string;
  style?: React.CSSProperties;
}

/**
 * Frosted translucent surface that floats over the 3D game canvas.
 * @startingPoint section="Core" subtitle="Frosted glass panel" viewport="700x260"
 */
export function GlassPanel(props: GlassPanelProps): JSX.Element;
