import * as React from 'react';

export type ElementId = 'base' | 'fire' | 'ice' | 'poison' | 'lightning';

export interface ElementMeta {
  id: ElementId; label: string; key: string; grad: string; color: string;
}
export const ELEMENTS: ElementMeta[];

export interface ElementSelectorProps {
  /** Active element. @default "base" */
  current?: ElementId;
  /** Called with the chosen element id. */
  onSelect?: (id: ElementId) => void;
  style?: React.CSSProperties;
}

/**
 * Arrow-type picker HUD — five chips (base + 4 elements), active one glows.
 * @startingPoint section="Mohás Roham" subtitle="Elemental arrow picker" viewport="700x150"
 */
export function ElementSelector(props: ElementSelectorProps): JSX.Element;
