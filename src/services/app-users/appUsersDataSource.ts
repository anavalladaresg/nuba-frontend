export type AppUserPreview = {
  id: string
  email: string
  displayName: string | null
  timezone: string
  createdAt: string
}

export type AppUsersDataSource = {
  countAll: () => Promise<number>
  listRecent: (limit?: number) => Promise<AppUserPreview[]>
}
