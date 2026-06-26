import type { PropsWithChildren } from "react";
import type { Account } from "../../api";
import type { PageKey } from "../../App";
import { canAdmin, canAudit, canWrite } from "../../utils/permissions";

type NavItem = {
  key: PageKey;
  label: string;
  shortLabel?: string;
  icon: string;
  require?: "write" | "audit" | "admin";
};

const primaryNav: NavItem[] = [
  { key: "dashboard", label: "工作台", icon: "⌂" },
  { key: "entry", label: "快速录入", shortLabel: "录入", icon: "＋", require: "write" },
  { key: "people", label: "存票人", icon: "◎" },
  { key: "records", label: "存取记录", shortLabel: "记录", icon: "≡" },
  { key: "history", label: "个人历史", shortLabel: "历史", icon: "◷" }
];

const systemNav: NavItem[] = [
  { key: "accounts", label: "账号管理", icon: "♙", require: "admin" },
  { key: "auditLogs", label: "操作日志", icon: "☷", require: "audit" },
  { key: "settings", label: "系统信息", icon: "ⓘ" }
];

type AppLayoutProps = PropsWithChildren<{
  activePage: PageKey;
  account: Account;
  pageTitle: string;
  onNavigate: (page: PageKey) => void;
  onLogout: () => void;
}>;

const roleLabel: Record<Account["role"], string> = {
  admin: "管理员",
  operator: "操作员",
  viewer: "只读成员"
};

export function AppLayout({ activePage, account, pageTitle, onNavigate, onLogout, children }: AppLayoutProps) {
  const visibleNav = (item: NavItem) => {
    if (item.require === "write") return canWrite(account);
    if (item.require === "audit") return canAudit(account);
    if (item.require === "admin") return canAdmin(account);
    return true;
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <h1>JCC 存票管理</h1>
          <p>Cloudflare 共享版 · D1 永久存储</p>
        </div>
        <div className="account-strip">
          <span className="role-badge">{roleLabel[account.role]}</span>
          <span>{account.displayName}</span>
          <button className="ghost-button" type="button" onClick={onLogout}>退出</button>
        </div>
      </header>

      <aside className="side-nav" aria-label="主导航">
        <div className="nav-section-label">日常操作</div>
        {[...primaryNav].filter(visibleNav).map((item) => (
          <button
            className={`nav-button ${activePage === item.key ? "active" : ""}`}
            key={item.key}
            type="button"
            onClick={() => onNavigate(item.key)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}

        <div className="nav-section-label">数据与系统</div>
        {systemNav.filter(visibleNav).map((item) => (
          <button
            className={`nav-button ${activePage === item.key ? "active" : ""}`}
            key={item.key}
            type="button"
            onClick={() => onNavigate(item.key)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}

        <div className="side-status">
          <span>当前账号</span>
          <strong>{account.displayName}</strong>
          <small>{roleLabel[account.role]} · 数据已永久存储</small>
        </div>
      </aside>

      <nav className="tablet-nav" aria-label="平板导航">
        {[...primaryNav, ...systemNav].filter(visibleNav).map((item) => (
          <button
            className={`nav-button ${activePage === item.key ? "active" : ""}`}
            key={item.key}
            type="button"
            onClick={() => onNavigate(item.key)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <main className="main-content">
        <div className="page-heading">
          <div>
            <h2>{pageTitle}</h2>
            <p>按权限展示可用功能，所有正式操作会写入存票记录和操作日志。</p>
          </div>
        </div>
        {children}
      </main>

      <nav className="bottom-nav" aria-label="手机导航">
        {primaryNav.filter(visibleNav).slice(0, 4).map((item) => (
          <button
            className={`nav-button ${activePage === item.key ? "active" : ""}`}
            key={item.key}
            type="button"
            onClick={() => onNavigate(item.key)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.shortLabel || item.label}</span>
          </button>
        ))}
        <button className="nav-button" type="button" onClick={() => onNavigate("settings")}>
          <span className="nav-icon">⋯</span>
          更多
        </button>
      </nav>
    </div>
  );
}
