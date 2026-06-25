import { useState } from "react";
import { login, type Account } from "../api";

type LoginPageProps = {
  onLogin: (account: Account) => void;
  onOpenPublicBoard: () => void;
};

export function LoginPage({ onLogin, onOpenPublicBoard }: LoginPageProps) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("需要先通过 /api/setup/admin 初始化管理员账号。");
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
        <label>用户名<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" /></label>
        <label>密码<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" /></label>
        <button className="primary-button" disabled={isSubmitting} type="submit">{isSubmitting ? "登录中..." : "登录"}</button>
        <button className="secondary-button" type="button" onClick={onOpenPublicBoard}>打开公开存票榜</button>
        <p className="muted">{notice}</p>
      </form>
    </section>
  );
}
