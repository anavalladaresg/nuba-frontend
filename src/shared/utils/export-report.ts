import { formatInTimeZone } from 'date-fns-tz'
import { es } from 'date-fns/locale'
import { env } from '../../config/env'
import { NUBA_PDF_LOGO_SRC } from '../brand/assets'
import type { WorkSession, WorkSessionStatus } from '../types/work-session'

type WorkSessionsExportMetadata = {
  from?: string
  generatedAt: string
  to?: string
  userName?: string | null
}

type ExportSummary = {
  breakMinutes: number
  recordsCount: number
  workedMinutes: number
}

type PdfMetricCard = {
  accent: string
  label: string
  subtitle: string
  value: string
}

type PdfStatusTheme = {
  background: string
  border: string
  label: string
  text: string
}

type PdfImage = {
  data: string
  height: number
  name: string
  width: number
}

type PdfRenderContext = {
  logo: PdfImage | null
}

const PAGE_WIDTH = 595
const PAGE_HEIGHT = 842
const PAGE_MARGIN = 38
const TABLE_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2
const TABLE_ROW_INSET = 0.9
const TABLE_ROW_VERTICAL_INSET = 0.5
const ROW_HEIGHT = 37
const FIRST_PAGE_TABLE_TOP = 286
const NEXT_PAGE_TABLE_TOP = 120
const FIRST_PAGE_CAPACITY = 12
const NEXT_PAGE_CAPACITY = 17
const TABLE_COLUMNS = {
  date: PAGE_MARGIN + 16,
  status: PAGE_MARGIN + 130,
  start: PAGE_MARGIN + 240,
  end: PAGE_MARGIN + 296,
  work: PAGE_MARGIN + 362,
  break: PAGE_MARGIN + 448,
} as const
const STATUS_COLUMN_WIDTH = TABLE_COLUMNS.start - TABLE_COLUMNS.status

const PDF_COLORS = {
  background: '#F7F9FC',
  border: '#E2E8F2',
  brand: '#7C9EFF',
  card: '#FFFFFF',
  dark: '#0B0F14',
  hairline: '#EDF1F7',
  muted: '#66758A',
  soft: '#F3F6FB',
  success: '#4ADE80',
  warning: '#FFD166',
  danger: '#FF7A7A',
  purple: '#B388FF',
} as const

const statusThemes: Record<WorkSessionStatus, PdfStatusTheme> = {
  ACTIVE: {
    label: 'Activo',
    background: '#F2F5FF',
    border: '#D8E2FF',
    text: '#4B63A8',
  },
  PAUSED: {
    label: 'En pausa',
    background: '#FFF9E8',
    border: '#F2DFA5',
    text: '#846A24',
  },
  COMPLETED: {
    label: 'Completado',
    background: '#F0FBF4',
    border: '#CDEFD8',
    text: '#2C7545',
  },
  EDITED: {
    label: 'Editado',
    background: '#F7F1FF',
    border: '#E0CEFF',
    text: '#7255A7',
  },
}

const getExportUserName = (metadata: WorkSessionsExportMetadata) =>
  metadata.userName?.trim() || 'Usuario Nuba'

const sortSessionsForReport = (sessions: WorkSession[]) =>
  [...sessions].sort(
    (left, right) => new Date(left.startTime).getTime() - new Date(right.startTime).getTime(),
  )

const getExportSummary = (sessions: WorkSession[]): ExportSummary =>
  sessions.reduce<ExportSummary>(
    (summary, session) => ({
      breakMinutes: summary.breakMinutes + (session.breakMinutes ?? 0),
      recordsCount: summary.recordsCount + 1,
      workedMinutes: summary.workedMinutes + (session.workedMinutes ?? 0),
    }),
    {
      breakMinutes: 0,
      recordsCount: 0,
      workedMinutes: 0,
    },
  )

const formatDuration = (minutes: number) => {
  const safeMinutes = Math.max(0, Math.round(minutes || 0))

  if (safeMinutes < 60) {
    return `${safeMinutes} min`
  }

  const hours = Math.floor(safeMinutes / 60)
  const remainder = safeMinutes % 60

  return `${hours} h ${remainder.toString().padStart(2, '0')} min`
}

const formatBusinessDate = (value: string) =>
  formatInTimeZone(`${value}T12:00:00Z`, env.businessTimeZone, 'd MMM yyyy', {
    locale: es,
  })

const formatGeneratedDate = (value: string) =>
  formatInTimeZone(value, env.businessTimeZone, "d MMM yyyy, HH:mm", {
    locale: es,
  })

const formatClock = (value: string) => formatInTimeZone(value, env.businessTimeZone, 'HH:mm')

const getBusinessDateFromInstant = (value: string) =>
  formatInTimeZone(value, env.businessTimeZone, 'yyyy-MM-dd')

const getDateOffsetInDays = (fromDate: string, toDate: string) =>
  Math.max(
    0,
    Math.round(
      (new Date(`${toDate}T00:00:00Z`).getTime() -
        new Date(`${fromDate}T00:00:00Z`).getTime()) /
        86_400_000,
    ),
  )

const getSessionEndDayOffset = (session: WorkSession) => {
  if (!session.endTime) {
    return 0
  }

  return getDateOffsetInDays(
    getBusinessDateFromInstant(session.startTime),
    getBusinessDateFromInstant(session.endTime),
  )
}

const formatSessionEndTime = (session: WorkSession) => {
  if (!session.endTime) {
    return 'En curso'
  }

  const dayOffset = getSessionEndDayOffset(session)
  const suffix = dayOffset > 0 ? ` +${dayOffset}d` : ''

  return `${formatClock(session.endTime)}${suffix}`
}

const formatSessionEndTimeForCsv = (session: WorkSession) => {
  if (!session.endTime) {
    return 'En curso'
  }

  const dayOffset = getSessionEndDayOffset(session)
  const suffix = dayOffset > 0 ? ` (+${dayOffset} día${dayOffset > 1 ? 's' : ''})` : ''

  return `${formatClock(session.endTime)}${suffix}`
}

const getExportPeriodLabel = (metadata: WorkSessionsExportMetadata) => {
  if (metadata.from && metadata.to) {
    return `${formatBusinessDate(metadata.from)} - ${formatBusinessDate(metadata.to)}`
  }

  if (metadata.from) {
    return `Desde ${formatBusinessDate(metadata.from)}`
  }

  if (metadata.to) {
    return `Hasta ${formatBusinessDate(metadata.to)}`
  }

  return 'Todo el historial'
}

const quoteCsvValue = (value: string | number) => {
  const text = String(value)

  if (!/[;"\n\r]/.test(text)) {
    return text
  }

  return `"${text.replaceAll('"', '""')}"`
}

const csvRow = (values: Array<string | number>) => values.map(quoteCsvValue).join(';')

export const buildWorkSessionsCsv = (
  sessions: WorkSession[],
  metadata: WorkSessionsExportMetadata,
) => {
  const sortedSessions = sortSessionsForReport(sessions)
  const summary = getExportSummary(sortedSessions)
  const lines = [
    csvRow(['Informe de registros']),
    csvRow(['Usuario', getExportUserName(metadata)]),
    csvRow(['Periodo', getExportPeriodLabel(metadata)]),
    csvRow(['Generado', formatGeneratedDate(metadata.generatedAt)]),
    '',
    csvRow(['Resumen']),
    csvRow(['Total trabajado', formatDuration(summary.workedMinutes)]),
    csvRow(['Total de pausas', formatDuration(summary.breakMinutes)]),
    csvRow(['Registros incluidos', summary.recordsCount]),
    '',
    csvRow(['Detalle de registros']),
    csvRow(['Fecha', 'Estado', 'Inicio', 'Fin', 'Tiempo trabajado', 'Tiempo de pausa']),
  ]

  if (!sortedSessions.length) {
    lines.push(csvRow(['Sin registros en este periodo']))
  } else {
    sortedSessions.forEach((session) => {
      lines.push(
        csvRow([
          formatBusinessDate(getBusinessDateFromSession(session)),
          statusThemes[session.status].label,
          formatClock(session.startTime),
          formatSessionEndTimeForCsv(session),
          formatDuration(session.workedMinutes ?? 0),
          formatDuration(session.breakMinutes ?? 0),
        ]),
      )
    })
  }

  return new Blob([`\ufeff${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' })
}

const getBusinessDateFromSession = (session: WorkSession) =>
  formatInTimeZone(session.startTime, env.businessTimeZone, 'yyyy-MM-dd')

const pdfNumber = (value: number) => Number(value.toFixed(2)).toString()

const hexToRgb = (hex: string) => {
  const normalized = hex.replace('#', '')
  const value = Number.parseInt(normalized, 16)

  return {
    r: ((value >> 16) & 255) / 255,
    g: ((value >> 8) & 255) / 255,
    b: (value & 255) / 255,
  }
}

const fillColor = (hex: string) => {
  const { r, g, b } = hexToRgb(hex)
  return `${pdfNumber(r)} ${pdfNumber(g)} ${pdfNumber(b)} rg`
}

const strokeColor = (hex: string) => {
  const { r, g, b } = hexToRgb(hex)
  return `${pdfNumber(r)} ${pdfNumber(g)} ${pdfNumber(b)} RG`
}

const toPdfLiteral = (value: string) =>
  value
    .replaceAll(/[^\x09\x0A\x0D\x20-\xFF]/g, '?')
    .replaceAll('\\', '\\\\')
    .replaceAll('(', '\\(')
    .replaceAll(')', '\\)')

const encodeLatin1 = (value: string) => {
  const bytes = new Uint8Array(value.length)

  for (let index = 0; index < value.length; index += 1) {
    const charCode = value.charCodeAt(index)
    bytes[index] = charCode <= 255 ? charCode : 63
  }

  return bytes
}

const blobToBinaryString = async (blob: Blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const chunkSize = 0x8000
  let result = ''

  for (let index = 0; index < bytes.length; index += chunkSize) {
    result += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }

  return result
}

const imageToJpegBlob = async (source: Blob) => {
  if (typeof document === 'undefined') {
    return null
  }

  const objectUrl = URL.createObjectURL(source)
  const image = new Image()

  try {
    image.src = objectUrl
    await image.decode()

    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128

    const context = canvas.getContext('2d')
    if (!context) {
      return null
    }

    context.fillStyle = PDF_COLORS.background
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)

    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.92)
    })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

let pdfLogoPromise: Promise<PdfImage | null> | null = null

const loadPdfLogoImage = async (): Promise<PdfImage | null> => {
  if (typeof fetch === 'undefined') {
    return null
  }

  try {
    const response = await fetch(NUBA_PDF_LOGO_SRC)
    if (!response.ok) {
      return null
    }

    const jpegBlob = await imageToJpegBlob(await response.blob())
    if (!jpegBlob) {
      return null
    }

    return {
      data: await blobToBinaryString(jpegBlob),
      height: 128,
      name: 'Logo',
      width: 128,
    }
  } catch {
    return null
  }
}

const getPdfLogoImage = () => {
  pdfLogoPromise ??= loadPdfLogoImage()
  return pdfLogoPromise
}

const truncateText = (value: string, maxWidth: number, fontSize: number) => {
  const maxCharacters = Math.max(4, Math.floor(maxWidth / (fontSize * 0.52)))

  if (value.length <= maxCharacters) {
    return value
  }

  return `${value.slice(0, maxCharacters - 3).trimEnd()}...`
}

const text = ({
  color = PDF_COLORS.dark,
  font = 'F1',
  maxWidth,
  size,
  top,
  value,
  x,
}: {
  color?: string
  font?: 'F1' | 'F2'
  maxWidth?: number
  size: number
  top: number
  value: string
  x: number
}) => {
  const printableValue = maxWidth ? truncateText(value, maxWidth, size) : value
  const y = PAGE_HEIGHT - top - size

  return `BT /${font} ${pdfNumber(size)} Tf ${fillColor(color)} ${pdfNumber(x)} ${pdfNumber(y)} Td (${toPdfLiteral(printableValue)}) Tj ET`
}

const roundedRectPath = (x: number, top: number, width: number, height: number, radius: number) => {
  const y = PAGE_HEIGHT - top - height
  const safeRadius = Math.min(radius, width / 2, height / 2)
  const control = safeRadius * 0.5522847498
  const right = x + width
  const topY = y + height

  return [
    `${pdfNumber(x + safeRadius)} ${pdfNumber(y)} m`,
    `${pdfNumber(right - safeRadius)} ${pdfNumber(y)} l`,
    `${pdfNumber(right - safeRadius + control)} ${pdfNumber(y)} ${pdfNumber(right)} ${pdfNumber(y + safeRadius - control)} ${pdfNumber(right)} ${pdfNumber(y + safeRadius)} c`,
    `${pdfNumber(right)} ${pdfNumber(topY - safeRadius)} l`,
    `${pdfNumber(right)} ${pdfNumber(topY - safeRadius + control)} ${pdfNumber(right - safeRadius + control)} ${pdfNumber(topY)} ${pdfNumber(right - safeRadius)} ${pdfNumber(topY)} c`,
    `${pdfNumber(x + safeRadius)} ${pdfNumber(topY)} l`,
    `${pdfNumber(x + safeRadius - control)} ${pdfNumber(topY)} ${pdfNumber(x)} ${pdfNumber(topY - safeRadius + control)} ${pdfNumber(x)} ${pdfNumber(topY - safeRadius)} c`,
    `${pdfNumber(x)} ${pdfNumber(y + safeRadius)} l`,
    `${pdfNumber(x)} ${pdfNumber(y + safeRadius - control)} ${pdfNumber(x + safeRadius - control)} ${pdfNumber(y)} ${pdfNumber(x + safeRadius)} ${pdfNumber(y)} c`,
    'h',
  ].join('\n')
}

const roundedRect = ({
  fill,
  height,
  lineWidth = 1,
  radius,
  stroke,
  top,
  width,
  x,
}: {
  fill?: string
  height: number
  lineWidth?: number
  radius: number
  stroke?: string
  top: number
  width: number
  x: number
}) => {
  const operations = []

  if (fill) {
    operations.push(fillColor(fill))
  }

  if (stroke) {
    operations.push(strokeColor(stroke), `${pdfNumber(lineWidth)} w`)
  }

  operations.push(roundedRectPath(x, top, width, height, radius))
  operations.push(fill && stroke ? 'B' : fill ? 'f' : 'S')

  return operations.join('\n')
}

const rect = ({
  fill,
  height,
  top,
  width,
  x,
}: {
  fill: string
  height: number
  top: number
  width: number
  x: number
}) => {
  const y = PAGE_HEIGHT - top - height
  return `${fillColor(fill)} ${pdfNumber(x)} ${pdfNumber(y)} ${pdfNumber(width)} ${pdfNumber(height)} re f`
}

const hairline = (x: number, top: number, width: number, color: string = PDF_COLORS.hairline) =>
  rect({ x, top, width, height: 0.65, fill: color })

const drawPdfImage = (image: PdfImage, x: number, top: number, width: number, height: number) => {
  const y = PAGE_HEIGHT - top - height
  return `q ${pdfNumber(width)} 0 0 ${pdfNumber(height)} ${pdfNumber(x)} ${pdfNumber(y)} cm /${image.name} Do Q`
}

const drawPageBase = () =>
  [
    rect({ x: 0, top: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, fill: PDF_COLORS.background }),
  ].join('\n')

const drawMainHeader = (metadata: WorkSessionsExportMetadata, context: PdfRenderContext) => {
  const userName = getExportUserName(metadata)

  return [
    context.logo
      ? drawPdfImage(context.logo, PAGE_MARGIN, 32, 23, 23)
      : rect({ x: PAGE_MARGIN, top: 34, width: 30, height: 2, fill: PDF_COLORS.brand }),
    text({
      x: context.logo ? PAGE_MARGIN + 32 : PAGE_MARGIN,
      top: context.logo ? 42 : 50,
      size: 8,
      font: 'F2',
      color: PDF_COLORS.brand,
      value: 'NUBA',
    }),
    text({
      x: PAGE_MARGIN,
      top: 72,
      size: 27,
      font: 'F2',
      color: PDF_COLORS.dark,
      value: 'Informe de registros',
      maxWidth: 285,
    }),
    text({
      x: PAGE_MARGIN,
      top: 108,
      size: 10,
      color: PDF_COLORS.muted,
      value: 'Resumen de tus jornadas de trabajo.',
      maxWidth: 306,
    }),
    roundedRect({
      x: 356,
      top: 34,
      width: 201,
      height: 104,
      radius: 18,
      fill: PDF_COLORS.card,
      stroke: PDF_COLORS.border,
    }),
    text({ x: 374, top: 48, size: 7, font: 'F2', color: PDF_COLORS.muted, value: 'USUARIO' }),
    text({
      x: 374,
      top: 60,
      size: 10,
      font: 'F2',
      color: PDF_COLORS.dark,
      value: userName,
      maxWidth: 160,
    }),
    hairline(374, 78, 158),
    text({ x: 374, top: 88, size: 7, font: 'F2', color: PDF_COLORS.muted, value: 'PERIODO' }),
    text({
      x: 374,
      top: 100,
      size: 8.7,
      color: PDF_COLORS.dark,
      value: getExportPeriodLabel(metadata),
      maxWidth: 160,
    }),
    hairline(374, 117, 158),
    text({ x: 374, top: 125, size: 7, font: 'F2', color: PDF_COLORS.muted, value: 'GENERADO' }),
    text({
      x: 440,
      top: 125,
      size: 7.8,
      color: PDF_COLORS.dark,
      value: formatGeneratedDate(metadata.generatedAt),
      maxWidth: 92,
    }),
  ].join('\n')
}

const drawCompactHeader = (metadata: WorkSessionsExportMetadata, context: PdfRenderContext) =>
  [
    context.logo
      ? drawPdfImage(context.logo, PAGE_MARGIN, 38, 16, 16)
      : rect({ x: PAGE_MARGIN, top: 38, width: 22, height: 2, fill: PDF_COLORS.brand }),
    text({
      x: context.logo ? PAGE_MARGIN + 24 : PAGE_MARGIN,
      top: 54,
      size: 15,
      font: 'F2',
      color: PDF_COLORS.dark,
      value: 'Informe de registros',
    }),
    text({
      x: context.logo ? PAGE_MARGIN + 24 : PAGE_MARGIN,
      top: 78,
      size: 9,
      color: PDF_COLORS.muted,
      value: getExportPeriodLabel(metadata),
      maxWidth: 280,
    }),
    text({ x: 516, top: 54, size: 8, font: 'F2', color: PDF_COLORS.brand, value: 'Nuba' }),
    hairline(PAGE_MARGIN, 98, TABLE_WIDTH),
  ].join('\n')

const drawSummaryCards = (summary: ExportSummary) => {
  const cards: PdfMetricCard[] = [
    {
      accent: PDF_COLORS.success,
      label: 'TOTAL TRABAJADO',
      value: formatDuration(summary.workedMinutes),
      subtitle: 'Tiempo efectivo registrado',
    },
    {
      accent: PDF_COLORS.warning,
      label: 'TOTAL DE PAUSAS',
      value: formatDuration(summary.breakMinutes),
      subtitle: 'Descansos acumulados',
    },
    {
      accent: PDF_COLORS.brand,
      label: 'REGISTROS',
      value: String(summary.recordsCount),
      subtitle: 'Jornadas incluidas',
    },
  ]
  const top = 158
  const height = 76
  const columnWidth = TABLE_WIDTH / 3

  return [
    roundedRect({
      x: PAGE_MARGIN,
      top,
      width: TABLE_WIDTH,
      height,
      radius: 20,
      fill: PDF_COLORS.card,
      stroke: PDF_COLORS.border,
    }),
    rect({ x: PAGE_MARGIN + columnWidth, top: top + 15, width: 0.8, height: height - 30, fill: PDF_COLORS.border }),
    rect({ x: PAGE_MARGIN + columnWidth * 2, top: top + 15, width: 0.8, height: height - 30, fill: PDF_COLORS.border }),
    ...cards.flatMap((card, index) => {
      const x = PAGE_MARGIN + columnWidth * index + 20

      return [
        rect({ x, top: top + 14, width: 20, height: 2, fill: card.accent }),
        text({ x, top: top + 25, size: 7.3, font: 'F2', color: PDF_COLORS.muted, value: card.label }),
        text({ x, top: top + 41, size: 17.2, font: 'F2', color: PDF_COLORS.dark, value: card.value, maxWidth: columnWidth - 40 }),
        text({ x, top: top + 61, size: 8, color: PDF_COLORS.muted, value: card.subtitle, maxWidth: columnWidth - 40 }),
      ]
    }),
  ].join('\n')
}

const drawStatusChip = (status: WorkSessionStatus, cellX: number, cellWidth: number, top: number) => {
  const theme = statusThemes[status]

  const fontSize = 7.1
  const chipHeight = 18
  const horizontalPadding = 8
  const minWidth = 46

  const estimatedTextWidth = theme.label.length * fontSize * 0.58
  const width = Math.max(minWidth, estimatedTextWidth + horizontalPadding * 2)

  // chip alineado al inicio de la columna
  const x = cellX + 2

  // texto centrado horizontalmente dentro del chip
  const textX = x + (width - estimatedTextWidth) / 2

  // texto centrado verticalmente de forma visual
  const textTop = top + (chipHeight - fontSize) / 2 - 1

  return [
    roundedRect({
      x,
      top,
      width,
      height: chipHeight,
      radius: 9,
      fill: theme.background,
      stroke: theme.border,
      lineWidth: 0.6,
    }),
    text({
      x: textX,
      top: textTop,
      size: fontSize,
      font: 'F2',
      color: theme.text,
      value: theme.label,
      maxWidth: width - horizontalPadding * 2,
    }),
  ].join('\n')
}

const drawTableHeader = (top: number) => {
  const columns = [
    { label: 'FECHA', x: TABLE_COLUMNS.date },
    { label: 'ESTADO', x: TABLE_COLUMNS.status + 2 },
    { label: 'INICIO', x: TABLE_COLUMNS.start },
    { label: 'FIN', x: TABLE_COLUMNS.end },
    { label: 'TRABAJO', x: TABLE_COLUMNS.work },
    { label: 'PAUSA', x: TABLE_COLUMNS.break },
  ]

  return [
    hairline(PAGE_MARGIN + 14, top + 24, TABLE_WIDTH - 28, PDF_COLORS.border),
    ...columns.map((column) =>
      text({
        x: column.x,
        top: top + 9,
        size: 7.1,
        font: 'F2',
        color: PDF_COLORS.muted,
        value: column.label,
      }),
    ),
  ].join('\n')
}

const drawEmptyRecords = (top: number) =>
  [
    text({ x: 64, top: top + 78, size: 14, font: 'F2', color: PDF_COLORS.dark, value: 'Sin registros en este periodo' }),
    text({
      x: 64,
      top: top + 105,
      size: 10,
      color: PDF_COLORS.muted,
      value: 'Cuando haya jornadas cerradas o en curso aparecerán aquí de forma resumida.',
      maxWidth: 430,
    }),
  ].join('\n')

const drawSessionRow = (
  session: WorkSession,
  index: number,
  top: number,
  isLastRow: boolean,
) => {
  const rowTop = top + index * ROW_HEIGHT
  const fill = index % 2 === 0 ? null : '#FAFCFF'
  const rowFillTop = rowTop + TABLE_ROW_VERTICAL_INSET
  const rowFillHeight = ROW_HEIGHT - TABLE_ROW_VERTICAL_INSET * 2

  return [
    fill
      ? rect({
          x: PAGE_MARGIN + TABLE_ROW_INSET,
          top: rowFillTop,
          width: TABLE_WIDTH - TABLE_ROW_INSET * 2,
          height: rowFillHeight,
          fill,
        })
      : '',
    isLastRow ? '' : hairline(PAGE_MARGIN + 14, rowTop + ROW_HEIGHT, TABLE_WIDTH - 28, PDF_COLORS.hairline),
    text({
      x: TABLE_COLUMNS.date,
      top: rowTop + 14,
      size: 9,
      font: 'F2',
      color: PDF_COLORS.dark,
      value: formatBusinessDate(getBusinessDateFromSession(session)),
      maxWidth: 94,
    }),
    drawStatusChip(session.status, TABLE_COLUMNS.status, STATUS_COLUMN_WIDTH, rowTop + 9.5),
    text({ x: TABLE_COLUMNS.start, top: rowTop + 14, size: 9, color: PDF_COLORS.dark, value: formatClock(session.startTime) }),
    text({
      x: TABLE_COLUMNS.end,
      top: rowTop + 14,
      size: 9,
      color: session.endTime ? PDF_COLORS.dark : PDF_COLORS.muted,
      value: formatSessionEndTime(session),
      maxWidth: 64,
    }),
    text({
      x: TABLE_COLUMNS.work,
      top: rowTop + 14,
      size: 9,
      font: 'F2',
      color: PDF_COLORS.dark,
      value: formatDuration(session.workedMinutes ?? 0),
      maxWidth: 78,
    }),
    text({
      x: TABLE_COLUMNS.break,
      top: rowTop + 14,
      size: 9,
      color: PDF_COLORS.dark,
      value: formatDuration(session.breakMinutes ?? 0),
      maxWidth: 70,
    }),
  ].join('\n')
}

const drawTable = (sessions: WorkSession[], top: number) => {
  const rowsTop = top + 45
  const tableHeight = sessions.length ? 52 + sessions.length * ROW_HEIGHT : 164
  const table = [
    roundedRect({
      x: PAGE_MARGIN,
      top,
      width: TABLE_WIDTH,
      height: tableHeight,
      radius: 18,
      fill: PDF_COLORS.card,
      stroke: PDF_COLORS.border,
    }),
    drawTableHeader(top + 18),
  ]

  if (!sessions.length) {
    table.push(drawEmptyRecords(top))
  } else {
    table.push(
      ...sessions.map((session, index) =>
        drawSessionRow(session, index, rowsTop, index === sessions.length - 1),
      ),
    )
  }

  return table.join('\n')
}

const drawFooter = (pageNumber: number, pageCount: number) =>
  [
    text({ x: PAGE_MARGIN, top: 810, size: 8, color: PDF_COLORS.muted, value: 'Nuba - Informe de jornada' }),
    text({
      x: 494,
      top: 810,
      size: 8,
      color: PDF_COLORS.muted,
      value: `Página ${pageNumber} de ${pageCount}`,
      maxWidth: 70,
    }),
  ].join('\n')

const paginateSessions = (sessions: WorkSession[]) => {
  if (sessions.length <= FIRST_PAGE_CAPACITY) {
    return [sessions]
  }

  const pages = [sessions.slice(0, FIRST_PAGE_CAPACITY)]
  let offset = FIRST_PAGE_CAPACITY

  while (offset < sessions.length) {
    pages.push(sessions.slice(offset, offset + NEXT_PAGE_CAPACITY))
    offset += NEXT_PAGE_CAPACITY
  }

  return pages
}

const drawPdfPage = ({
  metadata,
  pageCount,
  pageNumber,
  renderContext,
  sessions,
  summary,
}: {
  metadata: WorkSessionsExportMetadata
  pageCount: number
  pageNumber: number
  renderContext: PdfRenderContext
  sessions: WorkSession[]
  summary: ExportSummary
}) => {
  const isFirstPage = pageNumber === 1
  const hasNextDayEnding = sessions.some((session) => getSessionEndDayOffset(session) > 0)

  return [
    drawPageBase(),
    isFirstPage ? drawMainHeader(metadata, renderContext) : drawCompactHeader(metadata, renderContext),
    isFirstPage ? drawSummaryCards(summary) : '',
    isFirstPage
      ? text({ x: PAGE_MARGIN, top: 252, size: 15, font: 'F2', color: PDF_COLORS.dark, value: 'Detalle de registros' })
      : '',
    isFirstPage
      ? text({
          x: 398,
          top: 256,
          size: 8.6,
          color: PDF_COLORS.muted,
          value: getExportPeriodLabel(metadata),
          maxWidth: 154,
        })
      : '',
    hasNextDayEnding
      ? [
          rect({
            x: PAGE_MARGIN,
            top: isFirstPage ? 275 : 105,
            width: 10,
            height: 1.2,
            fill: PDF_COLORS.brand,
          }),
          text({
            x: PAGE_MARGIN + 16,
            top: isFirstPage ? 271 : 101,
            size: 8,
            color: PDF_COLORS.muted,
            value: '+1d indica una salida finalizada al día siguiente.',
            maxWidth: 260,
          }),
        ].join('\n')
      : '',
    drawTable(sessions, isFirstPage ? FIRST_PAGE_TABLE_TOP : NEXT_PAGE_TABLE_TOP),
    drawFooter(pageNumber, pageCount),
  ]
    .filter(Boolean)
    .join('\n')
}

const createPdfBlob = (streams: string[], logo: PdfImage | null) => {
  const fontRegularId = 3 + streams.length * 2
  const fontBoldId = fontRegularId + 1
  const logoId = logo ? fontBoldId + 1 : null
  const xObjectResource = logo && logoId ? `/XObject << /${logo.name} ${logoId} 0 R >>` : ''
  const pageIds = streams.map((_, index) => 3 + index * 2)

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    `2 0 obj\n<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${streams.length} >>\nendobj\n`,
    ...streams.flatMap((stream, index) => {
      const pageId = 3 + index * 2
      const contentId = pageId + 1

      return [
        `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> ${xObjectResource} >> /Contents ${contentId} 0 R >>\nendobj\n`,
        `${contentId} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`,
      ]
    }),
    `${fontRegularId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n`,
    `${fontBoldId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n`,
    ...(logo && logoId
      ? [
          `${logoId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.data.length} >>\nstream\n${logo.data}\nendstream\nendobj\n`,
        ]
      : []),
  ]

  let pdf = '%PDF-1.4\n'
  const offsets = [0]

  objects.forEach((object) => {
    offsets.push(pdf.length)
    pdf += object
  })

  const xrefOffset = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`

  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`

  return new Blob([encodeLatin1(pdf)], { type: 'application/pdf' })
}

export const buildWorkSessionsPdf = async (
  sessions: WorkSession[],
  metadata: WorkSessionsExportMetadata,
) => {
  const sortedSessions = sortSessionsForReport(sessions)
  const summary = getExportSummary(sortedSessions)
  const pages = paginateSessions(sortedSessions)
  const logo = await getPdfLogoImage()
  const streams = pages.map((pageSessions, index) =>
    drawPdfPage({
      metadata,
      pageCount: pages.length,
      pageNumber: index + 1,
      renderContext: { logo },
      sessions: pageSessions,
      summary,
    }),
  )

  return createPdfBlob(streams, logo)
}
