export function SettingsPage() {
  return (
    <div className="two-column">
      <section className="panel stacked">
        <h3>版本介绍</h3>
        <span>项目版本：v0.1.0 Cloudflare 共享版</span>
        <span>目标平台：Cloudflare Workers + D1</span>
        <span>数据策略：流水永久保存，作废不删除</span>
        <span>适配设备：电脑、平板、手机</span>
      </section>
      <section className="panel stacked">
        <h3>权限说明</h3>
        <span>管理员：账号、存票人、流水和日志管理</span>
        <span>操作员：录入和维护流水，可查看自己的操作日志</span>
        <span>只读成员：查看数据，不能修改</span>
      </section>
    </div>
  );
}
