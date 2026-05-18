'use client'

import { Toaster } from 'sonner'

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster
        position="bottom-right"
        gap={8}
        toastOptions={{
          style: {
            background: 'var(--surface)',
            border: '1px solid var(--border-hover)',
            color: 'var(--text)',
            fontFamily: 'Montserrat, sans-serif',
            fontSize: '13px',
            backdropFilter: 'blur(12px)',
          },
        }}
      />
    </>
  )
}
