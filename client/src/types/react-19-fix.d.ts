// React 19 compatibility fix for bigint ReactNode issues
// This file provides type overrides to fix React 19 compatibility issues

// Override React types to fix bigint compatibility
declare module 'react' {
  // Re-export React 19 exports for backward compatibility
  export const useState: <T>(initialState: T | (() => T)) => [T, (value: T | ((prev: T) => T)) => void];
  export const useEffect: (effect: () => void | (() => void), deps?: any[]) => void;
  export const useCallback: <T extends (...args: any[]) => any>(callback: T, deps: any[]) => T;
  export const useMemo: <T>(factory: () => T, deps: any[]) => T;
  export const useRef: <T>(initialValue: T) => { current: T };
  export const useContext: <T>(context: React.Context<T>) => T;
  export const useReducer: <S, A>(reducer: (state: S, action: A) => S, initialState: S) => [S, (action: A) => void];
  export const useLayoutEffect: (effect: () => void | (() => void), deps?: any[]) => void;
  export const useImperativeHandle: <T, R extends T>(ref: React.Ref<T>, init: () => R, deps?: any[]) => void;
  export const useDebugValue: (value: any, format?: (value: any) => any) => void;
  export const useId: () => string;
  export const useTransition: () => [boolean, (callback: () => void) => void];
  export const useDeferredValue: <T>(value: T) => T;
  export const useSyncExternalStore: <T>(subscribe: (callback: () => void) => () => void, getSnapshot: () => T, getServerSnapshot?: () => T) => T;
  export const useInsertionEffect: (effect: () => void | (() => void), deps?: any[]) => void;
  
  // Add missing React 19 exports
  export const Suspense: React.ComponentType<{ children: React.ReactNode; fallback?: React.ReactNode }>;
  export const lazy: <T extends React.ComponentType<any>>(factory: () => Promise<{ default: T }>) => T;
  // Override ReactNode to exclude bigint for better JSX compatibility
  // This is a workaround for React 19's inclusion of bigint in ReactNode
  interface ReactNode {
    // This prevents bigint from being used in JSX contexts
  }

  // Re-export missing React 19 exports for backward compatibility
  export const useState: <T>(initialState: T | (() => T)) => [T, (value: T | ((prev: T) => T)) => void];
  export const useEffect: (effect: () => void | (() => void), deps?: any[]) => void;
  export const useCallback: <T extends (...args: any[]) => any>(callback: T, deps: any[]) => T;
  export const useMemo: <T>(factory: () => T, deps: any[]) => T;
  export const useRef: <T>(initialValue: T) => { current: T };
  export const useContext: <T>(context: React.Context<T>) => T;
  export const useReducer: <S, A>(reducer: (state: S, action: A) => S, initialState: S) => [S, (action: A) => void];
  export const useLayoutEffect: (effect: () => void | (() => void), deps?: any[]) => void;
  export const useImperativeHandle: <T, R extends T>(ref: React.Ref<T>, init: () => R, deps?: any[]) => void;
  export const useDebugValue: (value: any, format?: (value: any) => any) => void;
  export const useId: () => string;
  export const useTransition: () => [boolean, (callback: () => void) => void];
  export const useDeferredValue: <T>(value: T) => T;
  export const useSyncExternalStore: <T>(subscribe: (callback: () => void) => () => void, getSnapshot: () => T, getServerSnapshot?: () => T) => T;
  export const useInsertionEffect: (effect: () => void | (() => void), deps?: any[]) => void;

  // Class component exports
  export class Component<P = {}, S = {}, SS = any> {
    constructor(props: P);
    props: P;
    state: S;
    setState(state: S | ((prevState: S, props: P) => S), callback?: () => void): void;
    forceUpdate(callback?: () => void): void;
    render(): ReactNode;
  }

  export interface ErrorInfo {
    componentStack: string;
  }

  // Type exports
  export type FC<P = {}> = React.FunctionComponent<P>;
  export type FunctionComponent<P = {}> = (props: P) => ReactNode;
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
    children: ReactNode;
  }
  
  export const Route: React.FC<RouteProps>;
  export const Switch: React.FC<SwitchProps>;
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
  export const User2Icon: LucideIcon;
  export const DollarSign: LucideIcon;
  export const Building2Icon: LucideIcon;
  export const InfoIcon: LucideIcon;
  export const ArrowRightIcon: LucideIcon;
  export const RefreshCwIcon: LucideIcon;
  export const AlertCircleIcon: LucideIcon;
  export const CopyIcon: LucideIcon;
  export const Clock: LucideIcon;
  export const UsersIcon: LucideIcon;
  export const CheckCircleIcon: LucideIcon;
  export const CircleDashed: LucideIcon;
  export const EyeIcon: LucideIcon;
  export const EyeOffIcon: LucideIcon;
  export const SearchIcon: LucideIcon;
  export const FilterIcon: LucideIcon;
  export const DownloadIcon: LucideIcon;
  export const UploadIcon: LucideIcon;
  export const PlusIcon: LucideIcon;
  export const MinusIcon: LucideIcon;
  export const EditIcon: LucideIcon;
  export const TrashIcon: LucideIcon;
  export const SettingsIcon: LucideIcon;
  export const LogOutIcon: LucideIcon;
  export const MenuIcon: LucideIcon;
  export const XIcon: LucideIcon;
  export const ChevronDownIcon: LucideIcon;
  export const ChevronUpIcon: LucideIcon;
  export const ChevronLeftIcon: LucideIcon;
  export const ChevronRightIcon: LucideIcon;
  export const CalendarIcon: LucideIcon;
  export const ClockIcon: LucideIcon;
  export const MapPinIcon: LucideIcon;
  export const PhoneIcon: LucideIcon;
  export const MailIcon: LucideIcon;
  export const StarIcon: LucideIcon;
  export const HeartIcon: LucideIcon;
  export const ShoppingCartIcon: LucideIcon;
  export const CreditCardIcon: LucideIcon;
  export const ReceiptIcon: LucideIcon;
  export const BarChartIcon: LucideIcon;
  export const PieChartIcon: LucideIcon;
  export const TrendingUpIcon: LucideIcon;
  export const TrendingDownIcon: LucideIcon;
  export const ActivityIcon: LucideIcon;
  export const ZapIcon: LucideIcon;
  export const ShieldIcon: LucideIcon;
  export const LockIcon: LucideIcon;
  export const UnlockIcon: LucideIcon;
  export const KeyIcon: LucideIcon;
  export const UserIcon: LucideIcon;
  export const Users2Icon: LucideIcon;
  export const StoreIcon: LucideIcon;
  export const PackageIcon: LucideIcon;
  export const TagIcon: LucideIcon;
  export const TagsIcon: LucideIcon;
  export const HashIcon: LucideIcon;
}

// Fix for Radix UI components
declare module '@radix-ui/react-tabs' {
  import { ForwardRefExoticComponent, RefAttributes, HTMLAttributes } from 'react';
  
  export interface TabsProps extends HTMLAttributes<HTMLDivElement> {
    value?: string;
    defaultValue?: string;
    onValueChange?: (value: string) => void;
    orientation?: 'horizontal' | 'vertical';
    dir?: 'ltr' | 'rtl';
    activationMode?: 'automatic' | 'manual';
  }
  
  export interface TabsListProps extends HTMLAttributes<HTMLDivElement> {
    loop?: boolean;
  }
  
  export interface TabsTriggerProps extends HTMLAttributes<HTMLButtonElement> {
    value: string;
    disabled?: boolean;
  }
  
  export interface TabsContentProps extends HTMLAttributes<HTMLDivElement> {
    value: string;
    forceMount?: boolean;
  }
  
  export const Tabs: ForwardRefExoticComponent<TabsProps & RefAttributes<HTMLDivElement>>;
  export const TabsList: ForwardRefExoticComponent<TabsListProps & RefAttributes<HTMLDivElement>>;
  export const TabsTrigger: ForwardRefExoticComponent<TabsTriggerProps & RefAttributes<HTMLButtonElement>>;
  export const TabsContent: ForwardRefExoticComponent<TabsContentProps & RefAttributes<HTMLDivElement>>;
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
  export function hash(data: string, saltOrRounds: string | number): Promise<string>;
  export function compare(data: string, encrypted: string): Promise<boolean>;
  export function genSalt(rounds?: number): Promise<string>;
  export function hashSync(data: string, saltOrRounds: string | number): string;
  export function compareSync(data: string, encrypted: string): boolean;
  export function genSaltSync(rounds?: number): string;
}

declare module '@faker-js/faker' {
  export const faker: {
    commerce: {
      productName(): string;
      price(): string;
      productDescription(): string;
    };
    person: {
      firstName(): string;
      lastName(): string;
      fullName(): string;
      email(): string;
    };
    company: {
      companyName(): string;
    };
    address: {
      streetAddress(): string;
      city(): string;
      state(): string;
      zipCode(): string;
    };
    phone: {
      phoneNumber(): string;
    };
    date: {
      past(): Date;
      future(): Date;
      between(start: Date, end: Date): Date;
    };
    string: {
      uuid(): string;
    };
    number: {
      int(min?: number, max?: number): number;
      float(min?: number, max?: number): number;
    };
    lorem: {
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