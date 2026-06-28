import {
  isInMiniapp,
  getWalletAddress,
  connect,
  disconnect,
  onSessionChange,
  resolveProfiles,
  type ResolvedProfile,
} from "../circles/miniapp";

/**
 * Persistent "Login with Circles" chip, shown only on the open web. Embedded
 * in the Circles host app the identity is owned by the host, so the chip
 * stays hidden there.
 */

let chip: HTMLElement | null = null;
let menuOpen = false;
let profile: ResolvedProfile | null = null;

export function mountLoginChip(): void {
  if (isInMiniapp() || chip) return;

  chip = document.createElement("div");
  chip.id = "login-chip";
  document.body.appendChild(chip);

  chip.addEventListener("click", onChipClick);
  document.addEventListener("click", (e) => {
    if (menuOpen && chip && !chip.contains(e.target as Node)) {
      menuOpen = false;
      render();
    }
  });

  onSessionChange((address) => {
    profile = null;
    menuOpen = false;
    render();
    if (address) loadProfile(address);
  });

  render();
  const current = getWalletAddress();
  if (current) loadProfile(current);
}

async function loadProfile(address: string): Promise<void> {
  const resolved = await resolveProfiles([address]);
  // Guard against a logout that landed while the lookup was in flight.
  if (getWalletAddress()?.toLowerCase() !== address.toLowerCase()) return;
  profile = resolved.get(address.toLowerCase()) ?? null;
  render();
}

function onChipClick(e: MouseEvent): void {
  const target = e.target as HTMLElement;
  if (target.closest("#login-chip-logout")) {
    disconnect();
    return;
  }
  const address = getWalletAddress();
  if (!address) {
    connect();
  } else {
    menuOpen = !menuOpen;
    render();
  }
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function circlesGlyph(): string {
  return `<svg class="login-chip-glyph" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <circle cx="9" cy="12" r="6"></circle>
    <circle cx="15" cy="12" r="6"></circle>
  </svg>`;
}

function render(): void {
  if (!chip) return;
  const address = getWalletAddress();

  if (!address) {
    chip.className = "";
    chip.innerHTML = `
      <button class="login-chip-btn" type="button">
        ${circlesGlyph()}
        <span class="login-chip-label">Login with Circles</span>
      </button>`;
    return;
  }

  const name = profile?.name ?? shortAddr(address);
  const avatar = profile?.imageUrl
    ? `<img class="login-chip-avatar" src="${profile.imageUrl}" alt="">`
    : `<span class="login-chip-avatar login-chip-avatar-placeholder">${circlesGlyph()}</span>`;

  chip.className = "connected";
  chip.innerHTML = `
    <button class="login-chip-btn" type="button" aria-expanded="${menuOpen}">
      ${avatar}
      <span class="login-chip-label">${name}</span>
    </button>
    <div class="login-chip-menu ${menuOpen ? "" : "hidden"}">
      <div class="login-chip-addr">${shortAddr(address)}</div>
      <button id="login-chip-logout" class="login-chip-logout" type="button">Log out</button>
    </div>`;
}
