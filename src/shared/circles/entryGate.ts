import {
  isInMiniapp,
  getWalletAddress,
  isGnosisGroupMember,
  chargeEntryFee,
} from "./miniapp";

type GateStatus =
  | "checking"
  | "no-wallet"
  | "not-member"
  | "ready"
  | "paying"
  | "paid"
  | "error";

export function withEntryGate(
  factory: () => { destroy?(): void },
): () => { destroy?(): void } {
  if (!isInMiniapp()) return factory;

  return () => {
    const app = document.getElementById("app")!;
    let destroyed = false;
    let inner: { destroy?(): void } | null = null;

    function render(status: GateStatus, message?: string) {
      if (destroyed) return;
      app.innerHTML = `
        <div class="entry-gate">
          <div class="entry-gate-card">
            <h2>The Card Room</h2>
            <div class="entry-gate-status">${statusContent(status, message)}</div>
          </div>
        </div>
      `;
      if (status === "ready") {
        app.querySelector("#pay-btn")?.addEventListener("click", onPay);
      }
    }

    function statusContent(status: GateStatus, message?: string): string {
      switch (status) {
        case "checking":
          return `<p>Checking eligibility...</p>`;
        case "no-wallet":
          return `<p>Please connect your wallet in the Circles app to play.</p>`;
        case "not-member":
          return `<p>You must be a member of the Gnosis Group to play.</p>
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
        const member = await isGnosisGroupMember(address);
        if (!member) {
          render("not-member");
          return;
        }
        render("ready");
      } catch {
        render("error", "Could not verify group membership.");
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
  };
}
