/* Stable-path monitoring. Failed reads/decodes are retried, old pixels stay visible. */
(function() {
  var applied = new WeakMap(), busy = false, paused = new Set(), force = new Set(), statuses = new WeakMap();
  window.KanvazLiveImages = {
    status: function(card) { var value = statuses.get(card); return value && value.path === card.path ? value : {state:'waiting',time:null}; },
    isPaused: function(path) { return paused.has(path); },
    pause: function(path, flag) { if (flag) paused.add(path); else paused.delete(path); },
    refresh: function(paths) { for (var p of paths) force.add(p); return poll(); }
  };
  async function poll() {
    if (busy || typeof KanvazCards === 'undefined') return;
    busy = true;
    try {
      var cards = Object.values(KanvazCards.getAll()).filter(function(c) { return /^(image|gif)$/.test(c.type) && c.path; });
      var ready = await KanvazBridge.scanLiveImages([...new Set(cards.map(function(c) { return c.path; }))]);
      for (var linked of cards) {
        var previous = statuses.get(linked);
        if (previous && previous.path === linked.path && previous.state === 'updated' && !ready.some(function(r) { return r.path === linked.path; })) statuses.set(linked, {path:linked.path,state:'waiting',time:previous.time});
      }
      for (var item of ready) {
        if (paused.has(item.path) && !force.has(item.path)) continue;
        var targets = cards.filter(function(c) { return c.path === item.path && (force.has(item.path) || applied.get(c) !== item.token); });
        if (!targets.length) continue;
        for (var target of targets) statuses.set(target, {path:item.path,state:'loading',time:(statuses.get(target) || {}).time || null});
        var result = await KanvazBridge.loadMedia(item.path);
        if (!result || !result.ok) { for (var target of targets) statuses.set(target, {path:item.path,state:'error',time:(statuses.get(target) || {}).time || null}); continue; }
        var image = new Image();
        image.src = result.dataUrl;
        try { await image.decode(); } catch (_) { for (var target of targets) statuses.set(target, {path:item.path,state:'error',time:(statuses.get(target) || {}).time || null}); continue; }
        // A second sample rejects writes that continued during the read/decode.
        var after = await KanvazBridge.scanLiveImages(cards.map(function(c) { return c.path; }));
        if (!after.some(function(x) { return x.path === item.path && x.token === item.token; })) {
          for (var target of targets) statuses.set(target, {path:item.path,state:'waiting',time:(statuses.get(target) || {}).time || null});
          continue;
        }
        for (var c of targets) {
          if (KanvazCards.getAll()[c.id] !== c || c.path !== item.path) continue;
          KanvazCards.refreshLinkedImage(c.id, result.dataUrl, image.naturalWidth, image.naturalHeight);
          applied.set(c, item.token);
          statuses.set(c, {path:item.path,state:'updated',time:Date.now()});
        }
        force.delete(item.path);
      }
    } catch (e) { console.warn('[Live images]', e.message); }
    finally { busy = false; }
  }
  setInterval(poll, 1000);
  window.addEventListener('focus', poll);
})();
