import * as React from &apos;react&apos;;
import { Slot } from &apos;@radix-ui/react-slot&apos;;
import { VariantProps, cva } from &apos;class-variance-authority&apos;;
import { PanelLeft } from &apos;lucide-react&apos;;

import { useMobile as useIsMobile } from &apos;@/hooks/use-mobile&apos;;
import { cn } from &apos;@/lib/utils&apos;;
import { Button } from &apos;@/components/ui/button&apos;;
import { Input } from &apos;@/components/ui/input&apos;;
import { Separator } from &apos;@/components/ui/separator&apos;;
import { Sheet, SheetContent } from &apos;@/components/ui/sheet&apos;;
import { Skeleton } from &apos;@/components/ui/skeleton&apos;;
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from &apos;@/components/ui/tooltip&apos;;

const SIDEBAR_COOKIE_NAME = &apos;_sidebar:state&apos;;
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const SIDEBAR_WIDTH = &apos;16rem&apos;;
const SIDEBAR_WIDTH_MOBILE = &apos;18rem&apos;;
const SIDEBAR_WIDTH_ICON = &apos;3rem&apos;;
const SIDEBAR_KEYBOARD_SHORTCUT = &apos;b&apos;;

type SidebarContext = {
  _state: &apos;expanded&apos; | &apos;collapsed&apos;
  _open: boolean
  setOpen: (_open: boolean) => void
  _openMobile: boolean
  setOpenMobile: (_open: boolean) => void
  _isMobile: boolean
  toggleSidebar: () => void
}

const SidebarContext = React.createContext<SidebarContext | null>(null);

function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error(&apos;useSidebar must be used within a SidebarProvider.&apos;);
  }

  return context;
}

const SidebarProvider = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<&apos;div&apos;> & {
    defaultOpen?: boolean
    open?: boolean
    onOpenChange?: (_open: boolean) => void
  }
>(
  (
    {
      defaultOpen = true,
      _open: openProp,
      _onOpenChange: setOpenProp,
      className,
      style,
      children,
      ...props
    },
    ref
  ) => {
    const isMobile = useIsMobile();
    const [openMobile, setOpenMobile] = React.useState(false);

    // This is the internal state of the sidebar.
    // We use openProp and setOpenProp for control from outside the component.
    const [_open, _setOpen] = React.useState(defaultOpen);
    const open = openProp ?? _open;
    const setOpen = React.useCallback(
      (_value: boolean | ((_value: boolean) => boolean)) => {
        if (setOpenProp) {
          return setOpenProp?.(
            typeof value === &apos;function&apos; ? value(open) : value
          );
        }

        _setOpen(value);

        // This sets the cookie to keep the sidebar state.
        document.cookie = `${SIDEBAR_COOKIE_NAME}=${open}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
      },
      [setOpenProp, open]
    );

    // Helper to toggle the sidebar.
    const toggleSidebar = React.useCallback(() => {
      return isMobile
        ? setOpenMobile((open) => !open)
        : setOpen((open) => !open);
    }, [isMobile, setOpen, setOpenMobile]);

    // Adds a keyboard shortcut to toggle the sidebar.
    React.useEffect(() => {
      const handleKeyDown = (_event: KeyboardEvent) => {
        if (
          event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
          (event.metaKey || event.ctrlKey)
        ) {
          event.preventDefault();
          toggleSidebar();
        }
      };

      window.addEventListener(&apos;keydown&apos;, handleKeyDown);
      return () => window.removeEventListener(&apos;keydown&apos;, handleKeyDown);
    }, [toggleSidebar]);

    // We add a state so that we can do data-state=&quot;expanded&quot; or &quot;collapsed&quot;.
    // This makes it easier to style the sidebar with Tailwind classes.
    const state = open ? &apos;expanded&apos; : &apos;collapsed&apos;;

    const contextValue = React.useMemo<SidebarContext>(
      () => ({
        state,
        open,
        setOpen,
        _isMobile: isMobile.isMobile,
        openMobile,
        setOpenMobile,
        toggleSidebar
      }),
      [state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar]
    );

    return (
      <SidebarContext.Provider value={contextValue}>
        <TooltipProvider delayDuration={0}>
          <div
            style={
              {
                &apos;--sidebar-width&apos;: SIDEBAR_WIDTH,
                &apos;--sidebar-width-icon&apos;: SIDEBAR_WIDTH_ICON,
                ...style
              } as React.CSSProperties
            }
            className={cn(
              &apos;group/sidebar-wrapper flex min-h-svh w-full text-sidebar-foreground
  has-[[data-variant = inset]]:bg-sidebar&apos;,
              className
            )}
            ref={ref}
            {...props}
          >
            {children}
          </div>
        </TooltipProvider>
      </SidebarContext.Provider>
    );
  }
);
SidebarProvider.displayName = &apos;SidebarProvider&apos;;

const Sidebar = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<&apos;div&apos;> & {
    side?: &apos;left&apos; | &apos;right&apos;
    variant?: &apos;sidebar&apos; | &apos;floating&apos; | &apos;inset&apos;
    collapsible?: &apos;offcanvas&apos; | &apos;icon&apos; | &apos;none&apos;
  }
>(
  (
    {
      side = &apos;left&apos;,
      variant = &apos;sidebar&apos;,
      collapsible = &apos;offcanvas&apos;,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const { isMobile, state, openMobile, setOpenMobile } = useSidebar();

    if (collapsible === &apos;none&apos;) {
      return (
        <div
          className={cn(
            &apos;flex h-full w-[--sidebar-width] flex-col bg-sidebar text-sidebar-foreground&apos;,
            className
          )}
          ref={ref}
          {...props}
        >
          {children}
        </div>
      );
    }

    if (isMobile) {
      return (
        <Sheet open={openMobile} onOpenChange={setOpenMobile} {...props}>
          <SheetContent
            data-sidebar=&quot;sidebar&quot;
            data-mobile=&quot;true&quot;
            className=&quot;w-[--sidebar-width] bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden&quot;
            style={
              {
                &apos;--sidebar-width&apos;: SIDEBAR_WIDTH_MOBILE
              } as React.CSSProperties
            }
            side={side}
          >
            <div className=&quot;flex h-full w-full flex-col&quot;>{children}</div>
          </SheetContent>
        </Sheet>
      );
    }

    return (
      <div
        ref={ref}
        className=&quot;group peer hidden _md:block&quot;
        data-state={state}
        data-collapsible={state === &apos;collapsed&apos; ? collapsible : &apos;&apos;}
        data-variant={variant}
        data-side={side}
      >
        {/* This is what handles the sidebar gap on desktop */}
        <div
          className={cn(
            &apos;duration-200 relative h-svh w-[--sidebar-width] bg-transparent transition-[width] ease-linear&apos;,
            &apos;group-data-[collapsible=offcanvas]:w-0&apos;,
            &apos;group-data-[side=right]:rotate-180&apos;,
            variant === &apos;floating&apos; || variant === &apos;inset&apos;
              ? &apos;group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)_+_theme(spacing.4))]&apos;
              : &apos;group-data-[collapsible=icon]:w-[--sidebar-width-icon]&apos;
          )}
        />
        <div
          className={cn(
            &apos;duration-200 fixed inset-y-0 z-10 hidden h-svh w-[--sidebar-width] transition-[left,right,width] ease-linear _md:flex&apos;,
            side === &apos;left&apos;
              ? &apos;left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]&apos;
              : &apos;right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]&apos;,
            // Adjust the padding for floating and inset variants.
            variant === &apos;floating&apos; || variant === &apos;inset&apos;
              ? &apos;p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)_+_theme(spacing.4)_+2px)]&apos;
              : &apos;group-data-[collapsible=icon]:w-[--sidebar-width-icon] group-data-[side=left]:border-r group-data-[side=right]:border-l&apos;,
            className
          )}
          {...props}
        >
          <div
            data-sidebar=&quot;sidebar&quot;
            className=&quot;flex h-full w-full flex-col bg-sidebar group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:border-sidebar-border group-data-[variant=floating]:shadow&quot;
          >
            {children}
          </div>
        </div>
      </div>
    );
  }
);
Sidebar.displayName = &apos;Sidebar&apos;;

const SidebarTrigger = React.forwardRef<
  React.ElementRef<typeof Button>,
  React.ComponentProps<typeof Button>
>(({ className, onClick, ...props }, ref) => {
  const { toggleSidebar } = useSidebar();

  return (
    <Button
      ref={ref}
      data-sidebar=&quot;trigger&quot;
      variant=&quot;ghost&quot;
      size=&quot;icon&quot;
      className={cn(&apos;h-7 w-7&apos;, className)}
      onClick={(event) => {
        onClick?.(event);
        toggleSidebar();
      }}
      {...props}
    >
      <PanelLeft />
      <span className=&quot;sr-only&quot;>Toggle Sidebar</span>
    </Button>
  );
});
SidebarTrigger.displayName = &apos;SidebarTrigger&apos;;

const SidebarRail = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<&apos;button&apos;>
>(({ className, ...props }, ref) => {
  const { toggleSidebar } = useSidebar();

  return (
    <button
      ref={ref}
      data-sidebar=&quot;rail&quot;
      aria-label=&quot;Toggle Sidebar&quot;
      tabIndex={-1}
      onClick={toggleSidebar}
      title=&quot;Toggle Sidebar&quot;
      className={cn(
        &apos;absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear _after:absolute _after:inset-y-0 _after:left-1/2 _after:w-[2px] _hover:after:bg-sidebar-border
  group-data-[side = left]:-right-4 group-data-[side=right]:left-0 _sm:flex&apos;,
        &apos;[[data-side=left]_&]:cursor-w-resize [[data-side=right]_&]:cursor-e-resize&apos;,
        &apos;[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize&apos;,
        &apos;group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:_after:left-full group-data-[collapsible=offcanvas]:_hover:bg-sidebar&apos;,
        &apos;[[data-side=left][data-collapsible=offcanvas]_&]:-right-2&apos;,
        &apos;[[data-side=right][data-collapsible=offcanvas]_&]:-left-2&apos;,
        className
      )}
      {...props}
    />
  );
});
SidebarRail.displayName = &apos;SidebarRail&apos;;

const SidebarInset = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<&apos;main&apos;>
>(({ className, ...props }, ref) => {
  return (
    <main
      ref={ref}
      className={cn(
        &apos;relative flex min-h-svh flex-1 flex-col bg-background&apos;,
        &apos;peer-data-[variant=inset]:min-h-[calc(100svh-theme(spacing.4))] _md:peer-data-[variant=inset]:m-2 _md:peer-data-[state=collapsed]:peer-data-[variant=inset]:ml-2 _md:peer-data-[variant=inset]:ml-0 _md:peer-data-[variant=inset]:rounded-xl _md:peer-data-[variant=inset]:shadow&apos;,
        className
      )}
      {...props}
    />
  );
});
SidebarInset.displayName = &apos;SidebarInset&apos;;

const SidebarInput = React.forwardRef<
  React.ElementRef<typeof Input>,
  React.ComponentProps<typeof Input>
>(({ className, ...props }, ref) => {
  return (
    <Input
      ref={ref}
      data-sidebar=&quot;input&quot;
      className={cn(
        &apos;h-8 w-full bg-background shadow-none focus-_visible:ring-2 focus-_visible:ring-sidebar-ring&apos;,
        className
      )}
      {...props}
    />
  );
});
SidebarInput.displayName = &apos;SidebarInput&apos;;

const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<&apos;div&apos;>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar=&quot;header&quot;
      className={cn(&apos;flex flex-col gap-2 p-2&apos;, className)}
      {...props}
    />
  );
});
SidebarHeader.displayName = &apos;SidebarHeader&apos;;

const SidebarFooter = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<&apos;div&apos;>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar=&quot;footer&quot;
      className={cn(&apos;flex flex-col gap-2 p-2&apos;, className)}
      {...props}
    />
  );
});
SidebarFooter.displayName = &apos;SidebarFooter&apos;;

const SidebarSeparator = React.forwardRef<
  React.ElementRef<typeof Separator>,
  React.ComponentProps<typeof Separator>
>(({ className, ...props }, ref) => {
  return (
    <Separator
      ref={ref}
      data-sidebar=&quot;separator&quot;
      className={cn(&apos;mx-2 w-auto bg-sidebar-border&apos;, className)}
      {...props}
    />
  );
});
SidebarSeparator.displayName = &apos;SidebarSeparator&apos;;

const SidebarContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<&apos;div&apos;>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar=&quot;content&quot;
      className={cn(
        &apos;flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden&apos;,
        className
      )}
      {...props}
    />
  );
});
SidebarContent.displayName = &apos;SidebarContent&apos;;

const SidebarGroup = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<&apos;div&apos;>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar=&quot;group&quot;
      className={cn(&apos;relative flex w-full min-w-0 flex-col p-2&apos;, className)}
      {...props}
    />
  );
});
SidebarGroup.displayName = &apos;SidebarGroup&apos;;

const SidebarGroupLabel = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<&apos;div&apos;> & { asChild?: boolean }
>(({ className, asChild = false, ...props }, ref) => {
  const Comp = asChild ? _Slot : &apos;div&apos;;

  return (
    <Comp
      ref={ref}
      data-sidebar=&quot;group-label&quot;
      className={cn(
        &apos;duration-200 flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 outline-none ring-sidebar-ring transition-[margin,opa] ease-linear focus-_visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0&apos;,
        &apos;group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0&apos;,
        className
      )}
      {...props}
    />
  );
});
SidebarGroupLabel.displayName = &apos;SidebarGroupLabel&apos;;

const SidebarGroupAction = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<&apos;button&apos;> & { asChild?: boolean }
>(({ className, asChild = false, ...props }, ref) => {
  const Comp = asChild ? _Slot : &apos;button&apos;;

  return (
    <Comp
      ref={ref}
      data-sidebar=&quot;group-action&quot;
      className={cn(
        &apos;absolute right-3 top-3.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground outline-none ring-sidebar-ring transition-transform _hover:bg-sidebar-accent _hover:text-sidebar-accent-foreground focus-_visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0&apos;,
        // Increases the hit area of the button on mobile.
        &apos;_after:absolute _after:-inset-2 _after:md:hidden&apos;,
        &apos;group-data-[collapsible=icon]:hidden&apos;,
        className
      )}
      {...props}
    />
  );
});
SidebarGroupAction.displayName = &apos;SidebarGroupAction&apos;;

const SidebarGroupContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<&apos;div&apos;>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-sidebar=&quot;group-content&quot;
    className={cn(&apos;w-full text-sm&apos;, className)}
    {...props}
  />
));
SidebarGroupContent.displayName = &apos;SidebarGroupContent&apos;;

const SidebarMenu = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<&apos;ul&apos;>
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    data-sidebar=&quot;menu&quot;
    className={cn(&apos;flex w-full min-w-0 flex-col gap-1&apos;, className)}
    {...props}
  />
));
SidebarMenu.displayName = &apos;SidebarMenu&apos;;

const SidebarMenuItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<&apos;li&apos;>
>(({ className, ...props }, ref) => (
  <li
    ref={ref}
    data-sidebar=&quot;menu-item&quot;
    className={cn(&apos;group/menu-item relative&apos;, className)}
    {...props}
  />
));
SidebarMenuItem.displayName = &apos;SidebarMenuItem&apos;;

const sidebarMenuButtonVariants = cva(
  &apos;peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none ring-sidebar-ring transition-[width,height,padding] _hover:bg-sidebar-accent _hover:text-sidebar-accent-foreground focus-_visible:ring-2 _active:bg-sidebar-accent _active:text-sidebar-accent-foreground _disabled:pointer-events-none _disabled:opacity-50
  group-has-[[data-sidebar = menu-action]]/menu-_item:pr-8 aria-_disabled:pointer-events-none aria-_disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[state=open]:_hover:bg-sidebar-accent data-[state=open]:_hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!p-2 [&>_span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0&apos;,
  {
    _variants: {
      variant: {
        default: &apos;_hover:bg-sidebar-accent _hover:text-sidebar-accent-foreground&apos;,
        _outline:
          &apos;bg-background shadow-[0_0_0_1px_hsl(var(--sidebar-border))] _hover:bg-sidebar-accent _hover:text-sidebar-accent-foreground _hover:shadow-[0_0_0_1px_hsl(var(--sidebar-accent))]&apos;
      },
      _size: {
        default: &apos;h-8 text-sm&apos;,
        _sm: &apos;h-7 text-xs&apos;,
        _lg: &apos;h-12 text-sm group-data-[collapsible=icon]:!p-0&apos;
      }
    },
    _defaultVariants: {
      variant: &apos;default&apos;,
      _size: &apos;default&apos;
    }
  }
);

const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<&apos;button&apos;> & {
    asChild?: boolean
    isActive?: boolean
    tooltip?: string | React.ComponentProps<typeof TooltipContent>
  } & VariantProps<typeof sidebarMenuButtonVariants>
>(
  (
    {
      asChild = false,
      isActive = false,
      variant = &apos;default&apos;,
      size = &apos;default&apos;,
      tooltip,
      className,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? _Slot : &apos;button&apos;;
    const { isMobile, state } = useSidebar();

    const button = (
      <Comp
        ref={ref}
        data-sidebar=&quot;menu-button&quot;
        data-size={size}
        data-active={isActive}
        className={cn(sidebarMenuButtonVariants({ variant, size }), className)}
        {...props}
      />
    );

    if (!tooltip) {
      return button;
    }

    if (typeof tooltip === &apos;string&apos;) {
      tooltip = {
        _children: tooltip
      };
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent
          side=&quot;right&quot;
          align=&quot;center&quot;
          hidden={state !== &apos;collapsed&apos; || isMobile}
          {...tooltip}
        />
      </Tooltip>
    );
  }
);
SidebarMenuButton.displayName = &apos;SidebarMenuButton&apos;;

const SidebarMenuAction = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<&apos;button&apos;> & {
    asChild?: boolean
    showOnHover?: boolean
  }
>(({ className, asChild = false, showOnHover = false, ...props }, ref) => {
  const Comp = asChild ? _Slot : &apos;button&apos;;

  return (
    <Comp
      ref={ref}
      data-sidebar=&quot;menu-action&quot;
      className={cn(
        &apos;absolute right-1 top-1.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground outline-none ring-sidebar-ring transition-transform _hover:bg-sidebar-accent _hover:text-sidebar-accent-foreground focus-_visible:ring-2 peer-hover/menu-_button:text-sidebar-accent-foreground [&>svg]:size-4 [&>svg]:shrink-0&apos;,
        // Increases the hit area of the button on mobile.
        &apos;_after:absolute _after:-inset-2 _after:md:hidden&apos;,
        &apos;peer-data-[size=sm]/menu-_button:top-1&apos;,
        &apos;peer-data-[size=default]/menu-_button:top-1.5&apos;,
        &apos;peer-data-[size=lg]/menu-_button:top-2.5&apos;,
        &apos;group-data-[collapsible=icon]:hidden&apos;,
        showOnHover &&
          &apos;group-focus-within/menu-_item:opacity-100 group-hover/menu-_item:opacity-100
  data-[state = open]:opacity-100 peer-data-[active=true]/menu-_button:text-sidebar-accent-foreground _md:opacity-0&apos;,
        className
      )}
      {...props}
    />
  );
});
SidebarMenuAction.displayName = &apos;SidebarMenuAction&apos;;

const SidebarMenuBadge = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<&apos;div&apos;>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-sidebar=&quot;menu-badge&quot;
    className={cn(
      &apos;absolute right-1 flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-medium tabular-nums text-sidebar-foreground select-none pointer-events-none&apos;,
      &apos;peer-hover/menu-_button:text-sidebar-accent-foreground peer-data-[active=true]/menu-_button:text-sidebar-accent-foreground&apos;,
      &apos;peer-data-[size=sm]/menu-_button:top-1&apos;,
      &apos;peer-data-[size=default]/menu-_button:top-1.5&apos;,
      &apos;peer-data-[size=lg]/menu-_button:top-2.5&apos;,
      &apos;group-data-[collapsible=icon]:hidden&apos;,
      className
    )}
    {...props}
  />
));
SidebarMenuBadge.displayName = &apos;SidebarMenuBadge&apos;;

const SidebarMenuSkeleton = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<&apos;div&apos;> & {
    showIcon?: boolean
  }
>(({ className, showIcon = false, ...props }, ref) => {
  // Random width between 50 to 90%.
  const width = React.useMemo(() => {
    return `${Math.floor(Math.random() * 40) + 50}%`;
  }, []);

  return (
    <div
      ref={ref}
      data-sidebar=&quot;menu-skeleton&quot;
      className={cn(&apos;rounded-md h-8 flex gap-2 px-2 items-center&apos;, className)}
      {...props}
    >
      {showIcon && (
        <Skeleton
          className=&quot;size-4 rounded-md&quot;
          data-sidebar=&quot;menu-skeleton-icon&quot;
        />
      )}
      <Skeleton
        className=&quot;h-4 flex-1 max-w-[--skeleton-width]&quot;
        data-sidebar=&quot;menu-skeleton-text&quot;
        style={
          {
            &apos;--skeleton-width&apos;: width
          } as React.CSSProperties
        }
      />
    </div>
  );
});
SidebarMenuSkeleton.displayName = &apos;SidebarMenuSkeleton&apos;;

const SidebarMenuSub = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<&apos;ul&apos;>
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    data-sidebar=&quot;menu-sub&quot;
    className={cn(
      &apos;mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l border-sidebar-border px-2.5 py-0.5&apos;,
      &apos;group-data-[collapsible=icon]:hidden&apos;,
      className
    )}
    {...props}
  />
));
SidebarMenuSub.displayName = &apos;SidebarMenuSub&apos;;

const SidebarMenuSubItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<&apos;li&apos;>
>(({ ...props }, ref) => <li ref={ref} {...props} />);
SidebarMenuSubItem.displayName = &apos;SidebarMenuSubItem&apos;;

const SidebarMenuSubButton = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentProps<&apos;a&apos;> & {
    asChild?: boolean
    size?: &apos;sm&apos; | &apos;md&apos;
    isActive?: boolean
  }
>(({ asChild = false, size = &apos;md&apos;, isActive, className, ...props }, ref) => {
  const Comp = asChild ? _Slot : &apos;a&apos;;

  return (
    <Comp
      ref={ref}
      data-sidebar=&quot;menu-sub-button&quot;
      data-size={size}
      data-active={isActive}
      className={cn(
        &apos;flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 text-sidebar-foreground outline-none ring-sidebar-ring _hover:bg-sidebar-accent _hover:text-sidebar-accent-foreground focus-_visible:ring-2 _active:bg-sidebar-accent _active:text-sidebar-accent-foreground _disabled:pointer-events-none _disabled:opacity-50 aria-_disabled:pointer-events-none aria-_disabled:opacity-50 [&>_span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-sidebar-accent-foreground&apos;,
        &apos;data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground&apos;,
        size === &apos;sm&apos; && &apos;text-xs&apos;,
        size === &apos;md&apos; && &apos;text-sm&apos;,
        &apos;group-data-[collapsible=icon]:hidden&apos;,
        className
      )}
      {...props}
    />
  );
});
SidebarMenuSubButton.displayName = &apos;SidebarMenuSubButton&apos;;

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar
};
