import { useEffect, useMemo, useState } from "react";
import { getMe, logout, type Account } from "./api";
import { AppLayout } from "./components/AppLayout/AppLayout";
import { AuditLogsPage } from "./pages/AuditLogsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { EntryPage } from "./pages/EntryPage";
import { HistoryPage } from "./pages/HistoryPage";
import { LoginPage } from "./pages/LoginPage";
import { PeoplePage } from "./pages/PeoplePage";
import { PublicBoardPage } from "./pages/PublicBoardPage";
import { RecordsPage } from "./pages/RecordsPage";
import { SettingsPage } from "./pages/SettingsPage";

export type PageKey =
  | "dashboard"
  | "entry"
  | "people"
  | "records"
  | "history"
  | "auditLogs"
  | "settings"
  | "publicBoard";

const pageMap: Record<PageKey, string> = {
  dashboard: "工作台",
  entry: "快速录入",
  people: "存票人",
  records: "存取记录",
  history: "个人历史",
  auditLogs: "操作日志",
  settings: "系统信息",
  publicBoard: "公开存票榜"
};

export default function App() {
  const [account, setAccount] = useState<Account | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [page, setPage] = useState<PageKey>("dashboard");

  const pageTitle = useMemo(() => pageMap[page], [page]);

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

  if (page === "publicBoard") {
    return <PublicBoardPage />;
  }

  if (isCheckingSession) {
    return <div className="loading-screen">正在检查登录状态...</div>;
  }

  if (!account) {
    return <LoginPage onLogin={setAccount} onOpenPublicBoard={() => setPage("publicBoard")} />;
  }

  return (
    <AppLayout
      activePage={page}
      account={account}
      pageTitle={pageTitle}
      onNavigate={setPage}
      onLogout={handleLogout}
    >
      {page === "dashboard" && <DashboardPage onNavigate={setPage} />}
      {page === "entry" && <EntryPage />}
      {page === "people" && <PeoplePage />}
      {page === "records" && <RecordsPage />}
      {page === "history" && <HistoryPage />}
      {page === "auditLogs" && <AuditLogsPage />}
      {page === "settings" && <SettingsPage />}
    </AppLayout>
  );
}
