import { useEffect, useState } from "react";
import { listRecords, restoreRecord, voidRecord, type Account, type TicketRecord } from "../api";
import { EmptyState } from "../components/EmptyState/EmptyState";
import { Pagination } from "../components/Pagination/Pagination";
import { formatLocalMinute } from "../utils/time";
import { canWrite } from "../utils/permissions";

type RecordsPageProps = {
  account: Account;
};

function localDate(value = new Date()) {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function monthStart() {
  const now = new Date();
  return localDate(new Date(now.getFullYear(), now.getMonth(), 1));
}

export function RecordsPage({ account }: RecordsPageProps) {
  const [keyword, setKeyword] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [data, setData] = useState<{ items: TicketRecord[]; total: number; totalPages: number }>({ items: [], total: 0, totalPages: 1 });
  const [notice, setNotice] = useState("");

  async function loadRecords(nextPage = page) {
    const result = await listRecords({ keyword, type, status, dateFrom, dateTo, page: nextPage, pageSize });
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    setData({ items: result.data.items, total: result.data.total, totalPages: result.data.totalPages });
    setPage(result.data.page);
    setNotice("");
  }

  useEffect(() => {
    void loadRecords(1);
  }, []);

  async function resetFilters() {
    setKeyword("");
    setType("");
    setStatus("");
    setDateFrom("");
    setDateTo("");
    const result = await listRecords({ keyword: "", type: "", status: "", dateFrom: "", dateTo: "", page: 1, pageSize });
    if (result.ok) {
      setData({ items: result.data.items, total: result.data.total, totalPages: result.data.totalPages });
      setPage(result.data.page);
      setNotice("");
    } else {
      setNotice(result.message);
    }
  }

  async function handleToggle(record: TicketRecord) {
    if (!canWrite(account)) {
      setNotice("当前角色不能修改流水状态。");
      return;
    }
    const result = record.status === "normal"
      ? await voidRecord(record.id, window.prompt("请输入作废原因") || "")
      : await restoreRecord(record.id);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    await loadRecords(page);
  }

  function setDatePreset(preset: "today" | "week" | "month") {
    const today = localDate();
    if (preset === "today") {
      setDateFrom(today);
      setDateTo(today);
      return;
    }
    if (preset === "week") {
      const start = new Date();
      start.setDate(start.getDate() - 6);
      setDateFrom(localDate(start));
      setDateTo(today);
      return;
    }
    setDateFrom(monthStart());
    setDateTo(today);
  }

  const filterSummary = [
    dateFrom || dateTo ? `${dateFrom || "不限"} 至 ${dateTo || "不限"}` : "全部时间",
    type === "deposit" ? "存入" : type === "withdraw" ? "取用" : "全部类型",
    status === "normal" ? "正常" : status === "voided" ? "作废" : "全部状态",
    keyword ? `关键词“${keyword}”` : ""
  ].filter(Boolean).join(" / ");

  return (
    <section className="panel">
      <div className="filter-panel">
        <label>关键词<input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索存票人或备注" /></label>
        <label>类型<select value={type} onChange={(event) => setType(event.target.value)}><option value="">全部类型</option><option value="deposit">存入</option><option value="withdraw">取用</option></select></label>
        <label>状态<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">全部状态</option><option value="normal">正常</option><option value="voided">作废</option></select></label>
        <label>开始日期<input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
        <label>结束日期<input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
        <div className="filter-actions">
          <button className="primary-button" type="button" onClick={() => loadRecords(1)}>查询</button>
          <button className="secondary-button" type="button" onClick={resetFilters}>重置</button>
        </div>
      </div>
      <div className="quick-filter-row">
        <button className="ghost-button" type="button" onClick={() => setDatePreset("today")}>今日</button>
        <button className="ghost-button" type="button" onClick={() => setDatePreset("week")}>近 7 天</button>
        <button className="ghost-button" type="button" onClick={() => setDatePreset("month")}>本月</button>
      </div>
      <p className="filter-summary">当前显示：{filterSummary}，共 {data.total} 条。</p>
      {notice && <p className="notice-text">{notice}</p>}
      <div className="responsive-table records-table">
        <div className="table-row header"><span>序号</span><span>时间</span><span>存票人</span><span>类型</span><span>票数</span><span>状态</span><span>操作</span></div>
        {data.items.map((record, index) => (
          <div className={`table-row ${record.type} record-row-${record.status}`} key={record.id}>
            <span className="row-no">{(page - 1) * pageSize + index + 1}</span>
            <strong>{formatLocalMinute(record.recordedAt)}</strong>
            <span>{record.personName}</span>
            <span>{record.type === "deposit" ? "存入" : "取用"}</span>
            <span>{record.type === "deposit" ? "+" : "-"}{record.amount}</span>
            <span>{record.status === "normal" ? "正常" : "作废"}</span>
            {canWrite(account) ? (
              <button className="secondary-button row-action" type="button" onClick={() => handleToggle(record)}>{record.status === "normal" ? "作废" : "恢复"}</button>
            ) : <span className="muted">只读</span>}
          </div>
        ))}
        {!data.items.length && <EmptyState title="暂无存取记录" description="当前筛选条件下没有流水，可重置筛选或先录入一条记录。" />}
      </div>
      <Pagination
        page={page}
        totalPages={data.totalPages}
        total={data.total}
        pageSize={pageSize}
        onPageChange={(nextPage) => loadRecords(nextPage)}
        onPageSizeChange={(nextPageSize) => { setPageSize(nextPageSize); void listRecords({ keyword, type, status, dateFrom, dateTo, page: 1, pageSize: nextPageSize }).then((result) => { if (result.ok) { setData({ items: result.data.items, total: result.data.total, totalPages: result.data.totalPages }); setPage(result.data.page); setNotice(""); } else setNotice(result.message); }); }}
      />
    </section>
  );
}
