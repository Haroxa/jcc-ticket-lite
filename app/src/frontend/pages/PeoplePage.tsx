import { useEffect, useState } from "react";
import { changePersonStatus, createPerson, listPeople, updatePerson, type Account, type Person, type PersonStatus } from "../api";
import { canAdmin } from "../utils/permissions";

const statusLabel: Record<PersonStatus, string> = {
  normal: "正常",
  disabled: "停用",
  blocked: "拉黑"
};

type PeoplePageProps = {
  account: Account;
};

export function PeoplePage({ account }: PeoplePageProps) {
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: Person[]; total: number; totalPages: number }>({ items: [], total: 0, totalPages: 1 });
  const [notice, setNotice] = useState("");
  const [newName, setNewName] = useState("");
  const [newNote, setNewNote] = useState("");

  async function loadPeople(nextPage = page) {
    const result = await listPeople({ keyword, status, page: nextPage, pageSize: 10 });
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    setData({ items: result.data.items, total: result.data.total, totalPages: result.data.totalPages });
    setPage(result.data.page);
    setNotice("");
  }

  useEffect(() => {
    void loadPeople(1);
  }, []);

  async function handleCreatePerson() {
    if (!canAdmin(account)) {
      setNotice("只有管理员可以新增存票人。");
      return;
    }
    if (!newName.trim()) {
      setNotice("请输入存票人名称。");
      return;
    }
    const result = await createPerson({ name: newName, note: newNote });
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    setNewName("");
    setNewNote("");
    await loadPeople(1);
  }

  async function handleStatusChange(person: Person) {
    if (!canAdmin(account)) return;
    const next = window.prompt(`修改 ${person.name} 状态：normal / disabled / blocked`, person.status);
    if (!next || !["normal", "disabled", "blocked"].includes(next)) return;
    const reason = window.prompt("请输入调整原因");
    if (!reason) return;
    const result = await changePersonStatus(person.id, next as PersonStatus, reason);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    await loadPeople(page);
  }

  async function handleEdit(person: Person) {
    if (!canAdmin(account)) return;
    const name = window.prompt("存票人名称", person.name);
    if (!name) return;
    const note = window.prompt("备注", person.note) || "";
    const result = await updatePerson(person.id, { name, alias: person.alias, note });
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    await loadPeople(page);
  }

  return (
    <section className="panel">
      <div className="filter-panel">
        <label>关键词<input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索姓名或备注" /></label>
        <label>状态<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">全部状态</option><option value="normal">正常</option><option value="disabled">停用</option><option value="blocked">拉黑</option></select></label>
        <div className="filter-actions">
          <button className="primary-button" type="button" onClick={() => loadPeople(1)}>查询</button>
        </div>
      </div>
      {canAdmin(account) && (
        <div className="inline-create">
          <label>新增存票人<input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="输入名称" /></label>
          <label>备注<input value={newNote} onChange={(event) => setNewNote(event.target.value)} placeholder="可选" /></label>
          <button className="secondary-button" type="button" onClick={handleCreatePerson}>新增</button>
        </div>
      )}
      <p className="filter-summary">内部管理页显示全部状态；停用和拉黑不会进入录入候选和公开榜单。</p>
      {notice && <p className="notice-text">{notice}</p>}
      <div className="responsive-table people-table">
        <div className="table-row header"><span>序号</span><span>存票人</span><span>余额</span><span>状态</span><span>备注</span><span>操作</span></div>
        {data.items.map((person, index) => (
          <div className={`table-row person-status-${person.status}`} key={person.id}>
            <span className="row-no">{(page - 1) * 10 + index + 1}</span>
            <strong>{person.name}</strong>
            <span>{person.balance}</span>
            <span className="status-pill">{statusLabel[person.status]}</span>
            <span>{person.note || "无备注"}</span>
            {canAdmin(account) ? (
              <div className="row-actions">
                <button className="secondary-button row-action" type="button" onClick={() => handleEdit(person)}>编辑</button>
                <button className="secondary-button row-action" type="button" onClick={() => handleStatusChange(person)}>改状态</button>
              </div>
            ) : <span className="muted">只读</span>}
          </div>
        ))}
      </div>
      <div className="pagination-bar">
        <button type="button" disabled={page <= 1} onClick={() => loadPeople(page - 1)}>上一页</button>
        <span>第 {page} / {data.totalPages} 页，共 {data.total} 人</span>
        <button type="button" disabled={page >= data.totalPages} onClick={() => loadPeople(page + 1)}>下一页</button>
      </div>
    </section>
  );
}
