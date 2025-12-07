// familiar_price_anchor.fix.v3.js
(function(){
  'use strict';
  if (window.__famAnchorFixV3) return; window.__famAnchorFixV3 = true;

  var modalEl = document.getElementById('perfilFamiliarModal');
  if (!modalEl) return;

  // recordamos el trigger (celda plan/btn agregar/fila padre, etc.)
  var lastTrigger = null;
  document.addEventListener('click', function(e){
    var t = e.target.closest(
      '.btn-add-perfil-fam,' +            // botón agregar familiar
      '.btn-edit-perfil-fam,' +           // botón editar (no debemos tocar precio en edición)
      '.plan-cell-familiar,' +            // celda plan (abre mini modal u otro flujo)
      '.js-parent-row,[data-entidad="perfil_fam"]' // fila padre
    );
    if (t) lastTrigger = t;
  }, true);

  function getParentRowFromTrigger(trig){
    if (!trig) return null;
    if (trig.classList && trig.classList.contains('js-parent-row')) return trig;
    var pr = trig.closest && trig.closest('.js-parent-row');
    if (pr) return pr;
    var row = trig.closest && trig.closest('tr');
    if (!row) return null;
    if (row.classList && row.classList.contains('js-parent-row')) return row;
    // sube hacia atrás hasta el separador o el inicio
    var p = row.previousElementSibling;
    while (p){
      if (p.hasAttribute && p.hasAttribute('data-sep')) break;
      if (p.classList && p.classList.contains('js-parent-row')) return p;
      p = p.previousElementSibling;
    }
    return null;
  }

  function normMoney(v){
    if (v == null) return '';
    return String(v).replace(',', '.').replace(/[^\d.]/g,'').trim();
  }

  // aplica el precio ancla (si existe) o el de cabecera; bloquea si ancla
  function applyAnchorOnce(){
    var form = modalEl.querySelector('form');
    if (!form) return;

    var idInput   = form.querySelector('input[name="id"]');
    var actionInp = form.querySelector('input[name="action"]');
    var priceInp  = form.querySelector('input[name="soles"]');

    // si es edición (id con valor), no tocamos nada
    if (idInput && idInput.value && idInput.value !== '0') {
      if (priceInp) { priceInp.readOnly = false; priceInp.removeAttribute('data-locked'); }
      return;
    }

    // creación: tomar ancla del padre si existe; si no, cabecera
    var parent = getParentRowFromTrigger(lastTrigger);
    var head   = document.getElementById('precioFamiliarHead');

    var anchor = parent ? normMoney(parent.getAttribute('data-first-child-price') || '') : '';
    var headVal= head && head.value ? normMoney(head.value) : '';
    var val    = anchor || headVal || '';

    if (actionInp) actionInp.value = 'create';
    if (priceInp){
      priceInp.value = val;
      if (anchor){
        priceInp.readOnly = true;
        priceInp.setAttribute('data-locked','anchor');
      }else{
        priceInp.readOnly = false;
        priceInp.removeAttribute('data-locked');
      }
    }
  }

  // refuerza el valor por ~1.2s por si otros scripts lo pisan con setTimeouts tardíos
  function startEnforceTimer(){
    var form = modalEl.querySelector('form');
    if (!form) return;
    var priceInp = form.querySelector('input[name="soles"]');
    if (!priceInp || priceInp.getAttribute('data-locked') !== 'anchor') return;

    var t0 = Date.now();
    var timer = setInterval(function(){
      if (!document.body.contains(priceInp) || (Date.now()-t0) > 1200){
        clearInterval(timer);
        return;
      }
      var parent = getParentRowFromTrigger(lastTrigger);
      var anchor = parent ? normMoney(parent.getAttribute('data-first-child-price') || '') : '';
      if (anchor && priceInp.value !== anchor) {
        priceInp.value = anchor;
      }
    }, 50);
  }

  // si alguien intenta escribir con el precio bloqueado, lo revertimos
  modalEl.addEventListener('input', function(e){
    var el = e.target;
    if (el && el.name === 'soles' && el.getAttribute('data-locked') === 'anchor') {
      var parent = getParentRowFromTrigger(lastTrigger);
      var anchor = parent ? normMoney(parent.getAttribute('data-first-child-price') || '') : '';
      if (anchor) el.value = anchor;
      e.preventDefault();
    }
  }, true);

  // al mostrar el modal, dejamos que otros scripts corran primero y luego aplicamos dos “tics”
  modalEl.addEventListener('shown.bs.modal', function(){
    setTimeout(function(){
      applyAnchorOnce();
      // segundo tic por si otro handler corrió tarde
      setTimeout(function(){
        applyAnchorOnce();
        startEnforceTimer();
      }, 0);
    }, 0);
  });

  // limpieza al cerrar
  modalEl.addEventListener('hidden.bs.modal', function(){
    var priceInp = modalEl.querySelector('input[name="soles"]');
    if (priceInp){ priceInp.readOnly = false; priceInp.removeAttribute('data-locked'); }
  });
})();
