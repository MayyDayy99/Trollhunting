import * as React from 'react';

export interface ToastProps {
  children?: React.ReactNode;
  /** Visible (scale + fade in). @default true */
  show?: boolean;
  style?: React.CSSProperties;
}

/** Big centered amber announcement (wave cleared, headshot, …). */
export function Toast(props: ToastProps): JSX.Element;
