(function () {
  'use strict';

  var doc = document;
  var win = window;
  var INSTANCE_KEY = '__uStudioV7';
  if (win.__uStudioV6 && typeof win.__uStudioV6.close === 'function') { try { win.__uStudioV6.close(); } catch (previousV6Error) {} }
  if (win.__uStudioV5 && typeof win.__uStudioV5.close === 'function') { try { win.__uStudioV5.close(); } catch (previousV5Error) {} }
  if (win.__uStudioV4 && typeof win.__uStudioV4.close === 'function') { try { win.__uStudioV4.close(); } catch (previousV4Error) {} }

  // 旧版が残っている場合は可能な範囲で終了する。
  if (win.__uStudioV3 && typeof win.__uStudioV3.close === 'function') { try { win.__uStudioV3.close(); } catch (previousV3Error) {} }
  if (win.__uStudioV2 && typeof win.__uStudioV2.close === 'function') {
    try { win.__uStudioV2.close(); } catch (previousVersionError) {}
  }
  if (win.__uStudio && typeof win.__uStudio.close === 'function') {
    try { win.__uStudio.close(); } catch (legacyCloseError) {}
  }
  // The very first legacy build used anonymous document listeners that cannot be detached.
  if (typeof win.__u === 'function' && doc.getElementById('__u_studio')) {
    console.warn('[Ultra Modder] 旧版が動作中です。ページを再読み込みしてから3.0を起動してください。');
    return;
  }

  if (win[INSTANCE_KEY] && typeof win[INSTANCE_KEY].toggle === 'function') {
    win[INSTANCE_KEY].toggle();
    return;
  }
  try {
    if (win !== win.top) {
      console.warn('[Ultra Modder] 最上位のページで実行してください。');
      return;
    }
  } catch (error) {
    console.warn('[Ultra Modder] このページ領域では実行できません。');
    return;
  }
  if (!doc.documentElement || !doc.body) {
    console.warn('[Ultra Modder] 本文領域のないページには対応していません。');
    return;
  }

  var hiddenByStudio = new Set();

  var state = {
    mode: 'none',
    theme: 'dark',
    editing: false,
    minimized: false,
    dark: false,
    outlines: false,
    selected: null,
    multiSelected: [],
    attributeTarget: null,
    savedRange: null,
    visualDrag: null,
    resizeDrag: null,
    resizeEnabled: false,
    ignoreNextClick: false,
    previewOpen: false,
    compareOpen: false,
    locked: new Set(),
    autoBackupEnabled: true,
    autoBackupObserver: null,
    autoBackupTimer: null,
    autoBackupLastAt: 0,
    lastUserEditAt: 0,
    mobileStyleNode: null,
    dialog: null,
    pendingFile: null,
    drag: null,
    history: [],
    future: [],
    gridSnap: 0,
    canvasZoom: 100,
    canvasZoomChanged: false,
    originalBodyEditable: {
      had: doc.body.hasAttribute('contenteditable'),
      value: doc.body.getAttribute('contenteditable')
    },
    originalBodySpellcheck: {
      had: doc.body.hasAttribute('spellcheck'),
      value: doc.body.getAttribute('spellcheck')
    },
    originalBodyZoom: { value: doc.body.style.getPropertyValue('zoom'), priority: doc.body.style.getPropertyPriority('zoom') }
  };

  var host = doc.createElement('div');
  host.setAttribute('data-u-studio-v2-host', '');
  host.setAttribute('data-u-studio-v7-host', '');
  host.setAttribute('aria-label', 'Ultra Modder 7.0');
  host.style.cssText = [
    'all:initial', 'display:block', 'position:fixed', 'top:14px', 'right:14px', 'left:auto',
    'z-index:2147483647', 'width:390px', 'max-width:calc(100vw - 20px)',
    'box-sizing:border-box', 'font-family:Arial,"Hiragino Sans","Yu Gothic UI",Meiryo,sans-serif',
    'font-size:12px', 'line-height:1.45', 'user-select:none', 'isolation:isolate',
    'overflow:visible', 'pointer-events:auto'
  ].join(';');
  var shadow = host.attachShadow({ mode: 'closed' });

  function make(tag, text, className) {
    var node = doc.createElement(tag);
    if (text !== undefined && text !== null) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function append(parent, child) { parent.appendChild(child); return child; }
  function setStatus(message) { status.textContent = message; }

  var style = make('style');
  style.textContent = [
    ':host{--bg:#171923;--fg:#f8fafc;--muted:#aab2c5;--line:rgba(255,255,255,.13);--btn:rgba(255,255,255,.09);--accent:#818cf8;color:var(--fg);font-family:Arial,"Hiragino Sans","Yu Gothic UI",Meiryo,sans-serif;font-size:12px;line-height:1.45}',
    '*,*::before,*::after{box-sizing:border-box}',
    '.panel{width:100%;max-height:min(82vh,720px);display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--line);border-radius:13px;background:var(--bg);color:var(--fg);box-shadow:0 10px 36px rgba(0,0,0,.32);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}',
    '.header{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 10px;border-bottom:1px solid var(--line);font-weight:800;cursor:move;touch-action:none;flex:none}',
    '.brand{display:flex;align-items:center;gap:7px;min-width:0}.brand-title{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.version{font-size:9px;color:var(--muted);font-weight:600}',
    '.header-actions{display:flex;gap:4px;flex:none}',
    'button{font:inherit;color:inherit;cursor:pointer;border:1px solid var(--line);border-radius:7px;background:var(--btn);padding:7px 8px;line-height:1.25;touch-action:manipulation}',
    'button:hover:not(:disabled){filter:brightness(1.16)}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--accent);outline-offset:2px}button:disabled{cursor:not-allowed;opacity:.38}',
    '.icon-btn{padding:3px 7px;background:transparent;border-color:transparent;font-weight:800}',
    '.tabs{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));border-bottom:1px solid var(--line);flex:none}.tab{border:0;border-radius:0;background:transparent;padding:8px 2px;font-weight:800;opacity:.58}.tab[aria-selected="true"]{opacity:1;color:var(--accent);border-bottom:2px solid var(--accent)}',
    '.pages{padding:9px;overflow:auto;min-height:0}.page{display:none}.page.active{display:block}',
    '.section-title{font-size:11px;color:var(--muted);font-weight:800;margin:4px 0 7px}.hint{color:var(--muted);font-size:10px;line-height:1.5;margin:5px 0 8px}',
    '.wide{width:100%;display:flex;justify-content:flex-start;align-items:center;gap:7px;text-align:left;margin:0 0 6px;font-weight:700}',
    '.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;margin:6px 0}.grid button{padding:8px 3px;font-weight:800}',
    '.two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.three{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}',
    '.mode.active{color:white!important;border-color:transparent}.mode[data-mode="select"].active{background:#2563eb!important}.mode[data-mode="delete"].active{background:#dc2626!important}.mode[data-mode="replace"].active{background:#7c3aed!important}.mode[data-mode="add"].active{background:#059669!important}.mode[data-mode="visual-move"].active{background:#0d9488!important}',
    '.edit-toggle.active{background:#059669!important;color:white!important}',
    '.row{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:6px 0;padding:6px 7px;border:1px solid var(--line);border-radius:7px;background:rgba(127,127,127,.07)}.row label{font-weight:700}',
    '.field-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin:7px 0}.field{display:flex;flex-direction:column;gap:4px;min-width:0}.field label{font-size:10px;font-weight:800;color:var(--muted)}.field input,.field select,.field textarea{width:100%;min-width:0;padding:7px;border:1px solid var(--line);border-radius:6px;background:rgba(127,127,127,.12);color:var(--fg);font:inherit;user-select:text}.field textarea{resize:vertical;min-height:58px}.field input[type=color]{height:31px;padding:2px;cursor:pointer}',
    '.info{padding:8px;border:1px solid var(--line);border-radius:8px;background:rgba(127,127,127,.07);overflow-wrap:anywhere;margin:6px 0}.tag{font-weight:900;color:#a5b4fc}.crumbs{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0}.crumbs button{padding:4px 6px;font-size:10px}',
    '.history{max-height:130px;overflow:auto;margin:6px 0;padding:0;list-style:none}.history li{padding:4px 6px;border-bottom:1px solid var(--line);font-size:10px;color:var(--muted)}',
    '.status{padding:7px 9px;border-top:1px solid var(--line);color:var(--muted);font-size:10px;min-height:31px;max-height:52px;overflow:auto;overflow-wrap:anywhere;flex:none}',
    '.dialog{position:absolute;inset:0;z-index:20;display:flex;flex-direction:column;gap:8px;padding:12px;background:var(--bg);color:var(--fg);overflow:auto}.dialog-title{font-weight:900;font-size:13px}.dialog-actions{display:flex;gap:6px;margin-top:auto}.dialog-actions button{flex:1;font-weight:800}.primary{background:#4f46e5!important;color:white!important}.secondary{background:rgba(127,127,127,.18)}',
    '.hidden-file{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}',
    '.target-outline{position:fixed;display:none;pointer-events:none;z-index:3;border:2px solid #f59e0b;background:rgba(245,158,11,.08);border-radius:2px;box-shadow:0 0 0 1px rgba(0,0,0,.35)}.selected-outline{border-color:#22c55e;background:rgba(34,197,94,.07);border-style:solid}',
    '.resize-grip{position:fixed;display:none;z-index:8;width:18px;height:18px;border:2px solid #fff;border-radius:4px;background:#16a34a;color:#fff;font-size:12px;font-weight:900;line-height:14px;text-align:center;cursor:nwse-resize;touch-action:none;box-shadow:0 1px 5px rgba(0,0,0,.45)}',
    '.dom-tree{max-height:52vh;overflow:auto;border:1px solid var(--line);border-radius:8px;padding:6px;background:rgba(127,127,127,.05);font-size:11px}',
    '.tree-entry{margin:2px 0;padding-left:10px;border-left:1px solid var(--line)}.tree-entry.dragging{opacity:.35}.tree-entry.drop-before{border-top:2px solid #38bdf8}.tree-entry.drop-after{border-bottom:2px solid #38bdf8}.guide-line{position:fixed;z-index:10;display:none;pointer-events:none;background:#06b6d4;box-shadow:0 0 0 1px rgba(6,182,212,.25)}.guide-line.v{top:0;bottom:0;width:1px}.guide-line.h{left:0;right:0;height:1px}.distance-guide{position:fixed;z-index:11;display:none;pointer-events:none;padding:4px 7px;border-radius:5px;background:#0f172a;color:#f8fafc;border:1px solid #38bdf8;font:700 10px/1.3 Arial,sans-serif;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.35)}.layer-actions{display:flex;gap:4px;padding:0 4px 3px 12px}.layer-actions button{font-size:9px;padding:3px 5px}.layer-state{color:var(--muted);font-size:9px;margin-left:4px}.manager-list{display:flex;flex-direction:column;gap:6px;margin:7px 0}.manager-item{padding:8px;border:1px solid var(--line);border-radius:8px;background:rgba(127,127,127,.06)}.manager-item-head{font-weight:800;overflow-wrap:anywhere}.manager-item-meta{font-size:10px;color:var(--muted);margin:3px 0 6px}.manager-item-actions{display:flex;gap:4px;flex-wrap:wrap}.manager-item-actions button{font-size:10px;padding:5px 7px}.compare-layer{position:fixed;inset:0;z-index:31;display:none;align-items:center;justify-content:center;padding:2vh 2vw;background:rgba(0,0,0,.84)}.compare-shell{width:96vw;height:96vh;display:flex;flex-direction:column;gap:8px;padding:10px;border:1px solid var(--line);border-radius:12px;background:var(--bg);color:var(--fg)}.compare-panes{display:grid;grid-template-columns:1fr 1fr;gap:8px;flex:1;min-height:0}.compare-pane{display:flex;flex-direction:column;gap:5px;min-width:0;min-height:0}.compare-pane strong{font-size:11px}.compare-pane iframe{width:100%;flex:1;min-height:0;border:0;background:#fff}.compare-actions{display:flex;gap:5px;flex-wrap:wrap}.compare-actions button{padding:6px 9px}.lock-badge{color:#fbbf24}.mobile-fields{border:1px dashed var(--line);border-radius:8px;padding:8px;margin-top:8px}.small-note{font-size:10px;color:var(--muted);margin:4px 0}.layer-actions button[data-action="lock"]{color:#fbbf24}.tree-entry>summary{cursor:pointer;list-style:disclosure-closed;padding:4px 5px;border-radius:5px;overflow-wrap:anywhere}.tree-entry[open]>summary{list-style:disclosure-open}.tree-entry>summary:hover{background:var(--btn)}.tree-entry>summary.selected{background:rgba(34,197,94,.16);outline:1px solid rgba(34,197,94,.45);color:var(--fg)}.tree-entry>summary.multi{box-shadow:inset 3px 0 #38bdf8}.tree-entry>summary.search-hit{color:#fbbf24;font-weight:900}.tree-muted{color:var(--muted);font-size:10px;padding:4px 8px}.search-tools{display:flex;gap:5px;align-items:center;margin:5px 0}.search-tools input{flex:1;min-width:0;padding:7px;border:1px solid var(--line);border-radius:6px;background:rgba(127,127,127,.12);color:var(--fg);font:inherit;user-select:text}.preset-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;margin:6px 0}.mini-count{font-size:10px;color:var(--muted);padding:3px 2px}.group-name-row{display:flex;gap:5px;margin:6px 0}.group-name-row input,.history-search{flex:1;min-width:0;padding:7px;border:1px solid var(--line);border-radius:6px;background:rgba(127,127,127,.12);color:var(--fg);font:inherit;user-select:text}.control-caption{font-size:10px;color:var(--muted);margin:5px 0 2px}.zoom-row{display:flex;align-items:center;gap:8px;margin:8px 0;padding:8px;border:1px solid var(--line);border-radius:7px}.zoom-row input{flex:1;min-width:0}.distance-guide{font-variant-numeric:tabular-nums}',
    '.preview-layer{position:fixed;inset:0;z-index:30;display:none;align-items:center;justify-content:center;padding:2vh 2vw;background:rgba(0,0,0,.78);backdrop-filter:blur(5px)}.preview-shell{width:96vw;height:96vh;display:flex;flex-direction:column;gap:8px;padding:10px;border:1px solid var(--line);border-radius:12px;background:var(--bg);color:var(--fg);box-shadow:0 18px 60px rgba(0,0,0,.5)}.preview-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}.preview-buttons{display:flex;gap:5px;flex-wrap:wrap}.preview-buttons button{padding:6px 9px}.preview-canvas{flex:1;min-height:0;overflow:auto;display:flex;justify-content:center;align-items:flex-start;padding:10px;background:#30343d;border-radius:8px}.preview-frame{display:block;height:100%;min-height:320px;max-width:none;border:0;background:#fff;box-shadow:0 2px 18px rgba(0,0,0,.45)}.preview-caption{font-size:10px;color:var(--muted)}',
    '.footer-actions{display:flex;gap:5px;margin-top:6px}.footer-actions button{flex:1}',
    '@media(max-width:420px){.pages{max-height:58vh}.tab{font-size:9px;padding-left:0;padding-right:0}.header{padding:8px}.compare-panes{grid-template-columns:1fr;grid-template-rows:1fr 1fr}.compare-shell{height:98vh;width:98vw;padding:6px}}'
  ].join('\n');
  shadow.appendChild(style);

  var panel = append(shadow, make('section', null, 'panel'));
  var header = append(panel, make('header', null, 'header'));
  var brand = append(header, make('div', null, 'brand'));
  append(brand, make('span', '⚡'));
  append(brand, make('span', 'Ultra Modder', 'brand-title'));
  append(brand, make('span', '7.0', 'version'));
  var headerActions = append(header, make('div', null, 'header-actions'));
  var headerUndoBtn = append(headerActions, make('button', '↶', 'icon-btn'));
  headerUndoBtn.type = 'button'; headerUndoBtn.title = '元に戻す'; headerUndoBtn.setAttribute('aria-label', '元に戻す');
  headerUndoBtn.addEventListener('click', function () { undo(); });
  var headerRedoBtn = append(headerActions, make('button', '↷', 'icon-btn'));
  headerRedoBtn.type = 'button'; headerRedoBtn.title = 'やり直す'; headerRedoBtn.setAttribute('aria-label', 'やり直す');
  headerRedoBtn.addEventListener('click', function () { redo(); });
  var minimizeBtn = append(headerActions, make('button', '−', 'icon-btn'));
  minimizeBtn.type = 'button'; minimizeBtn.setAttribute('aria-label', '最小化');
  var closeBtn = append(headerActions, make('button', '✕', 'icon-btn'));
  closeBtn.type = 'button'; closeBtn.setAttribute('aria-label', '終了');

  var content = append(panel, make('div'));
  var tabs = append(content, make('nav', null, 'tabs'));
  var pageWrap = append(content, make('div', null, 'pages'));
  var tabNames = ['編集', 'レイヤー', '見た目', '操作', '表示', '管理'];
  var tabButtons = [];
  var pages = [];
  tabNames.forEach(function (name, index) {
    var tab = append(tabs, make('button', name, 'tab'));
    tab.type = 'button';
    tab.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
    tab.addEventListener('click', function () { selectTab(index); });
    tabButtons.push(tab);
    pages.push(append(pageWrap, make('div', null, 'page' + (index === 0 ? ' active' : ''))));
  });
  var status = append(panel, make('div', '準備完了。Escキーで操作解除、Ctrl+Zキーで元に戻す、Ctrl+Yキーでやり直せます。', 'status'));
  var hoverBox = append(shadow, make('div', null, 'target-outline'));
  var selectedBox = append(shadow, make('div', null, 'target-outline selected-outline'));
  var resizeGrip = append(shadow, make('div', '↘', 'resize-grip'));
  var fileInput = append(shadow, make('input'));
  fileInput.type = 'file'; fileInput.accept = 'image/*'; fileInput.multiple = true; fileInput.className = 'hidden-file';

  function selectTab(index) {
    tabButtons.forEach(function (button, i) { button.setAttribute('aria-selected', i === index ? 'true' : 'false'); });
    pages.forEach(function (page, i) { page.classList.toggle('active', i === index); });
    if (index === 1) refreshTree();
    if (index === 2) refreshInspector();
    if (index === 5) { refreshPageLibrary(); refreshStyleLibrary(); }
  }
  function button(parent, label, fn, className, aria) {
    var b = append(parent, make('button', label, className === undefined ? 'wide' : className));
    b.type = 'button';
    if (aria) b.setAttribute('aria-label', aria);
    b.addEventListener('mousedown', function (event) { event.preventDefault(); });
    b.addEventListener('click', fn);
    return b;
  }
  function inputField(parent, labelText, type, value, placeholder) {
    var wrap = append(parent, make('div', null, 'field'));
    var label = append(wrap, make('label', labelText));
    var input = append(wrap, make('input'));
    input.type = type || 'text'; input.value = value || ''; input.placeholder = placeholder || '';
    label.appendChild(input);
    return input;
  }
  function theme(themeName) {
    state.theme = themeName;
    var themes = {
      dark: { bg: '#171923', fg: '#f8fafc', muted: '#aab2c5', line: 'rgba(255,255,255,.13)', btn: 'rgba(255,255,255,.09)', accent: '#a5b4fc' },
      light: { bg: 'rgba(255,255,255,.98)', fg: '#111827', muted: '#596273', line: 'rgba(0,0,0,.15)', btn: 'rgba(0,0,0,.055)', accent: '#4f46e5' },
      ghost: { bg: 'rgba(24,24,30,0.0000005)', fg: '#fff', muted: 'rgba(255,255,255,.78)', line: 'rgba(255,255,255,.24)', btn: 'rgba(255,255,255,.14)', accent: '#a5b4fc' }
    };
    var p = themes[themeName] || themes.dark;
    Object.keys(p).forEach(function (key) { host.style.setProperty('--' + key, p[key]); });
  }

  // ----- History: one action can always be undone and redone. -----
  var undoBtn, redoBtn, historyList, historySearch, historyCount;
  function refreshHistory() {
    if (undoBtn) undoBtn.disabled = state.history.length === 0;
    if (redoBtn) redoBtn.disabled = state.future.length === 0;
    if (headerUndoBtn) headerUndoBtn.disabled = state.history.length === 0;
    if (headerRedoBtn) headerRedoBtn.disabled = state.future.length === 0;
    if (!historyList) return;
    historyList.textContent = '';
    var query = String(historySearch && historySearch.value || '').trim().toLowerCase();
    var all = state.history.map(function(item, index){ return {item:item,index:index}; });
    var matches = all.filter(function(entry){ return !query || String(entry.item.label || '').toLowerCase().indexOf(query) >= 0; });
    var shown = query ? matches.slice(-100).reverse() : matches.slice(-8).reverse();
    if (historyCount) historyCount.textContent = query ? matches.length + '件の履歴が一致しました。' : '直近8件を表示中（保存上限100件）';
    shown.forEach(function (entry) {
      var row = append(historyList, make('li'));
      button(row, '↶ ' + entry.item.label, function () {
        var targetIndex = state.history.indexOf(entry.item);
        if (targetIndex < 0) return setStatus('この履歴はすでに変更されています。');
        while (state.history.length > targetIndex) undo();
        setStatus('「' + entry.item.label + '」の直前まで戻しました。');
      }, 'wide').title = 'この操作と、それ以降の操作を元に戻します';
    });
    if (!state.history.length) append(historyList, make('li', '操作履歴はまだありません。'));
    else if (!matches.length) append(historyList, make('li', '一致する操作履歴がありません。'));
  }
  function pushAction(label, undoFn, redoFn) {
    state.lastUserEditAt = Date.now();
    scheduleAutoBackup();
    state.history.push({ label: label, undo: undoFn, redo: redoFn });
    if (state.history.length > 100) state.history.shift();
    state.future.length = 0;
    refreshHistory();
    if (treeContainer) markTreeSelection();
  }
  function undo() {
    var item = state.history.pop();
    if (!item) return setStatus('戻せる操作がありません。');
    try { item.undo(); state.future.push(item); setStatus('元に戻しました：' + item.label); }
    catch (error) { setStatus('元に戻せませんでした: ' + error.message); }
    refreshHistory(); refreshInspector(); updateSelectedOutline(); if (treeContainer) refreshTree();
  }
  function redo() {
    var item = state.future.pop();
    if (!item) return setStatus('やり直せる操作がありません。');
    try { item.redo(); state.history.push(item); setStatus('やり直しました：' + item.label); }
    catch (error) { setStatus('やり直せませんでした: ' + error.message); }
    refreshHistory(); refreshInspector(); updateSelectedOutline(); if (treeContainer) refreshTree();
  }
  function snapshotStyle(element) { return element.getAttribute('style'); }
  function restoreStyle(element, value) { if (value === null) element.removeAttribute('style'); else element.setAttribute('style', value); }

  // ----- 編集ページ -----
  var editPage = pages[0];
  var editToggle = button(editPage, '✏️ 文章編集：無効', function () { setEditing(!state.editing); }, 'wide edit-toggle');
  var zoomRow = append(editPage, make('div', null, 'zoom-row'));
  append(zoomRow, make('label', '作業領域ズーム'));
  var zoomSlider = append(zoomRow, make('input'));
  zoomSlider.type = 'range'; zoomSlider.min = '50'; zoomSlider.max = '150'; zoomSlider.step = '10'; zoomSlider.value = '100';
  var zoomValue = append(zoomRow, make('strong', '100%'));
  zoomSlider.addEventListener('input', function(){
    var value = Math.max(50,Math.min(150,parseInt(zoomSlider.value,10)||100));
    state.canvasZoom=value; state.canvasZoomChanged=true; zoomValue.textContent=value+'%';
    doc.body.style.setProperty('zoom',value+'%'); updateSelectedOutline();
  });
  button(editPage, '100%に戻す', function(){ zoomSlider.value='100'; zoomSlider.dispatchEvent(new Event('input')); }, 'wide');
  append(editPage, make('div', 'ページ本体の表示倍率を変更します。編集パネルの倍率は変わりません。終了時に元の倍率へ戻します。', 'hint'));
  var highlightRow = append(editPage, make('div', null, 'row'));
  append(highlightRow, make('label', 'ハイライト色'));
  var highlightColor = append(highlightRow, make('input'));
  highlightColor.type = 'color'; highlightColor.value = '#ffff00'; highlightColor.setAttribute('aria-label', 'ハイライト色');
  var formatGrid = append(editPage, make('div', null, 'grid'));
  function currentRange() {
    var selection = win.getSelection();
    if (!selection || !selection.rangeCount || selection.isCollapsed) return null;
    var range = selection.getRangeAt(0);
    if (!doc.body.contains(range.commonAncestorContainer) || host.contains(range.commonAncestorContainer)) return null;
    return range.cloneRange();
  }
  function restoreRange(range) {
    try { var selection = win.getSelection(); selection.removeAllRanges(); selection.addRange(range); return true; }
    catch (error) { return false; }
  }
  function format(command, value) {
    var range = currentRange() || state.savedRange;
    if (!range) return setStatus('先にページ本文の文字を選択してください。');
    var rangeElement=range.commonAncestorContainer.nodeType===1?range.commonAncestorContainer:range.commonAncestorContainer.parentElement;
    if (isLockedElement(rangeElement)) return setStatus('ロック中の要素は書式変更できません。');
    if (!state.editing) setEditing(true);
    if (!restoreRange(range)) return setStatus('選択範囲が失われました。もう一度選択してください。');
    try {
      doc.execCommand(command, false, value || null);
      setStatus('書式を適用しました。書式操作はブラウザー標準の元に戻す機能も利用できます。');
    } catch (error) { setStatus('書式を適用できませんでした: ' + error.message); }
  }
  [
    ['太字', '太字', function () { format('bold'); }],
    ['斜体', '斜体', function () { format('italic'); }],
    ['下線', '下線', function () { format('underline'); }],
    ['色', 'ハイライト', function () { format('hiliteColor', highlightColor.value); }],
    ['文字＋', '拡大', function () { format('increaseFontSize'); }],
    ['文字－', '縮小', function () { format('decreaseFontSize'); }],
    ['リンク', 'リンク', addLink],
    ['解除', '書式解除', function () { format('removeFormat'); }]
  ].forEach(function (item) { button(formatGrid, item[0], item[2], '', item[1]); });
  highlightColor.addEventListener('pointerdown', function () { state.savedRange = currentRange(); });
  highlightColor.addEventListener('change', function () { if (state.savedRange) format('hiliteColor', highlightColor.value); });
  append(editPage, make('div', '編集モード中はページ全体を直接編集できます。リンク遷移は止めます。', 'hint'));

  // ----- 構造ツリーと見た目編集 -----
  var treePage = pages[1];
  append(treePage, make('div', 'レイヤーパネル', 'section-title'));
  var treeControls = append(treePage, make('div', null, 'three'));
  button(treeControls, 'グループ化', groupSelectedElements, '');
  button(treeControls, 'グループ解除', ungroupSelectedElement, '');
  button(treeControls, '🔒 選択を一括ロック／解除', toggleBatchLock, '');
  var groupNameRow = append(treePage, make('div', null, 'group-name-row'));
  var groupNameInput = append(groupNameRow, make('input'));
  groupNameInput.type='text'; groupNameInput.placeholder='選択中グループの名前'; groupNameInput.setAttribute('aria-label','グループ名');
  button(groupNameRow, '名前を設定', renameSelectedGroup, '');
  var arrangeTitle = append(treePage, make('div', '複数要素の配置', 'section-title'));
  var distributeGrid = append(treePage, make('div', null, 'two'));
  button(distributeGrid, '↔ 横方向に均等配置', function(){ distributeSelected('x'); }, '');
  button(distributeGrid, '↕ 縦方向に均等配置', function(){ distributeSelected('y'); }, '');
  var alignGrid = append(treePage, make('div', null, 'three'));
  button(alignGrid, '左揃え', function(){ alignSelected('left'); }, '');
  button(alignGrid, '中央揃え', function(){ alignSelected('center'); }, '');
  button(alignGrid, '右揃え', function(){ alignSelected('right'); }, '');
  var gridRow = append(treePage, make('div', null, 'row'));
  append(gridRow, make('label', 'グリッド吸着'));
  var gridSelect = append(gridRow, make('select'));
  [['0','オフ'],['8','8px'],['16','16px']].forEach(function(option){var opt=append(gridSelect,make('option',option[1]));opt.value=option[0];});
  gridSelect.value='0'; gridSelect.addEventListener('change',function(){state.gridSnap=parseInt(gridSelect.value,10)||0;setStatus(state.gridSnap?state.gridSnap+'pxグリッド吸着を有効にしました。':'グリッド吸着を無効にしました。');});
  append(treePage, make('div', '整列・均等配置は、同じ親要素の中にある2個以上（均等配置は3個以上）の選択要素が対象です。', 'hint'));
  var treeContainer = append(treePage, make('div', null, 'dom-tree'));
  button(treeControls, '↻ ツリー更新', refreshTree, '');
  button(treeControls, 'すべて展開', function () { treeContainer.querySelectorAll('details').forEach(function (item) { item.open = true; }); }, '');
  button(treeControls, 'すべて折りたたむ', function () { treeContainer.querySelectorAll('details').forEach(function (item) { item.open = false; }); }, '');
  var treeSearch = append(treePage, make('input'));
  treeSearch.type = 'search'; treeSearch.placeholder = '要素を検索（例：#main、.card、画像、見出し）';
  treeSearch.setAttribute('aria-label', '要素を検索'); treeSearch.autocomplete = 'off';
  var treeSearchTools = append(treePage, make('div', null, 'search-tools'));
  treeSearchTools.appendChild(treeSearch);
  button(treeSearchTools, '消去', function () { treeSearch.value = ''; filterTree(); treeSearch.focus(); }, '');
  var treeSearchCount = append(treePage, make('div', '要素名・ID・クラス・表示テキストを検索できます。', 'mini-count'));
  treeSearch.addEventListener('input', filterTree);
  append(treePage, make('div', '行を選択すると見た目編集へ移動します。Ctrl／Shiftキーを押しながら選ぶと複数選択でき、選択した要素へまとめて色やサイズを適用できます。', 'hint'));

  var inspectPage = pages[2];
  var selectModeBtn = button(inspectPage, '🎯 ページ上で要素を選択', function () { setMode(state.mode === 'select' ? 'none' : 'select'); }, 'wide mode');
  var visualMoveBtn = button(inspectPage, '✥ 画面上でドラッグ配置：無効', function () { setMode(state.mode === 'visual-move' ? 'none' : 'visual-move'); }, 'wide mode');
  visualMoveBtn.dataset.mode = 'visual-move';
  var resizeToggleBtn = button(inspectPage, '↘ 大きさ変更ハンドル：無効', function () { state.resizeEnabled = !state.resizeEnabled; resizeToggleBtn.textContent = state.resizeEnabled ? '↘ 大きさ変更ハンドル：有効' : '↘ 大きさ変更ハンドル：無効'; updateSelectedOutline(); setStatus(state.resizeEnabled ? '選択枠の右下をドラッグして大きさを変更できます。' : '大きさ変更用のつまみを隠しました。'); }, 'wide');
  selectModeBtn.dataset.mode = 'select';
  var selectedInfo = append(inspectPage, make('div', 'まだ要素が選択されていません。', 'info'));
  var breadcrumb = append(inspectPage, make('div', null, 'crumbs'));
  var styleSection = append(inspectPage, make('div', '選択部分の見た目設定', 'section-title'));
  var styleGrid = append(inspectPage, make('div', null, 'field-grid'));
  var bgInput = inputField(styleGrid, '背景色', 'color', '#ffffff');
  var fgInput = inputField(styleGrid, '文字色', 'color', '#111111');
  var widthInput = inputField(styleGrid, '幅', 'text', '', '例: 300px / 80%');
  var heightInput = inputField(styleGrid, '高さ', 'text', '', '例: auto / 200px');
  var fontSizeInput = inputField(styleGrid, '文字サイズ（ピクセル）', 'number', '', '16');
  var radiusInput = inputField(styleGrid, '角丸（ピクセル）', 'number', '', '8');
  var paddingInput = inputField(styleGrid, '内側の余白（ピクセル）', 'number', '', '8');
  var marginInput = inputField(styleGrid, '外側の余白（ピクセル）', 'number', '', '8');
  var displaySelectWrap = append(inspectPage, make('div', null, 'field'));
  append(displaySelectWrap, make('label', '表示形式'));
  var displaySelect = append(displaySelectWrap, make('select'));
  [['','変更しない'],['block','ブロック'],['inline','行内'],['inline-block','行内ブロック'],['flex','柔軟な横並び'],['grid','格子状の配置'],['none','非表示']].forEach(function (item) { var option = append(displaySelect, make('option', item[1])); option.value = item[0]; });
  var positionWrap = append(inspectPage, make('div', null, 'field-grid'));
  var xInput = inputField(positionWrap, '横位置（px）', 'number', '', '0');
  var yInput = inputField(positionWrap, '縦位置（px）', 'number', '', '0');
  var positionSelectWrap = append(inspectPage, make('div', null, 'field'));
  append(positionSelectWrap, make('label', '配置方式'));
  var positionSelect = append(positionSelectWrap, make('select'));
  [['','変更しない'],['relative','通常配置を基準に移動'],['absolute','親領域を基準に配置'],['fixed','画面に固定'],['static','通常の配置に戻す']].forEach(function(item){var op=append(positionSelect,make('option',item[1]));op.value=item[0];});
  button(inspectPage, '🎨 スタイルを適用', applyInspectorStyles, 'wide');
  append(inspectPage, make('div', 'デザインひな形', 'section-title'));
  var presetGrid = append(inspectPage, make('div', null, 'preset-grid'));
  button(presetGrid, '🗂️ カード風', function () { applyStylePreset('card'); }, '');
  button(presetGrid, '🔘 ボタン風', function () { applyStylePreset('button'); }, '');
  button(presetGrid, '✨ 強調枠', function () { applyStylePreset('highlight'); }, '');
  button(presetGrid, '🧽 装飾を解除', function () { applyStylePreset('clear'); }, '');
  append(inspectPage, make('div', '文章・属性の編集', 'section-title'));
  var textField = append(inspectPage, make('div', null, 'field'));
  append(textField, make('label', 'テキスト（文字だけの要素に対応）'));
  var textEditor = append(textField, make('textarea'));
  textEditor.rows = 3; textEditor.placeholder = '文字だけの要素を選ぶと編集できます';
  button(inspectPage, '📝 テキストを変更', applySelectedText, 'wide');
  var attrGrid = append(inspectPage, make('div', null, 'field-grid'));
  var idInput = inputField(attrGrid, '要素ID', 'text', '', '例: main-title');
  var classInput = inputField(attrGrid, 'クラス名', 'text', '', '例: card primary');
  var titleInput = inputField(attrGrid, '補足タイトル', 'text', '', 'title属性');
  var altInput = inputField(attrGrid, '画像の代替テキスト', 'text', '', 'alt属性');
  var hrefInput = inputField(attrGrid, 'リンク先', 'text', '', 'https://example.com');
  button(inspectPage, '🏷️ 属性を適用', applySelectedAttributes, 'wide');
  button(inspectPage, '🖼️ 選択要素の画像を置換', replaceSelectedMedia, 'wide');
  button(inspectPage, '📋 選択部分の構造コードをコピー', copySelectedHTML, 'wide');
  button(inspectPage, '🎯 要素を指定する文字列をコピー', copySelectedSelector, 'wide');
  var quickActions = append(inspectPage, make('div', null, 'two'));
  button(quickActions, '🙈 表示・非表示', toggleSelectedVisibility, '');
  button(quickActions, '📄 複製', duplicateSelected, '');
  button(quickActions, '⬆️ 1つ上へ', moveSelectedUp, '');
  button(quickActions, '⬇️ 1つ下へ', moveSelectedDown, '');
  button(quickActions, '↰ 親要素を選択', selectParent, '');
  var lockButton = button(inspectPage, '🔒 選択要素をロック', function () { var el=selectedElement(); if(el) toggleElementLock(el); }, 'wide');
  button(inspectPage, '🔓 ページ内のロックをすべて解除', unlockAllElements, 'wide');
  button(inspectPage, '選択を解除', function () { state.selected = null; state.multiSelected = []; refreshInspector(); markTreeSelection(); updateSelectedOutline(); setStatus('選択を解除しました。'); }, 'wide');
  var mobileBox = append(inspectPage, make('div', null, 'mobile-fields'));
  append(mobileBox, make('div', '📱 スマートフォン専用の見た目', 'section-title'));
  append(mobileBox, make('div', '画面幅767px以下だけに適用されます。通常表示のデザインは変更しません。', 'small-note'));
  var mobileGrid = append(mobileBox, make('div', null, 'field-grid'));
  var mobileBgInput = inputField(mobileGrid, 'スマホ時の背景色', 'color', '#ffffff');
  var mobileFgInput = inputField(mobileGrid, 'スマホ時の文字色', 'color', '#111111');
  var mobileWidthInput = inputField(mobileGrid, 'スマホ時の幅', 'text', '', '例：100%');
  var mobileFontInput = inputField(mobileGrid, 'スマホ時の文字サイズ', 'number', '', '例：14');
  button(mobileBox, '📱 スマホ専用デザインを適用', applyMobileOverrides, 'wide');
  button(mobileBox, 'スマホ専用デザインを解除', clearMobileOverrides, 'wide');
  var selectionHint = append(inspectPage, make('div', '構造ツリーでCtrl／Shift+クリックすると複数選択できます。複数選択中は見た目・デザインひな形・表示切替をまとめて適用できます。Alt+↑で親要素、Alt+←／→で順番を変更できます。', 'hint'));
  button(inspectPage, '📍 選択枠を画面中央へ', function () { var el = selectedElement(); if (!el) return setStatus('先に要素を選択してください。'); el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }); updateSelectedOutline(); }, 'wide');

  function colorToHex(color) {
    var match = String(color || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!match) return '#ffffff';
    return '#' + [match[1], match[2], match[3]].map(function (n) { return Number(n).toString(16).padStart(2, '0'); }).join('');
  }
  function selectedElement() {
    if (state.selected && state.selected.isConnected && state.selected !== doc.documentElement && state.selected !== doc.body) return state.selected;
    return null;
  }
  function selectedElements() {
    var list = (state.multiSelected || []).filter(function (element) { return element && element.isConnected && element !== doc.documentElement && element !== doc.body && !host.contains(element); });
    if (selectedElement() && list.indexOf(state.selected) < 0) list.push(state.selected);
    return list.filter(function (element, index) { return list.indexOf(element) === index; });
  }
  var treeEntries = [];
  var layerDragElement = null;
  var guideV = make('div', null, 'guide-line v');
  var guideH = make('div', null, 'guide-line h');
  append(shadow, guideV); append(shadow, guideH);
  var distanceGuide = append(shadow, make('div', null, 'distance-guide'));
  function hideGuides(){ guideV.style.display='none'; guideH.style.display='none'; distanceGuide.style.display='none'; }

  function groupSelectedElements(){
    var items=selectedElements().filter(function(el){return !isLockedElement(el);});
    if(items.length<2) return setStatus('同じ親要素にある要素を2つ以上選択してください。');
    var parent=items[0].parentNode; if(items.some(function(el){return el.parentNode!==parent;})) return setStatus('グループ化する要素は同じ親の中から選んでください。');
    items.sort(function(a,b){return a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING?-1:1;});
    var wrapper=doc.createElement('div'); wrapper.setAttribute('data-u-studio-group',''); wrapper.style.display='contents';
    var first=items[0]; parent.insertBefore(wrapper,first); items.forEach(function(el){wrapper.appendChild(el);});
    pushAction('要素を'+items.length+'個グループ化',function(){while(wrapper.firstChild) parent.insertBefore(wrapper.firstChild,wrapper);wrapper.remove();},function(){if(!wrapper.isConnected)parent.insertBefore(wrapper,first);items.forEach(function(el){wrapper.appendChild(el);});});
    state.selected=wrapper; state.multiSelected=[wrapper]; refreshTree();refreshInspector();updateSelectedOutline();setStatus(items.length+'個の要素をグループ化しました。表示上の配置を保つためグループ枠は「内容のみ表示」です。');
  }
  function ungroupSelectedElement(){var el=selectedElement();if(!el||!el.hasAttribute('data-u-studio-group'))return setStatus('グループ化した要素を選択してください。');var parent=el.parentNode,next=el.nextSibling,children=Array.from(el.childNodes);children.forEach(function(n){parent.insertBefore(n,el);});el.remove();pushAction('グループを解除',function(){parent.insertBefore(el,next&&next.parentNode===parent?next:null);children.forEach(function(n){el.appendChild(n);});},function(){children.forEach(function(n){parent.insertBefore(n,el);});el.remove();});state.selected=children.find(function(n){return n.nodeType===1;})||null;state.multiSelected=state.selected?[state.selected]:[];refreshTree();refreshInspector();updateSelectedOutline();setStatus('グループを解除しました。');}
  function renameSelectedGroup(){
    var el=selectedElement();
    if(!el||!el.hasAttribute('data-u-studio-group')) return setStatus('名前を付けるグループを選択してください。');
    var before=el.getAttribute('data-u-studio-group-name');
    var after=String(groupNameInput.value||'').trim().slice(0,80);
    if(!after) return setStatus('グループ名を入力してください。');
    if(before===after) return setStatus('グループ名に変更はありません。');
    el.setAttribute('data-u-studio-group-name',after);
    pushAction('グループ名を「'+after+'」に変更',function(){if(before===null)el.removeAttribute('data-u-studio-group-name');else el.setAttribute('data-u-studio-group-name',before);},function(){el.setAttribute('data-u-studio-group-name',after);});
    refreshTree();setStatus('グループ名を「'+after+'」に変更しました。');
  }
  function toggleBatchLock(){
    var items=selectedElements().filter(function(el){return !protectedElement(el);});
    if(!items.length) return setStatus('一括ロックする要素を複数選択してください。');
    var before=items.map(function(el){return {el:el,locked:state.locked.has(el)||el.hasAttribute('data-u-studio-locked')};});
    var lockAll=before.some(function(item){return !item.locked;});
    function apply(value){before.forEach(function(item){if(value){state.locked.add(item.el);item.el.setAttribute('data-u-studio-locked','');}else{state.locked.delete(item.el);item.el.removeAttribute('data-u-studio-locked');}});refreshTree();refreshInspector();markTreeSelection();}
    apply(lockAll);
    pushAction(items.length+'個の要素を'+(lockAll?'一括ロック':'一括解除'),function(){before.forEach(function(item){if(item.locked){state.locked.add(item.el);item.el.setAttribute('data-u-studio-locked','');}else{state.locked.delete(item.el);item.el.removeAttribute('data-u-studio-locked');}});refreshTree();},function(){apply(lockAll);});
    setStatus(items.length+'個の要素を'+(lockAll?'ロック':'ロック解除')+'しました。');
  }
  function canArrangeSelection(minimum){
    var items=selectedElements();
    if(items.length<minimum){setStatus(minimum+'個以上の要素を選択してください。');return null;}
    var parent=items[0].parentNode;
    if(items.some(function(el){return el.parentNode!==parent;})){setStatus('配置する要素は同じ親要素の中から選んでください。');return null;}
    if(items.some(function(el){return isLockedElement(el);})){setStatus('ロック中の要素を含むため配置できません。先にロックを解除してください。');return null;}
    if(items.some(function(el){return !el.getBoundingClientRect().width&&!el.getBoundingClientRect().height;})){setStatus('表示されている要素を選択してください。');return null;}
    return items;
  }
  function applyOffset(el,dx,dy){
    var cs=win.getComputedStyle(el), scale=(state.canvasZoom||100)/100;
    if(cs.position==='static') el.style.position='relative';
    var left=parseFloat(cs.left);var top=parseFloat(cs.top);
    if(!Number.isFinite(left))left=0;if(!Number.isFinite(top))top=0;
    if(dx)el.style.left=(left+dx/scale)+'px';
    if(dy)el.style.top=(top+dy/scale)+'px';
  }
  function savePositionAction(label,items,before){
    var after=items.map(function(el){return el.getAttribute('style');});
    pushAction(label,function(){items.forEach(function(el,i){restoreStyle(el,before[i]);});},function(){items.forEach(function(el,i){restoreStyle(el,after[i]);});});
    refreshTree();updateSelectedOutline();
  }
  function alignSelected(mode){
    var items=canArrangeSelection(2);if(!items)return;
    var before=items.map(function(el){return el.getAttribute('style');});
    var rects=items.map(function(el){return el.getBoundingClientRect();});
    var target=mode==='left'?Math.min.apply(null,rects.map(function(r){return r.left;})):mode==='right'?Math.max.apply(null,rects.map(function(r){return r.right;})):rects.reduce(function(sum,r){return sum+(r.left+r.width/2);},0)/rects.length;
    items.forEach(function(el,i){var r=rects[i];var own=mode==='left'?r.left:mode==='right'?r.right:r.left+r.width/2;applyOffset(el,target-own,0);});
    savePositionAction('複数要素を'+({left:'左揃え',center:'中央揃え',right:'右揃え'}[mode]),items,before);
    setStatus(items.length+'個の要素を'+({left:'左揃え',center:'中央揃え',right:'右揃え'}[mode])+'しました。');
  }
  function distributeSelected(axis){
    var items=canArrangeSelection(3);if(!items)return;
    var rects=items.map(function(el){return el.getBoundingClientRect();});
    var indexed=items.map(function(el,i){return {el:el,r:rects[i]};}).sort(function(a,b){return axis==='x'?a.r.left-b.r.left:a.r.top-b.r.top;});
    var first=axis==='x'?indexed[0].r.left:indexed[0].r.top;
    var last=axis==='x'?indexed[indexed.length-1].r.right:indexed[indexed.length-1].r.bottom;
    var total=indexed.reduce(function(sum,item){return sum+(axis==='x'?item.r.width:item.r.height);},0);
    var gap=(last-first-total)/(indexed.length-1);
    var cursor=first;var targets=new Map();
    indexed.forEach(function(item){var current=axis==='x'?item.r.left:item.r.top;targets.set(item.el,cursor-current);cursor+=(axis==='x'?item.r.width:item.r.height)+gap;});
    var before=items.map(function(el){return el.getAttribute('style');});
    items.forEach(function(el){var delta=targets.get(el)||0;applyOffset(el,axis==='x'?delta:0,axis==='y'?delta:0);});
    savePositionAction(axis==='x'?'要素を横方向に均等配置':'要素を縦方向に均等配置',items,before);
    setStatus(items.length+'個の要素を'+(axis==='x'?'横':'縦')+'方向に均等配置しました（間隔 '+Math.round(gap)+'px）。');
  }

  function reorderLayer(source,target,after){if(!source||!target||source===target||source.parentNode!==target.parentNode)return setStatus('レイヤーの並べ替えは同じ親の中で行ってください。');if(isLockedElement(source)||isLockedElement(target))return setStatus('ロック中の要素は並べ替えできません。');var parent=source.parentNode,oldNext=source.nextSibling;if(after)target.after(source);else target.before(source);var newNext=source.nextSibling;pushAction('レイヤーをドラッグして並べ替え',function(){if(oldNext&&oldNext.parentNode===parent)parent.insertBefore(source,oldNext);else parent.appendChild(source);},function(){if(newNext&&newNext.parentNode===parent)parent.insertBefore(source,newNext);else parent.appendChild(source);});refreshTree();setStatus('レイヤーを並べ替えました。');}

  function treeLabel(element) {
    var tag = element.tagName.toLowerCase();
    var groupName = element.getAttribute('data-u-studio-group-name');
    var label = element.hasAttribute('data-u-studio-group') ? '▣ グループ' + (groupName ? '：' + groupName : '') : '<' + tag + '>';
    if (element.id) label += ' #' + element.id;
    if (element.classList && element.classList.length) label += ' .' + Array.prototype.slice.call(element.classList).slice(0, 3).join('.');
    var previewText = '';
    for (var i = 0; i < element.childNodes.length; i++) {
      var child = element.childNodes[i];
      if (child.nodeType === 3 && child.nodeValue.trim()) { previewText = child.nodeValue.trim().replace(/\s+/g, ' '); break; }
    }
    if (previewText) label += ' — ' + (previewText.length > 28 ? previewText.slice(0, 28) + '…' : previewText);
    return label;
  }
  function refreshTree() {
    if (!treeContainer) return;
    treeContainer.textContent = '';
    treeEntries = [];
    var budget = { count: 0, limit: 700, truncated: false };
    function addNode(element, depth) {
      if (!element || element.nodeType !== 1 || budget.count >= budget.limit) { budget.truncated = true; return null; }
      budget.count++;
      var details = make('details', null, 'tree-entry');
      details.draggable = true;
      details.addEventListener('dragstart',function(event){layerDragElement=element;details.classList.add('dragging');if(event.dataTransfer){event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain','UltraModderLayer');}});
      details.addEventListener('dragend',function(){layerDragElement=null;treeContainer.querySelectorAll('.drop-before,.drop-after,.dragging').forEach(function(n){n.classList.remove('drop-before','drop-after','dragging');});});
      details.addEventListener('dragover',function(event){if(!layerDragElement||layerDragElement===element||layerDragElement.parentNode!==element.parentNode)return;event.preventDefault();var after=event.clientY>details.getBoundingClientRect().top+details.getBoundingClientRect().height/2;details.classList.toggle('drop-after',after);details.classList.toggle('drop-before',!after);});
      details.addEventListener('dragleave',function(){details.classList.remove('drop-before','drop-after');});
      details.addEventListener('drop',function(event){if(!layerDragElement)return;event.preventDefault();event.stopPropagation();var after=event.clientY>details.getBoundingClientRect().top+details.getBoundingClientRect().height/2;reorderLayer(layerDragElement,element,after);layerDragElement=null;});
      details.open = depth < 1 || (state.selected && (element === state.selected || element.contains(state.selected)));
      var summary = make('summary', treeLabel(element));
      summary.title = 'クリックしてこの要素を選択・展開';
      summary.addEventListener('click', function (event) {
        var additive = !!(event.ctrlKey || event.metaKey || event.shiftKey);
        if (element !== doc.body && !protectedElement(element)) selectElement(element, additive, additive);
      });
      details.appendChild(summary);
      var layerActions = make('div', null, 'layer-actions');
      var layerVisibility = make('button', win.getComputedStyle(element).display === 'none' ? '表示' : '非表示');
      layerVisibility.type = 'button'; layerVisibility.title = 'このレイヤーの表示・非表示';
      layerVisibility.addEventListener('click', function (event) { event.preventDefault(); event.stopPropagation(); state.selected = element; state.multiSelected = [element]; toggleSelectedVisibility(); refreshTree(); });
      var layerLock = make('button', state.locked.has(element) ? '🔓 解除' : '🔒 固定');
      layerLock.type = 'button'; layerLock.dataset.action = 'lock'; layerLock.title = 'このレイヤーをロック／解除';
      layerLock.addEventListener('click', function (event) { event.preventDefault(); event.stopPropagation(); toggleElementLock(element); });
      append(layerActions, layerVisibility); append(layerActions, layerLock);
      var stateLabel = make('span', (state.locked.has(element) ? '🔒 ロック中' : '') + (win.getComputedStyle(element).display === 'none' ? ' ・非表示' : ''), 'layer-state');
      append(layerActions, stateLabel);
      details.appendChild(layerActions);
      treeEntries.push({ element: element, details: details, summary: summary, label: summary.textContent.toLowerCase() });
      var children = Array.prototype.slice.call(element.children || []);
      children.forEach(function (child) {
        if (budget.count >= budget.limit) { budget.truncated = true; return; }
        var childNode = addNode(child, depth + 1);
        if (childNode) details.appendChild(childNode);
      });
      if (!children.length) details.classList.add('leaf');
      return details;
    }
    var root = addNode(doc.body, 0);
    if (root) treeContainer.appendChild(root);
    if (budget.truncated) append(treeContainer, make('div', '表示上限に達しました。必要な場所までページをスクロールしてから更新してください。', 'tree-muted'));
    filterTree();
    markTreeSelection();
    if (groupNameInput) groupNameInput.value = selectedElement() && selectedElement().hasAttribute('data-u-studio-group') ? (selectedElement().getAttribute('data-u-studio-group-name') || '') : '';
  }
  function filterTree() {
    var query = String(treeSearch && treeSearch.value || '').trim().toLowerCase();
    var matched = new Set(); var visible = new Set();
    treeEntries.forEach(function (entry) {
      var el = entry.element;
      var classText = typeof el.className === 'string' ? el.className : '';
      var text = [el.tagName, el.id, classText, el.getAttribute('aria-label') || '', el.getAttribute('data-u-studio-group-name') || '', (el.textContent || '').slice(0, 240)].join(' ').toLowerCase();
      var hit = !query || text.indexOf(query) >= 0;
      if (query.charAt(0) === '#') hit = !query.slice(1) || String(el.id || '').toLowerCase().indexOf(query.slice(1)) >= 0;
      else if (query.charAt(0) === '.') hit = String(classText).toLowerCase().split(/\s+/).some(function (name) { return name.indexOf(query.slice(1)) >= 0; });
      entry.summary.classList.toggle('search-hit', !!query && hit);
      if (hit) {
        matched.add(el);
        var parent = el;
        while (parent && parent !== doc.body.parentElement) { visible.add(parent); parent = parent.parentElement; }
      }
    });
    treeEntries.forEach(function (entry) {
      var show = !query || visible.has(entry.element);
      entry.details.style.display = show ? '' : 'none';
      if (query && visible.has(entry.element) && !matched.has(entry.element)) entry.details.open = true;
    });
    if (treeSearchCount) treeSearchCount.textContent = query ? matched.size + '件が見つかりました。' : treeEntries.length + '個の要素を表示しています。';
  }
  function markTreeSelection() {
    var group = selectedElements();
    treeEntries.forEach(function (entry) {
      entry.summary.classList.toggle('selected', entry.element === state.selected);
      entry.summary.classList.toggle('multi', group.indexOf(entry.element) >= 0 && entry.element !== state.selected);
    });
  }

  function isPlainTextElement(element) {
    if (!element || element.children.length) return false;
    return !/^(INPUT|TEXTAREA|SELECT|IMG|VIDEO|AUDIO|CANVAS|SVG|IFRAME|SCRIPT|STYLE)$/.test(element.tagName);
  }
  function nearestLink(element) {
    if (!element) return null;
    return element.tagName === 'A' ? element : (element.closest ? element.closest('a') : null);
  }
  function refreshInspector() {
    var element = selectedElement();
    var group = selectedElements();
    if (!element) {
      selectedInfo.textContent = 'まだ要素が選択されていません。';
      breadcrumb.textContent = '';
      textEditor.value = ''; textEditor.disabled = true;
      lockButton.disabled = true;
      return;
    }
    var tag = element.tagName.toLowerCase();
    selectedInfo.textContent = (group.length > 1 ? group.length + '個をまとめて選択中：' : '') + '<' + tag + '>' + (element.id ? '  #' + element.id : '') + (element.classList && element.classList.length ? '  .' + Array.prototype.slice.call(element.classList).join('.') : '');
    var ancestors = []; var node = element;
    while (node && node !== doc.body && node.nodeType === 1 && ancestors.length < 6) { ancestors.unshift(node); node = node.parentElement; }
    breadcrumb.textContent = '';
    ancestors.forEach(function (ancestor) {
      var crumb = button(breadcrumb, ancestor.tagName.toLowerCase() + (ancestor.id ? '#' + ancestor.id : ''), function () { selectElement(ancestor); }, '');
      crumb.title = 'この親要素を選択';
    });
    var computed = win.getComputedStyle(element);
    bgInput.value = colorToHex(computed.backgroundColor);
    fgInput.value = colorToHex(computed.color);
    mobileBgInput.value = colorToHex(computed.backgroundColor);
    mobileFgInput.value = colorToHex(computed.color);
    mobileWidthInput.value = ''; mobileFontInput.value = '';
    widthInput.value = computed.width;
    heightInput.value = computed.height;
    fontSizeInput.value = parseFloat(computed.fontSize) || 16;
    radiusInput.value = parseFloat(computed.borderTopLeftRadius) || 0;
    paddingInput.value = parseFloat(computed.paddingTop) || 0;
    marginInput.value = parseFloat(computed.marginTop) || 0;
    displaySelect.value = '';
    xInput.value = computed.position === 'static' || computed.left === 'auto' ? '' : (parseFloat(computed.left) || 0); yInput.value = computed.position === 'static' || computed.top === 'auto' ? '' : (parseFloat(computed.top) || 0);
    positionSelect.value = '';
    textEditor.disabled = group.length !== 1 || !isPlainTextElement(element);
    textEditor.value = isPlainTextElement(element) ? element.textContent : '';
    idInput.value = group.length === 1 ? (element.id || '') : '';
    classInput.value = group.length === 1 ? (typeof element.className === 'string' ? element.className : '') : '';
    titleInput.value = group.length === 1 ? (element.getAttribute('title') || '') : '';
    altInput.value = group.length === 1 && element.tagName === 'IMG' ? (element.getAttribute('alt') || '') : '';
    state.attributeTarget = nearestLink(element);
    hrefInput.value = group.length === 1 && state.attributeTarget ? (state.attributeTarget.getAttribute('href') || '') : '';
    idInput.disabled = group.length !== 1;
    classInput.disabled = group.length !== 1;
    titleInput.disabled = group.length !== 1;
    altInput.disabled = group.length !== 1 || element.tagName !== 'IMG';
    hrefInput.disabled = group.length !== 1 || !state.attributeTarget;
    lockButton.textContent = isLockedElement(element) ? '🔓 選択要素のロックを解除' : '🔒 選択要素をロック';
    lockButton.disabled = group.length !== 1;
    updateSelectedOutline();
  }
  function updateSelectedOutline() {
    var element = selectedElement();
    if (!element) { selectedBox.style.display = 'none'; resizeGrip.style.display = 'none'; return; }
    var rect = element.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) { selectedBox.style.display = 'none'; resizeGrip.style.display = 'none'; return; }
    selectedBox.style.display = 'block';
    selectedBox.style.left = Math.max(0, rect.left) + 'px';
    selectedBox.style.top = Math.max(0, rect.top) + 'px';
    selectedBox.style.width = Math.max(0, Math.min(win.innerWidth, rect.right) - Math.max(0, rect.left)) + 'px';
    selectedBox.style.height = Math.max(0, Math.min(win.innerHeight, rect.bottom) - Math.max(0, rect.top)) + 'px';
    if (state.resizeEnabled) { resizeGrip.style.display = 'block'; resizeGrip.style.left = Math.min(win.innerWidth - 20, Math.max(0, rect.right - 9)) + 'px'; resizeGrip.style.top = Math.min(win.innerHeight - 20, Math.max(0, rect.bottom - 9)) + 'px'; } else { resizeGrip.style.display = 'none'; }
  }
  function isLockedElement(element) {
    var current = element;
    while (current && current !== doc.body.parentElement) { if (state.locked.has(current) || current.hasAttribute('data-u-studio-locked')) return true; current = current.parentElement; }
    return false;
  }
  function toggleElementLock(element) {
    if (!element || protectedElement(element)) return setStatus('この要素はロックできません。');
    var wasLocked = state.locked.has(element) || element.hasAttribute('data-u-studio-locked');
    if (wasLocked) { state.locked.delete(element); element.removeAttribute('data-u-studio-locked'); setStatus('要素のロックを解除しました。'); }
    else { state.locked.add(element); element.setAttribute('data-u-studio-locked',''); setStatus('要素をロックしました。ロック中は選択・移動・変更を防ぎます。'); }
    refreshTree(); refreshInspector();
  }
  function unlockAllElements() {
    var list = Array.from(state.locked);
    doc.querySelectorAll('[data-u-studio-locked]').forEach(function (el) { if (list.indexOf(el) < 0) list.push(el); });
    list.forEach(function (el) { if (el && el.removeAttribute) el.removeAttribute('data-u-studio-locked'); });
    state.locked.clear(); refreshTree(); refreshInspector(); setStatus(list.length + '個のロックを解除しました。');
  }
  function selectElement(element, keepCurrentTab, additive) {
    if (isLockedElement(element) && element !== state.selected) { setStatus('この要素または親要素はロックされています。先にロックを解除してください。'); return; }
    if (!element || !element.tagName || element === host || element === doc.documentElement || element === doc.body || host.contains(element)) {
      setStatus('ページ全体・本文領域・編集パネルは直接選択できません。'); return;
    }
    var primary = element;
    if (additive) {
      var current = selectedElements();
      var at = current.indexOf(element);
      if (at >= 0 && current.length > 1) {
        current.splice(at, 1);
        if (state.selected === element) primary = current[current.length - 1];
      } else if (at < 0) current.push(element);
      state.multiSelected = current;
    } else state.multiSelected = [element];
    state.selected = primary;
    if (groupNameInput) groupNameInput.value = primary && primary.hasAttribute('data-u-studio-group') ? (primary.getAttribute('data-u-studio-group-name') || '') : '';
    refreshInspector();
    markTreeSelection();
    if (!keepCurrentTab) selectTab(2);
    var count = selectedElements().length;
    setStatus(count > 1 ? count + '個の要素を選択しました。見た目の設定はまとめて適用できます。' : '要素を選択しました。見た目の変更・複製・移動ができます。');
  }
  function selectParent() {
    var element = selectedElement();
    if (!element || !element.parentElement || element.parentElement === doc.body) return setStatus('これ以上上の要素は選択できません。');
    selectElement(element.parentElement);
  }
  function replaceSelectedMedia() {
    var element = selectedElement();
    if (!element) return setStatus('先に要素を選択してください。');
    if (isLockedElement(element)) return setStatus('ロック中の要素の画像は差し替えできません。');
    var rect = element.getBoundingClientRect();
    var media = mediaAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
    if (!media) return setStatus('選択要素またはその位置に置換できる画像がありません。');
    imageDialog('選択した画像を差し替え', function (items) {
      if (items[0] && setMedia(media, items[0].data)) setStatus('画像を差し替えました。元に戻す操作で戻せます。');
    }, false);
  }
  function buildCssSelector(element) {
    if (!element || !element.tagName) return '';
    if (element.id) return '[id=' + JSON.stringify(element.id) + ']';
    var parts = []; var current = element;
    while (current && current.nodeType === 1 && current !== doc.body && parts.length < 8) {
      var tag = current.tagName.toLowerCase();
      var siblings = current.parentElement ? Array.prototype.filter.call(current.parentElement.children,function (item) { return item.tagName === current.tagName; }) : [];
      var position = siblings.length > 1 ? ':nth-of-type(' + (siblings.indexOf(current)+1) + ')' : '';
      parts.unshift(tag + position);
      current = current.parentElement;
      if (current && current.id) { parts.unshift('[id=' + JSON.stringify(current.id) + ']'); break; }
    }
    return parts.join(' > ');
  }
  function copyTextValue(value, successMessage) {
    if (win.navigator.clipboard && win.navigator.clipboard.writeText) {
      win.navigator.clipboard.writeText(value).then(function () { setStatus(successMessage); }, function () { showCopyFallback(value); });
    } else showCopyFallback(value);
  }
  function copySelectedSelector() {
    var element = selectedElement();
    if (!element) return setStatus('先に要素を選択してください。');
    copyTextValue(buildCssSelector(element),'要素を指定する文字列をコピーしました。');
  }
  function showGuide() {
    closeDialog();
    var box = append(shadow, make('div',null,'dialog')); state.dialog = box;
    box.setAttribute('role','dialog'); box.setAttribute('aria-modal','true');
    append(box,make('div','Ultra Modder 7.0 の使い方','dialog-title'));
    var guide = [
      '【基本】「レイヤー」で要素を探し、「見た目」で色・大きさ・文章・属性を変更します。',
      '【複数選択】構造ツリーでCtrl／Shiftを押しながら選ぶと、複数の要素へまとめてデザインを適用できます。',
      '【画面上で選択】見た目タブの「ページ上で要素を選択」を押してからページをクリックします。',
      '【ドラッグ配置】見た目タブの「画面上でドラッグ配置」を有効にして要素を動かします。',
      '【端末確認】「表示」で画面幅を切り替え、「見た目」のスマートフォン専用設定で小さい画面だけのデザインを指定できます。',
      '【キー操作】Ctrl+Z：元に戻す／Ctrl+Y：やり直す／Ctrl+S：保存／Ctrl+D：複製',
      '【キー操作】Delete：非表示／Alt+↑：親要素／Alt+←・→：順番変更／Esc：操作解除／/：要素検索',
      '【保存】保存前チェックで重複IDや画像の代替テキストを確認できます。保存ファイルは静的HTMLです。'
    ].join('\n\n');
    var body = append(box,make('div',guide,'info')); body.style.whiteSpace='pre-line';
    append(box,make('div','注意：ログイン状態、サイトのJavaScript、動的な表示、別ドメインのiframeなどは保存・編集できない場合があります。','hint'));
    var actions=append(box,make('div',null,'dialog-actions'));
    button(actions,'閉じる',closeDialog,'primary');
  }

  function copySelectedHTML() {
    var element = selectedElement();
    if (!element) return setStatus('先に要素を選択してください。');
    var html = element.outerHTML;
    if (win.navigator.clipboard && win.navigator.clipboard.writeText) {
      win.navigator.clipboard.writeText(html).then(function () { setStatus('選択部分の構造コードをコピーしました。'); }, function () { showCopyFallback(html); });
    } else showCopyFallback(html);
  }
  function showCopyFallback(html) {
    closeDialog();
    var box = append(shadow, make('div', null, 'dialog'));
    state.dialog = box;
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    append(box, make('div', '選択部分の構造コード', 'dialog-title'));
    var area = append(box, make('textarea', null, 'copy-area'));
    area.value = html; area.readOnly = true;
    var actions = append(box, make('div', null, 'dialog-actions'));
    button(actions, 'すべて選択', function () { area.focus(); area.select(); }, 'secondary');
    button(actions, '閉じる', closeDialog, 'primary');
    area.focus(); area.select();
    setStatus('自動コピーできないため、表示した構造コードを選択してコピーしてください。');
  }


  function ensureMobileStyleNode() {
    if (!state.mobileStyleNode || !state.mobileStyleNode.isConnected) {
      state.mobileStyleNode = doc.querySelector('style[data-u-studio-v6-mobile]') || doc.createElement('style');
      state.mobileStyleNode.setAttribute('data-u-studio-v6-mobile','');
      if (!state.mobileStyleNode.parentNode) (doc.head || doc.documentElement).appendChild(state.mobileStyleNode);
    }
    return state.mobileStyleNode;
  }
  function rebuildMobileStyles() {
    var rules = [];
    doc.querySelectorAll('[data-u-mobile-key][data-u-mobile-css]').forEach(function(el){
      try {
        var props = JSON.parse(el.getAttribute('data-u-mobile-css') || '{}');
        var css = Object.keys(props).map(function(key){return key+':'+props[key]+' !important;';}).join('');
        if (css) rules.push('[data-u-mobile-key="'+el.getAttribute('data-u-mobile-key')+'"]{'+css+'}');
      } catch(e) {}
    });
    ensureMobileStyleNode().textContent = '@media (max-width: 767px){'+rules.join('\n')+'}';
  }
  function applyMobileOverrides() {
    var targets = selectedElements(); if (!targets.length) return setStatus('先に要素を選択してください。');
    if (targets.some(isLockedElement)) return setStatus('ロック中の要素が含まれています。先にロックを解除してください。');
    var width = validDimension(mobileWidthInput.value); if (mobileWidthInput.value.trim() && !width) return setStatus('スマホ時の幅を確認してください。例：100%');
    var fontSize = mobileFontInput.value.trim() ? Math.max(6,Math.min(80,Number(mobileFontInput.value))) : null;
    if (mobileFontInput.value.trim() && !Number.isFinite(fontSize)) return setStatus('文字サイズを数値で入力してください。');
    var before = targets.map(function(el){return {el:el,key:el.getAttribute('data-u-mobile-key'),css:el.getAttribute('data-u-mobile-css')};});
    targets.forEach(function(el){
      if (isLockedElement(el)) return;
      if (!el.hasAttribute('data-u-mobile-key')) el.setAttribute('data-u-mobile-key','u5-'+Math.random().toString(36).slice(2,10));
      var props={}; props['background-color']=mobileBgInput.value; props.color=mobileFgInput.value;
      if(width) props.width=width; if(fontSize!==null) props['font-size']=fontSize+'px';
      el.setAttribute('data-u-mobile-css',JSON.stringify(props));
    });
    rebuildMobileStyles();
    var after = targets.map(function(el){return {el:el,key:el.getAttribute('data-u-mobile-key'),css:el.getAttribute('data-u-mobile-css')};});
    function restore(items){items.forEach(function(item){if(item.key===null)item.el.removeAttribute('data-u-mobile-key');else item.el.setAttribute('data-u-mobile-key',item.key);if(item.css===null)item.el.removeAttribute('data-u-mobile-css');else item.el.setAttribute('data-u-mobile-css',item.css);});rebuildMobileStyles();}
    pushAction('スマートフォン専用デザインを変更',function(){restore(before);},function(){restore(after);});
    setStatus(targets.length+'個の要素にスマートフォン専用デザインを設定しました。');
  }
  function clearMobileOverrides() {
    var targets=selectedElements();if(!targets.length)return setStatus('先に要素を選択してください。');
    if(targets.some(isLockedElement))return setStatus('ロック中の要素が含まれています。先にロックを解除してください。');
    var before=targets.map(function(el){return {el:el,key:el.getAttribute('data-u-mobile-key'),css:el.getAttribute('data-u-mobile-css')};});
    targets.forEach(function(el){if(!isLockedElement(el)){el.removeAttribute('data-u-mobile-key');el.removeAttribute('data-u-mobile-css');}});rebuildMobileStyles();
    var after=targets.map(function(el){return {el:el,key:el.getAttribute('data-u-mobile-key'),css:el.getAttribute('data-u-mobile-css')};});
    function restore(items){items.forEach(function(item){if(item.key===null)item.el.removeAttribute('data-u-mobile-key');else item.el.setAttribute('data-u-mobile-key',item.key);if(item.css===null)item.el.removeAttribute('data-u-mobile-css');else item.el.setAttribute('data-u-mobile-css',item.css);});rebuildMobileStyles();}
    pushAction('スマートフォン専用デザインを解除',function(){restore(before);},function(){restore(after);});
    setStatus('スマートフォン専用デザインを解除しました。');
  }

  function validDimension(value) {
    var text = String(value || '').trim();
    if (!text) return null;
    if (/^(auto|none|max-content|min-content|fit-content|0)$/i.test(text)) return text;
    if (/^-?\d+(?:\.\d+)?(?:px|%|vw|vh|rem|em)$/i.test(text)) return text;
    return null;
  }
  function validNumber(input, min, max) {
    if (!String(input.value || '').trim()) return null;
    var number = Number(input.value);
    if (!Number.isFinite(number)) return null;
    return Math.min(max, Math.max(min, number));
  }
  function applyInspectorStyles() {
    var targets = selectedElements();
    if (!targets.length) return setStatus('先に要素を選択してください。');
    if (targets.some(isLockedElement)) return setStatus('ロック中の要素が含まれています。先にロックを解除してください。');
    var width = validDimension(widthInput.value);
    var height = validDimension(heightInput.value);
    if (widthInput.value.trim() && !width) return setStatus('幅の値を確認してください。例: 320px、80%');
    if (heightInput.value.trim() && !height) return setStatus('高さの値を確認してください。例: auto、200px');
    var x = validNumber(xInput, -5000, 5000); var y = validNumber(yInput, -5000, 5000);
    var snapshots = targets.map(function (element) { return { element: element, style: snapshotStyle(element) }; });
    targets.forEach(function (element) {
      if (isLockedElement(element)) return;
      element.style.setProperty('background-color', bgInput.value);
      element.style.setProperty('color', fgInput.value);
      if (width) element.style.setProperty('width', width);
      if (height) element.style.setProperty('height', height);
      var fs = validNumber(fontSizeInput, 6, 120); if (fs !== null) element.style.setProperty('font-size', fs + 'px');
      var radius = validNumber(radiusInput, 0, 200); if (radius !== null) element.style.setProperty('border-radius', radius + 'px');
      var padding = validNumber(paddingInput, 0, 300); if (padding !== null) element.style.setProperty('padding', padding + 'px');
      var margin = validNumber(marginInput, -100, 500); if (margin !== null) element.style.setProperty('margin', margin + 'px');
      if (displaySelect.value) element.style.setProperty('display', displaySelect.value);
      if (positionSelect.value) element.style.setProperty('position', positionSelect.value);
      if (x !== null || y !== null) { if (!positionSelect.value && win.getComputedStyle(element).position === 'static') element.style.setProperty('position','relative'); if (x !== null) element.style.setProperty('left',x+'px'); if (y !== null) element.style.setProperty('top',y+'px'); }
    });
    var after = targets.map(function (element) { return { element: element, style: snapshotStyle(element) }; });
    pushAction(targets.length > 1 ? targets.length + '個の要素の見た目を一括変更' : '見た目の設定変更', function () { snapshots.forEach(function (item) { restoreStyle(item.element, item.style); }); }, function () { after.forEach(function (item) { restoreStyle(item.element, item.style); }); });
    refreshInspector(); updateSelectedOutline(); setStatus(targets.length + '個の要素にスタイルを適用しました。元に戻す操作で戻せます。');
  }
  function applyStylePreset(name) {
    var targets = selectedElements();
    if (!targets.length) return setStatus('先に要素を選択してください。');
    if (targets.some(isLockedElement)) return setStatus('ロック中の要素が含まれています。先にロックを解除してください。');
    var presets = {
      card: { 'background-color':'#ffffff', 'color':'#1f2937', 'border':'1px solid #e5e7eb', 'border-radius':'12px', 'padding':'16px', 'box-shadow':'0 4px 16px rgba(0,0,0,.08)' },
      button: { 'display':'inline-flex', 'align-items':'center', 'justify-content':'center', 'background-color':'#4f46e5', 'color':'#ffffff', 'border':'0', 'border-radius':'8px', 'padding':'10px 16px', 'font-weight':'700', 'text-decoration':'none', 'cursor':'pointer' },
      highlight: { 'background-color':'#fef3c7', 'color':'#78350f', 'border-left':'4px solid #f59e0b', 'border-radius':'6px', 'padding':'12px 14px' }
    };
    var clearProps = ['background-color','color','border','border-radius','padding','box-shadow','display','align-items','justify-content','font-weight','text-decoration','cursor','border-left'];
    var before = targets.map(function (element) { return { element: element, style: snapshotStyle(element) }; });
    targets.forEach(function (element) {
      if (name === 'clear') clearProps.forEach(function (prop) { element.style.removeProperty(prop); });
      else Object.keys(presets[name]).forEach(function (prop) { element.style.setProperty(prop, presets[name][prop]); });
    });
    var after = targets.map(function (element) { return { element: element, style: snapshotStyle(element) }; });
    var labels = { card:'カード風デザイン', button:'ボタン風デザイン', highlight:'強調枠デザイン', clear:'装飾の解除' };
    pushAction(targets.length + '個の要素に' + labels[name], function () { before.forEach(function (item) { restoreStyle(item.element,item.style); }); }, function () { after.forEach(function (item) { restoreStyle(item.element,item.style); }); });
    refreshInspector(); updateSelectedOutline(); setStatus(targets.length + '個の要素に「' + labels[name] + '」を適用しました。');
  }
  function applySelectedText() {
    var element = selectedElement();
    if (!element || selectedElements().length !== 1) return setStatus('テキスト編集は要素を1つだけ選択して使ってください。');
    if (isLockedElement(element)) return setStatus('ロック中の要素は編集できません。');
    if (!isPlainTextElement(element)) return setStatus('子要素を含む要素の文章は一括変更できません。文字だけの要素を選んでください。');
    var before = element.textContent; var after = textEditor.value;
    if (before === after) return setStatus('文章に変更はありません。');
    element.textContent = after;
    pushAction('文章を変更', function () { element.textContent = before; }, function () { element.textContent = after; });
    refreshTree(); refreshInspector(); setStatus('文章を変更しました。');
  }
  function applySelectedAttributes() {
    var element = selectedElement();
    if (!element || selectedElements().length !== 1) return setStatus('属性編集は要素を1つだけ選択して使ってください。');
    if (isLockedElement(element)) return setStatus('ロック中の要素は編集できません。');
    var newId = idInput.value.trim();
    if (newId && doc.getElementById(newId) && doc.getElementById(newId) !== element) return setStatus('同じIDがページ内にあります。別のIDを指定してください。');
    var link = nearestLink(element);
    var newHref = hrefInput.value.trim();
    if (link && newHref && !normalizeURL(newHref, true)) return setStatus('リンク先URLを確認してください。http、https、mailto、telに対応しています。');
    var targets = [{ element: element, names:['id','class','title','alt'] }];
    if (link) targets.push({ element: link, names:['href'] });
    var before = targets.map(function (item) { return attrSnapshot(item.element,item.names); });
    if (newId) element.setAttribute('id',newId); else element.removeAttribute('id');
    if (classInput.value.trim()) element.setAttribute('class',classInput.value.trim()); else element.removeAttribute('class');
    if (titleInput.value.trim()) element.setAttribute('title',titleInput.value); else element.removeAttribute('title');
    if (element.tagName === 'IMG') { if (altInput.value.trim()) element.setAttribute('alt',altInput.value); else element.removeAttribute('alt'); }
    if (link) { if (newHref) link.setAttribute('href',normalizeURL(newHref,true)); else link.removeAttribute('href'); }
    var after = targets.map(function (item) { return attrSnapshot(item.element,item.names); });
    pushAction('要素の属性を変更', function () { restoreAttrSnapshots(before); }, function () { restoreAttrSnapshots(after); });
    refreshTree(); refreshInspector(); setStatus('要素のID・クラス・補足情報を更新しました。');
  }
  function toggleSelectedVisibility() {
    var targets = selectedElements(); if (!targets.length) return setStatus('先に要素を選択してください。');
    if (targets.some(isLockedElement)) return setStatus('ロック中の要素が含まれています。先にロックを解除してください。');
    var before = targets.map(function (element) { return { element:element, style:snapshotStyle(element) }; });
    targets.forEach(function (element) {
      if (win.getComputedStyle(element).display === 'none') element.style.removeProperty('display');
      else element.style.setProperty('display', 'none', 'important');
    });
    var after = targets.map(function (element) { return { element:element, style:snapshotStyle(element) }; });
    pushAction(targets.length + '個の要素の表示状態を切替', function () { before.forEach(function (item) { restoreStyle(item.element,item.style); }); }, function () { after.forEach(function (item) { restoreStyle(item.element,item.style); }); });
    updateSelectedOutline(); setStatus(targets.length + '個の要素の表示状態を切り替えました。');
  }
  function duplicateSelected() {
    var elements = selectedElements(); if (!elements.length) return setStatus('先に要素を選択してください。');
    if (elements.some(isLockedElement)) return setStatus('ロック中の要素は複製できません。');
    var copies = elements.map(function (element) {
      var clone = element.cloneNode(true);
      [clone].concat(Array.prototype.slice.call(clone.querySelectorAll('[id]'))).forEach(function (node) { node.removeAttribute('id'); });
      [clone].concat(Array.prototype.slice.call(clone.querySelectorAll('*'))).forEach(function (node) {
        Array.prototype.slice.call(node.attributes || []).forEach(function (attr) { if (/^on/i.test(attr.name) || attr.name === 'data-u-studio-locked') node.removeAttribute(attr.name); });
      });
      element.parentNode.insertBefore(clone, element.nextSibling);
      return { source:element, clone:clone };
    });
    pushAction(elements.length + '個の要素を複製', function () { copies.forEach(function (item) { if (item.clone.parentNode) item.clone.remove(); }); }, function () { copies.forEach(function (item) { if (!item.clone.parentNode && item.source.parentNode) item.source.parentNode.insertBefore(item.clone,item.source.nextSibling); }); });
    state.selected = copies[copies.length-1].clone; state.multiSelected = copies.map(function (item) { return item.clone; });
    refreshInspector(); updateSelectedOutline(); refreshTree(); setStatus(elements.length + '個の要素を複製しました。');
  }
  function moveSelectedUp() {
    var element = selectedElement(); if (element && isLockedElement(element)) return setStatus('ロック中の要素は移動できません。'); if (!element || !element.previousElementSibling) return setStatus('これ以上上へ移動できません。');
    var previous = element.previousElementSibling; var parent = element.parentNode;
    previous.before(element);
    pushAction('要素を1つ上へ移動', function () { if (previous.parentNode === parent) previous.after(element); }, function () { if (previous.parentNode === parent) previous.before(element); });
    updateSelectedOutline(); setStatus('要素を1つ上へ移動しました。');
  }
  function moveSelectedDown() {
    var element = selectedElement(); if (element && isLockedElement(element)) return setStatus('ロック中の要素は移動できません。'); if (!element || !element.nextElementSibling) return setStatus('これ以上下へ移動できません。');
    var next = element.nextElementSibling; var parent = element.parentNode;
    next.after(element);
    pushAction('要素を1つ下へ移動', function () { if (next.parentNode === parent) next.before(element); }, function () { if (next.parentNode === parent) next.after(element); });
    updateSelectedOutline(); setStatus('要素を1つ下へ移動しました。');
  }

  // ----- Tools tab -----
  var toolsPage = pages[3];
  var modeButtons = {};
  function setMode(mode) {
    state.mode = mode;
    Object.keys(modeButtons).forEach(function (key) {
      var b = modeButtons[key]; var active = key === mode;
      b.classList.toggle('active', active); b.setAttribute('aria-pressed', active ? 'true' : 'false');
      b.textContent = active ? b.dataset.onLabel : b.dataset.offLabel;
    });
    selectModeBtn.classList.toggle('active', mode === 'select');
    visualMoveBtn.classList.toggle('active', mode === 'visual-move');
    visualMoveBtn.textContent = mode === 'visual-move' ? '✥ ドラッグ配置中（クリックで終了）' : '✥ 画面上でドラッグ配置：無効';
    hoverBox.style.display = 'none';
    if (mode === 'none') { hideGuides(); setStatus('操作モードを解除しました。'); }
    else if (mode === 'select') setStatus('ページ上の要素をクリックして選択します。Altキーを押しながらクリックすると親要素を選べます。');
    else if (mode === 'visual-move') setStatus('移動したい要素をページ上でドラッグしてください。配置は履歴から元に戻せます。');
    else setStatus(modeButtons[mode].dataset.help);
  }
  function addMode(mode, offLabel, onLabel, help) {
    var b = button(toolsPage, offLabel, function () { setMode(state.mode === mode ? 'none' : mode); }, 'wide mode');
    b.dataset.mode = mode; b.dataset.offLabel = offLabel; b.dataset.onLabel = onLabel; b.dataset.help = help; b.setAttribute('aria-pressed', 'false');
    modeButtons[mode] = b;
  }
  addMode('delete', '🗑️ 要素を非表示：無効', '🗑️ 非表示モード中', 'ページ上の要素をクリックすると非表示にします。Alt+クリックで親要素。元に戻す操作で戻せます。');
  addMode('replace', '🖼️ 画像差し替え：無効', '🖼️ 画像差し替え中', '画像・複数画像切替要素・SVG画像・背景画像をクリック。アドレスまたは端末内の画像で差し替えできます。');
  addMode('add', '➕ 画像追加：無効', '➕ 画像追加モード中', '追加したい位置をクリックするか、画像ファイルをページ上へドロップしてください。');
  button(toolsPage, '🔍 テキスト一括置換', replaceTextDialog, 'wide');
  button(toolsPage, '🧹 非表示要素をすべて表示', restoreHiddenElements, 'wide');
  button(toolsPage, '🩺 保存前チェック', runPageAudit, 'wide');
  button(toolsPage, '❔ 使い方・キー操作', showGuide, 'wide');
  var historyTitle = append(toolsPage, make('div', '操作履歴（直近8件・最大100件保存）', 'section-title'));
  var historyActions = append(toolsPage, make('div', null, 'two'));
  undoBtn = button(historyActions, '↶ 元に戻す', undo, '');
  redoBtn = button(historyActions, '↷ やり直す', redo, '');
  historySearch = append(toolsPage, make('input', null, 'history-search'));
  historySearch.type='search'; historySearch.placeholder='操作履歴を検索（例：移動、色、グループ）'; historySearch.setAttribute('aria-label','操作履歴を検索');
  historySearch.addEventListener('input',refreshHistory);
  historyCount = append(toolsPage, make('div', '直近8件を表示中（保存上限100件）', 'mini-count'));
  historyList = append(toolsPage, make('ul', null, 'history'));
  append(toolsPage, make('div', '履歴の項目を押すと、その操作と後続の操作をまとめて元に戻せます。', 'hint'));
  refreshHistory();
  button(toolsPage, '💾 編集済みページを保存', saveHTML, 'wide');
  append(toolsPage, make('div', '保存するファイルは静的なページです。スクリプトやイベント属性、編集パネルは除外されます。ログイン状態や動的機能は引き継がれません。', 'hint'));

  function runPageAudit() {
    var ids = new Map(); var duplicateIds = [];
    doc.querySelectorAll('[id]').forEach(function (element) {
      if (host.contains(element)) return;
      var id = element.id;
      if (ids.has(id)) duplicateIds.push(id); else ids.set(id,element);
    });
    var images = Array.prototype.slice.call(doc.images).filter(function (img) { return !host.contains(img); });
    var missingAlt = images.filter(function (img) { return !img.hasAttribute('alt'); }).length;
    var brokenImages = images.filter(function (img) { return img.complete && img.naturalWidth === 0 && !!img.currentSrc; }).length;
    var emptyLinks = Array.prototype.slice.call(doc.querySelectorAll('a')).filter(function (a) { return !host.contains(a) && !a.getAttribute('href'); }).length;
    var scripts = doc.querySelectorAll('script').length;
    var hidden = Array.from(hiddenByStudio).filter(function (el) { return el && el.isConnected; }).length;
    var lines = [
      '重複ID：' + duplicateIds.length + '件' + (duplicateIds.length ? '（' + duplicateIds.slice(0,5).join(', ') + (duplicateIds.length>5?' ほか':'') + '）' : ''),
      '代替テキスト未設定の画像：' + missingAlt + '件',
      '読み込めていない画像：' + brokenImages + '件',
      'リンク先が空のリンク：' + emptyLinks + '件',
      'Ultra Modderで非表示にした要素：' + hidden + '件',
      '保存時に除去されるscript：' + scripts + '件'
    ];
    closeDialog();
    var box = append(shadow, make('div',null,'dialog')); state.dialog = box;
    box.setAttribute('role','dialog'); box.setAttribute('aria-modal','true');
    append(box,make('div','保存前チェック結果','dialog-title'));
    append(box,make('div',lines.join('\n'),'info')).style.whiteSpace='pre-line';
    append(box,make('div','このチェックは一般的な確認項目です。外部CSS・JavaScript・ログイン状態など、保存ファイルで再現できない機能もあります。','hint'));
    var actions=append(box,make('div',null,'dialog-actions'));
    button(actions,'閉じる',closeDialog,'primary');
  }

  function restoreHiddenElements() {
    var hidden = Array.from(hiddenByStudio).filter(function (element) { return element && element.isConnected; });
    if (!hidden.length) return setStatus('Ultra Modderで非表示にした要素は見つかりませんでした。');
    var snapshots = hidden.map(function (element) { return { element: element, style: snapshotStyle(element) }; });
    hidden.forEach(function (element) { element.style.removeProperty('display'); element.removeAttribute('data-u-studio-hidden'); hiddenByStudio.delete(element); });
    var after = snapshots.map(function (item) { return { element: item.element, style: snapshotStyle(item.element) }; });
    pushAction('非表示要素を一括表示', function () { snapshots.forEach(function (item) { restoreStyle(item.element, item.style); item.element.setAttribute('data-u-studio-hidden',''); hiddenByStudio.add(item.element); }); }, function () { after.forEach(function (item) { restoreStyle(item.element, item.style); item.element.removeAttribute('data-u-studio-hidden'); hiddenByStudio.delete(item.element); }); });
    setStatus(hidden.length + '個の要素を表示しました。');
  }

  // ----- Display tab -----
  var displayPage = pages[4];
  button(displayPage, '📱 端末ごとの表示を確認', openResponsivePreview, 'wide');
  button(displayPage, '🌓 変更前・変更後を比較', openComparison, 'wide');
  append(displayPage, make('div', 'パソコン・タブレット・スマートフォンに加え、任意の画面幅でも確認できます。編集後は「表示を更新」を押してください。JavaScriptを停止した静的プレビューです。', 'hint'));
  var themeRow = append(displayPage, make('div', null, 'three'));
  [['☀️ 白','light'],['🌙 黒','dark'],['👻 半透明','ghost']].forEach(function (item) { button(themeRow, item[0], function () { theme(item[1]); }, ''); });
  var darkButton = button(displayPage, '🕶️ サイトを暗く表示：無効', toggleDark, 'wide');
  var outlineButton = button(displayPage, '📐 全要素の枠線：無効', toggleOutlines, 'wide');
  button(displayPage, '↗️ ツールバーを右上へ戻す', resetToolbarPosition, 'wide');
  append(displayPage, make('div', 'ツールバーはドラッグで移動できます。テーマ設定はこのページ内だけに適用されます。', 'hint'));


  // ----- Page library, style library and autosave manager -----
  var managerPage = pages[5];
  append(managerPage, make('div','複数ページ管理','section-title'));
  append(managerPage, make('div','このサイト内で編集したページを保存・一覧管理できます。保存内容はこのサイトのブラウザー保存領域に保管されます。別のサイトの保存一覧とは共有されません。','hint'));
  var pageNameInput = inputField(managerPage,'ページ名','text',doc.title || '編集ページ','例：トップページ');
  var pageLibraryList = append(managerPage,make('div',null,'manager-list'));
  button(managerPage,'📄 現在のページをプロジェクトに保存',saveProjectPage,'wide');
  button(managerPage,'🔄 保存ページ一覧を更新',refreshPageLibrary,'wide');
  var backupTitle = append(managerPage,make('div','自動バックアップ','section-title'));
  var backupStatus = append(managerPage,make('div','自動バックアップを準備しています。','info'));
  var autoBackupToggle = button(managerPage,'自動バックアップ：有効',toggleAutoBackup,'wide');
  button(managerPage,'💾 今すぐバックアップ',saveAutoBackupNow,'wide');
  button(managerPage,'♻️ バックアップをプレビュー表示',openAutoBackup,'wide');
  button(managerPage,'⬇️ バックアップをHTMLで書き出す',exportAutoBackup,'wide');
  append(managerPage,make('div','バックアップは同じページURLごとに保存されます。保存領域は同一サイト内です。フォーム入力欄の値は個人情報保護のため保存しません。復元表示はJavaScriptを停止した静的ページで、元のページを置き換えません。','hint'));
  append(managerPage,make('div','スタイル管理','section-title'));
  append(managerPage,make('div','選択要素の色・文字・余白などをデザインセットとして登録し、別の要素に再利用できます。','hint'));
  var styleNameInput = inputField(managerPage,'デザインセット名','text','','例：ブランドカラーのカード');
  button(managerPage,'🎨 選択要素のデザインを登録',saveStyleToken,'wide');
  var styleLibraryList = append(managerPage,make('div',null,'manager-list'));
  button(managerPage,'🔄 デザイン一覧を更新',refreshStyleLibrary,'wide');

  var dbPromise = null;
  function openStudioDB() {
    if (!win.indexedDB) return Promise.reject(new Error('このブラウザーではページ保存機能を利用できません。'));
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function(resolve,reject){
      var request=win.indexedDB.open('ultra_modder_v6_storage',1);
      request.onupgradeneeded=function(){var db=request.result;if(!db.objectStoreNames.contains('records'))db.createObjectStore('records',{keyPath:'id'});};
      request.onsuccess=function(){resolve(request.result);};
      request.onerror=function(){reject(request.error||new Error('保存領域を開けませんでした。'));};
    });
    return dbPromise;
  }
  function dbPut(record) { return openStudioDB().then(function(db){return new Promise(function(resolve,reject){var tx=db.transaction('records','readwrite');tx.objectStore('records').put(record);tx.oncomplete=function(){resolve(record);};tx.onerror=function(){reject(tx.error||new Error('保存に失敗しました。'));};});}); }
  function dbGet(id) { return openStudioDB().then(function(db){return new Promise(function(resolve,reject){var req=db.transaction('records','readonly').objectStore('records').get(id);req.onsuccess=function(){resolve(req.result||null);};req.onerror=function(){reject(req.error);};});}); }
  function dbAll() { return openStudioDB().then(function(db){return new Promise(function(resolve,reject){var req=db.transaction('records','readonly').objectStore('records').getAll();req.onsuccess=function(){resolve(req.result||[]);};req.onerror=function(){reject(req.error);};});}); }
  function dbDelete(id) { return openStudioDB().then(function(db){return new Promise(function(resolve,reject){var tx=db.transaction('records','readwrite');tx.objectStore('records').delete(id);tx.oncomplete=function(){resolve();};tx.onerror=function(){reject(tx.error);};});}); }
  function pageOrigin() { return win.location.origin || 'local-file'; }
  function autoBackupId() { return 'backup:'+win.location.href; }
  function recordTime(value) { try{return new Date(value).toLocaleString('ja-JP');}catch(e){return ''; } }
  function downloadHTMLText(html,name) {
    var url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));
    var link=doc.createElement('a');link.href=url;link.download=safeName(name)+'.html';link.style.display='none';doc.body.appendChild(link);link.click();link.remove();win.setTimeout(function(){URL.revokeObjectURL(url);},3000);
  }
  function showHTMLInNewTab(html) {
    var url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));
    var link=doc.createElement('a');link.href=url;link.target='_blank';link.rel='noopener';link.style.display='none';doc.body.appendChild(link);link.click();link.remove();win.setTimeout(function(){URL.revokeObjectURL(url);},60000);
  }
  function saveProjectPage() {
    var name=String(pageNameInput.value||doc.title||'編集ページ').trim();if(!name)return setStatus('ページ名を入力してください。');
    var html;try{html=buildStaticHTML(true);}catch(e){return setStatus('ページを保存できませんでした：'+e.message);}
    var record={id:'page:'+pageOrigin()+':'+Date.now()+':'+Math.random().toString(36).slice(2,7),kind:'page',origin:pageOrigin(),url:win.location.href,title:name,html:html,updatedAt:Date.now()};
    dbPut(record).then(function(){setStatus('「'+name+'」をページ一覧に保存しました。');refreshPageLibrary();}).catch(function(e){setStatus('ページ保存に失敗しました：'+e.message);});
  }
  function refreshPageLibrary() {
    if(!pageLibraryList)return;pageLibraryList.textContent='';
    dbAll().then(function(items){
      var records=items.filter(function(item){return item.kind==='page'&&item.origin===pageOrigin();}).sort(function(a,b){return b.updatedAt-a.updatedAt;});
      if(!records.length){append(pageLibraryList,make('div','保存したページはまだありません。','info'));return;}
      records.forEach(function(record){
        var item=append(pageLibraryList,make('div',null,'manager-item'));
        append(item,make('div',record.title,'manager-item-head'));
        append(item,make('div',record.url+'\n保存日時：'+recordTime(record.updatedAt),'manager-item-meta')).style.whiteSpace='pre-wrap';
        var actions=append(item,make('div',null,'manager-item-actions'));
        button(actions,'プレビュー',function(){openStoredPage(record);},'');
        button(actions,'HTMLを書き出す',function(){downloadHTMLText(record.html,record.title);},'');
        button(actions,'削除',function(){if(!win.confirm('「'+record.title+'」を削除しますか？'))return;dbDelete(record.id).then(refreshPageLibrary).catch(function(e){setStatus('削除できませんでした：'+e.message);});},'');
      });
    }).catch(function(e){append(pageLibraryList,make('div','ページ一覧を読み込めませんでした：'+e.message,'info'));});
  }
  function openStoredPage(record) {
    try { previewFrame.srcdoc=record.html; previewLayer.style.display='flex'; state.previewOpen=true; setPreviewWidth(1280,'保存ページ'); setStatus('保存したページ「'+record.title+'」を静的プレビューで開きました。'); }
    catch(e){setStatus('プレビューを開けませんでした：'+e.message);}
  }
  function saveAutoBackupNow() {
    if(!state.autoBackupEnabled)return setStatus('自動バックアップが無効です。先に有効にしてください。');
    var html;try{html=buildStaticHTML(true);}catch(e){return setStatus('バックアップを作成できませんでした：'+e.message);}
    var record={id:autoBackupId(),kind:'backup',origin:pageOrigin(),url:win.location.href,title:doc.title||'自動バックアップ',html:html,updatedAt:Date.now()};
    dbPut(record).then(function(){state.autoBackupLastAt=Date.now();backupStatus.textContent='最終バックアップ：'+recordTime(record.updatedAt)+'\nこのURLの編集内容を保存しました。';setStatus('自動バックアップを保存しました。フォーム入力欄の値は含めていません。');}).catch(function(e){backupStatus.textContent='バックアップに失敗しました：'+e.message;setStatus('自動バックアップに失敗しました：'+e.message);});
  }
  function loadAutoBackupRecord() { return dbGet(autoBackupId()); }
  function openAutoBackup() {
    loadAutoBackupRecord().then(function(record){if(!record)return setStatus('このページの自動バックアップは見つかりませんでした。');previewFrame.srcdoc=record.html;previewLayer.style.display='flex';state.previewOpen=true;setPreviewWidth(1280,'バックアップ');setStatus('自動バックアップをプレビュー表示しました。元ページは変更していません。');}).catch(function(e){setStatus('バックアップを読み込めませんでした：'+e.message);});
  }
  function exportAutoBackup() {
    loadAutoBackupRecord().then(function(record){if(!record)return setStatus('書き出せる自動バックアップがありません。');downloadHTMLText(record.html,(record.title||'ページ')+'バックアップ');setStatus('自動バックアップをHTMLファイルとして書き出しました。');}).catch(function(e){setStatus('バックアップを書き出せませんでした：'+e.message);});
  }
  function toggleAutoBackup() {
    state.autoBackupEnabled=!state.autoBackupEnabled;
    autoBackupToggle.textContent='自動バックアップ：'+(state.autoBackupEnabled?'有効':'無効');
    if(!state.autoBackupEnabled){if(state.autoBackupTimer)win.clearTimeout(state.autoBackupTimer);state.autoBackupTimer=null;backupStatus.textContent='自動バックアップは無効です。';}
    else {backupStatus.textContent='自動バックアップを有効にしました。';saveAutoBackupNow();}
  }
  function scheduleAutoBackup() {
    if(!state.autoBackupEnabled)return;
    if(state.autoBackupTimer)win.clearTimeout(state.autoBackupTimer);
    var wait=Math.max(5000,15000-(Date.now()-state.autoBackupLastAt));
    state.autoBackupTimer=win.setTimeout(function(){state.autoBackupTimer=null;saveAutoBackupNow();},wait);
  }
  function startAutoBackupObserver() {
    if(!win.MutationObserver||!doc.body)return;
    state.autoBackupObserver=new MutationObserver(function(records){
      var recentUserEdit = Date.now() - (state.lastUserEditAt || 0) < 3000;
      if (!recentUserEdit) return;
      var meaningful=records.some(function(record){var target=record.target&&record.target.nodeType===1?record.target:record.target&&record.target.parentElement;return target&&!host.contains(target)&&!(target.closest&&target.closest('[data-u-studio-v6-host]'));});
      if(meaningful)scheduleAutoBackup();
    });
    state.autoBackupObserver.observe(doc.body,{subtree:true,childList:true,attributes:true,characterData:true});
  }
  var STYLE_STORAGE_KEY='__ultra_modder_v6_styles__';
  function readStyleTokens(){try{return JSON.parse(win.localStorage.getItem(STYLE_STORAGE_KEY)||'[]');}catch(e){return [];}}
  function writeStyleTokens(items){try{win.localStorage.setItem(STYLE_STORAGE_KEY,JSON.stringify(items));return true;}catch(e){setStatus('デザイン保存領域がいっぱいか、利用できません。');return false;}}
  function selectedStyleToken() {
    var el=selectedElement();if(!el)return null;var cs=win.getComputedStyle(el);
    return {'background-color':cs.backgroundColor,'color':cs.color,'font-family':cs.fontFamily,'font-size':cs.fontSize,'font-weight':cs.fontWeight,'text-align':cs.textAlign,'border-radius':cs.borderRadius,'padding':cs.padding,'margin':cs.margin,'width':cs.width,'height':cs.height,'display':cs.display};
  }
  function saveStyleToken() {
    var targets=selectedElements();if(targets.length!==1)return setStatus('デザインセットは要素を1つだけ選択して登録してください。');
    var name=String(styleNameInput.value||'').trim();if(!name)return setStatus('デザインセット名を入力してください。');
    var tokens=readStyleTokens();tokens.unshift({id:'style:'+Date.now()+':'+Math.random().toString(36).slice(2,6),name:name,origin:pageOrigin(),styles:selectedStyleToken(),updatedAt:Date.now()});
    if(writeStyleTokens(tokens.slice(0,50))){styleNameInput.value='';refreshStyleLibrary();setStatus('デザインセット「'+name+'」を登録しました。');}
  }
  function applyStyleToken(token) {
    var targets=selectedElements();if(!targets.length)return setStatus('適用先の要素を選択してください。');
    if(targets.some(isLockedElement))return setStatus('ロック中の要素が含まれています。');
    var before=targets.map(function(el){return {el:el,style:snapshotStyle(el)};});
    targets.forEach(function(el){Object.keys(token.styles||{}).forEach(function(prop){var value=token.styles[prop];if(value&&value!=='auto'&&value!=='none')el.style.setProperty(prop,value);});});
    var after=targets.map(function(el){return {el:el,style:snapshotStyle(el)};});
    pushAction('デザインセット「'+token.name+'」を適用',function(){before.forEach(function(x){restoreStyle(x.el,x.style);});},function(){after.forEach(function(x){restoreStyle(x.el,x.style);});});
    refreshInspector();setStatus('デザインセット「'+token.name+'」を'+targets.length+'個の要素に適用しました。');
  }
  function refreshStyleLibrary() {
    if(!styleLibraryList)return;styleLibraryList.textContent='';
    var tokens=readStyleTokens().filter(function(item){return !item.origin||item.origin===pageOrigin();});
    if(!tokens.length){append(styleLibraryList,make('div','登録済みのデザインセットはありません。','info'));return;}
    tokens.forEach(function(token){var item=append(styleLibraryList,make('div',null,'manager-item'));append(item,make('div',token.name,'manager-item-head'));append(item,make('div','登録日時：'+recordTime(token.updatedAt),'manager-item-meta'));var actions=append(item,make('div',null,'manager-item-actions'));button(actions,'選択要素へ適用',function(){applyStyleToken(token);},'');button(actions,'削除',function(){var all=readStyleTokens().filter(function(x){return x.id!==token.id;});writeStyleTokens(all);refreshStyleLibrary();setStatus('デザインセットを削除しました。');},'');});
  }

  // ----- 端末別の表示確認 -----
  var previewLayer = append(shadow, make('div', null, 'preview-layer'));
  var previewShell = append(previewLayer, make('section', null, 'preview-shell'));
  var previewHead = append(previewShell, make('div', null, 'preview-head'));
  append(previewHead, make('strong', '端末別の表示確認'));
  var previewButtons = append(previewHead, make('div', null, 'preview-buttons'));
  var previewWidthLabel = append(previewHead, make('span', '画面幅：390px', 'preview-caption'));
  var previewCustom = append(previewHead, make('div', null, 'preview-custom'));
  var previewCustomLabel = append(previewCustom, make('label', '幅を指定'));
  var previewCustomInput = append(previewCustom, make('input'));
  previewCustomInput.type = 'number'; previewCustomInput.min = '240'; previewCustomInput.max = '1920'; previewCustomInput.step = '10'; previewCustomInput.value = '390'; previewCustomInput.setAttribute('aria-label','プレビュー幅');
  var previewCanvas = append(previewShell, make('div', null, 'preview-canvas'));
  var previewFrame = append(previewCanvas, make('iframe', null, 'preview-frame'));
  previewFrame.setAttribute('title', '編集内容の端末別プレビュー');
  previewFrame.setAttribute('sandbox', 'allow-same-origin');
  previewFrame.setAttribute('referrerpolicy', 'no-referrer');
  var previewDevices = [
    { label: 'パソコン', width: 1280 },
    { label: 'タブレット', width: 768 },
    { label: 'スマートフォン', width: 390 },
    { label: 'スマホ横向き', width: 844 },
    { label: 'タブレット横向き', width: 1024 }
  ];
  function setPreviewWidth(width, label) {
    previewFrame.style.width = width + 'px';
    previewFrame.style.height = Math.max(320, Math.floor(win.innerHeight * 0.78)) + 'px';
    previewWidthLabel.textContent = label + '：' + width + 'px';
    previewCustomInput.value = String(width);
    previewDevices.forEach(function (device, index) {
      var button = previewButtons.children[index];
      if (button) button.classList.toggle('primary', device.width === width);
    });
  }
  previewDevices.forEach(function (device) {
    button(previewButtons, device.label, function () { setPreviewWidth(device.width, device.label); }, '');
  });
  button(previewCustom, 'この幅で確認', function () {
    var width = Math.max(240,Math.min(1920,Math.round(Number(previewCustomInput.value)||390)));
    setPreviewWidth(width,'指定サイズ');
  }, '');
  button(previewCustom, '表示を更新', function () {
    try { previewFrame.srcdoc = buildStaticHTML(); setStatus('編集内容をプレビューに反映しました。'); }
    catch (error) { setStatus('プレビューを更新できませんでした：'+error.message); }
  }, '');
  button(previewButtons, '閉じる', closeResponsivePreview, '');
  function openResponsivePreview() {
    try {
      var html = buildStaticHTML();
      previewFrame.srcdoc = html;
      previewLayer.style.display = 'flex';
      state.previewOpen = true;
      setPreviewWidth(390, 'スマートフォン');
      setStatus('端末別の表示確認を開きました。スクリプトを停止した静的表示です。');
    } catch (error) { setStatus('表示確認を開けませんでした: ' + error.message); }
  }
  function closeResponsivePreview() {
    previewLayer.style.display = 'none';
    previewFrame.srcdoc = 'about:blank';
    state.previewOpen = false;
  }



  // ----- Before / after comparison -----
  var baselineHTML='';
  var baselineCaptureSkipped=false;
  var compareLayer=append(shadow,make('div',null,'compare-layer'));
  var compareShell=append(compareLayer,make('section',null,'compare-shell'));
  var compareHeader=append(compareShell,make('div',null,'preview-head'));
  append(compareHeader,make('strong','変更前・変更後の比較'));
  var compareActions=append(compareHeader,make('div',null,'compare-actions'));
  button(compareActions,'比較元を現在の状態に更新',captureComparisonBaseline,'');
  button(compareActions,'閉じる',closeComparison,'');
  var comparePanes=append(compareShell,make('div',null,'compare-panes'));
  var beforePane=append(comparePanes,make('div',null,'compare-pane'));append(beforePane,make('strong','変更前'));var beforeFrame=append(beforePane,make('iframe'));beforeFrame.setAttribute('sandbox','allow-same-origin');beforeFrame.setAttribute('title','変更前のページ');
  var afterPane=append(comparePanes,make('div',null,'compare-pane'));append(afterPane,make('strong','変更後'));var afterFrame=append(afterPane,make('iframe'));afterFrame.setAttribute('sandbox','allow-same-origin');afterFrame.setAttribute('title','変更後のページ');
  function captureComparisonBaseline(){try{baselineHTML=buildStaticHTML(false);baselineCaptureSkipped=false;setStatus('現在の状態を比較元として記録しました。');}catch(e){setStatus('比較元を記録できませんでした：'+e.message);}}
  function scheduleInitialBaselineCapture(){
    var capture=function(){
      if(baselineHTML)return;
      try{
        if(doc.body.getElementsByTagName('*').length>2500){baselineCaptureSkipped=true;return;}
        baselineHTML=buildStaticHTML(false);
      }catch(e){baselineHTML='';}
    };
    if(typeof win.requestIdleCallback==='function')win.requestIdleCallback(capture,{timeout:5000});
    else win.setTimeout(capture,1200);
  }
  function openComparison(){try{if(!baselineHTML){if(baselineCaptureSkipped){setStatus('このページは大規模なため比較元の自動取得を省略しました。編集前の状態で「比較元を現在の状態に更新」を押してください。');return;}captureComparisonBaseline();}if(!baselineHTML)return;beforeFrame.srcdoc=baselineHTML;afterFrame.srcdoc=buildStaticHTML(false);compareLayer.style.display='flex';state.compareOpen=true;setStatus('変更前と変更後を並べて表示しています。');}catch(e){setStatus('比較画面を開けませんでした：'+e.message);}}
  function closeComparison(){compareLayer.style.display='none';beforeFrame.srcdoc='about:blank';afterFrame.srcdoc='about:blank';state.compareOpen=false;}

  // ----- Dialogs -----
  function closeDialog() {
    if (state.dialog && state.dialog.parentNode) state.dialog.remove();
    state.dialog = null; state.pendingFile = null;
  }
  function dialog(title, fields, submit, options) {
    closeDialog(); options = options || {};
    var box = append(shadow, make('div', null, 'dialog'));
    state.dialog = box;
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    append(box, make('div', title, 'dialog-title'));
    var inputs = [];
    fields.forEach(function (field) { inputs.push(inputField(box, field.label, field.type || 'text', field.value || '', field.placeholder || '')); });
    if (options.hint) append(box, make('div', options.hint, 'hint'));
    var actions = append(box, make('div', null, 'dialog-actions'));
    if (options.file) {
      button(actions, options.multiple ? '画像ファイルを選択（複数可）' : '画像ファイルを選択', function () {
        state.pendingFile = function (files) { closeDialog(); options.file(files); };
        fileInput.multiple = !!options.multiple; fileInput.value = ''; fileInput.click();
      }, 'secondary');
    }
    button(actions, 'キャンセル', closeDialog, 'secondary');
    var ok = button(actions, options.ok || '適用', function () { var values = inputs.map(function (input) { return input.value; }); closeDialog(); submit(values); }, 'primary');
    if (inputs[0]) {
      inputs[0].focus();
      inputs[0].addEventListener('keydown', function (event) { if (event.key === 'Enter' && inputs.length === 1) { event.preventDefault(); ok.click(); } });
    }
  }
  fileInput.addEventListener('change', function () {
    var files = Array.prototype.slice.call(fileInput.files || []).filter(function (file) { return /^image\//i.test(file.type); });
    if (!files.length) return setStatus('画像ファイルを選択してください。');
    var callback = state.pendingFile; state.pendingFile = null;
    if (!callback) return;
    Promise.all(files.map(function (file) {
      return new Promise(function (resolve) {
        var reader = new FileReader();
        reader.onload = function () { resolve({ data: reader.result, file: file }); };
        reader.onerror = function () { resolve(null); };
        reader.readAsDataURL(file);
      });
    })).then(function (items) { callback(items.filter(Boolean)); });
  });
  function normalizeURL(value, allowMail) {
    var text = String(value || '').trim(); if (!text) return null;
    try {
      var url = new URL(text, doc.baseURI || win.location.href);
      var allowed = allowMail ? ['http:','https:','mailto:','tel:'] : ['http:','https:','data:','blob:'];
      if (allowed.indexOf(url.protocol) < 0) return null;
      if (url.protocol === 'data:' && !/^data:image\//i.test(text)) return null;
      return url.href;
    } catch (error) { return null; }
  }
  function imageDialog(title, callback, multiple) {
    dialog(title, [{ label: '画像のアドレス', value: 'https://', placeholder: 'https://example.com/image.jpg' }], function (values) {
      var url = normalizeURL(values[0], false);
      if (!url) return setStatus('画像のアドレスが無効です。httpまたはhttpsで始まるアドレス、または画像データを入力してください。');
      callback([{ data: url, file: null }]);
    }, { file: function (files) { callback(files); }, multiple: multiple, hint: 'アドレスを入力するか、ローカル画像ファイルを選択できます。複数選択にも対応しています。' });
  }
  function addLink() {
    var range = currentRange() || state.savedRange;
    if (!range) return setStatus('リンクにしたい文字を先に選択してください。');
    state.savedRange = range.cloneRange();
    dialog('選択した文字にリンクを設定', [{ label: 'リンク先アドレス', value: 'https://', placeholder: 'https://example.com' }], function (values) {
      var url = normalizeURL(values[0], true);
      if (!url) return setStatus('アドレスが無効です。この形式のリンク先は使用できません。');
      if (!state.editing) setEditing(true);
      if (!restoreRange(range)) return setStatus('選択範囲が失われました。もう一度選択してください。');
      try { doc.execCommand('createLink', false, url); setStatus('リンクを設定しました。'); }
      catch (error) { setStatus('リンクを設定できませんでした: ' + error.message); }
      state.savedRange = null;
    }, { hint: 'ウェブページ・メール・電話番号へのリンクに対応しています。危険な形式のアドレスは使用できません。' });
  }
  function replaceTextDialog() {
    dialog('本文テキストを一括置換', [
      { label: '置換前', value: '', placeholder: '検索する文字列' },
      { label: '置換後', value: '', placeholder: '空欄なら削除' }
    ], function (values) {
      var find = values[0], replacement = values[1];
      if (!find) return setStatus('置換前の文字列を入力してください。');
      var skip = { SCRIPT:1, STYLE:1, TEXTAREA:1, NOSCRIPT:1, INPUT:1, SELECT:1, OPTION:1 };
      var walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
      var nodes = []; var total = 0; var textNode;
      while ((textNode = walker.nextNode())) {
        var parent = textNode.parentElement; var ignored = false;
        while (parent && parent !== doc.body) {
          if (skip[parent.tagName] || parent.getAttribute('contenteditable') === 'false' || host.contains(parent)) { ignored = true; break; }
          parent = parent.parentElement;
        }
        if (!ignored && textNode.nodeValue.indexOf(find) !== -1) {
          var oldValue = textNode.nodeValue; var pieces = oldValue.split(find);
          total += pieces.length - 1; nodes.push({ node: textNode, oldValue: oldValue, newValue: pieces.join(replacement) });
        }
      }
      nodes.forEach(function (item) { item.node.nodeValue = item.newValue; });
      if (nodes.length) pushAction('テキスト置換 ' + total + '件',
        function () { nodes.forEach(function (item) { item.node.nodeValue = item.oldValue; }); },
        function () { nodes.forEach(function (item) { item.node.nodeValue = item.newValue; }); });
      setStatus('テキスト置換: ' + total + '件。タグ・属性・アドレス・スクリプトや装飾設定は変更していません。');
    }, { hint: '文字の部分だけが対象です。ページの構造や属性値は変更しません。' });
  }

  // ----- Page helpers and image processing -----
  function uiEvent(event) {
    var path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    return path.indexOf(host) >= 0 || event.target === host || host.contains(event.target);
  }
  function elementFromEvent(event) {
    var path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    var element = null;
    for (var i = 0; i < path.length; i++) { if (path[i] && path[i].nodeType === 1 && path[i] !== host && !host.contains(path[i])) { element = path[i]; break; } }
    if (!element && event.target && event.target.nodeType === 1) element = event.target;
    if (event.altKey && element && element.parentElement && element.parentElement !== doc.body) element = element.parentElement;
    return element;
  }
  function mediaAt(x, y) {
    var elements = doc.elementsFromPoint ? doc.elementsFromPoint(x, y) : [doc.elementFromPoint(x, y)];
    for (var i = 0; i < elements.length; i++) {
      var current = elements[i];
      if (!current || current === host || host.contains(current)) continue;
      var depth = 0;
      while (current && current !== doc.body && depth++ < 10) {
        var tag = current.tagName ? current.tagName.toLowerCase() : '';
        if (tag === 'img') return { kind:'img', element:current, picture:current.closest('picture') };
        if (tag === 'picture') { var img = current.querySelector('img'); if (img) return { kind:'img', element:img, picture:current }; }
        if (tag === 'image' && current.namespaceURI && current.namespaceURI.indexOf('svg') >= 0) return { kind:'svg', element:current };
        var bg = ''; try { bg = win.getComputedStyle(current).backgroundImage || ''; } catch (e) {}
        if (bg && bg !== 'none' && /url\(/i.test(bg)) return { kind:'background', element:current };
        if (current.hasAttribute && ['data-bg','data-background','data-background-image'].some(function (name) { return current.hasAttribute(name); })) return { kind:'background', element:current };
        current = current.parentElement;
      }
    }
    return null;
  }
  function attrSnapshot(element, names) {
    var attrs = {}; names.forEach(function (name) { attrs[name] = { had:element.hasAttribute(name), value:element.getAttribute(name) }; });
    return { element:element, attrs:attrs };
  }
  function restoreAttrSnapshots(list) {
    list.forEach(function (item) { Object.keys(item.attrs).forEach(function (name) { var attr = item.attrs[name]; if (attr.had) item.element.setAttribute(name, attr.value); else item.element.removeAttribute(name); }); });
  }
  function setMedia(media, url) {
    if (!media || !media.element) return false;
    var e = media.element; var snapshots = [];
    if (media.kind === 'img') {
      snapshots.push(attrSnapshot(e, ['src','srcset','sizes','loading','data-src','data-srcset','data-original']));
      e.setAttribute('src', url); e.removeAttribute('srcset'); e.removeAttribute('sizes'); e.setAttribute('loading','eager');
      ['data-src','data-srcset','data-original'].forEach(function (name) { e.removeAttribute(name); });
      if (media.picture) Array.prototype.forEach.call(media.picture.querySelectorAll('source'), function (source) { snapshots.push(attrSnapshot(source,['srcset','sizes','data-srcset'])); source.removeAttribute('srcset'); source.removeAttribute('sizes'); source.removeAttribute('data-srcset'); });
    } else if (media.kind === 'svg') {
      snapshots.push(attrSnapshot(e,['href','xlink:href'])); e.setAttribute('href',url); e.removeAttribute('xlink:href');
    } else {
      snapshots.push(attrSnapshot(e,['style','data-bg','data-background','data-background-image']));
      e.style.backgroundImage = 'url(' + JSON.stringify(url) + ')';
      ['data-bg','data-background','data-background-image'].forEach(function (name) { e.removeAttribute(name); });
    }
    var after = snapshots.map(function (item) { return attrSnapshot(item.element,Object.keys(item.attrs)); });
    pushAction('画像差し替え', function () { restoreAttrSnapshots(snapshots); }, function () { restoreAttrSnapshots(after); });
    state.selected = e; state.multiSelected = [e]; refreshInspector(); return true;
  }
  function protectedElement(element) {
    if (!element || !element.tagName) return true;
    return ['HTML','BODY','HEAD','SCRIPT','STYLE','META','LINK','TITLE'].indexOf(element.tagName) >= 0 || element === host;
  }
  function softHide(element) {
    if (isLockedElement(element)) return setStatus('ロック中の要素は非表示にできません。');
    if (protectedElement(element)) return setStatus('ページ全体や見出し部分などの重要な要素は非表示にできません。');
    var old = snapshotStyle(element); var oldMarker = element.hasAttribute('data-u-studio-hidden');
    element.style.setProperty('display','none','important'); element.setAttribute('data-u-studio-hidden',''); hiddenByStudio.add(element); var after = snapshotStyle(element);
    pushAction('要素を非表示', function () { restoreStyle(element,old); if (!oldMarker) element.removeAttribute('data-u-studio-hidden'); hiddenByStudio.delete(element); }, function () { restoreStyle(element,after); element.setAttribute('data-u-studio-hidden',''); hiddenByStudio.add(element); });
    state.selected = element; state.multiSelected = [element]; setStatus('要素を非表示にしました。元に戻す操作で復元できます。'); refreshInspector(); updateSelectedOutline();
  }
  function validInsertParent(element) {
    var allowed = { BODY:1,DIV:1,MAIN:1,ARTICLE:1,SECTION:1,ASIDE:1,HEADER:1,FOOTER:1,FIGURE:1,BLOCKQUOTE:1,LI:1,TD:1,TH:1 };
    var current = element;
    while (current && current !== doc.documentElement) { if (allowed[current.tagName]) return current; current = current.parentElement; }
    return doc.body;
  }
  function insertImage(target, url, file) {
    var img = doc.createElement('img'); img.src = url; img.alt = file && file.name ? file.name : '追加画像'; img.loading = 'eager';
    img.style.cssText = 'max-width:100%;height:auto;display:block;margin:8px 0'; img.setAttribute('data-u-studio-added','');
    var parent = validInsertParent(target || doc.body);
    if (!parent || !parent.isConnected) parent = doc.body;
    var anchor = null;
    var current = target;
    while (current && current !== parent) {
      if (/^(P|H[1-6]|FIGURE|IMG|VIDEO|CANVAS|BLOCKQUOTE|PRE|HR)$/.test(current.tagName) && current.parentElement === parent) { anchor = current; break; }
      current = current.parentElement;
    }
    if (!anchor && target && target.parentElement === parent && !/^(HTML|HEAD|TABLE|TBODY|THEAD|TFOOT|TR|UL|OL|DL|SELECT|OPTION)$/.test(target.tagName)) anchor = target;
    if (anchor) anchor.after(img); else parent.appendChild(img);
    pushAction('画像を追加', function () { img.remove(); }, function () { if (!img.parentNode && parent.isConnected) { if (anchor && anchor.parentNode === parent) anchor.after(img); else parent.appendChild(img); } });
    state.selected = img; state.multiSelected = [img]; refreshInspector(); updateSelectedOutline();
  }
  function addImages(target, items) {
    var count = 0;
    items.slice().reverse().forEach(function (item) { if (!item || !item.data) return; insertImage(target, item.data, item.file); count++; });
    setStatus(count + '枚の画像を追加しました。元に戻す操作で1枚ずつ戻せます。');
  }

  // ----- Global event handlers -----
  function onPagePointerDown(event) {
    if (uiEvent(event) || state.mode === 'none') return;
    if (state.mode === 'visual-move') {
      if (event.type !== 'pointerdown') { event.stopPropagation(); if (event.stopImmediatePropagation) event.stopImmediatePropagation(); return; }
      event.preventDefault(); event.stopPropagation(); if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      var target = elementFromEvent(event);
      if (protectedElement(target) || isLockedElement(target)) return setStatus('この要素は移動できません。ロック状態も確認してください。');
      var computed = win.getComputedStyle(target);
      var oldStyle = snapshotStyle(target);
      var startLeft = parseFloat(computed.left); var startTop = parseFloat(computed.top);
      state.visualDrag = { id: event.pointerId, element: target, x: event.clientX, y: event.clientY, left: Number.isFinite(startLeft) ? startLeft : 0, top: Number.isFinite(startTop) ? startTop : 0, startRect: target.getBoundingClientRect(), wasStatic: computed.position === 'static', oldStyle: oldStyle, moved: false };
      try { if (event.target && event.target.setPointerCapture) event.target.setPointerCapture(event.pointerId); } catch (captureError) {}
      selectElement(target, true);
      return;
    }
    event.stopPropagation(); if (event.stopImmediatePropagation) event.stopImmediatePropagation();
  }
  function onPageInput(event) {
    if (!state.editing || uiEvent(event)) return;
    state.lastUserEditAt = Date.now();
    scheduleAutoBackup();
  }
  function onBeforeInput(event) {
    if (!state.editing) return;
    var target=event.target;
    var element=target&&target.nodeType===1?target:target&&target.parentElement;
    if (!element || !isLockedElement(element)) { var selection=win.getSelection();var anchor=selection&&selection.anchorNode;element=anchor&&anchor.nodeType===1?anchor:anchor&&anchor.parentElement; }
    if (element&&isLockedElement(element)){event.preventDefault();setStatus('ロック中の要素は文章編集できません。');}
  }
  function onPageClick(event) {
    if (uiEvent(event)) return;
    if (state.ignoreNextClick) { state.ignoreNextClick = false; event.preventDefault(); event.stopPropagation(); if (event.stopImmediatePropagation) event.stopImmediatePropagation(); return; }
    if (state.mode !== 'none') {
      event.preventDefault(); event.stopPropagation(); if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      var target = elementFromEvent(event);
      if (state.mode === 'select') { selectElement(target); setMode('none'); return; }
      if (state.mode === 'visual-move') { if (!protectedElement(target)) selectElement(target, true); return; }
      if (state.mode === 'delete') { softHide(target); return; }
      if (state.mode === 'replace') {
        var media = mediaAt(event.clientX,event.clientY);
        if (!media) return setStatus('この場所に画像がありません。別ページへの移動は止めました。');
        setMode('none'); imageDialog('画像を差し替え', function (items) { var item = items[0]; if (item && setMedia(media,item.data)) setStatus('画像を差し替えました。元に戻す操作で戻せます。'); }, false); return;
      }
      if (state.mode === 'add') {
        setMode('none'); imageDialog('画像を追加', function (items) { addImages(target,items); }, true); return;
      }
    }
    if (state.editing) {
      var path = typeof event.composedPath === 'function' ? event.composedPath() : [event.target];
      for (var i = 0; i < path.length; i++) { if (path[i] && path[i].tagName === 'A' && doc.body.contains(path[i])) { event.preventDefault(); event.stopPropagation(); if (event.stopImmediatePropagation) event.stopImmediatePropagation(); break; } }
    }
  }
  function snapDelta(value){return Math.abs(value)<7?value:0;}
  function onPointerMove(event) {
    if (state.resizeDrag && event.pointerId === state.resizeDrag.id) {
      var rd = state.resizeDrag; event.preventDefault();
      var zoomScale=(state.canvasZoom||100)/100; var width = Math.max(24, rd.width + (event.clientX - rd.x)/zoomScale); var height = Math.max(24, rd.height + (event.clientY - rd.y)/zoomScale);
      rd.element.style.width = width + 'px'; rd.element.style.height = height + 'px'; updateSelectedOutline(); return;
    }
    if (state.visualDrag && event.pointerId === state.visualDrag.id) {
      var vd = state.visualDrag; var dx = event.clientX - vd.x; var dy = event.clientY - vd.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) vd.moved = true;
      if (vd.moved) {
        event.preventDefault(); if (vd.wasStatic) vd.element.style.position = 'relative';
        var scale=(state.canvasZoom||100)/100;
        var rect=vd.startRect, desiredLeft=vd.left+dx/scale, desiredTop=vd.top+dy/scale;
        var proposed={left:rect.left+dx,top:rect.top+dy,width:rect.width,height:rect.height,right:rect.right+dx,bottom:rect.bottom+dy};
        var bestX={delta:7,pos:null},bestY={delta:7,pos:null};
        var candidateRoot=vd.element.parentElement||doc.body;var candidates=Array.prototype.slice.call(candidateRoot.children||[]).filter(function(el){return el!==vd.element&&!host.contains(el)&&el.isConnected&&el.getBoundingClientRect().width>0&&el.getBoundingClientRect().height>0;}).slice(0,120);
        var xMarks=[proposed.left,proposed.left+proposed.width/2,proposed.right],yMarks=[proposed.top,proposed.top+proposed.height/2,proposed.bottom];
        candidates.forEach(function(el){var r=el.getBoundingClientRect();[r.left,r.left+r.width/2,r.right].forEach(function(mark){xMarks.forEach(function(value){var delta=mark-value;if(Math.abs(delta)<Math.abs(bestX.delta))bestX={delta:delta,pos:mark};});});[r.top,r.top+r.height/2,r.bottom].forEach(function(mark){yMarks.forEach(function(value){var delta=mark-value;if(Math.abs(delta)<Math.abs(bestY.delta))bestY={delta:delta,pos:mark};});});});
        var snapX=bestX.pos!==null?snapDelta(bestX.delta):0,snapY=bestY.pos!==null?snapDelta(bestY.delta):0;
        var gridX=state.gridSnap?Math.round(proposed.left/state.gridSnap)*state.gridSnap-proposed.left:0;
        var gridY=state.gridSnap?Math.round(proposed.top/state.gridSnap)*state.gridSnap-proposed.top:0;
        var correctionX=bestX.pos!==null?snapX:gridX,correctionY=bestY.pos!==null?snapY:gridY;
        vd.element.style.left=(desiredLeft+correctionX/scale)+'px';vd.element.style.top=(desiredTop+correctionY/scale)+'px';
        if(bestX.pos!==null){guideV.style.display='block';guideV.style.left=bestX.pos+'px';}else if(state.gridSnap&&gridX){guideV.style.display='block';guideV.style.left=(proposed.left+gridX)+'px';}else guideV.style.display='none';
        if(bestY.pos!==null){guideH.style.display='block';guideH.style.top=bestY.pos+'px';}else if(state.gridSnap&&gridY){guideH.style.display='block';guideH.style.top=(proposed.top+gridY)+'px';}else guideH.style.display='none';
        var minX=null,minY=null;
        candidates.forEach(function(el){var r=el.getBoundingClientRect();var overlapY=proposed.bottom>r.top&&proposed.top<r.bottom;var overlapX=proposed.right>r.left&&proposed.left<r.right;if(overlapY){var gx=proposed.right<r.left?r.left-proposed.right:proposed.left>r.right?proposed.left-r.right:null;if(gx!==null&&gx>=0&&(minX===null||gx<minX))minX=gx;}if(overlapX){var gy=proposed.bottom<r.top?r.top-proposed.bottom:proposed.top>r.bottom?proposed.top-r.bottom:null;if(gy!==null&&gy>=0&&(minY===null||gy<minY))minY=gy;}});
        if(minX!==null||minY!==null){distanceGuide.textContent='横 '+(minX===null?'—':Math.round(minX)+'px')+'　縦 '+(minY===null?'—':Math.round(minY)+'px');distanceGuide.style.display='block';distanceGuide.style.left=Math.max(4,Math.min(win.innerWidth-150,proposed.left))+'px';distanceGuide.style.top=Math.max(4,Math.min(win.innerHeight-28,proposed.top-28))+'px';}else distanceGuide.style.display='none';
        updateSelectedOutline();
      }
      return;
    }
    if (state.mode === 'none' || uiEvent(event)) { hoverBox.style.display = 'none'; return; }
    var target;
    if (state.mode === 'replace') { var media = mediaAt(event.clientX,event.clientY); target = media ? media.element : null; }
    else { target = elementFromEvent(event); }
    if (!target || protectedElement(target) && state.mode === 'delete') { hoverBox.style.display = 'none'; return; }
    var r = target.getBoundingClientRect();
    if (!r || !r.width || !r.height) { hoverBox.style.display = 'none'; return; }
    hoverBox.style.display = 'block'; hoverBox.style.left = Math.max(0,r.left)+'px'; hoverBox.style.top = Math.max(0,r.top)+'px';
    hoverBox.style.width = Math.max(0,Math.min(win.innerWidth,r.right)-Math.max(0,r.left))+'px';
    hoverBox.style.height = Math.max(0,Math.min(win.innerHeight,r.bottom)-Math.max(0,r.top))+'px';
  }
  function onPagePointerUp(event) {
    if (state.resizeDrag && (!event || event.pointerId === state.resizeDrag.id)) {
      var resize = state.resizeDrag; state.resizeDrag = null;
      if (event && event.type === 'pointercancel') restoreStyle(resize.element, resize.oldStyle);
      else {
        var afterStyle = snapshotStyle(resize.element);
        if (afterStyle !== resize.oldStyle) pushAction('要素の大きさを変更', function () { restoreStyle(resize.element, resize.oldStyle); }, function () { restoreStyle(resize.element, afterStyle); });
      }
      updateSelectedOutline(); refreshInspector(); return;
    }
    if (state.visualDrag && (!event || event.pointerId === state.visualDrag.id)) {
      var drag = state.visualDrag; state.visualDrag = null; hideGuides();
      if (event && event.type === 'pointercancel') restoreStyle(drag.element, drag.oldStyle);
      else if (drag.moved) {
        var after = snapshotStyle(drag.element);
        pushAction('要素をドラッグして配置', function () { restoreStyle(drag.element, drag.oldStyle); }, function () { restoreStyle(drag.element, after); });
        state.ignoreNextClick = true;
        setStatus('要素を移動しました。元に戻す操作で戻せます。');
      }
      updateSelectedOutline(); refreshInspector();
    }
  }
  resizeGrip.addEventListener('pointerdown', function (event) {
    var element = selectedElement(); if (!element || event.button !== undefined && event.button !== 0) return;
    event.preventDefault(); event.stopPropagation();
    var rect = element.getBoundingClientRect();
    var resizeScale=(state.canvasZoom||100)/100; state.resizeDrag = { id: event.pointerId, element: element, x: event.clientX, y: event.clientY, width: rect.width/resizeScale, height: rect.height/resizeScale, oldStyle: snapshotStyle(element) };
    try { resizeGrip.setPointerCapture(event.pointerId); } catch (error) {}
    setStatus('右下のハンドルをドラッグして大きさを変更します。');
  });

  function hasFiles(event) { var types = event.dataTransfer && event.dataTransfer.types; try { return types && Array.prototype.indexOf.call(types,'Files') >= 0; } catch (e) { return false; } }
  function onDragOver(event) { if (!uiEvent(event) && hasFiles(event)) event.preventDefault(); }
  function onDrop(event) {
    if (uiEvent(event) || !hasFiles(event)) return;
    event.preventDefault(); event.stopPropagation(); if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    var files = Array.prototype.slice.call(event.dataTransfer.files || []).filter(function (file) { return /^image\//i.test(file.type); });
    if (!files.length) return setStatus('画像ファイルをドロップしてください。');
    if (state.mode !== 'add') return setStatus('ファイルのページ遷移を防ぎました。画像を追加するには画像追加モードを使ってください。');
    var pointTarget = doc.elementFromPoint(event.clientX,event.clientY) || doc.body;
    Promise.all(files.map(function (file) { return new Promise(function (resolve) { var reader = new FileReader(); reader.onload = function () { resolve({data:reader.result,file:file}); }; reader.onerror = function () { resolve(null); }; reader.readAsDataURL(file); }); }))
      .then(function (items) { addImages(pointTarget,items.filter(Boolean)); });
  }
  function onKeyDown(event) {
    if (event.key === 'Escape') {
      if (state.compareOpen) closeComparison();
      else if (state.previewOpen) closeResponsivePreview();
      else if (state.dialog) closeDialog();
      else if (state.mode !== 'none') setMode('none');
      return;
    }
    var path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    var inUI = path.indexOf(host) >= 0;
    var target = path.length ? path[0] : event.target;
    var typing = target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable);
    if ((event.ctrlKey || event.metaKey) && !typing) {
      var key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) { event.preventDefault(); undo(); }
      else if (key === 'y' || (key === 'z' && event.shiftKey)) { event.preventDefault(); redo(); }
      else if (key === 's') { event.preventDefault(); saveHTML(); }
    }
    if (!typing && !event.ctrlKey && !event.metaKey && !event.altKey && event.key === 'Delete' && selectedElement()) {
      event.preventDefault();
      var targetsToHide = selectedElements();
      if (targetsToHide.length > 1) toggleSelectedVisibility(); else softHide(selectedElement());
      return;
    }
    if (!typing && event.altKey && event.key === 'ArrowUp' && selectedElement()) {
      event.preventDefault(); selectParent(); return;
    }
    if (!typing && event.altKey && event.key === 'ArrowLeft' && selectedElement()) {
      event.preventDefault(); moveSelectedUp(); return;
    }
    if (!typing && event.altKey && event.key === 'ArrowRight' && selectedElement()) {
      event.preventDefault(); moveSelectedDown(); return;
    }
    if (!typing && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd' && selectedElement()) {
      event.preventDefault(); duplicateSelected(); return;
    }
    if (!typing && event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault(); selectTab(1); treeSearch.focus(); return;
    }
    if (inUI && event.key === 'Enter' && state.dialog) return;
  }

  // ----- Display helpers -----
  function toggleDark() {
    var existing = doc.querySelector('style[data-u-studio-page="dark"]');
    if (existing) { existing.remove(); state.dark = false; host.style.filter = ''; darkButton.textContent = '🕶️ サイトを暗く表示：無効'; setStatus('強制暗色表示を解除しました。'); return; }
    var s = doc.createElement('style'); s.setAttribute('data-u-studio-page','dark');
    s.textContent = 'html{filter:invert(1) hue-rotate(180deg)!important} img,video,canvas,svg,picture,[style*="background-image"]{filter:invert(1) hue-rotate(180deg)!important}';
    (doc.head || doc.documentElement).appendChild(s); state.dark = true; host.style.filter = 'invert(1) hue-rotate(180deg)';
    darkButton.textContent = '🕶️ サイトを暗く表示：有効'; setStatus('強制暗色表示を適用しました。一部画像・固定UIの色はずれることがあります。');
  }
  function toggleOutlines() {
    var existing = doc.querySelector('style[data-u-studio-page="outlines"]');
    if (existing) { existing.remove(); state.outlines = false; outlineButton.textContent = '📐 全要素の枠線：無効'; setStatus('枠線を解除しました。'); return; }
    var s = doc.createElement('style'); s.setAttribute('data-u-studio-page','outlines');
    s.textContent = 'body *:not([data-u-studio-v2-host]){outline:1px solid rgba(99,102,241,.42)!important}';
    (doc.head || doc.documentElement).appendChild(s); state.outlines = true; outlineButton.textContent = '📐 全要素の枠線：有効'; setStatus('全要素の枠線を表示しました。');
  }
  function resetToolbarPosition() { host.style.left = 'auto'; host.style.right = '14px'; host.style.top = '14px'; setStatus('ツールバーを右上へ戻しました。'); }

  // ----- Static HTML export -----
  function safeName(title) {
    var value = String(title || '').replace(/[\\/:*?"<>|]/g,'_').replace(/[\u0000-\u001f]/g,'_').replace(/[. ]+$/g,'').trim();
    return value || '編集済みページ';
  }
  function buildStaticHTML(safeBackup) {
    var clone = doc.documentElement.cloneNode(true);
    var uiClone = clone.querySelector('[data-u-studio-v2-host]'); if (uiClone) uiClone.remove();
    clone.querySelectorAll('script,style[data-u-studio-page],[data-u-placeholder]').forEach(function (node) { node.remove(); });
    var all = [clone].concat(Array.prototype.slice.call(clone.querySelectorAll('*')));
    all.forEach(function (node) {
      node.removeAttribute('contenteditable'); node.removeAttribute('data-ee'); node.removeAttribute('data-u-studio-added'); node.removeAttribute('data-u-studio-hidden'); node.removeAttribute('data-u-studio-locked');
      Array.prototype.slice.call(node.attributes || []).forEach(function (attr) {
        var name = attr.name.toLowerCase();
        if (/^on/.test(name)) node.removeAttribute(attr.name);
        else if (['href','src','xlink:href','action','formaction'].indexOf(name) >= 0 && /^\s*javascript:/i.test(attr.value)) node.removeAttribute(attr.name);
      });
    });
    var liveInputs = doc.querySelectorAll('input'), copyInputs = clone.querySelectorAll('input');
    for (var i = 0; i < Math.min(liveInputs.length, copyInputs.length); i++) {
      var source = liveInputs[i], dest = copyInputs[i];
      if (safeBackup) { dest.removeAttribute('value'); dest.removeAttribute('checked'); continue; }
      if (source.type === 'password' || source.type === 'file') continue;
      if (source.type === 'checkbox' || source.type === 'radio') { if (source.checked) dest.setAttribute('checked', ''); else dest.removeAttribute('checked'); }
      else dest.setAttribute('value', source.value);
    }
    var liveText = doc.querySelectorAll('textarea'), copyText = clone.querySelectorAll('textarea');
    for (var t = 0; t < Math.min(liveText.length, copyText.length); t++) copyText[t].textContent = safeBackup ? '' : liveText[t].value;
    var liveSelect = doc.querySelectorAll('select'), copySelect = clone.querySelectorAll('select');
    for (var si = 0; si < Math.min(liveSelect.length, copySelect.length); si++) {
      for (var oi = 0; oi < liveSelect[si].options.length && oi < copySelect[si].options.length; oi++) {
        if (!safeBackup && liveSelect[si].options[oi].selected) copySelect[si].options[oi].setAttribute('selected', ''); else copySelect[si].options[oi].removeAttribute('selected');
      }
    }
    var liveCanvas = doc.querySelectorAll('canvas'), copyCanvas = clone.querySelectorAll('canvas');
    for (var ci = 0; ci < Math.min(liveCanvas.length, copyCanvas.length); ci++) {
      try { var image = doc.createElement('img'); image.src = liveCanvas[ci].toDataURL('image/png'); image.alt = 'キャンバス画像'; copyCanvas[ci].replaceWith(image); } catch (error) {}
    }
    var head = clone.querySelector('head');
    if (head) {
      var charset = head.querySelector('meta[charset]');
      if (charset) charset.setAttribute('charset', 'UTF-8');
      else { var metaCharset = doc.createElement('meta'); metaCharset.setAttribute('charset', 'UTF-8'); head.insertBefore(metaCharset, head.firstChild); }
      var viewport = head.querySelector('meta[name="viewport"]');
      if (!viewport) { viewport = doc.createElement('meta'); viewport.setAttribute('name', 'viewport'); head.insertBefore(viewport, head.firstChild); }
      viewport.setAttribute('content', 'width=device-width, initial-scale=1');
      var base = head.querySelector('base');
      if (base) base.setAttribute('href', doc.baseURI || win.location.href);
      else { base = doc.createElement('base'); base.setAttribute('href', doc.baseURI || win.location.href); head.insertBefore(base, head.firstChild); }
    }
    var doctype = '<!DOCTYPE html>';
    if (doc.doctype) { try { doctype = new XMLSerializer().serializeToString(doc.doctype); } catch (error) {} }
    return doctype + '\n' + clone.outerHTML;
  }
  function saveHTML() {
    try {
      var html = buildStaticHTML();
      var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var link = doc.createElement('a'); link.href = url; link.download = safeName(doc.title) + '.html'; link.style.display = 'none';
      doc.body.appendChild(link); link.click(); link.remove();
      win.setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      setStatus('編集済みページを保存しました。スクリプト・イベント属性・編集パネルは除外しました。');
    } catch (error) { setStatus('ページ保存に失敗しました: ' + error.message); }
  }

  function setEditing(enabled) {
    state.editing = !!enabled;
    if (state.editing) {
      setMode('none'); doc.body.setAttribute('contenteditable','true'); doc.body.setAttribute('spellcheck','true');
      editToggle.textContent='✏️ 文章編集：有効'; editToggle.classList.add('active');
      setStatus('文章編集を有効にしました。ページ本文を直接編集できます。リンクの移動は抑止します。');
    } else {
      if (state.originalBodyEditable.had) doc.body.setAttribute('contenteditable',state.originalBodyEditable.value); else doc.body.removeAttribute('contenteditable');
      if (state.originalBodySpellcheck.had) doc.body.setAttribute('spellcheck',state.originalBodySpellcheck.value); else doc.body.removeAttribute('spellcheck');
      editToggle.textContent='✏️ 文章編集：無効'; editToggle.classList.remove('active'); setStatus('文章編集を無効にしました。');
    }
  }

  // ----- Draggable toolbar -----
  function clampToolbar() {
    var rect=host.getBoundingClientRect();var maxLeft=Math.max(0,win.innerWidth-rect.width);var maxTop=Math.max(0,win.innerHeight-Math.min(rect.height,win.innerHeight));
    host.style.left=Math.min(maxLeft,Math.max(0,rect.left))+'px';host.style.top=Math.min(maxTop,Math.max(0,rect.top))+'px';host.style.right='auto';
    updateSelectedOutline();
  }
  header.addEventListener('pointerdown',function(event){if(event.target&&event.target.closest&&event.target.closest('button'))return;if(event.button!==undefined&&event.button!==0)return;event.preventDefault();var r=host.getBoundingClientRect();state.drag={id:event.pointerId,x:event.clientX,y:event.clientY,left:r.left,top:r.top};try{header.setPointerCapture(event.pointerId);}catch(e){}});
  header.addEventListener('pointermove',function(event){if(!state.drag||event.pointerId!==state.drag.id)return;event.preventDefault();var left=state.drag.left+event.clientX-state.drag.x;var top=state.drag.top+event.clientY-state.drag.y;var maxLeft=Math.max(0,win.innerWidth-host.offsetWidth);var maxTop=Math.max(0,win.innerHeight-Math.min(host.offsetHeight,win.innerHeight));host.style.left=Math.min(maxLeft,Math.max(0,left))+'px';host.style.top=Math.min(maxTop,Math.max(0,top))+'px';host.style.right='auto';});
  function finishDrag(event){if(!state.drag||(event&&event.pointerId!==undefined&&event.pointerId!==state.drag.id))return;state.drag=null;}
  header.addEventListener('pointerup',finishDrag);header.addEventListener('pointercancel',finishDrag);header.addEventListener('lostpointercapture',finishDrag);
  minimizeBtn.addEventListener('click',function(){state.minimized=!state.minimized;content.style.display=state.minimized?'none':'block';status.style.display=state.minimized?'none':'block';minimizeBtn.textContent=state.minimized?'+':'−';minimizeBtn.setAttribute('aria-label',state.minimized?'展開':'最小化');if(!state.minimized)clampToolbar();});

  function removeListeners(){
    win.removeEventListener('click',onPageClick,true);win.removeEventListener('beforeinput',onBeforeInput,true);win.removeEventListener('input',onPageInput,true);win.removeEventListener('pointerdown',onPagePointerDown,true);win.removeEventListener('mousedown',onPagePointerDown,true);
    win.removeEventListener('pointermove',onPointerMove,true);win.removeEventListener('pointerup',onPagePointerUp,true);win.removeEventListener('pointercancel',onPagePointerUp,true);win.removeEventListener('keydown',onKeyDown,true);win.removeEventListener('dragover',onDragOver,true);win.removeEventListener('drop',onDrop,true);win.removeEventListener('resize',clampToolbar,false);win.removeEventListener('scroll',onWindowScroll,true);doc.removeEventListener('selectionchange',onSelectionChange,true);
  }
  function closeStudio(){
    if(state.autoBackupEnabled){try{saveAutoBackupNow();}catch(e){}}
    setMode('none');if(state.editing)setEditing(false);closeDialog();closeResponsivePreview();closeComparison();removeListeners();
    if(state.autoBackupObserver)state.autoBackupObserver.disconnect();if(state.autoBackupTimer)win.clearTimeout(state.autoBackupTimer);
    if(state.canvasZoomChanged){if(state.originalBodyZoom.value)doc.body.style.setProperty('zoom',state.originalBodyZoom.value,state.originalBodyZoom.priority);else doc.body.style.removeProperty('zoom');}
    hoverBox.style.display='none'; selectedBox.style.display='none'; resizeGrip.style.display='none';
    var dark=doc.querySelector('style[data-u-studio-page="dark"]');var outlines=doc.querySelector('style[data-u-studio-page="outlines"]');if(dark)dark.remove();if(outlines)outlines.remove();host.style.filter='';
    if(host.parentNode)host.remove();try{delete win[INSTANCE_KEY];}catch(e){win[INSTANCE_KEY]=null;}
  }
  closeBtn.addEventListener('click',closeStudio);

  // Install only after the UI is ready.
  doc.documentElement.appendChild(host);
  theme('dark');
  win.addEventListener('click',onPageClick,true);win.addEventListener('beforeinput',onBeforeInput,true);win.addEventListener('input',onPageInput,true);win.addEventListener('pointerdown',onPagePointerDown,true);win.addEventListener('mousedown',onPagePointerDown,true);
  win.addEventListener('pointermove',onPointerMove,true);win.addEventListener('pointerup',onPagePointerUp,true);win.addEventListener('pointercancel',onPagePointerUp,true);win.addEventListener('keydown',onKeyDown,true);win.addEventListener('dragover',onDragOver,true);win.addEventListener('drop',onDrop,true);win.addEventListener('resize',clampToolbar,false);
  function onWindowScroll() { updateSelectedOutline(); }
  function onSelectionChange() { var range = currentRange(); if (range) state.savedRange = range; }
  win.addEventListener('scroll',onWindowScroll,true);
  doc.addEventListener('selectionchange',onSelectionChange,true);
  win[INSTANCE_KEY]={
    toggle:function(){if(host.style.display==='none')host.style.display='block';else{setMode('none');host.style.display='none';}},
    close:closeStudio
  };
  doc.querySelectorAll('[data-u-studio-locked]').forEach(function(el){state.locked.add(el);});
  // Build the layer tree only when its tab is opened; large SPA pages can contain thousands of nodes.
  if (doc.querySelector('style[data-u-studio-v6-mobile]')) { state.mobileStyleNode=doc.querySelector('style[data-u-studio-v6-mobile]'); }
  // Defer the initial comparison snapshot until the browser is idle, and skip very large documents.
  scheduleInitialBaselineCapture();
  startAutoBackupObserver();
  loadAutoBackupRecord().then(function(record){if(record){backupStatus.textContent='前回の自動バックアップ：'+recordTime(record.updatedAt)+'。必要な場合は別タブで復元表示できます。';}}).catch(function(){});
  refreshPageLibrary(); refreshStyleLibrary();
  setStatus('Ultra Modder 7.0の準備ができました。均等配置・整列・グリッド吸着・距離表示・グループ名・一括ロック・ズーム・履歴検索に対応しています。');
})();