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
  const [detailLog, setDetailLog] = useState<AuditLog | null>(null);

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
        <label>操作类型<select value={action} onChange={(event) => setAction(event.target.value)}><option value="">全部类型</option><option value="新增记录">新增记录</option><option value="作废记录">作废记录</option><option value="恢复记录">恢复记录</option><option value="新增存票人">新增存票人</option><option value="编辑存票人">编辑存票人</option><option value="修改存票人状态">修改存票人状态</option><option value="新增账号">新增账号</option><option value="编辑账号">编辑账号</option><option value="修改账号状态">修改账号状态</option><option value="重置账号密码">重置账号密码</option><option value="修改自己密码">修改自己密码</option><option value="初始化管理员">初始化管理员</option><option value="登录">登录</option></select></label>
        <div className="filter-actions">
          <button className="primary-button" type="button" onClick={() => loadLogs(1)}>查询</button>
          <button className="secondary-button" type="button" onClick={resetFilters}>重置</button>
        </div>
      </div>
      <p className="filter-summary">{account.role === "admin" ? "管理员查看全部日志。" : "操作员只查看自己的操作。"}</p>
      {notice && <p className="notice-text">{notice}</p>}
      <div className="responsive-table audit-table">
        <div className="table-row header"><span>序号</span><span>时间</span><span>操作人</span><span>类型</span><span>对象</span><span>摘要</span><span>详情</span></div>
        {data.items.map((log, index) => (
          <div className="table-row" key={log.id}>
            <span className="row-no">{(page - 1) * pageSize + index + 1}</span>
            <strong>{formatDateTime(log.createdAt)}</strong>
            <span>{log.actorName}</span>
            <span>{log.action}</span>
            <span>{targetTypeLabel(log.targetType)}</span>
            <span>{log.summary}</span>
            <button className="secondary-button row-action" type="button" onClick={() => setDetailLog(log)}>查看</button>
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
      {detailLog && <AuditLogDetailModal log={detailLog} onCancel={() => setDetailLog(null)} />}
    </section>
  );
}

function targetTypeLabel(value: string) {
  if (value === "account") return "账号";
  if (value === "person") return "存票人";
  if (value === "record") return "流水";
  return value || "无";
}

function formatData(value: unknown) {
  if (!value || typeof value !== "object") return "无";
  return Object.entries(value as Record<string, unknown>)
    .map(([key, item]) => `${key}: ${item === null || item === undefined || item === "" ? "空" : String(item)}`)
    .join("\n");
}

function hasData(value: unknown) {
  return !!value && typeof value === "object" && Object.keys(value as Record<string, unknown>).length > 0;
}

function AuditLogDetailModal({ log, onCancel }: {
  log: AuditLog;
  onCancel: () => void;
}) {
  const hasBefore = hasData(log.beforeData);
  const hasAfter = hasData(log.afterData);
  const changeTitle = hasBefore && hasAfter ? ["变更前", "变更后"] : ["变更前", "新增内容"];

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-card audit-detail-modal" role="dialog" aria-modal="true" aria-labelledby="auditDetailTitle">
        <h3 id="auditDetailTitle">操作详情</h3>
        <div className="confirm-grid">
          <span>时间</span><strong>{formatDateTime(log.createdAt)}</strong>
          <span>操作人</span><strong>{log.actorName}</strong>
          <span>类型</span><strong>{log.action}</strong>
          <span>对象</span><strong>{targetTypeLabel(log.targetType)}{log.targetId ? ` · ${log.targetId}` : ""}</strong>
          <span>摘要</span><strong>{log.summary}</strong>
        </div>
        {hasBefore || hasAfter ? (
          <div className={`audit-change-grid ${hasBefore && hasAfter ? "" : "single"}`}>
            {hasBefore && (
              <div>
                <h4>{changeTitle[0]}</h4>
                <pre>{formatData(log.beforeData)}</pre>
              </div>
            )}
            {hasAfter && (
              <div>
                <h4>{changeTitle[1]}</h4>
                <pre>{formatData(log.afterData)}</pre>
              </div>
            )}
          </div>
        ) : (
          <p className="empty-inline">该操作没有结构化变更数据，请以摘要为准。</p>
        )}
        <div className="button-row modal-actions">
          <button className="primary-button" type="button" onClick={onCancel}>关闭</button>
        </div>
      </section>
    </div>
  );
}
