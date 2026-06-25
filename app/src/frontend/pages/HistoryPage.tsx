import { useEffect, useState } from "react";
import { listPeople, listRecords, type Person, type TicketRecord } from "../api";

export function HistoryPage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [personId, setPersonId] = useState("");
  const [records, setRecords] = useState<TicketRecord[]>([]);
  const [notice, setNotice] = useState("");

  async function loadHistory(nextPersonId = personId) {
    if (!nextPersonId) return;
    const result = await listRecords({ personId: nextPersonId, pageSize: 50 });
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    setRecords(result.data.items);
    setNotice("");
  }

  useEffect(() => {
    listPeople({ pageSize: 50 }).then((result) => {
      if (result.ok) {
        setPeople(result.data.items);
        const firstId = result.data.items[0]?.id || "";
        setPersonId(firstId);
        void loadHistory(firstId);
      }
    });
  }, []);

  return (
    <section className="panel">
      <div className="filter-panel">
        <label>存票人<select value={personId} onChange={(event) => { setPersonId(event.target.value); void loadHistory(event.target.value); }}>{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
        <label>类型<select><option>全部类型</option><option>存入</option><option>取用</option></select></label>
        <label>状态<select><option>全部状态</option><option>正常</option><option>作废</option></select></label>
      </div>
      <p className="filter-summary">个人历史保留完整流水，用于核对每一步余额变化。</p>
      {notice && <p className="notice-text">{notice}</p>}
      <div className="responsive-table records-table">
        <div className="table-row header"><span>序号</span><span>时间</span><span>存票人</span><span>类型</span><span>票数</span><span>状态</span><span>备注</span></div>
        {records.map((record, index) => (
          <div className={`table-row record-row-${record.status}`} key={record.id}>
            <span>{index + 1}</span>
            <strong>{record.recordedAt.replace("T", " ")}</strong>
            <span>{record.personName}</span>
            <span>{record.type === "deposit" ? "存入" : "取用"}</span>
            <span>{record.type === "deposit" ? "+" : "-"}{record.amount}</span>
            <span>{record.status === "normal" ? "正常" : "作废"}</span>
            <span>{record.note || record.voidReason || "无备注"}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
