import { useEffect, useState } from "react";
import { listAuditLogs, type AuditLog } from "../api";
import { formatDateTime } from "../utils/time";

export function AuditLogsPage() {
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: AuditLog[]; total: number; totalPages: number }>({ items: [], total: 0, totalPages: 1 });
  const [notice, setNotice] = useState("");

  async function loadLogs(nextPage = page) {
    const result = await listAuditLogs({ actor, action, page: nextPage, pageSize: 10 });
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

  return (
    <section className="panel">
      <div className="filter-panel">
        <label>操作人<input value={actor} onChange={(event) => setActor(event.target.value)} placeholder="搜索操作人" /></label>
        <label>操作类型<select value={action} onChange={(event) => setAction(event.target.value)}><option value="">全部类型</option><option value="新增记录">新增记录</option><option value="作废记录">作废记录</option><option value="恢复记录">恢复记录</option><option value="新增存票人">新增存票人</option><option value="修改存票人状态">修改存票人状态</option><option value="登录">登录</option></select></label>
        <div className="filter-actions"><button className="primary-button" type="button" onClick={() => loadLogs(1)}>查询</button></div>
      </div>
      <p className="filter-summary">管理员查看全部日志，操作员只查看自己的操作。</p>
      {notice && <p className="notice-text">{notice}</p>}
      <div className="responsive-table audit-table">
        <div className="table-row header"><span>序号</span><span>时间</span><span>操作人</span><span>类型</span><span>对象</span><span>摘要</span></div>
        {data.items.map((log, index) => (
          <div className="table-row" key={log.id}>
            <span>{(page - 1) * 10 + index + 1}</span>
            <strong>{formatDateTime(log.createdAt)}</strong>
            <span>{log.actorName}</span>
            <span>{log.action}</span>
            <span>{log.targetType}</span>
            <span>{log.summary}</span>
          </div>
        ))}
      </div>
      <div className="pagination-bar">
        <button type="button" disabled={page <= 1} onClick={() => loadLogs(page - 1)}>上一页</button>
        <span>第 {page} / {data.totalPages} 页，共 {data.total} 条</span>
        <button type="button" disabled={page >= data.totalPages} onClick={() => loadLogs(page + 1)}>下一页</button>
      </div>
    </section>
  );
}
