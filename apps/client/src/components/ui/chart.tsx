"use client";

import * as React from "react";
import { ResponsiveContainer, Tooltip, Legend } from "recharts";
import { cn } from "@/lib/utils";

type THEMES = "" | ".dark";

export type ChartConfig = {
  [k: string]: {
    label?: React.ReactNode;
    icon?: React.ComponentType;
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<THEMES, string> }
  );
};

type ChartContextProps = { config: ChartConfig };
const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);
  if (!context)
    throw new Error("useChart must be used within a <ChartContainer />");
  return context;
}

// -------------------- Container --------------------
const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    config: ChartConfig;
    children: React.ReactNode;
  }
>(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = React.useId();
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        ref={ref}
        className={cn(
          "flex h-[350px] w-full flex-col items-center justify-center [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line-line]:stroke-border [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none",
          className
        )}
        {...props}
      >
        <ResponsiveContainer>{children}</ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
});
ChartContainer.displayName = "ChartContainer";

// -------------------- Tooltip --------------------
export type TooltipItem = {
  value?: number | string;
  name?: string;
  dataKey?: string;
  color?: string;
  payload?: Record<string, any>;
};

type ChartTooltipContentProps = {
  active?: boolean;
  payload?: TooltipItem[];
  label?: string | number;
  className?: string;
  hideLabel?: boolean;
  hideIndicator?: boolean;
  indicator?: "line" | "dot" | "dashed";
  nameKey?: string;
  labelKey?: string;
  formatter?: (
    value: any,
    name: string,
    item: TooltipItem,
    index: number,
    payload: TooltipItem[]
  ) => React.ReactNode;
  labelFormatter?: (label: any, payload: TooltipItem[]) => React.ReactNode;
  labelClassName?: string;
};

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  ChartTooltipContentProps
>(
  (
    {
      active,
      payload = [],
      label,
      className,
      hideLabel = false,
      hideIndicator = false,
      indicator = "dot",
      labelKey,
      nameKey,
      labelFormatter,
      labelClassName,
    },
    ref
  ) => {
    const { config } = useChart();

    // Always call useMemo at the top
    const tooltipLabel = React.useMemo(() => {
      if (!active || !payload.length || hideLabel) return null;

      const item = payload[0];
      const key = labelKey || item.dataKey || item.name || "value";
      const value =
        typeof label === "string"
          ? config[label]?.label || label
          : config[key]?.label;

      if (labelFormatter) {
        return (
          <div className={cn("font-medium", labelClassName)}>
            {labelFormatter(value, payload)}
          </div>
        );
      }

      if (!value) return null;

      return <div className={cn("font-medium", labelClassName)}>{value}</div>;
    }, [
      active,
      payload,
      label,
      labelKey,
      labelFormatter,
      labelClassName,
      hideLabel,
      config,
    ]);

    // Return null if not active or no payload
    if (!active || !payload.length) return null;

    return (
      <div
        ref={ref}
        className={cn(
          "grid min-w-32 items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl",
          className
        )}
      >
        {tooltipLabel}
        <div className="grid gap-1.5">
          {payload.map((item, index) => {
            const key = nameKey || item.name || item.dataKey || "value";
            const itemConfig = config[key];
            const indicatorColor =
              item.payload?.fill || item.color || itemConfig?.color;

            return (
              <div
                key={index}
                className="flex w-full flex-wrap items-stretch gap-2"
                style={{ "--color": indicatorColor } as React.CSSProperties}
              >
                {!hideIndicator && (
                  <div
                    className={cn(
                      "shrink-0 rounded-[2px] border-[--color] bg-[--color]",
                      indicator === "dot" && "h-2.5 w-2.5",
                      indicator === "line" && "w-1",
                      indicator === "dashed" &&
                        "w-0 border-[1.5px] border-dashed bg-transparent my-0.5"
                    )}
                  />
                )}
                <div className="flex flex-1 justify-between leading-none">
                  <div className="grid gap-1.5">
                    {itemConfig?.label || item.name}
                  </div>
                  {item.value !== undefined && (
                    <span className="font-mono font-medium tabular-nums text-foreground">
                      {item.value}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);
ChartTooltipContent.displayName = "ChartTooltipContent";

// -------------------- Legend --------------------
type ChartLegendContentProps = {
  payload?: TooltipItem[];
  verticalAlign?: "top" | "bottom" | "middle";
  className?: string;
  hideIcon?: boolean;
  nameKey?: string;
};

const ChartLegendContent = React.forwardRef<
  HTMLDivElement,
  ChartLegendContentProps
>(
  (
    {
      className,
      hideIcon = false,
      payload = [],
      verticalAlign = "bottom",
      nameKey,
    },
    ref
  ) => {
    const { config } = useChart();

    if (!payload.length) return null;

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center justify-center gap-4",
          verticalAlign === "top" ? "pb-3" : "pt-3",
          className
        )}
      >
        {payload.map((item, index) => {
          const key = nameKey || item.dataKey || item.name || "value";
          const itemConfig = config[key];
          const indicatorColor =
            item.color || item.payload?.fill || itemConfig?.color;

          return (
            <div
              key={index}
              className="flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground"
              style={{ "--color": indicatorColor } as React.CSSProperties}
            >
              {itemConfig?.icon && !hideIcon ? (
                <itemConfig.icon />
              ) : (
                <div
                  className="h-2 w-2 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: "var(--color)" }}
                />
              )}
              {itemConfig?.label ? (
                <span>{itemConfig.label}</span>
              ) : (
                <span>{item.value}</span>
              )}
            </div>
          );
        })}
      </div>
    );
  }
);
ChartLegendContent.displayName = "ChartLegendContent";

// -------------------- Exports --------------------
export {
  ChartContainer,
  Tooltip as ChartTooltip,
  ChartTooltipContent,
  Legend as ChartLegend,
  ChartLegendContent,
  ChartContext,
};
