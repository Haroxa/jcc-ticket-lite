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
          <h1>JCC 公开存票榜</h1>
          <p>仅展示可公开的正余额存票人。</p>
        </div>
        <div className="public-summary">
          <span>展示人数</span>
          <strong>{items.length}</strong>
        </div>
      </header>
      <section className="panel public-board">
        <div className="panel-header"><h3>存票余额</h3><span>按当前有效余额排序</span></div>
        <div className="public-rank-list">
          {items.map((person) => (
            <article className="public-rank-item" key={person.id}>
              <span className="public-rank-no">{person.rank}</span>
              <div className="public-rank-person">
                <strong>{person.name}</strong>
                <span>当前可公开余额</span>
              </div>
              <b>{person.balance}</b>
            </article>
          ))}
          {!items.length && <p className="public-note">暂无可公开展示的存票余额。</p>}
        </div>
        <p className="public-note">公开榜只展示正常状态且余额大于 0 的存票人。</p>
      </section>
    </main>
  );
}
