import { useEffect, useState } from "react";
import {
  changeAccountStatus,
  createAccount,
  listAccounts,
  resetAccountPassword,
  updateAccount,
  type Account,
  type ManagedAccount
} from "../api";
import { formatDateTime } from "../utils/time";

type ManagedRole = Exclude<Account["role"], "admin">;

const roleLabel: Record<Account["role"], string> = {
  admin: "管理员",
  operator: "操作员",
  viewer: "只读成员"
};

const statusLabel: Record<ManagedAccount["status"], string> = {
  active: "启用",
  disabled: "停用"
};

type AccountModal =
  | { type: "create" }
  | { type: "edit"; account: ManagedAccount }
  | { type: "status"; account: ManagedAccount }
  | { type: "password"; account: ManagedAccount }
  | null;

type AccountsPageProps = {
  account: Account;
};

export function AccountsPage({ account }: AccountsPageProps) {
  const [keyword, setKeyword] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: ManagedAccount[]; total: number; totalPages: number }>({ items: [], total: 0, totalPages: 1 });
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState<AccountModal>(null);

  async function loadAccounts(nextPage = page) {
    const result = await listAccounts({ keyword, role, status, page: nextPage, pageSize: 10 });
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    setData({ items: result.data.items, total: result.data.total, totalPages: result.data.totalPages });
    setPage(result.data.page);
    setNotice("");
  }

  useEffect(() => {
    void loadAccounts(1);
  }, []);

  function closeModal() {
    setModal(null);
  }

  async function submitCreate(payload: { username: string; displayName: string; password: string; role: ManagedRole }) {
    const result = await createAccount(payload);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    closeModal();
    await loadAccounts(1);
  }

  async function submitEdit(item: ManagedAccount, payload: { displayName: string; role: ManagedRole }) {
    const result = await updateAccount(item.id, payload);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    closeModal();
    await loadAccounts(page);
  }

  async function submitStatus(item: ManagedAccount, reason: string) {
    const nextStatus = item.status === "active" ? "disabled" : "active";
    const result = await changeAccountStatus(item.id, nextStatus, reason);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    closeModal();
    await loadAccounts(page);
  }

  async function submitPassword(item: ManagedAccount, password: string, reason: string) {
    const result = await resetAccountPassword(item.id, password, reason);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    closeModal();
    setNotice("密码已重置，该账号需要重新登录。");
    await loadAccounts(page);
  }

  return (
    <section className="panel">
      <div className="filter-panel">
        <label>关键词<input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索用户名或显示名称" /></label>
        <label>角色<select value={role} onChange={(event) => setRole(event.target.value)}><option value="">全部角色</option><option value="admin">管理员</option><option value="operator">操作员</option><option value="viewer">只读成员</option></select></label>
        <label>状态<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">全部状态</option><option value="active">启用</option><option value="disabled">停用</option></select></label>
        <div className="filter-actions">
          <button className="primary-button" type="button" onClick={() => loadAccounts(1)}>查询</button>
        </div>
      </div>

      <div className="account-toolbar">
        <p className="filter-summary">管理员账号固定为唯一系统账号，不在此处修改；这里用于维护操作员和只读成员。</p>
        <button className="primary-button" type="button" onClick={() => setModal({ type: "create" })}>新增账号</button>
      </div>
      {notice && <p className="notice-text">{notice}</p>}

      <div className="responsive-table accounts-table">
        <div className="table-row header"><span>序号</span><span>账号</span><span>角色</span><span>状态</span><span>最近登录</span><span>更新时间</span><span>操作</span></div>
        {data.items.map((item, index) => {
          const isAdmin = item.role === "admin";
          return (
            <div className={`table-row account-status-${item.status} ${isAdmin ? "account-admin-row" : ""}`} key={item.id}>
              <span className="row-no">{(page - 1) * 10 + index + 1}</span>
              <strong>{item.displayName}<small>{item.username}</small></strong>
              <span>{roleLabel[item.role]}</span>
              <span className="status-pill">{statusLabel[item.status]}</span>
              <span>{item.lastLoginAt ? formatDateTime(item.lastLoginAt) : "未登录"}</span>
              <span>{formatDateTime(item.updatedAt)}</span>
              {isAdmin ? (
                <span className="muted">系统唯一管理员</span>
              ) : (
                <div className="row-actions">
                  <button className="secondary-button row-action" type="button" onClick={() => setModal({ type: "edit", account: item })}>编辑</button>
                  <button className="secondary-button row-action" disabled={item.id === account.id} type="button" onClick={() => setModal({ type: "status", account: item })}>{item.status === "active" ? "停用" : "启用"}</button>
                  <button className="secondary-button row-action" type="button" onClick={() => setModal({ type: "password", account: item })}>重置密码</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="pagination-bar">
        <button type="button" disabled={page <= 1} onClick={() => loadAccounts(page - 1)}>上一页</button>
        <span>第 {page} / {data.totalPages} 页，共 {data.total} 个账号</span>
        <button type="button" disabled={page >= data.totalPages} onClick={() => loadAccounts(page + 1)}>下一页</button>
      </div>

      {modal?.type === "create" && <AccountCreateModal onCancel={closeModal} onSubmit={submitCreate} />}
      {modal?.type === "edit" && <AccountEditModal account={modal.account} onCancel={closeModal} onSubmit={submitEdit} />}
      {modal?.type === "status" && <AccountStatusModal account={modal.account} onCancel={closeModal} onSubmit={submitStatus} />}
      {modal?.type === "password" && <AccountPasswordModal account={modal.account} onCancel={closeModal} onSubmit={submitPassword} />}
    </section>
  );
}

function AccountCreateModal({ onCancel, onSubmit }: {
  onCancel: () => void;
  onSubmit: (payload: { username: string; displayName: string; password: string; role: ManagedRole }) => void;
}) {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<ManagedRole>("operator");

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="accountCreateTitle">
        <h3 id="accountCreateTitle">新增账号</h3>
        <p className="muted">管理员账号固定唯一；新成员只能设置为操作员或只读成员。</p>
        <label>用户名<input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="用于登录，例如 zhangsan" /></label>
        <label>显示名称<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="页面展示名称" /></label>
        <label>初始密码<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="至少 8 位" /></label>
        <label>角色<select value={role} onChange={(event) => setRole(event.target.value as ManagedRole)}><option value="operator">操作员</option><option value="viewer">只读成员</option></select></label>
        <div className="button-row modal-actions">
          <button className="secondary-button" type="button" onClick={onCancel}>取消</button>
          <button className="primary-button" type="button" onClick={() => onSubmit({ username, displayName, password, role })}>保存账号</button>
        </div>
      </section>
    </div>
  );
}

function AccountEditModal({ account, onCancel, onSubmit }: {
  account: ManagedAccount;
  onCancel: () => void;
  onSubmit: (account: ManagedAccount, payload: { displayName: string; role: ManagedRole }) => void;
}) {
  const [displayName, setDisplayName] = useState(account.displayName);
  const [role, setRole] = useState<ManagedRole>(account.role === "viewer" ? "viewer" : "operator");

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="accountEditTitle">
        <h3 id="accountEditTitle">编辑账号</h3>
        <p className="muted">{account.username}</p>
        <label>显示名称<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
        <label>角色<select value={role} onChange={(event) => setRole(event.target.value as ManagedRole)}><option value="operator">操作员</option><option value="viewer">只读成员</option></select></label>
        <div className="button-row modal-actions">
          <button className="secondary-button" type="button" onClick={onCancel}>取消</button>
          <button className="primary-button" type="button" onClick={() => onSubmit(account, { displayName, role })}>保存修改</button>
        </div>
      </section>
    </div>
  );
}

function AccountStatusModal({ account, onCancel, onSubmit }: {
  account: ManagedAccount;
  onCancel: () => void;
  onSubmit: (account: ManagedAccount, reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const nextText = account.status === "active" ? "停用" : "启用";

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="accountStatusTitle">
        <h3 id="accountStatusTitle">{nextText}账号</h3>
        <p className="muted">{nextText} {account.displayName}（{account.username}）。停用后该账号会立即退出已登录会话。</p>
        <label>操作原因<textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} placeholder="请输入原因" /></label>
        <div className="button-row modal-actions">
          <button className="secondary-button" type="button" onClick={onCancel}>取消</button>
          <button className="primary-button" type="button" onClick={() => onSubmit(account, reason)}>确认{nextText}</button>
        </div>
      </section>
    </div>
  );
}

function AccountPasswordModal({ account, onCancel, onSubmit }: {
  account: ManagedAccount;
  onCancel: () => void;
  onSubmit: (account: ManagedAccount, password: string, reason: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="accountPasswordTitle">
        <h3 id="accountPasswordTitle">重置密码</h3>
        <p className="muted">为 {account.displayName}（{account.username}）设置新密码，保存后需要重新登录。</p>
        <label>新密码<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="至少 8 位" /></label>
        <label>重置原因<textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} placeholder="请输入原因" /></label>
        <div className="button-row modal-actions">
          <button className="secondary-button" type="button" onClick={onCancel}>取消</button>
          <button className="primary-button" type="button" onClick={() => onSubmit(account, password, reason)}>确认重置</button>
        </div>
      </section>
    </div>
  );
}
