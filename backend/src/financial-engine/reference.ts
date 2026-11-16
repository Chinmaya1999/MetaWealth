import type { Questionnaire } from "./types";
// Synthetic-from-reference demo case (BRD section 13), rebased to 2026. Amounts unchanged.
export const REFERENCE_CLIENT: Questionnaire = {
  profile: { name: "Demo Client One", dob: "1979-10-05", spouseDob: "1979-09-02", residency: "Resident Indian", retirementAge: 55, lifeExpectancy: 85, will: "No", nominees: "No" },
  income: { ctc: 3_500_000, takeHome: 160_000, bonus: 350_000, growth: 10, otherMonthly: 0, taxRate: 21.5 },
  expenses: { monthly: 104_600, annual: 400 },
  retirement: { pf: 937_000, pfMonthly: 17_462, superannuation: 0, retirementMonthlyExpense: 60_000 },
  nonFinancial: { realEstate: 100_000_000, gold: 250_000, other: 100_000 },
  assets: [
    { name: "Citi savings", type: "cash", value: 145_000 }, { name: "ICICI savings", type: "cash", value: 200_000 },
    { name: "HDFC savings", type: "cash", value: 5_000 }, { name: "Other savings", type: "cash", value: 5_000 },
    { name: "Equity mutual fund", type: "equity", value: 10_000, maturityYear: 2028 }, { name: "Bank fixed deposit", type: "debt", value: 50_000, maturityYear: 2028 },
    { name: "Kisan Vikas Patra", type: "debt", value: 20_000, maturityYear: 2034 },
  ],
  loans: [{ name: "Credit card", outstanding: 8_000, emi: 2_600, months: 3, rate: 36 }, { name: "Vehicle loan", emi: 15_000, months: 60, rate: 11 }],
  insurance: {
    life: [
      { name: "Pension plan (spouse)", type: "pension", sumAssured: 0, premium: 25_000 }, { name: "Money back (spouse)", type: "moneyback", sumAssured: 250_000, premium: 17_712 },
      { name: "Pension plan (self)", type: "pension", sumAssured: 0, premium: 30_000 }, { name: "Unit-linked (self)", type: "ulip", sumAssured: 1_200_000, premium: 25_000, fundValue: 865_680 },
    ], healthSumInsured: 300_000, healthPremium: 2_880,
  },
  goals: [
    { name: "Daughter boarding education", category: "education", amount: 300_000, startYear: 2036, endYear: 2041, inflation: 8, priority: 2 },
    { name: "Daughter higher education", category: "education", amount: 300_000, startYear: 2042, endYear: 2045, inflation: 8, priority: 3 },
    { name: "Daughter marriage", category: "marriage", amount: 1_500_000, startYear: 2049, inflation: 5, priority: 4 },
    { name: "White goods", category: "lifestyle", amount: 50_000, startYear: 2027, endYear: 2037, inflation: 5, priority: 5 },
    { name: "International vacation", category: "lifestyle", amount: 250_000, startYear: 2029, endYear: 2063, frequency: 3, inflation: 5, priority: 6 },
    { name: "Vacation with parents", category: "lifestyle", amount: 400_000, startYear: 2028, inflation: 5, priority: 7 },
    { name: "Capital for business", category: "business", amount: 500_000, startYear: 2030, inflation: 8, priority: 8 },
    { name: "House purchase", category: "property", amount: 10_000_000, startYear: 2035, inflation: 8, priority: 9, loanPct: 52 },
  ],
  risk: { answers: [3, 3, 3, 2, 3, 4, 1, 3, 3, 3] },
};
