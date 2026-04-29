import * as React from 'react'
import { Button as TaroButton } from '@tarojs/components'
import { buttonVariants } from './button'

const ShareButton = React.forwardRef<
  any,
  {
    variant?: 'default' | 'outline'
    size?: 'default' | 'sm' | 'lg'
    className?: string
    children: React.ReactNode
  } & Omit<React.ComponentPropsWithoutRef<typeof TaroButton>, 'variant' | 'size' | 'className'>
>(({ className, variant = 'outline', size = 'default', children, ...props }, ref) => {
  return (
    <TaroButton
      ref={ref}
      className={buttonVariants({ variant, size, className })}
      openType="share"
      {...props}
    >
      {children}
    </TaroButton>
  )
})

ShareButton.displayName = 'ShareButton'

export { ShareButton }
