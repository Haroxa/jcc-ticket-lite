import { useEffect, useState } from "react";
import { listPeople, listRecords, type Person, type RecordSummary, type TicketRecord } from "../api";
import { EmptyState } from "../components/EmptyState/EmptyState";
import { Pagination } from "../components/Pagination/Pagination";
import { PersonSearchSelect } from "../components/PersonSearchSelect/PersonSearchSelect";
import { RecordDetailModal } from "../components/RecordDetailModal/RecordDetailModal";
import { formatLocalMinute } from "../utils/time";

function localDate(value = new Date()) {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

type HistoryPageProps = {
  initialPerson: Person | null;
};

export function HistoryPage({ initialPerson }: HistoryPageProps) {
  const [people, setPeople] = useState<Person[]>([]);
  const [personId, setPersonId] = useState("");
  const [personKeyword, setPersonKeyword] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [data, setData] = useState<{ items: TicketRecord[]; total: number; totalPages: number; summary: RecordSummary }>({
    items: [],
    total: 0,
    totalPages: 1,
    summary: { depositTotal: 0, withdrawTotal: 0, netTotal: 0, normalCount: 0, voidedCount: 0, lastRecordedAt: "" }
  });
  const [notice, setNotice] = useState("");
  const [detailRecord, setDetailRecord] = useState<TicketRecord | null>(null);

  async function loadHistory(nextPersonId = personId, nextPage = page, nextPageSize = pageSize) {
    if (!nextPersonId) {
      setData({ items: [], total: 0, totalPages: 1, summary: { depositTotal: 0, withdrawTotal: 0, netTotal: 0, normalCount: 0, voidedCount: 0, lastRecordedAt: "" } });
      setPage(1);
      setNotice("");
      return;
    }
    const result = await listRecords({ personId: nextPersonId, type, status, dateFrom, dateTo, page: nextPage, pageSize: nextPageSize });
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    setData({ items: result.data.items, total: result.data.total, totalPages: result.data.totalPages, summary: result.data.summary });
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

  useEffect(() => {
    if (!initialPerson) return;
    setPeople((items) => items.some((person) => person.id === initialPerson.id) ? items : [initialPerson, ...items]);
    setPersonId(initialPerson.id);
    setPersonKeyword(initialPerson.name);
    setPage(1);
    void loadHistory(initialPerson.id, 1);
  }, [initialPerson?.id]);

  async function resetFilters() {
    setPersonId("");
    setPersonKeyword("");
    setType("");
    setStatus("");
    setDateFrom("");
    setDateTo("");
    setData({ items: [], total: 0, totalPages: 1, summary: { depositTotal: 0, withdrawTotal: 0, netTotal: 0, normalCount: 0, voidedCount: 0, lastRecordedAt: "" } });
    setPage(1);
    setNotice("");
  }

  function selectPerson(person: Person) {
    setPersonId(person.id);
    setPersonKeyword(person.name);
    void loadHistory(person.id, 1);
  }

  function setDatePreset(preset: "today" | "week") {
    const today = localDate();
    if (preset === "today") {
      setDateFrom(today);
      setDateTo(today);
      return;
    }
    const start = new Date();
    start.setDate(start.getDate() - 6);
    setDateFrom(localDate(start));
    setDateTo(today);
  }

  const selectedPerson = people.find((person) => person.id === personId);
  const statusLabel = selectedPerson?.status === "normal" ? "正常" : selectedPerson?.status === "disabled" ? "停用" : selectedPerson?.status === "blocked" ? "拉黑" : "未选择";
  const activeFilters = [
    selectedPerson ? selectedPerson.name : "未选择存票人",
    dateFrom || dateTo ? `${dateFrom || "不限"} 至 ${dateTo || "不限"}` : "",
    type === "deposit" ? "存入" : type === "withdraw" ? "取用" : "",
    status === "normal" ? "正常" : status === "voided" ? "作废" : ""
  ].filter(Boolean).join(" / ");

  return (
    <section className="panel">
      <div className="filter-panel">
        <PersonSearchSelect
          people={people}
          selectedId={personId}
          value={personKeyword}
          onInputChange={(value) => { setPersonKeyword(value); setPersonId(""); setData({ items: [], total: 0, totalPages: 1, summary: { depositTotal: 0, withdrawTotal: 0, netTotal: 0, normalCount: 0, voidedCount: 0, lastRecordedAt: "" } }); }}
          onSelect={selectPerson}
        />
        <label>类型<select value={type} onChange={(event) => { setType(event.target.value); setPage(1); }}><option value="">全部类型</option><option value="deposit">存入</option><option value="withdraw">取用</option></select></label>
        <label>状态<select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">全部状态</option><option value="normal">正常</option><option value="voided">作废</option></select></label>
        <label>开始日期<input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
        <label>结束日期<input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
        <div className="filter-actions">
          <button className="primary-button" type="button" onClick={() => loadHistory(personId, 1)}>查询</button>
          <button className="secondary-button" type="button" onClick={resetFilters}>重置</button>
        </div>
      </div>
      <div className="quick-filter-row">
        <button className="ghost-button" type="button" onClick={() => setDatePreset("today")}>今日</button>
        <button className="ghost-button" type="button" onClick={() => setDatePreset("week")}>近 7 天</button>
      </div>
      <p className="filter-summary">当前查看：{activeFilters}，共 {data.total} 条记录。</p>
      <section className="history-profile">
        <div>
          <span>存票人</span>
          <strong>{selectedPerson?.name || "未选择"}</strong>
        </div>
        <div>
          <span>状态</span>
          <strong>{statusLabel}</strong>
        </div>
        <div>
          <span>最近操作</span>
          <strong>{data.summary.lastRecordedAt ? formatLocalMinute(data.summary.lastRecordedAt) : "暂无"}</strong>
        </div>
        <div>
          <span>备注</span>
          <strong>{selectedPerson?.note || "无备注"}</strong>
        </div>
      </section>
      <div className="history-summary-grid">
        <article className="metric-card"><span>当前余额</span><strong>{selectedPerson?.balance ?? 0}</strong></article>
        <article className="metric-card"><span>存入合计</span><strong>{data.summary.depositTotal}</strong></article>
        <article className="metric-card"><span>取用合计</span><strong>{data.summary.withdrawTotal}</strong></article>
        <article className="metric-card"><span>净变化</span><strong>{data.summary.netTotal}</strong></article>
        <article className="metric-card"><span>有效 / 作废</span><strong>{data.summary.normalCount} / {data.summary.voidedCount}</strong></article>
      </div>
      {notice && <p className="notice-text">{notice}</p>}
      <div className="responsive-table records-table">
        <div className="table-row header"><span>序号</span><span>时间</span><span>存票人</span><span>类型</span><span>票数</span><span>状态</span><span>备注</span></div>
        {data.items.map((record, index) => (
          <button className={`table-row clickable-row ${record.type} record-row-${record.status}`} key={record.id} type="button" onClick={() => setDetailRecord(record)}>
            <span className="row-no">{(page - 1) * pageSize + index + 1}</span>
            <strong>{formatLocalMinute(record.recordedAt)}</strong>
            <span>{record.personName}</span>
            <span>{record.type === "deposit" ? "存入" : "取用"}</span>
            <span>{record.type === "deposit" ? "+" : "-"}{record.amount}</span>
            <span>{record.status === "normal" ? "正常" : "作废"}</span>
            <span>{record.note || record.voidReason || "无备注"}</span>
          </button>
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
      {detailRecord && <RecordDetailModal record={detailRecord} onClose={() => setDetailRecord(null)} />}
    </section>
  );
}
