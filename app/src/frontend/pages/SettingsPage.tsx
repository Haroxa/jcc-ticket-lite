export function SettingsPage() {
  return (
    <div className="two-column">
      <section className="panel stacked">
        <h3>版本介绍</h3>
        <span>项目版本：v0.1.0 正式项目骨架</span>
        <span>目标平台：Cloudflare Workers + D1</span>
        <span>数据策略：流水永久保存，作废不删除</span>
      </section>
      <section className="panel stacked">
        <h3>下一步</h3>
        <span>接入 D1 初始迁移</span>
        <span>实现真实登录和权限</span>
        <span>实现存票人与流水 API</span>
      </section>
    </div>
  );
}
