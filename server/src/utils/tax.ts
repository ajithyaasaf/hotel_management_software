import prisma from './prisma';

/**
 * Cached tax rates. Re-fetched on first call and when explicitly refreshed.
 * Prevents a DB query on every billing calculation.
 */
let cachedRates: { cgstRate: number; sgstRate: number } | null = null;

export interface TaxRates {
  cgstRate: number; // e.g. 0.025 for 2.5%
  sgstRate: number;
  totalRate: number; // cgst + sgst
}

/**
 * Fetch active tax rates from TaxConfig table.
 * Returns rates as decimals (e.g. 2.5% → 0.025).
 * Falls back to 2.5% each if not configured.
 */
export async function getTaxRates(): Promise<TaxRates> {
  if (cachedRates) {
    return {
      ...cachedRates,
      totalRate: cachedRates.cgstRate + cachedRates.sgstRate,
    };
  }

  const configs = await prisma.taxConfig.findMany({ where: { isActive: true } });
  const cgstConfig = configs.find(t => t.name === 'CGST');
  const sgstConfig = configs.find(t => t.name === 'SGST');

  const cgstRate = cgstConfig ? Number(cgstConfig.rate) / 100 : 0.025;
  const sgstRate = sgstConfig ? Number(sgstConfig.rate) / 100 : 0.025;

  cachedRates = { cgstRate, sgstRate };

  return { cgstRate, sgstRate, totalRate: cgstRate + sgstRate };
}

/**
 * Force refresh the cached tax rates (call after updating TaxConfig).
 */
export function invalidateTaxCache(): void {
  cachedRates = null;
}

/**
 * Calculate tax breakdown for a given taxable amount.
 */
export async function calculateTax(taxableAmount: number): Promise<{
  cgst: number;
  sgst: number;
  totalTax: number;
}> {
  const { cgstRate, sgstRate } = await getTaxRates();
  const cgst = parseFloat((taxableAmount * cgstRate).toFixed(2));
  const sgst = parseFloat((taxableAmount * sgstRate).toFixed(2));
  return { cgst, sgst, totalTax: cgst + sgst };
}

/**
 * Calculate tax using a Prisma transaction client (for use inside $transaction blocks).
 * Reads tax rates from the transaction context.
 */
export async function calculateTaxWithTx(
  tx: any,
  taxableAmount: number,
): Promise<{ cgst: number; sgst: number; totalTax: number }> {
  const configs = await tx.taxConfig.findMany({ where: { isActive: true } });
  const cgstConfig = configs.find((t: any) => t.name === 'CGST');
  const sgstConfig = configs.find((t: any) => t.name === 'SGST');

  const cgstRate = cgstConfig ? Number(cgstConfig.rate) / 100 : 0.025;
  const sgstRate = sgstConfig ? Number(sgstConfig.rate) / 100 : 0.025;

  const cgst = parseFloat((taxableAmount * cgstRate).toFixed(2));
  const sgst = parseFloat((taxableAmount * sgstRate).toFixed(2));
  return { cgst, sgst, totalTax: cgst + sgst };
}
