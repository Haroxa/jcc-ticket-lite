import { useEffect, useState } from "react";
import { createRecord, listPeople, listRecords, type Account, type Person, type TicketRecord } from "../api";
import { PersonSearchSelect } from "../components/PersonSearchSelect/PersonSearchSelect";
import { formatLocalMinute } from "../utils/time";
import { canWrite } from "../utils/permissions";

function currentMinute() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

type CalcStep = {
  price: number;
  qty: number;
  direction: 1 | -1;
};

const prices = [99, 199, 299, 366, 520, 999, 1314, 3000];

type EntryPageProps = {
  account: Account;
};

export function EntryPage({ account }: EntryPageProps) {
  const [people, setPeople] = useState<Person[]>([]);
  const [personId, setPersonId] = useState("");
  const [personKeyword, setPersonKeyword] = useState("");
  const [recordedAt, setRecordedAt] = useState(currentMinute());
  const [type, setType] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState("");
  const [showCalculator, setShowCalculator] = useState(false);
  const [calcQty, setCalcQty] = useState(1);
  const [customPrice, setCustomPrice] = useState("");
  const [calcSteps, setCalcSteps] = useState<CalcStep[]>([]);
  const [recentRecords, setRecentRecords] = useState<TicketRecord[]>([]);

  useEffect(() => {
    listPeople({ status: "normal", pageSize: 50 }).then((result) => {
      if (result.ok) {
        setPeople(result.data.items);
      }
    });
  }, []);

  const selectedPerson = people.find((person) => person.id === personId);
  const numericAmount = Number(amount);
  const nextBalance = selectedPerson && Number.isFinite(numericAmount) && numericAmount > 0
    ? selectedPerson.balance + (type === "deposit" ? numericAmount : -numericAmount)
    : selectedPerson?.balance ?? 0;
  const calcTotal = calcSteps.reduce((sum, step) => sum + step.price * step.qty * step.direction, 0);

  async function loadRecentRecords(nextPersonId: string) {
    if (!nextPersonId) {
      setRecentRecords([]);
      return;
    }
    const result = await listRecords({ personId: nextPersonId, page: 1, pageSize: 5 });
    if (result.ok) setRecentRecords(result.data.items);
  }

  function selectPerson(person: Person) {
    setPersonId(person.id);
    setPersonKeyword(person.name);
    void loadRecentRecords(person.id);
  }

  function addCalcStep(price: number, direction: 1 | -1) {
    if (!Number.isFinite(price) || price <= 0) return;
    setCalcSteps((steps) => [...steps, { price: Math.floor(price), qty: Math.max(1, calcQty), direction }]);
  }

  function updateCalcStep(index: number, patch: Partial<CalcStep>) {
    setCalcSteps((steps) => steps.map((step, currentIndex) => currentIndex === index ? { ...step, ...patch } : step));
  }

  function applyCalcValue(mode: "raw" | "floor" | "ceil") {
    const value = mode === "floor"
      ? Math.floor(calcTotal / 100) * 100
      : mode === "ceil"
        ? Math.ceil(calcTotal / 100) * 100
        : calcTotal;
    setAmount(String(Math.max(0, value)));
  }

  async function handleSave() {
    if (!canWrite(account)) {
      setNotice("当前角色不能录入。");
      return;
    }
    if (!personId) {
      setNotice("请选择存票人。");
      return;
    }
    if (!Number.isInteger(Number(amount)) || Number(amount) <= 0) {
      setNotice("票数必须是大于 0 的整数。");
      return;
    }
    if (type === "withdraw" && selectedPerson && Number(amount) > selectedPerson.balance) {
      setNotice(`当前余额 ${selectedPerson.balance}，不能取用 ${amount}。`);
      return;
    }
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
    const refreshed = await listPeople({ status: "normal", pageSize: 50 });
    if (refreshed.ok) setPeople(refreshed.data.items);
    await loadRecentRecords(personId);
  }

  return (
    <div className="entry-layout">
      <section className="panel form-panel">
        <label>时间<input type="datetime-local" value={recordedAt} onChange={(event) => setRecordedAt(event.target.value)} /></label>
        <PersonSearchSelect
          people={people}
          selectedId={personId}
          value={personKeyword}
          emptyText="没有匹配的正常存票人。"
          onInputChange={(value) => { setPersonKeyword(value); setPersonId(""); setRecentRecords([]); }}
          onSelect={selectPerson}
        />
        <div>
          <span className="field-label">类型</span>
          <div className="segmented">
            <button className={`segment ${type === "deposit" ? "active" : ""}`} type="button" onClick={() => setType("deposit")}>存入</button>
            <button className={`segment ${type === "withdraw" ? "active" : ""}`} type="button" onClick={() => setType("withdraw")}>取用</button>
          </div>
        </div>
        <label>票数<input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="numeric" placeholder="请输入正整数" /></label>
        <div className={`balance-preview ${nextBalance < 0 ? "danger" : numericAmount > 0 ? "ok" : ""}`}>
          {selectedPerson ? `当前余额 ${selectedPerson.balance}${numericAmount > 0 ? `，${type === "deposit" ? "存入后" : "取用后"}余额 ${nextBalance}` : ""}。` : "请选择存票人。"}
        </div>
        <label>备注<textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="来源或原因" /></label>
        <div className="button-row">
          <button className="primary-button" disabled={!canWrite(account)} type="button" onClick={handleSave}>保存记录</button>
          <button className="secondary-button" type="button" onClick={() => setShowCalculator((value) => !value)}>{showCalculator ? "收起计算工具" : "展开计算工具"}</button>
        </div>
        {notice && <p className="notice-text">{notice}</p>}
      </section>

      <aside className="panel person-side">
        <div className="panel-header"><h3>{selectedPerson?.name || "未选择"}</h3><span>当前存票人</span></div>
        <div className="balance-display">{selectedPerson?.balance ?? 0}</div>
        <p className="muted">只显示正常状态存票人；停用和拉黑不可录入。</p>
        <div className="person-recent-block">
          <div className="panel-header compact"><h3>最近操作</h3><span>最近 5 条</span></div>
          <div className="person-recent-list">
            {recentRecords.map((record) => (
              <article className={`record-card ${record.type} ${record.status === "voided" ? "voided" : ""}`} key={record.id}>
                <strong>{record.type === "deposit" ? "存入" : "取用"} {record.amount}</strong>
                <span>{formatLocalMinute(record.recordedAt)} · {record.status === "normal" ? "正常" : "作废"}</span>
                {(record.note || record.voidReason) && <span>{record.note || record.voidReason}</span>}
              </article>
            ))}
            {!selectedPerson && <p className="empty-inline">选择存票人后显示最近操作。</p>}
            {selectedPerson && !recentRecords.length && <p className="empty-inline">该存票人暂无历史记录。</p>}
          </div>
        </div>
      </aside>

      {showCalculator && (
        <section className="panel calculator-panel">
          <div className="panel-header"><h3>计算工具</h3><span>辅助计算票数，保存后才生成流水</span></div>
          <div className="calculator-grid">
            <div>
              <label>本次数量</label>
              <div className="qty-editor">
                <button className="secondary-button" type="button" onClick={() => setCalcQty((value) => Math.max(1, value - 1))}>-</button>
                <input value={calcQty} onChange={(event) => setCalcQty(Math.max(1, Number(event.target.value || 1)))} inputMode="numeric" />
                <button className="secondary-button" type="button" onClick={() => setCalcQty((value) => value + 1)}>+</button>
              </div>
              <div className="quick-qty-row">
                {[1, 2, 3, 5, 10].map((qty) => <button key={qty} type="button" onClick={() => setCalcQty(qty)}>{qty}</button>)}
              </div>
              <label>自定义价格<input value={customPrice} onChange={(event) => setCustomPrice(event.target.value)} inputMode="numeric" placeholder="例如 188" /></label>
              <div className="button-row">
                <button className="secondary-button" type="button" onClick={() => addCalcStep(Number(customPrice), 1)}>+ 自定义</button>
                <button className="secondary-button" type="button" onClick={() => addCalcStep(Number(customPrice), -1)}>- 自定义</button>
              </div>
              <div className="price-grid">
                {prices.map((price) => (
                  <button key={`add-${price}`} className="price-button add" type="button" onClick={() => addCalcStep(price, 1)}>+{price}</button>
                ))}
                {prices.map((price) => (
                  <button key={`sub-${price}`} className="price-button sub" type="button" onClick={() => addCalcStep(price, -1)}>-{price}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="calc-chain">
                {!!calcSteps.length && (
                  <div className="calc-chain-head">
                    <span>#</span><span>方向</span><span>价格</span><span>数量</span><span>小计</span><span>操作</span>
                  </div>
                )}
                {calcSteps.map((step, index) => {
                  const subtotal = step.price * step.qty * step.direction;
                  return (
                    <div className={`calc-chain-row ${step.direction > 0 ? "add" : "sub"}`} key={index}>
                      <span>{index + 1}</span>
                      <select value={step.direction} onChange={(event) => updateCalcStep(index, { direction: Number(event.target.value) as 1 | -1 })}><option value={1}>+</option><option value={-1}>-</option></select>
                      <input value={step.price} onChange={(event) => updateCalcStep(index, { price: Math.max(1, Number(event.target.value || 1)) })} inputMode="numeric" />
                      <input value={step.qty} onChange={(event) => updateCalcStep(index, { qty: Math.max(1, Number(event.target.value || 1)) })} inputMode="numeric" />
                      <strong>{subtotal >= 0 ? "+" : ""}{subtotal}</strong>
                      <button type="button" onClick={() => setCalcSteps((steps) => steps.filter((_, currentIndex) => currentIndex !== index))}>删除</button>
                    </div>
                  );
                })}
                {!calcSteps.length && <p className="muted">暂无计算步骤。</p>}
              </div>
              <div className="result-row"><span>原始总数</span><strong>{calcTotal}</strong></div>
              <div className="result-row"><span>向下抹零</span><strong>{Math.floor(calcTotal / 100) * 100}</strong></div>
              <div className="result-row"><span>向上取整</span><strong>{Math.ceil(calcTotal / 100) * 100}</strong></div>
              <div className="button-row result-actions">
                <button className="primary-button" type="button" onClick={() => applyCalcValue("raw")}>应用原始</button>
                <button className="primary-button" type="button" onClick={() => applyCalcValue("floor")}>应用抹零</button>
                <button className="primary-button" type="button" onClick={() => applyCalcValue("ceil")}>应用取整</button>
                <button className="secondary-button" type="button" onClick={() => setCalcSteps([])}>清空</button>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
