
/* child_price_neutralizer_v2.js
   Objetivo: En "Agregar HIJO" (#perfilModal) el campo Precio (S/) debe quedar EDITABLE y en 0.00,
   sin heredar el precio del padre ni quedar readonly. No toca "Editar hijo" ni "Agregar padre".
   Colocar DESPUÉS de todos los demás <script> de streaming.php.
*/
(function(){
  'use strict';

  var pm = document.getElementById('perfilModal');
  if (!pm) return;

  // utilidades
  function q(sel, root){ return (root||document).querySelector(sel); }
  function qa(sel, root){ return (root||document).querySelectorAll(sel); }
  function form(){ return pm.querySelector('form') || pm; }
  function getPriceInput(){
    var f = form(); if (!f) return null;
    return f.querySelector('#modalChildPrecio') || f.querySelector('input[name="soles"]');
  }
  function scrubClones(){
    var f = form(); if (!f) return;
    // Clones/anchors habituales
    qa('#modalChildPrecio_display, [data-price-mount], [data-price-slot]', f).forEach(function(n){ n.remove(); });
    // Inputs 'soles' duplicados (conserva el real)
    var real = getPriceInput();
    qa('input[name="soles"]', f).forEach(function(el){ if (real && el !== real) el.remove(); });
  }
  function ensureRealInput(){
    var f = form(); if (!f) return null;
    var real = getPriceInput();
    if (!real){
      // intenta ubicar el contenedor original
      var group = f.querySelector('#childPriceGroup') || f.querySelector('[data-price-group]');
      real = document.createElement('input');
      real.type = 'number'; real.step = '0.01'; real.min = '0';
      real.name = 'soles'; real.id = 'modalChildPrecio';
      real.className = 'form-control';
      real.autocomplete = 'off';
      // inserta
      if (group) group.appendChild(real);
      else f.appendChild(real);
    }
    return real;
  }
  function enforceEditableZero(){
    var real = ensureRealInput(); if (!real) return;
    real.readOnly = false;
    real.removeAttribute('readonly');
    real.classList.remove('bg-light');
    // Sólo aplicar 0.00 si está vacío o trae un valor 'anclado' (no si el usuario ya escribió algo)
    if (!real.value || real.value === '0' || real.value === '0.0' || real.value === '0.00' || /^\d+(\.\d{1,2})?$/.test(real.value)) {
      // si prefieres vacío, cambia por ''
      real.value = '0.00';
    }
    scrubClones();
  }

  function isChildClickTarget(t){
    if (!t) return false;
    // click en la fila padre de PERFILES
    var row = t.closest && t.closest('tr.js-parent-row[data-entidad="perfil"]');
    if (row) return true;
    // algunos flujos marcan explícitamente el contexto
    var ctx = t.getAttribute && t.getAttribute('data-modal-context');
    if (ctx && ctx.toLowerCase() === 'child') return true;
    return false;
  }

  function isAddChildContext(ev){
    // 1) dataset.context ya seteado
    if (pm.dataset && pm.dataset.context === 'child') return true;
    // 2) el invocador pertenece a una fila padre
    var rt = ev && ev.relatedTarget ? ev.relatedTarget : null;
    if (isChildClickTarget(rt)) return true;
    // 3) foco actual pertenece a una fila padre (fallback)
    if (isChildClickTarget(document.activeElement)) return true;
    return false;
  }

  function isEditTrigger(ev){
    var rt = ev && ev.relatedTarget ? ev.relatedTarget : null;
    return !!(rt && rt.hasAttribute && rt.hasAttribute('data-row'));
  }

  var tick = null;

  // Marcar contexto HIJO al click en fila (por si otros scripts dependen de esto)
  document.addEventListener('click', function(e){
    var row = e.target && e.target.closest && e.target.closest('tr.js-parent-row[data-entidad="perfil"]');
    if (row) {
      pm.dataset.context = 'child';
      // Evita ancla previa
      delete pm.dataset._childAnchor;
    }
  }, true);

  // Captura: antes que otros listeners
  pm.addEventListener('show.bs.modal', function(ev){
    if (!isAddChildContext(ev) || isEditTrigger(ev)) return; // sólo Agregar hijo
    // garantizar bandera y limpiar ancla
    pm.dataset.context = 'child';
    delete pm.dataset._childAnchor;
    enforceEditableZero();
    // cortar propagación para bloquear rutinas que intentan clonar/readonly
    ev.stopImmediatePropagation();
    ev.stopPropagation();
  }, true);

  // Captura: ya visible
  pm.addEventListener('shown.bs.modal', function(ev){
    if (!isAddChildContext(ev) || isEditTrigger(ev)) return; // sólo Agregar hijo
    enforceEditableZero();
    // múltiples refuerzos por si otros scripts usan timeouts
    var kicks = [0, 16, 32, 64, 128, 256, 384, 512];
    kicks.forEach(function(ms){ setTimeout(enforceEditableZero, ms); });
    requestAnimationFrame(enforceEditableZero);
    // intervalo corto y se apaga solo al cerrar
    if (tick) clearInterval(tick);
    tick = setInterval(enforceEditableZero, 120);
  }, true);

  // Observa mutaciones mientras esté abierto, sólo en modo hijo
  var mo = new MutationObserver(function(list){
    var any = false;
    for (var i=0;i<list.length;i++){
      var r = list[i];
      if (r.type === 'childList' || r.type === 'attributes') { any = true; break; }
    }
    if (any && pm.classList.contains('show') && (pm.dataset && pm.dataset.context === 'child')) {
      enforceEditableZero();
    }
  });
  mo.observe(pm, { childList: true, subtree: true, attributes: true });

  pm.addEventListener('hidden.bs.modal', function(){
    if (tick) { clearInterval(tick); tick = null; }
    delete pm.dataset.context;
    delete pm.dataset._childAnchor;
  }, true);
})();
