export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Brasil é UTC-3 (sem horário de verão desde 2019)
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000

/**
 * Retorna o início do dia (00:00:00) no horário de Brasília, como Date em UTC.
 * Ex: 08/05 00:00 BRT = 08/05 03:00 UTC
 */
export function startOfDayBRT(date: Date = new Date()): Date {
  const brtNow = new Date(date.getTime() - BRT_OFFSET_MS)
  const midnightBRT = new Date(Date.UTC(brtNow.getUTCFullYear(), brtNow.getUTCMonth(), brtNow.getUTCDate()))
  return new Date(midnightBRT.getTime() + BRT_OFFSET_MS)
}

/**
 * Retorna o início do mês (dia 1, 00:00:00) no horário de Brasília, como Date em UTC.
 */
export function startOfMonthBRT(date: Date = new Date()): Date {
  const brtNow = new Date(date.getTime() - BRT_OFFSET_MS)
  const firstDayBRT = new Date(Date.UTC(brtNow.getUTCFullYear(), brtNow.getUTCMonth(), 1))
  return new Date(firstDayBRT.getTime() + BRT_OFFSET_MS)
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR')
}

/** Converte um ISO para o valor de um <input type="datetime-local"> no fuso local. */
export function isoToDatetimeLocal(iso: string): string {
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
