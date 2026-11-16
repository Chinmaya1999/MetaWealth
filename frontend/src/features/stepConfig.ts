export type FieldType = "text" | "number" | "date" | "select" | "checkbox";
export interface Field { key: string; label: string; type?: FieldType; options?: string[]; hint?: string }
export type Block =
  | { kind: "fields"; path: string; title?: string; fields: Field[] }
  | { kind: "rows"; path: string; title: string; columns: Field[]; blank: Record<string, any>; help?: string }
  | { kind: "risk" };
export interface StepDef { n: number; title: string; why: string; groups: string[]; blocks: Block[] }

const YN = ["", "Yes", "No"];
const money = (key: string, label: string): Field => ({ key, label, type: "number" });
export const RISK_Q: [string, ...string[]][] = [
  ["Long-term growth matters more than regular income", "Strongly disagree", "Disagree", "Agree", "Strongly agree"],
  ["I can tolerate sharp short-term ups and downs", "Strongly disagree", "Disagree", "Agree", "Strongly agree"],
  ["I prefer a 50% chance of −5% / +20% over a sure 5%", "Strongly disagree", "Disagree", "Agree", "Strongly agree"],
  ["I am comfortable holding an investment that falls sharply", "Strongly disagree", "Disagree", "Agree", "Strongly agree"],
  ["I will hold shares to beat inflation", "Strongly disagree", "Disagree", "Agree", "Strongly agree"],
  ["I am comfortable waiting 10 years for returns", "Very uncomfortable", "Uncomfortable", "Comfortable", "Very comfortable"],
  ["Investing experience", "Inexperienced", "Somewhat inexperienced", "Somewhat experienced", "Very experienced"],
  ["Return I expect in normal markets", "0–4% a year", "5–9% a year", "10–15% a year", "Over 15% a year"],
  ["Riskiest investment I would make", "Bank savings", "Investment-grade bonds", "Blue-chip shares", "Futures contract"],
  ["I would consider high-risk, high-volatility investments", "Never", "Rarely", "Sometimes", "Always"],
];

export const STEPS: StepDef[] = [
  { n: 1, title: "Documents", why: "Upload documents you already hold. Values are read for you to confirm; nothing is trusted until you confirm it.", groups: ["documents"], blocks: [] },
  { n: 2, title: "Personal & family", why: "Age and timeline drive every projection. Retirement age and life expectancy set how long your money must last.", groups: ["profile"], blocks: [
    { kind: "fields", path: "profile", title: "You", fields: [
      { key: "name", label: "Full name" }, { key: "dob", label: "Date of birth", type: "date" }, { key: "gender", label: "Gender", type: "select", options: ["", "Male", "Female", "Other"] },
      { key: "maritalStatus", label: "Marital status", type: "select", options: ["", "Married", "Single", "Divorced", "Widowed"] },
      { key: "residency", label: "Residency", type: "select", options: ["Resident Indian", "NRI - USA", "NRI - UAE", "NRI - UK", "NRI - Other", "Returning NRI", "OCI/PIO"] },
      { key: "occupation", label: "Designation and employer" }, { key: "retirementAge", label: "Retirement age", type: "number" }, { key: "lifeExpectancy", label: "Life expectancy", type: "number", hint: "Default 85" },
      { key: "phone", label: "Mobile" }, { key: "address", label: "Address" }] },
    { kind: "fields", path: "profile", title: "Spouse", fields: [
      { key: "spouseName", label: "Spouse name" }, { key: "spouseDob", label: "Spouse date of birth", type: "date" }, { key: "spouseOccupation", label: "Spouse occupation" }, { key: "spouseRetirementAge", label: "Spouse retirement age", type: "number" }] },
    { kind: "rows", path: "profile.dependants", title: "Family members and dependants", blank: { name: "", relation: "Child", dob: "", dependant: "Yes" }, columns: [
      { key: "name", label: "Name" }, { key: "relation", label: "Relationship" }, { key: "dob", label: "Date of birth", type: "date" }, { key: "dependant", label: "Dependant?", type: "select", options: ["Yes", "No"] }] }] },
  { n: 3, title: "Goals", why: "Each goal is valued in its goal year and funded in priority order (1 = first). For a date range such as 2022–2027, the amount is the total across the range unless you choose 'per occurrence'.", groups: ["goals"], blocks: [
    { kind: "rows", path: "goals", title: "Financial goals (today's value)", blank: { name: "", category: "lifestyle", amount: "", amountBasis: "total", startYear: new Date().getFullYear() + 5, endYear: "", frequency: 1, inflation: "", priority: 1, loanPct: "" }, columns: [
      { key: "name", label: "Goal" }, { key: "category", label: "Type", type: "select", options: ["education", "marriage", "property", "lifestyle", "business", "medical", "vehicle"] },
      { key: "amount", label: "Amount ₹", type: "number" }, { key: "amountBasis", label: "Amount is", type: "select", options: ["total", "perOccurrence"] }, { key: "startYear", label: "Start yr", type: "number" }, { key: "endYear", label: "End yr (blank = one-time)", type: "number" },
      { key: "frequency", label: "Every n yrs", type: "number" }, { key: "inflation", label: "Infl %", type: "number" }, { key: "priority", label: "Priority", type: "number" }, { key: "loanPct", label: "Loan %", type: "number" }] }] },
  { n: 4, title: "Financial assets", why: "Assets that can fund goals. Fixed deposits and bonds grow at their own rate to the maturity date; give a maturity date or year.", groups: ["assets"], blocks: [
    { kind: "rows", path: "assets", title: "Bank, deposits, funds, shares, gold", blank: { name: "", owner: "Self", type: "cash", value: "", rate: "", maturityDate: "", maturityYear: "" }, columns: [
      { key: "name", label: "Asset" }, { key: "owner", label: "Owner", type: "select", options: ["Self", "Spouse", "Joint"] }, { key: "type", label: "Type", type: "select", options: ["cash", "debt", "equity", "balanced", "gold", "international", "other"] },
      { key: "value", label: "Value ₹", type: "number" }, { key: "rate", label: "Interest %", type: "number" }, { key: "maturityDate", label: "Maturity date", type: "date" }, { key: "maturityYear", label: "or Maturity yr", type: "number" }] }] },
  { n: 5, title: "Property & retirement", why: "Personal-use assets count in net worth but are never used to fund goals.", groups: ["nonFinancial", "retirement"], blocks: [
    { kind: "fields", path: "nonFinancial", title: "Non-financial assets", fields: [money("realEstate", "Real estate ₹"), money("gold", "Gold & jewellery ₹"), money("other", "Other personal assets (silver, vehicle, art) ₹")] },
    { kind: "fields", path: "retirement", title: "Retirement assets", fields: [money("pf", "Provident fund balance ₹"), money("pfMonthly", "PF monthly (you + employer) ₹"), money("superannuation", "Superannuation / NPS ₹"), money("gratuityAtRetirement", "Expected gratuity at retirement ₹"), { key: "retirementMonthlyExpense", label: "Monthly spend in retirement (today) ₹", type: "number", hint: "Blank = 70% of current living" }] }] },
  { n: 6, title: "Loans & insurance", why: "Loans reduce surplus; insurance is compared with the cover your family would need. A policy on someone else (e.g. a parent) is flagged and excluded from your cashflow.", groups: ["loans", "insurance"], blocks: [
    { kind: "rows", path: "loans", title: "Loans", blank: { name: "", outstanding: "", emi: "", months: "", rate: "", startDate: "" }, help: "Leave outstanding blank to compute it from EMI, rate and months. Add the first-EMI date if the loan has not started.", columns: [{ key: "name", label: "Loan" }, { key: "outstanding", label: "Outstanding ₹", type: "number" }, { key: "emi", label: "EMI ₹", type: "number" }, { key: "months", label: "Months left", type: "number" }, { key: "rate", label: "Rate %", type: "number" }, { key: "startDate", label: "First EMI", type: "date" }] },
    { kind: "rows", path: "insurance.life", title: "Life insurance", blank: { name: "", insurer: "", insured: "self", type: "term", sumAssured: "", premium: "", startDate: "", term: "", premiumTerm: "", fundValue: "", maturityValue: "", splitEquity: "", splitDebt: "" }, help: "A term plan with zero sum assured is flagged — it is usually a pension or unit-linked plan. For unit-linked plans give the fund value and equity/debt split; maturity is estimated when you leave maturity value blank.", columns: [
      { key: "name", label: "Policy" }, { key: "insurer", label: "Insurer" }, { key: "insured", label: "Life insured", type: "select", options: ["self", "spouse", "others"] }, { key: "type", label: "Type", type: "select", options: ["term", "endowment", "ulip", "pension", "moneyback", "whole"] },
      money("sumAssured", "Sum assured ₹"), money("premium", "Premium/yr ₹"), { key: "startDate", label: "Start date", type: "date" }, money("term", "Term (yrs)"), money("premiumTerm", "Premium term (yrs)"), money("fundValue", "Fund value ₹"), money("maturityValue", "Maturity value ₹"), money("splitEquity", "Equity %"), money("splitDebt", "Debt %")] },
    { kind: "fields", path: "insurance", title: "Health insurance", fields: [money("healthSumInsured", "Family sum insured ₹"), money("healthPremium", "Premium/yr ₹")] }] },
  { n: 7, title: "Income", why: "Income growth, increment month and tax drive future surplus. CTC includes the bonus; fixed pay is CTC minus bonus.", groups: ["income"], blocks: [
    { kind: "fields", path: "income", fields: [money("ctc", "Cost to company / yr (incl. bonus) ₹"), money("bonus", "Annual bonus / variable ₹"), { key: "bonusMonth", label: "Bonus month (1–12)", type: "number", hint: "Default 4 (April)" }, money("takeHome", "Net take-home / month ₹"), money("growth", "Salary growth % / yr"), { key: "incrementMonth", label: "Increment month (1–12)", type: "number", hint: "Default 4 (April)" }, money("otherMonthly", "Other income / month ₹"), money("committedSavingsMonthly", "Committed savings / month (RD, SIP) ₹"), { key: "taxRate", label: "Effective tax % of CTC", type: "number", hint: "Blank = estimate from slabs" }] }] },
  { n: 8, title: "Living expenses", why: "Itemise as on the worksheet. We compare expenses, EMIs and savings with take-home so a shortfall shows before you finish.", groups: ["expenses"], blocks: [
    { kind: "fields", path: "expenses", title: "A. Housing (monthly)", fields: [money("rent", "Rent"), money("repairs", "House repairs")] },
    { kind: "fields", path: "expenses", title: "B. Utilities (monthly)", fields: [money("electricity", "Electricity"), money("gas", "Gas"), money("water", "Water"), money("telephone", "Telephone"), money("mobile", "Mobile phone"), money("internet", "Internet"), money("cableTv", "Cable TV")] },
    { kind: "fields", path: "expenses", title: "C. Food, clothing, transport (monthly)", fields: [money("groceries", "Fruit/vegetables/groceries"), money("restaurants", "Takeaway/restaurants"), money("clothing", "Clothing"), money("petrol", "Petrol"), money("vehicleMaintenance", "Vehicle maintenance"), money("vehicleTaxes", "Vehicle taxes/licence"), money("driver", "Driver salary"), money("servantSalary", "Servant salary"), money("transportOthers", "Others (parking, tolls, taxi)")] },
    { kind: "fields", path: "expenses", title: "D. Education (monthly)", fields: [money("schoolFees", "School fees"), money("tutoring", "Tutoring/books"), money("activities", "Sports/out-of-school"), money("schoolTransport", "School bus/transport"), { key: "schoolUntil", label: "School expenses continue until year", type: "number" }] },
    { kind: "fields", path: "expenses", title: "E. Other (monthly)", fields: [money("medical", "Medical cost"), money("personalCare", "Personal care"), money("dependantCare", "Dependant care"), money("entertainment", "Entertainment"), money("recreation", "Recreation"), money("hobbies", "Hobbies"), money("charity", "Gifts/charity"), money("giftFamily", "Gift to family and others"), money("subscriptions", "Subscriptions"), money("pocketMoney", "Pocket money (children)"), money("alcohol", "Wine/spirits"), money("tobacco", "Tobacco"), money("gardening", "Gardening"), money("servantsOther", "Servants (other)"), money("childMedical", "Child medical")] },
    { kind: "fields", path: "expenses", title: "Annual big-ticket", fields: [money("annualVacation", "Annual vacation"), money("annualClub", "Club membership"), money("annualGym", "Gym membership"), money("annualOthers", "Others")] }] },
  { n: 9, title: "Estate, risk & declaration", why: "Your risk answers set the maximum equity in every goal portfolio.", groups: ["estate", "risk"], blocks: [
    { kind: "fields", path: "estate", title: "Estate", fields: [{ key: "will", label: "Will in place?", type: "select", options: YN }, { key: "nominees", label: "Nominees on all assets?", type: "select", options: ["", "Yes", "Partly", "No"] }, { key: "executor", label: "Executor" }] },
    { kind: "risk" },
    { kind: "fields", path: "estate", title: "Declaration", fields: [{ key: "consent", label: "I confirm the information is correct and consent to its use for my financial plan", type: "checkbox" }, { key: "signedName", label: "Type your full name to sign" }] }] },
];
