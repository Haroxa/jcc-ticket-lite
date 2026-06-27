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
import { EmptyState } from "../components/EmptyState/EmptyState";
import { PersonSearchSelect } from "../components/PersonSearchSelect/PersonSearchSelect";
import { formatDateTime } from "../utils/time";
import { canWrite } from "../utils/permissions";

const statusLabel: Record<LiveRankSession["status"], string> = {
  live: "进行中",
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
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} 场次排行`;
}

function positiveInt(value: string) {
  const next = Number(value || 0);
  return Number.isInteger(next) && next >= 0 ? next : 0;
}

function remainingSeconds(session: LiveRankSession | null) {
  if (!session?.countdownEndsAt || session.status !== "countdown") return 0;
  return Math.max(0, Math.floor((new Date(session.countdownEndsAt).getTime() - Date.now()) / 1000));
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
  const [notice, setNotice] = useState("");
  const [tick, setTick] = useState(0);
  const [activeNumberField, setActiveNumberField] = useState<ActiveNumberField>("giftDiamonds");

  const selectedPerson = people.find((person) => person.id === personId);
  const sortedEntries = useMemo(() => [...entries].sort((a, b) => b.score - a.score || a.updatedAt.localeCompare(b.updatedAt) || a.personName.localeCompare(b.personName)), [entries]);
  const normalEntries = useMemo(() => sortedEntries.filter((entry) => entry.rankStatus === "normal"), [sortedEntries]);
  const pendingEntries = useMemo(() => sortedEntries.filter((entry) => entry.rankStatus !== "normal"), [sortedEntries]);
  const entryTotal = sortedEntries.reduce((sum, entry) => sum + entry.score, 0);
  const remaining = remainingSeconds(session);
  const canEditSession = !!session && session.status !== "settled" && session.status !== "cancelled" && canWrite(account);
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
    setNotice("");
  }

  useEffect(() => {
    void loadSessions();
    listPeople({ status: "normal", pageSize: 50 }).then((result) => {
      if (result.ok) setPeople(result.data.items);
    });
  }, []);

  useEffect(() => {
    if (!session || session.status !== "countdown") return;
    const timer = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [session?.id, session?.status]);

  useEffect(() => {
    if (tick < 0 || !session || session.status !== "countdown") return;
    if (remainingSeconds(session) === 0) void runAction("freeze");
  }, [tick]);

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

  async function runAction(action: "startCountdown" | "freeze" | "end" | "settle" | "cancel") {
    if (!session) return;
    const result = await liveRankAction(session.id, { action, countdownSeconds });
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    if (action === "settle") setNotice(`结算完成，生成 ${result.data.recordCount ?? 0} 条正式流水。`);
    else setNotice("场次状态已更新。");
    await loadSessions(session.id);
  }

  return (
    <div className="live-rank-layout">
      <section className="panel live-rank-hero compact">
        <div>
          <h3>{session?.title || "场次排行"}</h3>
          <p className="muted">礼物钻 + 取票 - 存票 = 本场总票；确认结算前不影响长期余额。</p>
        </div>
        <span className="live-rank-hero-status">{session ? statusLabel[session.status] : "未开始"}</span>
      </section>

      <div className="live-rank-workbench">
        <section className="panel live-rank-board">
          <div className="live-rank-board-top">
            <div>
              <h3>实时排行</h3>
              <p>按本场总票排序，截图展示时优先截取此区域。</p>
            </div>
          </div>
          <div className="live-rank-countdown-bar">
            <div className={`countdown-card ${session?.status === "countdown" ? "active" : ""}`}>
              <span>{session?.status === "countdown" ? "定榜倒计时" : "倒计时"}</span>
              <strong>{formatRemaining(remaining)}</strong>
            </div>
            <label>秒数<input value={countdownSeconds} onChange={(event) => setCountdownSeconds(Math.max(10, Number(event.target.value || 180)))} inputMode="numeric" /></label>
            <div className="live-rank-control-grid inline">
              <button className="secondary-button" disabled={!canEditSession} type="button" onClick={() => runAction("startCountdown")}>开始倒计时</button>
              <button className="secondary-button" disabled={!canEditSession} type="button" onClick={() => runAction("freeze")}>立即冻结</button>
              <button className="secondary-button" disabled={!canEditSession} type="button" onClick={() => runAction("end")}>结束场次</button>
              <button className="primary-button" disabled={!canEditSession} type="button" onClick={() => runAction("settle")}>确认结算</button>
            </div>
          </div>
          <div className="live-rank-board-meta">
            <span>{session ? statusLabel[session.status] : "未开始"}</span>
            <span>上榜 {normalEntries.length} 人</span>
            {!!pendingEntries.length && <span>待定 {pendingEntries.length} 人</span>}
            <span>总票 {entryTotal}</span>
            {session?.frozenAt && <span>冻结 {formatDateTime(session.frozenAt)}</span>}
          </div>
          <div className="responsive-table live-rank-table compact">
            <div className="table-row header"><span>排名</span><span>存票人</span><span>本场总票</span><span>礼物钻</span><span>取票</span><span>存票</span><span>结算后</span><span>备注</span></div>
            {normalEntries.map((entry, index) => (
              <div className={`table-row ${entry.personId === personId ? "selected" : ""}`} key={entry.id} onClick={() => selectEntry(entry)}>
                <span className="row-no" data-label="排名">{index + 1}</span>
                <strong data-label="存票人">{entry.personName}</strong>
                <span data-label="本场总票">{entry.score}</span>
                <span data-label="礼物钻">{entry.giftDiamonds}</span>
                <span data-label="取票">{entry.ticketUsed}</span>
                <span data-label="存票">{entry.ticketDeposit}</span>
                <span data-label="结算后">{entry.projectedBalance}</span>
                <span data-label="备注">{entry.note || "无备注"}</span>
              </div>
            ))}
            {!!pendingEntries.length && <div className="table-row section-row"><span>待定区</span><span>不参与正常排名</span></div>}
            {pendingEntries.map((entry) => (
              <div className={`table-row pending ${entry.personId === personId ? "selected" : ""}`} key={entry.id} onClick={() => selectEntry(entry)}>
                <span className="row-no" data-label="状态">{rankStatusLabel[entry.rankStatus]}</span>
                <strong data-label="存票人">{entry.personName}</strong>
                <span data-label="本场总票">{entry.score}</span>
                <span data-label="礼物钻">{entry.giftDiamonds}</span>
                <span data-label="取票">{entry.ticketUsed}</span>
                <span data-label="存票">{entry.ticketDeposit}</span>
                <span data-label="结算后">{entry.projectedBalance}</span>
                <span data-label="备注">{entry.note || "无备注"}</span>
              </div>
            ))}
            {!sortedEntries.length && <EmptyState title="暂无排行记录" description="右侧开始场次后，选择存票人并录入礼物钻、取票或存票。" />}
          </div>
        </section>

        <aside className="live-rank-side">
          <section className="panel live-rank-setup">
            <div className="panel-header compact"><h3>场次设置</h3><span>选择或开始一场</span></div>
            <label>当前场次<select value={activeSessionId} onChange={(event) => { setActiveSessionId(event.target.value); void loadSession(event.target.value); }}><option value="">选择历史场次</option>{sessions.map((item) => <option key={item.id} value={item.id}>{item.title} · {statusLabel[item.status]}</option>)}</select></label>
            <label>场次名称<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
            <label>备注<input value={sessionNote} onChange={(event) => setSessionNote(event.target.value)} placeholder="可选" /></label>
            <button className="primary-button" disabled={!canWrite(account)} type="button" onClick={createSession}>开始新场次</button>
          </section>

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
              <label>礼物钻<input value={giftDiamonds} onFocus={() => setActiveNumberField("giftDiamonds")} onChange={(event) => setGiftDiamonds(event.target.value)} inputMode="numeric" placeholder="0" /></label>
              <label>取票<input value={ticketUsed} onFocus={() => setActiveNumberField("ticketUsed")} onChange={(event) => setTicketUsed(event.target.value)} inputMode="numeric" placeholder="0" /></label>
              <label>存票<input value={ticketDeposit} onFocus={() => setActiveNumberField("ticketDeposit")} onChange={(event) => setTicketDeposit(event.target.value)} inputMode="numeric" placeholder="0" /></label>
            </div>
            <div className="quick-adjust-row">
              <span>当前调整：{activeFieldLabel[activeNumberField]}</span>
              <button className="secondary-button" type="button" onClick={() => adjustActiveField(-100)}>-100</button>
              <button className="secondary-button" type="button" onClick={() => adjustActiveField(100)}>+100</button>
            </div>
            <div>
              <span className="field-label">状态</span>
              <div className="segmented compact">
                <button className={`segment ${rankStatus === "normal" ? "active" : ""}`} type="button" onClick={() => setRankStatus("normal")}>正常</button>
                <button className={`segment ${rankStatus === "pending" ? "active" : ""}`} type="button" onClick={() => setRankStatus("pending")}>待定</button>
                <button className={`segment ${rankStatus === "away" ? "active" : ""}`} type="button" onClick={() => setRankStatus("away")}>有事</button>
              </div>
            </div>
            <div className={`balance-preview ${previewBalance < 0 ? "danger" : selectedPerson ? "ok" : ""}`}>
              {selectedPerson ? `本场总票 ${previewScore}，当前余额 ${selectedPerson.balance}，结算后 ${previewBalance}。` : "请选择存票人。"}
            </div>
            <label>备注<textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} placeholder="可选" /></label>
            <button className="primary-button" disabled={!canEditSession} type="button" onClick={saveEntry}>保存到排行</button>
            {notice && <p className="notice-text">{notice}</p>}
          </section>
        </aside>
      </div>
    </div>
  );
}
