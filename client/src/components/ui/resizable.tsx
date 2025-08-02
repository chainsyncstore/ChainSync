import { GripVertical } from &apos;lucide-react&apos;;
import * as ResizablePrimitive from &apos;react-resizable-panels&apos;;

import { cn } from &apos;@/lib/utils&apos;;

const ResizablePanelGroup = ({
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelGroup>) => (
  <ResizablePrimitive.PanelGroup
    className={cn(
      &apos;flex h-full w-full data-[panel-group-direction=vertical]:flex-col&apos;,
      className
    )}
    {...props}
  />
);

const ResizablePanel = ResizablePrimitive.Panel;

const ResizableHandle = ({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelResizeHandle> & {
  withHandle?: boolean
}) => (
  <ResizablePrimitive.PanelResizeHandle
    className={cn(
      &apos;relative flex w-px items-center justify-center bg-border _after:absolute _after:inset-y-0 _after:left-1/2 _after:w-1 after:-translate-x-1/2 focus-_visible:outline-none focus-_visible:ring-1 focus-_visible:ring-ring focus-_visible:ring-offset-1
  data-[panel-group-direction = vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:_after:left-0 data-[panel-group-direction=vertical]:_after:h-1 data-[panel-group-direction=vertical]:_after:w-full data-[panel-group-direction=vertical]:after:-translate-y-1/2 data-[panel-group-direction=vertical]:_after:translate-x-0 [&[data-panel-group-direction=vertical]>div]:rotate-90&apos;,
      className
    )}
    {...props}
  >
    {withHandle && (
      <div className=&quot;z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border&quot;>
        <GripVertical className=&quot;h-2.5 w-2.5&quot; />
      </div>
    )}
  </ResizablePrimitive.PanelResizeHandle>
);

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
