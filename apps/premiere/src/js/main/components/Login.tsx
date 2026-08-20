/**
 * Sign-in screen. The server addresses are asked for once, on first run, and
 * then get out of the way behind the gear — they rarely change, and they are
 * not what someone opening the panel every morning came here to do.
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useApp } from "../state";
import { inPremiere } from "../../lib/freeframe/host";
import {
  signInWithBrowser,
  type BrowserLoginHandle,
} from "../../lib/freeframe/browserLogin";
import { IconExternal, IconSettings } from "./Icons";

export const Login = () => {
  const { settings, updateSettings, login, adoptSession, authError } = useApp();
  const [serverUrl, setServerUrl] = useState(settings.serverUrl);
  const [webUrl, setWebUrl] = useState(settings.webUrl);
  const [editingServer, setEditingServer] = useState(!settings.serverUrl);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const handleRef = useRef<BrowserLoginHandle | null>(null);

  // Abandon the loopback listener if the panel closes mid-sign-in.
  useEffect(() => () => handleRef.current?.cancel(), []);

  const saveServer = () => {
    const api = serverUrl.trim().replace(/\/+$/, "");
    if (!api) {
      setError("Enter your FreeFrame server address.");
      return;
    }
    updateSettings({ serverUrl: api, webUrl: webUrl.trim().replace(/\/+$/, "") });
    setError("");
    setEditingServer(false);
  };

  const onBrowserLogin = async () => {
    setError("");
    if (!inPremiere()) {
      setError("Browser sign-in only works inside Premiere.");
      return;
    }

    setWaiting(true);
    const handle = signInWithBrowser(settings.webUrl || settings.serverUrl);
    handleRef.current = handle;
    try {
      await adoptSession(await handle.result);
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      setError(
        reason === "cancelled"
          ? ""
          : `Browser sign-in did not finish: ${reason}. You can sign in with your password instead.`
      );
    } finally {
      handleRef.current = null;
      setWaiting(false);
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email, password);
    } catch (e) {
      // Surfaced through authError.
    } finally {
      setBusy(false);
    }
  };

  if (editingServer) {
    return (
      <div className="login">
        <h1>FreeFrame</h1>
        <p className="muted">Where does your FreeFrame instance live?</p>

        <label>
          Server
          <input
            type="text"
            placeholder="https://api.example.com"
            value={serverUrl}
            autoFocus
            onChange={(e) => setServerUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveServer()}
          />
        </label>

        <label>
          Web app
          <input
            type="text"
            placeholder="Same as the server"
            value={webUrl}
            onChange={(e) => setWebUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveServer()}
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button type="button" className="primary" onClick={saveServer}>
          Continue
        </button>
        {!!settings.serverUrl && (
          <button
            type="button"
            className="text-btn login-toggle"
            onClick={() => {
              setServerUrl(settings.serverUrl);
              setWebUrl(settings.webUrl);
              setError("");
              setEditingServer(false);
            }}
          >
            Cancel
          </button>
        )}
      </div>
    );
  }

  return (
    <form className="login" onSubmit={onSubmit}>
      <h1>FreeFrame</h1>

      <div className="login-server">
        <span title={settings.serverUrl}>{settings.serverUrl.replace(/^https?:\/\//, "")}</span>
        <button
          type="button"
          className="icon-btn"
          title="Change server"
          onClick={() => setEditingServer(true)}
        >
          <IconSettings width={14} height={14} />
        </button>
      </div>

      {waiting ? (
        <>
          <button type="button" className="primary with-icon" disabled>
            <span className="btn-spinner" />
            Waiting for the browser…
          </button>
          <p className="muted small">
            A tab opened in your browser. Sign in there if asked — this panel
            connects itself.
          </p>
          <button type="button" onClick={() => handleRef.current?.cancel()}>
            Cancel
          </button>
        </>
      ) : (
        <button type="button" className="primary with-icon" onClick={onBrowserLogin}>
          <IconExternal width={14} height={14} />
          Sign in with browser
        </button>
      )}

      <button
        type="button"
        className="text-btn login-toggle"
        onClick={() => setShowPassword((value) => !value)}
      >
        {showPassword ? "Hide password sign-in" : "Sign in with a password instead"}
      </button>

      {showPassword && (
        <>
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
          <button type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </>
      )}

      {(error || authError) && <p className="error">{error || authError}</p>}
    </form>
  );
};
