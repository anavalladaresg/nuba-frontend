export type RecentWorkSessionPreview = {
  id: string
  workDate: string
  status: string
  startTime: string
  endTime: string | null
  workedMinutes: number
  breakMinutes: number
  extraMinutes: number
}

export type WorkSessionsDataSource = {
  countAll: () => Promise<number>
  listRecent: (limit?: number) => Promise<RecentWorkSessionPreview[]>
}
