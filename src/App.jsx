import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import BrandProvider from '@/brand/BrandProvider';
import AuthProvider from '@/context/AuthContext';
import ToastProvider from '@/context/ToastContext';
import AppLayout from '@/components/layout/AppLayout';
import RequireAuth from '@/components/layout/RequireAuth';
import { LOGIN_ROUTE, landingRouteFor } from '@/data/navigation';
import { DEFAULT_PERSPECTIVE } from '@/data/perspectives';
import { usePerspective } from '@/hooks/usePerspective';

import Login from '@/pages/Login';

// Shared across all three perspectives — same case book, different lens.
import WorkCase from '@/pages/shared/WorkCase';
import Users from '@/pages/shared/Users';
import Help from '@/pages/shared/Help';
import AccountSettings from '@/pages/shared/AccountSettings';
import Overview from '@/pages/shared/Overview';
import DisputesCases from '@/pages/shared/DisputesCases';
import Reporting from '@/pages/shared/Reporting';
import TemplatesLibrary from '@/pages/shared/TemplatesLibrary';

// Merchant — the console's original nav, carried over from the Vinted build.
import Dashboard from '@/pages/merchant/Dashboard';
import RuleGroups from '@/pages/merchant/RuleGroups';
import AddRule from '@/pages/merchant/AddRule';
import BulkActions from '@/pages/merchant/BulkActions';
import RuleCheck from '@/pages/merchant/RuleCheck';
import AssignmentReasons from '@/pages/merchant/AssignmentReasons';
import QueueManagement from '@/pages/merchant/QueueManagement';
import CaseManagement from '@/pages/merchant/CaseManagement';
import UploadCases from '@/pages/merchant/UploadCases';
import ReportsCenter from '@/pages/merchant/ReportsCenter';
import Monitoring from '@/pages/merchant/Monitoring';
import CustomReports from '@/pages/merchant/CustomReports';
import ApiDocumentation from '@/pages/merchant/ApiDocumentation';
import Webhooks from '@/pages/merchant/Webhooks';
import SystemPreferences from '@/pages/merchant/SystemPreferences';

// Alerts — two separate products, see data/navigation.js.
import Alerts from '@/pages/merchant/Alerts';
import AlertCaseWork from '@/pages/merchant/AlertCaseWork';
import AlertSettings from '@/pages/merchant/AlertSettings';
import AlertPermissions from '@/pages/merchant/AlertPermissions';
import AlertReporting from '@/pages/merchant/AlertReporting';
import AlertAssignments from '@/pages/merchant/AlertAssignments';
import AlertValidations from '@/pages/merchant/AlertValidations';

// Acquirer — portfolio, representment, risk, settlement.
import PortfolioMerchants from '@/pages/acquirer/PortfolioMerchants';
import Onboarding from '@/pages/acquirer/Onboarding';
import Underwriting from '@/pages/acquirer/Underwriting';
import Representment from '@/pages/acquirer/Representment';
import Risk from '@/pages/acquirer/Risk';
import Settlement from '@/pages/acquirer/Settlement';

// Issuer — cardholders, authorizations, fraud, statements.
import Cardholders from '@/pages/issuer/Cardholders';
import Approvals from '@/pages/issuer/Approvals';
import Declines from '@/pages/issuer/Declines';
import Chargebacks from '@/pages/issuer/Chargebacks';
import Fraud from '@/pages/issuer/Fraud';
import Statements from '@/pages/issuer/Statements';

/**
 * Every authenticated route lives under `/:perspective/*`. The perspective
 * segment is read by usePerspective() (src/hooks/usePerspective.js) — there
 * is no separate state to fall out of sync with the URL. Merchant, acquirer
 * and issuer suffix sets barely overlap (see data/navigation.js), so they're
 * declared as one flat child list rather than three duplicated trees; where a
 * suffix IS shared (work-case, users, help, settings) it intentionally points
 * at the same component for all three perspectives.
 */
function PerspectiveHome() {
  const { routes } = usePerspective();
  return <Navigate to={routes.dashboard ?? routes.overview} replace />;
}

const HOME_ROUTE = landingRouteFor(DEFAULT_PERSPECTIVE);

export function App() {
  return (
    <BrandProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path={LOGIN_ROUTE} element={<Login />} />
              <Route path="/" element={<Navigate to={HOME_ROUTE} replace />} />

              <Route path="/:perspective" element={<RequireAuth><AppLayout /></RequireAuth>}>
                <Route index element={<PerspectiveHome />} />

                {/* merchant */}
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="alerts" element={<Alerts />} />
                <Route path="alerts/case-work" element={<AlertCaseWork />} />
                <Route path="alerts/settings" element={<AlertSettings />} />
                <Route path="alerts/permissions" element={<AlertPermissions />} />
                <Route path="alerts/reporting" element={<AlertReporting />} />
                <Route path="alerts/assignments" element={<AlertAssignments />} />
                <Route path="alerts/validations" element={<AlertValidations />} />
                <Route path="rules/groups" element={<RuleGroups />} />
                <Route path="rules/groups/add" element={<AddRule />} />
                <Route path="rules/bulk" element={<BulkActions />} />
                <Route path="rules/check" element={<RuleCheck />} />
                <Route path="case-admin/assignment-reasons" element={<AssignmentReasons />} />
                <Route path="case-admin/queues" element={<QueueManagement />} />
                <Route path="case-admin/cases" element={<CaseManagement />} />
                <Route path="case-admin/upload" element={<UploadCases />} />
                <Route path="reports/center" element={<ReportsCenter />} />
                <Route path="reports/monitoring" element={<Monitoring />} />
                <Route path="reports/custom" element={<CustomReports />} />
                <Route path="api-docs" element={<ApiDocumentation />} />
                <Route path="settings/account" element={<AccountSettings />} />
                <Route path="settings/webhooks" element={<Webhooks />} />
                <Route path="settings/system" element={<SystemPreferences />} />

                {/* acquirer */}
                <Route path="overview" element={<Overview />} />
                <Route path="portfolio/merchants" element={<PortfolioMerchants />} />
                <Route path="portfolio/onboarding" element={<Onboarding />} />
                <Route path="portfolio/underwriting" element={<Underwriting />} />
                <Route path="disputes/cases" element={<DisputesCases />} />
                <Route path="disputes/representment" element={<Representment />} />
                <Route path="risk" element={<Risk />} />
                <Route path="settlement" element={<Settlement />} />
                <Route path="reporting" element={<Reporting />} />

                {/* issuer */}
                <Route path="cardholders" element={<Cardholders />} />
                <Route path="authorizations/approvals" element={<Approvals />} />
                <Route path="authorizations/declines" element={<Declines />} />
                <Route path="disputes/chargebacks" element={<Chargebacks />} />
                <Route path="fraud" element={<Fraud />} />
                <Route path="statements" element={<Statements />} />

                {/* shared across all three */}
                <Route path="work-case" element={<WorkCase />} />
                <Route path="work-case/:caseId" element={<WorkCase />} />
                <Route path="users" element={<Users />} />
                <Route path="settings" element={<AccountSettings />} />
                <Route path="templates" element={<TemplatesLibrary />} />
                <Route path="help" element={<Help />} />

                <Route path="*" element={<PerspectiveHome />} />
              </Route>

              <Route path="*" element={<Navigate to={HOME_ROUTE} replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </BrandProvider>
  );
}

export default App;
