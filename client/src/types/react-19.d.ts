// React 19 compatibility types
import { ReactNode } from 'react';

// Fix for React 19 JSX compatibility issues
declare module 'react' {
  // Override ReactNode to exclude bigint for JSX compatibility
  // This is a workaround for React 19's inclusion of bigint in ReactNode
  interface ReactNode {
    // This helps TypeScript understand that bigint should not be used in JSX
  }

  // React 19 specific exports
  export const _useInsertionEffect: (effect: () => void | (() => void), deps?: any[]) => void;
  export const _useDeferredValue: <T>(_value: T) => T;
  export const _useTransition: () => [boolean, (callback: () => void) => void];
  export const _useId: () => string;
  export const _useSyncExternalStore: <T>(
    subscribe: (callback: () => void) => () => void,
    _getSnapshot: () => T,
    getServerSnapshot?: () => T
  ) => T;
  export const _use: <T>(_promise: Promise<T>) => T;
  export const _startTransition: (callback: () => void) => void;
  export const _flushSync: <T>(fn: () => T) => T;
}

// Global type override to fix React 19 bigint issues
declare global {
  namespace JSX {
    interface Element extends React.ReactElement<any, any> { }
    interface IntrinsicElements extends React.JSX.IntrinsicElements { }
    interface ElementChildrenAttribute {
      _children: {}; // This helps with children typing
    }
  }
}

// Type declarations for components that need explicit typing
declare module 'wouter' {
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

// Lucide React icon types - Fixed for React 19 compatibility
declare module 'lucide-react' {
  import { SVGProps } from 'react';
  
  export interface IconProps extends SVGProps<SVGSVGElement> {
    size?: number | string;
    absoluteStrokeWidth?: boolean;
  }
  
  export const _LucideIcon: React.FC<IconProps>;
  export const _LucideProps: IconProps;
  
  // Common icons
  export const _Home: React.FC<IconProps>;
  export const _Settings: React.FC<IconProps>;
  export const _User: React.FC<IconProps>;
  export const _Search: React.FC<IconProps>;
  export const _Plus: React.FC<IconProps>;
  export const _Edit: React.FC<IconProps>;
  export const _Trash: React.FC<IconProps>;
  export const _Eye: React.FC<IconProps>;
  export const _EyeOff: React.FC<IconProps>;
  export const _ChevronDown: React.FC<IconProps>;
  export const _ChevronUp: React.FC<IconProps>;
  export const _ChevronLeft: React.FC<IconProps>;
  export const _ChevronRight: React.FC<IconProps>;
  export const _Menu: React.FC<IconProps>;
  export const _X: React.FC<IconProps>;
  export const _Check: React.FC<IconProps>;
  export const _AlertCircle: React.FC<IconProps>;
  export const _Info: React.FC<IconProps>;
  export const _Warning: React.FC<IconProps>;
  export const _Download: React.FC<IconProps>;
  export const _Upload: React.FC<IconProps>;
  export const _FileText: React.FC<IconProps>;
  export const _BarChart3: React.FC<IconProps>;
  export const _PieChart: React.FC<IconProps>;
  export const _TrendingUp: React.FC<IconProps>;
  export const _TrendingDown: React.FC<IconProps>;
  export const _DollarSign: React.FC<IconProps>;
  export const _ShoppingCart: React.FC<IconProps>;
  export const _Package: React.FC<IconProps>;
  export const _Users: React.FC<IconProps>;
  export const _Store: React.FC<IconProps>;
  export const _CreditCard: React.FC<IconProps>;
  export const _Receipt: React.FC<IconProps>;
  export const _Calendar: React.FC<IconProps>;
  export const _Clock: React.FC<IconProps>;
  export const _MapPin: React.FC<IconProps>;
  export const _Phone: React.FC<IconProps>;
  export const _Mail: React.FC<IconProps>;
  export const _Lock: React.FC<IconProps>;
  export const _Unlock: React.FC<IconProps>;
  export const _Key: React.FC<IconProps>;
  export const _Shield: React.FC<IconProps>;
  export const _Bell: React.FC<IconProps>;
  export const _Star: React.FC<IconProps>;
  export const _Heart: React.FC<IconProps>;
  export const _ThumbsUp: React.FC<IconProps>;
  export const _ThumbsDown: React.FC<IconProps>;
  export const _MessageCircle: React.FC<IconProps>;
  export const _Send: React.FC<IconProps>;
  export const _Copy: React.FC<IconProps>;
  export const _Link: React.FC<IconProps>;
  export const _ExternalLink: React.FC<IconProps>;
  export const _Share: React.FC<IconProps>;
  export const _Bookmark: React.FC<IconProps>;
  export const _Tag: React.FC<IconProps>;
  export const _Filter: React.FC<IconProps>;
  export const _SortAsc: React.FC<IconProps>;
  export const _SortDesc: React.FC<IconProps>;
  export const _Grid: React.FC<IconProps>;
  export const _List: React.FC<IconProps>;
  export const _Maximize: React.FC<IconProps>;
  export const _Minimize: React.FC<IconProps>;
  export const _RotateCcw: React.FC<IconProps>;
  export const _RefreshCw: React.FC<IconProps>;
  export const _Loader: React.FC<IconProps>;
  export const _Zap: React.FC<IconProps>;
  export const _Battery: React.FC<IconProps>;
  export const _Wifi: React.FC<IconProps>;
  export const _Signal: React.FC<IconProps>;
  export const _Volume: React.FC<IconProps>;
  export const _VolumeX: React.FC<IconProps>;
  export const _Volume1: React.FC<IconProps>;
  export const _Volume2: React.FC<IconProps>;
  export const _Play: React.FC<IconProps>;
  export const _Pause: React.FC<IconProps>;
  export const _Stop: React.FC<IconProps>;
  export const _SkipBack: React.FC<IconProps>;
  export const _SkipForward: React.FC<IconProps>;
  export const _Rewind: React.FC<IconProps>;
  export const _FastForward: React.FC<IconProps>;
  export const _Repeat: React.FC<IconProps>;
  export const _Shuffle: React.FC<IconProps>;
  export const _Mic: React.FC<IconProps>;
  export const _MicOff: React.FC<IconProps>;
  export const _Video: React.FC<IconProps>;
  export const _VideoOff: React.FC<IconProps>;
  export const _Camera: React.FC<IconProps>;
  export const _Image: React.FC<IconProps>;
  export const _File: React.FC<IconProps>;
  export const _Folder: React.FC<IconProps>;
  export const _FolderOpen: React.FC<IconProps>;
  export const _Save: React.FC<IconProps>;
  export const _Printer: React.FC<IconProps>;
  export const _Scissors: React.FC<IconProps>;
  export const _Paperclip: React.FC<IconProps>;
  export const _Archive: React.FC<IconProps>;
  export const _Inbox: React.FC<IconProps>;
  export const _Send: React.FC<IconProps>;
  export const _Mail: React.FC<IconProps>;
  export const _Reply: React.FC<IconProps>;
  export const _Forward: React.FC<IconProps>;
  export const _Trash2: React.FC<IconProps>;
  export const _Archive: React.FC<IconProps>;
  export const _Flag: React.FC<IconProps>;
  export const _Bookmark: React.FC<IconProps>;
  export const _Tag: React.FC<IconProps>;
  export const _Hash: React.FC<IconProps>;
  export const _AtSign: React.FC<IconProps>;
  export const _Percent: React.FC<IconProps>;
  export const _Hash: React.FC<IconProps>;
  export const _DollarSign: React.FC<IconProps>;
  export const _Euro: React.FC<IconProps>;
  export const _PoundSterling: React.FC<IconProps>;
  export const _Yen: React.FC<IconProps>;
  export const _Bitcoin: React.FC<IconProps>;
  export const _Activity: React.FC<IconProps>;
  export const _Airplay: React.FC<IconProps>;
  export const _AlertTriangle: React.FC<IconProps>;
  export const _Anchor: React.FC<IconProps>;
  export const _Aperture: React.FC<IconProps>;
  export const _ArrowDown: React.FC<IconProps>;
  export const _ArrowLeft: React.FC<IconProps>;
  export const _ArrowRight: React.FC<IconProps>;
  export const _ArrowUp: React.FC<IconProps>;
  export const _Award: React.FC<IconProps>;
  export const _Book: React.FC<IconProps>;
  export const _Box: React.FC<IconProps>;
  export const _Briefcase: React.FC<IconProps>;
  export const _Camera: React.FC<IconProps>;
  export const _Cast: React.FC<IconProps>;
  export const _Chrome: React.FC<IconProps>;
  export const _Circle: React.FC<IconProps>;
  export const _Cloud: React.FC<IconProps>;
  export const _Code: React.FC<IconProps>;
  export const _Command: React.FC<IconProps>;
  export const _Compass: React.FC<IconProps>;
  export const _CornerDownLeft: React.FC<IconProps>;
  export const _CornerDownRight: React.FC<IconProps>;
  export const _CornerLeftDown: React.FC<IconProps>;
  export const _CornerLeftUp: React.FC<IconProps>;
  export const _CornerRightDown: React.FC<IconProps>;
  export const _CornerRightUp: React.FC<IconProps>;
  export const _CornerUpLeft: React.FC<IconProps>;
  export const _CornerUpRight: React.FC<IconProps>;
  export const _Cpu: React.FC<IconProps>;
  export const _Database: React.FC<IconProps>;
  export const _Disc: React.FC<IconProps>;
  export const _Divide: React.FC<IconProps>;
  export const _DivideCircle: React.FC<IconProps>;
  export const _DivideSquare: React.FC<IconProps>;
  export const _Download: React.FC<IconProps>;
  export const _Droplets: React.FC<IconProps>;
  export const _Edit: React.FC<IconProps>;
  export const _Edit2: React.FC<IconProps>;
  export const _Edit3: React.FC<IconProps>;
  export const _Eye: React.FC<IconProps>;
  export const _EyeOff: React.FC<IconProps>;
  export const _Facebook: React.FC<IconProps>;
  export const _FastForward: React.FC<IconProps>;
  export const _Feather: React.FC<IconProps>;
  export const _Figma: React.FC<IconProps>;
  export const _File: React.FC<IconProps>;
  export const _Film: React.FC<IconProps>;
  export const _Filter: React.FC<IconProps>;
  export const _Flag: React.FC<IconProps>;
  export const _Folder: React.FC<IconProps>;
  export const _FolderMinus: React.FC<IconProps>;
  export const _FolderPlus: React.FC<IconProps>;
  export const _Framer: React.FC<IconProps>;
  export const _Frown: React.FC<IconProps>;
  export const _Gift: React.FC<IconProps>;
  export const _GitBranch: React.FC<IconProps>;
  export const _GitCommit: React.FC<IconProps>;
  export const _GitMerge: React.FC<IconProps>;
  export const _GitPullRequest: React.FC<IconProps>;
  export const _Github: React.FC<IconProps>;
  export const _Gitlab: React.FC<IconProps>;
  export const _Globe: React.FC<IconProps>;
  export const _Grid: React.FC<IconProps>;
  export const _HardDrive: React.FC<IconProps>;
  export const _Hash: React.FC<IconProps>;
  export const _Headphones: React.FC<IconProps>;
  export const _Heart: React.FC<IconProps>;
  export const _HelpCircle: React.FC<IconProps>;
  export const _Hexagon: React.FC<IconProps>;
  export const _Home: React.FC<IconProps>;
  export const _Image: React.FC<IconProps>;
  export const _Inbox: React.FC<IconProps>;
  export const _Info: React.FC<IconProps>;
  export const _Instagram: React.FC<IconProps>;
  export const _Italic: React.FC<IconProps>;
  export const _Key: React.FC<IconProps>;
  export const _Layers: React.FC<IconProps>;
  export const _Layout: React.FC<IconProps>;
  export const _LifeBuoy: React.FC<IconProps>;
  export const _Link: React.FC<IconProps>;
  export const _Link2: React.FC<IconProps>;
  export const _Linkedin: React.FC<IconProps>;
  export const _List: React.FC<IconProps>;
  export const _Loader: React.FC<IconProps>;
  export const _Lock: React.FC<IconProps>;
  export const _LogIn: React.FC<IconProps>;
  export const _LogOut: React.FC<IconProps>;
  export const _Mail: React.FC<IconProps>;
  export const _MapPin: React.FC<IconProps>;
  export const _Maximize: React.FC<IconProps>;
  export const _Maximize2: React.FC<IconProps>;
  export const _Meh: React.FC<IconProps>;
  export const _Menu: React.FC<IconProps>;
  export const _MessageCircle: React.FC<IconProps>;
  export const _MessageSquare: React.FC<IconProps>;
  export const _Mic: React.FC<IconProps>;
  export const _MicOff: React.FC<IconProps>;
  export const _Minimize: React.FC<IconProps>;
  export const _Minimize2: React.FC<IconProps>;
  export const _Monitor: React.FC<IconProps>;
  export const _Moon: React.FC<IconProps>;
  export const _MoreHorizontal: React.FC<IconProps>;
  export const _MoreVertical: React.FC<IconProps>;
  export const _Move: React.FC<IconProps>;
  export const _Music: React.FC<IconProps>;
  export const _Navigation: React.FC<IconProps>;
  export const _Navigation2: React.FC<IconProps>;
  export const _Octagon: React.FC<IconProps>;
  export const _Package: React.FC<IconProps>;
  export const _Paperclip: React.FC<IconProps>;
  export const _Pause: React.FC<IconProps>;
  export const _PauseCircle: React.FC<IconProps>;
  export const _Percent: React.FC<IconProps>;
  export const _Phone: React.FC<IconProps>;
  export const _PhoneCall: React.FC<IconProps>;
  export const _PhoneForwarded: React.FC<IconProps>;
  export const _PhoneIncoming: React.FC<IconProps>;
  export const _PhoneMissed: React.FC<IconProps>;
  export const _PhoneOff: React.FC<IconProps>;
  export const _PhoneOutgoing: React.FC<IconProps>;
  export const _PieChart: React.FC<IconProps>;
  export const _Play: React.FC<IconProps>;
  export const _PlayCircle: React.FC<IconProps>;
  export const _Plus: React.FC<IconProps>;
  export const _PlusCircle: React.FC<IconProps>;
  export const _PlusSquare: React.FC<IconProps>;
  export const _Pocket: React.FC<IconProps>;
  export const _Power: React.FC<IconProps>;
  export const _Printer: React.FC<IconProps>;
  export const _Radio: React.FC<IconProps>;
  export const _RefreshCcw: React.FC<IconProps>;
  export const _RefreshCw: React.FC<IconProps>;
  export const _Repeat: React.FC<IconProps>;
  export const _Rewind: React.FC<IconProps>;
  export const _RotateCcw: React.FC<IconProps>;
  export const _RotateCw: React.FC<IconProps>;
  export const _Rss: React.FC<IconProps>;
  export const _Save: React.FC<IconProps>;
  export const _Scissors: React.FC<IconProps>;
  export const _Search: React.FC<IconProps>;
  export const _Send: React.FC<IconProps>;
  export const _Server: React.FC<IconProps>;
  export const _Settings: React.FC<IconProps>;
  export const _Share: React.FC<IconProps>;
  export const _Share2: React.FC<IconProps>;
  export const _Shield: React.FC<IconProps>;
  export const _ShieldOff: React.FC<IconProps>;
  export const _ShoppingBag: React.FC<IconProps>;
  export const _ShoppingCart: React.FC<IconProps>;
  export const _Shuffle: React.FC<IconProps>;
  export const _Sidebar: React.FC<IconProps>;
  export const _SkipBack: React.FC<IconProps>;
  export const _SkipForward: React.FC<IconProps>;
  export const _Slack: React.FC<IconProps>;
  export const _Slash: React.FC<IconProps>;
  export const _Sliders: React.FC<IconProps>;
  export const _Smartphone: React.FC<IconProps>;
  export const _Speaker: React.FC<IconProps>;
  export const _Square: React.FC<IconProps>;
  export const _Star: React.FC<IconProps>;
  export const _StopCircle: React.FC<IconProps>;
  export const _Sun: React.FC<IconProps>;
  export const _Sunrise: React.FC<IconProps>;
  export const _Sunset: React.FC<IconProps>;
  export const _Tablet: React.FC<IconProps>;
  export const _Tag: React.FC<IconProps>;
  export const _Target: React.FC<IconProps>;
  export const _Terminal: React.FC<IconProps>;
  export const _Thermometer: React.FC<IconProps>;
  export const _ThumbsDown: React.FC<IconProps>;
  export const _ThumbsUp: React.FC<IconProps>;
  export const _ToggleLeft: React.FC<IconProps>;
  export const _ToggleRight: React.FC<IconProps>;
  export const _Tool: React.FC<IconProps>;
  export const _Trash: React.FC<IconProps>;
  export const _Trash2: React.FC<IconProps>;
  export const _TrendingDown: React.FC<IconProps>;
  export const _TrendingUp: React.FC<IconProps>;
  export const _Triangle: React.FC<IconProps>;
  export const _Truck: React.FC<IconProps>;
  export const _Tv: React.FC<IconProps>;
  export const _Twitch: React.FC<IconProps>;
  export const _Twitter: React.FC<IconProps>;
  export const _Type: React.FC<IconProps>;
  export const _Umbrella: React.FC<IconProps>;
  export const _Underline: React.FC<IconProps>;
  export const _Unlock: React.FC<IconProps>;
  export const _Upload: React.FC<IconProps>;
  export const _User: React.FC<IconProps>;
  export const _UserCheck: React.FC<IconProps>;
  export const _UserMinus: React.FC<IconProps>;
  export const _UserPlus: React.FC<IconProps>;
  export const _UserX: React.FC<IconProps>;
  export const _Users: React.FC<IconProps>;
  export const _Video: React.FC<IconProps>;
  export const _VideoOff: React.FC<IconProps>;
  export const _Voicemail: React.FC<IconProps>;
  export const _Volume: React.FC<IconProps>;
  export const _Volume1: React.FC<IconProps>;
  export const _Volume2: React.FC<IconProps>;
  export const _VolumeX: React.FC<IconProps>;
  export const _Watch: React.FC<IconProps>;
  export const _Wifi: React.FC<IconProps>;
  export const _WifiOff: React.FC<IconProps>;
  export const _Wind: React.FC<IconProps>;
  export const _X: React.FC<IconProps>;
  export const _XCircle: React.FC<IconProps>;
  export const _XSquare: React.FC<IconProps>;
  export const _Youtube: React.FC<IconProps>;
  export const _Zap: React.FC<IconProps>;
  export const _ZapOff: React.FC<IconProps>;
  export const _ZoomIn: React.FC<IconProps>;
  export const _ZoomOut: React.FC<IconProps>;
}

// Additional module declarations for React 19 compatibility
declare module '@tanstack/react-query' {
  export interface QueryClientConfig {
    defaultOptions?: {
      queries?: {
        staleTime?: number;
        gcTime?: number;
        retry?: boolean | number;
        retryDelay?: number | ((_attemptIndex: number) => number);
        refetchOnWindowFocus?: boolean;
        refetchOnReconnect?: boolean;
        refetchOnMount?: boolean;
      };
      mutations?: {
        retry?: boolean | number;
        retryDelay?: number | ((_attemptIndex: number) => number);
      };
    };
  }
}

declare module 'react-hook-form' {
  export interface UseFormReturn<TFieldValues extends FieldValues = FieldValues> {
    _formState: {
      _errors: FieldErrors<TFieldValues>;
      _isSubmitting: boolean;
      _isDirty: boolean;
      _isValid: boolean;
      _isValidating: boolean;
      _isSubmitted: boolean;
      _isSubmitSuccessful: boolean;
      _submitCount: number;
      _dirtyFields: Partial<Record<keyof TFieldValues, boolean>>;
      _touchedFields: Partial<Record<keyof TFieldValues, boolean>>;
    };
  }
} 