export type CalendarSpecialDayPreview = {
  id: string
  specialDate: string
  specialType: string
  name: string
  regionCode: string | null
}

export type CalendarSpecialDaysDataSource = {
  countAll: () => Promise<number>
  listRecent: (limit?: number) => Promise<CalendarSpecialDayPreview[]>
}
