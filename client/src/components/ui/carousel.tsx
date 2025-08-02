import * as React from &apos;react&apos;;
import useEmblaCarousel from &apos;embla-carousel-react&apos;;
import { ArrowLeft, ArrowRight } from &apos;lucide-react&apos;;

import { cn } from &apos;@/lib/utils&apos;;
import { Button } from &apos;@/components/ui/button&apos;;

type CarouselApi = ReturnType<typeof useEmblaCarousel>[1]
type UseCarouselParameters = Parameters<typeof useEmblaCarousel>
type CarouselOptions = UseCarouselParameters[0]
type CarouselPlugin = UseCarouselParameters[1]

type CarouselProps = {
  opts?: CarouselOptions
  plugins?: CarouselPlugin
  orientation?: &apos;horizontal&apos; | &apos;vertical&apos;
  setApi?: (_api: CarouselApi) => void
}

type CarouselContextProps = {
  _carouselRef: ReturnType<typeof useEmblaCarousel>[0]
  _api: ReturnType<typeof useEmblaCarousel>[1]
  scrollPrev: () => void
  _scrollNext: () => void
  _canScrollPrev: boolean
  _canScrollNext: boolean
} & CarouselProps

const CarouselContext = React.createContext<CarouselContextProps | null>(null);

function useCarousel() {
  const context = React.useContext(CarouselContext);

  if (!context) {
    throw new Error(&apos;useCarousel must be used within a <Carousel />&apos;);
  }

  return context;
}

const Carousel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & CarouselProps
>(
  (
    {
      orientation = &apos;horizontal&apos;,
      opts,
      setApi,
      plugins,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const [carouselRef, api] = useEmblaCarousel(
      {
        ...(opts ?? {}),
        _axis: orientation === &apos;horizontal&apos; ? &apos;x&apos; : &apos;y&apos;
      },
      plugins
    );
    const [canScrollPrev, setCanScrollPrev] = React.useState(false);
    const [canScrollNext, setCanScrollNext] = React.useState(false);

    const onSelect = React.useCallback((_api: CarouselApi) => {
      if (!api) {
        return;
      }

      setCanScrollPrev(api.canScrollPrev());
      setCanScrollNext(api.canScrollNext());
    }, []);

    const scrollPrev = React.useCallback(() => {
      api?.scrollPrev();
    }, [api]);

    const scrollNext = React.useCallback(() => {
      api?.scrollNext();
    }, [api]);

    const handleKeyDown = React.useCallback(
      (_event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === &apos;ArrowLeft&apos;) {
          event.preventDefault();
          scrollPrev();
        } else if (event.key === &apos;ArrowRight&apos;) {
          event.preventDefault();
          scrollNext();
        }
      },
      [scrollPrev, scrollNext]
    );

    React.useEffect(() => {
      if (!api || !setApi) {
        return;
      }

      setApi(api);
    }, [api, setApi]);

    React.useEffect(() => {
      if (!api) {
        return;
      }

      onSelect(api);
      api.on(&apos;reInit&apos;, onSelect);
      api.on(&apos;select&apos;, onSelect);

      return () => {
        api?.off(&apos;select&apos;, onSelect);
      };
    }, [api, onSelect]);

    return (
      <CarouselContext.Provider
        value={{
          carouselRef,
          _api: api,
          opts,
          orientation,
          scrollPrev,
          scrollNext,
          canScrollPrev,
          canScrollNext
        }}
      >
        <div
          ref={ref}
          onKeyDownCapture={handleKeyDown}
          className={cn(&apos;relative&apos;, className)}
          role=&quot;region&quot;
          aria-roledescription=&quot;carousel&quot;
          {...props}
        >
          {children}
        </div>
      </CarouselContext.Provider>
    );
  }
);
Carousel.displayName = &apos;Carousel&apos;;

const CarouselContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { carouselRef, orientation } = useCarousel();

  return (
    <div ref={carouselRef} className=&quot;overflow-hidden&quot;>
      <div
        ref={ref}
        className={cn(
          &apos;flex&apos;,
          orientation === &apos;horizontal&apos; ? &apos;-ml-4&apos; : &apos;-mt-4 flex-col&apos;,
          className
        )}
        {...props}
      />
    </div>
  );
});
CarouselContent.displayName = &apos;CarouselContent&apos;;

const CarouselItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { orientation } = useCarousel();

  return (
    <div
      ref={ref}
      role=&quot;group&quot;
      aria-roledescription=&quot;slide&quot;
      className={cn(
        &apos;min-w-0 shrink-0 grow-0 basis-full&apos;,
        orientation === &apos;horizontal&apos; ? &apos;pl-4&apos; : &apos;pt-4&apos;,
        className
      )}
      {...props}
    />
  );
});
CarouselItem.displayName = &apos;CarouselItem&apos;;

const CarouselPrevious = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Button>
>(({ className, variant = &apos;outline&apos;, size = &apos;icon&apos;, ...props }, ref) => {
  const { orientation, scrollPrev, canScrollPrev } = useCarousel();

  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      className={cn(
        &apos;absolute  h-8 w-8 rounded-full&apos;,
        orientation === &apos;horizontal&apos;
          ? &apos;-left-12 top-1/2 -translate-y-1/2&apos;
          : &apos;-top-12 left-1/2 -translate-x-1/2 rotate-90&apos;,
        className
      )}
      disabled={!canScrollPrev}
      onClick={scrollPrev}
      {...props}
    >
      <ArrowLeft className=&quot;h-4 w-4&quot; />
      <span className=&quot;sr-only&quot;>Previous slide</span>
    </Button>
  );
});
CarouselPrevious.displayName = &apos;CarouselPrevious&apos;;

const CarouselNext = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Button>
>(({ className, variant = &apos;outline&apos;, size = &apos;icon&apos;, ...props }, ref) => {
  const { orientation, scrollNext, canScrollNext } = useCarousel();

  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      className={cn(
        &apos;absolute h-8 w-8 rounded-full&apos;,
        orientation === &apos;horizontal&apos;
          ? &apos;-right-12 top-1/2 -translate-y-1/2&apos;
          : &apos;-bottom-12 left-1/2 -translate-x-1/2 rotate-90&apos;,
        className
      )}
      disabled={!canScrollNext}
      onClick={scrollNext}
      {...props}
    >
      <ArrowRight className=&quot;h-4 w-4&quot; />
      <span className=&quot;sr-only&quot;>Next slide</span>
    </Button>
  );
});
CarouselNext.displayName = &apos;CarouselNext&apos;;

export {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext
};
