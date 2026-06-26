import { useEffect, useState } from "react";
import { listAuditLogs, type Account, type AuditLog } from "../api";
import { EmptyState } from "../components/EmptyState/EmptyState";
import { Pagination } from "../components/Pagination/Pagination";
import { formatDateTime } from "../utils/time";

type AuditLogsPageProps = {
  account: Account;
};

export function AuditLogsPage({ account }: AuditLogsPageProps) {
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [data, setData] = useState<{ items: AuditLog[]; total: number; totalPages: number }>({ items: [], total: 0, totalPages: 1 });
  const [notice, setNotice] = useState("");

  async function loadLogs(nextPage = page) {
    const result = await listAuditLogs({ actor, action, page: nextPage, pageSize });
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    setData({ items: result.data.items, total: result.data.total, totalPages: result.data.totalPages });
    setPage(result.data.page);
    setNotice("");
  }

  useEffect(() => {
    void loadLogs(1);
  }, []);

  async function resetFilters() {
    setActor("");
    setAction("");
    const result = await listAuditLogs({ actor: "", action: "", page: 1, pageSize });
    if (result.ok) {
      setData({ items: result.data.items, total: result.data.total, totalPages: result.data.totalPages });
      setPage(result.data.page);
      setNotice("");
    } else {
      setNotice(result.message);
    }
  }

  return (
    <section className="panel">
      <div className="filter-panel">
        <label>操作人<input value={actor} onChange={(event) => setActor(event.target.value)} placeholder="搜索操作人" /></label>
        <label>操作类型<select value={action} onChange={(event) => setAction(event.target.value)}><option value="">全部类型</option><option value="新增记录">新增记录</option><option value="作废记录">作废记录</option><option value="恢复记录">恢复记录</option><option value="新增存票人">新增存票人</option><option value="修改存票人状态">修改存票人状态</option><option value="登录">登录</option></select></label>
        <div className="filter-actions">
          <button className="primary-button" type="button" onClick={() => loadLogs(1)}>查询</button>
          <button className="secondary-button" type="button" onClick={resetFilters}>重置</button>
        </div>
      </div>
      <p className="filter-summary">{account.role === "admin" ? "管理员查看全部日志。" : "操作员只查看自己的操作。"}</p>
      {notice && <p className="notice-text">{notice}</p>}
      <div className="responsive-table audit-table">
        <div className="table-row header"><span>序号</span><span>时间</span><span>操作人</span><span>类型</span><span>对象</span><span>摘要</span></div>
        {data.items.map((log, index) => (
          <div className="table-row" key={log.id}>
            <span className="row-no">{(page - 1) * pageSize + index + 1}</span>
            <strong>{formatDateTime(log.createdAt)}</strong>
            <span>{log.actorName}</span>
            <span>{log.action}</span>
            <span>{log.targetType}</span>
            <span>{log.summary}</span>
          </div>
        ))}
        {!data.items.length && <EmptyState title="暂无操作日志" description="当前筛选条件下没有日志，可重置筛选后查看。" />}
      </div>
      <Pagination
        page={page}
        totalPages={data.totalPages}
        total={data.total}
        pageSize={pageSize}
        onPageChange={(nextPage) => loadLogs(nextPage)}
        onPageSizeChange={(nextPageSize) => { setPageSize(nextPageSize); void listAuditLogs({ actor, action, page: 1, pageSize: nextPageSize }).then((result) => { if (result.ok) { setData({ items: result.data.items, total: result.data.total, totalPages: result.data.totalPages }); setPage(result.data.page); setNotice(""); } else setNotice(result.message); }); }}
      />
    </section>
  );
}
