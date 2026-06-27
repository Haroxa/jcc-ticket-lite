import { useEffect, useMemo, useState } from "react";
import {
  createLiveRankSession,
  getLiveRankSession,
  listLiveRankSessions,
  listPeople,
  liveRankAction,
  upsertLiveRankEntry,
  type Account,
  type LiveRankEntry,
  type LiveRankSession,
  type LiveRankEntryStatus,
  type Person
} from "../api";
import { PersonSearchSelect } from "../components/PersonSearchSelect/PersonSearchSelect";
import { formatDateTime } from "../utils/time";
import { canWrite } from "../utils/permissions";

const statusLabel: Record<LiveRankSession["status"], string> = {
  live: "记录中",
  countdown: "倒计时",
  frozen: "已冻结",
  pending_settlement: "待结算",
  settled: "已结算",
  cancelled: "已取消"
};

const rankStatusLabel: Record<LiveRankEntryStatus, string> = {
  normal: "正常排行",
  pending: "待定",
  away: "有事不来"
};

type ActiveNumberField = "giftDiamonds" | "ticketUsed" | "ticketDeposit";
type CountdownStatus = "idle" | "running" | "paused";

type SettlementReviewRow = {
  id: string;
  personName: string;
  type: "存票" | "取票";
  amount: number;
  before: number;
  after: number;
  status: string;
};

const activeFieldLabel: Record<ActiveNumberField, string> = {
  giftDiamonds: "礼物钻",
  ticketUsed: "取票",
  ticketDeposit: "存票"
};

type LiveRankingPageProps = {
  account: Account;
};

function currentTitle() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())} 结算窗口`;
}

function positiveInt(value: string) {
  const next = Number(value || 0);
  return Number.isInteger(next) && next >= 0 ? next : 0;
}

function formatRemaining(seconds: number) {
  const minute = Math.floor(seconds / 60);
  const second = seconds % 60;
  return `${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`;
}

export function LiveRankingPage({ account }: LiveRankingPageProps) {
  const [sessions, setSessions] = useState<LiveRankSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [session, setSession] = useState<LiveRankSession | null>(null);
  const [entries, setEntries] = useState<LiveRankEntry[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [personId, setPersonId] = useState("");
  const [personKeyword, setPersonKeyword] = useState("");
  const [giftDiamonds, setGiftDiamonds] = useState("");
  const [ticketUsed, setTicketUsed] = useState("");
  const [ticketDeposit, setTicketDeposit] = useState("");
  const [rankStatus, setRankStatus] = useState<LiveRankEntryStatus>("normal");
  const [note, setNote] = useState("");
  const [title, setTitle] = useState(currentTitle());
  const [sessionNote, setSessionNote] = useState("");
  const [countdownSeconds, setCountdownSeconds] = useState(180);
  const [countdownLeft, setCountdownLeft] = useState(180);
  const [countdownStatus, setCountdownStatus] = useState<CountdownStatus>("idle");
  const [notice, setNotice] = useState("");
  const [activeNumberField, setActiveNumberField] = useState<ActiveNumberField>("giftDiamonds");
  const [showSettlementReview, setShowSettlementReview] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const selectedPerson = people.find((person) => person.id === personId);
  const sortedEntries = useMemo(() => [...entries].sort((a, b) => b.score - a.score || a.updatedAt.localeCompare(b.updatedAt) || a.personName.localeCompare(b.personName)), [entries]);
  const normalEntries = useMemo(() => sortedEntries.filter((entry) => entry.rankStatus === "normal"), [sortedEntries]);
  const pendingEntries = useMemo(() => sortedEntries.filter((entry) => entry.rankStatus !== "normal"), [sortedEntries]);
  const settlementReviewRows = useMemo(() => {
    const rows: SettlementReviewRow[] = [];
    sortedEntries.forEach((entry) => {
      if (entry.ticketUsed > 0) {
        rows.push({
          id: `${entry.id}-withdraw`,
          personName: entry.personName,
          type: "取票",
          amount: entry.ticketUsed,
          before: entry.currentBalance,
          after: entry.currentBalance - entry.ticketUsed,
          status: rankStatusLabel[entry.rankStatus]
        });
      }
      if (entry.ticketDeposit > 0) {
        rows.push({
          id: `${entry.id}-deposit`,
          personName: entry.personName,
          type: "存票",
          amount: entry.ticketDeposit,
          before: entry.currentBalance - entry.ticketUsed,
          after: entry.currentBalance - entry.ticketUsed + entry.ticketDeposit,
          status: rankStatusLabel[entry.rankStatus]
        });
      }
    });
    return rows;
  }, [sortedEntries]);
  const entryTotal = sortedEntries.reduce((sum, entry) => sum + entry.score, 0);
  const countdownDisplay = countdownStatus === "idle" ? countdownSeconds : countdownLeft;
  const canEditSession = !!session && session.status !== "settled" && session.status !== "cancelled" && canWrite(account);
  const canControlCountdown = canEditSession;
  const previewScore = positiveInt(giftDiamonds) + positiveInt(ticketUsed) - positiveInt(ticketDeposit);
  const previewBalance = selectedPerson ? selectedPerson.balance - positiveInt(ticketUsed) + positiveInt(ticketDeposit) : 0;

  async function loadSessions(nextActiveId = activeSessionId) {
    const result = await listLiveRankSessions();
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    setSessions(result.data.items);
    const nextId = nextActiveId || result.data.items.find((item) => item.status !== "settled" && item.status !== "cancelled")?.id || result.data.items[0]?.id || "";
    setActiveSessionId(nextId);
    if (nextId) await loadSession(nextId);
  }

  async function loadSession(sessionId: string) {
    const result = await getLiveRankSession(sessionId);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    setSession(result.data.session);
    setEntries(result.data.entries);
    setCountdownStatus("idle");
    setCountdownLeft(countdownSeconds);
    setNotice("");
  }

  useEffect(() => {
    void loadSessions();
    listPeople({ status: "normal", pageSize: 50 }).then((result) => {
      if (result.ok) setPeople(result.data.items);
    });
  }, []);

  useEffect(() => {
    if (countdownStatus !== "running") return;
    const timer = window.setInterval(() => {
      setCountdownLeft((value) => {
        if (value <= 1) {
          window.clearInterval(timer);
          setCountdownStatus("idle");
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [countdownStatus]);

  useEffect(() => {
    if (countdownStatus === "idle") setCountdownLeft(countdownSeconds);
  }, [countdownSeconds, countdownStatus]);

  async function createSession() {
    if (!title.trim()) {
      setNotice("请输入场次名称。");
      return;
    }
    const result = await createLiveRankSession({ title: title.trim(), note: sessionNote.trim() });
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    setTitle(currentTitle());
    setSessionNote("");
    await loadSessions(result.data.session.id);
  }

  function selectPerson(person: Person) {
    setPersonId(person.id);
    setPersonKeyword(person.name);
    const existing = entries.find((entry) => entry.personId === person.id);
    setGiftDiamonds(existing ? String(existing.giftDiamonds) : "");
    setTicketUsed(existing ? String(existing.ticketUsed) : "");
    setTicketDeposit(existing ? String(existing.ticketDeposit) : "");
    setRankStatus(existing?.rankStatus || "normal");
    setNote(existing?.note || "");
  }

  function selectEntry(entry: LiveRankEntry) {
    const person = people.find((item) => item.id === entry.personId);
    setPersonId(entry.personId);
    setPersonKeyword(entry.personName);
    if (person) {
      setPeople((items) => items.some((item) => item.id === person.id) ? items : [person, ...items]);
    }
    setGiftDiamonds(String(entry.giftDiamonds));
    setTicketUsed(String(entry.ticketUsed));
    setTicketDeposit(String(entry.ticketDeposit));
    setRankStatus(entry.rankStatus);
    setNote(entry.note);
  }

  function adjustActiveField(delta: number) {
    const update = (value: string) => String(Math.max(0, positiveInt(value) + delta));
    if (activeNumberField === "giftDiamonds") setGiftDiamonds(update);
    if (activeNumberField === "ticketUsed") setTicketUsed(update);
    if (activeNumberField === "ticketDeposit") setTicketDeposit(update);
  }

  async function saveEntry() {
    if (!session) {
      setNotice("请先创建或选择场次。");
      return;
    }
    if (!personId) {
      setNotice("请选择存票人。");
      return;
    }
    if (previewBalance < 0) {
      setNotice(`结算后余额会变为 ${previewBalance}，请减少取票或增加存票。`);
      return;
    }
    const result = await upsertLiveRankEntry({
      sessionId: session.id,
      personId,
      giftDiamonds: positiveInt(giftDiamonds),
      ticketUsed: positiveInt(ticketUsed),
      ticketDeposit: positiveInt(ticketDeposit),
      rankStatus,
      note: note.trim()
    });
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    setNotice("本场排行已保存，结算前不会影响长期余额。");
    await loadSession(session.id);
  }

  function startCountdown() {
    setCountdownLeft(countdownSeconds);
    setCountdownStatus("running");
  }

  function pauseCountdown() {
    setCountdownStatus("paused");
  }

  function resumeCountdown() {
    if (countdownLeft > 0) setCountdownStatus("running");
  }

  function resetCountdown() {
    setCountdownLeft(countdownSeconds);
    setCountdownStatus("idle");
  }

  async function runAction(action: "clearEntries" | "settle") {
    if (!session) return;
    const result = await liveRankAction(session.id, { action, countdownSeconds });
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    if (action === "clearEntries") {
      setEntries([]);
      setPersonId("");
      setPersonKeyword("");
      setGiftDiamonds("");
      setTicketUsed("");
      setTicketDeposit("");
      setRankStatus("normal");
      setNote("");
      setNotice(`已清空 ${result.data.clearedCount ?? 0} 条窗口记录。`);
      await loadSessions(session.id);
      return;
    }
    if (action === "settle") setNotice(`结算完成，生成 ${result.data.recordCount ?? 0} 条正式流水。`);
    else setNotice("窗口状态已更新。");
    await loadSessions(session.id);
  }

  async function confirmSettlement() {
    setShowSettlementReview(false);
    await runAction("settle");
  }

  async function confirmClearEntries() {
    setShowClearConfirm(false);
    await runAction("clearEntries");
  }

  return (
    <div className="live-rank-layout">
      <section className="panel live-rank-hero compact">
        <div>
          <h3>{session?.title || "结算窗口"}</h3>
          <p className="muted">在当前时间窗口记录礼物钻、取票和存票，确认结算后写入正式存取记录。</p>
        </div>
        <span className="live-rank-hero-status">{session ? statusLabel[session.status] : "未开始"}</span>
      </section>

      <section className="panel live-rank-command">
        <div className="live-rank-command-main">
          <div className="panel-header compact"><h3>当前窗口</h3><span>选择历史窗口或新建窗口</span></div>
          <div className="live-rank-setup-row">
            <label>窗口<select value={activeSessionId} onChange={(event) => { setActiveSessionId(event.target.value); void loadSession(event.target.value); }}><option value="">选择历史窗口</option>{sessions.map((item) => <option key={item.id} value={item.id}>{item.title} · {statusLabel[item.status]}</option>)}</select></label>
            <button className="secondary-button" disabled={!canWrite(account)} type="button" onClick={createSession}>新建窗口</button>
          </div>
        </div>
        <div className="live-rank-command-actions">
          <div className="panel-header compact"><h3>窗口操作</h3><span>清空草稿或审核结算</span></div>
          <div className="live-rank-control-grid">
            <button className="secondary-button danger-lite-button" disabled={!canEditSession} type="button" onClick={() => setShowClearConfirm(true)}>清空窗口记录</button>
            <button className="primary-button" disabled={!canEditSession} type="button" onClick={() => setShowSettlementReview(true)}>确认结算</button>
          </div>
        </div>
      </section>

      <div className="live-rank-workbench">
        <section className="panel live-rank-board">
          <div className="live-rank-board-top">
            <div>
              <h3>实时排行</h3>
              <p>按本场总票排序，截图展示时优先截取此区域。</p>
            </div>
            <div className="live-rank-board-meta">
              <span>{session ? statusLabel[session.status] : "未开始"}</span>
              <span>上榜 {normalEntries.length} 人</span>
              {!!pendingEntries.length && <span>待定 {pendingEntries.length} 人</span>}
              <span>总票 {entryTotal}</span>
              {session?.frozenAt && <span>冻结 {formatDateTime(session.frozenAt)}</span>}
            </div>
          </div>
          <div className="live-rank-countdown-bar">
            <div className={`countdown-card ${countdownStatus === "running" ? "active" : ""}`}>
              <span>{countdownStatus === "running" ? "窗口倒计时" : countdownStatus === "paused" ? "倒计时已暂停" : "倒计时"}</span>
              <strong>{formatRemaining(countdownDisplay)}</strong>
            </div>
            <label>秒数<input value={countdownSeconds} onChange={(event) => setCountdownSeconds(Math.max(10, Number(event.target.value || 180)))} inputMode="numeric" /></label>
            <div className="live-rank-control-grid inline">
              <button className="secondary-button" disabled={!canControlCountdown || countdownStatus === "running"} type="button" onClick={startCountdown}>开始</button>
              <button className="secondary-button" disabled={!canControlCountdown || countdownStatus !== "running"} type="button" onClick={pauseCountdown}>暂停</button>
              <button className="secondary-button" disabled={!canControlCountdown || countdownStatus !== "paused"} type="button" onClick={resumeCountdown}>继续</button>
              <button className="secondary-button" disabled={!canControlCountdown} type="button" onClick={resetCountdown}>重置</button>
            </div>
          </div>
          <div className="live-rank-board-list">
            <div className="live-rank-board-head"><span>排名 / 存票人 / 总票</span><span>明细</span><span>余额</span><span>备注</span></div>
            {normalEntries.map((entry, index) => (
              <button className={`live-rank-board-row ${entry.personId === personId ? "selected" : ""}`} key={entry.id} onClick={() => selectEntry(entry)} type="button">
                <strong><span className="rank-number">{index + 1}</span><span>{entry.personName} {entry.score}</span></strong>
                <span>礼物 {entry.giftDiamonds} · 取票 {entry.ticketUsed} · 存票 {entry.ticketDeposit}</span>
                <span>{entry.currentBalance === entry.projectedBalance ? entry.projectedBalance : `${entry.currentBalance} -> ${entry.projectedBalance}`}</span>
                <span>{entry.note || "无备注"}</span>
              </button>
            ))}
            {!normalEntries.length && <div className="live-rank-board-empty">暂无正常排行记录，右侧保存后会显示在这里。</div>}
          </div>
          <div className="live-rank-pending-list">
            <div className="live-rank-pending-title"><strong>待定区</strong><span>{pendingEntries.length}</span></div>
            {pendingEntries.map((entry) => (
              <button className={`live-rank-pending-row ${entry.personId === personId ? "selected" : ""}`} key={entry.id} onClick={() => selectEntry(entry)} type="button">
                <strong>{entry.personName}</strong>
                <span>{rankStatusLabel[entry.rankStatus]} · 总票 {entry.score}</span>
                <span>{entry.note || "无备注"}</span>
              </button>
            ))}
            {!pendingEntries.length && <span className="muted">没有待定或有事不来的存票人。</span>}
          </div>
        </section>

        <aside className="live-rank-side">
          <section className="panel live-rank-editor">
            <div className="panel-header compact"><h3>录入排行</h3><span>草稿</span></div>
            <PersonSearchSelect
              people={people}
              selectedId={personId}
              value={personKeyword}
              emptyText="没有匹配的正常存票人。"
              onInputChange={(value) => { setPersonKeyword(value); setPersonId(""); }}
              onSelect={selectPerson}
            />
            <div className="live-rank-form-grid">
              <label>礼物钻<input className={activeNumberField === "giftDiamonds" ? "active-number-input" : ""} value={giftDiamonds} onFocus={() => setActiveNumberField("giftDiamonds")} onChange={(event) => setGiftDiamonds(event.target.value)} inputMode="numeric" placeholder="0" /></label>
              <label>取票<input className={activeNumberField === "ticketUsed" ? "active-number-input" : ""} value={ticketUsed} onFocus={() => setActiveNumberField("ticketUsed")} onChange={(event) => setTicketUsed(event.target.value)} inputMode="numeric" placeholder="0" /></label>
              <label>存票<input className={activeNumberField === "ticketDeposit" ? "active-number-input" : ""} value={ticketDeposit} onFocus={() => setActiveNumberField("ticketDeposit")} onChange={(event) => setTicketDeposit(event.target.value)} inputMode="numeric" placeholder="0" /></label>
            </div>
            <div className="quick-adjust-row">
              <span>作用于：<strong>{activeFieldLabel[activeNumberField]}</strong></span>
              <button className="secondary-button" type="button" onClick={() => adjustActiveField(-100)}>-100</button>
              <button className="secondary-button" type="button" onClick={() => adjustActiveField(100)}>+100</button>
            </div>
            <label>状态<select value={rankStatus} onChange={(event) => setRankStatus(event.target.value as LiveRankEntryStatus)}><option value="normal">正常排行</option><option value="pending">待定</option><option value="away">有事不来</option></select></label>
            <div className={`balance-preview ${previewBalance < 0 ? "danger" : selectedPerson ? "ok" : ""}`}>
              {selectedPerson ? `本场总票 ${previewScore}，当前余额 ${selectedPerson.balance}，结算后 ${previewBalance}。` : "请选择存票人。"}
            </div>
            <label>备注<textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} placeholder="可选" /></label>
            <button className="primary-button" disabled={!canEditSession} type="button" onClick={saveEntry}>保存到排行</button>
            {notice && <p className="notice-text">{notice}</p>}
          </section>
        </aside>
      </div>
      {showSettlementReview && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-card settlement-review-modal" role="dialog" aria-modal="true" aria-label="确认结算">
            <div className="panel-header compact">
              <h3>确认写入正式记录</h3>
              <span>{settlementReviewRows.length} 条存取流水</span>
            </div>
            <p className="muted">请核对当前窗口会写入正式存票记录的取票和存票流水。礼物钻只参与本窗口排行，不会写入存票记录。</p>
            <div className="settlement-review-table">
              <div className="settlement-review-head"><span>存票人</span><span>类型</span><span>数量</span><span>余额变化</span><span>状态</span></div>
              {settlementReviewRows.map((row) => (
                <div className={`settlement-review-row ${row.type === "存票" ? "deposit" : "withdraw"}`} key={row.id}>
                  <strong>{row.personName}</strong>
                  <span>{row.type}</span>
                  <span>{row.amount}</span>
                  <span>{row.before} -&gt; {row.after}</span>
                  <span>{row.status}</span>
                </div>
              ))}
              {!settlementReviewRows.length && <div className="settlement-review-empty">当前窗口没有取票或存票流水，确认后不会新增正式存票记录。</div>}
            </div>
            <div className="modal-actions button-row">
              <button className="secondary-button" type="button" onClick={() => setShowSettlementReview(false)}>返回修改</button>
              <button className="primary-button" type="button" onClick={confirmSettlement}>确认写入正式记录</button>
            </div>
          </section>
        </div>
      )}
      {showClearConfirm && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-card" role="dialog" aria-modal="true" aria-label="清空窗口记录">
            <h3>清空当前窗口记录？</h3>
            <p className="muted">这会删除当前窗口里的排行草稿和待定记录，不会影响已经写入的正式存票记录。</p>
            <div className="modal-actions button-row">
              <button className="secondary-button" type="button" onClick={() => setShowClearConfirm(false)}>取消</button>
              <button className="secondary-button danger-lite-button" type="button" onClick={confirmClearEntries}>确认清空</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
