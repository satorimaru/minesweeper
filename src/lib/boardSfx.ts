import type { Board } from "@/lib/minesweeper";
import { sfx } from "@/lib/sfx";

/**
 * Diff previous vs next board and fire matching sound effects.
 * Safe to call on every board update.
 */
export function playBoardTransition(prev: Board, next: Board): void {
  if (prev === next) return;

  // Terminal states (priority)
  if (prev.status === "playing" && next.status === "won") {
    sfx.win();
    return;
  }
  if (prev.status === "playing" && next.status === "lost") {
    sfx.lose();
    return;
  }
  if (next.status !== "playing") return;

  // Mine hit / shield block
  if (next.mineHits > prev.mineHits) {
    sfx.mine();
    return;
  }
  if (
    next.shieldCharges < prev.shieldCharges &&
    next.explodedAt &&
    (prev.explodedAt?.row !== next.explodedAt.row ||
      prev.explodedAt?.col !== next.explodedAt.col)
  ) {
    sfx.shield();
    return;
  }

  // Nuke / freeze from inventory
  if (prev.armedPower === "nuke" && next.armedPower === null) {
    const invDrop = (prev.inventory.nuke ?? 0) > (next.inventory.nuke ?? 0);
    if (invDrop) {
      sfx.nuke();
      // still allow power cascade below if opens happened
    }
  }
  if (prev.armedPower === "freeze" && next.armedPower === null) {
    const invDrop = (prev.inventory.freeze ?? 0) > (next.inventory.freeze ?? 0);
    if (invDrop) {
      sfx.freeze();
    }
  }

  // Power-up flash / message
  if (next.lastPowerMessage && next.lastPowerMessage !== prev.lastPowerMessage) {
    const msg = next.lastPowerMessage;
    if (msg.includes("Nuke") || msg.includes("☢️")) {
      // collect vs detonate — detonate already handled above often
      if (!msg.includes("deton") && msg.includes("collected")) sfx.power();
      else if (msg.includes("armed")) sfx.ui();
      else if (msg.includes("Nuke!")) sfx.nuke();
      else sfx.power();
    } else if (msg.includes("Freeze") || msg.includes("❄️") || msg.includes("CHILL")) {
      sfx.freeze();
    } else if (msg.includes("Shield") || msg.includes("🛡️")) {
      sfx.shield();
    } else {
      sfx.power();
    }
  }

  const openedDelta = next.openedCount - prev.openedCount;
  const flagDelta = next.flagCount - prev.flagCount;

  // Opens / cascade / combo
  if (openedDelta > 0) {
    if (openedDelta >= 4) {
      sfx.cascade(openedDelta);
    } else {
      sfx.open(next.combo);
    }
    if (next.combo >= 4 && next.combo > prev.combo && next.combo % 2 === 0) {
      // Layer a combo sting every even step at 4+
      window.setTimeout(() => sfx.combo(next.combo), 40);
    }
    return;
  }

  // Flag / unflag only
  if (flagDelta > 0) {
    sfx.flag();
  } else if (flagDelta < 0 && openedDelta === 0) {
    sfx.unflag();
  }
}
