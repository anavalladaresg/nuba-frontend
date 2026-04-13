import type { PropsWithChildren } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '../../shared/api/query-client'
import { AuthSessionProvider } from '../../features/auth/AuthSessionProvider'
import { AuthGate } from '../../features/auth/AuthGate'

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <AuthSessionProvider>
      <AuthGate>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </AuthGate>
    </AuthSessionProvider>
  )
}
