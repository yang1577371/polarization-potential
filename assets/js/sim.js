/* ============================================================
   电解池 · 电势标尺
   Canvas 绘制 + 交互绑定
   ============================================================ */
(function () {
  "use strict";

  var E = window.Echem;
  var IONS = E.IONS;
  var state = E.state;

  var $ = function (s, r) { return (r || document).querySelector(s); };

  var canvas = $("#stage");
  var ctx = canvas.getContext("2d");
  var wrap = canvas.parentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var W = 0, H = 0, DPR = 1;
  var DATA = [];
  var particles = [];
  var activePreset = "textbook";
  var rafId = 0;

  var SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';
  var MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

  var COL = {
    ink: "#1f3550",
    muted: "#7d90a6",
    faint: "#9aacbf",
    grid: "#e5eef8",
    axis: "#c8d9e9",
    glass: "#cad9e8",
    liquidTop: "#ebf6ff",
    liquidBottom: "#cfe4f7",
    surface: "#a9cbe8",
    cathode: "#c9702f",
    anode: "#2f9e6b",
    gold: "#e69a00",
    wire: "#b9c7d8"
  };

  /* ---------- 小工具 ---------- */
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  function hexA(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
  }

  function rr(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  }

  /* ============================================================
     布局
     ============================================================ */
  function layout() {
    var stacked = W < 700;
    if (!stacked) {
      var cw = clamp(W * 0.255, 168, 244);
      return {
        stacked: false,
        cell: { x: 24, top: 58, w: cw, h: H - 118 },
        scale: { x0: 24 + cw + 54, x1: W - 16, top: 56, bot: H - 46 }
      };
    }
    var cw2 = Math.min(W * 0.62, 220);
    return {
      stacked: true,
      cell: { x: (W - cw2) / 2, top: 48, w: cw2, h: 178 },
      scale: { x0: 52, x1: W - 12, top: 292, bot: H - 40 }
    };
  }

  /* ============================================================
     尺寸
     ============================================================ */
  function resize() {
    var w = Math.max(260, wrap.clientWidth);
    wrap.classList.toggle("is-stacked", w < 700);
    var h = Math.max(300, wrap.clientHeight);
    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    W = w;
    H = h;
    DPR = dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildParticles();
    draw(performance.now());
  }

  function buildParticles() {
    particles = [];
    if (!W) return;
    var c = layout().cell;
    var top = c.top + 58;
    var bottom = c.top + c.h - 20;
    if (bottom - top < 16) return;

    IONS.forEach(function (ion) {
      var count = ion.side === "cathode" ? 4 : 3;
      for (var k = 0; k < count; k++) {
        particles.push({
          ion: ion,
          x: c.x + 16 + Math.random() * (c.w - 32),
          y: top + Math.random() * (bottom - top),
          ph: Math.random() * Math.PI * 2,
          r: 2.6 + Math.random() * 1.2
        });
      }
    });
  }

  /* ============================================================
     绘制主入口
     ============================================================ */
  function draw(t) {
    if (!W) return;
    var L = layout();

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#fbfdff");
    bg.addColorStop(1, "#f3faff");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    drawCell(L, t || 0);
    drawScale(L);
  }

  /* ---------- 电解池 ---------- */
  function drawCell(L, t) {
    var c = L.cell;
    if (c.h < 70) return;

    var cathX = c.x + c.w * 0.3;
    var anodX = c.x + c.w * 0.7;
    var eTop = c.top + 28;
    var eBot = c.top + c.h - 26;
    var solTop = c.top + 48;
    var bottomY = c.top + c.h;
    var wireY = c.top - 24;
    var midX = c.x + c.w / 2;

    /* 导线 */
    ctx.save();
    ctx.strokeStyle = COL.wire;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cathX, eTop);
    ctx.lineTo(cathX, wireY);
    ctx.lineTo(midX - 6, wireY);
    ctx.moveTo(midX + 6, wireY);
    ctx.lineTo(anodX, wireY);
    ctx.lineTo(anodX, eTop);
    ctx.stroke();

    /* 电子：从阳极经电源流向阴极 */
    var path = [
      [anodX, wireY], [midX + 6, wireY], [midX - 6, wireY], [cathX, wireY], [cathX, eTop]
    ];
    var segs = [], total = 0;
    for (var i = 1; i < path.length; i++) {
      var len = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
      segs.push({ a: path[i - 1], b: path[i], len: len, start: total });
      total += len;
    }
    var phase = reduceMotion ? 0.35 : ((t / 2600) % 1);
    for (var k = 0; k < 3; k++) {
      var s = ((phase + k / 3) % 1) * total;
      var pt = null;
      for (var j = 0; j < segs.length; j++) {
        if (s <= segs[j].start + segs[j].len) {
          var f = (s - segs[j].start) / segs[j].len;
          pt = [
            segs[j].a[0] + (segs[j].b[0] - segs[j].a[0]) * f,
            segs[j].a[1] + (segs[j].b[1] - segs[j].a[1]) * f
          ];
          break;
        }
      }
      if (!pt) continue;
      ctx.beginPath();
      ctx.arc(pt[0], pt[1], 2.4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(74,126,205,0.75)";
      ctx.fill();
    }

    /* 电源符号：左负极（短），右正极（长） */
    ctx.strokeStyle = "#8b9cb0";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(midX - 5, wireY - 7);
    ctx.lineTo(midX - 5, wireY + 7);
    ctx.moveTo(midX + 5, wireY - 12);
    ctx.lineTo(midX + 5, wireY + 12);
    ctx.stroke();
    ctx.restore();

    /* 烧杯 */
    ctx.save();
    rr(ctx, c.x, c.top, c.w, c.h, 14);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = COL.glass;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    /* 溶液 */
    rr(ctx, c.x, c.top, c.w, c.h, 14);
    ctx.clip();
    var lg = ctx.createLinearGradient(0, solTop, 0, bottomY);
    lg.addColorStop(0, COL.liquidTop);
    lg.addColorStop(1, COL.liquidBottom);
    ctx.fillStyle = lg;
    ctx.fillRect(c.x, solTop, c.w, bottomY - solTop);

    /* 液面 */
    ctx.beginPath();
    ctx.moveTo(c.x, solTop);
    ctx.lineTo(c.x + c.w, solTop);
    ctx.strokeStyle = COL.surface;
    ctx.lineWidth = 1.4;
    ctx.stroke();

    /* 离子 */
    var tt = reduceMotion ? 0 : t / 1000;
    particles.forEach(function (p) {
      var px = p.x + Math.sin(tt * 0.8 + p.ph) * 5;
      var py = p.y + Math.cos(tt * 1.05 + p.ph) * 4;
      ctx.beginPath();
      ctx.arc(px, py, p.r, 0, Math.PI * 2);
      ctx.fillStyle = hexA(p.ion.color, 0.82);
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.stroke();
    });
    ctx.restore();

    /* 电极 */
    drawElectrode(cathX, eTop, eBot, COL.cathode);
    drawElectrode(anodX, eTop, eBot, COL.anode);

    /* 电极标签 */
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "650 11.5px " + SANS;
    ctx.fillStyle = COL.cathode;
    ctx.fillText("阴极 −", cathX, bottomY + 17);
    ctx.fillStyle = COL.anode;
    ctx.fillText("阳极 +", anodX, bottomY + 17);

    /* 电子方向 */
    ctx.font = "10px " + MONO;
    ctx.fillStyle = "rgba(110,135,160,0.85)";
    ctx.textAlign = "center";
    ctx.fillText("e⁻ →", cathX, solTop + 14);
    ctx.fillText("← e⁻", anodX, solTop + 14);
  }

  function drawElectrode(x, top, bottom, color) {
    var h = bottom - top;
    if (h < 20) return;
    ctx.save();
    rr(ctx, x - 6.5, top, 13, h, 4);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.38)";
    rr(ctx, x - 3, top + 5, 2.6, h - 10, 1.3);
    ctx.fill();
    ctx.restore();
  }

  /* ---------- 电势标尺 ---------- */
  function drawScale(L) {
    var s = L.scale;
    var x0 = s.x0, x1 = s.x1, top = s.top, bot = s.bot;
    if (x1 - x0 < 110 || bot - top < 120 || !DATA.length) return;

    var labelW = 96;
    var xLbl = x1 - labelW;
    var xEnd = xLbl - 12;
    var xStart = x0 + 24;

    /* 值域 */
    var lo = Infinity, hi = -Infinity;
    DATA.forEach(function (d) {
      lo = Math.min(lo, d.Eeq, d.Eact);
      hi = Math.max(hi, d.Eeq, d.Eact);
    });
    lo -= 0.14;
    hi += 0.14;
    var span = hi - lo;
    var step = span > 2.5 ? 0.4 : 0.2;
    lo = Math.floor(lo / step) * step;
    hi = Math.ceil(hi / step) * step;
    if (hi - lo < 1.2) {
      var mid = (hi + lo) / 2;
      lo = Math.floor((mid - 0.6) / step) * step;
      hi = Math.ceil((mid + 0.6) / step) * step;
    }

    var yOf = function (v) { return bot - (v - lo) / (hi - lo) * (bot - top); };

    /* 标题 */
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = "600 11px " + SANS;
    ctx.fillStyle = COL.faint;
    ctx.fillText("电势 φ / V（vs SHE）", x0, top - 24);

    /* 网格与刻度 */
    ctx.font = "10.5px " + MONO;
    ctx.textAlign = "right";
    var steps = Math.round((hi - lo) / step);
    for (var i = 0; i <= steps; i++) {
      var v = lo + i * step;
      var y = yOf(v);
      ctx.strokeStyle = COL.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
      ctx.stroke();

      ctx.strokeStyle = COL.axis;
      ctx.beginPath();
      ctx.moveTo(x0 - 4, y);
      ctx.lineTo(x0, y);
      ctx.stroke();

      ctx.fillStyle = COL.muted;
      var txt = Math.abs(v) < 1e-9 ? "0" : (v > 0 ? "+" : "\u2212") + Math.abs(v).toFixed(1);
      ctx.fillText(txt, x0 - 9, y);
    }

    /* 纵轴 */
    ctx.strokeStyle = COL.axis;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x0, top - 6);
    ctx.lineTo(x0, bot + 6);
    ctx.stroke();

    /* 各电对 */
    var items = DATA.map(function (d) {
      return { d: d, yTrue: yOf(d.Eact), y: yOf(d.Eact), yEq: yOf(d.Eeq) };
    }).sort(function (a, b) { return a.yTrue - b.yTrue; });

    var gap = 34;
    for (var n = 1; n < items.length; n++) {
      if (items[n].y - items[n - 1].y < gap) items[n].y = items[n - 1].y + gap;
    }
    var overflow = items[items.length - 1].y - (bot - 8);
    if (overflow > 0) {
      items[items.length - 1].y = bot - 8;
      for (var m = items.length - 2; m >= 0; m--) {
        if (items[m + 1].y - items[m].y < gap) items[m].y = items[m + 1].y - gap;
      }
    }
    if (items[0].y < top + 10) {
      items[0].y = top + 10;
      for (var q = 1; q < items.length; q++) {
        if (items[q].y - items[q - 1].y < gap) items[q].y = items[q - 1].y + gap;
      }
    }

    /* 极化棒：平衡 → 实际 */
    items.forEach(function (it) {
      if (it.d.Eta < 0.002) return;
      ctx.save();
      ctx.strokeStyle = hexA(it.d.color, 0.26);
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x0 + 9, it.yEq);
      ctx.lineTo(x0 + 9, it.yTrue);
      ctx.stroke();
      ctx.restore();
    });

    /* 平衡电势虚线 */
    items.forEach(function (it) {
      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = hexA(it.d.color, 0.5);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(xStart, it.yEq);
      ctx.lineTo(xEnd, it.yEq);
      ctx.stroke();
      ctx.restore();
    });

    /* 实际析出电势实线 */
    items.forEach(function (it) {
      ctx.strokeStyle = it.d.color;
      ctx.lineWidth = 2.6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(xStart, it.yTrue);
      ctx.lineTo(xEnd, it.yTrue);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(xStart, it.yTrue, 3, 0, Math.PI * 2);
      ctx.fillStyle = it.d.color;
      ctx.fill();
    });

    /* 标签 + 引线 */
    var firstCath = null, firstAnod = null;
    DATA.forEach(function (d) {
      if (d.side === "cathode" && (!firstCath || d.Eact > firstCath.Eact)) firstCath = d;
      if (d.side === "anode" && (!firstAnod || d.Eact < firstAnod.Eact)) firstAnod = d;
    });

    items.forEach(function (it) {
      var d = it.d;
      var y = it.y;
      var isFirst = d === firstCath || d === firstAnod;

      ctx.strokeStyle = hexA(d.color, 0.35);
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (Math.abs(y - it.yTrue) > 0.6) {
        ctx.moveTo(xEnd, it.yTrue);
        ctx.lineTo(xEnd + 7, y);
      } else {
        ctx.moveTo(xEnd, y);
      }
      ctx.lineTo(xLbl - 5, y);
      ctx.stroke();

      if (isFirst) {
        ctx.font = "10px " + SANS;
        ctx.fillStyle = COL.gold;
        ctx.textAlign = "left";
        ctx.fillText("★", xLbl, y - 7);
      }

      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.font = "650 12px " + SANS;
      ctx.fillStyle = d.color;
      ctx.fillText(d.name, xLbl + 13, y - 7);

      ctx.font = "10.5px " + MONO;
      ctx.fillStyle = "#5f748b";
      ctx.fillText(E.fmt(d.Eact) + " V", xLbl + 13, y + 8);
    });

    /* 底部提示 */
    ctx.font = "10px " + SANS;
    ctx.fillStyle = COL.faint;
    ctx.textAlign = "left";
    ctx.fillText("★ 该侧最先析出", x0, bot + 20);
  }

  /* ============================================================
     界面
     ============================================================ */
  function buildChips() {
    $("#chips").innerHTML = IONS.map(function (ion) {
      return '<span class="chip"><i class="dot" style="background:' + ion.color + '"></i>' +
        ion.name + "</span>";
    }).join("");
  }

  function buildPresets() {    var row = $("#presetRow");
    E.PRESETS.forEach(function (p) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "chip-btn";
      b.textContent = p.label;
      b.title = p.hint;
      b.dataset.preset = p.id;
      b.setAttribute("aria-pressed", p.id === activePreset ? "true" : "false");
      row.appendChild(b);
    });

    row.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-preset]");
      if (!btn) return;
      E.applyPreset(btn.dataset.preset);
      activePreset = btn.dataset.preset;
      syncPresets();
      refresh();
    });
  }

  function syncPresets() {
    Array.prototype.forEach.call(document.querySelectorAll("#presetRow button"), function (b) {
      b.setAttribute("aria-pressed", b.dataset.preset === activePreset ? "true" : "false");
    });
  }

  function buildConcSliders() {
    var host = $("#concSliders");
    IONS.forEach(function (ion) {
      var d = document.createElement("div");
      d.className = "slider";
      d.innerHTML =
        '<div class="lab"><i class="dot" style="background:' + ion.color + '"></i>' +
        '<span class="nm">' + ion.name + "</span>" +
        '<span class="val" id="cv-' + ion.id + '"></span></div>' +
        '<input class="rng" type="range" id="cs-' + ion.id + '" min="0" max="100" step="1" ' +
        'style="--c:' + ion.color + '" aria-label="' + ion.name + ' 浓度">';
      host.appendChild(d);

      var el = d.querySelector("input");
      el.value = E.concToSlider(state.conc[ion.id]);
      el.addEventListener("input", function () {
        state.conc[ion.id] = E.sliderToConc(+el.value);
        markCustom();
        refresh();
      });
    });
  }

  function markCustom() {
    if (activePreset === null) return;
    activePreset = null;
    syncPresets();
  }

  function updateSliderUI() {
    IONS.forEach(function (ion) {
      var el = $("#cs-" + ion.id);
      var val = E.concToSlider(state.conc[ion.id]);
      if (el) {
        el.value = val;
        el.style.setProperty("--p", val + "%");
      }
      var out = $("#cv-" + ion.id);
      if (out) out.textContent = E.fmtConc(state.conc[ion.id]) + " mol/L";
    });

    var ec = $("#etaC"), ea = $("#etaA");
    var disabled = state.polar !== "electrochem";
    [ec, ea].forEach(function (el) {
      el.disabled = disabled;
      if (el === ec) el.value = state.etaC;
      else el.value = state.etaA;
    });
    ec.style.setProperty("--p", (state.etaC / 0.6 * 100) + "%");
    ea.style.setProperty("--p", (state.etaA / 0.6 * 100) + "%");
    $("#etaCVal").textContent = state.etaC.toFixed(2) + " V";
    $("#etaAVal").textContent = state.etaA.toFixed(2) + " V";

    Array.prototype.forEach.call(document.querySelectorAll("#polarSeg button"), function (b) {
      b.setAttribute("aria-pressed", b.dataset.polar === state.polar ? "true" : "false");
    });

    var note = $("#etaNote");
    if (state.polar === "none") {
      note.textContent = "无极化模式：η = 0，虚线（平衡）与实线（实际）完全重合，析出顺序只由平衡电势决定。";
    } else if (state.polar === "conc") {
      note.textContent = "浓差极化模式：η = (0.0592/n)·lg(c本体/c表面)，本模型以 −lg c 近似；溶液越稀，偏离越大。";
    } else {
      note.textContent = "电化学极化模式：超电势按电极侧统一施加，拖动滑块改变其大小；真实 η 还与电流密度、电极材料有关。";
    }
  }

  function renderResults() {
    var r = E.ranking();
    $("#cathodeList").innerHTML = r.cathode.map(rowHTML).join("");
    $("#anodeList").innerHTML = r.anode.map(rowHTML).join("");
  }

  function rowHTML(d, i) {
    return (
      '<div class="res-item' + (i === 0 ? " first" : "") + '">' +
      '<span class="rank">' + (i + 1) + "</span>" +
      '<span class="res-name">' + d.name + "</span>" +
      '<span class="res-flow"><span>' + E.fmt(d.Eeq) + "</span>" +
      '<span class="ar">→</span><span class="act">' + E.fmt(d.Eact) + " V</span></span>" +
      '<span class="tag tag-gold">先析出</span>' +
      "</div>"
    );
  }

  function updateInsight() {
    var d = E.decomposition();
    if (!d) return;
    var extra = "";
    if (state.polar === "none") {
      extra = " 当前为无极化状态，实线与虚线重合。";
    } else if (state.polar === "conc") {
      var minC = Math.min.apply(null, IONS.map(function (i) { return state.conc[i.id]; }));
      extra = minC <= 0.02
        ? " 稀溶液的浓差极化显著：阴极更难析出、阳极更易氧化，顺序因此可能改变。"
        : " 浓度较高时浓差极化较小，可尝试把浓度滑到最低。";
    } else {
      extra = " 超电势把阴极实线拉向更负、阳极实线拉向更正，所以实际槽电压高于理论分解电压。";
    }

    $("#insightText").innerHTML =
      "阴极 <b>" + d.cathode.name + "</b> 最先还原（φ = " + E.fmt(d.cathode.Eact) + " V），阳极 <b>" +
      d.anode.name + "</b> 最先氧化（φ = " + E.fmt(d.anode.Eact) + " V）；理论分解电压 U ≈ " +
      d.U.toFixed(2) + " V。" + extra;

    $("#rCath").innerHTML = d.cathode.name + "<em>" + E.fmt(d.cathode.Eact) + " V</em>";
    $("#rAnod").innerHTML = d.anode.name + "<em>" + E.fmt(d.anode.Eact) + " V</em>";
    $("#rU").innerHTML = d.U.toFixed(2) + "<em>V</em>";
  }

  function refresh() {
    DATA = E.computeAll();
    updateSliderUI();
    renderResults();
    updateInsight();
    if (W) draw(performance.now());
  }

  /* ============================================================
     交互
     ============================================================ */
  function bind() {
    $("#polarSeg").addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-polar]");
      if (!btn) return;
      state.polar = btn.dataset.polar;
      markCustom();
      refresh();
    });

    $("#etaC").addEventListener("input", function (e) {
      state.etaC = +e.target.value;
      markCustom();
      refresh();
    });

    $("#etaA").addEventListener("input", function (e) {
      state.etaA = +e.target.value;
      markCustom();
      refresh();
    });

    $("#resetBtn").addEventListener("click", function () {
      E.reset();
      activePreset = "textbook";
      syncPresets();
      refresh();
    });

    $("#saveBtn").addEventListener("click", exportPNG);

    $("#copyBtn").addEventListener("click", function () {
      var url = location.href.split("?")[0].split("#")[0] + "?" + E.serialize();
      var btn = this;
      var done = function () {
        btn.textContent = "已复制";
        setTimeout(function () { btn.textContent = "复制链接"; }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done).catch(function () {
          window.prompt("复制下面的链接：", url);
        });
      } else {
        window.prompt("复制下面的链接：", url);
      }
    });
  }

  function exportPNG() {
    var scale = 2;
    var tmp = document.createElement("canvas");
    tmp.width = Math.round(W * scale);
    tmp.height = Math.round(H * scale);
    var c2 = tmp.getContext("2d");
    c2.fillStyle = "#fbfdff";
    c2.fillRect(0, 0, tmp.width, tmp.height);
    c2.setTransform(scale, 0, 0, scale, 0, 0);
    c2.drawImage(canvas, 0, 0, W, H);

    c2.font = "11px " + SANS;
    c2.fillStyle = "#8a9cb0";
    c2.textAlign = "left";
    c2.textBaseline = "alphabetic";
    c2.fillText(
      "极化与析出电势 · " + modeLabel() + " · ηc = " + state.etaC.toFixed(2) +
      " V, ηa = " + state.etaA.toFixed(2) + " V",
      14, H - 12
    );

    var a = document.createElement("a");
    a.download = "极化与析出电势-" + stamp() + ".png";
    a.href = tmp.toDataURL("image/png");
    a.click();
  }

  function modeLabel() {
    return state.polar === "none" ? "无极化" : state.polar === "conc" ? "浓差极化" : "电化学极化";
  }

  function stamp() {
    var d = new Date();
    var p = function (n) { return String(n).padStart(2, "0"); };
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes());
  }

  /* ============================================================
     初始化
     ============================================================ */
  function init() {
    if (E.deserialize(location.search)) activePreset = null;

    buildChips();
    buildPresets();
    buildConcSliders();
    bind();
    refresh();
    resize();

    if (window.ResizeObserver) {
      new ResizeObserver(function () { resize(); }).observe(wrap);
    } else {
      window.addEventListener("resize", resize);
    }

    if (!reduceMotion) {
      var loop = function (t) {
        draw(t);
        rafId = requestAnimationFrame(loop);
      };
      rafId = requestAnimationFrame(loop);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
