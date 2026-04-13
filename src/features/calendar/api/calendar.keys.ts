export const calendarKeys = {
  all: ['calendar'] as const,
  month: (year: number, month: number) =>
    [...calendarKeys.all, 'month', year, month] as const,
}
