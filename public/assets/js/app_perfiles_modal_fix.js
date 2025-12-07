/* app_perfiles_modal_fix.js — Corrección PADRE/HIJO + Editar padre
   Reglas:
   - Agregar PADRE (.btn-add-perfil): toma #precioPerfilHead y bloquea readonly.
   - Agregar HIJO (click en tr.js-parent-row fuera de .js-row-action):
       * si data-anchor-price => setea valor y readonly (+hidden de respaldo)
       * si NO hay anchor => vacío y editable (primer hijo)
   - Editar PADRE (.btn-edit-perfil): NO tocar el precio (lo prellena otro script); queda editable.
   - Dedupe de name="soles" en submit, sin borrar el input visible.
*/
;(function(){
  'use strict';
  if (window.__pfPricePatchBound) return;
  window.__pfPricePatchBound = true;

  var modal = document.getElementById('perfilModal');
  var head  = document.getElementById('precioPerfilHead');
  if (!modal) return;

  function qForm(){ return modal.querySelector('form'); }
  function qPrice(){ return modal.querySelector('input[name="soles"]'); }
  function clearHiddenSoles(){
    var f = qForm(); if (!f) return;
    f.querySelectorAll('input[type="hidden"][name="soles"]').forEach(function(x){ x.remove(); });
  }

  // ---- Determinar contexto por el disparador (CAPTURA) ----
  // Agregar PADRE
  document.addEventListener('click', function(e){
    var btn = e.target && e.target.closest && e.target.closest('.btn-add-perfil');
    if (!btn) return;
    modal.dataset.mode = 'parent';
    modal.dataset.lockVal = head ? (head.value || '') : '';
  }, true);

  // Editar PADRE
  document.addEventListener('click', function(e){
    var btn = e.target && e.target.closest && e.target.closest('.btn-edit-perfil');
    if (!btn) return;
    modal.dataset.mode = 'parent-edit';
    delete modal.dataset.lockVal;
    delete modal.dataset.childAnchor;
  }, true);

  // Agregar HIJO (click en fila padre, fuera de .js-row-action)
  document.addEventListener('click', function(e){
    var row = e.target && e.target.closest && e.target.closest('tr.js-parent-row');
    if (!row) return;
    if (e.target.closest('.js-row-action')) return; // evitar Editar/Borrar
    modal.dataset.mode = 'child';
    modal.dataset.childAnchor = row.getAttribute('data-anchor-price') || '';
    delete modal.dataset.lockVal;
  }, true);

  // ---- MOSTRAR ----
  modal.addEventListener('show.bs.modal', function(ev){
    // Si viene de Editar padre, respeta el valor que precarga el otro script
    var rt = ev.relatedTarget || null;
    if (rt && rt.closest && rt.closest('.btn-edit-perfil')) {
      modal.dataset.mode = 'parent-edit';
    }
  }, true);

  modal.addEventListener('shown.bs.modal', function(){
    var mode  = modal.dataset.mode || '';
    var price = qPrice();
    if (!price) return;

    // Limpia residuos de clones ocultos
    clearHiddenSoles();

    // Estado base: editable
    price.readOnly = false;
    price.removeAttribute('readonly');
    price.classList.remove('bg-light');

    if (mode === 'parent') {
      // Agregar padre: tomar header si existe
      var v = (modal.dataset.lockVal || (head ? head.value : '') || '').trim();
      if (v) price.value = v;
      price.readOnly = true;
      price.setAttribute('readonly','readonly');
      price.classList.add('bg-light');
      return;
    }

    if (mode === 'parent-edit') {
      // Editar padre: NO tocar valor; queda editable
      return;
    }

    // HIJO
    var anchor = (modal.dataset.childAnchor || '').trim();
    if (anchor !== '') {
      // Hay ancla => fijar y bloquear
      price.value = anchor;
      price.readOnly = true;
      price.setAttribute('readonly','readonly');
      price.classList.add('bg-light');
      // Hidden de respaldo (por si otro script altera el visible)
      var f = qForm();
      if (f) {
        var h = document.createElement('input');
        h.type = 'hidden'; h.name = 'soles'; h.value = anchor;
        f.appendChild(h);
      }
    } else {
      // Primer hijo => libre, vacío
      price.value = '';
    }
  }, true);

  // ---- CERRAR ----
  modal.addEventListener('hidden.bs.modal', function(){
    clearHiddenSoles();
    delete modal.dataset.mode;
    delete modal.dataset.lockVal;
    delete modal.dataset.childAnchor;
    var price = qPrice();
    if (price) {
      price.readOnly = false;
      price.removeAttribute('readonly');
      price.classList.remove('bg-light');
    }
  }, true);

  // ---- ENVIAR: dedupe name="soles" (mantener visible) ----
  document.addEventListener('submit', function(ev){
    var form = ev.target;
    if (!form || form !== qForm()) return;
    var inputs = form.querySelectorAll('input[name="soles"]');
    if (inputs.length > 1) {
      // Conserva el último input visible y elimina hiddens previos
      for (var i = 0; i < inputs.length - 1; i++) {
        if (inputs[i].type === 'hidden') inputs[i].remove();
      }
    }
  }, true);
})();
