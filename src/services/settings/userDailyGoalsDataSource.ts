export type UserDailyGoalPreview = {
  id: string
  userId: string
  dayOfWeek: number
  targetMinutes: number
}

export type UserDailyGoalsDataSource = {
  countAll: () => Promise<number>
  listRecent: (limit?: number) => Promise<UserDailyGoalPreview[]>
}
