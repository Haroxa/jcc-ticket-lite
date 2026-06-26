import { useEffect, useState } from "react";
import { changePersonStatus, createPerson, listPeople, updatePerson, type Account, type Person, type PersonStatus } from "../api";
import { Pagination } from "../components/Pagination/Pagination";
import { canAdmin } from "../utils/permissions";

const statusLabel: Record<PersonStatus, string> = {
  normal: "正常",
  disabled: "停用",
  blocked: "拉黑"
};

type PeopleModal =
  | { type: "create" }
  | { type: "edit"; person: Person }
  | { type: "status"; person: Person }
  | null;

type PeoplePageProps = {
  account: Account;
};

export function PeoplePage({ account }: PeoplePageProps) {
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [data, setData] = useState<{ items: Person[]; total: number; totalPages: number }>({ items: [], total: 0, totalPages: 1 });
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState<PeopleModal>(null);

  async function loadPeople(nextPage = page, filters = { keyword, status }, nextPageSize = pageSize) {
    const result = await listPeople({ ...filters, page: nextPage, pageSize: nextPageSize });
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

  function closeModal() {
    setModal(null);
  }

  async function resetFilters() {
    setKeyword("");
    setStatus("");
    await loadPeople(1, { keyword: "", status: "" });
  }

  async function submitCreate(payload: { name: string; note: string }) {
    if (!canAdmin(account)) {
      setNotice("只有管理员可以新增存票人。");
      return;
    }
    const result = await createPerson(payload);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    closeModal();
    await loadPeople(1);
  }

  async function submitEdit(person: Person, payload: { name: string; note: string }) {
    if (!canAdmin(account)) return;
    const result = await updatePerson(person.id, { name: payload.name, alias: person.alias, note: payload.note });
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    closeModal();
    await loadPeople(page);
  }

  async function submitStatus(person: Person, nextStatus: PersonStatus, reason: string) {
    if (!canAdmin(account)) return;
    const result = await changePersonStatus(person.id, nextStatus, reason);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    closeModal();
    await loadPeople(page);
  }

  return (
    <section className="panel">
      <div className="filter-panel">
        <label>关键词<input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索姓名或备注" /></label>
        <label>状态<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">全部状态</option><option value="normal">正常</option><option value="disabled">停用</option><option value="blocked">拉黑</option></select></label>
        <div className="filter-actions">
          <button className="primary-button" type="button" onClick={() => loadPeople(1)}>查询</button>
          <button className="secondary-button" type="button" onClick={resetFilters}>重置</button>
        </div>
      </div>

      <div className="account-toolbar">
        <p className="filter-summary">内部管理页显示全部状态；停用和拉黑不会进入录入候选和公开榜单。</p>
        {canAdmin(account) && <button className="primary-button" type="button" onClick={() => setModal({ type: "create" })}>新增存票人</button>}
      </div>
      {notice && <p className="notice-text">{notice}</p>}

      <div className="responsive-table people-table">
        <div className="table-row header"><span>序号</span><span>存票人</span><span>余额</span><span>状态</span><span>备注</span><span>操作</span></div>
        {data.items.map((person, index) => (
          <div className={`table-row person-status-${person.status}`} key={person.id}>
            <span className="row-no" data-label="序号">{(page - 1) * pageSize + index + 1}</span>
            <strong data-label="存票人">{person.name}</strong>
            <span data-label="余额">{person.balance}</span>
            <span data-label="状态"><span className="status-pill">{statusLabel[person.status]}</span></span>
            <span data-label="备注">{person.note || "无备注"}</span>
            {canAdmin(account) ? (
              <div className="row-actions" data-label="操作">
                <button className="secondary-button row-action" type="button" onClick={() => setModal({ type: "edit", person })}>编辑</button>
                <button className="secondary-button row-action" type="button" onClick={() => setModal({ type: "status", person })}>改状态</button>
              </div>
            ) : <span className="muted" data-label="操作">只读</span>}
          </div>
        ))}
      </div>
      <Pagination
        page={page}
        totalPages={data.totalPages}
        total={data.total}
        pageSize={pageSize}
        totalLabel="人"
        onPageChange={(nextPage) => loadPeople(nextPage)}
        onPageSizeChange={(nextPageSize) => { setPageSize(nextPageSize); void loadPeople(1, { keyword, status }, nextPageSize); }}
      />

      {modal?.type === "create" && <PersonCreateModal onCancel={closeModal} onSubmit={submitCreate} />}
      {modal?.type === "edit" && <PersonEditModal person={modal.person} onCancel={closeModal} onSubmit={submitEdit} />}
      {modal?.type === "status" && <PersonStatusModal person={modal.person} onCancel={closeModal} onSubmit={submitStatus} />}
    </section>
  );
}

function PersonCreateModal({ onCancel, onSubmit }: {
  onCancel: () => void;
  onSubmit: (payload: { name: string; note: string }) => void;
}) {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  function handleSubmit() {
    if (!name.trim()) {
      setError("请输入存票人名称。");
      return;
    }
    onSubmit({ name: name.trim(), note: note.trim() });
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="personCreateTitle">
        <h3 id="personCreateTitle">新增存票人</h3>
        <p className="muted">新增后默认正常状态，可参与快速录入和内部统计。</p>
        <label>存票人名称<input autoComplete="off" value={name} onChange={(event) => setName(event.target.value)} placeholder="输入名称" /></label>
        <label>备注<input autoComplete="off" value={note} onChange={(event) => setNote(event.target.value)} placeholder="可选" /></label>
        {error && <p className="notice-text">{error}</p>}
        <div className="button-row modal-actions">
          <button className="secondary-button" type="button" onClick={onCancel}>取消</button>
          <button className="primary-button" type="button" onClick={handleSubmit}>保存</button>
        </div>
      </section>
    </div>
  );
}

function PersonEditModal({ person, onCancel, onSubmit }: {
  person: Person;
  onCancel: () => void;
  onSubmit: (person: Person, payload: { name: string; note: string }) => void;
}) {
  const [name, setName] = useState(person.name);
  const [note, setNote] = useState(person.note || "");
  const [error, setError] = useState("");

  function handleSubmit() {
    if (!name.trim()) {
      setError("请输入存票人名称。");
      return;
    }
    onSubmit(person, { name: name.trim(), note: note.trim() });
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="personEditTitle">
        <h3 id="personEditTitle">编辑存票人</h3>
        <p className="muted">仅修改名称和备注，不影响历史流水。</p>
        <label>存票人名称<input autoComplete="off" value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label>备注<input autoComplete="off" value={note} onChange={(event) => setNote(event.target.value)} placeholder="可选" /></label>
        {error && <p className="notice-text">{error}</p>}
        <div className="button-row modal-actions">
          <button className="secondary-button" type="button" onClick={onCancel}>取消</button>
          <button className="primary-button" type="button" onClick={handleSubmit}>保存</button>
        </div>
      </section>
    </div>
  );
}

function PersonStatusModal({ person, onCancel, onSubmit }: {
  person: Person;
  onCancel: () => void;
  onSubmit: (person: Person, status: PersonStatus, reason: string) => void;
}) {
  const [status, setStatus] = useState<PersonStatus>(person.status);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  function handleSubmit() {
    if (!reason.trim()) {
      setError("请输入调整原因，方便之后在操作日志中核对。");
      return;
    }
    onSubmit(person, status, reason.trim());
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="personStatusTitle">
        <h3 id="personStatusTitle">修改存票人状态</h3>
        <p className="muted">{person.name} 当前状态：{statusLabel[person.status]}</p>
        <label>新状态<select value={status} onChange={(event) => setStatus(event.target.value as PersonStatus)}><option value="normal">正常</option><option value="disabled">停用</option><option value="blocked">拉黑</option></select></label>
        <label>调整原因<textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="例如：临时停用、名单清理、误操作恢复" rows={3} /></label>
        <p className="field-hint">停用和拉黑不会进入录入候选和公开榜单；拉黑仅在内部查询中保留。</p>
        {error && <p className="notice-text">{error}</p>}
        <div className="button-row modal-actions">
          <button className="secondary-button" type="button" onClick={onCancel}>取消</button>
          <button className="primary-button" type="button" onClick={handleSubmit}>保存状态</button>
        </div>
      </section>
    </div>
  );
}
