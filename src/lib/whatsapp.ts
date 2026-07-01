// Utilitários para gerar links wa.me a partir de telefones digitados livremente.

/**
 * Converte um telefone digitado (com máscara, espaços etc.) em só dígitos,
 * prefixando o DDI 55 do Brasil quando faz sentido.
 * - Remove tudo que não é dígito.
 * - Se já começar com 55, mantém.
 * - Se tiver 10 ou 11 dígitos (DDD + número), prefixa 55.
 * - Caso contrário, retorna os dígitos como estão (não trava a tela).
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('55')) return digits
  if (digits.length === 10 || digits.length === 11) return '55' + digits
  return digits
}

/**
 * Monta um link wa.me para o telefone informado, com mensagem opcional.
 */
export function waLink(phone: string, message?: string): string {
  const num = normalizePhone(phone)
  const base = `https://wa.me/${num}`
  return message && message.trim() ? `${base}?text=${encodeURIComponent(message)}` : base
}
