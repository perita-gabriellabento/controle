import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded text-sm font-medium font-montserrat transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-40',
  {
    variants: {
      variant: {
        default:   'bg-gold text-[#1a2535] hover:bg-gold-light font-semibold shadow-sm shadow-gold/20',
        outline:   'border border-[rgba(212,175,55,0.3)] text-gold-light hover:border-gold hover:text-gold hover:bg-[rgba(212,175,55,0.05)]',
        ghost:     'text-gold-light hover:text-gold hover:bg-[rgba(212,175,55,0.05)]',
        danger:    'bg-red-600/20 text-red-400 border border-red-600/30 hover:bg-red-600/30 hover:text-red-300',
        secondary: 'bg-surface-2 text-text border border-[rgba(212,175,55,0.1)] hover:border-[rgba(212,175,55,0.25)]',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm:      'h-7 px-3 text-xs',
        lg:      'h-11 px-6',
        icon:    'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
