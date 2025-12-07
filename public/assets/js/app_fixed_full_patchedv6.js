
/* app_fixed_full_patchedv5.hotfix.js
   ------------------------------------------------------------------
   Arregla: al editar en STOCK/PAUSA se abrían 2 modales (el correcto
   y además el “Agregar Stock” grande). Este hotfix:
     - Fuerza usar SIEMPRE los modales grandes: #stockModal y #pausaModal
     - Cancela cualquier otro listener que intente abrir modales extra
     - Rellena los datos de edición/alta en el evento 'show.bs.modal'
   Cárgalo DESPUÉS de app_fixed_full_patchedv5.js
   ------------------------------------------------------------------ */

(function(){
  'use strict';

  // Oculta (y desactiva) los modales chicos, si existen, para evitar que se disparen por error
  ['#modalAgregarStock', '#modalEditarStock', '#modalAgregarPausa', '#modalEditarPausa'].forEach(function(sel){
    var m = document.querySelector(sel);
    if (!m) return;
    m.setAttribute('data-disabled', '1');
    // Evitar que Bootstrap los abra por atributos data-*
    m.addEventListener('show.bs.modal', function(ev){ ev.preventDefault(); ev.stopImmediatePropagation(); }, true);
  });

  // ---------- STOCK ----------
  (function(){
    var stockModal = document.getElementById('stockModal');
    if (!stockModal) return;
    var form = stockModal.querySelector('form');

    function set(sel, val){
      var el = form && form.querySelector(sel);
      if (el == null) return;
      el.value = (val ?? '');
    }

    // 1) Agregar: forzar que sólo se abra #stockModal
    document.addEventListener('click', function(ev){
      var btn = ev.target.closest('#btn-add-stock');
      if (!btn) return;
      // Cancelar cualquier otro handler
      ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();

      if (!form) return;
      form.reset();
      set('input[name="action"]', 'create');
      set('input[name="id"]', '');

      // Mantener hiddens ya definidos en el HTML (streaming_id, fecha_inicio)
      set('select[name="plan"]', 'individual');
      set('select[name="combo"]', '0');
      set('select[name="estado"]', 'pendiente');
      set('select[name="dispositivo"]', 'tv');
      set('input[name="soles"]', '0.00');
      set('input[name="fecha_fin"]', '');

      try { stockModal.querySelector('.modal-title').textContent = 'Agregar Stock'; } catch(_){}
      if (window.bootstrap) window.bootstrap.Modal.getOrCreateInstance(stockModal).show();
    }, true);

    // 2) Editar: forzar que sólo se abra #stockModal
    document.addEventListener('click', function(ev){
      var btn = ev.target.closest('.btn-edit-stock');
      if (!btn) return;
      ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();

      var data = {};
      try { data = JSON.parse(btn.getAttribute('data-row') || '{}'); } catch(_){}

      if (!form) return;
      form.reset();
      set('input[name="action"]', 'update');
      set('input[name="id"]', data.id ?? '');
      if (data.streaming_id != null && data.streaming_id !== '') {
        set('input[name="streaming_id"]', data.streaming_id);
      }

      set('select[name="plan"]',          data.plan || 'individual');
      set('input[name="correo"]',         data.correo || '');
      set('input[name="password_plain"]', data.password_plain || '');
      set('input[name="whatsapp"]',       data.whatsapp || '');
      set('input[name="perfil"]',         data.perfil || '');
      set('select[name="combo"]',         (String(data.combo) === '1' || data.combo === 1) ? '1' : '0');
      set('input[name="soles"]',          data.soles || '0.00');
      set('select[name="estado"]',        data.estado || 'activo');
      set('select[name="dispositivo"]',   data.dispositivo || 'tv');
      set('input[name="fecha_fin"]',      (data.fecha_fin || '').slice(0,10));

      try { stockModal.querySelector('.modal-title').textContent = 'Editar Stock'; } catch(_){}
      if (window.bootstrap) window.bootstrap.Modal.getOrCreateInstance(stockModal).show();
    }, true);

    // 3) Asegurar que SIEMPRE el relatedTarget que abra #stockModal sea alguno de los botones anteriores
    stockModal.addEventListener('show.bs.modal', function(ev){
      var t = ev.relatedTarget;
      if (!t) return; // apertura manual -> ya llenamos en el paso anterior
      var isAdd  = !!t.closest('#btn-add-stock');
      var isEdit = !!t.closest('.btn-edit-stock');
      if (isAdd || isEdit) return; // permitido
      // Si vino de otra cosa, cancela para evitar aperturas fantasmas
      ev.preventDefault();
      ev.stopImmediatePropagation();
    }, true);
  })();

  // ---------- PAUSA ----------
  (function(){
    var pausaModal = document.getElementById('pausaModal');
    if (!pausaModal) return;
    var form = pausaModal.querySelector('form');

    function set(sel, val){
      var el = form && form.querySelector(sel);
      if (el == null) return;
      el.value = (val ?? '');
    }

    // 1) Agregar: sólo #pausaModal
    document.addEventListener('click', function(ev){
      var btn = ev.target.closest('#btn-add-pausa');
      if (!btn) return;
      ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();

      if (!form) return;
      var sid = form.querySelector('input[name="streaming_id"]')?.value || '';

      form.reset();
      set('input[name="action"]', 'create');
      set('input[name="id"]', '');
      set('input[name="streaming_id"]', sid);

      set('select[name="plan"]', 'individual');
      set('select[name="combo"]', '0');
      set('select[name="estado"]', 'pendiente');
      set('select[name="dispositivo"]', 'tv');
      set('input[name="soles"]', '0.00');
      set('input[name="fecha_fin"]', '');

      try { pausaModal.querySelector('.modal-title').textContent = 'Agregar Cuenta en pausa'; } catch(_){}
      if (window.bootstrap) window.bootstrap.Modal.getOrCreateInstance(pausaModal).show();
    }, true);

    // 2) Editar: sólo #pausaModal
    document.addEventListener('click', function(ev){
      var btn = ev.target.closest('.btn-edit-pausa');
      if (!btn) return;
      ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();

      var data = {};
      try { data = JSON.parse(btn.getAttribute('data-row') || '{}'); } catch(_){}

      if (!form) return;
      form.reset();
      set('input[name="action"]', 'update');
      set('input[name="id"]', data.id ?? '');
      if (data.streaming_id != null && data.streaming_id !== '') {
        set('input[name="streaming_id"]', data.streaming_id);
      }

      set('select[name="plan"]',          data.plan || 'individual');
      set('input[name="correo"]',         data.correo || '');
      set('input[name="password_plain"]', data.password_plain || '');
      set('input[name="whatsapp"]',       data.whatsapp || '');
      set('input[name="perfil"]',         data.perfil || '');
      set('select[name="combo"]',         (String(data.combo) === '1' || data.combo === 1) ? '1' : '0');
      set('input[name="soles"]',          data.soles || '0.00');
      set('select[name="estado"]',        data.estado || 'pendiente');
      set('select[name="dispositivo"]',   data.dispositivo || 'tv');
      set('input[name="fecha_inicio"]',   (data.fecha_inicio || '').slice(0,10));
      set('input[name="fecha_fin"]',      (data.fecha_fin || '').slice(0,10));

      try { pausaModal.querySelector('.modal-title').textContent = 'Editar Cuenta en pausa'; } catch(_){}
      if (window.bootstrap) window.bootstrap.Modal.getOrCreateInstance(pausaModal).show();
    }, true);

    // 3) Evitar triggers fantasmas
    pausaModal.addEventListener('show.bs.modal', function(ev){
      var t = ev.relatedTarget;
      if (!t) return;
      var isAdd  = !!t.closest('#btn-add-pausa');
      var isEdit = !!t.closest('.btn-edit-pausa');
      if (isAdd || isEdit) return;
      ev.preventDefault();
      ev.stopImmediatePropagation();
    }, true);
  })();

})();
