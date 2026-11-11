// Catálogo unificado: uma compra definitiva, sem assinatura.
// Para Android, o preço real vem da Google Play, nunca deste arquivo.
import { WEEDRESET_PRODUCT_ID, SUGGESTED_PRICE_BRL } from "./monetization";
export const ONE_TIME_ACCESS = {
  productId: WEEDRESET_PRODUCT_ID,
  label: "WeedReset Completo",
  pricingModel: "one_time" as const,
  suggestedPriceBrazil: SUGGESTED_PRICE_BRL,
};
