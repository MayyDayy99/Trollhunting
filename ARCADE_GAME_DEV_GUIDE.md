# Arcade Party Game Development Guide
**Motion Capture Fantasy Games — Munkahelyhez**

---

## 🎯 PROJECT SCOPE

### What We're Building
**Sword Duel** - 1v1 hand-tracked kardozás játék, arcade arcade party experience

### Hardware
- **PC**: i7-13th gen, 16GB RAM, 8GB RTX
- **Display**: Huawei IdeaHub (55-86", beépített kamera, WiFi)
- **Controllers**: Játékosok kézei (hand tracking)
- **Network**: WiFi 5GHz (LAN ideális)

### Success Criteria
✅ 1v1 gameplay, 2 perc / meccs  
✅ Motion capture (hand tracking stabil)  
✅ Multiplayer sync (Colyseus)  
✅ Arcade-szinten szórakoztató  
✅ Munkahelyi szünetben játszható  

---

## 📋 TECH STACK (Konkrét)

### Frontend
```
- Node.js 18+
- React 18
- Three.js (r128)
- @react-three/fiber
- @tensorflow/tfjs
- @tensorflow-models/pose-detection
- @tensorflow-models/hand-pose-detection
- colyseus.js
```

### Backend
```
- Node.js 18+
- Colyseus (game server)
- TypeScript
- Docker (optional, но ajánlott)
```

### Performance Targets
- Hand detection: <50ms
- Physics: <10ms
- Rendering: 60 FPS
- Network latency: <100ms ideális, <150ms elfogadható

---

## 🗺️ DEVELOPMENT ROADMAP

### NAP 1: Setup + Hand Tracking (4 óra)

**1.1 Projekt inicializálása**
```bash
# Frontend
npx create-react-app sword-duel-frontend
cd sword-duel-frontend
npm install three @react-three/fiber @react-three/drei colyseus.js
npm install @tensorflow/tfjs @tensorflow-models/hand-pose-detection

# Backend
mkdir sword-duel-server
cd sword-duel-server
npm init -y
npm install colyseus @colyseus/core @colyseus/ws-transport typescript ts-node
npm install --save-dev @types/node
```

**1.2 Hand Tracking Pipeline**
- [ ] MediaPipe Hands setup (camera input)
- [ ] Real-time hand detection (30 FPS)
- [ ] Hand position → sword position mapping
- [ ] Skeleton fallback (elökészítés)
- [ ] UI: Debug overlay (hand points)

**1.3 Szerver alapok**
- [ ] Colyseus room definition (SwordDuelRoom)
- [ ] Player state (HP, position, etc.)
- [ ] Simple echo test (client → server → client)

**Checklist napvégre:**
- [ ] Laptop kamera jól követi a kezed?
- [ ] Hand tracking stabil (±5 pixel jitter OK)?
- [ ] Szerver elindul, kliensek csatlakoznak?

---

### NAP 2: Game Logic + Physics (4 óra)

**2.1 Sword Collision Detection**
- [ ] Raycast: sword A vs sword B
- [ ] Hit registration: distance + velocity based
- [ ] Damage calculation: `damage = velocity / 50` (tune később)
- [ ] HP management: P1, P2 health bars

**2.2 Game Loop**
- [ ] Round start: 2 perc timer
- [ ] Hand tracking → sword position sync (Colyseus)
- [ ] Collision detection → damage → HP update
- [ ] Win condition: HP < 0

**2.3 Visual Feedback**
- [ ] Sword models (simple cube, majd Three.js mesh)
- [ ] Hit spark effect (particle system vagy sprite)
- [ ] Health bars (UI canvas)
- [ ] Victory screen

**2.4 Szinkronizálás**
- [ ] room.send("move", {handPos})
- [ ] onStateChange: follow opponent
- [ ] Collision: server-side autoritatív
- [ ] Score sync

**Checklist napvégre:**
- [ ] 1v1 játék működik?
- [ ] Kardok követik a kezeidet?
- [ ] Ütközés szórakoztatóan működik?

---

### NAP 3: Audio + Polish (3 óra)

**3.1 Sound Design**
- [ ] Sword clash: metallic "ting!" (mp3)
- [ ] Hit: impact "thunk"
- [ ] Victory: fanfare melody
- [ ] Ambient: subtle loop (optional)

**3.2 Visual Polish**
- [ ] Sword model upgrade (nem csak cube)
- [ ] Character avatars (simple humanoid)
- [ ] Lighting: dramatic arena setup
- [ ] Camera angle: cinematic view

**3.3 UI/UX**
- [ ] Score display (top right)
- [ ] Timer (top center)
- [ ] Instructions (first load)
- [ ] Victory animation

**3.4 Performance Optimization**
- [ ] GPU profiling (DevTools)
- [ ] Hand detection latency: <50ms?
- [ ] FPS: consistent 60?
- [ ] Network: smooth sync?

**3.5 Testing**
- [ ] Multiplayer test: 2 játékos
- [ ] Latency test: feels good?
- [ ] Bug fixes: crash, jitter, desync?

**Checklist napvégre:**
- [ ] Audio: szórakoztatóan működik?
- [ ] Szinkronizálás: smooth?
- [ ] Gameplay: szórakoztató?

---

## 🔧 KONKRÉT IMPLEMENTÁCIÓ LÉPÉSEK

### Frontend - Hand Tracking

```javascript
// src/hooks/useHandTracking.js

import { useEffect, useRef, useState } from 'react';
import * as handPoseDetection from '@tensorflow-models/hand-pose-detection';
import * as tf from '@tensorflow/tfjs';

export function useHandTracking() {
  const [hands, setHands] = useState([]);
  const videoRef = useRef(null);
  const detectorRef = useRef(null);

  useEffect(() => {
    const setupCamera = async () => {
      const video = videoRef.current;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          facingMode: 'user'
        }
      });
      video.srcObject = stream;
    };

    const initDetector = async () => {
      const detector = await handPoseDetection.createDetector(
        handPoseDetection.SupportedModels.MediaPipeHands,
        { runtime: 'tfjs' }
      );
      detectorRef.current = detector;
    };

    const detectLoop = async () => {
      if (!detectorRef.current || !videoRef.current) return;

      try {
        const predictions = await detectorRef.current.estimateHands(
          videoRef.current
        );
        setHands(predictions);
      } catch (e) {
        console.error('Detection failed:', e);
      }

      requestAnimationFrame(detectLoop);
    };

    setupCamera().then(() => initDetector().then(detectLoop));
  }, []);

  return { hands, videoRef };
}
```

### Frontend - Sword Position

```javascript
// src/utils/swordUtils.js

export function getHandPosition(hand) {
  if (!hand || !hand.keypoints) return null;
  
  // Index finger tip = sword tip
  const indexTip = hand.keypoints[8];
  
  // Kalman smoothing (alapszint)
  return {
    x: indexTip.x,
    y: indexTip.y,
    score: indexTip.score,
    hand: hand.handedness
  };
}

export function calculateCollision(p1Pos, p2Pos) {
  if (!p1Pos || !p2Pos) return false;
  
  const distance = Math.hypot(
    p1Pos.x - p2Pos.x,
    p1Pos.y - p2Pos.y
  );
  
  // Hit if closer than 50 pixels
  return distance < 50;
}
```

### Backend - Game Room

```typescript
// server/src/rooms/SwordDuelRoom.ts

import { Room, Client } from "colyseus";

interface PlayerState {
  id: string;
  hp: number;
  handPos: { x: number; y: number };
  score: number;
}

export class SwordDuelRoom extends Room {
  maxClients = 2;
  gameTime = 120; // 2 perc
  players: Map<string, PlayerState> = new Map();

  onCreate(options: any) {
    this.setSimulationInterval(() => this.gameLoop());
  }

  onJoin(client: Client, options: any) {
    const playerId = client.sessionId;
    this.players.set(playerId, {
      id: playerId,
      hp: 100,
      handPos: { x: 0, y: 0 },
      score: 0
    });

    console.log(`Player joined: ${playerId}`);

    if (this.clients.length === 2) {
      this.startGame();
    }
  }

  onMessage(client: Client, message: any) {
    const player = this.players.get(client.sessionId);
    if (!player) return;

    if (message.type === "move") {
      player.handPos = message.data.handPos;
    }
  }

  private gameLoop() {
    if (this.players.size !== 2) return;

    // Check collision
    const [p1, p2] = Array.from(this.players.values());
    
    if (this.checkCollision(p1.handPos, p2.handPos)) {
      const damage = 10; // Simple fixed damage
      p2.hp -= damage;
      p1.score += 10;

      // Broadcast to all clients
      this.broadcast("hit", { damage, winner: p1.id });
    }

    // Check win condition
    if (p1.hp <= 0 || p2.hp <= 0) {
      this.endGame();
    }

    // Broadcast game state
    this.broadcast("state", {
      players: Array.from(this.players.values()),
      gameTime: this.gameTime--
    });
  }

  private checkCollision(pos1: any, pos2: any): boolean {
    const distance = Math.hypot(pos1.x - pos2.x, pos1.y - pos2.y);
    return distance < 50;
  }

  private startGame() {
    console.log("Game started!");
    this.broadcast("gameStart");
  }

  private endGame() {
    const winner = Array.from(this.players.values()).reduce((a, b) =>
      a.hp > b.hp ? a : b
    );
    this.broadcast("gameEnd", { winnerId: winner.id });
    this.disconnect();
  }
}
```

---

## 📦 DEPLOYMENT

### Development (Laptop)

```bash
# Terminal 1: Backend
cd sword-duel-server
npm run dev
# → Server running on ws://localhost:3001

# Terminal 2: Frontend
cd sword-duel-frontend
npm start
# → http://localhost:3000 (Chrome fullscreen)

# Testing
# Open http://localhost:3000 in 2 browser windows
# Both connect to same server
```

### Production (IdeaHub)

```bash
# 1. Build frontend
cd sword-duel-frontend
npm run build

# 2. Copy to server public folder
cp -r build/ ../sword-duel-server/public/

# 3. Start server
cd sword-duel-server
npm start
# → Server running on ws://0.0.0.0:3001
# → Frontend: http://<ideahub-ip>:3001

# 4. Optional: Docker
docker build -t sword-duel .
docker run -p 3001:3001 sword-duel
```

---

## 🎮 PLAYTESTING CHECKLIST

### Session 1: Munkatársakkal (30 min)

- [ ] Game elindul? (no crashes)
- [ ] 1v1 működik? (2 játékos sync)
- [ ] Kardok követik a kezet? (jitter tolerable?)
- [ ] Ütközés működik? (hit registration OK?)
- [ ] Szórakoztató? (fun factor honest assessment)

### Kritikus kérdések:
1. **Jitter**: "Rángat az íj?" → Ha igen: add Kalman filter
2. **Latency**: "Lag van?" → Ha igen: check network
3. **Gameplay**: "Ez a játék?" → Ha nem: redesign szükséges
4. **Motivation**: "Játszanánk még?" → Ha nem: back to drawing board

---

## ⚠️ KNOWN ISSUES & SOLUTIONS

| Issue | Symptom | Solution |
|-------|---------|----------|
| Hand jitter | Sword vibrates | Kalman filter + exponential smoothing |
| Occlusion | Hand not detected | Skeleton fallback (pose estimation) |
| Network lag | Desync | Increase update frequency, add prediction |
| GPU lag | FPS drops | Reduce particle count, optimize shaders |
| Camera angle | Hand cut off | Adjust camera FOV or player position |

---

## 📊 RISK ASSESSMENT

| Phase | Risk | Mitigation |
|-------|------|------------|
| Hand tracking | MEDIUM | Test with real players immediately |
| Multiplayer sync | MEDIUM | Simple server logic first, scale later |
| Performance | LOW | i7-13 has headroom |
| Audio/Visual | LOW | Simple assets OK for MVP |

---

## 🚀 NEXT STEPS (After MVP Success)

✅ **IF Sword Duel Works Well:**
1. Add second game (Boss Fight co-op)
2. Add gesture system (optional)
3. Tournament mode (leaderboard)

❌ **IF Sword Duel Needs Work:**
1. Playtest more
2. Iterate on mechanics
3. Don't rush to next game

---

## 📚 RESOURCES

### Documentation
- Three.js: https://threejs.org/docs/
- Colyseus: https://docs.colyseus.io/
- MediaPipe Hands: https://google.github.io/mediapipe/solutions/hands
- React Three Fiber: https://docs.pmnd.rs/react-three-fiber/

### Repos to Reference
- Colyseus examples: https://github.com/colyseus/colyseus/tree/master/examples
- Three.js examples: https://threejs.org/examples/

---

## 💾 PROJECT STRUCTURE

```
sword-duel/
├── sword-duel-frontend/
│   ├── public/
│   ├── src/
│   │   ├── hooks/
│   │   │   └── useHandTracking.js
│   │   ├── utils/
│   │   │   └── swordUtils.js
│   │   ├── components/
│   │   │   ├── Game.jsx
│   │   │   ├── Arena.jsx
│   │   │   └── UI.jsx
│   │   ├── App.jsx
│   │   └── index.js
│   └── package.json
│
├── sword-duel-server/
│   ├── src/
│   │   ├── rooms/
│   │   │   └── SwordDuelRoom.ts
│   │   └── index.ts
│   ├── public/ (frontend build)
│   ├── Dockerfile
│   └── package.json
│
└── README.md
```

---

## ⏱️ TIMELINE SUMMARY

**NAP 1**: Setup + Hand tracking = ~4 óra  
**NAP 2**: Game logic + Physics = ~4 óra  
**NAP 3**: Audio + Polish + Test = ~3 óra  

**TOTAL**: ~11 óra development  
**Target**: Hétvégén playable, hétfőn arcade-ready

---

## 🎯 SUCCESS = ?

✅ Game működik stabil (no crashes)  
✅ 2 játékos: sync OK, szórakoztató  
✅ Hand tracking: jitter <5px (tolerable)  
✅ Munkahelyhez: "játszunk még holnap?"  

**If ALL YES** → Sword Duel MVP success! 🎉  
**If ANY NO** → Debug, iterate, don't rush Bow/Boss

---

**Last Updated**: June 15, 2026  
**Status**: Ready to start development
