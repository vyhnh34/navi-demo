import { RoomChannel } from "../lib/channel";
import { session } from "../lib/state";
import type { PresenceState, Role } from "../types";

/**
 * Join screen: name, role (Hide/Find), room code — then Presence-joins the room and
 * waits for the other player before handing off. Per PRD section 4/5.
 */
export function renderJoin(app: HTMLElement, onReady: () => void): void {
  let selectedRole: Role = session.role;

  app.innerHTML = `
    <div class="screen" id="join-screen">
      <img class="logo" src="/brand/logo.svg" alt="navi" />

      <div class="field">
        <label for="player-name">Your name</label>
        <input id="player-name" type="text" placeholder="Your name" name="navi-player-name" autocomplete="off" data-1p-ignore data-lpignore="true" data-bwignore value="${escapeHtml(session.name)}" />
      </div>

      <div class="role-toggle">
        <button id="role-hider" type="button" class="${selectedRole === "hider" ? "active" : ""}">Hide</button>
        <button id="role-finder" type="button" class="${selectedRole === "finder" ? "active" : ""}">Find</button>
      </div>

      <div class="field">
        <label for="room">Room code</label>
        <input id="room" type="text" autocomplete="off" autocapitalize="characters" value="${escapeHtml(session.roomCode)}" />
      </div>

      <button id="join" class="pill-button">Join</button>
      <p id="error" class="error-text" style="display:none"></p>
    </div>
  `;

  const nameInput = app.querySelector<HTMLInputElement>("#player-name")!;
  const roomInput = app.querySelector<HTMLInputElement>("#room")!;
  const hiderBtn = app.querySelector<HTMLButtonElement>("#role-hider")!;
  const finderBtn = app.querySelector<HTMLButtonElement>("#role-finder")!;
  const joinBtn = app.querySelector<HTMLButtonElement>("#join")!;
  const errorEl = app.querySelector<HTMLParagraphElement>("#error")!;

  hiderBtn.onclick = () => {
    selectedRole = "hider";
    hiderBtn.classList.add("active");
    finderBtn.classList.remove("active");
  };
  finderBtn.onclick = () => {
    selectedRole = "finder";
    finderBtn.classList.add("active");
    hiderBtn.classList.remove("active");
  };

  joinBtn.onclick = async () => {
    const name = nameInput.value.trim();
    const roomCode = roomInput.value.trim() || "NAVI";

    if (!name) {
      errorEl.textContent = "Enter your name to continue.";
      errorEl.style.display = "block";
      nameInput.focus();
      return;
    }

    errorEl.style.display = "none";
    joinBtn.disabled = true;
    joinBtn.textContent = "Joining…";

    session.name = name;
    session.role = selectedRole;
    session.roomCode = roomCode;

    try {
      const channel = new RoomChannel(roomCode);
      await channel.connect();
      await channel.trackPresence({ role: selectedRole, name });
      channel.send({ type: "join", role: selectedRole, name });
      session.channel = channel;
      renderWaiting(app, onReady);
    } catch (err) {
      errorEl.textContent = `Couldn't connect: ${describeError(err)}`;
      errorEl.style.display = "block";
      joinBtn.disabled = false;
      joinBtn.textContent = "Join";
    }
  };
}

function renderWaiting(app: HTMLElement, onReady: () => void): void {
  app.innerHTML = `
    <div class="screen">
      <img class="logo" src="/brand/logo.svg" alt="navi" />
      <div class="spinner"></div>
      <p class="title">Waiting for partner</p>
      <p class="subtitle">Room <strong>${escapeHtml(session.roomCode)}</strong> — share this code with them.</p>
      <button id="cancel" class="pill-button pill-button--secondary">Cancel</button>
    </div>
  `;

  const channel = session.channel!;
  const unsubscribePresence = channel.onPresence((states) => {
    const all = Object.values(states).flat() as PresenceState[];
    const partner = all.find((p) => p.role !== session.role);
    if (partner) {
      session.partnerName = partner.name;
      unsubscribePresence();
      onReady();
    }
  });

  app.querySelector<HTMLButtonElement>("#cancel")!.onclick = () => {
    unsubscribePresence();
    channel.disconnect();
    session.channel = null;
    renderJoin(app, onReady);
  };
}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function escapeHtml(value: string): string {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}
