import { useState } from "react";
import { useApp } from "../state";
import { version } from "../../../shared/shared";

export const SettingsView = () => {
  const { settings, updateSettings, user, logout, host } = useApp();
  const [serverUrl, setServerUrl] = useState(settings.serverUrl);
  const [webUrl, setWebUrl] = useState(settings.webUrl);

  return (
    <div className="settings-view">
      <h2>Settings</h2>

      <label>
        API server
        <input
          type="text"
          value={serverUrl}
          onChange={(e) => setServerUrl(e.target.value)}
          onBlur={() => updateSettings({ serverUrl: serverUrl.replace(/\/+$/, "") })}
          placeholder="http://localhost:8000"
        />
      </label>

      <label>
        Web app
        <input
          type="text"
          value={webUrl}
          onChange={(e) => setWebUrl(e.target.value)}
          onBlur={() => updateSettings({ webUrl: webUrl.replace(/\/+$/, "") })}
          placeholder="Same as the API server"
        />
      </label>
      <p className="muted small">Used by the “open in browser” links.</p>

      <dl className="facts">
        <dt>Signed in</dt>
        <dd>{user ? `${user.name} · ${user.email}` : "—"}</dd>
        <dt>Project</dt>
        <dd>{host.projectName ?? "—"}</dd>
        <dt>Sequence</dt>
        <dd>
          {host.ok
            ? `${host.sequenceName} · ${host.fps?.toFixed(3)} fps · ${host.markerCount} marker(s)`
            : "None open"}
        </dd>
        <dt>Panel</dt>
        <dd>v{version}</dd>
      </dl>

      <button onClick={logout}>Sign out</button>
    </div>
  );
};
