import type { TicketRecord } from "../../api";
import { formatLocalMinute } from "../../utils/time";

type RecordDetailModalProps = {
  record: TicketRecord;
  onClose: () => void;
};

export function RecordDetailModal({ record, onClose }: RecordDetailModalProps) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="recordDetailTitle">
        <h3 id="recordDetailTitle">流水详情</h3>
        <p className="muted">用于核对单条存取记录的时间、数量和备注。</p>
        <div className="confirm-grid">
          <span>存票人</span><strong>{record.personName}</strong>
          <span>类型</span><strong>{record.type === "deposit" ? "存入" : "取用"}</strong>
          <span>票数</span><strong>{record.type === "deposit" ? "+" : "-"}{record.amount}</strong>
          <span>记录时间</span><strong>{formatLocalMinute(record.recordedAt)}</strong>
          <span>状态</span><strong>{record.status === "normal" ? "正常" : "作废"}</strong>
          <span>余额变化</span><strong>{record.balanceDelta >= 0 ? "+" : ""}{record.balanceDelta}</strong>
          <span>备注</span><strong>{record.note || "无备注"}</strong>
          <span>作废原因</span><strong>{record.voidReason || "无"}</strong>
          <span>创建时间</span><strong>{formatLocalMinute(record.createdAt)}</strong>
          <span>更新时间</span><strong>{formatLocalMinute(record.updatedAt)}</strong>
        </div>
        <div className="button-row modal-actions">
          <button className="primary-button" type="button" onClick={onClose}>关闭</button>
        </div>
      </section>
    </div>
  );
}
