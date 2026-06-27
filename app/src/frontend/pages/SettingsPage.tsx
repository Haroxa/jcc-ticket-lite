import { useState } from "react";
import { changeMyPassword, type Account } from "../api";
import type { PageKey } from "../App";
import { canAdmin, canAudit } from "../utils/permissions";

type SettingsPageProps = {
  account: Account;
  onNavigate: (page: PageKey) => void;
};

export function SettingsPage({ account, onNavigate }: SettingsPageProps) {
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [notice, setNotice] = useState("");

  async function submitPassword(payload: { currentPassword: string; newPassword: string }) {
    const result = await changeMyPassword(payload);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    setShowPasswordModal(false);
    setNotice("密码已修改，请妥善保存新密码。");
  }

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
        <button className="secondary-button" type="button" onClick={() => setShowPasswordModal(true)}>修改密码</button>
        {notice && <p className="notice-text">{notice}</p>}
      </section>
      <section className="panel stacked">
        <h3>数据规则</h3>
        <span>流水记录永久保存，作废不删除。</span>
        <span>余额只统计正常流水，作废记录不参与余额。</span>
        <span>公开榜只展示正常状态且余额大于 0 的存票人。</span>
        <span>停用和拉黑不会进入快速录入候选。</span>
      </section>
      <section className="panel stacked">
        <h3>初始化说明</h3>
        <span>首次部署后需要先创建唯一管理员账号。</span>
        <span>管理员创建后，日常登录不再默认填写任何账号。</span>
        <span>操作员和只读成员由管理员在账号管理中维护。</span>
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
        <button className="secondary-button" type="button" onClick={() => window.open("/public-board", "_blank", "noopener,noreferrer")}>打开公开存票榜</button>
      </section>
      {showPasswordModal && <ChangePasswordModal onCancel={() => setShowPasswordModal(false)} onSubmit={submitPassword} />}
    </div>
  );
}

function ChangePasswordModal({ onCancel, onSubmit }: {
  onCancel: () => void;
  onSubmit: (payload: { currentPassword: string; newPassword: string }) => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  function handleSubmit() {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("请完整填写当前密码和新密码。");
      return;
    }
    if (newPassword.length < 8) {
      setError("新密码至少需要 8 位。");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("两次输入的新密码不一致。");
      return;
    }
    if (currentPassword === newPassword) {
      setError("新密码不能和当前密码相同。");
      return;
    }
    onSubmit({ currentPassword, newPassword });
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="changePasswordTitle">
        <h3 id="changePasswordTitle">修改密码</h3>
        <p className="muted">修改成功后，其它设备上的登录会失效，当前设备可继续使用。</p>
        <label>当前密码<input autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} type={showPassword ? "text" : "password"} /></label>
        <label>新密码<input autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} type={showPassword ? "text" : "password"} placeholder="至少 8 位" /></label>
        <label>确认新密码<input autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} type={showPassword ? "text" : "password"} /></label>
        <label className="check-row"><input checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} type="checkbox" />显示密码</label>
        {error && <p className="notice-text">{error}</p>}
        <div className="button-row modal-actions">
          <button className="secondary-button" type="button" onClick={onCancel}>取消</button>
          <button className="primary-button" type="button" onClick={handleSubmit}>确认修改</button>
        </div>
      </section>
    </div>
  );
}
