
/* child_price_killreadonly_v3.js */
(function(){
  'use strict';

  var pm = document.getElementById('perfilModal');
  if (!pm) return;

  function isChildContext(ev){
    var rt = ev && ev.relatedTarget;
    if (rt && rt.closest && rt.closest('tr.js-parent-row[data-entidad="perfil"]')) return true;
    return !!(pm.dataset && pm.dataset.context === 'child');
  }

  function form(){ return pm.querySelector('form') || pm; }
  function priceInput(){
    var f = form(); if (!f) return null;
    return f.querySelector('#modalChildPrecio') || f.querySelector('input[name="soles"]');
  }

  function cleanClones(){
    var f = form(); if (!f) return;
    f.querySelectorAll('#modalChildPrecio_display,[data-price-mount],[data-price-slot]').forEach(function(n){ n.remove(); });
    var real = priceInput(); if (!real) return;
    f.querySelectorAll('input[name="soles"]').forEach(function(el){ if (el !== real) el.remove(); });
  }

  function forceEditableValue(){
    var el = priceInput();
    if (!el) return;
    el.readOnly = false;
    el.removeAttribute('readonly');
    el.classList.remove('bg-light');
    if (!el.value || /^\s*$/.test(el.value)) el.value = '0.00';
  }

  var keepFix = null;
  function startFixLoop(){
    if (keepFix) clearInterval(keepFix);
    keepFix = setInterval(function(){
      if (!pm.classList.contains('show')) return;
      forceEditableValue(); cleanClones();
    }, 80);
  }
  function stopFixLoop(){
    if (keepFix) { clearInterval(keepFix); keepFix = null; }
  }

  document.addEventListener('click', function(e){
    var row = e.target && e.target.closest && e.target.closest('tr.js-parent-row[data-entidad="perfil"]');
    if (row){ pm.dataset.context = 'child'; }
  }, true);

  pm.addEventListener('show.bs.modal', function(ev){
    if (!isChildContext(ev)) return;
    forceEditableValue(); cleanClones();
  }, true);

  pm.addEventListener('shown.bs.modal', function(ev){
    if (!isChildContext(ev)) return;
    [0, 20, 60, 120, 240, 360].forEach(function(ms){
      setTimeout(function(){ forceEditableValue(); cleanClones(); }, ms);
    });
    startFixLoop();
  }, true);

  var mo = new MutationObserver(function(recs){
    if (!pm.classList.contains('show')) return;
    if (!(pm.dataset && pm.dataset.context === 'child')) return;
    for (var i=0;i<recs.length;i++){
      var r = recs[i];
      if (r.type === 'childList' || r.type === 'attributes') {
        forceEditableValue(); cleanClones();
        break;
      }
    }
  });
  mo.observe(pm, {childList:true, subtree:true, attributes:true});

  pm.addEventListener('hidden.bs.modal', function(){
    stopFixLoop();
    delete pm.dataset.context;
    delete pm.dataset._childAnchor;
  }, true);
})();
