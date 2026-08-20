import { useState, type FormEvent } from "react";
import { useApp } from "../state";

export const Login = () => {
  const { settings, updateSettings, login, authError } = useApp();
  const [serverUrl, setServerUrl] = useState(settings.serverUrl);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    // Persist the URL first — the API client reads it from settings.
    updateSettings({ serverUrl: serverUrl.replace(/\/+$/, "") });
    try {
      await login(email, password);
    } catch (e) {
      // Surfaced through authError.
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="login" onSubmit={onSubmit}>
      <h1>FreeFrame</h1>
      <p className="muted">Sign in to review inside Premiere Pro.</p>

      <label>
        Server
        <input
          type="text"
          placeholder="https://review.example.com"
          value={serverUrl}
          onChange={(e) => setServerUrl(e.target.value)}
          required
        />
      </label>
      <label>
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>
      <label>
        Password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>

      {authError && <p className="error">{authError}</p>}

      <button type="submit" className="primary" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
};
