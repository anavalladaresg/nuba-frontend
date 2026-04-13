import { apiClient } from '../../../shared/api/api-client'

type ExportFilters = {
  from?: string
  to?: string
}

export const exportsApi = {
  downloadCsv: (filters: ExportFilters) =>
    apiClient.get<Blob>('/api/exports/csv', {
      query: filters,
      responseType: 'blob',
    }),
  downloadPdf: (filters: ExportFilters) =>
    apiClient.get<Blob>('/api/exports/pdf', {
      query: filters,
      responseType: 'blob',
    }),
}
