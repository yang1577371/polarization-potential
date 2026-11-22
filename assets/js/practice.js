/* ============================================================
   练习页：排序闯关 / 概念自测 / 随机计算
   ============================================================ */
(function () {
  "use strict";

  var E = window.Echem;
  var state = E.state;

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  /* ============================================================
     一、排序闯关
     ============================================================ */
  var order = { cathode: [], anode: [] };
  var checked = false;

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function correctOrder(side) {
    var r = E.ranking();
    return (side === "cathode" ? r.cathode : r.anode).map(function (d) { return d.id; });
  }

  function sameOrder(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  function buildGame() {
    order.cathode = shuffle(E.IONS.filter(function (i) { return i.side === "cathode"; }).map(function (i) { return i.id; }));
    order.anode = shuffle(E.IONS.filter(function (i) { return i.side === "anode"; }).map(function (i) { return i.id; }));
    if (sameOrder(order.cathode, correctOrder("cathode"))) order.cathode.reverse();
    if (sameOrder(order.anode, correctOrder("anode"))) order.anode.reverse();
    checked = false;
    var fb = $("#gameFb");
    fb.textContent = "";
    fb.className = "game-fb";
    renderGame();
  }

  function renderGame() {
    ["cathode", "anode"].forEach(function (side) {
      var box = $(side === "cathode" ? "#sortCathode" : "#sortAnode");
      var cor = correctOrder(side);
      var list = order[side];
      box.innerHTML = list.map(function (id, idx) {
        var ion = E.ION_BY_ID[id];
        var cls = "game-item";
        if (checked) cls += cor[idx] === id ? " ok" : " bad";
        return '<div class="' + cls + '">' +
          '<span class="idx">' + (idx + 1) + "</span>" +
          '<span class="nm">' + ion.name + "</span>" +
          '<span class="mvs">' +
          '<button class="mv" type="button" data-side="' + side + '" data-i="' + idx + '" data-dir="-1"' +
          ' aria-label="上移 ' + ion.name + '"' + (idx === 0 ? " disabled" : "") + ">↑</button>" +
          '<button class="mv" type="button" data-side="' + side + '" data-i="' + idx + '" data-dir="1"' +
          ' aria-label="下移 ' + ion.name + '"' + (idx === list.length - 1 ? " disabled" : "") + ">↓</button>" +
          "</span></div>";
      }).join("");
    });
  }

  function moveItem(side, i, dir) {
    var arr = order[side];
    var j = i + dir;
    if (j < 0 || j >= arr.length) return;
    var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    checked = false;
    var fb = $("#gameFb");
    fb.textContent = "";
    fb.className = "game-fb";
    renderGame();
  }

  function gameAnswerText() {
    var r = E.ranking();
    var line = function (list, side) {
      return list.map(function (d, i) {
        return (i + 1) + ". " + d.name + "（" + E.fmt(d.Eact) + " V）";
      }).join("　");
    };
    return "正确顺序 —— 阴极：" + line(r.cathode, "cathode") + "；阳极：" + line(r.anode, "anode") + "。";
  }

  function submitGame() {
    checked = true;
    renderGame();
    var okC = sameOrder(order.cathode, correctOrder("cathode"));
    var okA = sameOrder(order.anode, correctOrder("anode"));
    var fb = $("#gameFb");
    if (okC && okA) {
      fb.className = "game-fb ok";
      fb.textContent = "✓ 完全正确。阴极挑最正的，阳极挑最负的 —— 你比较的正是实际析出电势。";
    } else {
      var wrong = 0;
      ["cathode", "anode"].forEach(function (side) {
        var cor = correctOrder(side);
        order[side].forEach(function (id, i) { if (cor[i] !== id) wrong++; });
      });
      fb.className = "game-fb no";
      fb.textContent = "✗ 有 " + wrong + " 个位置不对。提示：阴极越正越先析出，阳极越负越先氧化。";
    }
  }

  function revealGame() {
    checked = true;
    renderGame();
    var fb = $("#gameFb");
    fb.className = "game-fb";
    fb.textContent = gameAnswerText();
  }

  function condText() {
    var mode = state.polar === "none" ? "无极化" : state.polar === "conc" ? "浓差极化" : "电化学极化";
    var parts = E.IONS.map(function (i) {
      return i.name + " " + E.fmtConc(state.conc[i.id]);
    }).join("、");
    var eta = state.polar === "conc"
      ? "η 由浓度推算"
      : state.polar === "none"
        ? "η = 0"
        : "η<sub>c</sub> = η<sub>a</sub> = " + state.etaC.toFixed(2) + " V";
    return "当前条件：" + mode + "；" + parts + " mol/L；" + eta + "。";
  }

  function setCondition(id) {
    E.applyPreset(id);
    $$("#condRow button").forEach(function (b) {
      b.setAttribute("aria-pressed", b.dataset.cond === id ? "true" : "false");
    });
    $("#condLine").innerHTML = condText();
    buildGame();
  }

  /* ============================================================
     二、概念自测
     ============================================================ */
  function checkQuiz() {
    var correct = 0;
    var total = 0;
    $$(".quiz-q").forEach(function (q) {
      total++;
      var ans = q.dataset.answer;
      var sel = q.querySelector("input:checked");
      var chosen = sel ? sel.value : null;
      var fb = q.querySelector(".fb");

      Array.prototype.forEach.call(q.querySelectorAll(".opt"), function (o) {
        o.classList.remove("correct", "wrong");
        var v = o.querySelector("input").value;
        if (v === ans) o.classList.add("correct");
        else if (v === chosen) o.classList.add("wrong");
      });

      fb.classList.add("show");
      if (chosen === ans) {
        correct++;
        fb.className = "fb show ok";
        fb.textContent = fb.dataset.ok;
      } else {
        fb.className = "fb show no";
        fb.textContent = (chosen ? "" : "未作答。") + fb.dataset.no;
      }
    });

    var score = $("#quizScore");
    score.textContent = correct + " / " + total;
    score.className = "score-pill " + (correct === total ? "ok" : "no");
  }

  function resetQuiz() {
    $$(".quiz-q").forEach(function (q) {
      Array.prototype.forEach.call(q.querySelectorAll("input"), function (i) { i.checked = false; });
      Array.prototype.forEach.call(q.querySelectorAll(".opt"), function (o) { o.classList.remove("correct", "wrong"); });
      var fb = q.querySelector(".fb");
      fb.classList.remove("show", "ok", "no");
      fb.textContent = "";
    });
    var score = $("#quizScore");
    score.textContent = "— / 7";
    score.className = "score-pill";
  }

  /* ============================================================
     三、随机计算
     ============================================================ */
  var CU_CONC = [0.01, 0.02, 0.05, 0.1];
  var CL_CONC = [0.05, 0.1, 0.2, 0.5];
  var ETAS = [0.05, 0.1, 0.15, 0.2];
  var TOL = 0.008;

  var calc = { cu: { c: 0.01, eta: 0.1 }, cl: { c: 0.1, eta: 0.1 } };

  function eqOf(id, c) {
    var ion = E.ION_BY_ID[id];
    return ion.E0 + ion.sign * (0.0592 / ion.n) * Math.log10(c);
  }

  function actOf(id, c, eta) {
    var ion = E.ION_BY_ID[id];
    return eqOf(id, c) + (ion.side === "cathode" ? -eta : eta);
  }

  function num(v, d) {
    return (v < 0 ? "\u2212" : "") + Math.abs(v).toFixed(d === undefined ? 3 : d);
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function newData() {
    var prevCu = calc.cu.c + "|" + calc.cu.eta;
    var prevCl = calc.cl.c + "|" + calc.cl.eta;
    var guard = 0;
    do {
      calc.cu = { c: pick(CU_CONC), eta: pick(ETAS) };
      guard++;
    } while (calc.cu.c + "|" + calc.cu.eta === prevCu && guard < 10);
    guard = 0;
    do {
      calc.cl = { c: pick(CL_CONC), eta: pick(ETAS) };
      guard++;
    } while (calc.cl.c + "|" + calc.cl.eta === prevCl && guard < 10);

    renderCalc();
  }

  function renderCalc() {
    var cuEq = eqOf("Cu", calc.cu.c);
    var cuPhi = actOf("Cu", calc.cu.c, calc.cu.eta);
    var clEq = eqOf("Cl", calc.cl.c);
    var clPhi = actOf("Cl", calc.cl.c, calc.cl.eta);

    $("#cuConc").textContent = calc.cu.c.toFixed(3);
    $("#cuEta").textContent = calc.cu.eta.toFixed(2);
    $("#clConc").textContent = calc.cl.c.toFixed(3);
    $("#clEta").textContent = calc.cl.eta.toFixed(2);

    $("#cuSol").innerHTML =
      "<div>E<sub>平</sub> = 0.34 + (0.0592 / 2) · lg(" + calc.cu.c.toFixed(3) + ") = " + num(cuEq) + " V</div>" +
      "<div>φ<sub>c</sub> = E<sub>平</sub> − η<sub>c</sub> = " + num(cuEq) + " − " + calc.cu.eta.toFixed(2) + " = " + num(cuPhi) + " V</div>" +
      '<div class="muted" style="margin-top:4px">n = 2，所以系数是 0.0592 / 2 = 0.0296；阴极取减号。</div>';

    $("#clSol").innerHTML =
      "<div>E<sub>平</sub> = 1.36 − 0.0592 · lg(" + calc.cl.c.toFixed(3) + ") = " + num(clEq) + " V</div>" +
      "<div>φ<sub>a</sub> = E<sub>平</sub> + η<sub>a</sub> = " + num(clEq) + " + " + calc.cl.eta.toFixed(2) + " = " + num(clPhi) + " V</div>" +
      '<div class="muted" style="margin-top:4px">Cl⁻ 是还原态，浓度越高平衡电势越低；阳极取加号。</div>';

    ["cuEq", "cuPhi", "clEq", "clPhi"].forEach(function (id) {
      var el = $("#" + id);
      el.value = "";
      el.classList.remove("ok", "no");
    });
    ["cuFb", "clFb"].forEach(function (id) {
      var el = $("#" + id);
      el.className = "calc-fb";
      el.textContent = "";
    });
    var main = $("#calcFb");
    main.textContent = "";
    main.className = "game-fb";
  }

  function readVal(id) {
    var el = $("#" + id);
    return parseFloat(el.value.replace(/\u2212/g, "-").replace(/,/g, "").trim());
  }

  function checkPair(prefix, eq, phi, label) {
    var eqEl = $("#" + prefix + "Eq");
    var phiEl = $("#" + prefix + "Phi");
    var fb = $("#" + prefix + "Fb");
    var eqV = readVal(prefix + "Eq");
    var phiV = readVal(prefix + "Phi");
    var okEq = isFinite(eqV) && Math.abs(eqV - eq) <= TOL;
    var okPhi = isFinite(phiV) && Math.abs(phiV - phi) <= TOL;

    eqEl.classList.toggle("ok", okEq);
    eqEl.classList.toggle("no", !okEq && isFinite(eqV));
    phiEl.classList.toggle("ok", okPhi);
    phiEl.classList.toggle("no", !okPhi && isFinite(phiV));

    var score = (okEq ? 1 : 0) + (okPhi ? 1 : 0);
    fb.classList.add("show");
    if (score === 2) {
      fb.className = "calc-fb show ok";
      fb.textContent = "✓ " + label + " 两个空都正确。";
    } else {
      fb.className = "calc-fb show no";
      fb.textContent = "参考答案：E平 = " + num(eq) + " V，φ = " + num(phi) + " V。" +
        (isFinite(eqV) || isFinite(phiV) ? "" : "（还没有填写）");
    }
    return score;
  }

  function checkCalc() {
    var eqCu = eqOf("Cu", calc.cu.c);
    var phiCu = actOf("Cu", calc.cu.c, calc.cu.eta);
    var eqCl = eqOf("Cl", calc.cl.c);
    var phiCl = actOf("Cl", calc.cl.c, calc.cl.eta);

    var s1 = checkPair("cu", eqCu, phiCu, "① 铜电对");
    var s2 = checkPair("cl", eqCl, phiCl, "② 氯电对");
    var total = s1 + s2;
    var main = $("#calcFb");
    main.className = "game-fb " + (total === 4 ? "ok" : "no");
    main.textContent = total === 4
      ? "✓ 4 / 4 全部正确。注意铜用减号、氯用加号 —— 方向不要记反。"
      : total + " / 4 个空正确，看看右侧步骤再试一次。";
  }

  /* ============================================================
     绑定与初始化
     ============================================================ */
  document.addEventListener("click", function (e) {
    var mv = e.target.closest(".mv");
    if (mv) {
      moveItem(mv.dataset.side, +mv.dataset.i, +mv.dataset.dir);
      return;
    }
    var cond = e.target.closest("#condRow button");
    if (cond) setCondition(cond.dataset.cond);
  });

  $("#submitGame").addEventListener("click", submitGame);
  $("#revealGame").addEventListener("click", revealGame);
  $("#reshuffle").addEventListener("click", function () {
    buildGame();
  });

  $("#checkQuiz").addEventListener("click", checkQuiz);
  $("#resetQuiz").addEventListener("click", resetQuiz);

  $("#checkCalc").addEventListener("click", checkCalc);
  $("#newData").addEventListener("click", newData);

  // 初始化
  E.applyPreset("textbook");
  $("#condLine").innerHTML = condText();
  buildGame();
  newData();
})();
