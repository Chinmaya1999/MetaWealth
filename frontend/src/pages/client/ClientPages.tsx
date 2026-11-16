import CalcPage from "../../features/CalcPage";
import Dashboard from "../../features/Dashboard";
import Wizard from "../../features/Wizard";
import PlansPanel from "../../features/PlansPanel";
import NriPlanner from "../../features/NriPlanner";
import { PageHeader } from "../../components/ui";

const mk = (title: string, sub: string, section: string) => () => (<><PageHeader title={title} subtitle={sub} /><CalcPage clientId="me" section={section} /></>);
export function ClientHome() {
  return (<><PageHeader title="Overview" subtitle="Your financial position at a glance." /><CalcPage clientId="me" render={(r: any) => <Dashboard r={r} />} /></>);
}
export const ClientGoals = mk("Financial goals", "Funding status for every goal.", "goals");
export const ClientCashflow = mk("Cashflow", "Income, expenses and surplus.", "cashflow");
export const ClientRetirement = mk("Retirement", "Corpus needed and projected.", "retirement");
export const ClientInsurance = mk("Insurance", "Protection gap and health cover.", "insurance");
export const ClientPortfolio = mk("Investments", "Current vs recommended allocation.", "portfolio");
export const ClientInsights = mk("Advisory insights", "Ranked, explained recommendations.", "insights");
export const ClientQuestionnaire = () => (<><PageHeader title="Questionnaire" subtitle="Nine short steps. Everything saves automatically." /><Wizard clientId="me" /></>);
export const ClientPlans = () => (<div className="md:h-full md:flex md:flex-col md:min-h-0"><div className="print:hidden shrink-0"><PageHeader title="Financial plan" subtitle="Your full plan, as released by your advisor. Download the PDF any time." /></div><PlansPanel clientId="me" fixed /></div>);

export const ClientNri = () => (<><PageHeader title="NRI planner" subtitle="Plan remittances, accounts and tax points between your country and India." /><NriPlanner clientId="me" /></>);
