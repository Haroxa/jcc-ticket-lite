import type { Account } from "../api";
import type { PageKey } from "../App";
import { canAdmin, canAudit, canWrite } from "../utils/permissions";

type MorePageProps = {
  account: Account;
  onNavigate: (page: PageKey) => void;
  onLogout: () => void;
};

export function MorePage({ account, onNavigate, onLogout }: MorePageProps) {
  const items: Array<{ title: string; desc: string; page?: PageKey; action?: () => void; visible?: boolean }> = [
    { title: "个人历史", desc: "按存票人查看完整流水", page: "history" },
    { title: "结算窗口", desc: "记录临时排名并审核结算", page: "liveRanking", visible: canWrite(account) },
    { title: "账号管理", desc: "维护操作员和只读成员", page: "accounts", visible: canAdmin(account) },
    { title: "操作日志", desc: "查看关键操作轨迹", page: "auditLogs", visible: canAudit(account) },
    { title: "系统信息", desc: "版本、权限和数据策略", page: "settings" },
    { title: "退出登录", desc: "回到登录页面", action: onLogout }
  ];

  return (
    <section className="panel more-grid">
      {items.filter((item) => item.visible !== false).map((item) => (
        <button
          className="more-card"
          key={item.title}
          type="button"
          onClick={() => item.page ? onNavigate(item.page) : item.action?.()}
        >
          <strong>{item.title}</strong>
          <span>{item.desc}</span>
        </button>
      ))}
    </section>
  );
}
