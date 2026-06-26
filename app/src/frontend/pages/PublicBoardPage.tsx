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
          <p>仅展示正常状态且余额大于 0 的公开存票人。</p>
        </div>
        <div className="public-summary">
          <span>展示人数</span>
          <strong>{items.length}</strong>
        </div>
      </header>
      <section className="public-board">
        <div className="public-board-head">
          <div>
            <h2>存票余额排行</h2>
            <p>按当前有效余额从高到低展示。</p>
          </div>
          <span>实时读取</span>
        </div>
        <div className="public-rank-list">
          {items.map((person) => (
            <article className="public-rank-item" key={person.id}>
              <span className="public-rank-no">{person.rank}</span>
              <div className="public-rank-person">
                <strong>{person.name}</strong>
                <span>公开余额</span>
              </div>
              <b>{person.balance}</b>
            </article>
          ))}
          {!items.length && <p className="public-note">暂无可公开展示的存票余额。</p>}
        </div>
        <p className="public-note">停用、拉黑、余额为 0 的存票人不会展示在公开榜。</p>
      </section>
    </main>
  );
}
