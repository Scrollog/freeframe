/**
 * Signing in through the browser.
 *
 * The panel loads from `file://` and has no redirect URI, so it does what
 * native apps do (RFC 8252): listen on loopback, send the browser to the web
 * app, and let the page hand the session back. Nothing to type.
 */
import { crypto, http } from "../cep/node";
import { openLinkInBrowser } from "../utils/bolt";

export interface BrowserLoginResult {
  accessToken: string;
  refreshToken: string;
}

export interface BrowserLoginHandle {
  /** Resolves with the session, or rejects on timeout/cancel. */
  result: Promise<BrowserLoginResult>;
  /** Stops listening and closes the port. */
  cancel: () => void;
}

const TIMEOUT_MS = 120000;

const randomState = (): string => {
  try {
    return crypto.randomBytes(24).toString("hex");
  } catch (e) {
    // Node's crypto is missing outside CEP (the browser dev server).
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
};

/**
 * Opens the browser and waits for the web app to post the session back.
 * `webUrl` is the web app root; its origin is the only one allowed to talk to
 * the listener.
 */
export const signInWithBrowser = (webUrl: string): BrowserLoginHandle => {
  const origin = webUrl.replace(/\/+$/, "");
  const state = randomState();
  let settle: (value: BrowserLoginResult) => void;
  let fail: (reason: Error) => void;
  let timer: ReturnType<typeof setTimeout>;

  const result = new Promise<BrowserLoginResult>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });

  const server = http.createServer((request, response) => {
    // The page is served over https and calls us cross-origin; loopback is a
    // trusted origin in Chromium, so this only needs CORS, not a proxy.
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }
    if (request.method !== "POST") {
      response.writeHead(405);
      response.end();
      return;
    }

    let body = "";
    request.on("data", (chunk: Buffer) => {
      body += chunk.toString();
      // Nothing legitimate is large; don't buffer whatever arrives.
      if (body.length > 8192) request.destroy();
    });
    request.on("end", () => {
      try {
        const payload = JSON.parse(body);
        // Binds this response to the request we started: without it any local
        // page could post a session into the panel.
        if (payload.state !== state) throw new Error("state mismatch");
        if (!payload.access_token || !payload.refresh_token) {
          throw new Error("missing tokens");
        }
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end('{"ok":true}');
        cleanup();
        settle({
          accessToken: payload.access_token,
          refreshToken: payload.refresh_token,
        });
      } catch (e) {
        response.writeHead(400);
        response.end();
      }
    });
  });

  const cleanup = () => {
    clearTimeout(timer);
    try {
      server.close();
    } catch (e) {
      // Already closed.
    }
  };

  const cancel = () => {
    cleanup();
    fail(new Error("cancelled"));
  };

  server.on("error", (error: Error) => {
    cleanup();
    fail(error);
  });

  // Port 0 asks the OS for a free one; binding to loopback only keeps this off
  // the network, so Windows raises no firewall prompt.
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    if (!port) {
      cleanup();
      fail(new Error("Could not open a local port"));
      return;
    }
    const redirect = `http://127.0.0.1:${port}/cb`;
    openLinkInBrowser(
      `${origin}/link?redirect=${encodeURIComponent(redirect)}&state=${encodeURIComponent(state)}`
    );
    timer = setTimeout(() => {
      cleanup();
      fail(new Error("Timed out waiting for the browser"));
    }, TIMEOUT_MS);
  });

  return { result, cancel };
};
