import { cn } from '@/lib/utils'

interface PageContainerProps {
  children: React.ReactNode
  className?: string
  narrow?: boolean
}

export function PageContainer({ children, className, narrow }: PageContainerProps) {
  return (
    <div
      className={cn(
        'mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14',
        narrow ? 'max-w-3xl' : 'max-w-7xl',
        className
      )}
    >
      {children}
    </div>
  )
}
