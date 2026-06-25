const people = [
  { id: "p1", name: "张三", balance: 0, status: "正常", note: "高频存票人" },
  { id: "p2", name: "李四", balance: 0, status: "正常", note: "常规记录" },
  { id: "p3", name: "王五", balance: 0, status: "正常", note: "" },
  { id: "p4", name: "小满", balance: 0, status: "正常", note: "手机端测试" },
  { id: "p5", name: "阿青", balance: 0, status: "停用", note: "历史保留" },
  { id: "p6", name: "南风", balance: 0, status: "正常", note: "" },
  { id: "p7", name: "月白", balance: 0, status: "正常", note: "平板端测试" },
  { id: "p8", name: "小鹿", balance: 0, status: "正常", note: "新用户" },
  { id: "p9", name: "星河", balance: 0, status: "正常", note: "待核对" },
  { id: "p10", name: "北辰", balance: 0, status: "拉黑", note: "仅保留历史查询" }
];

let records = [
  { id: "r1", time: "2026-06-24T20:35", personId: "p1", type: "deposit", amount: 300, status: "normal", note: "直播存入" },
  { id: "r2", time: "2026-06-24T21:10", personId: "p2", type: "withdraw", amount: 120, status: "normal", note: "取用上车" },
  { id: "r3", time: "2026-06-23T19:48", personId: "p1", type: "deposit", amount: 520, status: "normal", note: "礼物折算" },
  { id: "r4", time: "2026-06-22T18:12", personId: "p3", type: "deposit", amount: 200, status: "voided", note: "误录入" },
  { id: "r5", time: "2026-06-22T22:05", personId: "p4", type: "deposit", amount: 130, status: "normal", note: "补录" },
  { id: "r6", time: "2026-06-21T20:20", personId: "p7", type: "deposit", amount: 366, status: "normal", note: "常用价格" },
  { id: "r7", time: "2026-06-21T21:02", personId: "p8", type: "deposit", amount: 199, status: "normal", note: "首次存入" },
  { id: "r8", time: "2026-06-20T19:30", personId: "p1", type: "withdraw", amount: 100, status: "normal", note: "取用" },
  { id: "r9", time: "2026-06-20T20:11", personId: "p9", type: "deposit", amount: 520, status: "normal", note: "待核对来源" },
  { id: "r10", time: "2026-06-19T18:55", personId: "p2", type: "deposit", amount: 999, status: "normal", note: "导入样例" },
  { id: "r11", time: "2026-06-19T19:40", personId: "p3", type: "withdraw", amount: 80, status: "normal", note: "取用" },
  { id: "r12", time: "2026-06-18T22:18", personId: "p6", type: "deposit", amount: 300, status: "normal", note: "补录" }
];

let currentType = "deposit";
let calcSteps = [];
let pendingConfirm = null;
let pendingPersonStatus = null;
let selectedEntryPersonId = "p1";
let selectedHistoryPersonId = "p1";
let currentRole = "admin";
const prices = [99, 199, 299, 366, 520, 999, 1314, 3000];
const pagination = {
  people: { page: 1, pageSize: 5 },
  records: { page: 1, pageSize: 5 },
  history: { page: 1, pageSize: 5 },
  audit: { page: 1, pageSize: 5 }
};

const roleMeta = {
  admin: { label: "管理员", user: "阿晚", canWrite: true, canExport: true, canAudit: true, canAdmin: true },
  operator: { label: "操作员", user: "小林", canWrite: true, canExport: false, canAudit: true, canAdmin: false },
  viewer: { label: "只读成员", user: "访客", canWrite: false, canExport: false, canAudit: false, canAdmin: false }
};

const auditLogs = [
  { time: "2026-06-24T21:12", user: "阿晚", role: "管理员", type: "作废记录", target: "r4 / 王五", summary: "作废误录入的存入 200，原因：误录入" },
  { time: "2026-06-24T20:35", user: "阿晚", role: "管理员", type: "新增记录", target: "r1 / 张三", summary: "新增存入 300，备注：直播存入" },
  { time: "2026-06-24T19:58", user: "小林", role: "操作员", type: "新增记录", target: "r12 / 南风", summary: "新增存入 300，备注：补录" },
  { time: "2026-06-23T22:10", user: "阿晚", role: "管理员", type: "导出数据", target: "全部流水", summary: "导出完整备份 CSV" },
  { time: "2026-06-23T18:42", user: "小林", role: "操作员", type: "登录", target: "系统", summary: "从平板端登录" },
  { time: "2026-06-22T18:20", user: "阿晚", role: "管理员", type: "恢复记录", target: "r4 / 王五", summary: "恢复后重新参与余额计算" }
];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function personName(id) {
  return people.find((person) => person.id === id)?.name || "未知";
}

function personById(id) {
  return people.find((person) => person.id === id) || people[0];
}

function signedDelta(record) {
  if (record.status === "voided") return 0;
  return record.type === "deposit" ? record.amount : -record.amount;
}

function formatNumber(value) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function typeLabel(type) {
  return type === "deposit" ? "存入" : "取用";
}

function statusLabel(status) {
  return status === "voided" ? "已作废" : "正常";
}

function recordDate(record) {
  return (record.time || record.date || "").slice(0, 10);
}

function formatRecordTime(record) {
  return (record.time || record.date || "").replace("T", " ");
}

function currentMinuteText() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function addAuditLog(type, target, summary) {
  const role = roleMeta[currentRole];
  auditLogs.unshift({
    time: currentMinuteText(),
    user: role.user,
    role: role.label,
    type,
    target,
    summary
  });
  pagination.audit.page = 1;
}

function recordTimeValue(record) {
  return record.time || record.date || "";
}

function dateInRange(record, start, end) {
  const date = recordDate(record);
  return (!start || date >= start) && (!end || date <= end);
}

function recalcBalances() {
  for (const person of people) {
    person.balance = records
      .filter((record) => record.personId === person.id)
      .reduce((sum, record) => sum + signedDelta(record), 0);
  }
}

function renderSelects() {
  $("#entryDate").value = "2026-06-24T20:00";
  selectEntryPerson(selectedEntryPersonId, false);
  selectHistoryPerson(selectedHistoryPersonId, false);
}

function recordCard(record, index = null) {
  const delta = signedDelta(record);
  const tone = record.status === "voided" ? "voided" : record.type;
  const numberText = index === null ? "" : `<span>序号 ${index}</span>`;
  return `
    <article class="record-card ${tone}">
      <strong>${personName(record.personId)} <span class="amount">${typeLabel(record.type)} ${record.type === "deposit" ? "+" : "-"}${record.amount}</span></strong>
      ${numberText}
      <span>${formatRecordTime(record)} · ${statusLabel(record.status)} · 余额变化 ${delta >= 0 ? "+" : ""}${delta}</span>
      <span>${record.note || "无备注"}</span>
    </article>
  `;
}

function getPageItems(items, key) {
  const state = pagination[key];
  const totalPages = Math.max(1, Math.ceil(items.length / state.pageSize));
  state.page = Math.min(Math.max(1, state.page), totalPages);
  const start = (state.page - 1) * state.pageSize;
  return {
    items: items.slice(start, start + state.pageSize),
    start,
    totalPages,
    total: items.length
  };
}

function renderPager(key, targetId, totalPages, total) {
  const state = pagination[key];
  const disabledPrev = state.page <= 1 ? "disabled" : "";
  const disabledNext = state.page >= totalPages ? "disabled" : "";
  $(`#${targetId}`).innerHTML = `
    <button data-page-first="${key}" ${disabledPrev} type="button">首页</button>
    <button data-page-prev="${key}" ${disabledPrev} type="button">上一页</button>
    <label class="pager-jump">第
      <input data-page-input="${key}" min="1" max="${totalPages}" type="number" value="${state.page}">
      / ${totalPages} 页
    </label>
    <label class="pager-size">每页
      <select data-page-size="${key}">
        ${[5, 10, 20, 50].map((size) => `<option ${state.pageSize === size ? "selected" : ""} value="${size}">${size}</option>`).join("")}
      </select>
    </label>
    <button data-page-next="${key}" ${disabledNext} type="button">下一页</button>
    <button data-page-last="${key}" ${disabledNext} type="button">末页</button>
    <span>共 ${total} 条</span>
  `;
}

function renderDashboard() {
  const totalBalance = people.reduce((sum, person) => sum + person.balance, 0);
  $("#metricBalance").textContent = formatNumber(totalBalance);
  $("#rankList").innerHTML = people
    .slice()
    .filter((person) => person.status === "正常" && person.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .map((person, index) => `
      <button class="rank-item" data-history-person="${person.id}" type="button">
        <span>${index + 1}. ${person.name}</span>
        <strong>${formatNumber(person.balance)}</strong>
      </button>
    `)
    .join("") || `<p class="muted">暂无可展示的有效余额。</p>`;
  $("#recentRecords").innerHTML = records.slice(0, 5).map((record) => `
    <button class="recent-record-button" data-focus-record="${record.id}" type="button">
      ${recordCard(record)}
    </button>
  `).join("");
}

function renderEntrySide() {
  const person = personById(selectedEntryPersonId);
  $("#selectedPersonName").textContent = person.name;
  $("#selectedBalance").textContent = formatNumber(person.balance);
  $("#personRecent").innerHTML = records
    .filter((record) => record.personId === person.id)
    .slice(0, 4)
    .map((record) => recordCard(record))
    .join("") || `<p class="muted">暂无记录</p>`;
  renderBalancePreview();
}

function renderEntryPersonResults() {
  const keyword = ($("#entryPersonSearch").value || "").trim();
  const matches = people
    .filter((person) => person.status === "正常")
    .filter((person) => !keyword || person.name.includes(keyword) || person.note.includes(keyword))
    .slice(0, 6);
  $("#entryPersonResults").innerHTML = matches.map((person) => `
    <button class="${person.id === selectedEntryPersonId ? "active" : ""}" data-select-entry-person="${person.id}" type="button">
      <strong>${person.name}</strong>
      <span>余额 ${formatNumber(person.balance)}</span>
    </button>
  `).join("") || `<p class="muted">没有匹配的存票人。</p>`;
}

function selectEntryPerson(personId, shouldFocusAmount = true) {
  selectedEntryPersonId = personId;
  const person = personById(personId);
  $("#entryPerson").value = person.id;
  $("#entryPersonSearch").value = person.name;
  renderEntryPersonResults();
  renderEntrySide();
  if (shouldFocusAmount) $("#entryAmount").focus();
}

function renderHistoryPersonResults() {
  const keyword = ($("#historyPersonSearch").value || "").trim();
  const matches = people
    .filter((person) => !keyword || person.name.includes(keyword) || person.note.includes(keyword))
    .slice(0, 8);
  $("#historyPersonResults").innerHTML = matches.map((person) => `
    <button class="${person.id === selectedHistoryPersonId ? "active" : ""}" data-select-history-person="${person.id}" type="button">
      <strong>${person.name}</strong>
      <span>余额 ${formatNumber(person.balance)} · ${person.status}${person.status === "拉黑" ? " · 仅保留历史查询" : ""}</span>
    </button>
  `).join("") || `<p class="muted">没有匹配的存票人。</p>`;
}

function selectHistoryPerson(personId, shouldRender = true) {
  selectedHistoryPersonId = personId;
  const person = personById(personId);
  $("#historyPerson").value = person.id;
  $("#historyPersonSearch").value = person.name;
  pagination.history.page = 1;
  renderHistoryPersonResults();
  if (shouldRender) renderHistory();
}

function renderBalancePreview() {
  const person = personById(selectedEntryPersonId);
  const amount = Number($("#entryAmount")?.value || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    $("#balancePreview").textContent = `当前余额：${formatNumber(person.balance)}。`;
    $("#balancePreview").className = "balance-preview";
    return;
  }
  const delta = currentType === "deposit" ? amount : -amount;
  const next = person.balance + delta;
  $("#balancePreview").textContent = `当前余额 ${formatNumber(person.balance)}，${currentType === "deposit" ? "存入后" : "取用后"}余额 ${formatNumber(next)}。`;
  $("#balancePreview").className = `balance-preview ${next < 0 ? "danger" : "ok"}`;
}

function renderPeople() {
  const keyword = ($("#personSearch")?.value || "").trim();
  const status = $("#personStatus")?.value || "";
  const adminDisabled = canUse("admin") ? "" : "disabled";
  const adminDisabledClass = canUse("admin") ? "" : " is-disabled-by-role";
  const filtered = people.filter(
    (person) => {
      const matchedKeyword = !keyword || person.name.includes(keyword) || person.note.includes(keyword);
      const matchedStatus = status ? person.status === status : true;
      return matchedKeyword && matchedStatus;
    }
  );
  const page = getPageItems(filtered, "people");
  $("#peopleSummary").textContent = `当前显示：${status || "全部状态"}${keyword ? ` / 关键词“${keyword}”` : ""}，共 ${filtered.length} 人。停用和拉黑不会进入快速录入、内部排行和公开榜单。`;
  $("#peopleTable").innerHTML = `
    <div class="table-row header"><span>序号</span><span>存票人</span><span>当前余额</span><span>状态</span><span>备注</span><span>操作</span></div>
    ${page.items.map((person, index) => `
      <div class="table-row person-status-${person.status}">
        <span class="row-no">${page.start + index + 1}</span>
        <strong class="row-main">${person.name}</strong>
        <span>余额 ${formatNumber(person.balance)}</span>
        <span class="status-pill">${person.status}</span>
        <span class="hide-tablet">${person.note || "无备注"}</span>
        <div class="row-actions">
          <button class="secondary-button row-action" data-history-person="${person.id}" type="button">历史</button>
          <button class="secondary-button row-action${adminDisabledClass}" data-person-status="${person.id}" data-requires="admin" ${adminDisabled} type="button">改状态</button>
        </div>
      </div>
    `).join("") || `<p class="muted">没有匹配的存票人。</p>`}
  `;
  renderPager("people", "peoplePager", page.totalPages, page.total);
}

function getFilteredRecords() {
  const keyword = ($("#recordSearch")?.value || "").trim();
  const type = $("#recordType")?.value || "";
  const status = $("#recordStatus")?.value || "";
  const startDate = $("#recordStartDate")?.value || "";
  const endDate = $("#recordEndDate")?.value || "";
  return records.filter((record) => {
    const person = personName(record.personId);
    return (!keyword || person.includes(keyword) || record.note.includes(keyword))
      && (!type || record.type === type)
      && (!status || record.status === status)
      && dateInRange(record, startDate, endDate);
  });
}

function renderRecords() {
  const filtered = getFilteredRecords();
  const page = getPageItems(filtered, "records");
  const writeDisabled = canUse("write") ? "" : "disabled";
  const writeDisabledClass = canUse("write") ? "" : " is-disabled-by-role";
  const keyword = ($("#recordSearch")?.value || "").trim();
  const type = $("#recordType").value ? typeLabel($("#recordType").value) : "全部类型";
  const status = $("#recordStatus").value ? statusLabel($("#recordStatus").value) : "全部状态";
  $("#recordsSummary").textContent = `当前显示：${type} / ${status}${keyword ? ` / 关键词“${keyword}”` : ""}，共 ${filtered.length} 条。`;
  $("#recordsTable").innerHTML = `
    <div class="table-row header"><span>序号</span><span>时间</span><span>存票人</span><span>类型</span><span>票数</span><span>状态</span><span>备注</span><span>操作</span></div>
    ${page.items.map((record, index) => `
      <div class="table-row ${record.status === "voided" ? "voided" : record.type}">
        <span class="row-no">${page.start + index + 1}</span>
        <strong class="row-main">${formatRecordTime(record)}</strong>
        <span>${personName(record.personId)}</span>
        <span>${typeLabel(record.type)}</span>
        <span class="${record.type === "deposit" ? "delta-positive" : "delta-negative"}">${record.type === "deposit" ? "+" : "-"}${record.amount}</span>
        <span>${statusLabel(record.status)}</span>
        <span class="hide-tablet">${record.note || "无备注"}</span>
        <button class="secondary-button row-action${writeDisabledClass}" data-confirm-record="${record.id}" data-requires="write" ${writeDisabled} type="button">${record.status === "voided" ? "恢复" : "作废"}</button>
      </div>
    `).join("") || `<p class="muted">没有匹配的记录。</p>`}
  `;
  renderPager("records", "recordsPager", page.totalPages, page.total);
}

function getFilteredHistory() {
  const type = $("#historyType").value;
  const status = $("#historyStatus").value;
  const startDate = $("#historyStartDate").value;
  const endDate = $("#historyEndDate").value;
  return records.filter((record) =>
    record.personId === selectedHistoryPersonId
    && (!type || record.type === type)
    && (!status || record.status === status)
    && dateInRange(record, startDate, endDate)
  );
}

function getPersonLedger(personId) {
  const chronological = records
    .filter((record) => record.personId === personId)
    .slice()
    .sort((a, b) => recordTimeValue(a).localeCompare(recordTimeValue(b)) || a.id.localeCompare(b.id));
  let balance = 0;
  const balanceById = new Map();
  for (const record of chronological) {
    balance += signedDelta(record);
    balanceById.set(record.id, balance);
  }
  return balanceById;
}

function historyLedgerCard(record, index, balanceAfter) {
  const isDeposit = record.type === "deposit";
  const amountText = `${isDeposit ? "+" : "-"}${record.amount}`;
  return `
    <article class="history-ledger-card ${record.status === "voided" ? "voided" : record.type}">
      <div class="history-no">#${index}</div>
      <div class="history-main">
        <div class="history-title">
          <strong>${formatRecordTime(record)}</strong>
          <span class="${isDeposit ? "delta-positive" : "delta-negative"}">${typeLabel(record.type)} ${amountText}</span>
        </div>
        <div class="history-meta">
          <span>${statusLabel(record.status)}</span>
          <span>操作后余额：${formatNumber(balanceAfter)}</span>
        </div>
        <p>${record.note || "无备注"}</p>
      </div>
    </article>
  `;
}

function renderHistoryTable(items, start, ledger) {
  if (!items.length) return `<p class="muted">该条件下暂无记录。</p>`;
  return `
    <div class="history-table-row history-table-head">
      <span>序号</span>
      <span>时间</span>
      <span>类型</span>
      <span>票数</span>
      <span>操作后余额</span>
      <span>状态</span>
      <span>备注</span>
    </div>
    ${items.map((record, index) => {
      const isDeposit = record.type === "deposit";
      const amountText = `${isDeposit ? "+" : "-"}${record.amount}`;
      return `
        <div class="history-table-row ${record.status === "voided" ? "voided" : record.type}">
          <span class="history-seq" data-label="序号">${start + index + 1}</span>
          <strong data-label="时间">${formatRecordTime(record)}</strong>
          <span data-label="类型">${typeLabel(record.type)}</span>
          <span data-label="票数" class="${isDeposit ? "delta-positive" : "delta-negative"}">${amountText}</span>
          <span data-label="操作后余额">${formatNumber(ledger.get(record.id) ?? 0)}</span>
          <span data-label="状态">${statusLabel(record.status)}</span>
          <span data-label="备注">${record.note || "无备注"}</span>
        </div>
      `;
    }).join("")}
  `;
}

function renderHistory() {
  const person = personById(selectedHistoryPersonId);
  const personRecords = records.filter((record) => record.personId === person.id);
  const filtered = getFilteredHistory();
  const normalPersonRecords = personRecords.filter((record) => record.status === "normal");
  const filteredNormal = filtered.filter((record) => record.status === "normal");
  const depositTotal = filteredNormal.filter((record) => record.type === "deposit").reduce((sum, record) => sum + record.amount, 0);
  const withdrawTotal = filteredNormal.filter((record) => record.type === "withdraw").reduce((sum, record) => sum + record.amount, 0);
  const voidedCount = personRecords.filter((record) => record.status === "voided").length;
  const ledger = getPersonLedger(person.id);
  const orderedFiltered = filtered.slice().sort((a, b) => recordTimeValue(b).localeCompare(recordTimeValue(a)) || b.id.localeCompare(a.id));
  const page = getPageItems(filtered, "history");
  $("#historyBalance").textContent = formatNumber(person.balance);
  document.querySelector("#history .metrics-grid .metric-card:nth-child(2) strong").textContent = formatNumber(depositTotal);
  document.querySelector("#history .metrics-grid .metric-card:nth-child(3) strong").textContent = formatNumber(withdrawTotal);
  $("#historyRecordState").textContent = `${normalPersonRecords.length} / ${voidedCount}`;
  $("#historyMetricNote").textContent = `汇总卡显示当前筛选范围内的存入/取用合计；当前余额仍为该存票人的全量有效余额。有效/作废记录：${normalPersonRecords.length} / ${voidedCount}。`;
  $("#historySummary").textContent = `当前显示：${person.name} / ${$("#historyType").value ? typeLabel($("#historyType").value) : "全部类型"} / ${$("#historyStatus").value ? statusLabel($("#historyStatus").value) : "全部状态"}，共 ${filtered.length} 条。`;
  const orderedPage = getPageItems(orderedFiltered, "history");
  $("#historyList").innerHTML = renderHistoryTable(orderedPage.items, orderedPage.start, ledger);
  renderPager("history", "historyPager", orderedPage.totalPages, orderedPage.total);
}

function getFilteredAuditLogs() {
  const role = roleMeta[currentRole];
  const user = ($("#auditUser")?.value || "").trim();
  const type = $("#auditType")?.value || "";
  const startDate = $("#auditStartDate")?.value || "";
  const endDate = $("#auditEndDate")?.value || "";
  return auditLogs.filter((log) =>
    (!user || log.user.includes(user))
    && (!type || log.type === type)
    && (!startDate || log.time.slice(0, 10) >= startDate)
    && (!endDate || log.time.slice(0, 10) <= endDate)
    && (role.canAdmin || log.user === role.user)
  );
}

function renderAuditLogs() {
  const role = roleMeta[currentRole];
  const filtered = role.canAudit ? getFilteredAuditLogs() : [];
  const page = getPageItems(filtered, "audit");
  $("#auditSummary").textContent = role.canAudit
    ? `当前显示：${$("#auditType").value || "全部类型"}，共 ${filtered.length} 条。`
    : "当前角色无操作日志查看权限。";
  $("#auditTable").innerHTML = `
    <div class="table-row header"><span>序号</span><span>时间</span><span>操作人</span><span>类型</span><span>对象</span><span>摘要</span></div>
    ${page.items.map((log, index) => `
      <div class="table-row audit-row">
        <span class="row-no">${page.start + index + 1}</span>
        <strong class="row-main">${formatRecordTime(log)}</strong>
        <span>${log.user} · ${log.role}</span>
        <span>${log.type}</span>
        <span>${log.target}</span>
        <span>${log.summary}</span>
      </div>
    `).join("") || `<p class="muted">没有匹配的操作日志。</p>`}
  `;
  renderPager("audit", "auditPager", page.totalPages, page.total);
}

function canUse(requirement) {
  const role = roleMeta[currentRole];
  if (!requirement) return true;
  if (requirement === "admin") return role.canAdmin;
  if (requirement === "write") return role.canWrite;
  if (requirement === "export") return role.canExport;
  if (requirement === "audit") return role.canAudit;
  return true;
}

function applyPermissions() {
  const role = roleMeta[currentRole];
  $("#currentRoleBadge").textContent = role.label;
  $("#currentUserName").textContent = role.user;
  $("#sideRoleStatus").textContent = `${role.label} · D1 永久保存流水`;
  document.body.dataset.role = currentRole;

  $$("[data-requires]").forEach((element) => {
    const allowed = canUse(element.dataset.requires);
    element.disabled = !allowed;
    element.classList.toggle("is-disabled-by-role", !allowed);
  });

  if (!role.canWrite && $("#entry").classList.contains("active")) switchPage("dashboard");
  if (!role.canAdmin && $("#importExport").classList.contains("active")) switchPage("settings");
  if (!role.canAudit && $("#auditLogs").classList.contains("active")) switchPage("settings");
}

function renderCalculator() {
  const calcTotal = getCalcTotal();
  let runningTotal = 0;
  $("#rawTotal").textContent = formatNumber(calcTotal);
  $("#floorTotal").textContent = formatNumber(Math.floor(calcTotal / 100) * 100);
  $("#ceilTotal").textContent = formatNumber(Math.ceil(calcTotal / 100) * 100);
  $("#calcChain").innerHTML = calcSteps.length ? calcSteps.map((step, index) => {
    runningTotal += step.subtotal;
    const sign = step.direction > 0 ? "+" : "-";
    return `
      <div class="calc-chain-row ${step.direction > 0 ? "add" : "sub"}">
        <span class="calc-step-no">${index + 1}</span>
        <select class="calc-sign-select" aria-label="第 ${index + 1} 步加减方向" data-calc-step-direction="${index}">
          <option ${step.direction > 0 ? "selected" : ""} value="1">+</option>
          <option ${step.direction < 0 ? "selected" : ""} value="-1">-</option>
        </select>
        <label class="calc-mini-field"><span>价</span>
          <input aria-label="第 ${index + 1} 步价格" data-calc-step-price="${index}" inputmode="numeric" min="1" type="number" value="${step.price}">
        </label>
        <label class="calc-mini-field"><span>数</span>
          <input aria-label="第 ${index + 1} 步数量" data-calc-step-qty="${index}" inputmode="numeric" min="1" type="number" value="${step.qty}">
        </label>
        <strong class="calc-row-total">${sign}${formatNumber(Math.abs(step.subtotal))}</strong>
        <small class="calc-row-running">小计 ${formatNumber(runningTotal)}</small>
        <button class="calc-delete-button" aria-label="删除第 ${index + 1} 步" data-remove-calc-step="${index}" type="button">删除</button>
      </div>
    `;
  }).join("") : `<p class="muted">暂无计算步骤，点击左侧价格后会显示计算链。</p>`;
}

function getCalcTotal() {
  return calcSteps.reduce((sum, step) => sum + step.subtotal, 0);
}

function sanitizePositiveInteger(value, fallback = 1) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Math.max(1, Math.floor(number));
}

function recalcStep(step) {
  step.subtotal = step.price * step.qty * step.direction;
}

function addCalcStep(price, direction) {
  const qty = sanitizePositiveInteger($("#calcQty").value);
  if (!Number.isFinite(price) || price <= 0) return;
  calcSteps.push({
    price: sanitizePositiveInteger(price),
    qty,
    direction,
    subtotal: sanitizePositiveInteger(price) * qty * direction
  });
  renderCalculator();
}

function updateCalcStep(index, patch) {
  const step = calcSteps[index];
  if (!step) return;
  if ("price" in patch) step.price = sanitizePositiveInteger(patch.price, step.price);
  if ("qty" in patch) step.qty = sanitizePositiveInteger(patch.qty, step.qty);
  if ("direction" in patch) step.direction = Number(patch.direction) < 0 ? -1 : 1;
  recalcStep(step);
  renderCalculator();
}

function updateCalcQty(nextValue) {
  $("#calcQty").value = sanitizePositiveInteger(nextValue);
}

function applyCalculatorValue(mode) {
  const calcTotal = getCalcTotal();
  const valueMap = {
    raw: calcTotal,
    floor: Math.floor(calcTotal / 100) * 100,
    ceil: Math.ceil(calcTotal / 100) * 100
  };
  $("#entryAmount").value = Math.max(0, valueMap[mode] || 0);
  renderBalancePreview();
  $("#entryAmount").focus();
}

function toggleCalculator() {
  const calculator = $("#calculatorInline");
  const isCollapsed = calculator.classList.toggle("is-collapsed");
  $("#toggleCalculator").textContent = isCollapsed ? "展开计算工具" : "收起计算工具";
  if (!isCollapsed) calculator.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderAll() {
  recalcBalances();
  renderDashboard();
  renderEntryPersonResults();
  renderHistoryPersonResults();
  renderEntrySide();
  renderPeople();
  renderRecords();
  renderHistory();
  renderAuditLogs();
  renderCalculator();
  applyPermissions();
}

function switchPage(pageId) {
  $$(".page").forEach((page) => page.classList.toggle("active", page.id === pageId));
  $$(".nav-button").forEach((button) => button.classList.toggle("active", button.dataset.page === pageId));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showRecordsWithFilter({ type = "", status = "", keyword = "", startDate = "", endDate = "" } = {}) {
  $("#recordSearch").value = keyword;
  $("#recordType").value = type;
  $("#recordStatus").value = status;
  $("#recordStartDate").value = startDate;
  $("#recordEndDate").value = endDate;
  pagination.records.page = 1;
  renderRecords();
  switchPage("records");
}

function showApp() {
  $("#loginScreen").classList.add("is-hidden");
}

function showLogin() {
  $("#loginScreen").classList.remove("is-hidden");
}

function openConfirm(record) {
  pendingConfirm = record.id;
  const isVoided = record.status === "voided";
  $("#confirmTitle").textContent = isVoided ? "恢复记录" : "作废记录";
  $("#confirmMessage").textContent = `${personName(record.personId)} · ${typeLabel(record.type)} ${record.amount} · ${formatRecordTime(record)}`;
  $("#confirmReasonLabel").style.display = isVoided ? "none" : "grid";
  $("#confirmReason").value = "";
  $("#acceptConfirm").textContent = isVoided ? "确认恢复" : "确认作废";
  $("#confirmModal").hidden = false;
}

function closeConfirm() {
  pendingConfirm = null;
  $("#confirmModal").hidden = true;
}

function applyConfirm() {
  const record = records.find((item) => item.id === pendingConfirm);
  if (!record) return closeConfirm();
  if (record.status === "voided") {
    record.status = "normal";
    addAuditLog("恢复记录", `${record.id} / ${personName(record.personId)}`, `恢复${typeLabel(record.type)} ${record.amount}，重新参与余额计算`);
  } else {
    const reason = $("#confirmReason").value.trim();
    if (!reason) {
      $("#confirmReason").focus();
      return;
    }
    record.status = "voided";
    record.note = reason;
    addAuditLog("作废记录", `${record.id} / ${personName(record.personId)}`, `作废${typeLabel(record.type)} ${record.amount}，原因：${reason}`);
  }
  closeConfirm();
  renderAll();
}

function openPersonStatusModal(person) {
  pendingPersonStatus = person.id;
  $("#personStatusTitle").textContent = `修改 ${person.name} 的状态`;
  $("#personStatusMessage").textContent = `当前状态：${person.status}；当前余额：${formatNumber(person.balance)}。`;
  $("#personStatusNext").value = person.status;
  $("#personStatusReason").value = "";
  $("#personStatusModal").hidden = false;
}

function closePersonStatusModal() {
  pendingPersonStatus = null;
  $("#personStatusModal").hidden = true;
}

function applyPersonStatusChange() {
  const person = people.find((item) => item.id === pendingPersonStatus);
  const nextStatus = $("#personStatusNext").value;
  const reason = $("#personStatusReason").value.trim();
  if (!person) return closePersonStatusModal();
  if (nextStatus === person.status) {
    closePersonStatusModal();
    return;
  }
  if (!reason) {
    $("#personStatusReason").focus();
    return;
  }
  const oldStatus = person.status;
  person.status = nextStatus;
  if (reason) person.note = reason;
  if (selectedEntryPersonId === person.id && nextStatus !== "正常") {
    selectedEntryPersonId = people.find((item) => item.status === "正常")?.id || person.id;
  }
  addAuditLog("修改存票人状态", `${person.id} / ${person.name}`, `${oldStatus} -> ${nextStatus}，原因：${reason}`);
  closePersonStatusModal();
  renderAll();
}

function resetPeopleFilters() {
  $("#personSearch").value = "";
  $("#personStatus").value = "";
  pagination.people.page = 1;
  renderPeople();
}

function resetRecordFilters() {
  $("#recordSearch").value = "";
  $("#recordType").value = "";
  $("#recordStatus").value = "";
  $("#recordStartDate").value = "";
  $("#recordEndDate").value = "";
  pagination.records.page = 1;
  renderRecords();
}

function resetHistoryFilters() {
  $("#historyType").value = "";
  $("#historyStatus").value = "";
  $("#historyStartDate").value = "";
  $("#historyEndDate").value = "";
  pagination.history.page = 1;
  renderHistory();
}

function bindPaginationEvent(event) {
  const first = event.target.closest("[data-page-first]");
  const prev = event.target.closest("[data-page-prev]");
  const next = event.target.closest("[data-page-next]");
  const last = event.target.closest("[data-page-last]");
  const input = event.target.closest("[data-page-input]");
  const size = event.target.closest("[data-page-size]");
  const key = first?.dataset.pageFirst || prev?.dataset.pagePrev || next?.dataset.pageNext || last?.dataset.pageLast || input?.dataset.pageInput || size?.dataset.pageSize;
  if (!key) return false;
  if ((input || size) && event.type !== "change") return false;

  if (first) pagination[key].page = 1;
  if (prev) pagination[key].page = Math.max(1, pagination[key].page - 1);
  if (next) pagination[key].page += 1;
  if (last) pagination[key].page = 9999;
  if (input && event.type === "change") pagination[key].page = Math.max(1, Number(input.value || 1));
  if (size && event.type === "change") {
    pagination[key].pageSize = Number(size.value);
    pagination[key].page = 1;
  }

  if (key === "people") renderPeople();
  if (key === "records") renderRecords();
  if (key === "history") renderHistory();
  if (key === "audit") renderAuditLogs();
  return true;
}

function bindEvents() {
  document.addEventListener("click", (event) => {
    if (bindPaginationEvent(event)) return;

    const nav = event.target.closest("[data-page]");
    if (nav) switchPage(nav.dataset.page);

    const jump = event.target.closest("[data-page-jump]");
    if (jump) switchPage(jump.dataset.pageJump);

    const metric = event.target.closest("[data-dashboard-filter]");
    if (metric) {
      const filter = metric.dataset.dashboardFilter;
      const today = "2026-06-24";
      if (filter === "depositToday") showRecordsWithFilter({ type: "deposit", status: "normal", startDate: today, endDate: today });
      if (filter === "withdrawToday") showRecordsWithFilter({ type: "withdraw", status: "normal", startDate: today, endDate: today });
      if (filter === "all") showRecordsWithFilter({});
    }

    const focusRecord = event.target.closest("[data-focus-record]");
    if (focusRecord) {
      const record = records.find((item) => item.id === focusRecord.dataset.focusRecord);
      if (record) showRecordsWithFilter({ keyword: personName(record.personId), startDate: recordDate(record), endDate: recordDate(record) });
    }

    const scrollTarget = event.target.closest("[data-scroll-target]");
    if (scrollTarget) {
      const target = document.getElementById(scrollTarget.dataset.scrollTarget);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    const historyPerson = event.target.closest("[data-history-person]");
    if (historyPerson) {
      selectHistoryPerson(historyPerson.dataset.historyPerson);
      switchPage("history");
    }

    const segment = event.target.closest(".segment");
    if (segment) {
      currentType = segment.dataset.type;
      $$(".segment").forEach((button) => button.classList.toggle("active", button === segment));
      renderBalancePreview();
    }

    const selectEntryPersonButton = event.target.closest("[data-select-entry-person]");
    if (selectEntryPersonButton) {
      selectEntryPerson(selectEntryPersonButton.dataset.selectEntryPerson);
    }

    const selectHistoryPersonButton = event.target.closest("[data-select-history-person]");
    if (selectHistoryPersonButton) {
      selectHistoryPerson(selectHistoryPersonButton.dataset.selectHistoryPerson);
    }

    const confirmRecord = event.target.closest("[data-confirm-record]");
    if (confirmRecord) {
      if (!canUse("write")) return;
      const record = records.find((item) => item.id === confirmRecord.dataset.confirmRecord);
      if (record) openConfirm(record);
    }

    const personStatusButton = event.target.closest("[data-person-status]");
    if (personStatusButton) {
      if (!canUse("admin")) return;
      const person = personById(personStatusButton.dataset.personStatus);
      if (person) openPersonStatusModal(person);
    }

    const priceButton = event.target.closest("[data-price]");
    if (priceButton) {
      addCalcStep(Number(priceButton.dataset.price), Number(priceButton.dataset.direction));
    }

    const removeCalcStep = event.target.closest("[data-remove-calc-step]");
    if (removeCalcStep) {
      calcSteps.splice(Number(removeCalcStep.dataset.removeCalcStep), 1);
      renderCalculator();
    }

    const qtyStep = event.target.closest("[data-calc-qty-step]");
    if (qtyStep) {
      updateCalcQty(Number($("#calcQty").value || 1) + Number(qtyStep.dataset.calcQtyStep));
    }

    const qtyPreset = event.target.closest("[data-calc-qty-preset]");
    if (qtyPreset) {
      updateCalcQty(qtyPreset.dataset.calcQtyPreset);
    }
  });

  document.addEventListener("change", (event) => {
    if (bindPaginationEvent(event)) return;

    const stepPrice = event.target.closest("[data-calc-step-price]");
    if (stepPrice) updateCalcStep(Number(stepPrice.dataset.calcStepPrice), { price: stepPrice.value });

    const stepQty = event.target.closest("[data-calc-step-qty]");
    if (stepQty) updateCalcStep(Number(stepQty.dataset.calcStepQty), { qty: stepQty.value });

    const stepDirection = event.target.closest("[data-calc-step-direction]");
    if (stepDirection) updateCalcStep(Number(stepDirection.dataset.calcStepDirection), { direction: stepDirection.value });

    if (event.target.id === "calcQty") updateCalcQty(event.target.value);
  });

  $("#loginForm").addEventListener("submit", (event) => {
    event.preventDefault();
    showApp();
  });
  $("#roleSwitch").addEventListener("change", (event) => {
    currentRole = event.target.value;
    renderAll();
  });
  $("#logoutButton").addEventListener("click", showLogin);
  $("#moreLogout").addEventListener("click", showLogin);

  $("#entryPersonSearch").addEventListener("input", renderEntryPersonResults);
  $("#entryAmount").addEventListener("input", renderBalancePreview);
  $("#historyPersonSearch").addEventListener("input", renderHistoryPersonResults);

  $("#personSearch").addEventListener("input", () => {
    pagination.people.page = 1;
    renderPeople();
  });
  $("#personStatus").addEventListener("change", () => {
    pagination.people.page = 1;
    renderPeople();
  });
  $("#personQuery").addEventListener("click", renderPeople);
  $("#personReset").addEventListener("click", resetPeopleFilters);

  ["recordSearch", "recordType", "recordStatus", "recordStartDate", "recordEndDate"].forEach((id) => {
    $(`#${id}`).addEventListener(id === "recordSearch" ? "input" : "change", () => {
      pagination.records.page = 1;
      renderRecords();
    });
  });
  $("#recordQuery").addEventListener("click", renderRecords);
  $("#recordReset").addEventListener("click", resetRecordFilters);

  ["historyType", "historyStatus", "historyStartDate", "historyEndDate"].forEach((id) => {
    $(`#${id}`).addEventListener("change", () => {
      pagination.history.page = 1;
      renderHistory();
    });
  });
  $("#historyQuery").addEventListener("click", renderHistory);
  $("#historyReset").addEventListener("click", resetHistoryFilters);

  ["auditUser", "auditType", "auditStartDate", "auditEndDate"].forEach((id) => {
    $(`#${id}`).addEventListener(id === "auditUser" ? "input" : "change", () => {
      pagination.audit.page = 1;
      renderAuditLogs();
    });
  });
  $("#auditQuery").addEventListener("click", renderAuditLogs);
  $("#auditReset").addEventListener("click", () => {
    $("#auditUser").value = "";
    $("#auditType").value = "";
    $("#auditStartDate").value = "";
    $("#auditEndDate").value = "";
    pagination.audit.page = 1;
    renderAuditLogs();
  });

  $("#cancelConfirm").addEventListener("click", closeConfirm);
  $("#acceptConfirm").addEventListener("click", applyConfirm);
  $("#cancelPersonStatus").addEventListener("click", closePersonStatusModal);
  $("#acceptPersonStatus").addEventListener("click", applyPersonStatusChange);

  $("#entryForm").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!canUse("write")) return;
    const person = personById(selectedEntryPersonId);
    const amount = Number($("#entryAmount").value);
    const notice = $("#entryNotice");
    notice.style.color = "var(--red)";
    notice.textContent = "";
    if (!Number.isInteger(amount) || amount <= 0) {
      notice.textContent = "票数必须是大于 0 的整数。";
      return;
    }
    if (person.status !== "正常") {
      notice.textContent = "当前存票人不是正常状态，不能继续录入。";
      return;
    }
    if (currentType === "withdraw" && amount > person.balance) {
      notice.textContent = `当前余额 ${person.balance}，不能取用 ${amount}。`;
      return;
    }
    const recordId = `r${Date.now()}`;
    records.unshift({
      id: recordId,
      time: $("#entryDate").value,
      personId: person.id,
      type: currentType,
      amount,
      status: "normal",
      note: $("#entryNote").value.trim()
    });
    addAuditLog("新增记录", `${recordId} / ${person.name}`, `新增${typeLabel(currentType)} ${amount}${$("#entryNote").value.trim() ? `，备注：${$("#entryNote").value.trim()}` : ""}`);
    $("#entryAmount").value = "";
    $("#entryNote").value = "";
    notice.style.color = "var(--green)";
    notice.textContent = "记录已保存，原型已刷新余额。";
    renderAll();
    $("#entryAmount").focus();
  });

  $("#clearEntry").addEventListener("click", () => {
    $("#entryAmount").value = "";
    $("#entryNote").value = "";
    $("#entryNotice").textContent = "";
    renderBalancePreview();
  });
  $("#clearCalc").addEventListener("click", () => {
    calcSteps = [];
    renderCalculator();
  });
  $("#toggleCalculator").addEventListener("click", toggleCalculator);
  $("#addCustomPrice").addEventListener("click", () => addCalcStep(Number($("#customPrice").value), 1));
  $("#subCustomPrice").addEventListener("click", () => addCalcStep(Number($("#customPrice").value), -1));
  $("#applyRawCalc").addEventListener("click", () => applyCalculatorValue("raw"));
  $("#applyFloorCalc").addEventListener("click", () => applyCalculatorValue("floor"));
  $("#applyCeilCalc").addEventListener("click", () => applyCalculatorValue("ceil"));
}

function initCalculator() {
  $("#priceGrid").innerHTML = prices.map((price) => `
    <button class="price-button add" data-price="${price}" data-direction="1" type="button">+${price}</button>
    <button class="price-button sub" data-price="${price}" data-direction="-1" type="button">-${price}</button>
  `).join("");
}

renderSelects();
initCalculator();
bindEvents();
renderAll();
