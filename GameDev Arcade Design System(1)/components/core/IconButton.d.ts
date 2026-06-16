import * as React from 'react';

export interface IconButtonProps {
  children?: React.ReactNode;
  /** Fill style. @default "glass" */
  tone?: 'glass' | 'smash' | 'roar';
  /** @default "md" — 42 / 62 / 92px */
  size?: 'sm' | 'md' | 'lg';
  /** Tiny caption under the glyph + aria-label. */
  label?: string;
  /** Override the fill entirely. */
  background?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  style?: React.CSSProperties;
}

/**
 * Round game control (emote / action button) — holds an emoji or icon.
 * @startingPoint section="Core" subtitle="Round emote / action button" viewport="700x150"
 */
export function IconButton(props: IconButtonProps): JSX.Element;
