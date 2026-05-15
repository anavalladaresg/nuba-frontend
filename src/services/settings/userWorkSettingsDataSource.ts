export type UserWorkSettingsPreview = {
  id: string
  userId: string
  sameHoursEveryDay: boolean
  defaultDailyMinutes: number | null
  lunchCountsAsWorkTime: boolean
  darkModeEnabled: boolean
  autoCompleteForgottenCheckout: boolean
  autoCompleteGraceMinutes: number
}

export type UserWorkSettingsDataSource = {
  countAll: () => Promise<number>
  listRecent: (limit?: number) => Promise<UserWorkSettingsPreview[]>
}
