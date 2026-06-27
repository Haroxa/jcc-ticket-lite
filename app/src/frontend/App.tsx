import { useEffect, useMemo, useState } from "react";
import { getMe, logout, type Account, type Person } from "./api";
import { AppLayout } from "./components/AppLayout/AppLayout";
import { AccountsPage } from "./pages/AccountsPage";
import { AuditLogsPage } from "./pages/AuditLogsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { EntryPage } from "./pages/EntryPage";
import { HistoryPage } from "./pages/HistoryPage";
import { LoginPage } from "./pages/LoginPage";
import { MorePage } from "./pages/MorePage";
import { PeoplePage } from "./pages/PeoplePage";
import { PublicBoardPage } from "./pages/PublicBoardPage";
import { RecordsPage } from "./pages/RecordsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { canAudit, canWrite } from "./utils/permissions";

export type PageKey =
  | "dashboard"
  | "entry"
  | "people"
  | "records"
  | "history"
  | "accounts"
  | "auditLogs"
  | "settings"
  | "more";

const pageMap: Record<PageKey, string> = {
  dashboard: "工作台",
  entry: "快速录入",
  people: "存票人",
  records: "存取记录",
  history: "个人历史",
  accounts: "账号管理",
  auditLogs: "操作日志",
  settings: "系统信息",
  more: "更多"
};

export default function App() {
  const [account, setAccount] = useState<Account | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [page, setPage] = useState<PageKey>("dashboard");
  const [historyPerson, setHistoryPerson] = useState<Person | null>(null);

  const pageTitle = useMemo(() => pageMap[page], [page]);

  function navigate(nextPage: PageKey) {
    if (!account) {
      setPage(nextPage);
      return;
    }
    if (nextPage === "entry" && !canWrite(account)) return;
    if (nextPage === "accounts" && account.role !== "admin") return;
    if (nextPage === "auditLogs" && !canAudit(account)) return;
    setPage(nextPage);
  }

  useEffect(() => {
    getMe()
      .then((result) => {
        if (result.ok) setAccount(result.data.account);
      })
      .finally(() => setIsCheckingSession(false));
  }, []);

  async function handleLogout() {
    await logout();
    setAccount(null);
    setPage("dashboard");
  }

  if (window.location.pathname === "/public-board") {
    return <PublicBoardPage />;
  }

  if (isCheckingSession) {
    return <div className="loading-screen">正在检查登录状态...</div>;
  }

  if (!account) {
    return <LoginPage onLogin={setAccount} />;
  }

  return (
    <AppLayout
      activePage={page}
      account={account}
      pageTitle={pageTitle}
      onNavigate={navigate}
      onLogout={handleLogout}
    >
      {page === "dashboard" && <DashboardPage onNavigate={navigate} />}
      {page === "entry" && <EntryPage account={account} />}
      {page === "people" && <PeoplePage account={account} onOpenHistory={(person) => { setHistoryPerson(person); navigate("history"); }} />}
      {page === "records" && <RecordsPage account={account} />}
      {page === "history" && <HistoryPage initialPerson={historyPerson} />}
      {page === "accounts" && <AccountsPage account={account} />}
      {page === "auditLogs" && <AuditLogsPage account={account} />}
      {page === "settings" && <SettingsPage account={account} onNavigate={navigate} />}
      {page === "more" && <MorePage account={account} onNavigate={navigate} onLogout={handleLogout} />}
    </AppLayout>
  );
}
