/* eslint-disable react-refresh/only-export-components */
import {
  ClerkProvider,
  useClerk,
  useAuth,
  useUser,
} from '@clerk/clerk-react'
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import { env, hasClerk } from '../../config/env'
import { setAuthIdentityResolver, setAuthTokenResolver } from '../../shared/api/auth-resolver'
import { queryClient } from '../../shared/api/query-client'
import { getPrototypeAccessToken } from '../../shared/prototype/prototype-backend'

type AuthSource = 'prototype' | 'clerk' | 'dev-token' | 'none'

type AuthSessionContextValue = {
  isReady: boolean
  isAuthenticated: boolean
  authSource: AuthSource
  error: string | null
  getToken: () => Promise<string | null>
  signOut: () => Promise<void>
}

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null)

const PROTOTYPE_AUTH_IDENTITY = {
  clerkUserId: 'prototype-user',
  email: 'ana@nuba.app',
  displayName: 'Ana Nuba',
}

const parseTokenPayload = (payload: unknown) => {
  if (typeof payload === 'string') {
    return payload.trim()
  }

  if (payload && typeof payload === 'object') {
    const accessToken = Reflect.get(payload, 'accessToken')
    if (typeof accessToken === 'string') {
      return accessToken.trim()
    }

    const token = Reflect.get(payload, 'token')
    if (typeof token === 'string') {
      return token.trim()
    }

    const jwt = Reflect.get(payload, 'jwt')
    if (typeof jwt === 'string') {
      return jwt.trim()
    }
  }

  return null
}

async function loadDevToken() {
  const response = await fetch(
    new URL('/dev/auth/token', env.apiBaseUrl || window.location.origin).toString(),
  )

  if (!response.ok) {
    throw new Error('No se pudo recuperar el token de desarrollo desde /dev/auth/token.')
  }

  const contentType = response.headers.get('content-type')

  if (contentType?.includes('application/json')) {
    return parseTokenPayload(await response.json())
  }

  return parseTokenPayload(await response.text())
}

function ClerkBridge({ children }: PropsWithChildren) {
  const { isLoaded, getToken, isSignedIn } = useAuth()
  const { signOut } = useClerk()
  const { isLoaded: isUserLoaded, user } = useUser()

  useEffect(() => {
    setAuthTokenResolver(async () => (isSignedIn ? getToken() : null))
  }, [getToken, isSignedIn])

  useEffect(() => {
    setAuthIdentityResolver(async () => {
      if (!isSignedIn || !user) {
        return null
      }

      const email =
        user.primaryEmailAddress?.emailAddress ??
        user.emailAddresses.at(0)?.emailAddress ??
        ''
      const displayName =
        user.fullName?.trim() ||
        user.username?.trim() ||
        email.split('@').at(0) ||
        'Usuario Nuba'

      if (!email) {
        return null
      }

      return {
        clerkUserId: user.id,
        email,
        displayName,
      }
    })
  }, [isSignedIn, user])

  const value = useMemo<AuthSessionContextValue>(
    () => ({
      isReady: isLoaded && isUserLoaded,
      isAuthenticated: Boolean(isSignedIn),
      authSource: 'clerk',
      error: null,
      getToken: async () => (isSignedIn ? getToken() : null),
      signOut: async () => {
        queryClient.clear()
        setAuthTokenResolver(async () => null)
        setAuthIdentityResolver(async () => null)
        await signOut()
      },
    }),
    [getToken, isLoaded, isSignedIn, isUserLoaded, signOut],
  )

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>
}

function PrototypeBridge({ children }: PropsWithChildren) {
  const [isAuthenticated, setIsAuthenticated] = useState(true)

  useEffect(() => {
    setAuthTokenResolver(isAuthenticated ? getPrototypeAccessToken : async () => null)
    setAuthIdentityResolver(async () => (isAuthenticated ? PROTOTYPE_AUTH_IDENTITY : null))
  }, [isAuthenticated])

  const value = useMemo<AuthSessionContextValue>(
    () => ({
      isReady: true,
      isAuthenticated,
      authSource: 'prototype',
      error: null,
      getToken: getPrototypeAccessToken,
      signOut: async () => {
        queryClient.clear()
        setIsAuthenticated(false)
        setAuthTokenResolver(async () => null)
        setAuthIdentityResolver(async () => null)
      },
    }),
    [isAuthenticated],
  )

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>
}

function DevTokenBridge({ children }: PropsWithChildren) {
  const [token, setToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    let mounted = true

    const bootstrap = async () => {
      if (!env.useDevAuthToken) {
        setIsReady(true)
        return
      }

      try {
        const nextToken = await loadDevToken()
        if (!mounted) {
          return
        }

        setToken(nextToken)
        setError(nextToken ? null : 'El backend no devolvió un token de desarrollo válido.')
      } catch (requestError) {
        if (!mounted) {
          return
        }

        setError(
          requestError instanceof Error
            ? requestError.message
            : 'No se pudo inicializar la autenticación de desarrollo.',
        )
      } finally {
        if (mounted) {
          setIsReady(true)
        }
      }
    }

    void bootstrap()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    setAuthTokenResolver(async () => token)
    setAuthIdentityResolver(async () => null)
  }, [token])

  const value = useMemo<AuthSessionContextValue>(
    () => ({
      isReady,
      isAuthenticated: Boolean(token),
      authSource: token ? 'dev-token' : 'none',
      error,
      getToken: async () => token,
      signOut: async () => {
        queryClient.clear()
        setToken(null)
        setAuthTokenResolver(async () => null)
        setAuthIdentityResolver(async () => null)
      },
    }),
    [error, isReady, token],
  )

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>
}

export function AuthSessionProvider({ children }: PropsWithChildren) {
  if (hasClerk) {
    return (
      <ClerkProvider publishableKey={env.clerkPublishableKey}>
        <ClerkBridge>{children}</ClerkBridge>
      </ClerkProvider>
    )
  }

  if (env.useFrontendBackend) {
    return <PrototypeBridge>{children}</PrototypeBridge>
  }

  return <DevTokenBridge>{children}</DevTokenBridge>
}

export function useAuthSession() {
  const context = useContext(AuthSessionContext)

  if (!context) {
    throw new Error('useAuthSession must be used inside AuthSessionProvider.')
  }

  return context
}
