import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import AuthService from "../services/auth.service";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (event) => {
    event.preventDefault();
    setMessage("");

    try {
      await AuthService.login(username, password);
      navigate("/home");
      window.location.reload();
    } catch (error) {
      const responseMessage =
        (error.response && error.response.data && error.response.data.message) ||
        error.message ||
        error.toString();
      setMessage(responseMessage);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl bg-white p-8 shadow-xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-slate-900">系统登录</h2>
          <p className="mt-2 text-sm text-slate-500">进入电子产品交易监管平台</p>
        </div>

        {message ? <div className="rounded bg-rose-100 p-3 text-sm text-rose-700">{message}</div> : null}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label htmlFor="login-username" className="block text-sm font-medium text-slate-700">
              用户名
            </label>
            <input
              id="login-username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring focus:ring-indigo-200"
              required
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block text-sm font-medium text-slate-700">
              密码
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring focus:ring-indigo-200"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-indigo-600 px-4 py-2 font-bold text-white hover:bg-indigo-700 focus:outline-none"
          >
            登录
          </button>
        </form>

        <div className="text-center text-sm text-slate-600">
          还没有账号？
          <a href="/register" className="ml-1 font-medium text-indigo-600 hover:underline">
            立即注册
          </a>
        </div>
      </div>
    </div>
  );
}
