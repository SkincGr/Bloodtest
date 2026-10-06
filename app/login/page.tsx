"use client";
import { useState } from "react";

export default function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (r.ok) location.href = "/";
    else setError((await r.json()).error ?? "Σφάλμα");
  }

  return (
    <form className="card login" onSubmit={submit}>
      <h1>Σύνδεση</h1>
      <input type="password" placeholder="Κωδικός" value={password} autoFocus
        onChange={(e) => setPassword(e.target.value)} />
      <button type="submit">Είσοδος</button>
      {error && <p className="bad">{error}</p>}
    </form>
  );
}
