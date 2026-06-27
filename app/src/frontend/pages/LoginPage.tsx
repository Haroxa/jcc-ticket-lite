import { useState } from "react";
import { login, type Account } from "../api";

type LoginPageProps = {
  onLogin: (account: Account) => void;
};

export function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("请输入账号和密码登录。");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice("");
    const result = await login(username, password);
    setIsSubmitting(false);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    onLogin(result.data.account);
  }

  return (
    <section className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <div>
          <h1>JCC 存票管理</h1>
          <p>登录后可在多设备共享查看和维护存票数据。</p>
        </div>
        <label>用户名<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" placeholder="请输入用户名" /></label>
        <label>密码<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" placeholder="请输入密码" /></label>
        <button className="primary-button" disabled={isSubmitting} type="submit">{isSubmitting ? "登录中..." : "登录"}</button>
        <button className="ghost-button login-public-link" type="button" onClick={() => window.open("/public-board", "_blank", "noopener,noreferrer")}>查看公开存票榜</button>
        <p className="muted">{notice}</p>
      </form>
    </section>
  );
}
