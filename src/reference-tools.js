/* Reference-image workspace. All board edits use one undo checkpoint. */
var KanvazReferenceTools = (function() {
  var panel, sources, sourceTimer;
  if (!localStorage.getItem('reference-zero-gap-v1')) { localStorage.setItem('reference-gap', '0'); localStorage.setItem('reference-zero-gap-v1', '1'); }
  var gap = Number(localStorage.getItem('reference-gap') || 0);
  var source = localStorage.getItem('reference-size-source') || 'average';
  var preset = localStorage.getItem('reference-shortcuts') === 'on';
  function locked() {
    return (KanvazApp.isMoodLockActive && KanvazApp.isMoodLockActive()) || (KanvazApp.isPresentationModeActive && KanvazApp.isPresentationModeActive());
  }
  function images() {
    var ids = KanvazCards.getSelectedIds();
    if (!ids.length) ids = KanvazCards.getAllIds();
    return ids.map(function(id) { return KanvazCards.getAll()[id]; }).filter(function(c) { return c && !c.pinned && /^(image|gif)$/.test(c.type); });
  }
  function run(action) {
    if (locked()) { KanvazUI.toast('Exit the read-only view first'); return; }
    var cards = images(), edits = [];
    if (!cards.length) { KanvazUI.toast('No editable reference images'); return; }
    if (action === 'pack') edits = KanvazReferenceLayout.pack(cards, gap);
    else if (/^(width|height|longest)$/.test(action)) edits = KanvazReferenceLayout.normalize(cards, action, source);
    else if (action === 'gray') {
      var on = cards.some(function(c) { return !c.referenceGray; });
      edits = cards.map(function(c) { return {id:c.id, referenceGray:on, referenceSavedSaturate:on ? (c.referenceGray ? c.referenceSavedSaturate : c.adjustSaturate == null ? 100 : c.adjustSaturate) : (c.referenceSavedSaturate == null ? 100 : c.referenceSavedSaturate), adjustSaturate:on ? 0 : (c.referenceSavedSaturate == null ? 100 : c.referenceSavedSaturate)}; });
    } else if (action === 'reset') edits = cards.map(function(c) { return {id:c.id, referenceGray:false, adjustSaturate:100, adjustBrightness:100, adjustContrast:100, flipH:false, flipV:false}; });
    else if (action === 'size') edits = cards.map(function(c) {
      var w = c.naturalW || c.w, h = c.naturalH || c.h, scale = Math.max(1, 80 / w, 80 / h);
      return {id:c.id, w:w * scale, h:h * scale};
    });
    else if (action === 'flipH' || action === 'flipV') edits = cards.map(function(c) { var p = {id:c.id}; p[action] = !c[action]; return p; });
    KanvazCards.applyReferenceEdits(edits);
  }
  function el(tag, text, parent) {
    var e = document.createElement(tag);
    if (text) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function button(text, fn, parent) {
    var b = el('button', text, parent); b.type = 'button'; b.onclick = fn; return b;
  }
  function toggleView() {
    if (document.getElementById('startup-screen')) KanvazBoards.toggleHomeScreen();
    document.body.classList.toggle('reference-view');
    window.dispatchEvent(new Event('resize'));
  }
  function close() {
    if (panel) panel.remove(); panel = null;
    if (sourceTimer) clearInterval(sourceTimer); sourceTimer = null;
  }
  function sourceCards() {
    return Object.values(KanvazCards.getAll()).filter(function(c) { return /^(image|gif)$/.test(c.type); });
  }
  async function renderSources() {
    if (!sources || !sources.isConnected) return;
    var container = sources;
    var cards = sourceCards();
    var states = await KanvazBridge.liveImageStatus([...new Set(cards.map(function(c) { return c.path; }).filter(Boolean))]);
    if (!container.isConnected) return;
    var signature = JSON.stringify([states, cards.map(function(c) { return [c.id, c.name, c.path, KanvazLiveImages.isPaused(c.path), KanvazLiveImages.status(c)]; })]);
    if (container.dataset.signature === signature) return;
    container.dataset.signature = signature;
    container.replaceChildren();
    for (var c of cards) {
      var row = el('div', '', container); row.className = 'reference-source';
      var name = el('strong', c.name || c.id, row); name.setAttribute('data-user-content', 'true');
      var p = el('div', c.path || '', row); p.className = 'reference-path'; p.setAttribute('data-user-content', 'true');
      var state = states.find(function(s) { return s.path === c.path; });
      var sync = KanvazLiveImages.status(c);
      var syncLabel = sync.state === 'updated' ? 'Image up to date' : sync.state === 'error' ? 'Image update failed — retrying' : sync.state === 'loading' ? 'Updating image' : 'Waiting for stable file';
      el('span', !c.path ? 'Embedded image — no source path' : !state ? 'Source not checked (1000 path limit)' : !state.exists ? 'Source file missing' : KanvazLiveImages.isPaused(c.path) ? 'Sync paused' : state.size > 128 * 1024 * 1024 ? 'Source exceeds 128 MiB' : syncLabel, row);
      if (sync.time) { var stamp = el('div', '', row); el('span', 'Last successful update', stamp); var updated = el('time', new Date(sync.time).toLocaleTimeString(), stamp); updated.style.marginLeft = '6px'; updated.setAttribute('data-user-content','true'); }
      var controls = el('div', '', row);
      if (c.path) {
        (function(card) {
          button(KanvazLiveImages.isPaused(card.path) ? 'Resume sync' : 'Pause sync', function() { KanvazLiveImages.pause(card.path, !KanvazLiveImages.isPaused(card.path)); renderSources(); }, controls);
          button('Refresh image', function() { KanvazLiveImages.refresh([card.path]); }, controls);
          button('Reveal in Folder', function() { KanvazBridge.revealInFolder(card.path); }, controls);
        })(c);
      }
      (function(id) { button('Relink', function() { if (!locked()) KanvazCards.relinkImage(id); }, controls); })(c.id);
    }
    if (!cards.length) el('p', 'No reference images on this board', container);
  }
  async function relinkMissing() {
    if (locked()) return;
    var folder = await KanvazBridge.openSourceFolder();
    if (!folder) return;
    return relinkFromFolder(folder);
  }
  async function relinkFromFolder(folder) {
    if (!folder || locked()) return;
    var cards = sourceCards().filter(function(c) { return c.path; });
    var states = await KanvazBridge.liveImageStatus(cards.map(function(c) { return c.path; }));
    var updates = [];
    for (var c of cards) {
      if (states.some(function(s) { return s.path === c.path && s.exists; })) continue;
      var expectedPath = c.path;
      var p = folder.replace(/[\\/]$/, '') + '/' + expectedPath.split(/[\\/]/).pop();
      var result = await KanvazBridge.loadMedia(p);
      if (!result || !result.ok) continue;
      var img = new Image(); img.src = result.dataUrl;
      try { await img.decode(); } catch (_) { continue; }
      if (KanvazCards.getAll()[c.id] !== c || c.path !== expectedPath) continue;
      updates.push({id:c.id, expected:c, expectedPath:expectedPath, path:p, dataUrl:result.dataUrl, naturalW:img.naturalWidth, naturalH:img.naturalHeight});
    }
    if (!locked()) KanvazCards.relinkReferenceImages(updates);
    KanvazUI.toast('Relinked images: ' + updates.length);
    renderSources();
  }
  function inspectPixels() {
    var ids = KanvazCards.getSelectedIds();
    if (!ids.length) ids = KanvazCards.getAllIds();
    var card = ids.map(function(id) { return KanvazCards.getAll()[id]; }).find(function(c) { return c && /^(image|gif)$/.test(c.type) && c.dataUrl; });
    if (!card) return;
    close();
    panel = el('div', '', document.body); panel.id = 'reference-tools-overlay'; panel.setAttribute('role','dialog'); panel.setAttribute('aria-label','Original pixel inspection');
    var box = el('div','',panel); box.className='reference-tools-box';
    var head = el('div','',box); head.className='reference-tools-heading'; el('h2','Original pixel inspection',head); var closeButton=button('Close',close,head);
    el('p','Original pixels at 1:1. Scroll to inspect; this does not change the board layout.',box);
    var viewport=el('div','',box); viewport.className='original-pixel-viewport';
    var img=el('img','',viewport); img.alt=''; img.onload=function(){ var ratio=window.devicePixelRatio || 1; img.style.width=(img.naturalWidth / ratio)+'px'; img.style.height=(img.naturalHeight / ratio)+'px'; }; img.src=card.dataUrl;
    closeButton.focus();
  }
  function open() {
    if (panel) { close(); return; }
    panel = el('div', '', document.body); panel.id = 'reference-tools-overlay';
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Reference tools');
    var box = el('div', '', panel); box.className = 'reference-tools-box';
    panel.setAttribute('aria-modal', 'true');
    var header = el('div', '', box); header.className = 'reference-tools-heading';
    el('h2', 'Reference tools', header); button('Close', close, header);
    el('p', 'Selection applies first; without a selection, all unlocked images are used.', box);
    el('h3', 'Arrange and normalize', box);
    var settings = el('div', '', box); settings.className = 'reference-controls';
    var label = el('label', 'Image spacing (px)', settings);
    var input = el('input', '', label); input.type = 'number'; input.min = '0'; input.max = '500'; input.value = gap;
    input.onchange = function() { gap = Math.max(0, Math.min(500, Number(input.value) || 0)); input.value = gap; localStorage.setItem('reference-gap', gap); };
    var sizeLabel = el('label', 'Size source', settings), select = el('select', '', sizeLabel);
    for (var item of [['average','Average selected size'],['first','First selected image']]) { var option = el('option', item[1], select); option.value = item[0]; }
    select.value = source; select.onchange = function() { source = select.value; localStorage.setItem('reference-size-source', source); };
    var actions = el('div', '', box); actions.className = 'reference-controls';
    for (var item of [['width','Match width'],['height','Match height'],['longest','Match longest side'],['pack','Compact layout'],['gray','Toggle grayscale'],['flipH','Flip Horizontal'],['flipV','Flip Vertical'],['size','Restore pixel size'],['reset','Reset image appearance']]) {
      (function(a) { button(a[1], function() { run(a[0]); }, actions); })(item);
    }
    button('Inspect original pixels', inspectPixels, box);
    el('p', 'Sizes preserve proportions and respect the 80 px minimum. One action is one undo step.', box);
    button('Toggle reference view', toggleView, box);
    var shortcutsLabel = el('label', '', box); shortcutsLabel.className = 'reference-shortcut-toggle';
    var checkbox = el('input', '', shortcutsLabel); checkbox.type = 'checkbox'; checkbox.checked = preset;
    checkbox.onchange = function() { preset = checkbox.checked; localStorage.setItem('reference-shortcuts', preset ? 'on' : 'off'); };
    el('span', 'Use reference shortcut preset', shortcutsLabel);
    el('p', 'Ctrl+P: compact layout · Ctrl+Alt+Left/Right/Up: height/width/longest · Ctrl+Shift+G: grayscale · F8: reference view · F9: tools', box);
    el('h3', 'Source image management', box);
    var sourceActions = el('div', '', box); sourceActions.className = 'reference-controls';
    button('Refresh linked images', function() { KanvazLiveImages.refresh(sourceCards().map(function(c) { return c.path; }).filter(Boolean)); }, sourceActions);
    button('Relink missing images in folder', relinkMissing, sourceActions);
    el('p', 'Sync pause lasts for this session and applies to every image with the same path. Batch relink searches exact filenames in the chosen folder only.', box);
    sources = el('div', '', box); sources.className = 'reference-sources'; renderSources();
    sourceTimer = setInterval(renderSources, 2500);
    panel.addEventListener('click', function(e) { if (e.target === panel) close(); });
    header.querySelector('button').focus();
  }
  document.addEventListener('keydown', function(e) {
    var target = e.target;
    if (panel && e.key === 'Tab') {
      var focusable = Array.from(panel.querySelectorAll('button,input,select')).filter(function(x) { return !x.disabled; });
      var index = focusable.indexOf(document.activeElement);
      var next = index < 0 ? 0 : (index + (e.shiftKey ? -1 : 1) + focusable.length) % focusable.length;
      if (focusable[next]) focusable[next].focus();
      e.preventDefault(); e.stopImmediatePropagation(); return;
    }
    if (panel && e.key !== 'Escape' && e.key !== 'F8' && e.key !== 'F9') { e.stopImmediatePropagation(); return; }
    if (target && target.closest('input,textarea,select,[contenteditable="true"]')) return;
    if (e.repeat) return;
    if (e.key === 'Escape' && (panel || document.body.classList.contains('reference-view'))) {
      if (panel) close(); else toggleView(); e.preventDefault(); e.stopImmediatePropagation(); return;
    }
    if (e.key === 'F8' || e.key === 'F9') {
      if (e.key === 'F8') toggleView(); else open(); e.preventDefault(); e.stopImmediatePropagation(); return;
    }
    if (!preset || panel || document.getElementById('startup-screen') || document.querySelector('#dialog-overlay[style*="flex"]') || locked()) return;
    var ctrl = e.ctrlKey || e.metaKey, action;
    if (ctrl && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'p') action = 'pack';
    if (ctrl && e.altKey && !e.shiftKey) action = {'ArrowLeft':'height','ArrowRight':'width','ArrowUp':'longest'}[e.key];
    if (ctrl && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'g') action = 'gray';
    if (action) { run(action); e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  var launch = button('Reference tools', open, document.body); launch.id = 'reference-tools-launch'; launch.className = 'toolbar-btn'; launch.title = 'Reference tools (F9)';
  document.getElementById('toolbar').insertBefore(launch, document.getElementById('btn-account')); 
  var exit = button('Exit reference view (F8)', toggleView, document.body); exit.id = 'reference-view-exit';
  var simple = button('Full interface', function() { KanvazUI_Extended.updateSettings({simpleWorkspace:!document.body.classList.contains('simple-workspace')}); }, document.body);
  simple.id = 'simple-workspace-toggle'; simple.className = 'titlebar-btn';
  document.getElementById('titlebar-controls').insertBefore(simple, document.getElementById('btn-moodlock'));
  var quickImport = button('Import', function() { document.getElementById('btn-import').click(); }, document.body);
  quickImport.id = 'simple-workspace-import'; quickImport.className = 'titlebar-btn';
  document.getElementById('titlebar-controls').insertBefore(quickImport, simple);
  simple.textContent = document.body.classList.contains('simple-workspace') ? 'Full interface' : 'Simple interface';
  return {open:open, close:close, run:run, toggleView:toggleView, images:images, relinkMissing:relinkMissing, relinkFromFolder:relinkFromFolder};
})();
