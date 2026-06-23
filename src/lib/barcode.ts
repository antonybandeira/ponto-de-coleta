// Gera códigos de barras únicos no formato EAN-13, prefixo fixo 200
// (faixa reservada para uso interno, nunca emitida pela GS1 para produtos reais).
const PREFIX = '200'

function calculateCheckDigit(digits12: string): number {
  let sum = 0
  for (let i = 0; i < 12; i++) {
    const digit = Number(digits12[i])
    sum += i % 2 === 0 ? digit : digit * 3
  }
  return (10 - (sum % 10)) % 10
}

/**
 * Recebe a lista de barcodes já existentes (podem incluir nulls/outros formatos)
 * e retorna o próximo código EAN-13 disponível com o prefixo interno.
 */
export function nextBarcode(existingBarcodes: (string | null)[]): string {
  const usedSequences = existingBarcodes
    .filter((b): b is string => !!b && b.startsWith(PREFIX) && b.length === 13)
    .map(b => Number(b.slice(PREFIX.length, 12)))
    .filter(n => !isNaN(n))

  const nextSeq = usedSequences.length > 0 ? Math.max(...usedSequences) + 1 : 1
  const seqStr = String(nextSeq).padStart(9, '0')
  const digits12 = PREFIX + seqStr
  const checkDigit = calculateCheckDigit(digits12)
  return digits12 + String(checkDigit)
}
