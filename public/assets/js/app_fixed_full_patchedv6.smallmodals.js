
/* app_fixed_full_patchedv6.smallmodals.js
   --------------------------------------------------------------
   Este archivo reemplaza la lógica que forzaba modales GRANDES.
   Objetivo:
     - Usar SIEMPRE los modales PEQUEÑOS de Stock/Pausa:
         #modalAgregarStock, #modalEditarStock,
         #modalAgregarPausa, #modalEditarPausa
     - Bloquear la apertura de modales grandes (#stockModal, #pausaModal)
     - Prefill de correo/contraseña en EDITAR (modales pequeños)
     - Evitar doble apertura (burbujeo/handlers duplicados)
   Incluir este archivo EN LUGAR de app_fixed_full_patchedv6.js,
   o al menos DESPUÉS para sobreescribir su comportamiento.
   -------------------------------------------------------------- */

(function(){
  'use strict';

  // ---------- Util ----------
  var lastTrigger = null;
  document.addEventListener('click', function(ev){
    var btn = ev.target.closest('[data-bs-toggle="modal"]');
    if (btn) lastTrigger = btn;

    // Evitar burbujeo que dispare otros modales
    if (ev.target.closest('.btn-edit-stock, .btn-edit-pausa, #btn-add-stock, #btn-add-pausa')) {
      ev.stopPropagation();
    }
  }, true);

  // Re-habilitar modales pequeños si alguien los "deshabilitó"
  ['#modalAgregarStock','#modalEditarStock','#modalAgregarPausa','#modalEditarPausa']
    .forEach(function(sel){
      var m = document.querySelector(sel);
      if (!m) return;
      m.removeAttribute('data-disabled');
      // Asegurar que nadie impida su apertura
      m.addEventListener('show.bs.modal', function(ev){
        // permitido
      }, false);
    });

  // BLOQUEAR modales grandes por si algún script intenta abrirlos
  ['#stockModal','#pausaModal'].forEach(function(sel){
    var m = document.querySelector(sel);
    if (!m) return;
    m.addEventListener('show.bs.modal', function(ev){
      ev.preventDefault();
      ev.stopImmediatePropagation();
    }, true);
  });

  // --------- STOCK: Prefill para EDITAR (modal pequeño) ---------
  (function(){
    var modalEdit = document.getElementById('modalEditarStock');
    if (!modalEdit) return;

    modalEdit.addEventListener('show.bs.modal', function(ev){
      // Tomamos el botón que abrió el modal
      var btn = lastTrigger || ev.relatedTarget;
      var data = {};
      try { data = JSON.parse(btn?.getAttribute('data-row') || '{}'); } catch(_){ data = {}; }

      var form = modalEdit.querySelector('form');
      if (!form) return;

      // Inputs presentes en el modal pequeño
      var id  = form.querySelector('#editar_stock_id');
      var ic  = form.querySelector('#editar_stock_correo');
      var ip  = form.querySelector('#editar_stock_password');

      if (id) id.value = (data.id ?? '');
      if (ic) ic.value = (data.correo ?? '');
      if (ip) ip.value = (data.password_plain ?? '');
    }, false);
  })();

  // --------- STOCK: Agregar (modal pequeño) ---------
  (function(){
    var modalAdd = document.getElementById('modalAgregarStock');
    if (!modalAdd) return;

    modalAdd.addEventListener('show.bs.modal', function(){
      var form = modalAdd.querySelector('form');
      if (!form) return;
      var ic = form.querySelector('#agregar_stock_correo');
      var ip = form.querySelector('#agregar_stock_password');
      if (ic) ic.value = '';
      if (ip) ip.value = '';
    }, false);
  })();

  // --------- PAUSA: Prefill EDITAR (modal pequeño) ---------
  (function(){
    var modalEdit = document.getElementById('modalEditarPausa');
    if (!modalEdit) return;

    modalEdit.addEventListener('show.bs.modal', function(ev){
      var btn = lastTrigger || ev.relatedTarget;
      var data = {};
      try { data = JSON.parse(btn?.getAttribute('data-row') || '{}'); } catch(_){ data = {}; }

      var form = modalEdit.querySelector('form');
      if (!form) return;

      var id  = form.querySelector('#editar_pausa_id');
      var ic  = form.querySelector('#editar_pausa_correo');
      var ip  = form.querySelector('#editar_pausa_password');

      if (id) id.value = (data.id ?? '');
      if (ic) ic.value = (data.correo ?? '');
      if (ip) ip.value = (data.password_plain ?? '');
    }, false);
  })();

  // --------- PAUSA: Agregar (modal pequeño) ---------
  (function(){
    var modalAdd = document.getElementById('modalAgregarPausa');
    if (!modalAdd) return;

    modalAdd.addEventListener('show.bs.modal', function(){
      var form = modalAdd.querySelector('form');
      if (!form) return;
      var ic = form.querySelector('#agregar_pausa_correo');
      var ip = form.querySelector('#agregar_pausa_password');
      if (ic) ic.value = '';
      if (ip) ip.value = '';
    }, false);
  })();

})();