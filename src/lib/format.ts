/** Formata a proporção (0 a 1) como porcentagem em pt-BR. */
export function formatIndicator(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0,01%';
  const percentage = value * 100;
  const safeValue = Math.max(percentage, 0.01);
  return safeValue.toFixed(2).replace('.', ',') + '%';
}
