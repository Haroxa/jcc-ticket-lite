import { useEffect, useState } from "react";
import { createRecord, listPeople, type Person } from "../api";

function currentMinute() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export function EntryPage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [personId, setPersonId] = useState("");
  const [recordedAt, setRecordedAt] = useState(currentMinute());
  const [type, setType] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    listPeople({ status: "normal", pageSize: 50 }).then((result) => {
      if (result.ok) {
        setPeople(result.data.items);
        setPersonId(result.data.items[0]?.id || "");
      }
    });
  }, []);

  async function handleSave() {
    const result = await createRecord({
      personId,
      recordedAt,
      type,
      amount: Number(amount),
      note
    });
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    setAmount("");
    setNote("");
    setNotice(`记录已保存，当前余额 ${result.data.balance}。`);
  }

  return (
    <section className="panel form-panel">
      <label>时间<input type="datetime-local" value={recordedAt} onChange={(event) => setRecordedAt(event.target.value)} /></label>
      <label>存票人<select value={personId} onChange={(event) => setPersonId(event.target.value)}>{people.map((person) => <option key={person.id} value={person.id}>{person.name} · 余额 {person.balance}</option>)}</select></label>
      <label>类型<select value={type} onChange={(event) => setType(event.target.value as "deposit" | "withdraw")}><option value="deposit">存入</option><option value="withdraw">取用</option></select></label>
      <label>票数<input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="numeric" placeholder="请输入正整数" /></label>
      <label>备注<textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="来源或原因" /></label>
      <div className="button-row">
        <button className="primary-button" type="button" onClick={handleSave}>保存记录</button>
        <button className="secondary-button" type="button">展开计算工具</button>
      </div>
      {notice && <p className="notice-text">{notice}</p>}
    </section>
  );
}
