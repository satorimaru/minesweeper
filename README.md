# Mine Crush

A chaotic, candy-crush take on Minesweeper — combos, rockets, nukes, swipe gestures, and online versus / co-op. Built as a mobile-first **PWA** with Next.js.

## Modes

| Mode | Description |
|------|-------------|
| **Solo Crush** | Classic clear with power-ups & combo scoring |
| **Chaos Run** | Extra lives, denser loot, pure mayhem |
| **Versus** | Same board race — higher score wins; freeze sabotages rival |
| **Co-op** | Shared team lives, both clear the seed together |

## Gestures (phone)

- **Tap** — flag / unflag  
- **Double-tap** — open cell (or chord if already open)  
- **Swipe** — paint flags along a path  
- **Open swipe** toggle — swipe paints opens instead  
- **Tap** an open number — classic chord  

## Power-ups

Blast · Row/Col Rockets · Radar · Shield · Chaos Pop · Nuke · Freeze (versus sabotage)

## Multiplayer storage (Upstash)

Production rooms are stored in **Upstash Redis** via:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

These are already wired on the existing **Vercel ↔ Upstash** integration for this project (same names the previous Minesweeper Race app used). Redeploying this codebase keeps that link — no new Upstash database setup is required as long as the Vercel project still has those env vars.

Locally, if those vars are missing, rooms fall back to **in-memory** storage (fine for solo / single-process testing). To hit the real Redis from `npm run dev`, copy the values from Vercel into `.env.local` (see `.env.example`).

## Dev

```bash
npm install
npm run dev
```

## iPhone PWA

1. Open the site in Safari  
2. Share → **Add to Home Screen**  
3. Launch from the icon for standalone full-screen play  
