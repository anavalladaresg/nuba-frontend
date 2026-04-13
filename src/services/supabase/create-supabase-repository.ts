import { supabase } from '../../lib/supabase'
import type {
  NubaPublicTableName,
  NubaTableRow,
} from '../../lib/supabase-database.types'
import { toSupabaseServiceError } from './supabase-service-error'

type ListRowsOptions<TTable extends NubaPublicTableName> = {
  columns?: string
  limit?: number
  orderBy?: keyof NubaTableRow<TTable> & string
  ascending?: boolean
}

export function createSupabaseRepository<TTable extends NubaPublicTableName>(table: TTable) {
  return {
    async count(column: keyof NubaTableRow<TTable> & string = 'id' as keyof NubaTableRow<TTable> & string) {
      const { count, error } = await supabase
        .from(table)
        .select(column, { count: 'exact', head: true })

      if (error) {
        throw toSupabaseServiceError(
          error,
          `No pudimos contar registros en ${table}.`,
        )
      }

      return count ?? 0
    },

    async list<TResult = NubaTableRow<TTable>>({
      columns = '*',
      limit = 10,
      orderBy,
      ascending = false,
    }: ListRowsOptions<TTable> = {}) {
      let query = supabase.from(table).select(columns)

      if (orderBy) {
        query = query.order(orderBy, { ascending })
      }

      if (limit > 0) {
        query = query.limit(limit)
      }

      const { data, error } = await query

      if (error) {
        throw toSupabaseServiceError(
          error,
          `No pudimos leer registros desde ${table}.`,
        )
      }

      return (data ?? []) as TResult[]
    },
  }
}
