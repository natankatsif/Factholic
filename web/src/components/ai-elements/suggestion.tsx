"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";

export type SuggestionsProps = ComponentProps<"div">;

export const Suggestions = ({ className, children, ...props }: SuggestionsProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const dragRef = useRef({
    isDown: false,
    startX: 0,
    scrollLeft: 0,
    moved: false,
  });

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(maxScroll > 2 && el.scrollLeft < maxScroll - 2);
  }, []);

  // Map vertical mouse wheel (deltaY) to horizontal scrolling
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      // If mouse wheel has vertical delta and negligible horizontal delta
      if (Math.abs(e.deltaY) >= Math.abs(e.deltaX) && e.deltaY !== 0) {
        const maxScroll = el.scrollWidth - el.clientWidth;
        if (maxScroll <= 0) return;

        const canLeft = el.scrollLeft > 0;
        const canRight = el.scrollLeft < maxScroll - 1;

        if ((e.deltaY < 0 && canLeft) || (e.deltaY > 0 && canRight)) {
          e.preventDefault();
          el.scrollLeft += e.deltaY;
          updateScrollState();
        }
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [updateScrollState]);

  // Track size/scroll changes
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateScrollState();

    const ro = new ResizeObserver(() => {
      updateScrollState();
    });
    ro.observe(el);
    if (el.firstElementChild) {
      ro.observe(el.firstElementChild);
    }

    return () => ro.disconnect();
  }, [children, updateScrollState]);

  // Global mouseup to cancel dragging
  useEffect(() => {
    const onWindowMouseUp = () => {
      if (dragRef.current.isDown) {
        dragRef.current.isDown = false;
        setIsDragging(false);
        setTimeout(() => {
          dragRef.current.moved = false;
        }, 0);
      }
    };

    window.addEventListener("mouseup", onWindowMouseUp);
    return () => window.removeEventListener("mouseup", onWindowMouseUp);
  }, []);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const el = scrollRef.current;
    if (!el) return;

    dragRef.current = {
      isDown: true,
      startX: e.clientX,
      scrollLeft: el.scrollLeft,
      moved: false,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragRef.current.isDown) return;
    const el = scrollRef.current;
    if (!el) return;

    const dx = e.clientX - dragRef.current.startX;
    if (!dragRef.current.moved && Math.abs(dx) > 4) {
      dragRef.current.moved = true;
      setIsDragging(true);
    }

    if (dragRef.current.moved) {
      el.scrollLeft = dragRef.current.scrollLeft - dx;
      updateScrollState();
    }
  };

  const handleClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragRef.current.moved) {
      e.stopPropagation();
      e.preventDefault();
    }
  };

  const scrollByAmount = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = direction === "left" ? -180 : 180;
    el.scrollBy({ left: amount, behavior: "smooth" });
  };

  const hasOverflow = canScrollLeft || canScrollRight;

  return (
    <div className="relative w-full min-w-0" {...props}>
      {/* Left scroll chevron & fade */}
      {canScrollLeft && (
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex w-10 items-center justify-start bg-gradient-to-r from-background via-background/90 to-transparent">
          <button
            type="button"
            tabIndex={-1}
            onClick={() => scrollByAmount("left")}
            className="pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-[#755D5C] shadow-sm transition hover:bg-white hover:text-foreground active:scale-95"
            aria-label="Прокрутить влево"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Scrollable container */}
      <div
        ref={scrollRef}
        onScroll={updateScrollState}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onClickCapture={handleClickCapture}
        className={cn(
          "w-full overflow-x-auto whitespace-nowrap touch-pan-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          hasOverflow ? (isDragging ? "cursor-grabbing select-none" : "cursor-grab") : "cursor-default",
        )}
      >
        <div className={cn("flex w-max flex-nowrap items-center gap-2 py-0.5", className)}>
          {children}
        </div>
      </div>

      {/* Right scroll chevron & fade */}
      {canScrollRight && (
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex w-10 items-center justify-end bg-gradient-to-l from-background via-background/90 to-transparent">
          <button
            type="button"
            tabIndex={-1}
            onClick={() => scrollByAmount("right")}
            className="pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-[#755D5C] shadow-sm transition hover:bg-white hover:text-foreground active:scale-95"
            aria-label="Прокрутить вправо"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

export type SuggestionProps = Omit<ComponentProps<typeof Button>, "onClick"> & {
  suggestion: string;
  onClick?: (suggestion: string) => void;
};

export const Suggestion = ({
  suggestion,
  onClick,
  className,
  variant = "outline",
  size = "sm",
  children,
  ...props
}: SuggestionProps) => {
  const handleClick = useCallback(() => {
    onClick?.(suggestion);
  }, [onClick, suggestion]);

  return (
    <Button
      className={cn("cursor-pointer rounded-full px-3 select-none", className)}
      onClick={handleClick}
      size={size}
      type="button"
      variant={variant}
      {...props}
    >
      {children || suggestion}
    </Button>
  );
};
