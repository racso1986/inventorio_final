
/*
  app_fixed_sp_minimodals_v7_1.js
  Uso: Cargar DESPUÉS de tu JS base (v5) y EN LUGAR de v7 si lo estabas usando.
  Cambios clave frente a v7:
    - Bloquea explícitamente la apertura de los modales GRANDES (#pausaModal y #stockModal).
    - Reescribe botones .btn-edit-pausa que aún apunten al grande para forzarlos al pequeño.
    - Mantiene el flujo de agregar/editar usando SIEMPRE modales pequeños en Stock y Pausa.
*/

(function () {
  "use strict";
  if (window.__spMiniBoundV71) return;
  window.__spMiniBoundV71 = true;

  function openModalById(id) {
    var el = document.getElementById(id);
    if (!el || !window.bootstrap) return null;
    var m = bootstrap.Modal.getOrCreateInstance(el);
    m.show();
    return el;
  }

  // Bloquear show de los modales grandes
  ['pausaModal','stockModal'].forEach(function(id){
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('show.bs.modal', function(ev){
      ev.preventDefault();
      ev.stopImmediatePropagation();
    }, true);
  });

  // Reescribir botones que apunten al grande
  function rewriteBigTargets() {
    document.querySelectorAll('[data-bs-target="#pausaModal"]').forEach(function(btn){
      btn.setAttribute('data-bs-target', '#modalEditarPausa');
    });
    document.querySelectorAll('[data-bs-target="#stockModal"]').forEach(function(btn){
      btn.setAttribute('data-bs-target', '#modalEditarStock');
    });
  }
  rewriteBigTargets();
  document.addEventListener('DOMContentLoaded', rewriteBigTargets);
  setTimeout(rewriteBigTargets, 500);

  // ADD: STOCK
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('#btn-add-stock');
    if (!btn) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    var el = openModalById('modalAgregarStock'); if (!el) return;
    var f = el.querySelector('form'); if (!f) return;
    f.reset();
    setTimeout(function(){ var foco = f.querySelector('input[name="correo"]'); if (foco) foco.focus(); }, 0);
  }, true);

  // EDIT: STOCK
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.btn-edit-stock');
    if (!btn) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    var data = {}; try { data = JSON.parse(btn.getAttribute('data-row') || '{}'); } catch (_){}
    var el = openModalById('modalEditarStock'); if (!el) return;
    var f = el.querySelector('form'); if (!f) return;
    f.reset();
    var set = function (n, v) { var inp = f.querySelector('[name="'+n+'"]'); if (inp) inp.value = (v==null?'':v); };
    set('action','update'); set('id', data.id);
    if (data.streaming_id != null && data.streaming_id !== '') set('streaming_id', data.streaming_id);
    set('correo', data.correo); set('password_plain', data.password_plain);
    setTimeout(function(){ var foco = f.querySelector('input[name="correo"]'); if (foco) foco.focus(); }, 0);
  }, true);

  // ADD: PAUSA
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('#btn-add-pausa');
    if (!btn) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    var el = openModalById('modalAgregarPausa'); if (!el) return;
    var f = el.querySelector('form'); if (!f) return;
    f.reset();
    setTimeout(function(){ var foco = f.querySelector('input[name="correo"]'); if (foco) foco.focus(); }, 0);
  }, true);

  // EDIT: PAUSA
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.btn-edit-pausa');
    if (!btn) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    var data = {}; try { data = JSON.parse(btn.getAttribute('data-row') || '{}'); } catch (_){}
    var el = openModalById('modalEditarPausa'); if (!el) return;
    var f = el.querySelector('form'); if (!f) return;
    f.reset();
    var set = function (n, v) { var inp = f.querySelector('[name="'+n+'"]'); if (inp) inp.value = (v==null?'':v); };
    set('action','update'); set('id', data.id);
    if (data.streaming_id != null && data.streaming_id !== '') set('streaming_id', data.streaming_id);
    set('correo', data.correo); set('password_plain', data.password_plain);
    setTimeout(function(){ var foco = f.querySelector('input[name="correo"]'); if (foco) foco.focus(); }, 0);
  }, true);

  // Evitar que el click en filas dispare otros modales globales
  document.addEventListener('click', function (e) {
    var inSP = e.target.closest('#stock, #pausa');
    if (!inSP) return;
    var tr = e.target.closest('tr');
    if (tr) tr.setAttribute('data-no-row-modal', '1');
  }, true);

})();