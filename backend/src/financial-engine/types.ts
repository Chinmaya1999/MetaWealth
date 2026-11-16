export interface Goal { name: string; category: string; amount: number | string; startYear: number; endYear?: number | string | null; frequency?: number | string; inflation?: number | string; priority: number | string; loanPct?: number | string; currency?: string; amountBasis?: "total" | "perOccurrence" }
export interface Asset { name: string; type: "cash" | "debt" | "equity" | "balanced" | "gold" | "international" | "other"; value: number | string; owner?: string; rate?: number | string; maturityYear?: number | string | null; maturityDate?: string | null }
export interface Loan { name: string; outstanding?: number | string; emi: number | string; months: number | string; rate: number | string; startDate?: string | null }
export interface Policy { name: string; insurer?: string; insured?: "self" | "spouse" | "others"; type: "term" | "endowment" | "ulip" | "pension" | "moneyback" | "whole"; sumAssured: number | string; premium: number | string; fundValue?: number | string; startDate?: string | null; term?: number | string; premiumTerm?: number | string; maturityValue?: number | string; splitEquity?: number | string; splitDebt?: number | string }
export interface Questionnaire {
  profile?: { name?: string; dob?: string; spouseName?: string; spouseDob?: string; residency?: string; retirementAge?: number | string; spouseRetirementAge?: number | string; lifeExpectancy?: number | string; will?: string; nominees?: string; baseCurrency?: string; dependants?: { name: string; relation: string; dob: string; dependant?: string }[] };
  goals?: Goal[]; assets?: Asset[];
  nonFinancial?: { realEstate?: number | string; gold?: number | string; other?: number | string };
  retirement?: { pf?: number | string; pfMonthly?: number | string; superannuation?: number | string; gratuityAtRetirement?: number | string; retirementMonthlyExpense?: number | string };
  loans?: Loan[];
  insurance?: { life?: Policy[]; healthSumInsured?: number | string; healthPremium?: number | string };
  income?: { ctc?: number | string; takeHome?: number | string; bonus?: number | string; growth?: number | string; otherMonthly?: number | string; taxRate?: number | string; incrementMonth?: number | string; bonusMonth?: number | string; committedSavingsMonthly?: number | string };
  expenses?: { monthly?: number | string; annual?: number | string; schoolMonthly?: number | string; schoolUntil?: number | string };
  risk?: { answers?: number[]; override?: { band: string; reason: string } };
}
