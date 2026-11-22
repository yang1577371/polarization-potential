/* 目录滚动高亮 */
(function () {
  "use strict";
  var links = Array.prototype.slice.call(document.querySelectorAll(".toc a"));
  if (!links.length) return;

  var items = links.map(function (a) {
    return { a: a, el: document.getElementById(a.getAttribute("href").slice(1)) };
  }).filter(function (x) { return x.el; });

  if (!items.length) return;

  function update() {
    var y = 130;
    var current = items[0];
    items.forEach(function (it) {
      if (it.el.getBoundingClientRect().top <= y) current = it;
    });
    links.forEach(function (a) {
      a.classList.toggle("active", a === current.a);
    });
  }

  var ticking = false;
  window.addEventListener("scroll", function () {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      update();
      ticking = false;
    });
  }, { passive: true });

  update();
})();
