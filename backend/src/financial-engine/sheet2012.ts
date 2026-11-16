import type { Questionnaire } from "./types";
import type { Assumptions } from "./assumptions";
import { DEFAULT_ASSUMPTIONS } from "./assumptions";

/**
 * Golden dataset: the client's financial data exactly as it appears in the reference plan dated 1 Sep 2012
 * (identity and contact details deliberately omitted). Note the plan's balances differ from the data gathering
 * sheet (e.g. savings 3,55,000 in the plan vs 2,50,000 on the sheet); the plan is the acceptance reference.
 */
export const GOLDEN_PLAN_DATE = new Date(2012, 8, 1);
export const GOLDEN_ASSUMPTIONS: Assumptions = {
  ...DEFAULT_ASSUMPTIONS, lifeExpectancy: 80,
  inflation: { ...DEFAULT_ASSUMPTIONS.inflation, household: 8, education: 10, postRetirement: 5 },
  returns: { cash: 6.5, debt: 8, large: 12.3, diversified: 12.55, midsmall: 13.45, balanced: 11.25, intl: 14, gold: 8, realEstate: 15, pf: 8, ppf: 8 },
};
export const SHEET_2012: Questionnaire = {
  profile: { name: "Golden Client", dob: "1979-10-05", spouseDob: "1979-09-02", residency: "Resident Indian", retirementAge: 55, lifeExpectancy: 80, will: "No", nominees: "No" },
  income: { ctc: 3_500_000, takeHome: 160_000, bonus: 350_000, growth: 10, incrementMonth: 4, taxRate: 20, committedSavingsMonthly: 3_550 },
  expenses: { monthly: 97_250, annual: 0, schoolMonthly: 10_000, schoolUntil: 2026 },
  retirement: { pf: 937_000, pfMonthly: 17_462, retirementMonthlyExpense: 60_000, gratuityAtRetirement: 2_312_640 },
  nonFinancial: { realEstate: 100_000_000, gold: 250_000, other: 100_000 },
  assets: [
    { name: "Citi Savings Account", type: "cash", value: 145_000 }, { name: "ICICI Savings Account", type: "cash", value: 200_000 },
    { name: "Spouse HDFC Savings", type: "cash", value: 5_000 }, { name: "Other Savings", type: "cash", value: 5_000 },
    { name: "SBI Magnum Tax Gain", type: "equity", value: 10_000, maturityDate: "2014-06-15" },
    { name: "Indian Overseas Bank FD", type: "debt", value: 50_000, rate: 8.6, maturityDate: "2014-07-07" },
    { name: "Kisan Vikas Patra", type: "debt", value: 20_000, rate: 8.6, maturityYear: 2020 },
  ],
  loans: [{ name: "Credit card", outstanding: 8_000, emi: 2_600, months: 3, rate: 36 }, { name: "Skoda Rapid", emi: 15_000, months: 60, rate: 11, startDate: "2012-10-01" }],
  insurance: {
    life: [
      { name: "LIC money back", insured: "spouse", type: "moneyback", sumAssured: 250_000, premium: 17_712, startDate: "1998-02-28", term: 20, maturityValue: 780_157 },
      { name: "ICICI Lifetime Saver Pension", insured: "spouse", type: "pension", sumAssured: 0, premium: 25_000, startDate: "2007-09-28", term: 17, premiumTerm: 17, maturityValue: 968_003 },
      { name: "ICICI Lifetime Super Pension", insured: "self", type: "pension", sumAssured: 0, premium: 30_000, startDate: "2007-10-04", term: 24, premiumTerm: 24, maturityValue: 2_908_412 },
      { name: "ICICI Lifetime Pru", insured: "self", type: "ulip", sumAssured: 1_200_000, premium: 25_000, fundValue: 865_680, startDate: "2006-12-28", term: 26, premiumTerm: 26, maturityValue: 3_145_639, splitEquity: 65, splitDebt: 35 },
    ], healthSumInsured: 300_000, healthPremium: 2_880,
  },
  goals: [
    { name: "Syona Boarding Education", category: "education", amount: 1_800_000, startYear: 2022, endYear: 2027, inflation: 8, priority: 2 },
    { name: "Syona Higher Education", category: "education", amount: 1_200_000, startYear: 2028, endYear: 2031, inflation: 8, priority: 3 },
    { name: "Syona Marriage", category: "marriage", amount: 1_500_000, startYear: 2035, inflation: 5, priority: 4 },
    { name: "White Good Purchase", category: "lifestyle", amount: 50_000, startYear: 2013, endYear: 2023, inflation: 5, priority: 5, amountBasis: "perOccurrence" },
    { name: "International Vacation", category: "lifestyle", amount: 250_000, startYear: 2015, endYear: 2049, frequency: 3, inflation: 5, priority: 6 },
    { name: "Vacation with Parents", category: "lifestyle", amount: 400_000, startYear: 2014, inflation: 5, priority: 7 },
    { name: "Capital For Business", category: "business", amount: 500_000, startYear: 2016, inflation: 8, priority: 8 },
    { name: "House Purchase", category: "property", amount: 10_000_000, startYear: 2021, inflation: 8, priority: 9, loanPct: 97 },
    { name: "Second Child Boarding Expenses", category: "education", amount: 1_800_000, startYear: 2026, endYear: 2031, inflation: 10, priority: 10 },
    { name: "Second Child Higher Education", category: "education", amount: 1_200_000, startYear: 2032, endYear: 2035, inflation: 8, priority: 11 },
    { name: "Second Child Marriage", category: "marriage", amount: 1_500_000, startYear: 2040, inflation: 5, priority: 12 },
  ],
  risk: { answers: [3, 3, 3, 2, 3, 4, 1, 3, 3, 3] },
};
