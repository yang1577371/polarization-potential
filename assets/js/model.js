/* ============================================================
   极化与析出电势 · 计算模型
   25 ℃ 标准电极电势，活度以浓度近似。
   电极反应：阴极（还原）E = E° + (0.0592/n)·lg c(Ox)
             阳极（氧化）E = E° − (0.0592/n)·lg c(Red)
   ============================================================ */
window.Echem = (function () {
  "use strict";

  const IONS = [
    { id: "Cu", name: "Cu²⁺", side: "cathode", E0: 0.34, n: 2, sign: +1, color: "#c9702f", eq: "Cu²⁺ + 2e⁻ ⇌ Cu" },
    { id: "H",  name: "H⁺",   side: "cathode", E0: 0.00, n: 1, sign: +1, color: "#e05252", eq: "2H⁺ + 2e⁻ ⇌ H₂" },
    { id: "Zn", name: "Zn²⁺", side: "cathode", E0: -0.76, n: 2, sign: +1, color: "#8794a6", eq: "Zn²⁺ + 2e⁻ ⇌ Zn" },
    { id: "OH", name: "OH⁻",  side: "anode",   E0: 0.40, n: 1, sign: -1, color: "#3d7fd1", eq: "O₂ + 2H₂O + 4e⁻ ⇌ 4OH⁻" },
    { id: "Cl", name: "Cl⁻",  side: "anode",   E0: 1.36, n: 1, sign: -1, color: "#3aa76d", eq: "Cl₂ + 2e⁻ ⇌ 2Cl⁻" }
  ];

  const ION_BY_ID = IONS.reduce((m, i) => ((m[i.id] = i), m), {});

  const DEFAULTS = {
    conc: { Cu: 0.1, Zn: 0.1, H: 0.1, Cl: 1.0, OH: 0.1 },
    etaC: 0.10,
    etaA: 0.10,
    polar: "electrochem"
  };

  const state = {
    conc: Object.assign({}, DEFAULTS.conc),
    etaC: DEFAULTS.etaC,
    etaA: DEFAULTS.etaA,
    polar: DEFAULTS.polar
  };

  const PRESETS = [
    {
      id: "textbook",
      label: "教材默认",
      hint: "0.1 mol/L，η = 0.10 V",
      patch: { conc: { Cu: 0.1, Zn: 0.1, H: 0.1, Cl: 1.0, OH: 0.1 }, etaC: 0.1, etaA: 0.1, polar: "electrochem" }
    },
    {
      id: "ideal",
      label: "无极化理想态",
      hint: "η = 0，只看平衡电势",
      patch: { conc: { Cu: 0.1, Zn: 0.1, H: 0.1, Cl: 1.0, OH: 0.1 }, etaC: 0, etaA: 0, polar: "none" }
    },
    {
      id: "dilute",
      label: "浓差极化",
      hint: "稀溶液，扩散受限",
      patch: { conc: { Cu: 0.01, Zn: 0.01, H: 0.01, Cl: 0.1, OH: 0.01 }, etaC: 0.1, etaA: 0.1, polar: "conc" }
    },
    {
      id: "strong",
      label: "强极化",
      hint: "η = 0.40 V，电势大幅偏移",
      patch: { conc: { Cu: 0.1, Zn: 0.1, H: 0.1, Cl: 1.0, OH: 0.1 }, etaC: 0.4, etaA: 0.4, polar: "electrochem" }
    }
  ];

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  /* 浓度 0.01–1.0 mol/L 映射到 0–100 的对数滑块 */
  const concToSlider = (c) => Math.round((Math.log10(clamp(c, 1e-4, 10)) + 2) * 50);
  const sliderToConc = (v) => Math.pow(10, clamp(v, 0, 100) / 50 - 2);

  function etaOf(ion, s) {
    if (s.polar === "none") return 0;
    if (s.polar === "conc") {
      // 浓差极化：溶液越稀，电极表面与本体浓度差越难消除
      return (0.0592 / ion.n) * Math.max(0, -Math.log10(s.conc[ion.id]));
    }
    return ion.side === "cathode" ? s.etaC : s.etaA;
  }

  function computeAll(s) {
    const st = s || state;
    return IONS.map((ion) => {
      const c = st.conc[ion.id];
      const Eeq = ion.E0 + ion.sign * (0.0592 / ion.n) * Math.log10(c);
      const eta = etaOf(ion, st);
      const Eact = ion.side === "cathode" ? Eeq - eta : Eeq + eta;
      return Object.assign({}, ion, { c: c, Eeq: Eeq, Eta: eta, Eact: Eact });
    });
  }

  function ranking(s) {
    const data = computeAll(s);
    return {
      all: data,
      cathode: data.filter((d) => d.side === "cathode").sort((a, b) => b.Eact - a.Eact),
      anode: data.filter((d) => d.side === "anode").sort((a, b) => a.Eact - b.Eact)
    };
  }

  /* 理论分解电压：阳极最先析出电势 − 阴极最先析出电势（忽略欧姆压降） */
  function decomposition(s) {
    const r = ranking(s);
    if (!r.cathode.length || !r.anode.length) return null;
    return {
      U: r.anode[0].Eact - r.cathode[0].Eact,
      cathode: r.cathode[0],
      anode: r.anode[0]
    };
  }

  const MINUS = "\u2212";
  function fmt(v) {
    const a = Math.abs(v).toFixed(2);
    return (v < -0.005 ? MINUS : "+") + a;
  }
  function fmtNum(v, digits) {
    return (v < 0 ? MINUS : "") + Math.abs(v).toFixed(digits === undefined ? 3 : digits);
  }
  function fmtConc(c) {
    if (c >= 0.1) return c.toFixed(2);
    if (c >= 0.01) return c.toFixed(3);
    return c.toFixed(4);
  }

  function reset() {
    IONS.forEach((i) => (state.conc[i.id] = DEFAULTS.conc[i.id]));
    state.etaC = DEFAULTS.etaC;
    state.etaA = DEFAULTS.etaA;
    state.polar = DEFAULTS.polar;
  }

  function applyPreset(id) {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return null;
    IONS.forEach((i) => {
      if (p.patch.conc[i.id] !== undefined) state.conc[i.id] = p.patch.conc[i.id];
    });
    if (p.patch.etaC !== undefined) state.etaC = p.patch.etaC;
    if (p.patch.etaA !== undefined) state.etaA = p.patch.etaA;
    if (p.patch.polar !== undefined) state.polar = p.patch.polar;
    return p;
  }

  function serialize() {
    const q = new URLSearchParams();
    q.set("p", state.polar);
    q.set("c", IONS.map((i) => state.conc[i.id]).join(","));
    q.set("ec", String(state.etaC));
    q.set("ea", String(state.etaA));
    return q.toString();
  }

  function deserialize(search) {
    const q = new URLSearchParams(search || location.search);
    const p = q.get("p");
    if (p === "none" || p === "electrochem" || p === "conc") state.polar = p;
    const c = (q.get("c") || "").split(",").map(Number);
    if (c.length === IONS.length && c.every((x) => Number.isFinite(x) && x > 0)) {
      IONS.forEach((ion, i) => (state.conc[ion.id] = clamp(c[i], 0.01, 1)));
    }
    const ec = parseFloat(q.get("ec"));
    const ea = parseFloat(q.get("ea"));
    if (Number.isFinite(ec)) state.etaC = clamp(ec, 0, 0.6);
    if (Number.isFinite(ea)) state.etaA = clamp(ea, 0, 0.6);
    return !!(p || q.get("c"));
  }

  return {
    IONS,
    ION_BY_ID,
    DEFAULTS,
    PRESETS,
    state,
    computeAll,
    ranking,
    decomposition,
    concToSlider,
    sliderToConc,
    fmt,
    fmtNum,
    fmtConc,
    reset,
    applyPreset,
    serialize,
    deserialize
  };
})();
