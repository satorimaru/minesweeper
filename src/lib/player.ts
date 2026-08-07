const PLAYER_ID_KEY = "ms_player_id";
const PLAYER_NAME_KEY = "ms_player_name";

function randomId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `p_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

export function getOrCreatePlayerId(): string {
  if (typeof window === "undefined") return "";
  let id = sessionStorage.getItem(PLAYER_ID_KEY);
  if (!id) {
    id = randomId();
    sessionStorage.setItem(PLAYER_ID_KEY, id);
  }
  return id;
}

export function getPlayerName(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(PLAYER_NAME_KEY) ?? "";
}

export function setPlayerName(name: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PLAYER_NAME_KEY, name.trim().slice(0, 24));
}
