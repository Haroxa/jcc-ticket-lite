import { useEffect, useState } from "react";
import { listPeople, listRecords, type Person, type TicketRecord } from "../api";
import { EmptyState } from "../components/EmptyState/EmptyState";
import { Pagination } from "../components/Pagination/Pagination";
import { PersonSearchSelect } from "../components/PersonSearchSelect/PersonSearchSelect";
import { formatLocalMinute } from "../utils/time";

export function HistoryPage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [personId, setPersonId] = useState("");
  const [personKeyword, setPersonKeyword] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [data, setData] = useState<{ items: TicketRecord[]; total: number; totalPages: number }>({ items: [], total: 0, totalPages: 1 });
  const [notice, setNotice] = useState("");

  async function loadHistory(nextPersonId = personId, nextPage = page, nextPageSize = pageSize) {
    if (!nextPersonId) {
      setData({ items: [], total: 0, totalPages: 1 });
      setPage(1);
      setNotice("");
      return;
    }
    const result = await listRecords({ personId: nextPersonId, type, status, page: nextPage, pageSize: nextPageSize });
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    setData({ items: result.data.items, total: result.data.total, totalPages: result.data.totalPages });
    setPage(result.data.page);
    setNotice("");
  }

  useEffect(() => {
    listPeople({ pageSize: 50 }).then((result) => {
      if (result.ok) {
        setPeople(result.data.items);
      }
    });
  }, []);

  async function resetFilters() {
    setPersonId("");
    setPersonKeyword("");
    setType("");
    setStatus("");
    setData({ items: [], total: 0, totalPages: 1 });
    setPage(1);
    setNotice("");
  }

  function selectPerson(person: Person) {
    setPersonId(person.id);
    setPersonKeyword(person.name);
    void loadHistory(person.id, 1);
  }

  return (
    <section className="panel">
      <div className="filter-panel">
        <PersonSearchSelect
          people={people}
          selectedId={personId}
          value={personKeyword}
          onInputChange={(value) => { setPersonKeyword(value); setPersonId(""); setData({ items: [], total: 0, totalPages: 1 }); }}
          onSelect={selectPerson}
        />
        <label>类型<select value={type} onChange={(event) => { setType(event.target.value); setPage(1); }}><option value="">全部类型</option><option value="deposit">存入</option><option value="withdraw">取用</option></select></label>
        <label>状态<select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">全部状态</option><option value="normal">正常</option><option value="voided">作废</option></select></label>
        <div className="filter-actions">
          <button className="primary-button" type="button" onClick={() => loadHistory(personId, 1)}>查询</button>
          <button className="secondary-button" type="button" onClick={resetFilters}>重置</button>
        </div>
      </div>
      <p className="filter-summary">个人历史保留完整流水，用于核对每一步余额变化。</p>
      {notice && <p className="notice-text">{notice}</p>}
      <div className="responsive-table records-table">
        <div className="table-row header"><span>序号</span><span>时间</span><span>存票人</span><span>类型</span><span>票数</span><span>状态</span><span>备注</span></div>
        {data.items.map((record, index) => (
          <div className={`table-row ${record.type} record-row-${record.status}`} key={record.id}>
            <span className="row-no">{(page - 1) * pageSize + index + 1}</span>
            <strong>{formatLocalMinute(record.recordedAt)}</strong>
            <span>{record.personName}</span>
            <span>{record.type === "deposit" ? "存入" : "取用"}</span>
            <span>{record.type === "deposit" ? "+" : "-"}{record.amount}</span>
            <span>{record.status === "normal" ? "正常" : "作废"}</span>
            <span>{record.note || record.voidReason || "无备注"}</span>
          </div>
        ))}
        {!personId && <EmptyState title="请选择存票人" description="输入姓名或备注后，从下拉结果中点击选择，再查看个人历史。" />}
        {personId && !data.items.length && <EmptyState title="暂无历史记录" description="当前筛选条件下没有流水，可调整类型或状态后重新查询。" />}
      </div>
      <Pagination
        page={page}
        totalPages={data.totalPages}
        total={data.total}
        pageSize={pageSize}
        onPageChange={(nextPage) => loadHistory(personId, nextPage)}
        onPageSizeChange={(nextPageSize) => { setPageSize(nextPageSize); void loadHistory(personId, 1, nextPageSize); }}
      />
    </section>
  );
}
