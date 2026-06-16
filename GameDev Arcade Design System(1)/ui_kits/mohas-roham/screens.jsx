/* ============================================================================
   Mohás Roham — UI kit. A faithful recreation of the in-game first-person HUD
   over a forest-night glade, composing the design-system HUD primitives + the
   elemental FX engine (fx/element-fx.js). The real game is Three.js; here the
   3D is suggested with CSS + canvas trolls so the HUD reads in context.

   Interactions (demo): hold the scene to DRAW the bow (crosshair spreads, charge
   fills); release to LOOSE — the targeted troll takes the equipped element's
   status. Keys 1–5 (or the selector) switch element. Exposed on window.
   ============================================================================ */
const { WaveBanner, ScorePill, HealthBar, ChargeMeter, Crosshair, ElementSelector, PlayerCard, StatusPip, Toast } =
  window.GameDevArcadeDesignSystem_67abce;

const EL_COLOR = { base: '#cfe0ff', fire: '#ff7a3d', ice: '#7fd0ff', poison: '#9fdc4a', lightning: '#c8b4ff' };

/* one approaching troll — a canvas running the FX engine's aura/troll renderer.
   Re-mounts when its status element changes (React key on `element`). */
function TrollSprite({ element, size }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!ref.current || !window.ElementFX) return;
    const fx = window.ElementFX.create(ref.current, { element, mode: 'aura' });
    return () => fx.stop();
  }, [element]);
  return <canvas ref={ref} style={{ width: size, height: size * 1.25, display: 'block' }} />;
}

function Troll({ t, onHit }) {
  const showStatus = t.status && t.status !== 'base';
  return (
    <div style={{ position: 'absolute', left: t.x + '%', top: t.y + '%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
      {showStatus && (
        <div style={{ marginBottom: 2 }}><StatusPip status={t.status} /></div>
      )}
      {/* slim enemy HP */}
      <div style={{ width: t.size * 0.6, height: 5, margin: '0 auto 2px', borderRadius: 3, background: 'var(--surface-track)', overflow: 'hidden', border: '1px solid var(--line)' }}>
        <div style={{ height: '100%', width: t.hp + '%', background: 'var(--fill-hp)' }} />
      </div>
      <TrollSprite element={t.status || 'base'} size={t.size} />
    </div>
  );
}

function RohamKit() {
  const [element, setElement] = React.useState('fire');
  const [charge, setCharge] = React.useState(0);
  const [drawing, setDrawing] = React.useState(false);
  const [score, setScore] = React.useState(1240);
  const [toast, setToast] = React.useState(null);
  const elRef = React.useRef(element); elRef.current = element;
  const sceneRef = React.useRef(null);
  const toastTimer = React.useRef(null);

  const [trolls, setTrolls] = React.useState([
    { id: 1, x: 32, y: 52, size: 120, hp: 100, status: null },
    { id: 2, x: 52, y: 46, size: 150, hp: 100, status: null },
    { id: 3, x: 72, y: 54, size: 110, hp: 100, status: null },
  ]);

  // bow draw: charge ramps while holding
  React.useEffect(() => {
    if (!drawing) return;
    const t = setInterval(() => setCharge((c) => Math.min(1, c + 0.05)), 50);
    return () => clearInterval(t);
  }, [drawing]);

  // keyboard element switch (1–5)
  React.useEffect(() => {
    const onKey = (e) => {
      const map = { '1': 'base', '2': 'fire', '3': 'ice', '4': 'poison', '5': 'lightning' };
      if (map[e.key]) setElement(map[e.key]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function popToast(txt) {
    setToast(txt); clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1100);
  }

  function loose() {
    const el = elRef.current;
    // target the largest (nearest) troll, apply the element's status
    setTrolls((ts) => {
      const target = ts.reduce((a, b) => (b.size > a.size ? b : a), ts[0]);
      return ts.map((t) => t.id === target.id
        ? { ...t, status: el, hp: Math.max(0, t.hp - (40 + Math.round(charge * 40))) }
        : t);
    });
    setScore((s) => s + (el === 'base' ? 100 : 150));
    streak(el);
    if (charge > 0.85) popToast('FEJLÖVÉS!');
    setCharge(0);
  }

  // a quick element-tinted streak from the bow up to the crosshair
  function streak(el) {
    const scene = sceneRef.current; if (!scene) return;
    const s = document.createElement('div');
    s.style.cssText = `position:absolute;left:50%;bottom:0;width:3px;height:60%;transform:translateX(-50%);
      background:linear-gradient(to top, transparent, ${EL_COLOR[el]});
      box-shadow:0 0 12px ${EL_COLOR[el]};border-radius:2px;pointer-events:none;z-index:7;
      opacity:1;transition:opacity .3s ease;`;
    scene.appendChild(s);
    requestAnimationFrame(() => { s.style.opacity = '0'; });
    setTimeout(() => s.remove(), 320);
  }

  const coop = [
    { name: 'Áron', color: '#36c5ff', hp: 88, you: true },
    { name: 'Bea', color: '#ffd27a', hp: 64 },
    { name: 'Csaba', color: '#9f6aff', hp: 0, down: true },
    { name: 'Dóra', color: '#5fd08a', hp: 100 },
  ];

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', cursor: 'none',
      fontFamily: 'var(--font-body)', background: 'radial-gradient(ellipse at 50% 42%, #16223c, #0a1018 72%)' }}>
      {/* SCENE — hold to draw, release to loose */}
      <div ref={sceneRef} onPointerDown={() => { setDrawing(true); }}
        onPointerUp={() => { if (drawing) { loose(); } setDrawing(false); }}
        onPointerLeave={() => setDrawing(false)}
        style={{ position: 'absolute', inset: 0 }}>
        {/* moon + fireflies */}
        <div style={{ position: 'absolute', left: '14%', top: '12%', width: 70, height: 70, borderRadius: '50%',
          background: 'radial-gradient(circle at 40% 40%, #eaf2ff, #aebfe0)', boxShadow: '0 0 50px 18px rgba(157,184,232,0.3)' }} />
        {/* ground line */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: '24%', height: 2, background: 'rgba(40,70,60,.5)', boxShadow: '0 0 30px rgba(40,70,60,.5)' }} />
        {trolls.map((t) => <Troll key={t.id} t={t} />)}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'var(--bg-vignette)' }} />
      </div>

      {/* HUD overlay (pointer-events off so the scene gets the draws) */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)' }}><WaveBanner wave={3} trollsLeft={trolls.filter((t) => t.hp > 0).length} /></div>
        <div style={{ position: 'absolute', top: 16, right: 18 }}><ScorePill value={score} /></div>
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }}><Crosshair spread={charge} element={element} /></div>
        <div style={{ position: 'absolute', left: '50%', bottom: 66, transform: 'translateX(-50%)' }}><ChargeMeter value={charge} show={drawing} /></div>
        <div style={{ position: 'absolute', left: 18, bottom: 18 }}><HealthBar value={72} label="Életerő" width={240} /></div>
        <div style={{ position: 'absolute', left: '50%', bottom: 14, transform: 'translateX(-50%)', pointerEvents: 'auto' }}>
          <ElementSelector current={element} onSelect={setElement} />
        </div>
        {/* co-op list */}
        <div style={{ position: 'absolute', top: 14, left: 16, display: 'flex', flexDirection: 'column', gap: 6, width: 180 }}>
          {coop.map((p) => <PlayerCard key={p.name} {...p} />)}
        </div>
        {/* toast */}
        <div style={{ position: 'absolute', left: '50%', top: '28%', transform: 'translateX(-50%)' }}>
          <Toast show={!!toast}>{toast || ''}</Toast>
        </div>
        {/* hint */}
        <div style={{ position: 'absolute', right: 18, bottom: 18, fontSize: 11, color: 'var(--ink-muted)', textAlign: 'right', textShadow: 'var(--text-shadow-hud)' }}>
          tartsd nyomva = feszítés · engedd el = lövés<br />1–5 = elem
        </div>
      </div>
    </div>
  );
}

window.RohamKit = RohamKit;
