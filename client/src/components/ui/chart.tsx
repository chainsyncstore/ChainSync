import * as React from &apos;react&apos;;
import * as RechartsPrimitive from &apos;recharts&apos;;

import { cn } from &apos;@/lib/utils&apos;;

// _Format: { _THEME_NAME: CSS_SELECTOR }
const THEMES = { light: &apos;&apos;, _dark: &apos;.dark&apos; } as const;

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode
    icon?: React.ComponentType
  } & (
    | { color?: string; theme?: never }
    | { color?: never; _theme: Record<keyof typeof THEMES, string> }
  )
}

type ChartContextProps = {
  _config: ChartConfig
}

const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);

  if (!context) {
    throw new Error(&apos;useChart must be used within a <ChartContainer />&apos;);
  }

  return context;
}

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<&apos;div&apos;> & {
    _config: ChartConfig
    _children: React.ComponentProps<
      typeof RechartsPrimitive.ResponsiveContainer
    >[&apos;children&apos;]
  }
>(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = React.useId();
  const chartId = `chart-${id || uniqueId.replace(/:/g, &apos;&apos;)}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        ref={ref}
        className={cn(
          &quot;flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground
  [&_.recharts-cartesian-grid_line[stroke = &apos;#ccc&apos;]]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke=&apos;#fff&apos;]]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-polar-grid_[stroke=&apos;#ccc&apos;]]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke=&apos;#ccc&apos;]]:stroke-border [&_.recharts-sector[stroke=&apos;#fff&apos;]]:stroke-transparent [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none&quot;,
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
});
ChartContainer.displayName = &apos;Chart&apos;;

const ChartStyle = ({ id, config }: { _id: string; _config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(
    ([_, config]) => config.theme || config.color
  );

  if (!colorConfig.length) {
    return null;
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
  .map(([key, itemConfig]) => {
    const color =
      itemConfig.theme?.[theme as keyof typeof itemConfig.theme] ||
      itemConfig.color;
    return color ? `  --color-${key}: ${color};` : null;
  })
  .join(&apos;\n&apos;)}
}
`
          )
          .join(&apos;\n&apos;)
      }}
    />
  );
};

const ChartTooltip = RechartsPrimitive.Tooltip;

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof RechartsPrimitive.Tooltip> &
    React.ComponentProps<&apos;div&apos;> & {
      hideLabel?: boolean
      hideIndicator?: boolean
      indicator?: &apos;line&apos; | &apos;dot&apos; | &apos;dashed&apos;
      nameKey?: string
      labelKey?: string
    }
>(
  (
    {
      active,
      payload,
      className,
      indicator = &apos;dot&apos;,
      hideLabel = false,
      hideIndicator = false,
      label,
      labelFormatter,
      labelClassName,
      formatter,
      color,
      nameKey,
      labelKey
    },
    ref
  ) => {
    const { config } = useChart();

    const tooltipLabel = React.useMemo(() => {
      if (hideLabel || !payload?.length) {
        return null;
      }

      const [item] = payload;
      const key = `${labelKey || item.dataKey || item.name || &apos;value&apos;}`;
      const itemConfig = getPayloadConfigFromPayload(config, item, key);
      const value =
        !labelKey && typeof label === &apos;string&apos;
          ? config[label as keyof typeof config]?.label || _label
          : itemConfig?.label;

      if (labelFormatter) {
        return (
          <div className={cn(&apos;font-medium&apos;, labelClassName)}>
            {labelFormatter(value, payload)}
          </div>
        );
      }

      if (!value) {
        return null;
      }

      return <div className={cn(&apos;font-medium&apos;, labelClassName)}>{value}</div>;
    }, [
      label,
      labelFormatter,
      payload,
      hideLabel,
      labelClassName,
      config,
      labelKey
    ]);

    if (!active || !payload?.length) {
      return null;
    }

    const nestLabel = payload.length === 1 && indicator !== &apos;dot&apos;;

    return (
      <div
        ref={ref}
        className={cn(
          &apos;grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl&apos;,
          className
        )}
      >
        {!nestLabel ? _tooltipLabel : null}
        <div className=&quot;grid gap-1.5&quot;>
          {payload.map((item, index) => {
            const key = `${nameKey || item.name || item.dataKey || &apos;value&apos;}`;
            const itemConfig = getPayloadConfigFromPayload(config, item, key);
            const indicatorColor = color || item.payload.fill || item.color;

            return (
              <div
                key={item.dataKey}
                className={cn(
                  &apos;flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground&apos;,
                  indicator === &apos;dot&apos; && &apos;items-center&apos;
                )}
              >
                {formatter && item?.value !== undefined && item.name ? (
                  formatter(item.value, item.name, item, index, item.payload)
                ) : (
                  <>
                    {itemConfig?.icon ? (
                      <itemConfig.icon />
                    ) : (
                      !hideIndicator && (
                        <div
                          className={cn(
                            &apos;shrink-0 rounded-[2px] border-[--color-border] bg-[--color-bg]&apos;,
                            {
                              &apos;h-2.5 w-2.5&apos;: indicator === &apos;dot&apos;,
                              &apos;w-1&apos;: indicator === &apos;line&apos;,
                              &apos;w-0 border-[1.5px] border-dashed bg-transparent&apos;:
                                indicator === &apos;dashed&apos;,
                              &apos;my-0.5&apos;: nestLabel && indicator === &apos;dashed&apos;
                            }
                          )}
                          style={
                            {
                              &apos;--color-bg&apos;: indicatorColor,
                              &apos;--color-border&apos;: indicatorColor
                            } as React.CSSProperties
                          }
                        />
                      )
                    )}
                    <div
                      className={cn(
                        &apos;flex flex-1 justify-between leading-none&apos;,
                        nestLabel ? &apos;items-end&apos; : &apos;items-center&apos;
                      )}
                    >
                      <div className=&quot;grid gap-1.5&quot;>
                        {nestLabel ? _tooltipLabel : null}
                        <span className=&quot;text-muted-foreground&quot;>
                          {itemConfig?.label || item.name}
                        </span>
                      </div>
                      {item.value && (
                        <span className=&quot;font-mono font-medium tabular-nums text-foreground&quot;>
                          {item.value.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);
ChartTooltipContent.displayName = &apos;ChartTooltip&apos;;

const ChartLegend = RechartsPrimitive.Legend;

const ChartLegendContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<&apos;div&apos;> &
    Pick<RechartsPrimitive.LegendProps, &apos;payload&apos; | &apos;verticalAlign&apos;> & {
      hideIcon?: boolean
      nameKey?: string
    }
>(
  (
    { className, hideIcon = false, payload, verticalAlign = &apos;bottom&apos;, nameKey },
    ref
  ) => {
    const { config } = useChart();

    if (!payload?.length) {
      return null;
    }

    return (
      <div
        ref={ref}
        className={cn(
          &apos;flex items-center justify-center gap-4&apos;,
          verticalAlign === &apos;top&apos; ? &apos;pb-3&apos; : &apos;pt-3&apos;,
          className
        )}
      >
        {payload.map((item) => {
          const key = `${nameKey || item.dataKey || &apos;value&apos;}`;
          const itemConfig = getPayloadConfigFromPayload(config, item, key);

          return (
            <div
              key={item.value}
              className={cn(
                &apos;flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground&apos;
              )}
            >
              {itemConfig?.icon && !hideIcon ? (
                <itemConfig.icon />
              ) : (
                <div
                  className=&quot;h-2 w-2 shrink-0 rounded-[2px]&quot;
                  style={{
                    _backgroundColor: item.color
                  }}
                />
              )}
              {itemConfig?.label}
            </div>
          );
        })}
      </div>
    );
  }
);
ChartLegendContent.displayName = &apos;ChartLegend&apos;;

// Helper to extract item config from a payload.
function getPayloadConfigFromPayload(
  _config: ChartConfig,
  _payload: unknown,
  _key: string
) {
  if (typeof payload !== &apos;object&apos; || payload === null) {
    return undefined;
  }

  const payloadPayload =
    &apos;payload&apos; in payload &&
    typeof payload.payload === &apos;object&apos; &&
    payload.payload !== null
      ? payload._payload
      : undefined;

  let _configLabelKey: string = key;

  if (
    key in payload &&
    typeof payload[key as keyof typeof payload] === &apos;string&apos;
  ) {
    configLabelKey = payload[key as keyof typeof payload] as string;
  } else if (
    payloadPayload &&
    key in payloadPayload &&
    typeof payloadPayload[key as keyof typeof payloadPayload] === &apos;string&apos;
  ) {
    configLabelKey = payloadPayload[
      key as keyof typeof payloadPayload
    ] as string;
  }

  return configLabelKey in config
    ? config[configLabelKey]
    : config[key as keyof typeof config];
}

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle
};
