import { useEffect, useState } from "react";
import { getPublicBoard } from "../api";

export function PublicBoardPage() {
  const [items, setItems] = useState<Array<{ rank: number; id: string; name: string; balance: number }>>([]);

  useEffect(() => {
    getPublicBoard().then((result) => {
      if (result.ok) setItems(result.data.items);
    });
  }, []);

  return (
    <main className="public-shell">
      <header className="public-hero">
        <div>
          <h1>公开存票榜</h1>
          <p>仅展示当前存票大于 0 且允许公开的存票人，不显示流水、备注和操作信息。</p>
        </div>
        <div className="public-summary">
          <span>上榜人数</span>
          <strong>{items.length}</strong>
        </div>
      </header>
      <section className="public-board">
        <div className="public-board-head">
          <div>
            <h2>余额排行榜</h2>
            <p>按当前有效余额排序</p>
          </div>
        </div>
        <div className="public-rank-list">
          {items.map((person) => (
            <article className="public-rank-item" key={person.id}>
              <span className="public-rank-no">{person.rank}</span>
              <div className="public-rank-person">
                <strong>{person.name}</strong>
              </div>
              <b>{person.balance}</b>
            </article>
          ))}
          {!items.length && <p className="public-note">暂无可公开展示的存票余额。</p>}
        </div>
        <p className="public-note">说明：公开榜单只用于查看可公开余额，实际数据以后台有效流水为准。</p>
      </section>
    </main>
  );
}
