import type { Account } from "../api";
import type { PageKey } from "../App";
import { canAdmin, canAudit } from "../utils/permissions";

type SettingsPageProps = {
  account: Account;
  onNavigate: (page: PageKey) => void;
};

export function SettingsPage({ account, onNavigate }: SettingsPageProps) {
  return (
    <div className="two-column">
      <section className="panel stacked">
        <h3>系统状态</h3>
        <span>项目版本：v0.1.0 Cloudflare 共享版</span>
        <span>运行平台：Cloudflare Workers + D1</span>
        <span>运行环境：production</span>
        <span>数据库：D1 永久存储</span>
        <span>适配设备：电脑、平板、手机</span>
      </section>
      <section className="panel stacked">
        <h3>当前账号</h3>
        <span>显示名称：{account.displayName}</span>
        <span>登录账号：{account.username}</span>
        <span>当前权限：{account.role === "admin" ? "管理员" : account.role === "operator" ? "操作员" : "只读成员"}</span>
      </section>
      <section className="panel stacked">
        <h3>数据规则</h3>
        <span>流水记录永久保存，作废不删除。</span>
        <span>余额只统计正常流水，作废记录不参与余额。</span>
        <span>公开榜只展示正常状态且余额大于 0 的存票人。</span>
        <span>停用和拉黑不会进入快速录入候选。</span>
      </section>
      <section className="panel stacked">
        <h3>权限说明</h3>
        <span>管理员：账号、存票人、流水和日志管理</span>
        <span>操作员：录入和维护流水，可查看自己的操作日志</span>
        <span>只读成员：查看数据，不能修改</span>
      </section>
      <section className="panel stacked system-actions">
        <h3>维护入口</h3>
        <button className="secondary-button" type="button" onClick={() => onNavigate("records")}>查看存取记录</button>
        {canAudit(account) && <button className="secondary-button" type="button" onClick={() => onNavigate("auditLogs")}>查看操作日志</button>}
        {canAdmin(account) && <button className="secondary-button" type="button" onClick={() => onNavigate("accounts")}>管理账号</button>}
        <button className="secondary-button" type="button" onClick={() => onNavigate("publicBoard")}>打开公开存票榜</button>
      </section>
    </div>
  );
}
