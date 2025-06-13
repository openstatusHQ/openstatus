"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------------------------------------------------
// Context -------------------------------------------------------------------------------------------------------------
// ---------------------------------------------------------------------------------------------------------------------

interface WheelPickerContextValue {
  items: string[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  theta: number; // angle between two items
  radius: number; // translateZ distance
  count: number; // items including placeholders
}

const WheelPickerContext = React.createContext<WheelPickerContextValue | null>(
  null
);

const useWheelPickerContext = () => {
  const ctx = React.useContext(WheelPickerContext);
  if (!ctx) {
    throw new Error(
      "[WheelPicker] sub component must be rendered within <WheelPicker /> root"
    );
  }
  return ctx;
};

// ---------------------------------------------------------------------------------------------------------------------
// WheelPicker (Root / Provider) ---------------------------------------------------------------------------------------
// ---------------------------------------------------------------------------------------------------------------------

export interface WheelPickerProps extends React.HTMLAttributes<HTMLDivElement> {
  items: string[];
  /** 0-based index of the currently selected item. Defaults to 0. */
  currentIndex: number;
  /** Callback that is invoked with the currently selected item (string) whenever the selection changes */
  onIndexChange: (index: number) => void;
  /** Radius (in `px`) of the carousel – tweak to fit line height of text (Default: 28) */
  radius?: number;
}

const WheelPicker = React.forwardRef<HTMLDivElement, WheelPickerProps>(
  (
    {
      items,
      currentIndex,
      onIndexChange,
      radius: radiusProp = 28,
      className,
      children,
      ...props
    },
    ref
  ) => {
    // internal render count includes two placeholders at start & end
    const count = items.length + 2;
    const theta = (2 * Math.PI) / count;

    const contextValue = React.useMemo<WheelPickerContextValue>(
      () => ({
        items,
        currentIndex,
        onIndexChange,
        theta,
        radius: radiusProp,
        count,
      }),
      [items, currentIndex, onIndexChange, theta, radiusProp, count]
    );

    return (
      <WheelPickerContext.Provider value={contextValue}>
        <div ref={ref} className={className} {...props}>
          {children}
        </div>
      </WheelPickerContext.Provider>
    );
  }
);
WheelPicker.displayName = "WheelPicker";

// ---------------------------------------------------------------------------------------------------------------------
// WheelPickerSelect ---------------------------------------------------------------------------------------------------
// ---------------------------------------------------------------------------------------------------------------------

export type WheelPickerSelectProps = React.HTMLAttributes<HTMLDivElement>;

const WheelPickerSelect = React.forwardRef<
  HTMLDivElement,
  WheelPickerSelectProps
>(({ className, children, ...props }, ref) => {
  const { items, currentIndex, onIndexChange } = useWheelPickerContext();

  const moveBy = React.useCallback(
    (delta: number) => {
      const itemsLength = items.length;
      let newIndex = currentIndex + delta;

      // Handle wrapping
      if (newIndex < 0) {
        newIndex = itemsLength - 1;
      } else if (newIndex >= itemsLength) {
        newIndex = 0;
      }

      onIndexChange(newIndex);
    },
    [currentIndex, items.length, onIndexChange]
  );

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      switch (e.key) {
        case "ArrowUp":
        case "ArrowLeft":
          e.preventDefault();
          moveBy(1);
          break;
        case "ArrowDown":
        case "ArrowRight":
          e.preventDefault();
          moveBy(-1);
          break;
        case "Home":
          e.preventDefault();
          onIndexChange(0);
          break;
        case "End":
          e.preventDefault();
          onIndexChange(items.length - 1);
          break;
      }
    },
    [moveBy, onIndexChange, items.length]
  );

  return (
    <div
      ref={ref}
      data-slot="wheel-select"
      role="listbox"
      aria-label="Select option"
      aria-activedescendant={`wheel-option-${currentIndex}`}
      tabIndex={0}
      className={cn(
        "relative h-6 w-full rounded-md border border-transparent text-left focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50",
        className
      )}
      onKeyDown={handleKeyDown}
      {...props}
    >
      {children}
    </div>
  );
});
WheelPickerSelect.displayName = "WheelPickerSelect";

// ---------------------------------------------------------------------------------------------------------------------
// WheelPickerOptions --------------------------------------------------------------------------------------------------
// ---------------------------------------------------------------------------------------------------------------------

export type WheelPickerOptionsProps = React.HTMLAttributes<HTMLDivElement>;

const WheelPickerOptions = React.forwardRef<
  HTMLDivElement,
  WheelPickerOptionsProps
>(({ className, ...props }, ref) => {
  const { items, currentIndex, onIndexChange, theta, radius } =
    useWheelPickerContext();

  return (
    <div
      ref={ref}
      data-slot="wheel-options"
      className={cn(
        "h-full w-full rounded-md [perspective:1000px] [transform-style:preserve-3d]",
        className
      )}
      {...props}
    >
      <div
        className="relative h-full w-full transition-transform duration-500 ease-out [transform-style:preserve-3d]"
        style={{
          transform: `translateZ(-${radius}px) rotateX(${
            -(currentIndex + 1) * theta
          }rad)`,
        }}
      >
        {/* First placeholder */}
        <WheelPickerEmpty position="first" />

        {/* Real items */}
        {items.map((item, idx) => {
          // Render index = item index + 1 (accounting for first placeholder)
          const renderIdx = idx + 1;
          const angle = theta * renderIdx;
          const isSelected = idx === currentIndex;
          return (
            <div
              key={item}
              data-slot="wheel-option"
              id={`wheel-option-${idx}`}
              role="option"
              aria-selected={isSelected}
              className={cn(
                "absolute inset-0 flex cursor-pointer select-none items-center justify-start transition-transform duration-500 ease-out [backface-visibility:hidden]"
              )}
              style={{
                transform: `rotateX(${angle}rad) translateZ(${radius}px)`,
                transformStyle: "preserve-3d",
              }}
              onClick={(e) => {
                if (!isSelected) {
                  e.preventDefault();
                  e.stopPropagation();
                  onIndexChange(idx);
                }
              }}
            >
              <span
                className={cn(
                  "text-xs transition-colors",
                  isSelected ? "text-foreground" : "text-muted-foreground/70"
                )}
              >
                {item}
              </span>
            </div>
          );
        })}

        {/* Last placeholder */}
        <WheelPickerEmpty position="last" />
      </div>
    </div>
  );
});
WheelPickerOptions.displayName = "WheelPickerOptions";

// ---------------------------------------------------------------------------------------------------------------------
// WheelPickerEmpty (placeholders) -------------------------------------------------------------------------------------
// ---------------------------------------------------------------------------------------------------------------------

type PlaceholderPosition = "first" | "last";

export interface WheelPickerEmptyProps
  extends React.HTMLAttributes<HTMLDivElement> {
  position: PlaceholderPosition;
}

const WheelPickerEmpty = React.forwardRef<
  HTMLDivElement,
  WheelPickerEmptyProps
>(({ position, className, ...props }, ref) => {
  const { theta, radius, count, currentIndex } = useWheelPickerContext();

  const renderIdx = position === "first" ? 0 : count - 1;
  const angle = theta * renderIdx;

  return (
    <div
      ref={ref}
      data-slot="wheel-empty"
      id={`wheel-option-${renderIdx}`}
      role="option"
      aria-selected={currentIndex === renderIdx}
      aria-disabled
      className={cn(
        "absolute inset-0 select-none [backface-visibility:hidden]",
        className
      )}
      style={{
        transform: `rotateX(${angle}rad) translateZ(${radius}px)`,
        transformStyle: "preserve-3d",
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      {...props}
    />
  );
});
WheelPickerEmpty.displayName = "WheelPickerEmpty";

// ---------------------------------------------------------------------------------------------------------------------
// Exports -------------------------------------------------------------------------------------------------------------
// ---------------------------------------------------------------------------------------------------------------------

export { WheelPicker, WheelPickerSelect, WheelPickerOptions, WheelPickerEmpty };
