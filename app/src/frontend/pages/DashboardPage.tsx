import { useEffect, useState } from "react";
import type { PageKey } from "../App";
import { getDashboard, type TicketRecord } from "../api";
import { formatLocalMinute } from "../utils/time";

type DashboardPageProps = {
  onNavigate: (page: PageKey) => void;
};

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const [data, setData] = useState<{
    totalBalance: number;
    peopleCount: number;
    todayDeposit: number;
    todayWithdraw: number;
    rank: Array<{ id: string; name: string; balance: number }>;
    recent: TicketRecord[];
  } | null>(null);

  useEffect(() => {
    getDashboard().then((result) => {
      if (result.ok) setData(result.data);
    });
  }, []);

  return (
    <>
      <div className="metrics-grid">
        <article className="metric-card"><span>当前总存票</span><strong>{data?.totalBalance ?? 0}</strong></article>
        <article className="metric-card"><span>存票人数</span><strong>{data?.peopleCount ?? 0}</strong></article>
        <article className="metric-card"><span>今日存入</span><strong>{data?.todayDeposit ?? 0}</strong></article>
        <article className="metric-card"><span>今日取用</span><strong>{data?.todayWithdraw ?? 0}</strong></article>
      </div>
      <div className="two-column">
        <section className="panel">
          <div className="panel-header">
            <div><h3>余额排行</h3><span>只展示正常且余额大于 0</span></div>
            <button className="secondary-button compact-button" type="button" onClick={() => window.open("/public-board", "_blank", "noopener,noreferrer")}>公开榜</button>
          </div>
          <div className="rank-list">
            {data?.rank.map((person, index) => (
              <div className="rank-item" key={person.id}>
                <span>{index + 1}. {person.name}</span>
                <strong>{person.balance}</strong>
              </div>
            ))}
            {!data?.rank.length && <p className="muted">暂无可展示余额。</p>}
          </div>
        </section>
        <section className="panel">
          <div className="panel-header"><h3>最近记录</h3><span>最新流水</span></div>
          <button className="primary-button" type="button" onClick={() => onNavigate("entry")}>新增记录</button>
          <div className="record-list">
            {data?.recent.map((record) => (
              <article className={`record-card ${record.type} ${record.status === "voided" ? "voided" : ""}`} key={record.id}>
                <strong>{record.personName} {record.type === "deposit" ? "存入" : "取用"} {record.amount}</strong>
                <span>{formatLocalMinute(record.recordedAt)} · {record.status === "normal" ? "正常" : "作废"}</span>
              </article>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
