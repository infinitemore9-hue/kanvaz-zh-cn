/* Geometry only: no DOM, no board mutation. */
var KanvazReferenceLayout = (function() {
  function normalize(cards, mode, source) {
    if (!cards.length) return [];
    var metric = function(c) { return mode === 'width' ? c.w : mode === 'height' ? c.h : Math.max(c.w, c.h); };
    var target = source === 'first' ? metric(cards[0]) : cards.reduce(function(sum, c) { return sum + metric(c); }, 0) / cards.length;
    // Respect the application's 80px minimum without distorting aspect ratios.
    var minimum = 0;
    for (var c of cards) minimum = Math.max(minimum, metric(c) * Math.max(80 / c.w, 80 / c.h));
    target = Math.max(target, minimum);
    return cards.map(function(c) { var scale = target / metric(c); return {id:c.id, w:c.w * scale, h:c.h * scale}; });
  }
  function pack(cards, gap) {
    if (!cards.length) return [];
    gap = Math.max(0, Math.min(500, Number(gap) || 0));
    var sorted = cards.slice().sort(function(a,b) { return b.h - a.h || b.w - a.w || a.id.localeCompare(b.id); });
    var minX = Math.min.apply(null, cards.map(function(c) { return c.x; }));
    var minY = Math.min.apply(null, cards.map(function(c) { return c.y; }));
    var area = sorted.reduce(function(s,c) { return s + (c.w + gap) * (c.h + gap); }, 0);
    var widest = Math.max.apply(null, sorted.map(function(c) { return c.w; }));
    var best = null, bestScore = Infinity;
    // Try several shelf widths; retain the most compact, near-square layout.
    for (var factor of [0.75, 1, 1.25, 1.5, 1.8]) {
      var width = Math.max(widest, Math.sqrt(area) * factor), x = 0, y = 0, rowH = 0, usedW = 0, result = [];
      for (var c of sorted) {
        if (x > 0 && x + c.w > width) { x = 0; y += rowH + gap; rowH = 0; }
        result.push({id:c.id, x:minX + x, y:minY + y});
        usedW = Math.max(usedW, x + c.w); rowH = Math.max(rowH, c.h); x += c.w + gap;
      }
      var height = y + rowH;
      var score = usedW * height * (1 + Math.abs(Math.log(usedW / height)) * 0.15);
      if (score < bestScore) { bestScore = score; best = result; }
    }
    return best;
  }
  return {normalize:normalize, pack:pack};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = KanvazReferenceLayout;
