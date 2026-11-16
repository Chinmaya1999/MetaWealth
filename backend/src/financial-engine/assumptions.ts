export interface Assumptions {
  lifeExpectancy: number;
  inflation: { household: number; education: number; medical: number; lifestyle: number; property: number; marriage: number; postRetirement: number };
  returns: { cash: number; debt: number; large: number; diversified: number; midsmall: number; balanced: number; intl: number; gold: number; realEstate: number; pf: number; ppf: number };
  emergencyMonths: number;
  retirementExpenseRatio: number;
  survivorExpenseRatio: number;
  loanRate: number;
  loanMonths: number;
  inrDepreciation: number;
  thresholds: { savingsRate: number; highCostLoanRate: number; emiToTakeHome: number; realEstateShare: number; goldShare: number; ulipPremiumToIncome: number; effectiveTax: number; rebalanceGapPts: number; healthCoverIndia: number; healthCoverUsd: number; earlyRetirementAge: number; };
}
// BRD section 6.1 defaults. Planning assumptions, not forecasts.
export const DEFAULT_ASSUMPTIONS: Assumptions = {
  lifeExpectancy: 85,
  inflation: { household: 6, education: 8, medical: 10, lifestyle: 5, property: 8, marriage: 5, postRetirement: 5 },
  returns: { cash: 5, debt: 7, large: 11, diversified: 12, midsmall: 13, balanced: 10, intl: 10, gold: 7, realEstate: 8, pf: 8, ppf: 7.1 },
  emergencyMonths: 6,
  retirementExpenseRatio: 0.7,
  survivorExpenseRatio: 0.7,
  loanRate: 10,
  loanMonths: 156,
  inrDepreciation: 3,
  thresholds: { savingsRate: 20, highCostLoanRate: 24, emiToTakeHome: 40, realEstateShare: 60, goldShare: 15, ulipPremiumToIncome: 4, effectiveTax: 20, rebalanceGapPts: 15, healthCoverIndia: 1_000_000, healthCoverUsd: 100_000, earlyRetirementAge: 58 },
};
