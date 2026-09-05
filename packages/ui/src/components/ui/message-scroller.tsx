/**
 * MessageScroller — auto-scrolling container for chat messages.
 * Follows the shadcn message-scroller contract:
 *   Provider (autoScroll) > Root > Viewport > Content > Item (scrollAnchor) + Button (jump to latest)
 */
import * as React from "react";
import { cn } from "@/lib/utils";

interface MessageScrollerContextValue {
  autoScroll: boolean;
  setAutoScroll: (v: boolean) => void;
  isAtBottom: boolean;
  setIsAtBottom: (v: boolean) => void;
  scrollToBottom: (instant?: boolean) => void;
  pinToBottom: (instant?: boolean) => void;
  registerAnchor: (el: HTMLElement | null) => void;
  setViewportRef: (el: HTMLDivElement | null) => void;
}

const MessageScrollerContext = React.createContext<MessageScrollerContextValue | null>(null);

function useMessageScroller() {
  const ctx = React.useContext(MessageScrollerContext);
  if (!ctx) throw new Error("useMessageScroller must be used within MessageScroller.Provider");
  return ctx;
}

function Provider({
  autoScroll: autoScrollProp = true,
  children,
}: {
  autoScroll?: boolean;
  children: React.ReactNode;
}) {
  const [autoScroll, setAutoScroll] = React.useState(autoScrollProp);
  const [isAtBottom, setIsAtBottom] = React.useState(true);
  const anchorRef = React.useRef<HTMLElement | null>(null);
  const [viewportEl, setViewportEl] = React.useState<HTMLDivElement | null>(null);

  const setViewportRef = React.useCallback((el: HTMLDivElement | null) => {
    setViewportEl(el);
  }, []);

  const scrollToBottom = React.useCallback((instant = false) => {
    anchorRef.current?.scrollIntoView({ behavior: instant ? "instant" : "smooth", block: "end" });
  }, []);

  // Re-pin to the tail (e.g. after history loads) and jump there.
  const pinToBottom = React.useCallback(
    (instant = false) => {
      setAutoScroll(true);
      setIsAtBottom(true);
      // Wait a frame so freshly rendered messages are laid out before measuring.
      requestAnimationFrame(() => {
        anchorRef.current?.scrollIntoView({ behavior: instant ? "instant" : "smooth", block: "end" });
      });
    },
    [],
  );

  // Track whether the user is pinned to the bottom
  React.useEffect(() => {
    if (!viewportEl) return;
    const onScroll = () => {
      const atBottom = viewportEl.scrollHeight - viewportEl.scrollTop - viewportEl.clientHeight < 80;
      setIsAtBottom(atBottom);
      setAutoScroll((prev) => (prev === atBottom ? prev : atBottom));
    };
    viewportEl.addEventListener("scroll", onScroll, { passive: true });
    return () => viewportEl.removeEventListener("scroll", onScroll);
  }, [viewportEl]);

  // Follow the anchor while auto-scrolling
  React.useEffect(() => {
    if (!autoScroll) return;
    anchorRef.current?.scrollIntoView({ block: "end" });
  });

  const value = React.useMemo<MessageScrollerContextValue>(
    () => ({
      autoScroll,
      setAutoScroll,
      isAtBottom,
      setIsAtBottom,
      scrollToBottom,
      pinToBottom,
      registerAnchor: (el) => (anchorRef.current = el),
      setViewportRef,
    }),
    [autoScroll, isAtBottom, scrollToBottom, pinToBottom, setViewportRef],
  );

  return <MessageScrollerContext.Provider value={value}>{children}</MessageScrollerContext.Provider>;
}

function Root({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("relative flex min-h-0 flex-1 flex-col", className)} {...props}>
      {children}
    </div>
  );
}

const Viewport = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const localRef = React.useRef<HTMLDivElement>(null);
    React.useImperativeHandle(ref, () => localRef.current as HTMLDivElement);

    // Register the real scroll container so Provider can track pin state.
    const { setViewportRef } = useMessageScroller();
    React.useEffect(() => {
      setViewportRef(localRef.current);
      return () => setViewportRef(null);
    }, [setViewportRef]);

    return (
      <div
        ref={localRef}
        data-slot="message-scroller-viewport"
        className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain", className)}
        {...props}
      >
        {children}
      </div>
    );
  },
);
Viewport.displayName = "MessageScrollerViewport";

function Content({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-4 p-4", className)} {...props} />;
}

function Item({
  scrollAnchor = false,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { scrollAnchor?: boolean }) {
  const { registerAnchor } = useMessageScroller();
  const ref = React.useCallback(
    (el: HTMLDivElement | null) => {
      if (scrollAnchor) registerAnchor(el);
    },
    [scrollAnchor, registerAnchor],
  );
  return (
    <div ref={ref} data-slot="message-scroller-item" className={className} {...props}>
      {children}
    </div>
  );
}

function Button({ className, ...props }: React.ComponentProps<"button">) {
  const { isAtBottom, scrollToBottom } = useMessageScroller();
  if (isAtBottom) return null;
  return (
    <button
      type="button"
      onClick={() => scrollToBottom(false)}
      className={cn(
        "absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full border bg-background px-3 py-1.5 text-xs shadow-md hover:bg-accent",
        className,
      )}
      {...props}
    >
      Jump to latest ↓
    </button>
  );
}

export { Provider as MessageScrollerProvider, Root as MessageScrollerRoot, Viewport as MessageScrollerViewport, Content as MessageScrollerContent, Item as MessageScrollerItem, Button as MessageScrollerButton, useMessageScroller };