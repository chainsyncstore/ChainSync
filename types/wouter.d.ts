// Local shim to simplify wouter types for React 18 compatibility
// This overrides the upstream types that return `ReactNode | Promise<ReactNode>`
// which breaks strict JSX.Element expectations in our tsconfig.

import * as React from 'react';

export interface RouteProps {
  path?: string;
  component?: React.ComponentType<any>;
  children?: React.ReactNode;
}

export interface SwitchProps {
  children?: React.ReactNode;
}

// Simplified declarations returning JSX.Element only (not Promise).

declare module 'wouter' {
  export function Route(props: RouteProps): JSX.Element;
  export function Switch(props: SwitchProps): JSX.Element;
  export function Link<T = unknown>(props: React.AnchorHTMLAttributes<T> & { to: string }): JSX.Element;
  export function useLocation(): [string, (path: string) => void];
}
