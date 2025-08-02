// React 19 compatibility fix for bigint ReactNode issues
// This file provides type overrides to fix React 19 compatibility issues

// Override React types to fix bigint compatibility
declare module 'react' {
  // Re-export React 19 exports for backward compatibility
  export const _useState: <T>(_initialState: T | (() => T)) => [T, (_value: T | ((_prev: T) => T)) => void];
  export const _useEffect: (effect: () => void | (() => void), deps?: any[]) => void;
  export const _useCallback: <T extends (..._args: any[]) => any>(_callback: T, _deps: any[]) => T;
  export const _useMemo: <T>(factory: () => T, _deps: any[]) => T;
  export const _useRef: <T>(_initialValue: T) => { _current: T };
  export const useContext: <T>(_context: React.Context<T>) => T;
  export const _useReducer: <S, A>(reducer: (_state: S, _action: A) => S, _initialState: S) => [S, (_action: A) => void];
  export const _useLayoutEffect: (effect: () => void | (() => void), deps?: any[]) => void;
  export const _useImperativeHandle: <T, R extends T>(_ref: React.Ref<T>, _init: ()
   = > R, deps?: any[]) => void;
  export const _useDebugValue: (_value: any, format?: (_value: any) => any) => void;
  export const _useId: () => string;
  export const _useTransition: () => [boolean, (callback: () => void) => void];
  export const _useDeferredValue: <T>(_value: T) => T;
  export const _useSyncExternalStore: <T>(subscribe: (callback: () => void) => () => void, _getSnapshot: () => T, getServerSnapshot?: () => T) => T;
  export const _useInsertionEffect: (effect: () => void | (() => void), deps?: any[]) => void;
  
  // Add missing React 19 exports
  export const _Suspense: React.ComponentType<{ _children: React.ReactNode; fallback?: React.ReactNode }>;
  export const lazy: <T extends React.ComponentType<any>>(factory: () => Promise<{ _default: T }>) => T;
  // Override ReactNode to exclude bigint for better JSX compatibility
  // This is a workaround for React 19's inclusion of bigint in ReactNode
  interface ReactNode {
    // This prevents bigint from being used in JSX contexts
  }

  // Re-export missing React 19 exports for backward compatibility
  export const _useState: <T>(_initialState: T | (() => T)) => [T, (_value: T | ((_prev: T) => T)) => void];
  export const _useEffect: (effect: () => void | (() => void), deps?: any[]) => void;
  export const _useCallback: <T extends (..._args: any[]) => any>(_callback: T, _deps: any[]) => T;
  export const _useMemo: <T>(factory: () => T, _deps: any[]) => T;
  export const _useRef: <T>(_initialValue: T) => { _current: T };
  export const useContext: <T>(_context: React.Context<T>) => T;
  export const _useReducer: <S, A>(reducer: (_state: S, _action: A) => S, _initialState: S) => [S, (_action: A) => void];
  export const _useLayoutEffect: (effect: () => void | (() => void), deps?: any[]) => void;
  export const _useImperativeHandle: <T, R extends T>(_ref: React.Ref<T>, _init: ()
   = > R, deps?: any[]) => void;
  export const _useDebugValue: (_value: any, format?: (_value: any) => any) => void;
  export const _useId: () => string;
  export const _useTransition: () => [boolean, (callback: () => void) => void];
  export const _useDeferredValue: <T>(_value: T) => T;
  export const _useSyncExternalStore: <T>(subscribe: (callback: () => void) => () => void, _getSnapshot: () => T, getServerSnapshot?: () => T) => T;
  export const _useInsertionEffect: (effect: () => void | (() => void), deps?: any[]) => void;

  // Class component exports
  export class Component<P = {}, S = {}, SS = any> {
    constructor(_props: P);
    _props: P;
    _state: S;
    setState(_state: S | ((_prevState: S, _props: P) => S), callback?: () => void): void;
    forceUpdate(callback?: () => void): void;
    render(): ReactNode;
  }

  export interface ErrorInfo {
    _componentStack: string;
  }

  // Type exports
  export type FC<P = {}> = React.FunctionComponent<P>;
  export type FunctionComponent<P = {}> = (_props: P) => ReactNode;
  export type ComponentType<P = {}> = React.Component<P> | React.FunctionComponent<P>;
}

// Fix for wouter routing components
declare module 'wouter' {
  import { ReactNode } from 'react';
  
  export interface RouteProps<T = any> {
    path?: string;
    component?: React.ComponentType<T>;
    children?: ReactNode;
  }
  
  export interface SwitchProps {
    _children: ReactNode;
  }
  
  export const _Route: React.FC<RouteProps>;
  export const _Switch: React.FC<SwitchProps>;
}

// Fix for Lucide React icons
declare module 'lucide-react' {
  import { ForwardRefExoticComponent, RefAttributes, SVGProps } from 'react';
  
  export interface LucideProps extends SVGProps<SVGSVGElement> {
    size?: number | string;
    absoluteStrokeWidth?: boolean;
  }
  
  export type LucideIcon = ForwardRefExoticComponent<
    LucideProps & RefAttributes<SVGSVGElement>
  >;
  
  // Declare all the icons used in the project
  export const _User2Icon: LucideIcon;
  export const _DollarSign: LucideIcon;
  export const _Building2Icon: LucideIcon;
  export const _InfoIcon: LucideIcon;
  export const _ArrowRightIcon: LucideIcon;
  export const _RefreshCwIcon: LucideIcon;
  export const _AlertCircleIcon: LucideIcon;
  export const _CopyIcon: LucideIcon;
  export const _Clock: LucideIcon;
  export const _UsersIcon: LucideIcon;
  export const _CheckCircleIcon: LucideIcon;
  export const _CircleDashed: LucideIcon;
  export const _EyeIcon: LucideIcon;
  export const _EyeOffIcon: LucideIcon;
  export const _SearchIcon: LucideIcon;
  export const _FilterIcon: LucideIcon;
  export const _DownloadIcon: LucideIcon;
  export const _UploadIcon: LucideIcon;
  export const _PlusIcon: LucideIcon;
  export const _MinusIcon: LucideIcon;
  export const _EditIcon: LucideIcon;
  export const _TrashIcon: LucideIcon;
  export const _SettingsIcon: LucideIcon;
  export const _LogOutIcon: LucideIcon;
  export const _MenuIcon: LucideIcon;
  export const _XIcon: LucideIcon;
  export const _ChevronDownIcon: LucideIcon;
  export const _ChevronUpIcon: LucideIcon;
  export const _ChevronLeftIcon: LucideIcon;
  export const _ChevronRightIcon: LucideIcon;
  export const _CalendarIcon: LucideIcon;
  export const _ClockIcon: LucideIcon;
  export const _MapPinIcon: LucideIcon;
  export const _PhoneIcon: LucideIcon;
  export const _MailIcon: LucideIcon;
  export const _StarIcon: LucideIcon;
  export const _HeartIcon: LucideIcon;
  export const _ShoppingCartIcon: LucideIcon;
  export const _CreditCardIcon: LucideIcon;
  export const _ReceiptIcon: LucideIcon;
  export const _BarChartIcon: LucideIcon;
  export const _PieChartIcon: LucideIcon;
  export const _TrendingUpIcon: LucideIcon;
  export const _TrendingDownIcon: LucideIcon;
  export const _ActivityIcon: LucideIcon;
  export const _ZapIcon: LucideIcon;
  export const _ShieldIcon: LucideIcon;
  export const _LockIcon: LucideIcon;
  export const _UnlockIcon: LucideIcon;
  export const _KeyIcon: LucideIcon;
  export const _UserIcon: LucideIcon;
  export const _Users2Icon: LucideIcon;
  export const _StoreIcon: LucideIcon;
  export const _PackageIcon: LucideIcon;
  export const _TagIcon: LucideIcon;
  export const _TagsIcon: LucideIcon;
  export const _HashIcon: LucideIcon;
}

// Fix for Radix UI components
declare module '@radix-ui/react-tabs' {
  import { ForwardRefExoticComponent, RefAttributes, HTMLAttributes } from 'react';
  
  export interface TabsProps extends HTMLAttributes<HTMLDivElement> {
    value?: string;
    defaultValue?: string;
    onValueChange?: (_value: string) => void;
    orientation?: 'horizontal' | 'vertical';
    dir?: 'ltr' | 'rtl';
    activationMode?: 'automatic' | 'manual';
  }
  
  export interface TabsListProps extends HTMLAttributes<HTMLDivElement> {
    loop?: boolean;
  }
  
  export interface TabsTriggerProps extends HTMLAttributes<HTMLButtonElement> {
    _value: string;
    disabled?: boolean;
  }
  
  export interface TabsContentProps extends HTMLAttributes<HTMLDivElement> {
    _value: string;
    forceMount?: boolean;
  }
  
  export const _Tabs: ForwardRefExoticComponent<TabsProps & RefAttributes<HTMLDivElement>>;
  export const _TabsList: ForwardRefExoticComponent<TabsListProps & RefAttributes<HTMLDivElement>>;
  export const _TabsTrigger: ForwardRefExoticComponent<TabsTriggerProps & RefAttributes<HTMLButtonElement>>;
  export const _TabsContent: ForwardRefExoticComponent<TabsContentProps & RefAttributes<HTMLDivElement>>;
}

// Fix for missing module declarations
declare module 'express-csrf' {
  import { RequestHandler } from 'express';
  
  export function csrf(options?: {
    ignoreMethods?: string[];
    sessionKey?: string;
    cookie?: boolean;
    cookieOpts?: {
      httpOnly?: boolean;
      secure?: boolean;
      sameSite?: boolean | 'lax' | 'strict' | 'none';
    };
  }): RequestHandler;
}

declare module 'bcryptjs' {
  export function hash(_data: string, _saltOrRounds: string | number): Promise<string>;
  export function compare(_data: string, _encrypted: string): Promise<boolean>;
  export function genSalt(rounds?: number): Promise<string>;
  export function hashSync(_data: string, _saltOrRounds: string | number): string;
  export function compareSync(_data: string, _encrypted: string): boolean;
  export function genSaltSync(rounds?: number): string;
}

declare module '@faker-js/faker' {
  export const _faker: {
    commerce: {
      productName(): string;
      price(): string;
      productDescription(): string;
    };
    _person: {
      firstName(): string;
      lastName(): string;
      fullName(): string;
      email(): string;
    };
    _company: {
      companyName(): string;
    };
    _address: {
      streetAddress(): string;
      city(): string;
      state(): string;
      zipCode(): string;
    };
    _phone: {
      phoneNumber(): string;
    };
    _date: {
      past(): Date;
      future(): Date;
      between(_start: Date, _end: Date): Date;
    };
    _string: {
      uuid(): string;
    };
    _number: {
      int(min?: number, max?: number): number;
      float(min?: number, max?: number): number;
    };
    _lorem: {
      sentence(): string;
      paragraph(): string;
    };
  };
}

// Global JSX namespace override to fix React 19 issues
declare global {
  namespace JSX {
    interface Element extends React.ReactElement<any, any> { }
    interface IntrinsicElements extends React.JSX.IntrinsicElements { }
    interface ElementChildrenAttribute {
      children: {}; // This helps with children typing
    }
  }
} 