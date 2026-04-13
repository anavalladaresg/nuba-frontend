export type AuthTokenResolver = () => Promise<string | null>

export type AuthIdentity = {
  clerkUserId: string
  email: string
  displayName: string
}

export type AuthIdentityResolver = () => Promise<AuthIdentity | null>

let authTokenResolver: AuthTokenResolver = async () => null
let authIdentityResolver: AuthIdentityResolver = async () => null

export const setAuthTokenResolver = (resolver: AuthTokenResolver) => {
  authTokenResolver = resolver
}

export const setAuthIdentityResolver = (resolver: AuthIdentityResolver) => {
  authIdentityResolver = resolver
}

export const getAccessToken = () => authTokenResolver()

export const getAuthIdentity = () => authIdentityResolver()
