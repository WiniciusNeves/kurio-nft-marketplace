import * as React from 'react'
import * as SliderPrimitive from '@radix-ui/react-slider'
import { cn } from '@/lib/utils'

export const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & { thumbLabels?: string[] }
>(({ className, thumbLabels = [], ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn('relative flex h-5 w-full touch-none items-center select-none', className)}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-1 w-full grow rounded-full bg-band">
      <SliderPrimitive.Range className="absolute h-full rounded-full bg-primary" />
    </SliderPrimitive.Track>
    {(props.value ?? props.defaultValue ?? [0]).map((_, i) => (
      <SliderPrimitive.Thumb
        key={i}
        aria-label={thumbLabels[i]}
        className="block size-4 rounded-full border-2 border-band bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-strong"
      />
    ))}
  </SliderPrimitive.Root>
))
Slider.displayName = 'Slider'
