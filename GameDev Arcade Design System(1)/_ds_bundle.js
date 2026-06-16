/* @ds-bundle: {"format":3,"namespace":"GameDevArcadeDesignSystem_67abce","components":[{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Eyebrow","sourcePath":"components/core/Eyebrow.jsx"},{"name":"GlassPanel","sourcePath":"components/core/GlassPanel.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"ChargeMeter","sourcePath":"components/hud/ChargeMeter.jsx"},{"name":"Crosshair","sourcePath":"components/hud/Crosshair.jsx"},{"name":"ELEMENTS","sourcePath":"components/hud/ElementSelector.jsx"},{"name":"ElementSelector","sourcePath":"components/hud/ElementSelector.jsx"},{"name":"HealthBar","sourcePath":"components/hud/HealthBar.jsx"},{"name":"PlayerCard","sourcePath":"components/hud/PlayerCard.jsx"},{"name":"ScorePill","sourcePath":"components/hud/ScorePill.jsx"},{"name":"STATUS","sourcePath":"components/hud/StatusPip.jsx"},{"name":"StatusPip","sourcePath":"components/hud/StatusPip.jsx"},{"name":"Toast","sourcePath":"components/hud/Toast.jsx"},{"name":"WaveBanner","sourcePath":"components/hud/WaveBanner.jsx"}],"sourceHashes":{"components/core/Badge.jsx":"8265a9a2b354","components/core/Button.jsx":"3d5e12bf5e73","components/core/Eyebrow.jsx":"a050b7eda38b","components/core/GlassPanel.jsx":"d4a4070103fa","components/core/IconButton.jsx":"6d0ef33e73f1","components/hud/ChargeMeter.jsx":"4d1f28765dca","components/hud/Crosshair.jsx":"205036298ccd","components/hud/ElementSelector.jsx":"31348c1bdce4","components/hud/HealthBar.jsx":"b1fc73ff92a9","components/hud/PlayerCard.jsx":"4fb624544dc2","components/hud/ScorePill.jsx":"5f7f1809de7f","components/hud/StatusPip.jsx":"76074079a32f","components/hud/Toast.jsx":"0bf94a519eaf","components/hud/WaveBanner.jsx":"f20de65f1fe6","guidelines/fx/element-fx.js":"508d82117aba","mp-server/public/net-client.js":"2b044a2a093b","ui_kits/mohas-roham/screens.jsx":"9afa7ce05f36"},"inlinedExternals":[],"unexposedExports":[{"name":"connectCoop","sourcePath":"mp-server/public/net-client.js"}]} */

(() => {

const __ds_ns = (window.GameDevArcadeDesignSystem_67abce = window.GameDevArcadeDesignSystem_67abce || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Badge — a small pill for status / labels. Includes the four elemental status
 * tones (burning / frozen / poisoned / shocked) plus neutral, danger, warn,
 * success. Use the element tones to mark afflicted enemies or the active arrow.
 */
function Badge({
  children,
  tone = 'neutral',
  style,
  ...rest
}) {
  const tones = {
    neutral: {
      background: 'var(--surface-panel)',
      color: 'var(--ink-soft)',
      border: '1px solid var(--line)'
    },
    danger: {
      background: 'rgba(60,14,14,0.7)',
      color: 'var(--danger-soft)',
      border: '1px solid rgba(255,107,107,0.4)'
    },
    warn: {
      background: 'rgba(60,50,14,0.6)',
      color: 'var(--cream)',
      border: '1px solid rgba(255,210,122,0.3)'
    },
    success: {
      background: 'rgba(14,40,30,0.6)',
      color: 'var(--success)',
      border: '1px solid rgba(120,200,170,0.35)'
    },
    // elemental status tones
    fire: {
      background: 'rgba(255,90,42,0.16)',
      color: '#ffb27a',
      border: '1px solid rgba(255,122,61,0.45)'
    },
    ice: {
      background: 'rgba(111,216,255,0.14)',
      color: '#bfeaff',
      border: '1px solid rgba(111,216,255,0.45)'
    },
    poison: {
      background: 'rgba(159,220,74,0.14)',
      color: '#cde98a',
      border: '1px solid rgba(159,220,74,0.45)'
    },
    lightning: {
      background: 'rgba(180,140,255,0.16)',
      color: '#d8c8ff',
      border: '1px solid rgba(180,140,255,0.5)'
    }
  };
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      fontFamily: 'var(--font-body)',
      fontWeight: 700,
      fontSize: 'var(--text-xs)',
      letterSpacing: '0.04em',
      padding: '6px 14px',
      borderRadius: 'var(--radius-pill)',
      backdropFilter: 'var(--blur-glass)',
      WebkitBackdropFilter: 'var(--blur-glass)',
      ...(tones[tone] || tones.neutral),
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Button — the arcade call-to-action.
 * Variants map to the real games: `primary` (cyan CTA gradient with neon glow),
 * `p2` (orange), `glass` (frosted), `ghost` (text-only). Press = shrink + brighten.
 */
function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  type = 'button',
  onClick,
  style,
  ...rest
}) {
  const [pressed, setPressed] = React.useState(false);
  const sizes = {
    sm: {
      padding: '10px 20px',
      fontSize: '14px'
    },
    md: {
      padding: '14px 30px',
      fontSize: '18px'
    },
    lg: {
      padding: '16px 38px',
      fontSize: '22px'
    }
  };
  const variants = {
    primary: {
      background: 'var(--grad-cta)',
      color: '#061018',
      boxShadow: 'var(--glow-p1)',
      border: 'none'
    },
    p2: {
      background: 'linear-gradient(90deg, #ffa15f, #ff7a3d)',
      color: '#1a0c04',
      boxShadow: 'var(--glow-p2)',
      border: 'none'
    },
    glass: {
      background: 'var(--surface-raised)',
      color: 'var(--ink)',
      border: '1px solid var(--line-strong)',
      backdropFilter: 'var(--blur-glass)',
      WebkitBackdropFilter: 'var(--blur-glass)',
      boxShadow: 'var(--shadow-glass)'
    },
    ghost: {
      background: 'transparent',
      color: 'var(--ink-bright)',
      border: '1px solid var(--line)'
    }
  };
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    disabled: disabled,
    onClick: onClick,
    onPointerDown: () => setPressed(true),
    onPointerUp: () => setPressed(false),
    onPointerLeave: () => setPressed(false),
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      letterSpacing: '0.05em',
      borderRadius: 'var(--radius-lg)',
      cursor: disabled ? 'default' : 'pointer',
      transition: 'transform var(--dur-press) var(--ease-snap), filter var(--dur-fast)',
      transform: pressed && !disabled ? 'scale(var(--press-scale))' : 'scale(1)',
      filter: disabled ? 'grayscale(0.7) brightness(0.7)' : pressed ? 'brightness(var(--press-bright))' : 'none',
      ...sizes[size],
      ...variants[variant],
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Eyebrow.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Eyebrow — the small, wide-tracked uppercase label that sits above titles.
 * `tone` tints it (faint blue by default, or gold/cyan/orange).
 */
function Eyebrow({
  children,
  tone = 'faint',
  style,
  ...rest
}) {
  const tones = {
    faint: 'var(--ink-faint)',
    gold: 'var(--gold)',
    p1: 'var(--p1)',
    p2: 'var(--p2)'
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 'var(--text-eyebrow)',
      fontWeight: 700,
      letterSpacing: 'var(--track-eyebrow)',
      textTransform: 'uppercase',
      color: tones[tone] || tones.faint,
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Eyebrow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Eyebrow.jsx", error: String((e && e.message) || e) }); }

// components/core/GlassPanel.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * GlassPanel — the frosted, translucent surface that floats over the 3D canvas.
 * Used for the start card, score readout, HUD chrome. `tone="scrim"` gives the
 * heavier full-screen overlay look; `padding` and `radius` are tunable.
 */
function GlassPanel({
  children,
  tone = 'panel',
  radius = 'xl',
  padding = 24,
  style,
  ...rest
}) {
  const radii = {
    md: 'var(--radius-md)',
    lg: 'var(--radius-lg)',
    xl: 'var(--radius-xl)',
    pill: 'var(--radius-pill)'
  };
  const tones = {
    panel: {
      background: 'var(--surface-panel)',
      border: '1px solid var(--line)',
      boxShadow: 'var(--shadow-glass)'
    },
    raised: {
      background: 'var(--surface-raised)',
      border: '1px solid var(--line)',
      boxShadow: 'var(--shadow-raised)'
    },
    scrim: {
      background: 'var(--bg-overlay)',
      border: '1px solid var(--line)',
      boxShadow: 'var(--shadow-card)'
    }
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      borderRadius: radii[radius] || radii.xl,
      padding,
      color: 'var(--ink)',
      fontFamily: 'var(--font-body)',
      backdropFilter: 'var(--blur-glass)',
      WebkitBackdropFilter: 'var(--blur-glass)',
      ...(tones[tone] || tones.panel),
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { GlassPanel });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/GlassPanel.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * IconButton — round game control (emote / action), as in Mohás Berci.
 * `tone` colors the fill: `glass` (frosted), `smash` (orange radial),
 * `roar` (blue radial), or any custom background via `background`.
 * Pass an emoji or icon node as children. Press = shrink + brighten.
 */
function IconButton({
  children,
  tone = 'glass',
  size = 'md',
  label,
  background,
  onClick,
  style,
  ...rest
}) {
  const [pressed, setPressed] = React.useState(false);
  const sizes = {
    sm: 42,
    md: 62,
    lg: 92
  };
  const dim = sizes[size] || sizes.md;
  const tones = {
    glass: {
      background: 'var(--surface-raised)',
      border: '1px solid var(--line)',
      color: 'var(--ink-soft)',
      backdropFilter: 'var(--blur-glass)',
      WebkitBackdropFilter: 'var(--blur-glass)',
      boxShadow: 'var(--shadow-glass)'
    },
    smash: {
      background: 'radial-gradient(circle at 50% 35%, #cf6a33, #7e2f1c)',
      border: '1px solid var(--line-oncolor)',
      color: '#fff',
      boxShadow: 'var(--shadow-round)'
    },
    roar: {
      background: 'radial-gradient(circle at 50% 35%, #4f70da, #2a3f96)',
      border: '1px solid var(--line-oncolor)',
      color: '#fff',
      boxShadow: 'var(--shadow-round)'
    }
  };
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    "aria-label": label,
    onClick: onClick,
    onPointerDown: () => setPressed(true),
    onPointerUp: () => setPressed(false),
    onPointerLeave: () => setPressed(false),
    style: {
      width: dim,
      height: dim,
      borderRadius: '50%',
      display: 'inline-flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '1px',
      fontSize: dim * 0.36,
      lineHeight: 1,
      cursor: 'pointer',
      fontFamily: 'var(--font-body)',
      transition: 'transform var(--dur-press) var(--ease-snap), filter var(--dur-fast), background var(--dur-fast)',
      transform: pressed ? 'scale(0.88)' : 'scale(1)',
      filter: pressed ? 'brightness(1.18)' : 'none',
      ...(tones[tone] || tones.glass),
      ...(background ? {
        background
      } : {}),
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      lineHeight: 1
    }
  }, children), label ? /*#__PURE__*/React.createElement("small", {
    style: {
      fontSize: '8px',
      fontWeight: 700,
      letterSpacing: '0.05em',
      textTransform: 'uppercase'
    }
  }, label) : null);
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/hud/ChargeMeter.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * ChargeMeter — the bow draw-power bar (the real #powwrap). Fades in while
 * drawing; fill is the cyan→white charge gradient. `value` is 0–1.
 */
function ChargeMeter({
  value = 0,
  show = true,
  width = 170,
  style,
  ...rest
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      width,
      height: 8,
      borderRadius: 6,
      background: 'var(--surface-track)',
      border: '1px solid var(--line-strong)',
      opacity: show ? 1 : 0,
      transition: 'opacity 0.15s',
      overflow: 'hidden',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      width: pct + '%',
      borderRadius: 6,
      background: 'var(--fill-charge)'
    }
  }));
}
Object.assign(__ds_scope, { ChargeMeter });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/hud/ChargeMeter.jsx", error: String((e && e.message) || e) }); }

// components/hud/Crosshair.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Crosshair — the first-person reticle. A center dot + four ticks that push
 * OUTWARD as the bow draws (`spread` 0→1, like the real #cross expanding while
 * charging). Ticks tint to the equipped element; white for base.
 */
function Crosshair({
  spread = 0,
  element = 'base',
  size = 22,
  style,
  ...rest
}) {
  const tint = {
    base: 'rgba(255,255,255,0.9)',
    fire: '#ff7a3d',
    ice: '#7fd0ff',
    poison: '#9fdc4a',
    lightning: '#c8b4ff'
  }[element] || 'rgba(255,255,255,0.9)';
  const gap = 4 + spread * (size * 0.7); // ticks fly apart as you draw
  const len = 7;
  const line = extra => ({
    position: 'absolute',
    left: '50%',
    top: '50%',
    background: tint,
    boxShadow: '0 0 4px rgba(0,0,0,0.8)',
    ...extra
  });
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      position: 'relative',
      width: size * 3,
      height: size * 3,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: '50%',
      top: '50%',
      width: 4,
      height: 4,
      borderRadius: '50%',
      background: '#fff',
      boxShadow: '0 0 6px rgba(0,0,0,0.8)',
      transform: 'translate(-50%,-50%)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: line({
      width: 2,
      height: len,
      transform: `translate(-50%, calc(-50% - ${gap + len}px))`
    })
  }), /*#__PURE__*/React.createElement("div", {
    style: line({
      width: 2,
      height: len,
      transform: `translate(-50%, calc(-50% + ${gap}px))`
    })
  }), /*#__PURE__*/React.createElement("div", {
    style: line({
      width: len,
      height: 2,
      transform: `translate(calc(-50% - ${gap + len}px), -50%)`
    })
  }), /*#__PURE__*/React.createElement("div", {
    style: line({
      width: len,
      height: 2,
      transform: `translate(calc(-50% + ${gap}px), -50%)`
    })
  }));
}
Object.assign(__ds_scope, { Crosshair });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/hud/Crosshair.jsx", error: String((e && e.message) || e) }); }

// components/hud/ElementSelector.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * ElementSelector — the arrow-type picker HUD. Five chips (base + 4 elements),
 * each showing its gradient swatch, number key, and Hungarian label; the active
 * one is highlighted with a glow. Wire `onSelect` to the game's `currentElement`
 * and the 1–5 keys / mouse-wheel cycling.
 */
const ELEMENTS = [{
  id: 'base',
  label: 'ALAP',
  key: '1',
  grad: 'var(--grad-base)',
  color: '#cfe0ff'
}, {
  id: 'fire',
  label: 'TŰZ',
  key: '2',
  grad: 'var(--grad-fire)',
  color: '#ff7a3d'
}, {
  id: 'ice',
  label: 'JÉG',
  key: '3',
  grad: 'var(--grad-ice)',
  color: '#7fd0ff'
}, {
  id: 'poison',
  label: 'MÉREG',
  key: '4',
  grad: 'var(--grad-poison)',
  color: '#9fdc4a'
}, {
  id: 'lightning',
  label: 'VILLÁM',
  key: '5',
  grad: 'var(--grad-lightning)',
  color: '#b48cff'
}];
function ElementSelector({
  current = 'base',
  onSelect,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'flex',
      gap: 8,
      fontFamily: 'var(--font-body)',
      ...style
    }
  }, rest), ELEMENTS.map(el => {
    const active = el.id === current;
    return /*#__PURE__*/React.createElement("button", {
      key: el.id,
      type: "button",
      onClick: () => onSelect && onSelect(el.id),
      style: {
        width: 60,
        padding: '7px 6px 8px',
        borderRadius: 'var(--radius-lg)',
        cursor: 'pointer',
        background: active ? 'var(--surface-active)' : 'var(--surface-panel)',
        border: active ? `1px solid ${el.color}` : '1px solid var(--line)',
        boxShadow: active ? `0 0 16px ${el.color}66` : 'none',
        backdropFilter: 'var(--blur-glass)',
        WebkitBackdropFilter: 'var(--blur-glass)',
        transition: 'all 0.12s',
        opacity: active ? 1 : 0.7
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        height: 18,
        borderRadius: 5,
        background: el.grad,
        boxShadow: active ? `0 0 8px ${el.color}` : 'none'
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        marginTop: 6
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        color: 'var(--ink-faint)'
      }
    }, el.key), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: '0.03em',
        color: active ? el.color : 'var(--ink-muted)'
      }
    }, el.label)));
  }));
}
Object.assign(__ds_scope, { ELEMENTS, ElementSelector });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/hud/ElementSelector.jsx", error: String((e && e.message) || e) }); }

// components/hud/HealthBar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * HealthBar — generic HP bar (the real #hpwrap). Orange→amber fill on a dark
 * track, optional uppercase label above. Use for the player or, smaller, for an
 * enemy. `value` is 0–100; `color` overrides the fill (e.g. a co-op player tint).
 */
function HealthBar({
  value = 100,
  label,
  width = 280,
  height = 20,
  color,
  style,
  ...rest
}) {
  const pct = Math.max(0, Math.min(100, value));
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      width,
      fontFamily: 'var(--font-body)',
      ...style
    }
  }, rest), label ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 12,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color: 'var(--ink-bright)',
      marginBottom: 6,
      textShadow: 'var(--text-shadow-hud)'
    }
  }, label) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      height,
      borderRadius: 'var(--radius-sm)',
      background: 'var(--surface-track)',
      border: '2px solid var(--line-strong)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      width: pct + '%',
      background: color || 'var(--fill-hp)',
      transition: 'width 0.2s'
    }
  })));
}
Object.assign(__ds_scope, { HealthBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/hud/HealthBar.jsx", error: String((e && e.message) || e) }); }

// components/hud/PlayerCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * PlayerCard — one row of the co-op archer list: a color dot (the player's
 * fletching-glow color), name, "TE" marker for the local player, and a slim HP
 * bar in the player's color. `down` greys the row out.
 */
function PlayerCard({
  name = 'Archer',
  color = '#36c5ff',
  hp = 100,
  you = false,
  down = false,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 12px',
      borderRadius: 'var(--radius-lg)',
      fontFamily: 'var(--font-body)',
      background: 'var(--surface-panel)',
      border: '1px solid var(--line)',
      backdropFilter: 'var(--blur-glass)',
      WebkitBackdropFilter: 'var(--blur-glass)',
      opacity: down ? 0.42 : 1,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 12,
      height: 12,
      borderRadius: '50%',
      background: color,
      boxShadow: `0 0 8px ${color}`,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700,
      fontSize: 13,
      color: 'var(--ink)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, name), you ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 9,
      color: 'var(--ink-faint)',
      border: '1px solid var(--line)',
      borderRadius: 4,
      padding: '1px 4px'
    }
  }, "TE") : null, down ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      color: 'var(--danger)'
    }
  }, "ELESETT") : null), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 5,
      marginTop: 5,
      borderRadius: 3,
      background: 'var(--surface-track)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      width: Math.max(0, Math.min(100, hp)) + '%',
      background: color,
      transition: 'width 0.2s'
    }
  }))));
}
Object.assign(__ds_scope, { PlayerCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/hud/PlayerCard.jsx", error: String((e && e.message) || e) }); }

// components/hud/ScorePill.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * ScorePill — the score readout (the real #score): big cyan number + small
 * uppercase caption. Right-aligned in the top corner by default.
 */
function ScorePill({
  value = 0,
  label = 'pont',
  align = 'right',
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      textAlign: align,
      textShadow: 'var(--text-shadow-hud)',
      fontFamily: 'var(--font-display)',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 26,
      lineHeight: 1,
      color: 'var(--cyan)'
    }
  }, value), /*#__PURE__*/React.createElement("small", {
    style: {
      fontFamily: 'var(--font-body)',
      fontWeight: 600,
      fontSize: 10,
      lineHeight: 1.2,
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      color: 'var(--ink-muted)'
    }
  }, label));
}
Object.assign(__ds_scope, { ScorePill });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/hud/ScorePill.jsx", error: String((e && e.message) || e) }); }

// components/hud/StatusPip.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * StatusPip — a small glowing dot marking an enemy's active elemental status
 * (burning / frozen / poisoned / shocked). Float it over a troll or list it in
 * the HUD. Optional `label` shows the Hungarian status word.
 */
const STATUS = {
  fire: {
    color: '#ff7a3d',
    label: 'ÉGŐ'
  },
  ice: {
    color: '#7fd0ff',
    label: 'FAGYOTT'
  },
  poison: {
    color: '#9fdc4a',
    label: 'MÉRGEZETT'
  },
  lightning: {
    color: '#c8b4ff',
    label: 'SOKKOLT'
  }
};
function StatusPip({
  status = 'fire',
  size = 12,
  label = false,
  style,
  ...rest
}) {
  const s = STATUS[status] || STATUS.fire;
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontFamily: 'var(--font-body)',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      width: size,
      height: size,
      borderRadius: '50%',
      background: s.color,
      boxShadow: `0 0 ${size * 0.7}px ${s.color}, 0 0 ${size * 1.6}px ${s.color}88`,
      animation: 'gd-pulse 1.1s ease-in-out infinite'
    }
  }), label ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 11,
      letterSpacing: '0.04em',
      color: s.color
    }
  }, s.label) : null);
}
Object.assign(__ds_scope, { STATUS, StatusPip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/hud/StatusPip.jsx", error: String((e && e.message) || e) }); }

// components/hud/Toast.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Toast — the big centered amber announcement (the real #toast: wave cleared,
 * "FEJLÖVÉS!", etc.). Pops in with a scale + fade. Auto-hide on a timer yourself.
 */
function Toast({
  children,
  show = true,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 60,
      lineHeight: 1,
      color: 'var(--gold)',
      textShadow: 'var(--text-shadow-big)',
      textAlign: 'center',
      opacity: show ? 1 : 0,
      transform: show ? 'scale(1)' : 'scale(0.6)',
      transition: 'opacity 0.3s, transform 0.3s',
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Toast });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/hud/Toast.jsx", error: String((e && e.message) || e) }); }

// components/hud/WaveBanner.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * WaveBanner — top-center wave readout: big amber "HULLÁM N" + small troll count
 * (the real #wave). Center it at the top of the HUD.
 */
function WaveBanner({
  wave = 1,
  trollsLeft = 0,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      textAlign: 'center',
      textShadow: 'var(--text-shadow-hud)',
      fontFamily: 'var(--font-display)',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 30,
      lineHeight: 1,
      color: 'var(--gold)',
      letterSpacing: '0.04em'
    }
  }, "HULL\xC1M ", wave), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-body)',
      fontWeight: 600,
      fontSize: 13,
      lineHeight: 1.4,
      color: 'var(--ink-sub)'
    }
  }, "trollok: ", trollsLeft));
}
Object.assign(__ds_scope, { WaveBanner });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/hud/WaveBanner.jsx", error: String((e && e.message) || e) }); }

// guidelines/fx/element-fx.js
try { (() => {
/* ============================================================================
   element-fx.js — Mohás Roham elemental VFX reference engine (2D canvas)
   ----------------------------------------------------------------------------
   PURPOSE (two jobs):
     1. Drive the animated specimen cards in the Design System tab.
     2. Be the PORTING REFERENCE for Claude Code. This is a 2D additive particle
        system whose structure deliberately mirrors the game's existing 3D one:
          · our `Particle{x,y,vx,vy,life,...}`  ≈  THREE.Points attributes
          · ctx.globalCompositeOperation='lighter'  ≈  THREE.AdditiveBlending
          · per-element COLOR ramp + spawn rates    ≈  what you feed the 3D pool
        Where the 3D mapping is non-obvious, look for  // → THREE:  comments.

   THE GAME ALREADY HAS:
     · an arrow pool (`makeArrow`/`fireArrow`, 30 arrows, gravity GRAV=9.2),
     · an additive THREE.Points burst (dust/sparks) used on impacts,
     · per-monster materials you can `.clone()` and tint (see `eyeMat.clone()`).
   So to ship an element you mostly: pick the COLORS below, attach a TRAIL emitter
   to the live arrow, fire an IMPACT burst on hit, and paint a STATUS aura while
   the troll is afflicted. Each of those four is implemented here.

   API:
     const fx = ElementFX.create(canvas, { element:'fire', mode:'arrow' });
     fx.stop();                       // cancel the RAF loop
   element: 'base' | 'fire' | 'ice' | 'poison' | 'lightning'
   mode:    'arrow' | 'impact' | 'aura' | 'death'
   ============================================================================ */
(function (global) {
  'use strict';

  /* ── PER-ELEMENT CONFIG ────────────────────────────────────────────────────
     Colors mirror tokens/elements.css 1:1 (core, mid, glow, spark, deep, light).
     `grav` is downward accel (px/s²) for that element's particles — fire RISES
     (negative), poison droops (positive), ice/lightning ~weightless.
     `emit` is trail particles/second while an arrow flies.
     // → THREE: feed `light` to a small THREE.PointLight parented to the arrow. */
  const CFG = {
    base: {
      core: '#bfc6d2',
      mid: '#8a6a40',
      glow: '#e9f1ff',
      spark: '#cfe0ff',
      deep: '#5a5f6b',
      light: '#cfe0ff',
      grav: 40,
      emit: 90,
      trailSize: 2.2,
      spread: 0.18,
      arrowTint: '#cfe0ff'
    },
    fire: {
      core: '#ff5a2a',
      mid: '#ff9a3d',
      glow: '#ffc24d',
      spark: '#fff1c4',
      deep: '#2a1c14',
      light: '#ff7a3d',
      grav: -130,
      emit: 150,
      trailSize: 3.4,
      spread: 0.5,
      arrowTint: '#ff7a3d'
    },
    ice: {
      core: '#6fd8ff',
      mid: '#a9e8ff',
      glow: '#e2f6ff',
      spark: '#ffffff',
      deep: '#2a6fd0',
      light: '#7fd0ff',
      grav: 18,
      emit: 110,
      trailSize: 2.6,
      spread: 0.3,
      arrowTint: '#a9e8ff'
    },
    poison: {
      core: '#7e9a2e',
      mid: '#9fdc4a',
      glow: '#c8e26a',
      spark: '#d8ee8a',
      deep: '#4d6b1e',
      light: '#9fdc4a',
      grav: 60,
      emit: 95,
      trailSize: 3.0,
      spread: 0.42,
      arrowTint: '#9fdc4a'
    },
    lightning: {
      core: '#b48cff',
      mid: '#a8c8ff',
      glow: '#ffffff',
      spark: '#d8e6ff',
      deep: '#5a3fb0',
      light: '#b48cff',
      grav: 0,
      emit: 120,
      trailSize: 2.4,
      spread: 0.6,
      arrowTint: '#c8b4ff'
    }
  };

  /* small helpers ----------------------------------------------------------- */
  const rand = (a, b) => a + Math.random() * (b - a);
  const TAU = Math.PI * 2;

  /* ── PARTICLE POOL ──────────────────────────────────────────────────────────
     One flat array, recycled. // → THREE: this is exactly a THREE.Points buffer
     (position[], color[], life[]) — same fields, same update math, just 3D. */
  class Pool {
    constructor(max) {
      this.max = max;
      this.p = [];
      for (let i = 0; i < max; i++) this.p.push({
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        max: 1,
        size: 1,
        col: '#fff'
      });
      this.i = 0;
    }
    spawn(x, y, vx, vy, life, size, col) {
      const o = this.p[this.i = (this.i + 1) % this.max];
      o.x = x;
      o.y = y;
      o.vx = vx;
      o.vy = vy;
      o.life = life;
      o.max = life;
      o.size = size;
      o.col = col;
    }
    update(dt, grav) {
      for (const o of this.p) {
        if (o.life <= 0) continue;
        o.life -= dt;
        o.vy += grav * dt; // gravity (sign set per element)
        o.x += o.vx * dt;
        o.y += o.vy * dt;
      }
    }
    draw(ctx) {
      // additive draw: bright cores stack into hot whites where they overlap.
      ctx.globalCompositeOperation = 'lighter';
      for (const o of this.p) {
        if (o.life <= 0) continue;
        const k = o.life / o.max; // 1 → 0 over lifetime (fade + shrink)
        ctx.globalAlpha = Math.max(0, k);
        ctx.fillStyle = o.col;
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.size * (0.4 + k * 0.6), 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  /* pick a color along the element's hot→cool ramp by `t` (0..1) ------------- */
  function ramp(c, t) {
    // core (hot) → mid → glow → spark (brightest). Cheap 4-stop pick.
    if (t < 0.34) return c.core;
    if (t < 0.6) return c.mid;
    if (t < 0.85) return c.glow;
    return c.spark;
  }

  /* ── TROLL SILHOUETTE ───────────────────────────────────────────────────────
     A schematic mossy troll for the aura/death cards (NOT final art — the game
     builds the troll from Three.js primitives; this is just a stand-in to show
     the effect ON something). Glowing orange eyes per the real eyeMat. */
  function drawTroll(ctx, cx, cy, s, tint, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    const body = tint || '#5b8a68';
    // body blob
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 6 * s, 30 * s, 34 * s, 0, 0, TAU);
    ctx.fill();
    // head
    ctx.beginPath();
    ctx.ellipse(0, -26 * s, 22 * s, 20 * s, 0, 0, TAU);
    ctx.fill();
    // shoulders / arms
    ctx.beginPath();
    ctx.ellipse(-30 * s, 2 * s, 11 * s, 16 * s, 0.3, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(30 * s, 2 * s, 11 * s, 16 * s, -0.3, 0, TAU);
    ctx.fill();
    // moss patches (darker)
    ctx.fillStyle = '#41704e';
    ctx.beginPath();
    ctx.ellipse(-8 * s, -30 * s, 9 * s, 6 * s, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(12 * s, 10 * s, 10 * s, 7 * s, 0.4, 0, TAU);
    ctx.fill();
    // tusks
    ctx.fillStyle = '#f2e9d8';
    ctx.beginPath();
    ctx.moveTo(-7 * s, -18 * s);
    ctx.lineTo(-3 * s, -10 * s);
    ctx.lineTo(-10 * s, -14 * s);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(7 * s, -18 * s);
    ctx.lineTo(3 * s, -10 * s);
    ctx.lineTo(10 * s, -14 * s);
    ctx.fill();
    // glowing eyes (emissive #ff5a2a) — additive
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = '#ff7a3d';
    [-8, 8].forEach(ex => {
      const g = ctx.createRadialGradient(ex * s, -28 * s, 0, ex * s, -28 * s, 7 * s);
      g.addColorStop(0, '#ffd0a0');
      g.addColorStop(0.4, '#ff5a2a');
      g.addColorStop(1, 'rgba(255,90,42,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(ex * s, -28 * s, 7 * s, 0, TAU);
      ctx.fill();
    });
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  /* soft radial glow disc (impact flash / status halo) ---------------------- */
  function glow(ctx, x, y, r, col, a) {
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = a;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /* jagged electric arc between two points (lightning only) ----------------- */
  function bolt(ctx, x1, y1, x2, y2, segs, jitter, col, width) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = col;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.shadowColor = col;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    for (let i = 1; i < segs; i++) {
      const t = i / segs;
      ctx.lineTo(x1 + (x2 - x1) * t + rand(-jitter, jitter), y1 + (y2 - y1) * t + rand(-jitter, jitter));
    }
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ── RUNNER ──────────────────────────────────────────────────────────────── */
  function create(canvas, opts) {
    const element = opts && opts.element || 'fire';
    const mode = opts && opts.mode || 'arrow';
    const c = CFG[element] || CFG.fire;
    const ctx = canvas.getContext('2d');

    // DPR-correct sizing from the element's CSS box.
    let W = 0,
      H = 0;
    function resize() {
      const dpr = Math.min(global.devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      W = r.width;
      H = r.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    global.addEventListener('resize', resize);
    const pool = new Pool(420);
    let raf = 0,
      prev = performance.now(),
      t = 0;

    /* ARROW state: flies left→right, emits a trail, detonates, repeats. */
    const arrow = {
      x: -40,
      y: H * 0.5,
      vx: 230,
      ang: 0,
      flying: true,
      exploded: false
    };
    function resetArrow() {
      arrow.x = -40;
      arrow.y = H * (0.42 + Math.random() * 0.16);
      arrow.flying = true;
      arrow.exploded = false;
    }

    /* IMPACT burst: core→spark sparks thrown radially with gravity + a flash.
       // → THREE: identical to the game's dust burst — n points, random dir,
       // speed*(0.4..1.3), color by ramp(t); add a 1-frame PointLight flash. */
    function burst(x, y, n, power) {
      glow(ctx, x, y, 36 + power * 18, c.glow, 0.5); // muzzle flash (drawn live below via flashes[])
      for (let i = 0; i < n; i++) {
        const a = rand(0, TAU),
          sp = rand(40, 60 + power * 90);
        pool.spawn(x, y, Math.cos(a) * sp, Math.sin(a) * sp - 20, rand(0.3, 0.8), rand(1.6, 4.2) * (c.trailSize / 3), ramp(c, Math.random()));
      }
    }
    const flashes = []; // {x,y,r,life,max}

    /* AURA emit: element-specific signature painted on the troll each frame. */
    function emitAura(cx, cy, s) {
      if (element === 'fire') {
        // flames lick UPWARD off the body
        for (let i = 0; i < 3; i++) pool.spawn(cx + rand(-26, 26) * s, cy + rand(-10, 30) * s, rand(-12, 12), rand(-90, -150), rand(0.35, 0.7), rand(2, 4), ramp(c, Math.random()));
      } else if (element === 'ice') {
        // slow frost crystals drift + cling
        for (let i = 0; i < 2; i++) pool.spawn(cx + rand(-30, 30) * s, cy + rand(-30, 30) * s, rand(-8, 8), rand(-6, 16), rand(0.6, 1.1), rand(1.6, 3), ramp(c, Math.random()));
      } else if (element === 'poison') {
        // bubbles rise + pop, droplets drip
        if (Math.random() < 0.7) pool.spawn(cx + rand(-26, 26) * s, cy + rand(0, 28) * s, rand(-6, 6), rand(-30, -60), rand(0.5, 1.0), rand(2, 4.5), ramp(c, Math.random()));
        if (Math.random() < 0.4) pool.spawn(cx + rand(-22, 22) * s, cy + 30 * s, rand(-4, 4), rand(20, 50), rand(0.4, 0.8), rand(1.5, 2.6), c.mid);
      } else if (element === 'lightning') {
        // crackle motes; arcs handled separately in the draw step
        for (let i = 0; i < 2; i++) pool.spawn(cx + rand(-30, 30) * s, cy + rand(-30, 30) * s, rand(-30, 30), rand(-30, 30), rand(0.15, 0.4), rand(1.4, 2.6), ramp(c, Math.random()));
      } else {
        for (let i = 0; i < 1; i++) pool.spawn(cx + rand(-26, 26) * s, cy + rand(-26, 26) * s, rand(-10, 10), rand(-20, 6), rand(0.4, 0.8), rand(1.6, 2.6), ramp(c, Math.random()));
      }
    }

    /* DEATH state: a troll dissolves. BASE = break into falling chunks; each
       element OVERRIDES with its signature (fire ash, ice shatter, poison melt,
       lightning char). Loops. */
    const death = {
      t: 0,
      dur: 2.6,
      chunks: []
    };
    function seedDeath() {
      death.t = 0;
      death.chunks.length = 0;
      // chunk the silhouette into ~14 pieces that fall/scatter
      for (let i = 0; i < 14; i++) {
        death.chunks.push({
          ox: rand(-26, 26),
          oy: rand(-44, 30),
          r: rand(4, 11),
          vx: rand(-40, 40),
          vy: rand(-60, 10),
          rot: rand(0, TAU),
          col: Math.random() < 0.7 ? '#5b8a68' : '#41704e'
        });
      }
    }
    if (mode === 'death') seedDeath();
    let impactTimer = 0;
    function frame(now) {
      const dt = Math.min((now - prev) / 1000, 0.05);
      prev = now;
      t += dt;

      // clear with a faint trail-persistence wash (motion blur feel)
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(10,16,24,0.16)';
      ctx.fillRect(0, 0, W, H);
      if (mode === 'arrow') {
        if (arrow.flying) {
          arrow.x += arrow.vx * dt;
          // emit trail: spawn `emit` particles/sec along the shaft tail
          const n = Math.max(1, Math.round(c.emit * dt));
          for (let i = 0; i < n; i++) {
            const back = i / n;
            pool.spawn(arrow.x - 18 - back * 10, arrow.y + rand(-3, 3), rand(-30, -90) - arrow.vx * 0.04, rand(-1, 1) * c.spread * 120, rand(0.3, 0.7), rand(2.0, 4.2) * (c.trailSize / 2.6), ramp(c, Math.random()));
          }
          if (element === 'lightning' && Math.random() < 0.5) {
            // forked crackle hugging the shaft
            bolt(ctx, arrow.x - 4, arrow.y, arrow.x - 26, arrow.y + rand(-10, 10), 5, 5, c.glow, 1.4);
          }
          // draw the arrow itself (shaft + element-tinted head)
          drawArrow(ctx, arrow.x, arrow.y, c);
          if (arrow.x > W * 0.78) {
            arrow.flying = false;
            burst(arrow.x, arrow.y, element === 'fire' ? 40 : 30, 1.3);
            flashes.push({
              x: arrow.x,
              y: arrow.y,
              r: 6,
              max: 0.4,
              life: 0.4
            });
          }
        }
        if (!arrow.flying) {
          impactTimer += dt;
          if (impactTimer > 0.7) {
            impactTimer = 0;
            resetArrow();
          }
        }
      } else if (mode === 'impact') {
        impactTimer += dt;
        if (impactTimer > 1.1) {
          impactTimer = 0;
          burst(W * 0.5, H * 0.5, 40, 1.4);
          flashes.push({
            x: W * 0.5,
            y: H * 0.5,
            r: 8,
            max: 0.4,
            life: 0.4
          });
        }
      } else if (mode === 'aura') {
        const cx = W * 0.5,
          cy = H * 0.52,
          s = Math.min(W, H) / 130;
        // tint the troll with the element's status color, gently pulsing
        drawTroll(ctx, cx, cy, s, statusTint(element), 1);
        emitAura(cx, cy - 4, s);
        if (element === 'ice') glow(ctx, cx, cy, 60 * s, c.glow, 0.10 + 0.04 * Math.sin(t * 3));
        if (element === 'lightning' && Math.random() < 0.25) {
          // arc jumping across the body
          bolt(ctx, cx + rand(-30, 30) * s, cy - 30 * s, cx + rand(-30, 30) * s, cy + 30 * s, 7, 9, c.glow, 1.6);
        }
        if (element === 'fire') glow(ctx, cx, cy + 6 * s, 56 * s, c.mid, 0.10);
      } else if (mode === 'death') {
        runDeath(dt);
      }

      // draw + update flashes
      for (const f of flashes) {
        if (f.life > 0) {
          f.life -= dt;
          glow(ctx, f.x, f.y, f.r + (1 - f.life / f.max) * 40, c.glow, 0.6 * (f.life / f.max));
        }
      }
      pool.update(dt, c.grav);
      pool.draw(ctx);
      raf = global.requestAnimationFrame(frame);
    }

    /* DEATH renderer (kept separate for clarity) ----------------------------- */
    function runDeath(dt) {
      death.t += dt;
      const cx = W * 0.5,
        cy = H * 0.52,
        s = Math.min(W, H) / 130;
      const p = death.t / death.dur; // 0..1 progress
      if (p >= 1) {
        seedDeath();
      } // loop

      // Phase 1 (0–0.25): the troll reacts (flash + tint), still whole.
      if (p < 0.25) {
        const hit = 1 - p / 0.25;
        drawTroll(ctx, cx, cy, s, mixHitTint(element, hit), 1);
        glow(ctx, cx, cy, 50 * s, statusTint(element), 0.25 * hit);
      } else {
        // Phase 2 (0.25–1): BASE break-up + elemental override.
        const q = (p - 0.25) / 0.75; // 0..1 within dissolve
        // base chunks fall/scatter and fade
        ctx.globalAlpha = 1 - q;
        for (const ch of death.chunks) {
          ch.vy += 220 * dt; // gravity on chunks
          const x = cx + ch.ox * s + ch.vx * q * 0.8;
          const y = cy + ch.oy * s + ch.vy * q * 0.5;
          ctx.fillStyle = ch.col;
          ctx.beginPath();
          ctx.arc(x, y, ch.r * s * (1 - q * 0.4), 0, TAU);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        // elemental override layered on top of the crumble
        deathOverride(element, cx, cy, s, q, dt);
      }
    }

    /* each element's signature death flourish -------------------------------- */
    function deathOverride(e, cx, cy, s, q, dt) {
      if (e === 'fire') {
        // burst to ash + rising flame, then smoke
        for (let i = 0; i < 4; i++) pool.spawn(cx + rand(-26, 26) * s, cy + rand(-20, 20) * s, rand(-20, 20), rand(-120, -200), rand(0.4, 0.9), rand(2, 5), ramp(c, Math.random()));
        if (q < 0.3) glow(ctx, cx, cy, 70 * s, c.mid, 0.4 * (1 - q / 0.3));
      } else if (e === 'ice') {
        // SHATTER: angular shards fly out once, then settle
        if (q < 0.12) for (let i = 0; i < 30; i++) {
          const a = rand(0, TAU),
            sp = rand(80, 220);
          pool.spawn(cx, cy, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.5, 1.0), rand(2, 4), Math.random() < 0.5 ? c.glow : c.spark);
        }
        glow(ctx, cx, cy, 50 * s, c.core, 0.3 * (1 - q));
      } else if (e === 'poison') {
        // MELT: body slumps into a bubbling green puddle
        const puddleR = (24 + q * 40) * s;
        glow(ctx, cx, cy + 28 * s, puddleR, c.deep, 0.5);
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = c.mid;
        ctx.globalAlpha = 0.5 * (1 - q * 0.4);
        ctx.beginPath();
        ctx.ellipse(cx, cy + 30 * s, puddleR, puddleR * 0.32, 0, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        if (Math.random() < 0.6) pool.spawn(cx + rand(-1, 1) * puddleR, cy + 30 * s, rand(-6, 6), rand(-30, -70), rand(0.4, 0.8), rand(2, 3.5), c.glow);
      } else if (e === 'lightning') {
        // CHAR + violent arcs, then collapse to a charred husk
        if (q < 0.4 && Math.random() < 0.6) bolt(ctx, cx + rand(-20, 20) * s, cy - 36 * s, cx + rand(-20, 20) * s, cy + 30 * s, 8, 12, c.glow, 2);
        for (let i = 0; i < 2; i++) pool.spawn(cx + rand(-24, 24) * s, cy + rand(-24, 24) * s, rand(-40, 40), rand(-40, 40), rand(0.15, 0.4), rand(1.5, 3), ramp(c, Math.random()));
      } else {
        // BASE: just dust puffs as it crumbles
        if (Math.random() < 0.5) pool.spawn(cx + rand(-24, 24) * s, cy + rand(-10, 26) * s, rand(-20, 20), rand(-10, -40), rand(0.4, 0.8), rand(2, 3.5), c.spark);
      }
    }

    /* draw an element-tinted arrow (shaft + broadhead + feather) ------------- */
    function drawArrow(ctx, x, y, c) {
      ctx.save();
      ctx.translate(x, y);
      // shaft
      ctx.strokeStyle = '#8a6a40';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-26, 0);
      ctx.lineTo(8, 0);
      ctx.stroke();
      // red fletching
      ctx.strokeStyle = '#d64b3a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-26, 0);
      ctx.lineTo(-32, -5);
      ctx.moveTo(-26, 0);
      ctx.lineTo(-32, 5);
      ctx.stroke();
      // broadhead — element-tinted + glowing
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(12, 0, 0, 12, 0, 12);
      g.addColorStop(0, c.glow);
      g.addColorStop(0.5, c.arrowTint);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(12, 0, 12, 0, TAU);
      ctx.fill();
      ctx.fillStyle = c.core;
      ctx.globalCompositeOperation = 'source-over';
      ctx.beginPath();
      ctx.moveTo(4, -4);
      ctx.lineTo(16, 0);
      ctx.lineTo(4, 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    function stop() {
      global.cancelAnimationFrame(raf);
      global.removeEventListener('resize', resize);
    }
    raf = global.requestAnimationFrame(frame);
    return {
      stop
    };
  }

  /* status tint per element (used by aura/death) — mirrors --status-<e> ------ */
  function statusTint(e) {
    return {
      fire: '#a85a3a',
      ice: '#7fb6d8',
      poison: '#6f8a3a',
      lightning: '#8a7ac8',
      base: '#5b8a68'
    }[e] || '#5b8a68';
  }
  // brief hit tint (brighter flash of the status color) for the hit reaction.
  function mixHitTint(e, k) {
    return {
      fire: '#ff8a4a',
      ice: '#bfe6ff',
      poison: '#c8e26a',
      lightning: '#d8c8ff',
      base: '#cfe0ff'
    }[e] || '#cfe0ff';
  }
  global.ElementFX = {
    create,
    CFG,
    statusTint
  };
})(window);
})(); } catch (e) { __ds_ns.__errors.push({ path: "guidelines/fx/element-fx.js", error: String((e && e.message) || e) }); }

// mp-server/public/net-client.js
try { (() => {
// =============================================================================
//  net-client.js — Mohas Roham CO-OP networking stub (vanilla browser module)
// =============================================================================
//
//  A dependency-free, build-free ES module. Drop it next to the game and import
//  it ONLY when multiplayer is opted in (e.g. URL has ?room=ABCD). It connects
//  to the server's /ws endpoint, joins a room, and exposes a small hook surface
//  the game can wire into without changing single-player defaults.
//
//  USAGE (see INTEGRATION.md for the opt-in pattern):
//
//    import { connectCoop } from './net-client.js';
//
//    const net = connectCoop({
//      room: 'ABCD',            // optional; omit to have the server create one
//      name: 'Archer1',
//      // url: 'wss://host/ws', // optional; auto-derived from page origin
//      onWelcome: (info)  => { /* info.id, info.room, info.players, info.max */ },
//      onState:   (state) => { /* {tick,wave,score,players,monsters} @ ~20Hz */ },
//      onPeerJoined: (p)  => {},
//      onPeerLeft:   (id) => {},
//      onArrow:   (a)     => { /* peer fired: {id,from,dir,power} */ },
//      onHit:     (h)     => { /* server-confirmed hit/kill/score */ },
//      onChat:    (c)     => {},
//      onClose:   ()      => {},
//    });
//
//    // Pump these from the game loop / event handlers:
//    net.sendInput({ pos, yaw, pitch, hp, alive });     // your transform
//    net.sendShot({ from, dir, power });                // when you fire
//    net.sendHit({ monsterId, headshot, dmg });         // when your arrow hits
//    net.sendChat('hello');
//
//  The module NEVER touches the DOM or the game's globals — it only calls the
//  hooks you provide. That keeps single-player completely unaffected.
// =============================================================================

/**
 * Derive the WebSocket URL from the current page origin.
 * http(s)://host[:port]/...  ->  ws(s)://host[:port]/ws
 * Uses wss:// automatically when the page is served over https://.
 */
function defaultWsUrl() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/ws`;
}

/**
 * Connect to the co-op server and join a room.
 * @param {Object} opts
 * @returns {{
 *   sendInput: (s:object)=>void,
 *   sendShot:  (s:object)=>void,
 *   sendHit:   (h:object)=>void,
 *   sendChat:  (text:string)=>void,
 *   send:      (obj:object)=>void,
 *   close:     ()=>void,
 *   isOpen:    ()=>boolean,
 *   get id():  string|null,
 *   get room():string|null,
 * }}
 */
function connectCoop(opts = {}) {
  const url = opts.url || defaultWsUrl();
  const hooks = {
    onWelcome: opts.onWelcome || (() => {}),
    onState: opts.onState || (() => {}),
    onPeerJoined: opts.onPeerJoined || (() => {}),
    onPeerLeft: opts.onPeerLeft || (() => {}),
    onArrow: opts.onArrow || (() => {}),
    onHit: opts.onHit || (() => {}),
    onChat: opts.onChat || (() => {}),
    onSpawnWave: opts.onSpawnWave || (() => {}),
    onPlayerDown: opts.onPlayerDown || (() => {}),
    onError: opts.onError || (e => console.warn('[coop] error', e)),
    onOpen: opts.onOpen || (() => {}),
    onClose: opts.onClose || (() => {})
  };
  let ws = null;
  let selfId = null;
  let roomCode = opts.room || null;
  let joined = false;
  let closedByUser = false;

  // ---- outbound throttle for player_state -----------------------------------
  // The game loop runs at ~60 fps; we don't need to flood the socket with
  // transform updates. Cap to ~20/s to match the server tick.
  let lastInputSent = 0;
  const INPUT_MIN_INTERVAL_MS = 50;
  function open() {
    ws = new WebSocket(url);
    ws.addEventListener('open', () => {
      // Send our join request as soon as the socket is open.
      send({
        t: 'join',
        room: roomCode || undefined,
        name: opts.name || 'Archer',
        max: opts.max,
        pid: selfId || undefined
      }); // pid = stabil id => duplikátum-mentes újracsatlakozás
      hooks.onOpen();
    });
    ws.addEventListener('message', ev => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      route(msg);
    });
    ws.addEventListener('close', () => {
      joined = false;
      hooks.onClose();
      // Auto-reconnect unless the user closed us on purpose.
      if (!closedByUser) setTimeout(open, 1500);
    });
    ws.addEventListener('error', e => hooks.onError({
      code: 'socket',
      message: String(e?.message || 'ws error')
    }));
  }
  function route(msg) {
    switch (msg.t) {
      case 'hello':
        /* server greeting; join already sent on open */break;
      case 'welcome':
        selfId = msg.id;
        roomCode = msg.room;
        joined = true;
        hooks.onWelcome(msg);
        break;
      case 'state':
        hooks.onState(msg);
        break;
      case 'peer_joined':
        hooks.onPeerJoined(msg.player);
        break;
      case 'peer_left':
        hooks.onPeerLeft(msg.id);
        break;
      case 'player_state':
        // a single peer's relayed transform (between ticks).
        // The consolidated `state` frame also carries all
        // players, so onPeerState is an optional fast-path.
        if (opts.onPeerState) opts.onPeerState(msg);
        break;
      case 'arrow_fired':
        hooks.onArrow(msg);
        break;
      case 'hit':
        hooks.onHit(msg);
        break;
      case 'spawn_wave':
        hooks.onSpawnWave(msg);
        break;
      case 'monster_state':
        if (opts.onMonsters) opts.onMonsters(msg.monsters);
        break;
      case 'player_down':
        hooks.onPlayerDown(msg.id);
        break;
      case 'chat':
        hooks.onChat(msg);
        break;
      case 'error':
        hooks.onError(msg);
        break;
      default:
        /* unknown / future message types ignored */break;
    }
  }
  function send(obj) {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  }

  // ---- public send helpers --------------------------------------------------
  function sendInput(state) {
    const now = performance.now();
    if (now - lastInputSent < INPUT_MIN_INTERVAL_MS) return;
    lastInputSent = now;
    const _msg = {
      t: 'player_state',
      pos: state.pos,
      yaw: state.yaw,
      pitch: state.pitch
    };
    if (typeof state.hp === 'number') _msg.hp = state.hp; // omit => server keeps its (melee) value
    if (typeof state.alive === 'boolean') _msg.alive = state.alive;
    send(_msg);
  }
  function sendShot(shot) {
    send({
      t: 'arrow_fired',
      from: shot.from,
      dir: shot.dir,
      power: shot.power
    });
  }
  function sendHit(hit) {
    send({
      t: 'hit',
      monsterId: hit.monsterId,
      headshot: !!hit.headshot,
      dmg: hit.dmg
    });
  }
  function sendChat(text) {
    send({
      t: 'chat',
      text: String(text || '')
    });
  }
  function close() {
    closedByUser = true;
    if (ws) try {
      ws.close();
    } catch {/* ignore */}
  }
  open();
  return {
    sendInput,
    sendShot,
    sendHit,
    sendChat,
    send,
    close,
    isOpen: () => !!ws && ws.readyState === WebSocket.OPEN && joined,
    get id() {
      return selfId;
    },
    get room() {
      return roomCode;
    }
  };
}
try {
  void {
    connectCoop
  };
} catch {}
Object.assign(__ds_scope, { connectCoop });
})(); } catch (e) { __ds_ns.__errors.push({ path: "mp-server/public/net-client.js", error: String((e && e.message) || e) }); }

// ui_kits/mohas-roham/screens.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* ============================================================================
   Mohás Roham — UI kit. A faithful recreation of the in-game first-person HUD
   over a forest-night glade, composing the design-system HUD primitives + the
   elemental FX engine (fx/element-fx.js). The real game is Three.js; here the
   3D is suggested with CSS + canvas trolls so the HUD reads in context.

   Interactions (demo): hold the scene to DRAW the bow (crosshair spreads, charge
   fills); release to LOOSE — the targeted troll takes the equipped element's
   status. Keys 1–5 (or the selector) switch element. Exposed on window.
   ============================================================================ */
const {
  WaveBanner,
  ScorePill,
  HealthBar,
  ChargeMeter,
  Crosshair,
  ElementSelector,
  PlayerCard,
  StatusPip,
  Toast
} = window.GameDevArcadeDesignSystem_67abce;
const EL_COLOR = {
  base: '#cfe0ff',
  fire: '#ff7a3d',
  ice: '#7fd0ff',
  poison: '#9fdc4a',
  lightning: '#c8b4ff'
};

/* one approaching troll — a canvas running the FX engine's aura/troll renderer.
   Re-mounts when its status element changes (React key on `element`). */
function TrollSprite({
  element,
  size
}) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!ref.current || !window.ElementFX) return;
    const fx = window.ElementFX.create(ref.current, {
      element,
      mode: 'aura'
    });
    return () => fx.stop();
  }, [element]);
  return /*#__PURE__*/React.createElement("canvas", {
    ref: ref,
    style: {
      width: size,
      height: size * 1.25,
      display: 'block'
    }
  });
}
function Troll({
  t,
  onHit
}) {
  const showStatus = t.status && t.status !== 'base';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: t.x + '%',
      top: t.y + '%',
      transform: 'translate(-50%,-50%)',
      textAlign: 'center'
    }
  }, showStatus && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 2
    }
  }, /*#__PURE__*/React.createElement(StatusPip, {
    status: t.status
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      width: t.size * 0.6,
      height: 5,
      margin: '0 auto 2px',
      borderRadius: 3,
      background: 'var(--surface-track)',
      overflow: 'hidden',
      border: '1px solid var(--line)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      width: t.hp + '%',
      background: 'var(--fill-hp)'
    }
  })), /*#__PURE__*/React.createElement(TrollSprite, {
    element: t.status || 'base',
    size: t.size
  }));
}
function RohamKit() {
  const [element, setElement] = React.useState('fire');
  const [charge, setCharge] = React.useState(0);
  const [drawing, setDrawing] = React.useState(false);
  const [score, setScore] = React.useState(1240);
  const [toast, setToast] = React.useState(null);
  const elRef = React.useRef(element);
  elRef.current = element;
  const sceneRef = React.useRef(null);
  const toastTimer = React.useRef(null);
  const [trolls, setTrolls] = React.useState([{
    id: 1,
    x: 32,
    y: 52,
    size: 120,
    hp: 100,
    status: null
  }, {
    id: 2,
    x: 52,
    y: 46,
    size: 150,
    hp: 100,
    status: null
  }, {
    id: 3,
    x: 72,
    y: 54,
    size: 110,
    hp: 100,
    status: null
  }]);

  // bow draw: charge ramps while holding
  React.useEffect(() => {
    if (!drawing) return;
    const t = setInterval(() => setCharge(c => Math.min(1, c + 0.05)), 50);
    return () => clearInterval(t);
  }, [drawing]);

  // keyboard element switch (1–5)
  React.useEffect(() => {
    const onKey = e => {
      const map = {
        '1': 'base',
        '2': 'fire',
        '3': 'ice',
        '4': 'poison',
        '5': 'lightning'
      };
      if (map[e.key]) setElement(map[e.key]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  function popToast(txt) {
    setToast(txt);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1100);
  }
  function loose() {
    const el = elRef.current;
    // target the largest (nearest) troll, apply the element's status
    setTrolls(ts => {
      const target = ts.reduce((a, b) => b.size > a.size ? b : a, ts[0]);
      return ts.map(t => t.id === target.id ? {
        ...t,
        status: el,
        hp: Math.max(0, t.hp - (40 + Math.round(charge * 40)))
      } : t);
    });
    setScore(s => s + (el === 'base' ? 100 : 150));
    streak(el);
    if (charge > 0.85) popToast('FEJLÖVÉS!');
    setCharge(0);
  }

  // a quick element-tinted streak from the bow up to the crosshair
  function streak(el) {
    const scene = sceneRef.current;
    if (!scene) return;
    const s = document.createElement('div');
    s.style.cssText = `position:absolute;left:50%;bottom:0;width:3px;height:60%;transform:translateX(-50%);
      background:linear-gradient(to top, transparent, ${EL_COLOR[el]});
      box-shadow:0 0 12px ${EL_COLOR[el]};border-radius:2px;pointer-events:none;z-index:7;
      opacity:1;transition:opacity .3s ease;`;
    scene.appendChild(s);
    requestAnimationFrame(() => {
      s.style.opacity = '0';
    });
    setTimeout(() => s.remove(), 320);
  }
  const coop = [{
    name: 'Áron',
    color: '#36c5ff',
    hp: 88,
    you: true
  }, {
    name: 'Bea',
    color: '#ffd27a',
    hp: 64
  }, {
    name: 'Csaba',
    color: '#9f6aff',
    hp: 0,
    down: true
  }, {
    name: 'Dóra',
    color: '#5fd08a',
    hp: 100
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      cursor: 'none',
      fontFamily: 'var(--font-body)',
      background: 'radial-gradient(ellipse at 50% 42%, #16223c, #0a1018 72%)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    ref: sceneRef,
    onPointerDown: () => {
      setDrawing(true);
    },
    onPointerUp: () => {
      if (drawing) {
        loose();
      }
      setDrawing(false);
    },
    onPointerLeave: () => setDrawing(false),
    style: {
      position: 'absolute',
      inset: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: '14%',
      top: '12%',
      width: 70,
      height: 70,
      borderRadius: '50%',
      background: 'radial-gradient(circle at 40% 40%, #eaf2ff, #aebfe0)',
      boxShadow: '0 0 50px 18px rgba(157,184,232,0.3)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: '24%',
      height: 2,
      background: 'rgba(40,70,60,.5)',
      boxShadow: '0 0 30px rgba(40,70,60,.5)'
    }
  }), trolls.map(t => /*#__PURE__*/React.createElement(Troll, {
    key: t.id,
    t: t
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      background: 'var(--bg-vignette)'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 14,
      left: '50%',
      transform: 'translateX(-50%)'
    }
  }, /*#__PURE__*/React.createElement(WaveBanner, {
    wave: 3,
    trollsLeft: trolls.filter(t => t.hp > 0).length
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 16,
      right: 18
    }
  }, /*#__PURE__*/React.createElement(ScorePill, {
    value: score
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%,-50%)'
    }
  }, /*#__PURE__*/React.createElement(Crosshair, {
    spread: charge,
    element: element
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: '50%',
      bottom: 66,
      transform: 'translateX(-50%)'
    }
  }, /*#__PURE__*/React.createElement(ChargeMeter, {
    value: charge,
    show: drawing
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 18,
      bottom: 18
    }
  }, /*#__PURE__*/React.createElement(HealthBar, {
    value: 72,
    label: "\xC9leter\u0151",
    width: 240
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: '50%',
      bottom: 14,
      transform: 'translateX(-50%)',
      pointerEvents: 'auto'
    }
  }, /*#__PURE__*/React.createElement(ElementSelector, {
    current: element,
    onSelect: setElement
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 14,
      left: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      width: 180
    }
  }, coop.map(p => /*#__PURE__*/React.createElement(PlayerCard, _extends({
    key: p.name
  }, p)))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: '50%',
      top: '28%',
      transform: 'translateX(-50%)'
    }
  }, /*#__PURE__*/React.createElement(Toast, {
    show: !!toast
  }, toast || '')), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      right: 18,
      bottom: 18,
      fontSize: 11,
      color: 'var(--ink-muted)',
      textAlign: 'right',
      textShadow: 'var(--text-shadow-hud)'
    }
  }, "tartsd nyomva = fesz\xEDt\xE9s \xB7 engedd el = l\xF6v\xE9s", /*#__PURE__*/React.createElement("br", null), "1\u20135 = elem")));
}
window.RohamKit = RohamKit;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/mohas-roham/screens.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Eyebrow = __ds_scope.Eyebrow;

__ds_ns.GlassPanel = __ds_scope.GlassPanel;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.ChargeMeter = __ds_scope.ChargeMeter;

__ds_ns.Crosshair = __ds_scope.Crosshair;

__ds_ns.ELEMENTS = __ds_scope.ELEMENTS;

__ds_ns.ElementSelector = __ds_scope.ElementSelector;

__ds_ns.HealthBar = __ds_scope.HealthBar;

__ds_ns.PlayerCard = __ds_scope.PlayerCard;

__ds_ns.ScorePill = __ds_scope.ScorePill;

__ds_ns.STATUS = __ds_scope.STATUS;

__ds_ns.StatusPip = __ds_scope.StatusPip;

__ds_ns.Toast = __ds_scope.Toast;

__ds_ns.WaveBanner = __ds_scope.WaveBanner;

})();
