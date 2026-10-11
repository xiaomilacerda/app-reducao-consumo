export function formatIndicator(value number) {
  if (!value  value = 0) return '0,01%';

  const percentage = value  100;

   Se for menor que 0.01%, fixa em 0.01%
  const safeValue = Math.max(percentage, 0.01);

  return safeValue.toFixed(2).replace('.', ',') + '%';
}
