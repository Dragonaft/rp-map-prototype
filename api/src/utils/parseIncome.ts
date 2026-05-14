export const parseIncome = (income: string | number | null | undefined): number => {
  const n = Number(income);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
