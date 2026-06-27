import {
  isConnected,
  getWalletAddress,
  canPayEntryFee,
  chargeEntryFee,
  connect,
} from "./miniapp";

type GateStatus =
  | "checking"
  | "no-wallet"
  | "no-path"
  | "ready"
  | "paying"
  | "paid"
  | "error";

/**
 * Gate a game behind the 1 CRC entry fee for anyone with a Circles session —
 * the embedded host app or a standalone "Login with Circles" user. Visitors
 * who never log in play for free. The connection is re-checked on every
 * game-open, so logging in (or out) takes effect the next time a game starts.
 */
export function withEntryGate(
  factory: () => { destroy?(): void },
): () => { destroy?(): void } {
  return () => (isConnected() ? runGate(factory) : factory());
}

function runGate(factory: () => { destroy?(): void }): { destroy?(): void } {
  const app = document.getElementById("app")!;
  let destroyed = false;
  let inner: { destroy?(): void } | null = null;

  function render(status: GateStatus, message?: string) {
    if (destroyed) return;
    const showBack = status !== "paying" && status !== "paid";
    app.innerHTML = `
      <div class="entry-gate">
        <div class="entry-gate-card">
          <h2>The Card Room</h2>
          <div class="entry-gate-status">${statusContent(status, message)}</div>
          ${showBack ? `<a href="#" class="back-link entry-gate-back">← Games</a>` : ""}
        </div>
      </div>
    `;
    if (status === "ready") {
      app.querySelector("#pay-btn")?.addEventListener("click", onPay);
    } else if (status === "error") {
      app.querySelector("#pay-btn")?.addEventListener("click", () => check());
    } else if (status === "no-wallet") {
      app.querySelector("#login-btn")?.addEventListener("click", onLogin);
    }
  }

  function statusContent(status: GateStatus, message?: string): string {
    switch (status) {
      case "checking":
        return `<p>Checking eligibility...</p>`;
      case "no-wallet":
        return `<p>Log in with Circles to play.</p>
                <button id="login-btn" class="entry-gate-btn">Login with Circles</button>`;
      case "no-path":
        return `<p>Cannot find a payment path to the treasury. You may need to join the Gnosis Group first.</p>
                <p class="entry-gate-hint">Join at <a href="https://circles.gnosis.io" target="_blank">circles.gnosis.io</a></p>`;
      case "ready":
        return `<p>Entry fee: 1 CRC</p>
                <button id="pay-btn" class="entry-gate-btn">Pay & Play</button>`;
      case "paying":
        return `<p>Confirming payment...</p>`;
      case "paid":
        return `<p>Payment confirmed! Starting game...</p>`;
      case "error":
        return `<p class="entry-gate-error">${message ?? "Something went wrong."}</p>
                <button id="pay-btn" class="entry-gate-btn">Try Again</button>`;
    }
  }

  async function onLogin() {
    const address = await connect();
    if (address) check();
  }

  async function onPay() {
    render("paying");
    try {
      await chargeEntryFee();
      render("paid");
      setTimeout(() => {
        if (!destroyed) inner = factory();
      }, 500);
    } catch (e: any) {
      render("error", e.message ?? "Transfer failed or was rejected.");
    }
  }

  async function check() {
    render("checking");
    const address = getWalletAddress();
    if (!address) {
      render("no-wallet");
      return;
    }
    try {
      const canPay = await canPayEntryFee(address);
      if (!canPay) {
        render("no-path");
        return;
      }
      render("ready");
    } catch {
      render("error", "Could not verify payment path.");
    }
  }

  check();

  return {
    destroy() {
      destroyed = true;
      inner?.destroy?.();
      inner = null;
    },
  };
}
