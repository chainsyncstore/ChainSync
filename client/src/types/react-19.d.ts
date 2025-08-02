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
  export const useInsertionEffect: (effect: () => void | (() => void), deps?: any[]) => void;
  export const useDeferredValue: <T>(value: T) => T;
  export const useTransition: () => [boolean, (callback: () => void) => void];
  export const useId: () => string;
  export const useSyncExternalStore: <T>(
    subscribe: (callback: () => void) => () => void,
    getSnapshot: () => T,
    getServerSnapshot?: () => T
  ) => T;
  export const use: <T>(promise: Promise<T>) => T;
  export const startTransition: (callback: () => void) => void;
  export const flushSync: <T>(fn: () => T) => T;
}

// Global type override to fix React 19 bigint issues
declare global {
  namespace JSX {
    interface Element extends React.ReactElement<any, any> { }
    interface IntrinsicElements extends React.JSX.IntrinsicElements { }
    interface ElementChildrenAttribute {
      children: {}; // This helps with children typing
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
    children: ReactNode;
  }
  
  export const Route: React.FC<RouteProps>;
  export const Switch: React.FC<SwitchProps>;
}

// Lucide React icon types - Fixed for React 19 compatibility
declare module 'lucide-react' {
  import { SVGProps } from 'react';
  
  export interface IconProps extends SVGProps<SVGSVGElement> {
    size?: number | string;
    absoluteStrokeWidth?: boolean;
  }
  
  export const LucideIcon: React.FC<IconProps>;
  export const LucideProps: IconProps;
  
  // Common icons
  export const Home: React.FC<IconProps>;
  export const Settings: React.FC<IconProps>;
  export const User: React.FC<IconProps>;
  export const Search: React.FC<IconProps>;
  export const Plus: React.FC<IconProps>;
  export const Edit: React.FC<IconProps>;
  export const Trash: React.FC<IconProps>;
  export const Eye: React.FC<IconProps>;
  export const EyeOff: React.FC<IconProps>;
  export const ChevronDown: React.FC<IconProps>;
  export const ChevronUp: React.FC<IconProps>;
  export const ChevronLeft: React.FC<IconProps>;
  export const ChevronRight: React.FC<IconProps>;
  export const Menu: React.FC<IconProps>;
  export const X: React.FC<IconProps>;
  export const Check: React.FC<IconProps>;
  export const AlertCircle: React.FC<IconProps>;
  export const Info: React.FC<IconProps>;
  export const Warning: React.FC<IconProps>;
  export const Download: React.FC<IconProps>;
  export const Upload: React.FC<IconProps>;
  export const FileText: React.FC<IconProps>;
  export const BarChart3: React.FC<IconProps>;
  export const PieChart: React.FC<IconProps>;
  export const TrendingUp: React.FC<IconProps>;
  export const TrendingDown: React.FC<IconProps>;
  export const DollarSign: React.FC<IconProps>;
  export const ShoppingCart: React.FC<IconProps>;
  export const Package: React.FC<IconProps>;
  export const Users: React.FC<IconProps>;
  export const Store: React.FC<IconProps>;
  export const CreditCard: React.FC<IconProps>;
  export const Receipt: React.FC<IconProps>;
  export const Calendar: React.FC<IconProps>;
  export const Clock: React.FC<IconProps>;
  export const MapPin: React.FC<IconProps>;
  export const Phone: React.FC<IconProps>;
  export const Mail: React.FC<IconProps>;
  export const Lock: React.FC<IconProps>;
  export const Unlock: React.FC<IconProps>;
  export const Key: React.FC<IconProps>;
  export const Shield: React.FC<IconProps>;
  export const Bell: React.FC<IconProps>;
  export const Star: React.FC<IconProps>;
  export const Heart: React.FC<IconProps>;
  export const ThumbsUp: React.FC<IconProps>;
  export const ThumbsDown: React.FC<IconProps>;
  export const MessageCircle: React.FC<IconProps>;
  export const Send: React.FC<IconProps>;
  export const Copy: React.FC<IconProps>;
  export const Link: React.FC<IconProps>;
  export const ExternalLink: React.FC<IconProps>;
  export const Share: React.FC<IconProps>;
  export const Bookmark: React.FC<IconProps>;
  export const Tag: React.FC<IconProps>;
  export const Filter: React.FC<IconProps>;
  export const SortAsc: React.FC<IconProps>;
  export const SortDesc: React.FC<IconProps>;
  export const Grid: React.FC<IconProps>;
  export const List: React.FC<IconProps>;
  export const Maximize: React.FC<IconProps>;
  export const Minimize: React.FC<IconProps>;
  export const RotateCcw: React.FC<IconProps>;
  export const RefreshCw: React.FC<IconProps>;
  export const Loader: React.FC<IconProps>;
  export const Zap: React.FC<IconProps>;
  export const Battery: React.FC<IconProps>;
  export const Wifi: React.FC<IconProps>;
  export const Signal: React.FC<IconProps>;
  export const Volume: React.FC<IconProps>;
  export const VolumeX: React.FC<IconProps>;
  export const Volume1: React.FC<IconProps>;
  export const Volume2: React.FC<IconProps>;
  export const Play: React.FC<IconProps>;
  export const Pause: React.FC<IconProps>;
  export const Stop: React.FC<IconProps>;
  export const SkipBack: React.FC<IconProps>;
  export const SkipForward: React.FC<IconProps>;
  export const Rewind: React.FC<IconProps>;
  export const FastForward: React.FC<IconProps>;
  export const Repeat: React.FC<IconProps>;
  export const Shuffle: React.FC<IconProps>;
  export const Mic: React.FC<IconProps>;
  export const MicOff: React.FC<IconProps>;
  export const Video: React.FC<IconProps>;
  export const VideoOff: React.FC<IconProps>;
  export const Camera: React.FC<IconProps>;
  export const Image: React.FC<IconProps>;
  export const File: React.FC<IconProps>;
  export const Folder: React.FC<IconProps>;
  export const FolderOpen: React.FC<IconProps>;
  export const Save: React.FC<IconProps>;
  export const Printer: React.FC<IconProps>;
  export const Scissors: React.FC<IconProps>;
  export const Paperclip: React.FC<IconProps>;
  export const Archive: React.FC<IconProps>;
  export const Inbox: React.FC<IconProps>;
  export const Send: React.FC<IconProps>;
  export const Mail: React.FC<IconProps>;
  export const Reply: React.FC<IconProps>;
  export const Forward: React.FC<IconProps>;
  export const Trash2: React.FC<IconProps>;
  export const Archive: React.FC<IconProps>;
  export const Flag: React.FC<IconProps>;
  export const Bookmark: React.FC<IconProps>;
  export const Tag: React.FC<IconProps>;
  export const Hash: React.FC<IconProps>;
  export const AtSign: React.FC<IconProps>;
  export const Percent: React.FC<IconProps>;
  export const Hash: React.FC<IconProps>;
  export const DollarSign: React.FC<IconProps>;
  export const Euro: React.FC<IconProps>;
  export const PoundSterling: React.FC<IconProps>;
  export const Yen: React.FC<IconProps>;
  export const Bitcoin: React.FC<IconProps>;
  export const Activity: React.FC<IconProps>;
  export const Airplay: React.FC<IconProps>;
  export const AlertTriangle: React.FC<IconProps>;
  export const Anchor: React.FC<IconProps>;
  export const Aperture: React.FC<IconProps>;
  export const ArrowDown: React.FC<IconProps>;
  export const ArrowLeft: React.FC<IconProps>;
  export const ArrowRight: React.FC<IconProps>;
  export const ArrowUp: React.FC<IconProps>;
  export const Award: React.FC<IconProps>;
  export const Book: React.FC<IconProps>;
  export const Box: React.FC<IconProps>;
  export const Briefcase: React.FC<IconProps>;
  export const Camera: React.FC<IconProps>;
  export const Cast: React.FC<IconProps>;
  export const Chrome: React.FC<IconProps>;
  export const Circle: React.FC<IconProps>;
  export const Cloud: React.FC<IconProps>;
  export const Code: React.FC<IconProps>;
  export const Command: React.FC<IconProps>;
  export const Compass: React.FC<IconProps>;
  export const CornerDownLeft: React.FC<IconProps>;
  export const CornerDownRight: React.FC<IconProps>;
  export const CornerLeftDown: React.FC<IconProps>;
  export const CornerLeftUp: React.FC<IconProps>;
  export const CornerRightDown: React.FC<IconProps>;
  export const CornerRightUp: React.FC<IconProps>;
  export const CornerUpLeft: React.FC<IconProps>;
  export const CornerUpRight: React.FC<IconProps>;
  export const Cpu: React.FC<IconProps>;
  export const Database: React.FC<IconProps>;
  export const Disc: React.FC<IconProps>;
  export const Divide: React.FC<IconProps>;
  export const DivideCircle: React.FC<IconProps>;
  export const DivideSquare: React.FC<IconProps>;
  export const Download: React.FC<IconProps>;
  export const Droplets: React.FC<IconProps>;
  export const Edit: React.FC<IconProps>;
  export const Edit2: React.FC<IconProps>;
  export const Edit3: React.FC<IconProps>;
  export const Eye: React.FC<IconProps>;
  export const EyeOff: React.FC<IconProps>;
  export const Facebook: React.FC<IconProps>;
  export const FastForward: React.FC<IconProps>;
  export const Feather: React.FC<IconProps>;
  export const Figma: React.FC<IconProps>;
  export const File: React.FC<IconProps>;
  export const Film: React.FC<IconProps>;
  export const Filter: React.FC<IconProps>;
  export const Flag: React.FC<IconProps>;
  export const Folder: React.FC<IconProps>;
  export const FolderMinus: React.FC<IconProps>;
  export const FolderPlus: React.FC<IconProps>;
  export const Framer: React.FC<IconProps>;
  export const Frown: React.FC<IconProps>;
  export const Gift: React.FC<IconProps>;
  export const GitBranch: React.FC<IconProps>;
  export const GitCommit: React.FC<IconProps>;
  export const GitMerge: React.FC<IconProps>;
  export const GitPullRequest: React.FC<IconProps>;
  export const Github: React.FC<IconProps>;
  export const Gitlab: React.FC<IconProps>;
  export const Globe: React.FC<IconProps>;
  export const Grid: React.FC<IconProps>;
  export const HardDrive: React.FC<IconProps>;
  export const Hash: React.FC<IconProps>;
  export const Headphones: React.FC<IconProps>;
  export const Heart: React.FC<IconProps>;
  export const HelpCircle: React.FC<IconProps>;
  export const Hexagon: React.FC<IconProps>;
  export const Home: React.FC<IconProps>;
  export const Image: React.FC<IconProps>;
  export const Inbox: React.FC<IconProps>;
  export const Info: React.FC<IconProps>;
  export const Instagram: React.FC<IconProps>;
  export const Italic: React.FC<IconProps>;
  export const Key: React.FC<IconProps>;
  export const Layers: React.FC<IconProps>;
  export const Layout: React.FC<IconProps>;
  export const LifeBuoy: React.FC<IconProps>;
  export const Link: React.FC<IconProps>;
  export const Link2: React.FC<IconProps>;
  export const Linkedin: React.FC<IconProps>;
  export const List: React.FC<IconProps>;
  export const Loader: React.FC<IconProps>;
  export const Lock: React.FC<IconProps>;
  export const LogIn: React.FC<IconProps>;
  export const LogOut: React.FC<IconProps>;
  export const Mail: React.FC<IconProps>;
  export const MapPin: React.FC<IconProps>;
  export const Maximize: React.FC<IconProps>;
  export const Maximize2: React.FC<IconProps>;
  export const Meh: React.FC<IconProps>;
  export const Menu: React.FC<IconProps>;
  export const MessageCircle: React.FC<IconProps>;
  export const MessageSquare: React.FC<IconProps>;
  export const Mic: React.FC<IconProps>;
  export const MicOff: React.FC<IconProps>;
  export const Minimize: React.FC<IconProps>;
  export const Minimize2: React.FC<IconProps>;
  export const Monitor: React.FC<IconProps>;
  export const Moon: React.FC<IconProps>;
  export const MoreHorizontal: React.FC<IconProps>;
  export const MoreVertical: React.FC<IconProps>;
  export const Move: React.FC<IconProps>;
  export const Music: React.FC<IconProps>;
  export const Navigation: React.FC<IconProps>;
  export const Navigation2: React.FC<IconProps>;
  export const Octagon: React.FC<IconProps>;
  export const Package: React.FC<IconProps>;
  export const Paperclip: React.FC<IconProps>;
  export const Pause: React.FC<IconProps>;
  export const PauseCircle: React.FC<IconProps>;
  export const Percent: React.FC<IconProps>;
  export const Phone: React.FC<IconProps>;
  export const PhoneCall: React.FC<IconProps>;
  export const PhoneForwarded: React.FC<IconProps>;
  export const PhoneIncoming: React.FC<IconProps>;
  export const PhoneMissed: React.FC<IconProps>;
  export const PhoneOff: React.FC<IconProps>;
  export const PhoneOutgoing: React.FC<IconProps>;
  export const PieChart: React.FC<IconProps>;
  export const Play: React.FC<IconProps>;
  export const PlayCircle: React.FC<IconProps>;
  export const Plus: React.FC<IconProps>;
  export const PlusCircle: React.FC<IconProps>;
  export const PlusSquare: React.FC<IconProps>;
  export const Pocket: React.FC<IconProps>;
  export const Power: React.FC<IconProps>;
  export const Printer: React.FC<IconProps>;
  export const Radio: React.FC<IconProps>;
  export const RefreshCcw: React.FC<IconProps>;
  export const RefreshCw: React.FC<IconProps>;
  export const Repeat: React.FC<IconProps>;
  export const Rewind: React.FC<IconProps>;
  export const RotateCcw: React.FC<IconProps>;
  export const RotateCw: React.FC<IconProps>;
  export const Rss: React.FC<IconProps>;
  export const Save: React.FC<IconProps>;
  export const Scissors: React.FC<IconProps>;
  export const Search: React.FC<IconProps>;
  export const Send: React.FC<IconProps>;
  export const Server: React.FC<IconProps>;
  export const Settings: React.FC<IconProps>;
  export const Share: React.FC<IconProps>;
  export const Share2: React.FC<IconProps>;
  export const Shield: React.FC<IconProps>;
  export const ShieldOff: React.FC<IconProps>;
  export const ShoppingBag: React.FC<IconProps>;
  export const ShoppingCart: React.FC<IconProps>;
  export const Shuffle: React.FC<IconProps>;
  export const Sidebar: React.FC<IconProps>;
  export const SkipBack: React.FC<IconProps>;
  export const SkipForward: React.FC<IconProps>;
  export const Slack: React.FC<IconProps>;
  export const Slash: React.FC<IconProps>;
  export const Sliders: React.FC<IconProps>;
  export const Smartphone: React.FC<IconProps>;
  export const Speaker: React.FC<IconProps>;
  export const Square: React.FC<IconProps>;
  export const Star: React.FC<IconProps>;
  export const StopCircle: React.FC<IconProps>;
  export const Sun: React.FC<IconProps>;
  export const Sunrise: React.FC<IconProps>;
  export const Sunset: React.FC<IconProps>;
  export const Tablet: React.FC<IconProps>;
  export const Tag: React.FC<IconProps>;
  export const Target: React.FC<IconProps>;
  export const Terminal: React.FC<IconProps>;
  export const Thermometer: React.FC<IconProps>;
  export const ThumbsDown: React.FC<IconProps>;
  export const ThumbsUp: React.FC<IconProps>;
  export const ToggleLeft: React.FC<IconProps>;
  export const ToggleRight: React.FC<IconProps>;
  export const Tool: React.FC<IconProps>;
  export const Trash: React.FC<IconProps>;
  export const Trash2: React.FC<IconProps>;
  export const TrendingDown: React.FC<IconProps>;
  export const TrendingUp: React.FC<IconProps>;
  export const Triangle: React.FC<IconProps>;
  export const Truck: React.FC<IconProps>;
  export const Tv: React.FC<IconProps>;
  export const Twitch: React.FC<IconProps>;
  export const Twitter: React.FC<IconProps>;
  export const Type: React.FC<IconProps>;
  export const Umbrella: React.FC<IconProps>;
  export const Underline: React.FC<IconProps>;
  export const Unlock: React.FC<IconProps>;
  export const Upload: React.FC<IconProps>;
  export const User: React.FC<IconProps>;
  export const UserCheck: React.FC<IconProps>;
  export const UserMinus: React.FC<IconProps>;
  export const UserPlus: React.FC<IconProps>;
  export const UserX: React.FC<IconProps>;
  export const Users: React.FC<IconProps>;
  export const Video: React.FC<IconProps>;
  export const VideoOff: React.FC<IconProps>;
  export const Voicemail: React.FC<IconProps>;
  export const Volume: React.FC<IconProps>;
  export const Volume1: React.FC<IconProps>;
  export const Volume2: React.FC<IconProps>;
  export const VolumeX: React.FC<IconProps>;
  export const Watch: React.FC<IconProps>;
  export const Wifi: React.FC<IconProps>;
  export const WifiOff: React.FC<IconProps>;
  export const Wind: React.FC<IconProps>;
  export const X: React.FC<IconProps>;
  export const XCircle: React.FC<IconProps>;
  export const XSquare: React.FC<IconProps>;
  export const Youtube: React.FC<IconProps>;
  export const Zap: React.FC<IconProps>;
  export const ZapOff: React.FC<IconProps>;
  export const ZoomIn: React.FC<IconProps>;
  export const ZoomOut: React.FC<IconProps>;
}

// Additional module declarations for React 19 compatibility
declare module '@tanstack/react-query' {
  export interface QueryClientConfig {
    defaultOptions?: {
      queries?: {
        staleTime?: number;
        gcTime?: number;
        retry?: boolean | number;
        retryDelay?: number | ((attemptIndex: number) => number);
        refetchOnWindowFocus?: boolean;
        refetchOnReconnect?: boolean;
        refetchOnMount?: boolean;
      };
      mutations?: {
        retry?: boolean | number;
        retryDelay?: number | ((attemptIndex: number) => number);
      };
    };
  }
}

declare module 'react-hook-form' {
  export interface UseFormReturn<TFieldValues extends FieldValues = FieldValues> {
    formState: {
      errors: FieldErrors<TFieldValues>;
      isSubmitting: boolean;
      isDirty: boolean;
      isValid: boolean;
      isValidating: boolean;
      isSubmitted: boolean;
      isSubmitSuccessful: boolean;
      submitCount: number;
      dirtyFields: Partial<Record<keyof TFieldValues, boolean>>;
      touchedFields: Partial<Record<keyof TFieldValues, boolean>>;
    };
  }
} 