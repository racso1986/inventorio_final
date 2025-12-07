// === RESET GLOBAL DE MODALES ANTES DE ABRIR CUALQUIER MODAL ===
function forceCleanModals() {
  document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
  document.body.classList.remove('modal-open');
  document.body.style.removeProperty('padding-right');
}



// /public/assets/js/app.js
// === Fallback global: evitar ReferenceError si __isIptvContext no existe en esta vista ===
(function(){
  if (typeof window.__isIptvContext !== 'function') {
    // Conservador: por defecto NO es contexto IPTV
    window.__isIptvContext = function(/* el */){ return false; };
  }
})();


  function setVal(root, sel, val){
    const el = root.querySelector(sel);
    if (!el) return;
    el.value = (val ?? '');
  }

  function setText(root, sel, txt){ const el = root.querySelector(sel); if(el) el.textContent = txt ?? ''; }
  function parseRow(btn){
    const raw = btn?.getAttribute('data-row'); if(!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }
  function rowFromDataAttrs(btn, tipo){
    if(!btn) return null;
    const g = (k)=>btn.getAttribute(k) || '';
    const base = {
      id: g('data-id'),
      streaming_id: g('data-streaming_id'),
      correo: g('data-correo'),
      password_plain: g('data-password-plain') || g('data-password'),
      whatsapp: g('data-whatsapp'),
      fecha_inicio: g('data-fecha_inicio'),
      fecha_fin: g('data-fecha_fin'),
      soles: g('data-soles'),
      estado: g('data-estado'),
      dispositivo: g('data-dispositivo'),
      plan: g('data-plan'),
      combo: g('data-combo')
    };
    if (tipo === 'cuenta') base.cuenta = g('data-cuenta');
    if (tipo === 'perfil') base.perfil = g('data-perfil');
    const some = Object.values(base).some(v => (v ?? '') !== '');
    return some ? base : null;
  }
  function fallbackFromRowCells(btn, tipo){
    // Nuevo orden columnas:
    // 0 plan, 1 correo, 2 contraseña, 3 hoy, 4 fecha fin, 5 días, 6 wa, 7 perfil/cuenta, 8 combo, 9 soles, 10 estado, 11 dispositivo
    const tr = btn && btn.closest('tr'); if(!tr) return null;
    const tds = Array.from(tr.querySelectorAll('td'));
    const txt = (i)=> (tds[i]?.textContent || '').trim();
    const row = {
      plan: txt(0),
      correo: txt(1),
      password_plain: txt(2),
      // fecha_inicio ya no visible; se maneja oculto/hoy en el backend
      fecha_fin: txt(4),
      whatsapp: (()=>{ const raw=(tds[6]?.childNodes[0]?.textContent || tds[6]?.textContent || '').trim(); return raw.split(/\s/)[0] || raw; })(),
      // perfil/cuenta:
      estado: txt(10).toLowerCase(),
      dispositivo: txt(11).toLowerCase(),
      soles: txt(9),
      combo: (/^s[ií]$/i.test(txt(8)) ? '1' : '0')
    };
    if (tipo === 'cuenta') row.cuenta = txt(7);
    if (tipo === 'perfil') row.perfil = txt(7);
    return row;
  }
  
  
  
  
/* =======================================================================
   public/assets/js/app.js — HELPER GLOBAL (poner al INICIO del archivo)
   ======================================================================= */
// Helper seguro para leer la URL del <form action> (evita choque con <input name="action">)
(function(){
  if (window.getFormActionURL) return;
  window.getFormActionURL = function(form){
    try {
      return (form && typeof form.getAttribute === 'function')
        ? (form.getAttribute('action') || '')
        : '';
    } catch (_) { return ''; }
  };
})();



/* =======================================================================
   public/assets/js/app.js — SWEETALERT TOAST + RELOAD (poner al INICIO)
   ======================================================================= */
(function(){
    return;
  window.okToastReload = function(title, ms){
    var delay = ms || 1200;
    if (!window.Swal) { setTimeout(function(){ location.reload(); }, delay); return; }
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: title || 'Guardado',
      showConfirmButton: false,
      timer: delay,
      timerProgressBar: true,
      didOpen: function(popup){
        try {
          var container = popup.parentElement; // .swal2-container
          container.style.zIndex = '1065';
          container.style.pointerEvents = 'none'; // no bloquea clics en la tabla
          popup.style.pointerEvents = 'auto';
        } catch(_){}
      }
    }).then(function(){ location.reload(); });
  };

  // Flash para submits nativos (POST→redirect)
  var KEY='__flash_ok_reload__';
  if (sessionStorage.getItem(KEY)) {
    sessionStorage.removeItem(KEY);
    setTimeout(function(){ okToastReload('Guardado'); }, 120);
  }
  // Helper para marcar formularios nativos (si los usas)
  window.markFlashReload = function(selector){
    var f = document.querySelector(selector);
    if (!f || f.__flashReloadBound) return;
    f.__flashReloadBound = true;
    f.addEventListener('submit', function(){ sessionStorage.setItem(KEY,'1'); }, true);
  };
})();


  // ---- Confirmación de borrado (delegado) ----
  document.addEventListener('submit', function (e) {
    const f = e.target;
    if (!f.matches('.form-delete-perfil, .form-delete-cuenta, .form-delete-streaming')) return;
    e.preventDefault();
    if (typeof Swal === 'undefined') { f.submit(); return; }
    const what = f.classList.contains('form-delete-perfil') ? 'perfil'
               : f.classList.contains('form-delete-cuenta') ? 'cuenta' : 'streaming';
    Swal.fire({
      title: `¿Eliminar ${what}?`,
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Sí, borrar',
      cancelButtonText: 'Cancelar'
    }).then(r => { if (r.isConfirmed) f.submit(); });
  });

  // ================== PERFIL ==================
  const perfilModal = document.getElementById('perfilModal');
  if (perfilModal) {
    perfilModal.addEventListener('show.bs.modal', (ev) => {
      // --- MODO PREFILL (Perfil) ---
      if (perfilModal.dataset.prefill === '1') {
        const form = perfilModal.querySelector('form'); if (form) form.reset();
        setVal(perfilModal, 'input[name="action"]', 'create');
        setVal(perfilModal, 'input[name="id"]', '');

        const sid = perfilModal.dataset.streaming_id
          || perfilModal.querySelector('input[name="streaming_id"]')?.value
          || '';
        setVal(perfilModal, 'input[name="streaming_id"]', sid);

        // En flujo hijo NO prellenar soles desde ningún origen (trigger/dataset/header/anchor)
setVal(perfilModal, 'input[name="correo"]', perfilModal.dataset.correo || '');
setVal(perfilModal, 'input[name="password_plain"]', perfilModal.dataset.password || '');
setVal(perfilModal, 'input[name="soles"]', ''); // hijo: siempre vacío
try {
  const solesIn = perfilModal.querySelector('input[name="soles"]');
  if (solesIn) { solesIn.readOnly = false; solesIn.removeAttribute('readonly'); }
} catch(_) {}



       // No bloquear al prellenar
['correo', 'password_plain'].forEach(n => {
          const el = perfilModal.querySelector(`input[name="${n}"]`);
          if (el) el.readOnly = true;
        });


        // plan / combo desde la fila padre (si vienen), con defaults
        const selPlan = perfilModal.querySelector('select[name="plan"]'); if (selPlan) selPlan.value = perfilModal.dataset.plan || 'individual';
        const selCombo = perfilModal.querySelector('select[name="combo"]'); if (selCombo) selCombo.value = (perfilModal.dataset.combo === '1' ? '1' : '0');

        // Defaults al agregar
        const selE = perfilModal.querySelector('select[name="estado"]'); if (selE) selE.value = 'pendiente';
        const selD = perfilModal.querySelector('select[name="dispositivo"]'); if (selD) selD.value = 'tv';

        setText(perfilModal, '.modal-title', `Agregar a correo: ${perfilModal.dataset.correo || ''}`);
        const sb = perfilModal.querySelector('button[type="submit"]'); if (sb) sb.textContent = 'Guardar';
        return; // evitamos la lógica normal
      }

      const btn = ev.relatedTarget;
      const isEdit = btn && btn.classList.contains('btn-edit-perfil');
      const form = perfilModal.querySelector('form'); if (form) form.reset();

      if (isEdit) {
        let row = parseRow(btn) || rowFromDataAttrs(btn, 'perfil') || fallbackFromRowCells(btn, 'perfil') || {};
        setVal(perfilModal, 'input[name="action"]', 'update');
        setVal(perfilModal, 'input[name="id"]', row.id);
        setVal(perfilModal, 'input[name="streaming_id"]', row.streaming_id || perfilModal.querySelector('input[name="streaming_id"]')?.value || '');
        setVal(perfilModal, 'input[name="correo"]', row.correo);
        setVal(perfilModal, 'input[name="password_plain"]', row.password_plain);
        setVal(perfilModal, 'input[name="perfil"]', row.perfil);
        setVal(perfilModal, 'input[name="whatsapp"]', row.whatsapp);
        // setVal(perfilModal, 'input[name="fecha_inicio"]', row.fecha_inicio); // ya no visible
        setVal(perfilModal, 'input[name="fecha_fin"]', row.fecha_fin);
        setVal(perfilModal, 'input[name="soles"]', row.soles);
        
        ['correo','password_plain'].forEach(n => {
  const el = perfilModal.querySelector(`input[name="${n}"]`);
  if (el) el.readOnly = true; // readOnly para que IGUAL se envíe al backend
});
const selPlan = perfilModal.querySelector('select[name="plan"]'); if (selPlan) selPlan.value = row.plan || 'individual';
        const selCombo = perfilModal.querySelector('select[name="combo"]'); if (selCombo) selCombo.value = (/^(1|s[ií])$/i.test(String(row.combo||'')) ? '1' : '0');

        const selE = perfilModal.querySelector('select[name="estado"]'); if (selE) selE.value = row.estado || 'pendiente';
        const selD = perfilModal.querySelector('select[name="dispositivo"]'); if (selD) selD.value = row.dispositivo || 'tv';

        setText(perfilModal, '.modal-title', 'Editar Perfil');
        const sb = perfilModal.querySelector('button[type="submit"]'); if (sb) sb.textContent = 'Guardar cambios';
      } else {
        setVal(perfilModal, 'input[name="action"]', 'create');
        setVal(perfilModal, 'input[name="id"]', '');
        const currentSid = perfilModal.querySelector('input[name="streaming_id"]')?.value || '';
        const btn = ev.relatedTarget;
        const sidFromBtn = btn?.getAttribute('data-streaming_id') || btn?.dataset.streaming_id || currentSid;
        setVal(perfilModal, 'input[name="streaming_id"]', sidFromBtn);

        // Defaults al Agregar (PERFIL)
        const selPlan = perfilModal.querySelector('select[name="plan"]'); if (selPlan) selPlan.value = 'individual';
        const selCombo = perfilModal.querySelector('select[name="combo"]'); if (selCombo) selCombo.value = '0';
        const selE = perfilModal.querySelector('select[name="estado"]'); if (selE) selE.value = 'pendiente';
        const selD = perfilModal.querySelector('select[name="dispositivo"]'); if (selD) selD.value = 'tv';

        setText(perfilModal, '.modal-title', 'Agregar Perfil');
        const sb = perfilModal.querySelector('button[type="submit"]'); if (sb) sb.textContent = 'Guardar';
      }
    });

    perfilModal.addEventListener('hidden.bs.modal', () => {
      const form = perfilModal.querySelector('form'); if (form) form.reset();
      setVal(perfilModal, 'input[name="action"]', 'create');
      setVal(perfilModal, 'input[name="id"]', '');
      // Limpiar readonly y contexto prefill
      ['correo','password_plain'].forEach(n => {
          const el = perfilModal.querySelector(`input[name="${n}"]`);
          if (el) el.readOnly = true;
        });
      delete perfilModal.dataset.prefill;
      delete perfilModal.dataset.correo;
      delete perfilModal.dataset.password;
      delete perfilModal.dataset.soles;
      delete perfilModal.dataset.streaming_id;
      delete perfilModal.dataset.plan;
      delete perfilModal.dataset.combo;
    });
  }
  
  
  
  

  // ================== CUENTA ==================
  const cuentaModal = document.getElementById('cuentaModal');
  if (cuentaModal) {
    cuentaModal.addEventListener('show.bs.modal', (ev) => {
      // --- MODO PREFILL (Cuenta) ---
      if (cuentaModal.dataset.prefill === '1') {
        const form = cuentaModal.querySelector('form'); if (form) form.reset();
        setVal(cuentaModal, 'input[name="action"]', 'create');
        setVal(cuentaModal, 'input[name="id"]', '');

        const sid = cuentaModal.dataset.streaming_id
          || cuentaModal.querySelector('input[name="streaming_id"]')?.value
          || '';
        setVal(cuentaModal, 'input[name="streaming_id"]', sid);

        setVal(cuentaModal, 'input[name="correo"]', cuentaModal.dataset.correo || '');
        setVal(cuentaModal, 'input[name="password_plain"]', cuentaModal.dataset.password || '');
        setVal(cuentaModal, 'input[name="soles"]', cuentaModal.dataset.soles || '');

        // Bloquear sólo estos 3 campos
        ['correo', 'password_plain', 'soles'].forEach(n => {
          const el = cuentaModal.querySelector(`input[name="${n}"]`);
          if (el) el.readOnly = true;
        });['correo','password_plain'].forEach(n => {
  const el = perfilModal.querySelector(`input[name="${n}"]`);
  if (el) el.readOnly = true;
});


        const selPlan = cuentaModal.querySelector('select[name="plan"]'); if (selPlan) selPlan.value = cuentaModal.dataset.plan || 'individual';
        const selCombo = cuentaModal.querySelector('select[name="combo"]'); if (selCombo) selCombo.value = (cuentaModal.dataset.combo === '1' ? '1' : '0');

        const selE = cuentaModal.querySelector('select[name="estado"]'); if (selE) selE.value = 'pendiente';
        const selD = cuentaModal.querySelector('select[name="dispositivo"]'); if (selD) selD.value = 'tv';

        setText(cuentaModal, '.modal-title', `Agregar a correo: ${cuentaModal.dataset.correo || ''}`);
        const sb = cuentaModal.querySelector('button[type="submit"]'); if (sb) sb.textContent = 'Guardar';
        return;
      }

      const btn = ev.relatedTarget;
      const isEdit = btn && btn.classList.contains('btn-edit-cuenta');
      const form = cuentaModal.querySelector('form'); if (form) form.reset();

      if (isEdit) {
        let row = parseRow(btn) || rowFromDataAttrs(btn, 'cuenta') || fallbackFromRowCells(btn, 'cuenta') || {};
        setVal(cuentaModal, 'input[name="action"]', 'update');
        setVal(cuentaModal, 'input[name="id"]', row.id);
        setVal(cuentaModal, 'input[name="streaming_id"]', row.streaming_id || cuentaModal.querySelector('input[name="streaming_id"]')?.value || '');
        setVal(cuentaModal, 'input[name="correo"]', row.correo);
        setVal(cuentaModal, 'input[name="password_plain"]', row.password_plain);
        setVal(cuentaModal, 'input[name="cuenta"]', row.cuenta);
        setVal(cuentaModal, 'input[name="whatsapp"]', row.whatsapp);
        // setVal(cuentaModal, 'input[name="fecha_inicio"]', row.fecha_inicio);
        setVal(cuentaModal, 'input[name="fecha_fin"]', row.fecha_fin);
        setVal(cuentaModal, 'input[name="soles"]', row.soles);
        
        ['correo','password_plain'].forEach(n => {
  const el = perfilModal.querySelector(`input[name="${n}"]`);
  if (el) el.readOnly = true; // readOnly para que IGUAL se envíe al backend
});
const selPlan = cuentaModal.querySelector('select[name="plan"]'); if (selPlan) selPlan.value = row.plan || 'individual';
        const selCombo = cuentaModal.querySelector('select[name="combo"]'); if (selCombo) selCombo.value = (/^(1|s[ií])$/i.test(String(row.combo||'')) ? '1' : '0');

        const selE = cuentaModal.querySelector('select[name="estado"]'); if (selE) selE.value = row.estado || 'pendiente';
        const selD = cuentaModal.querySelector('select[name="dispositivo"]'); if (selD) selD.value = row.dispositivo || 'tv';

        setText(cuentaModal, '.modal-title', 'Editar Cuenta');
        const sb = cuentaModal.querySelector('button[type="submit"]'); if (sb) sb.textContent = 'Guardar cambios';
      } else {
        setVal(cuentaModal, 'input[name="action"]', 'create');
        setVal(cuentaModal, 'input[name="id"]', '');
        const currentSid = cuentaModal.querySelector('input[name="streaming_id"]')?.value || '';
        const btn = ev.relatedTarget;
        const sidFromBtn = btn?.getAttribute('data-streaming_id') || btn?.dataset.streaming_id || currentSid;
        setVal(cuentaModal, 'input[name="streaming_id"]', sidFromBtn);

        // Defaults al Agregar (CUENTA)
        const selPlan = cuentaModal.querySelector('select[name="plan"]'); if (selPlan) selPlan.value = 'individual';
        const selCombo = cuentaModal.querySelector('select[name="combo"]'); if (selCombo) selCombo.value = '0';
        const selE = cuentaModal.querySelector('select[name="estado"]'); if (selE) selE.value = 'pendiente';
        const selD = cuentaModal.querySelector('select[name="dispositivo"]'); if (selD) selD.value = 'tv';

        setText(cuentaModal, '.modal-title', 'Agregar Cuenta');
        const sb = cuentaModal.querySelector('button[type="submit"]'); if (sb) sb.textContent = 'Guardar';
      }

    });

    cuentaModal.addEventListener('hidden.bs.modal', () => {
      const form = cuentaModal.querySelector('form'); if (form) form.reset();
      setVal(cuentaModal, 'input[name="action"]', 'create');
      setVal(cuentaModal, 'input[name="id"]', '');
      // Limpiar readonly y contexto prefill
      ['correo', 'password_plain', 'soles'].forEach(n => {
        const el = cuentaModal.querySelector(`input[name="${n}"]`);
        if (el) el.readOnly = false;
      });
      delete cuentaModal.dataset.prefill;
      delete cuentaModal.dataset.correo;
      delete cuentaModal.dataset.password;
      delete cuentaModal.dataset.soles;
      delete cuentaModal.dataset.streaming_id;
      delete cuentaModal.dataset.plan;
      delete cuentaModal.dataset.combo;
    });
  }

  // ===== Prefill por correo (fila padre) =====
  function openPrefillModal(entidad, data) {
      const modalId =
      entidad === 'perfil'      ? 'perfilModal' :
      entidad === 'perfil_fam'  ? 'perfilFamiliarModal' :
                                  'cuentaModal';
    const modalEl = document.getElementById(modalId);
    if (!modalEl || !window.bootstrap) return;
  

    // Contexto para el show.bs.modal
    modalEl.dataset.prefill = '1';
    modalEl.dataset.correo = data.correo || '';
    modalEl.dataset.password = data.password || '';
    modalEl.dataset.soles = data.soles || '';
    modalEl.dataset.plan = data.plan || 'individual';
    modalEl.dataset.combo = (String(data.combo) === '1' ? '1' : '0');
    modalEl.dataset.streaming_id = data.streaming_id || '';

    // --- Prefill directo para Familiar (crear hijo desde fila padre) ---
    if (entidad === 'perfil_fam') {
      try {
        const form = modalEl.querySelector('form');
        const setVal = (sel, val) => { const el = form && form.querySelector(sel); if (el) el.value = val; };
        const priceInput = form && form.querySelector('input[name="soles"]');

        const isEdit = !!(data && data.id);
        if (!isEdit) {
          // Datos base
          setVal('input[name="action"]', 'create');
          setVal('input[name="id"]', '');
          setVal('input[name="correo"]', data.correo || '');
          setVal('input[name="password_plain"]', data.password || '');
          setVal('select[name="plan"]', (data.plan || 'premium'));
          setVal('select[name="combo"]', (String(data.combo)==='1'?'1':'0'));
          setVal('input[name="streaming_id"]', data.streaming_id || '');

          // Precio: si viene ancla del primer hijo, usarla y bloquear edición
          const head = document.getElementById('precioFamiliarHead');
          const headVal = head && head.value ? head.value.trim() : '';
          const anchor = (data && data.firstChildPrice) ? String(data.firstChildPrice).trim() : '';
          const def = anchor || headVal || '';
          setVal('input[name="soles"]', def);
          if (priceInput) {
            if (anchor) {
              priceInput.readOnly = true;
              priceInput.setAttribute('aria-readonly','true');
            } else {
              priceInput.readOnly = false;
              priceInput.removeAttribute('aria-readonly');
            }
          }
        }
      } catch(_e){}
    }

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  }



// Router de clic para filas padre (Perfiles / Streaming familiar / Cuentas)
document.addEventListener('click', function (e) {
  // 1) NO disparar si el click viene de:
  //    - botones explícitos (Editar, Borrar, etc.) → .js-row-action
  //    - elementos marcados con data-no-row-modal="1"
  //    - la celda de plan (plan-cell-perfil), que abre el modal chico
  if (
    e.target.closest('.js-row-action') ||
    e.target.closest('[data-no-row-modal="1"]') ||
    e.target.closest('.plan-cell-perfil')
  ) {
    return;
  }

  // 2) Solo filas padre dentro de la tabla de Perfiles
  const row = e.target.closest('#perfilesTable tr.js-parent-row');
  if (!row) return;

  const modalCtx = (row.getAttribute('data-modal-context') || '').toLowerCase();
  let entidad    = (row.getAttribute('data-entidad') || '').toLowerCase();

  if (modalCtx === 'child') {
    // Streaming familiar (hijos)
    entidad = 'perfil_fam';
  } else if (!entidad) {
    // Por defecto, tratamos como "perfil"
    entidad = 'perfil';
  }
  
   // 🔥 LIMPIAR CUALQUIER BACKDROP COLGADO ANTES DE ABRIR MODAL PADRE/Hijo
  document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
  document.body.classList.remove('modal-open');
  document.body.style.removeProperty('padding-right');

  openPrefillModal(entidad, {
    correo:         row.getAttribute('data-correo') || '',
    firstChildPrice:(row.getAttribute('data-first-child-price') || ''),
    password:       row.getAttribute('data-password') || '',
    soles:          row.getAttribute('data-soles') || '',
    plan:           row.getAttribute('data-plan') || 'individual',
    combo:          row.getAttribute('data-combo') || '0',
    streaming_id:   row.getAttribute('data-streaming_id') || ''
  });
}, true);





// Enter accesible sobre fila padre
document.addEventListener('click', function(e){
  // ⛔ Si el click viene de la celda de PLAN de familiar, NO abrir modal grande
  const planCell = e.target.closest('.plan-cell-familiar');
  if (planCell && planCell.getAttribute('data-no-row-modal') === '1') {
    return; // salimos y no seguimos a la lógica de modal grande
  }

  if (e.target.closest('.js-row-action')) return;
  const row = e.target.closest('tr.js-parent-row');
  if (!row) return;

  const entidad = (row.getAttribute('data-entidad') || '').toLowerCase();
  if (entidad !== 'perfil' && entidad !== 'cuenta' && entidad !== 'perfil_fam') return;

  // Si es familiar y estamos sobre la celda plan, no abrir el modal grande
  if (entidad === 'perfil_fam' && e.target.closest('.plan-cell-perfil')) return;

  // 🔥 LIMPIAR CUALQUIER BACKDROP COLGADO ANTES DE ABRIR MODAL
  document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
  document.body.classList.remove('modal-open');
  document.body.style.removeProperty('padding-right');

  openPrefillModal(entidad, {
    correo:         tr.getAttribute('data-correo') || '',
    firstChildPrice:(tr.getAttribute('data-first-child-price') || ''),
    password:       tr.getAttribute('data-password') || '',
    soles:          tr.getAttribute('data-soles') || '',
    plan:           tr.getAttribute('data-plan') || 'individual',
    combo:          tr.getAttribute('data-combo') || '0',
    streaming_id:   tr.getAttribute('data-streaming_id') || ''
  });
});


  
  
  
  
  


  
  
  
  
  
 /* === Cambiar plan (Stock/Pausa) con Color de fila === */
(function () {
  'use strict';

  if (window.__sppBound) return;
  window.__sppBound = true;

  let lastPlanCellSPP = null;
  let sppModal = null, sppForm = null, sppId = null, sppTipo = null, sppPlan = null, sppDestino = null, sppColor = null;
  let sppSubmitting = false;

  function sppEnsureRefs() {
    if (sppForm) return;
    sppForm    = document.getElementById('formPlanStockPausa');
    sppId      = document.getElementById('spp_id');
    sppTipo    = document.getElementById('spp_tipo');
    sppPlan    = document.getElementById('spp_plan');
    sppDestino = document.getElementById('spp_destino');
    sppColor   = document.getElementById('spp_color');
    const el   = document.getElementById('modalCambiarPlanStockPausa');
    if (el && window.bootstrap?.Modal) {
      sppModal = bootstrap.Modal.getOrCreateInstance(el);
    }
    if (sppForm && !sppForm.dataset.bound) {
      sppForm.addEventListener('submit', sppOnSubmit);
      sppForm.dataset.bound = '1';
    }
  }
; try{ sppSanitizePlanField(); }catch(_){}
; try{ sppEnsureColorSelect(); }catch(_){}

  function sppSanitizePlanField() {
    if (!sppForm) return;
    sppForm.querySelectorAll('input[name="plan"]').forEach(el => {
      if (el.type === 'hidden') el.remove();
    });
    if (sppPlan) {
      sppPlan.style.removeProperty('display');
      sppPlan.hidden = false;
      sppPlan.removeAttribute('aria-hidden');
      sppPlan.classList.add('form-select', 'form-select-sm');
      sppPlan.disabled = false;
    }
  }

 
 
 
 
 
 
 
 // public/assets/js/app.js
function sppPopulateDestinos(tipo) {
  const opts = [{ value: '', label: '— Solo cambiar plan —' }];

  if (tipo === 'stock') {
    opts.push({ value: 'perfiles',  label: 'Perfiles' });
    opts.push({ value: 'cuentas',   label: 'Cuenta completa' });
    // Ya lo tenías:
    opts.push({ value: 'pausa',     label: 'Pausa' });
    // 👉 NUEVO: desde STOCK también poder mandar a Familiar
    opts.push({ value: 'familiar',  label: 'Familiar' });
  } else { // pausa
    opts.push({ value: 'perfiles',  label: 'Perfiles' });
    opts.push({ value: 'cuentas',   label: 'Cuenta completa' });
    opts.push({ value: 'stock',     label: 'Stock' });
    // 👉 NUEVO: desde PAUSA también poder mandar a Familiar
    opts.push({ value: 'familiar',  label: 'Familiar' });
  }

  if (sppDestino) {
    sppDestino.innerHTML = opts
      .map(o => `<option value="${o.value}">${o.label}</option>`)
      .join('');
  }
}

 
 
 
 
 
 
 
 
 


  function normalizePlan(p) {
    p = (p || '').toString().trim().toLowerCase();
    if (p === 'standard' || p === 'estandar' || p === 'estándard') p = 'estándar';
    if (!['individual', 'estándar', 'premium'].includes(p)) p = 'individual';
    return p;
  }
  
  function sppEnsureColorSelect() {
  // Si ya existe, enlázalo y salir
  if (document.getElementById('spp_color')) {
    sppColor = document.getElementById('spp_color');
    return;
  }
  if (!sppForm) return;

  // Insertar debajo del campo destino
  const destinoEl = sppForm.querySelector('#spp_destino');
  if (!destinoEl) return;
  const destinoGroup = destinoEl.closest('.mb-0') || destinoEl.parentElement;

  const wrapper = document.createElement('div');
  wrapper.className = 'mb-0 mt-2';
  wrapper.innerHTML = `
    <label for="spp_color" class="form-label mb-1">Color (opcional)</label>
    <select class="form-select form-select-sm" name="color" id="spp_color">
      <option value="">— Sin cambios —</option>
      <option value="rojo">Rojo</option>
      <option value="azul">Azul</option>
      <option value="verde">Verde</option>
      <option value="blanco">Blanco</option>
      <option value="restablecer">Restablecer</option>
    </select>
    <div class="form-text">Pinta la fila con el color elegido; “Restablecer” quita cualquier color.</div>
  `;
  destinoGroup.after(wrapper);
  sppColor = wrapper.querySelector('#spp_color');
}


  function getRowColorValue(tr) {
    if (!tr) return '';
    if (tr.classList.contains('row-color-rojo'))   return 'rojo';
    if (tr.classList.contains('row-color-azul'))   return 'azul';
    if (tr.classList.contains('row-color-verde'))  return 'verde';
    if (tr.classList.contains('row-color-blanco')) return 'blanco';
    return '';
  }

 function applyRowColor(tr, val) {
  if (!tr) return;
  // SIN CAMBIOS: no tocar el color actual
  if (val == null || val === '') return;

  // Limpiar y, si es "restablecer", salir sin volver a pintar
  tr.classList.remove('row-color-rojo','row-color-azul','row-color-verde','row-color-blanco');
  if (val === 'restablecer') return;

  // Pintar color específico
  if (val === 'rojo')   tr.classList.add('row-color-rojo');
  if (val === 'azul')   tr.classList.add('row-color-azul');
  if (val === 'verde')  tr.classList.add('row-color-verde');
  if (val === 'blanco') tr.classList.add('row-color-blanco');
}



  function sppOpenFromCell(cell) {
  sppEnsureRefs();
  sppSanitizePlanField();
  if (!sppForm || !cell) return;

  // Evitar que el click en plan dispare el modal de fila
  cell.setAttribute('data-no-row-modal', '1');
  lastPlanCellSPP = cell;

  // === tipo + id ===
  const tipo = (cell.getAttribute('data-tipo') ||
               (cell.classList.contains('plan-cell-pausa') ? 'pausa' : 'stock')).toLowerCase();
  const id = (cell.getAttribute('data-id') || cell.dataset.id || '').trim();
  if (!id) { console.warn('[SPP] Falta data-id en la celda de plan'); return; }

  // === plan actual (data-plan -> texto del ancla -> texto de la celda) ===
  let planRaw = cell.getAttribute('data-plan');
  if (!planRaw) {
    const a = cell.querySelector('.js-edit-plan, [data-role="plan-text"], a');
    planRaw = a ? a.textContent : cell.textContent;
  }
  planRaw = (planRaw || '').trim();
  const plan = normalizePlan(planRaw); // debe existir: individual/estándar/premium

  // === setear form ===
  sppId.value = id;
  sppTipo.value = (tipo === 'pausa') ? 'pausa' : 'stock';

  if (sppPlan) {
    sppPlan.value = plan;
    // Fallback si por acentos la opción no existe:
    if (!Array.from(sppPlan.options).some(o => o.value === sppPlan.value)) {
      sppPlan.value = 'individual';
    }
  }

  // Popular destinos según pestaña actual
  sppPopulateDestinos(sppTipo.value);

  // Preseleccionar color actual del <tr>
  const tr = cell.closest('tr');
  if (sppColor) {
    const current = getRowColorValue(tr);
    sppColor.value = current || '';
  }

  // === abrir modal ===
  if (!sppModal) {
    const el = document.getElementById('modalCambiarPlanStockPausa');
    if (el && window.bootstrap?.Modal) {
      sppModal = bootstrap.Modal.getOrCreateInstance(el);
    }
  }
  if (sppModal) {
    sppModal.show();
    // focus al select plan para UX
    setTimeout(() => { try { sppPlan && sppPlan.focus(); } catch(_){} }, 0);
  }
}


  // Apertura por click (captura)
  document.addEventListener('click', function (ev) {
    const cell = ev.target.closest('.plan-cell-stock, .plan-cell-pausa, [data-open-plan-stock-pausa]');
    if (!cell) return;
    ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();
    sppOpenFromCell(cell);
  }, true);

  // Enter/Espacio
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    const cell = ev.target.closest('.plan-cell-stock, .plan-cell-pausa, [data-open-plan-stock-pausa]');
    if (!cell) return;
    ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();
    sppOpenFromCell(cell);
  }, true);

  // === Reemplazo completo ===
async function sppOnSubmit(ev) {
  ev.preventDefault(); ev.stopPropagation();
  if (!sppForm || sppForm.dataset.sending === '1') return;

  // Construir FormData y FORZAR que los campos clave viajen
  const fd = new FormData(sppForm);

  // id / tipo
  const id = +( (sppId && sppId.value) || (fd.get('id') || 0) );
  const tipo = ( (sppTipo && sppTipo.value) || (fd.get('tipo') || '') ).toLowerCase() === 'pausa' ? 'pausa' : 'stock';
  fd.set('id', String(id));
  fd.set('tipo', tipo);

  // plan (forzado + normalizado)
  let planJs = (sppPlan && sppPlan.value) || (fd.get('plan') || '');
  planJs = normalizePlan( (planJs || '').toString().trim() );
  fd.set('plan', planJs);

  // destino ('' = solo cambiar plan)
  const destinoJs = (sppDestino && sppDestino.value) || (fd.get('destino') || '');
  fd.set('destino', (destinoJs || '').toString().trim());

  // color (enviar siempre, vacío si no hay)
  const colorJs = (sppColor && sppColor.value) || (fd.get('color') || '');
  fd.set('color', (colorJs || '').toString().trim());

  if (!id || !planJs) {
    if (window.Swal?.fire) await Swal.fire({icon:'warning',title:'Faltan datos',text:'ID y Plan son obligatorios.'});
    else alert('Faltan datos');
    return;
  }

  try {
    sppForm.dataset.sending = '1';

    const res = await fetch('ajax/stock_pausa_plan_update.php', {
      method: 'POST',
      body: fd,
      credentials: 'same-origin'
    });

    const js = await res.json().catch(() => ({ ok:false, error:'Respuesta inválida' }));
    if (!res.ok || !js.ok) throw new Error(js.error || ('HTTP '+res.status));

    // Feedback inmediato en UI (color + texto del plan en la celda)
    const planSel = tipo === 'stock'
      ? '.plan-cell-stock[data-id="'+id+'"]'
      : '.plan-cell-pausa[data-id="'+id+'"]';

    const planCell = document.querySelector(planSel);
    if (planCell) {
      // 1) Color
      const tr = planCell.closest('tr');
      if (tr) {
        tr.classList.remove('row-color-rojo','row-color-azul','row-color-verde','row-color-blanco');
        tr.removeAttribute('data-color');
        if (colorJs && colorJs !== 'restablecer') {
          tr.classList.add('row-color-' + colorJs);
          tr.setAttribute('data-color', colorJs);
        }
      }
      // 2) Plan (texto + data-*)
      planCell.setAttribute('data-plan', planJs);
      const a = planCell.querySelector('.js-edit-plan, [data-role="plan-text"], a');
      if (a) {
        a.textContent = planJs;
      } else if (planCell.childElementCount === 0) {
        planCell.textContent = planJs;
      } else {
        let span = planCell.querySelector('span[data-plan-label]');
        if (!span) {
          span = document.createElement('span');
          span.setAttribute('data-plan-label','1');
          planCell.insertBefore(span, planCell.firstChild);
        }
        span.textContent = planJs + ' ';
      }
    }

    // Cerrar modal
        // Cerrar modal
    try {
      const modalEl = sppForm.closest('.modal') || document.querySelector('.modal.show');
      if (window.bootstrap?.Modal && modalEl) bootstrap.Modal.getOrCreateInstance(modalEl).hide();
    } catch(_) {}

    // ✅ Siempre mostrar éxito y recargar la página para ver los cambios
    if (window.Swal?.fire) {
      await Swal.fire({
        icon: 'success',
        title: 'Actualizado',
        timer: 800,
        showConfirmButton: false
      });
    }

    location.reload();

  } catch (err) {
    console.error('[SPP] Error submit:', err);
    if (window.Swal?.fire) Swal.fire({icon:'error',title:'No se pudo guardar',text:String(err || 'Error')});
    else alert('No se pudo guardar: ' + err);
  } finally {
    delete sppForm.dataset.sending;
  }
}

}


})();


  
  
  
  
  
  // === Hotfix: Stock y Pausa deben tener sólo 4 columnas ===
(function(){
  if (window.__fixSPCols) return; // evita doble registro
  window.__fixSPCols = true;

  function enforceFourCols(table){
    if (!table) return;
    const keepFirst = 3; // Plan, Correo, Contraseña (Acciones va al final)
    // <thead>
    const head = table.tHead && table.tHead.rows && table.tHead.rows[0];
    if (head && head.cells.length > 4) {
      for (let i = head.cells.length - 2; i > keepFirst - 1; i--) {
        head.deleteCell(i);
      }
    }
    // <tbody>
    Array.from(table.tBodies || []).forEach(tb => {
      Array.from(tb.rows || []).forEach(tr => {
        const total = tr.cells.length;
        if (total > 4) {
          for (let i = total - 2; i > keepFirst - 1; i--) {
            tr.deleteCell(i);
          }
        }
      });
    });
  }

  function fixStockPausaTables(){
    const stockTable = document.querySelector('.plan-cell-stock')?.closest('table');
    const pausaTable = document.querySelector('.plan-cell-pausa')?.closest('table');
    enforceFourCols(stockTable);
    enforceFourCols(pausaTable);
  }

  // Al cargar
  document.addEventListener('DOMContentLoaded', fixStockPausaTables);

  // Al cambiar de pestaña
  document.addEventListener('shown.bs.tab', (e) => {
    const targetSel = e.target.getAttribute('data-bs-target') || e.target.getAttribute('href');
    if (!targetSel) return;
    const pane = document.querySelector(targetSel);
    if (!pane) return;
    if (pane.querySelector('.plan-cell-stock') || pane.querySelector('.plan-cell-pausa')) {
      fixStockPausaTables();
    }
  });

  // Exponer por si recargas contenido por AJAX
  window.fixStockPausaTables = fixStockPausaTables;
})();

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  


// === Stock/Pausa: abrir modal chico en CAPTURA ===
let sppSubmitting = false;


/* duplicate sppOnSubmit removed */


let lastPlanCellSPP = null;
let sppModal, sppForm, sppId, sppTipo, sppPlan, sppDestino;

function sppEnsureRefs() {
  if (sppForm) return;
  sppForm    = document.getElementById('formPlanStockPausa');
  sppId      = document.getElementById('spp_id');
  sppTipo    = document.getElementById('spp_tipo');
  sppPlan    = document.getElementById('spp_plan');
  sppDestino = document.getElementById('spp_destino');
  const el   = document.getElementById('modalCambiarPlanStockPausa');
  if (el && window.bootstrap?.Modal) {
    sppModal = bootstrap.Modal.getOrCreateInstance(el);
  }
  if (sppForm && !sppForm.dataset.bound) {
    sppForm.addEventListener('submit', sppOnSubmit);
    sppForm.dataset.bound = '1';
  }
}



function sppOpenFromCell(cell){
  sppEnsureRefs();
  if (!sppForm) return;

  cell.setAttribute('data-no-row-modal','1');
  lastPlanCellSPP = cell;

  const tipo = (cell.getAttribute('data-tipo') || (cell.classList.contains('plan-cell-stock')?'stock':'pausa')).toLowerCase();
  const id   = cell.getAttribute('data-id') || cell.dataset.id || '';
  let plan   = (cell.getAttribute('data-plan') || cell.textContent || '').trim().toLowerCase();
  plan = plan.replace('estándard','estándar').replace('standard','estándar').replace('estandar','estándar');
  if (!['individual','estándar','premium'].includes(plan)) plan = 'individual';

  sppId.value   = id;
  sppTipo.value = tipo;
  sppPlan.value = plan;
  sppPopulateDestinos(tipo);

  if (!sppModal) {
    const el = document.getElementById('modalCambiarPlanStockPausa');
    if (el && window.bootstrap?.Modal) sppModal = bootstrap.Modal.getOrCreateInstance(el);
  }
  if (sppModal) sppModal.show();
}

// Click en CAPTURA para ganarle a la fila
document.addEventListener('click', function(ev){
  const cell = ev.target.closest('.plan-cell-stock, .plan-cell-pausa, [data-open-plan-stock-pausa]');
  if (!cell) return;
  ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();
  sppOpenFromCell(cell);
}, true);

// Teclado (Enter/Espacio)
document.addEventListener('keydown', function(ev){
  if (ev.key !== 'Enter' && ev.key !== ' ') return;
  const cell = ev.target.closest('.plan-cell-stock, .plan-cell-pausa, [data-open-plan-stock-pausa]');
  if (!cell) return;
  ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();
  sppOpenFromCell(cell);
}, true);

async function sppOnSubmit(e){
  e.preventDefault();
  const fd = new FormData(sppForm);
  const payload = new URLSearchParams();
  ['id','tipo','plan','destino'].forEach(k=>payload.append(k, (fd.get(k)||'').toString().trim()));

  const res = await fetch('ajax/stock_pausa_plan_update.php', {
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},
    body: payload.toString()
  });
  const data = await res.json();

  if (!data?.ok) {
    const msg = data?.error || 'No se pudo guardar.';
    return (window.Swal ? Swal.fire({icon:'error',title:'Error',text:msg}) : alert(msg));
  }

  if (sppModal) sppModal.hide();

  if (data.moved_to) {
    const row = lastPlanCellSPP?.closest('tr.js-parent-row');
    if (row) row.remove();
    window.Swal ? Swal.fire({toast:true,position:'top',timer:1800,showConfirmButton:false,icon:'success',title:'Movido a '+data.moved_to}) : 0;
  } else if (data.updated) {
    lastPlanCellSPP.textContent = (fd.get('plan')||'').toString();
    lastPlanCellSPP.setAttribute('data-plan',(fd.get('plan')||'').toString());
    window.Swal ? Swal.fire({toast:true,position:'top',timer:1500,showConfirmButton:false,icon:'success',title:'Plan actualizado'}) : 0;
  }
}


function sppSanitizePlanField() {
  // form y select (ajusta si usas otros IDs)
  const sppForm = document.getElementById('formPlanStockPausa');
  const sppPlan = document.getElementById('spp_plan');
  if (!sppForm) return;

  // 1) Elimina inputs ocultos duplicados que puedan pisar el valor del <select>
  sppForm.querySelectorAll('input[name="plan"][type="hidden"]').forEach(el => el.remove());

  // 2) Asegura que el <select> esté visible y con las clases correctas
  if (sppPlan) {
    sppPlan.style.removeProperty('display');
    sppPlan.hidden = false;
    sppPlan.removeAttribute('aria-hidden');
    sppPlan.classList.add('form-select', 'form-select-sm');
  }
}





/* /public/assets/app.js — resetear formularios al presionar "Agregar" */

document.addEventListener('click', function (e) {
  if (e.target && e.target.id === 'btn-add-stock') {
    const form = document.querySelector('#stockModal form');
    if (!form) return;
    form.reset();
    form.querySelector('input[name="action"]').value = 'create';
    form.querySelector('input[name="id"]').value = '';
    // mantener streaming_id y fecha_inicio que ya vienen seteados en hidden
    form.querySelector('select[name="plan"]').value = 'individual';
    form.querySelector('input[name="correo"]').value = '';
    form.querySelector('input[name="password_plain"]').value = '';
    form.querySelector('input[name="whatsapp"]').value = '';
    form.querySelector('input[name="perfil"]').value = '';
    form.querySelector('select[name="combo"]').value = '0';
    form.querySelector('input[name="soles"]').value = '0.00';
    form.querySelector('select[name="estado"]').value = 'pendiente';
    form.querySelector('select[name="dispositivo"]').value = 'tv';
    form.querySelector('input[name="fecha_fin"]').value = '';
  }
}, false);

document.addEventListener('click', function (e) {
  if (e.target && e.target.id === 'btn-add-pausa') {
    const form = document.querySelector('#pausaModal form');
    if (!form) return;
    form.reset();
    form.querySelector('input[name="action"]').value = 'create';
    form.querySelector('input[name="id"]').value = '';
    // mantener streaming_id y fecha_inicio que ya vienen seteados en hidden
    form.querySelector('select[name="plan"]').value = 'individual';
    form.querySelector('input[name="correo"]').value = '';
    form.querySelector('input[name="password_plain"]').value = '';
    form.querySelector('input[name="whatsapp"]').value = '';
    form.querySelector('input[name="perfil"]').value = '';
    form.querySelector('select[name="combo"]').value = '0';
    form.querySelector('input[name="soles"]').value = '0.00';
    form.querySelector('select[name="estado"]').value = 'pendiente';
    form.querySelector('select[name="dispositivo"]').value = 'tv';
    form.querySelector('input[name="fecha_fin"]').value = '';
  }
}, false);




// === STOCK ===
document.addEventListener('click', function (e) {
  const addBtn = e.target.closest('#btn-add-stock');
  if (!addBtn) return;
  const modal = document.getElementById('stockModal');
  const form  = modal ? modal.querySelector('form') : null;
  if (!form) return;
  // reset -> crear
  form.reset();
  form.querySelector('input[name="action"]').value = 'create';
  form.querySelector('input[name="id"]').value = '';
  // mantener streaming_id y fecha_inicio (ya vienen en hidden)
  const t = modal.querySelector('.modal-title'); if (t) t.textContent = 'Agregar Stock';
}, false);

document.addEventListener('click', function (e) {
  const btn = e.target.closest('.btn-edit-stock');
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();

  const data  = JSON.parse(btn.getAttribute('data-row') || '{}');
  const modal = document.getElementById('stockModal');
  const form  = modal ? modal.querySelector('form') : null;
  if (!form) return;

  form.querySelector('input[name="action"]').value = 'update';
  form.querySelector('input[name="id"]').value = data.id ?? '';
  form.querySelector('input[name="streaming_id"]').value = data.streaming_id ?? '';

  const set = (sel, val) => { const el = form.querySelector(sel); if (el) el.value = val ?? ''; };

  set('select[name="plan"]', data.plan || 'individual');
  set('input[name="correo"]', data.correo || '');
  set('input[name="password_plain"]', data.password_plain || '');
  set('input[name="whatsapp"]', data.whatsapp || '');
  set('input[name="perfil"]', data.perfil || '');
  set('select[name="combo"]', (data.combo ? '1' : '0'));
  set('input[name="soles"]', data.soles || '0.00');
  set('select[name="estado"]', data.estado || 'activo');
  set('select[name="dispositivo"]', data.dispositivo || 'tv');
  set('input[name="fecha_fin"]', (data.fecha_fin || '').slice(0,10));

  const t = modal.querySelector('.modal-title'); if (t) t.textContent = 'Editar Stock';

  // abrir modal manualmente (hemos frenado el default)
  if (window.bootstrap) bootstrap.Modal.getOrCreateInstance(modal).show();
}, false);













// === PAUSA ===

// Agregar (CREAR)
document.addEventListener('click', function (e) {
  const addBtn = e.target.closest('#btn-add-pausa');
  if (!addBtn) return;

  const modal = document.getElementById('pausaModal');
  const form  = modal ? modal.querySelector('form') : null;
  if (!form) return;

  // reset -> crear
  form.reset();
  form.querySelector('input[name="action"]').value = 'create';
  form.querySelector('input[name="id"]').value = '';

  const t = modal.querySelector('.modal-title');
  if (t) t.textContent = 'Agregar Cuenta en pausa';
}, false);

// Editar (UPDATE) — solo capta botones de editar, NO el botón Agregar
document.addEventListener('click', function (e) {
  const btn = e.target.closest('.btn-edit-pausa');
  if (!btn) return;

  e.preventDefault();
  e.stopPropagation();

  const raw = btn.getAttribute('data-row');
  if (!raw) return;

  let data;
  try { data = JSON.parse(raw); } catch { return; }

  const modal = document.getElementById('pausaModal');
  const form  = modal ? modal.querySelector('form') : null;
  if (!form) return;

  const set = (sel, val) => { const el = form.querySelector(sel); if (el) el.value = val ?? ''; };

  // acción update
  set('input[name="action"]', 'update');
  set('input[name="id"]', data.id ?? '');

  // NO pisar streaming_id si viene vacío/undefined
  if (data.streaming_id != null && data.streaming_id !== '') {
    set('input[name="streaming_id"]', data.streaming_id);
  }

  // Campos
  set('select[name="plan"]',        data.plan || 'individual');
  set('input[name="correo"]',       data.correo || '');
  set('input[name="password_plain"]', data.password_plain || '');
  set('input[name="whatsapp"]',     data.whatsapp || '');
  set('input[name="perfil"]',       data.perfil || '');
  set('select[name="combo"]',       (data.combo ? '1' : '0'));
  set('input[name="soles"]',        data.soles || '0.00');
  set('select[name="estado"]',      data.estado || 'pendiente');
  set('select[name="dispositivo"]', data.dispositivo || 'tv');
  set('input[name="fecha_inicio"]', (data.fecha_inicio || '').slice(0,10));
  set('input[name="fecha_fin"]',    (data.fecha_fin || '').slice(0,10));

  const t = modal.querySelector('.modal-title');
  if (t) t.textContent = 'Editar Cuenta en pausa';

  // abrir modal por JS (opcional si tu botón ya trae data-bs-toggle)
  if (window.bootstrap) bootstrap.Modal.getOrCreateInstance(modal).show();
}, false);









// Bloquear edición de correo/contraseña en "Editar Perfil" y habilitar en "Agregar Perfil"
(function () {
  const modal = document.getElementById('perfilModal');
  if (!modal) return;

  function setReadOnly(isReadOnly) {
    const correo = modal.querySelector('[name="correo"]');
    const pass   = modal.querySelector('[name="password_plain"]');
    if (correo) correo.readOnly = isReadOnly;
    if (pass)   pass.readOnly   = isReadOnly;
  }

  // Agregar Perfil => editable
  document.addEventListener('click', function (e) {
    const addBtn = e.target.closest('.btn-add-perfil');
    if (!addBtn) return;
    setReadOnly(false);
  });

  // Editar Perfil => no editable
  document.addEventListener('click', function (e) {
    const editBtn = e.target.closest('.btn-edit-perfil');
    if (!editBtn) return;
    setReadOnly(true);
  });
})();



// Auto +1 día al cambiar cualquier <input name="fecha_fin"> en los modals
(function () {
  function addOneDayISO(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1);
    dt.setDate(dt.getDate() + 1);
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${dt.getFullYear()}-${mm}-${dd}`;
  }
  document.addEventListener("change", function (e) {
    if (!e.target.matches('form [name="fecha_fin"]')) return;
    if (!e.target.value) return;
    e.target.value = addOneDayISO(e.target.value);
  });
})();














// Perfiles: en Editar deshabilita correo/contraseña y envía mirrors hidden
(function () {
  const modal = document.getElementById('perfilModal');
  if (!modal) return;

  const form   = modal.querySelector('form');
  const correo = modal.querySelector('input[name="correo"]');
  const pass   = modal.querySelector('input[name="password_plain"]');

  function addMirror(input) {
    if (!input) return;
    let mirror = form.querySelector(`input[type="hidden"][data-mirror="${input.name}"]`);
    if (!mirror) {
      mirror = document.createElement('input');
      mirror.type = 'hidden';
      mirror.name = input.name;          // mismo name para el POST
      mirror.dataset.mirror = input.name;
      form.appendChild(mirror);
    }
    mirror.value = input.value;
  }

  function disableForEdit() {
    [correo, pass].forEach((inp) => {
      if (!inp) return;
      addMirror(inp);
      inp.setAttribute('disabled', '');  // visible deshabilitado
    });
  }

  function enableForCreate() {
    [correo, pass].forEach((inp) => {
      if (!inp) return;
      inp.removeAttribute('disabled');
      const m = form.querySelector(`input[type="hidden"][data-mirror="${inp.name}"]`);
      if (m) m.remove();
    });
  }

  // Agregar => habilitados
  document.addEventListener('click', (e) => {
    if (e.target.closest('.btn-add-perfil')) enableForCreate();
  });

  // Editar => espera a que el modal se pinte y se llenen los campos, luego bloquea
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.btn-edit-perfil')) return;
    const onShown = () => {
      // pequeño tick por si otro script setea los valores justo al mostrar
      setTimeout(disableForEdit, 0);
      modal.removeEventListener('shown.bs.modal', onShown);
    };
    modal.addEventListener('shown.bs.modal', onShown);
  });

  // Seguridad al enviar: sincroniza mirrors si están deshabilitados
  form.addEventListener('submit', () => {
    [correo, pass].forEach((inp) => {
      if (!inp) return;
      const m = form.querySelector(`input[type="hidden"][data-mirror="${inp.name}"]`);
      if (m && inp.disabled) m.value = inp.value;
    });
  });
})();




// Perfiles: en "Editar" bloquear correo y contraseña con readonly; en "Agregar" habilitar.
(function () {
  const modal = document.getElementById('perfilModal');
  if (!modal) return;

  const correo = modal.querySelector('input[name="correo"]');
  const pass   = modal.querySelector('input[name="password_plain"]');

  const setReadOnly = (on) => {
    [correo, pass].forEach((inp) => {
      if (!inp) return;
      if (on) inp.setAttribute('readonly', '');
      else    inp.removeAttribute('readonly');
    });
  };

  // Agregar Perfil => habilitados
  document.addEventListener('click', (e) => {
    if (e.target.closest('.btn-add-perfil')) setReadOnly(false);
  });

  // Editar Perfil => al mostrar el modal, bloquear
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.btn-edit-perfil')) return;
    const onShown = () => {
      // asegura que se aplique después de que otro script precargue los valores
      setTimeout(() => setReadOnly(true), 0);
      modal.removeEventListener('shown.bs.modal', onShown);
    };
    modal.addEventListener('shown.bs.modal', onShown);
  });
})();






// === EDITAR: STOCK ===
document.addEventListener('click', function (e) {
  const btn = e.target.closest('.btn-edit-stock');
  if (!btn) return;

  const raw = btn.getAttribute('data-row');
  if (!raw) return;

  let data;
  try { data = JSON.parse(raw); } catch { return; }

  const modal = document.getElementById('stockModal');
  const form  = modal ? modal.querySelector('form') : null;
  if (!form) return;

  // acción update
  const act = form.querySelector('input[name="action"]');
  if (act) act.value = 'update';

  const fid = form.querySelector('input[name="id"]');
  if (fid) fid.value = data.id ?? '';

  // NO pisar streaming_id si no viene en data-row
  if (data.streaming_id) {
    const fsid = form.querySelector('input[name="streaming_id"]');
    if (fsid) fsid.value = data.streaming_id;
  }

  // Campos comunes
  const setVal = (sel, val) => { const el = form.querySelector(sel); if (el != null && val != null) el.value = val; };
  setVal('input[name="correo"]',         data.correo);
  setVal('input[name="password_plain"]', data.password_plain);
  setVal('input[name="whatsapp"]',       data.whatsapp);
  setVal('input[name="perfil"]',         data.perfil);
  setVal('input[name="soles"]',          data.soles);
  setVal('select[name="estado"]',        data.estado);
  setVal('select[name="dispositivo"]',   data.dispositivo);
  setVal('input[name="fecha_inicio"]',   data.fecha_inicio);
  setVal('input[name="fecha_fin"]',      data.fecha_fin);
  setVal('select[name="plan"]',          data.plan);

  // combo (checkbox o switch)
  const comboEl = form.querySelector('input[name="combo"]');
  if (comboEl) comboEl.checked = !!(Number(data.combo) || data.combo === true);

  // foco
  setTimeout(() => form.querySelector('input[name="correo"]')?.focus(), 0);
}, false);



// === PAUSA: abrir en modo AGREGAR o EDITAR según el trigger ===
(function () {
  const modal = document.getElementById('pausaModal');
  if (!modal) return;

  const form  = modal.querySelector('form');
  const title = modal.querySelector('.modal-title');
  const q  = (sel) => form.querySelector(sel);
  const set = (sel, val) => { const el = q(sel); if (el) el.value = (val ?? ''); };

  // Nota: SOLO si el disparador tiene la clase .btn-edit-pausa será "Editar".
  modal.addEventListener('show.bs.modal', function (e) {
    const trigger = e.relatedTarget;
    const isEdit  = !!(trigger && trigger.matches('.btn-edit-pausa')); // clave del fix

    if (isEdit) {
      // EDITAR
      let d = {};
      try { d = JSON.parse(trigger.getAttribute('data-row') || '{}'); } catch {}

      set('input[name="action"]', 'update');
      set('input[name="id"]', d.id ?? '');

      // No pises streaming_id si viene vacío
      if (d.streaming_id != null && d.streaming_id !== '') {
        set('input[name="streaming_id"]', d.streaming_id);
      }

      set('select[name="plan"]',          d.plan || 'individual');
      set('input[name="correo"]',         d.correo || '');
      set('input[name="password_plain"]', d.password_plain || '');
      set('input[name="whatsapp"]',       d.whatsapp || '');
      set('input[name="perfil"]',         d.perfil || '');
      set('select[name="combo"]',         (d.combo ? '1' : '0'));
      set('input[name="soles"]',          d.soles || '0.00');
      set('select[name="estado"]',        d.estado || 'pendiente');
      set('select[name="dispositivo"]',   d.dispositivo || 'tv');
      set('input[name="fecha_inicio"]',   (d.fecha_inicio || '').slice(0,10));
      set('input[name="fecha_fin"]',      (d.fecha_fin || '').slice(0,10));

      if (title) title.textContent = 'Editar Cuenta en pausa';
    } else {
      // AGREGAR
      const sid = q('input[name="streaming_id"]')?.value || '';
      form.reset();
      set('input[name="action"]', 'create');
      set('input[name="id"]', '');
      set('input[name="streaming_id"]', sid);
      set('select[name="combo"]', '0');
      if (title) title.textContent = 'Agregar Cuenta en pausa';
    }
  });

  // (Opcional) Si quieres evitar burbujeo desde contenedores que también abren el modal
  document.addEventListener('click', function (e) {
    const btnAdd = e.target.closest('#btn-add-pausa');
    if (btnAdd) { e.stopPropagation(); }
    const btnEdit = e.target.closest('.btn-edit-pausa');
    if (btnEdit) { e.stopPropagation(); }
  }, false);
})();




document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('table.table.table-striped').forEach(function (tbl) {
    if (tbl.querySelector('tbody tr.js-parent-row[data-entidad="perfil"]')) {
      tbl.classList.remove('table-striped');   // quita zebra solo aquí
      tbl.classList.add('only-parent-gray');   // activa gris solo en padres
    }
  });
});













// === Perfiles: modal pequeño de Plan (padres) ===
(function(){
  var perfilesTab = document.getElementById('perfiles');
  if (!perfilesTab) return;

  var modalEl = document.getElementById('modalPlanPerfil');
  var modalPlan = modalEl ? new bootstrap.Modal(modalEl) : null;
  var planSelect = document.getElementById('planSelect');
  var planCorreo = document.getElementById('planCorreo');
  var planStreamingId = document.getElementById('planStreamingId');
  var btnGuardarPlan = document.getElementById('btnGuardarPlan');

  function getSID(){
    var m = /[?&]id=([^&]+)/.exec(location.search);
    return m ? decodeURIComponent(m[1]) : '';
  }

  function openPlanModal(a){
    var planActual = (a.dataset.plan || 'individual').toLowerCase();
    if (['individual','standard','premium'].indexOf(planActual) === -1) planActual = 'individual';
    planSelect.value = planActual;
    planCorreo.value = a.dataset.correo || '';
    planStreamingId.value = getSID();
    modalEl._planLink = a;
    modalPlan && modalPlan.show();
  }

  // 1) Inyecta enlace y agrega listener en la CELDA (antes del <tr>)
  var tabla = perfilesTab.querySelector('table');
  if (tabla) {
    tabla.querySelectorAll('tbody tr.js-parent-row').forEach(function(tr){
      var tdPlan   = tr.children[0];
      var tdCorreo = tr.children[1];
      if (!tdPlan || !tdCorreo) return;

      // Inyectar enlace si no existe
      if (!tdPlan.querySelector('.js-edit-plan')) {
        var planText = (tdPlan.textContent || '').trim().toLowerCase();
        var correo   = (tdCorreo.textContent || '').trim();
        var a = document.createElement('a');
        a.href = '#';
        a.className = 'js-edit-plan text-reset text-decoration-none';
        a.dataset.plan   = planText || 'individual';
        a.dataset.correo = correo;
        a.textContent    = planText || 'individual';
        tdPlan.textContent = '';
        tdPlan.appendChild(a);
      }

      // Listener en la CELDA: se ejecuta antes que el del <tr>
      tdPlan.addEventListener('click', function(ev){
        if (__isIptvContext(tdPlan)) return; // IPTV: no abrir Cambiar plan
        var link = ev.target.closest('a.js-edit-plan');
        if (!link) return;
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation();
        openPlanModal(link);
      });

      // También bloquea mousedown para evitar focus/selección que dispare al <tr>
      tdPlan.addEventListener('mousedown', function(ev){
        if (ev.target.closest('a.js-edit-plan')) {
          ev.preventDefault();
          ev.stopPropagation();
          ev.stopImmediatePropagation();
        }
      }, true);
    });
  }

  // 2) Guardar (AJAX) y reflejar cambio en la celda
  btnGuardarPlan && btnGuardarPlan.addEventListener('click', function(){
    var body = new FormData(document.getElementById('formPlanPerfil'));
    btnGuardarPlan.disabled = true;

  const urlPlan = '/public/ajax/perfiles_plan_update.php';

fetch(urlPlan, {
  method: 'POST',
  body: body,
  headers: { 'X-Requested-With': 'XMLHttpRequest' }
})
.then(async function (r) {
  const status = r.status;
  let data = {};
  try { data = await r.json(); } catch(e) {}
  if (!r.ok || !data.ok) {
    throw new Error(data.msg || ('HTTP ' + status));
  }
  return data;
})
.then(function () {
  var nuevo = planSelect.value;
  if (modalEl && modalEl._planLink) {
    modalEl._planLink.textContent = nuevo;
    modalEl._planLink.dataset.plan = nuevo;
  }
  modalPlan && modalPlan.hide();
  window.Swal && Swal.fire({icon:'success',title:'Plan actualizado',timer:1200,showConfirmButton:false});
})
.catch(function (err) {
  window.Swal && Swal.fire({icon:'error',title: (err && err.message) ? err.message : 'No se pudo actualizar',timer:2000,showConfirmButton:false});
})
.finally(function(){ btnGuardarPlan.disabled = false; });

    
    
    
    
  });
})();










// Fecha fin = fecha inicio + 31 días (por defecto y al cambiar)
document.addEventListener('DOMContentLoaded', function () {
  function addDaysISO(iso, days) {
    if (!iso) return '';
    var p = iso.split('-').map(Number);
    if (p.length !== 3) return '';
    var d = new Date(p[0], p[1]-1, p[2] + days);
    var y = d.getFullYear();
    var m = String(d.getMonth()).padStart(2,'0');
    var dd = String(d.getDate()).padStart(2,'0');
    return y + '-' + m + '-' + dd;
  }

  // Inicial: si hay fecha_inicio y fecha_fin está vacío, setear +31
  var scope = document.getElementById('perfiles') || document;
  var fi = scope.querySelector('input[name="fecha_inicio"]');
  var ff = scope.querySelector('input[name="fecha_fin"]');
  if (fi && ff && (!ff.value || ff.value === '')) {
    ff.value = addDaysISO(fi.value || (new Date().toISOString().slice(0,10)), 30);
  }

  // Al cambiar fecha_inicio, actualizar fecha_fin
  document.addEventListener('change', function (e) {
    if (!e.target.matches('input[name="fecha_inicio"]')) return;
    var form = e.target.form || scope;
    var fin = form.querySelector('input[name="fecha_fin"]') || ff;
    if (fin) fin.value = addDaysISO(e.target.value, 30);
  }, true);
});

















// Solo íconos en columna Whatsapp (Perfiles)
document.addEventListener('DOMContentLoaded', function () {
  var scope = document.getElementById('perfiles');
  if (!scope) return;

  var table = scope.querySelector('table');
  if (!table) return;

  // Ubicar índice de la columna "Whatsapp"
  var ths = table.querySelectorAll('thead th');
  var colIdx = -1;
  ths.forEach(function (th, i) {
    var t = (th.textContent || '').trim().toLowerCase();
    if (t.includes('whatsapp')) colIdx = i;
  });
  if (colIdx === -1) return;

  function digitsOnly(s){ return (s || '').replace(/\D+/g, ''); }

  table.querySelectorAll('tbody tr').forEach(function (tr) {
    var td = tr.children[colIdx];
    if (!td) return;

    // Extraer número de la celda (texto o enlace existente)
    var raw = (td.textContent || '').trim();
    var num = digitsOnly(raw);
    if (!num || num.length < 7) return; // no tocar si no hay número razonable

    // Construir íconos
    var wrap = document.createElement('span');
    wrap.className = 'wa-tg';

    var aWa = document.createElement('a');
    aWa.href = 'https://wa.me/' + num; // requiere formato internacional sin '+'
    aWa.target = '_blank';
    aWa.rel = 'noopener';
    aWa.className = 'wa-link';
    aWa.title = 'WhatsApp';

    aWa.innerHTML =
      '<svg fill="#1daa61" viewBox="0 0 32 32" version="1.1" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <title>whatsapp</title> <path d="M26.576 5.363c-2.69-2.69-6.406-4.354-10.511-4.354-8.209 0-14.865 6.655-14.865 14.865 0 2.732 0.737 5.291 2.022 7.491l-0.038-0.070-2.109 7.702 7.879-2.067c2.051 1.139 4.498 1.809 7.102 1.809h0.006c8.209-0.003 14.862-6.659 14.862-14.868 0-4.103-1.662-7.817-4.349-10.507l0 0zM16.062 28.228h-0.005c-0 0-0.001 0-0.001 0-2.319 0-4.489-0.64-6.342-1.753l0.056 0.031-0.451-0.267-4.675 1.227 1.247-4.559-0.294-0.467c-1.185-1.862-1.889-4.131-1.889-6.565 0-6.822 5.531-12.353 12.353-12.353s12.353 5.531 12.353 12.353c0 6.822-5.53 12.353-12.353 12.353h-0zM22.838 18.977c-0.371-0.186-2.197-1.083-2.537-1.208-0.341-0.124-0.589-0.185-0.837 0.187-0.246 0.371-0.958 1.207-1.175 1.455-0.216 0.249-0.434 0.279-0.805 0.094-1.15-0.466-2.138-1.087-2.997-1.852l0.010 0.009c-0.799-0.74-1.484-1.587-2.037-2.521l-0.028-0.052c-0.216-0.371-0.023-0.572 0.162-0.757 0.167-0.166 0.372-0.434 0.557-0.65 0.146-0.179 0.271-0.384 0.366-0.604l0.006-0.017c0.043-0.087 0.068-0.188 0.068-0.296 0-0.131-0.037-0.253-0.101-0.357l0.002 0.003c-0.094-0.186-0.836-2.014-1.145-2.758-0.302-0.724-0.609-0.625-0.836-0.637-0.216-0.010-0.464-0.012-0.712-0.012-0.395 0.010-0.746 0.188-0.988 0.463l-0.001 0.002c-0.802 0.761-1.3 1.834-1.3 3.023 0 0.026 0 0.053 0.001 0.079l-0-0.004c0.131 1.467 0.681 2.784 1.527 3.857l-0.012-0.015c1.604 2.379 3.742 4.282 6.251 5.564l0.094 0.043c0.548 0.248 1.25 0.513 1.968 0.74l0.149 0.041c0.442 0.14 0.951 0.221 1.479 0.221 0.303 0 0.601-0.027 0.889-0.078l-0.031 0.004c1.069-0.223 1.956-0.868 2.497-1.749l0.009-0.017c0.165-0.366 0.261-0.793 0.261-1.242 0-0.185-0.016-0.366-0.047-0.542l0.003 0.019c-0.092-0.155-0.34-0.247-0.712-0.434z"></path> </g></svg>';

    // Telegram: deep link + fallback web
var aTg = document.createElement('a');
aTg.href = 'tg://resolve?phone=+' + num; // requiere "+" y código internacional
aTg.className = 'tg-link';
aTg.title = 'Telegram';
aTg.rel = 'noopener';
aTg.innerHTML =
  '<svg viewBox="0 0 256 256" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" preserveAspectRatio="xMidYMid" fill="#000000"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <g> <path d="M128,0 C57.307,0 0,57.307 0,128 L0,128 C0,198.693 57.307,256 128,256 L128,256 C198.693,256 256,198.693 256,128 L256,128 C256,57.307 198.693,0 128,0 L128,0 Z" fill="#40B3E0"> </path> <path d="M190.2826,73.6308 L167.4206,188.8978 C167.4206,188.8978 164.2236,196.8918 155.4306,193.0548 L102.6726,152.6068 L83.4886,143.3348 L51.1946,132.4628 C51.1946,132.4628 46.2386,130.7048 45.7586,126.8678 C45.2796,123.0308 51.3546,120.9528 51.3546,120.9528 L179.7306,70.5928 C179.7306,70.5928 190.2826,65.9568 190.2826,73.6308" fill="#FFFFFF"> </path> <path d="M98.6178,187.6035 C98.6178,187.6035 97.0778,187.4595 95.1588,181.3835 C93.2408,175.3085 83.4888,143.3345 83.4888,143.3345 L161.0258,94.0945 C161.0258,94.0945 165.5028,91.3765 165.3428,94.0945 C165.3428,94.0945 166.1418,94.5735 163.7438,96.8115 C161.3458,99.0505 102.8328,151.6475 102.8328,151.6475" fill="#D2E5F1"> </path> <path d="M122.9015,168.1154 L102.0335,187.1414 C102.0335,187.1414 100.4025,188.3794 98.6175,187.6034 L102.6135,152.2624" fill="#B5CFE4"> </path> </g> </g></svg>';

aTg.addEventListener('click', function(ev){
  ev.preventDefault();
  ev.stopPropagation();

  var deep = 'tg://resolve?phone=+' + num;     // abre app si está instalada
  var web  = 'https://t.me/+' + num;           // fallback web

  // intenta deep link y, si no abre, cae al fallback web
  var timer = setTimeout(function(){ window.open(web, '_blank', 'noopener'); }, 700);
  window.location.href = deep;
  document.addEventListener('visibilitychange', function onVis(){
    if (document.hidden) { clearTimeout(timer); document.removeEventListener('visibilitychange', onVis); }
  });
});








    // Reemplazar contenido
    td.textContent = '';
    td.appendChild(wrap);
    wrap.appendChild(aWa);
    wrap.appendChild(aTg);
  });
});

// Evita que el icono de WhatsApp abra el modal del padre
['mousedown','touchstart','click'].forEach(function(evt){
  document.addEventListener(evt, function(ev){
    var a = ev.target.closest('#perfiles .wa-tg a.wa-link');
    if (!a) return;

    ev.stopImmediatePropagation();
    ev.stopPropagation();

    if (evt === 'click') {
      ev.preventDefault();
      window.open(a.href, '_blank', 'noopener');
    }
  }, true); // captura
});


















// Paginación client-side (agrupa padre+hijas si existen) — REEMPLAZO COMPLETO
(function(){
  function buildPager(table){
    var tbody = table.tBodies && table.tBodies[0];
    if (!tbody) return;

    // Detectar agrupación por filas padre
    var grouped = !!tbody.querySelector('tr.js-parent-row');
    var groups = [];
    if (grouped) {
      var cur = [];
      Array.prototype.forEach.call(tbody.rows, function(r){
        if (r.classList.contains('js-parent-row')) {
          if (cur.length) groups.push(cur);
          cur = [r];
        } else {
          cur.push(r);
        }
      });
      if (cur.length) groups.push(cur);
    } else {
      Array.prototype.forEach.call(tbody.rows, function(r){ groups.push([r]); });
    }

    var sizeAttr = parseInt(table.getAttribute('data-page-size') || '', 10);
    var pageSize = isNaN(sizeAttr) ? (grouped ? 12 : 25) : sizeAttr;
    var total = groups.length;
    var pages = Math.ceil(total / pageSize);

    // Crear/reciclar nav
    var nav = table._pagerNav;
    if (!nav) {
      nav = document.createElement('nav');
      nav.className = 'table-pager';
      nav.innerHTML = '<ul class="pagination pagination-sm justify-content-end"></ul>';
      table.insertAdjacentElement('afterend', nav);
      table._pagerNav = nav;

      // Delegación de click en NAV (sin captura), evita que burbujee más allá del nav
      nav.addEventListener('click', function(e){
        var btn = e.target.closest('button.page-link');
        if (!btn || !nav.contains(btn)) return;
        e.preventDefault();
        e.stopPropagation();
        var to = parseInt(btn.dataset.page, 10);
        if (!isNaN(to)) renderPage(to);
      }, false);
    }
    var ul = nav.querySelector('ul');

    function renderPage(p){
      var current = Math.min(Math.max(p, 1), pages || 1);

      // Ocultar todo
      for (var gi=0; gi<groups.length; gi++){
        var g = groups[gi];
        for (var ri=0; ri<g.length; ri++){ g[ri].style.display = 'none'; }
      }

      // Sin paginación → mostrar todo y ocultar nav
      if (pages <= 1) {
        for (var gi2=0; gi2<groups.length; gi2++){
          var g2 = groups[gi2];
          for (var r2=0; r2<g2.length; r2++){ g2[r2].style.display = ''; }
        }
        nav.style.display = 'none';
        table._currentPage = 1; table._totalPages = 1;
        return;
      }
      nav.style.display = '';

      // Mostrar página actual
      var start = (current-1)*pageSize, end = Math.min(start+pageSize, groups.length);
      for (var i=start; i<end; i++){
        var gg = groups[i];
        for (var k=0; k<gg.length; k++){ gg[k].style.display = ''; }
      }

      // Pintar controles como BOTONES (no alteran la URL)
      ul.innerHTML = '';
      var add = function(lbl, page, disabled, active){
        var li = document.createElement('li');
        li.className = 'page-item' + (disabled ? ' disabled' : '') + (active ? ' active' : '');
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'page-link';
        btn.textContent = lbl;
        btn.dataset.page = String(page);
        li.appendChild(btn);
        ul.appendChild(li);
      };
      add('«', current-1, current===1, false);
      for (var n=1; n<=pages; n++){ add(String(n), n, false, n===current); }
      add('»', current+1, current===pages, false);

      table._currentPage = current;
      table._totalPages = pages;
    }

    renderPage(table._currentPage || 1);

    // Rebuild si cambian filas
    if (!table._pagerObserver) {
      var obs = new MutationObserver(function(){
        clearTimeout(table._pagerTO);
        table._pagerTO = setTimeout(function(){ buildPager(table); }, 80);
      });
      obs.observe(tbody, { childList: true });
      table._pagerObserver = obs;
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    var selector = '#perfiles table.table, #cuentas table.table, #stock table.table, #pausa table.table, .tab-pane table.table';
    document.querySelectorAll(selector).forEach(buildPager);
    window.rebuildTablePagers = function(){
      document.querySelectorAll(selector).forEach(buildPager);
    };
  });
})();
















// Editar Perfil: al abrir, copiar el plan actual (desde la fila padre) al input hidden
document.addEventListener('show.bs.modal', function (ev) {
  if (!ev.target || ev.target.id !== 'modalEditarPerfil') return;

  var trigger = ev.relatedTarget || null;
  var tr = trigger ? trigger.closest('tr') : null;
  var correo = '';

  if (tr) {
    var c2 = tr.querySelector('td:nth-child(2)');
    correo = (c2 && c2.textContent || '').trim();
  }

  var tabla = document.querySelector('#perfiles table');
  var plan = 'premium';
  if (tabla && correo) {
    var parent = Array.from(tabla.querySelectorAll('tbody tr.js-parent-row')).find(function (rw) {
      var t = (rw.querySelector('td:nth-child(2)')?.textContent || '').trim();
      return t === correo;
    });
    if (parent) {
      var ptxt = (parent.querySelector('td:nth-child(1)')?.textContent || '').trim().toLowerCase();
      if (ptxt) plan = ptxt;
    }
  }

  var hidden = ev.target.querySelector('input#edit_plan_hidden');
  if (hidden) hidden.value = plan;
});
















// Oculta cualquier campo "plan" en modales (excepto cambiar plan + streaming) y evita inyectar hidden en Streaming
document.addEventListener('show.bs.modal', function (ev) {
  var modal = ev.target;
  if (!modal) return;

  // === EXCEPCIONES: NO tocar plan en estos modales ===
  var isModalCambiarPlan = (modal.id === 'modalPlanPerfil');
  var isModalStreaming =
    (modal.id === 'modalAgregarStreaming' || modal.id === 'modalEditarStreaming' ||
     !!modal.querySelector('form[action*="StreamingController.php"]'));

  if (isModalCambiarPlan) {
    return; // aquí sí debe manejarse el plan
  }

  if (isModalStreaming) {
    // En Streaming: mostrar el select de plan y eliminar cualquier hidden duplicado
    var planField = modal.querySelector('[name="plan"]');
    if (planField) {
      // Asegurar que el contenedor que lo oculta quede visible
      (function showContainer(el){
        var node = el;
        while (node && node !== modal && node.tagName !== 'FORM') {
          // Si estaba oculto, lo mostramos
          if (node.style && node.style.display === 'none') node.style.display = '';
          node = node.parentElement;
        }
        if (el.style && el.style.display === 'none') el.style.display = '';
      })(planField);

      // Mantener required en visible
      planField.setAttribute('required', '');
    }
    // Eliminar cualquier hidden inyectado previamente con name="plan"
    modal.querySelectorAll('input[type="hidden"][name="plan"]').forEach(function(h){
      h.parentNode && h.parentNode.removeChild(h);
    });
    return; // no continuar con la lógica de ocultamiento/inyección
  }

  // === Resto de modales: ocultar plan y asegurar hidden (como antes) ===
  var planField = modal.querySelector('[name="plan"]');
  if (!planField) return; // este modal no maneja "plan"

  // 1) Ocultar el control visible de plan (select/input) y su contenedor si existe
  (function hideContainer(el){
    var node = el;
    while (node && node !== modal && !node.classList.contains('mb-3') && node.tagName !== 'FORM') {
      node = node.parentElement;
    }
    if (node && node !== modal && node.tagName !== 'FORM') node.style.display = 'none';
    else el.style.display = 'none';
  })(planField);

  // 2) Asegurar hidden "plan"
  var form = modal.querySelector('form') || modal;
  var hidden = form.querySelector('input[type="hidden"][name="plan"]');
  if (!hidden) {
    hidden = document.createElement('input');
    hidden.type = 'hidden';
    hidden.name = 'plan';
    form.appendChild(hidden);
  }

  // 3) Asignar valor
  // Si es modal de "Agregar": premium por defecto
  if (modal.id && /agregar/i.test(modal.id)) {
    hidden.value = 'premium';
    return;
  }

  // Si es modal de "Editar": intentar tomar el plan desde la fila padre (col 1) del correo (col 2)
  var trigger = ev.relatedTarget || null;
  var tr = trigger ? trigger.closest('tr') : null;
  var correo = '';
  if (tr) {
    var c2 = tr.querySelector('td:nth-child(2)');
    correo = (c2 && c2.textContent || '').trim();
  }

  var tabla = document.querySelector('#perfiles table');
  var plan = 'premium';
  if (tabla && correo) {
    var parent = Array.from(tabla.querySelectorAll('tbody tr.js-parent-row')).find(function (rw) {
      var t = (rw.querySelector('td:nth-child(2)')?.textContent || '').trim();
      return t === correo;
    });
    if (parent) {
      var ptxt = (parent.querySelector('td:nth-child(1)')?.textContent || '').trim().toLowerCase();
      if (ptxt) plan = ptxt;
    }
  }
  hidden.value = plan;
}, true);







// Estado: solo "activo" y "pendiente".
// Agregar → "activo" por defecto. Editar → usar valor actual de la fila.
document.addEventListener('show.bs.modal', function (ev) {
  var modal = ev.target;
  if (!modal || modal.id === 'modalPlanPerfil') return;

  var sel = modal.querySelector('select[name="estado"]');
  if (!sel) return;

  // Opciones permitidas
  sel.innerHTML =
    '<option value="activo">activo</option>' +
    '<option value="pendiente">pendiente</option>';

  var trigger = ev.relatedTarget || null;
  var tr = trigger ? trigger.closest('tr') : null;

  if (!tr) {
    // Agregar (no viene desde una fila)
    sel.value = 'activo';
    return;
  }

  // Editar (viene desde una fila): leer estado actual de la celda "Estado"
  var table = tr.closest('table');
  var idx = -1, val = '';
  if (table && table.tHead) {
    table.tHead.querySelectorAll('th').forEach(function (th, i) {
      if ((th.textContent || '').trim().toLowerCase().includes('estado')) idx = i;
    });
  }
  if (idx >= 0 && tr.children[idx]) {
    val = (tr.children[idx].textContent || '').trim().toLowerCase();
  }
  sel.value = (val === 'pendiente') ? 'pendiente' : 'activo';
});

























// === Cambiar plan para CUENTAS (Cuenta completa) ===
(function () {
  const tablaCuentas = document.querySelector('#cuentas table');
  if (!tablaCuentas) return;

  tablaCuentas.addEventListener('click', function onCellClick(ev) {
    const td = ev.target.closest('.plan-cell-cuenta');
    if (!td) return;

    ev.preventDefault();
    ev.stopPropagation();

    // ID robusto desde la celda
    const id = (td.getAttribute('data-cu-id') || td.getAttribute('data-id') || '').replace(/\D+/g,'');
    if (!id) return;

    const modalEl  = document.getElementById('modalCambiarPlanCuenta');
    if (!modalEl) return;

    const formEl   = modalEl.querySelector('#formCambiarPlanCuenta');
    const idEl     = modalEl.querySelector('#cuentaPlanId');
    const planEl   = modalEl.querySelector('#cuentaPlanSelect');
    const enviarEl = modalEl.querySelector('#cuentaEnviarASelect');
    const colorEl  = formEl ? formEl.querySelector('select[name="color"]') : null; // SCOPED al modal

    if (!formEl || !idEl || !planEl) return;

    // Precarga
    idEl.value = id;

    const curPlan = (td.getAttribute('data-plan') || td.getAttribute('data-current-plan') || td.textContent || '').trim().toLowerCase();
    let p = curPlan;
    if (p === 'estandar' || p === 'estándard') p = 'standard';
    if (!['individual','standard','premium'].includes(p)) p = 'premium';
    Array.from(planEl.options).forEach(opt => { opt.selected = (opt.value.toLowerCase() === p); });

    if (colorEl) {
      const tr = td.closest('tr');
      const c = tr ? (tr.getAttribute('data-color') || '') : '';
      colorEl.value = c || '';
      // Asegurar que NO esté deshabilitado (los disabled no se envían)
      colorEl.disabled = false;
    }

    // Evitar submit nativo duplicado
    formEl.addEventListener('submit', function (e) { e.preventDefault(); e.stopPropagation(); }, { once:true });

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();

    // Clonar el botón para remover listeners legacy y cortar propagación
    const oldBtn = modalEl.querySelector('#btnGuardarPlanCuenta');
    if (!oldBtn) return;
    const btnGuardar = oldBtn.cloneNode(true);
    oldBtn.parentNode.replaceChild(btnGuardar, oldBtn);

    const onSubmit = async function (e) {
      if (e) { e.preventDefault(); e.stopImmediatePropagation(); }

      // Reforzar ID justo antes de enviar
      idEl.value = (idEl.value || '').replace(/\D+/g,'') || id;

      // Construir payload DESDE EL FORM (como Perfiles)
      const fd = new FormData(formEl);

      // Set explícito de campos clave (por si algún legacy los cambia)
      if (!fd.get('id'))       fd.set('id', idEl.value);
      fd.set('cuenta_id', idEl.value); // tolerante con backend
      if (!fd.get('plan'))     fd.set('plan', planEl.value);
      if (!fd.get('enviar_a')) fd.set('enviar_a', (enviarEl && enviarEl.value) ? enviarEl.value : 'none');

      // Enviar SIEMPRE color (aunque sea vacío) -> evita que falte en Network Payload
      if (colorEl) {
        fd.set('color', colorEl.value || '');
      } else if (!fd.has('color')) {
        fd.set('color', '');
      }

      const body = new URLSearchParams();
      for (const [k, v] of fd.entries()) body.append(k, v == null ? '' : String(v));

      try {
        const res = await fetch(formEl.action || 'ajax/cuenta_plan_update.php', {
          method: 'POST',
          headers: { 'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8' },
          credentials: 'same-origin',
          redirect: 'follow',
          body
        });

        // Si el servidor redirige a login u otra cosa, evitar parseo de HTML
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('application/json')) {
          if (window.Swal) Swal.fire({ icon:'error', title:'Respuesta no válida', text:'Contenido no JSON (posible redirect)' });
          return;
        }

        const data = await res.json();
        if (data && data.ok) {
          // Actualiza plan en la celda
          const planTxt = planEl.value;
          td.textContent = planTxt;
          td.setAttribute('data-plan', planTxt);
          td.setAttribute('data-current-plan', planTxt);

          // Pintado de color (usa color devuelto si existe)
          const tr = td.closest('tr');
          if (tr) {
            const hasRespColor = Object.prototype.hasOwnProperty.call(data, 'color');
            const chosen = (fd.get('color') || '').toString().trim();
            const newColor = hasRespColor ? (data.color === null ? '' : (data.color || '')) : chosen;

            tr.classList.remove('row-color-rojo','row-color-azul','row-color-verde','row-color-blanco');
            tr.removeAttribute('data-color');
            if (newColor && ['rojo','azul','verde','blanco'].includes(newColor)) {
              tr.classList.add('row-color-' + newColor);
              tr.setAttribute('data-color', newColor);
            }
          }

          if (window.Swal) await Swal.fire({ icon:'success', title:'Plan actualizado', timer:1200, showConfirmButton:false });
          modal.hide();
        } else {
          if (window.Swal) Swal.fire({ icon:'error', title:'No se pudo guardar', text:(data && data.error) || 'Intenta de nuevo' });
        }
      } catch (err) {
        if (window.Swal) Swal.fire({ icon:'error', title:'Error de red', text:'Verifica tu conexión' });
      } finally {
        formEl.removeEventListener('submit', onSubmit, { once:true });
        btnGuardar.removeEventListener('click', triggerSubmit, { once:true });
      }
    };

    const triggerSubmit = function (e) {
      if (e) { e.preventDefault(); e.stopImmediatePropagation(); }
      // Lanza submit "real" para que FormData tome todos los campos (incluido color)
      if (formEl.requestSubmit) formEl.requestSubmit();
      else onSubmit(new Event('submit'));
    };

    // Enlazar (limpio y de una sola vez)
    formEl.addEventListener('submit', onSubmit, { once:true, capture:true });
    btnGuardar.addEventListener('click', triggerSubmit, { once:true, capture:true });
  });
})();












// === Cambiar plan para CUENTAS (Cuenta completa) — DEBUG PACK v1 ===
(function () {
  const TAG = 'CUENTAS_DBG';
  const tablaCuentas = document.querySelector('#cuentas table');
  if (!tablaCuentas) { console.warn(TAG, 'No hay #cuentas table'); return; }

  // Util: volcado legible de FormData
  function dumpFormData(fd) {
    const o = {};
    for (const [k,v] of fd.entries()) o[k] = v;
    console.groupCollapsed(TAG, 'FormData ->', o);
    console.table(o); console.groupEnd();
    return o;
  }

  // Util: contar y listar #spp_color (duplicados)
  function logColorSelects(modalEl) {
    const all = document.querySelectorAll('#spp_color');
    console.log(TAG, 'spp_color encontrados en DOM:', all.length, all);
    const inModal = modalEl ? modalEl.querySelectorAll('#spp_color, select[name="color"]') : [];
    console.log(TAG, 'color dentro del modal:', inModal.length, inModal);
  }

  // Util: neutralizar listeners antiguos clonando nodo
  function cloneDetach(el) {
    if (!el) return el;
    const cl = el.cloneNode(true);
    el.parentNode.replaceChild(cl, el);
    return cl;
  }

  tablaCuentas.addEventListener('click', function (ev) {
    const td = ev.target.closest('.plan-cell-cuenta');
    if (!td) return;

    ev.preventDefault();
    ev.stopPropagation();

    const id = (td.getAttribute('data-cu-id') || td.getAttribute('data-id') || '').replace(/\D+/g,'');
    console.log(TAG, 'Click en celda', { id, td });
    if (!id) { console.error(TAG, 'Sin ID en la celda'); return; }

    const modalEl  = document.getElementById('modalCambiarPlanCuenta');
    if (!modalEl) { console.error(TAG, 'No hay modalCambiarPlanCuenta'); return; }

    // CLONAR form y botón para cortar listeners legacy
    let formEl = modalEl.querySelector('#formCambiarPlanCuenta');
    if (!formEl) { console.error(TAG, 'No hay formCambiarPlanCuenta'); return; }
    formEl = cloneDetach(formEl);

    let btnGuardar = modalEl.querySelector('#btnGuardarPlanCuenta');
    if (!btnGuardar) { console.error(TAG, 'No hay btnGuardarPlanCuenta'); return; }
    btnGuardar = cloneDetach(btnGuardar);

    // Re-obtener refs del form clonado
    const idEl     = formEl.querySelector('#cuentaPlanId');
    const planEl   = formEl.querySelector('#cuentaPlanSelect');
    const enviarEl = formEl.querySelector('#cuentaEnviarASelect');
    const colorEl  = formEl.querySelector('select[name="color"]'); // SCOPED al modal

    logColorSelects(modalEl);

    if (!idEl || !planEl) { console.error(TAG, 'Faltan inputs en form'); return; }

    // Precarga
    idEl.value = id;

    const curPlan = (td.getAttribute('data-plan') || td.getAttribute('data-current-plan') || td.textContent || '').trim().toLowerCase();
    let p = curPlan;
    if (p === 'estandar' || p === 'estándard') p = 'standard';
    if (!['individual','standard','premium'].includes(p)) p = 'premium';
    Array.from(planEl.options).forEach(opt => { opt.selected = (opt.value.toLowerCase() === p); });

    if (colorEl) {
      const tr = td.closest('tr');
      const c = tr ? (tr.getAttribute('data-color') || '') : '';
      colorEl.disabled = false; // por si acaso
      colorEl.value = c || '';
    }

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modalEl.setAttribute('data-debug-open', Date.now());
    console.log(TAG, 'Abre modal', { id, curPlan: p });
    modal.show();

    // Submit handler — con FormData (garantiza name=color)
    const onSubmit = async function (e) {
      if (e) { e.preventDefault(); e.stopImmediatePropagation(); }

      // Reforzar ID del hidden justo antes de enviar
      idEl.value = (idEl.value || '').replace(/\D+/g,'') || id;

      const fd = new FormData(formEl);
      if (!fd.get('id')) fd.set('id', idEl.value);
      if (!fd.get('plan')) fd.set('plan', planEl.value);
      fd.set('enviar_a', (enviarEl && enviarEl.value) ? enviarEl.value : 'none');

      // Enviar SIEMPRE color (aunque sea vacío), para que aparezca en Payload
      if (colorEl) fd.set('color', colorEl.value || '');
      else if (!fd.has('color')) fd.set('color', '');

      // Etiqueta de traza
      fd.set('dbg_tag', 'cuentas_debug_v1_' + Date.now());

      // Dump visible de lo que SE ENVIARÁ
      dumpFormData(fd);

      // Construir URL absoluta efectiva
      const url = new URL(formEl.action || 'ajax/cuenta_plan_update.php', document.baseURI);
      console.log(TAG, 'Fetch →', url.href);

      try {
        const res = await fetch(url.href, {
          method: 'POST',
          headers: { 'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8' },
          cache: 'no-store',
          credentials: 'same-origin',
          redirect: 'follow',
          body: new URLSearchParams(fd)
        });

        console.log(TAG, 'Response status', res.status, 'CT', res.headers.get('content-type'));
        if (!res.headers.get('content-type')?.includes('application/json')) {
          const peek = await res.text();
          console.error(TAG, 'Respuesta no JSON (posible redirect). Peek:', peek.slice(0,300));
          if (window.Swal) Swal.fire({ icon:'error', title:'Respuesta no válida', text:'No es JSON (¿redirect/login?)' });
          return;
        }

        const data = await res.json();
        console.log(TAG, 'JSON', data);

        if (data && data.ok) {
          const planTxt = planEl.value;
          td.textContent = planTxt;
          td.setAttribute('data-plan', planTxt);
          td.setAttribute('data-current-plan', planTxt);

          const tr = td.closest('tr');
          if (tr) {
            const hasRespColor = Object.prototype.hasOwnProperty.call(data, 'color');
            const chosen = (fd.get('color') || '').toString().trim();
            const newColor = hasRespColor ? (data.color === null ? '' : (data.color || '')) : chosen;
            tr.classList.remove('row-color-rojo','row-color-azul','row-color-verde','row-color-blanco');
            tr.removeAttribute('data-color');
            if (newColor && ['rojo','azul','verde','blanco'].includes(newColor)) {
              tr.classList.add('row-color-' + newColor);
              tr.setAttribute('data-color', newColor);
            }
          }

          if (window.Swal) await Swal.fire({ icon:'success', title:'Plan actualizado', timer:1200, showConfirmButton:false });
          modal.hide();
        } else {
          if (window.Swal) Swal.fire({ icon:'error', title:'No se pudo guardar', text:(data && data.error) || 'Intenta de nuevo' });
        }
      } catch (err) {
        console.error(TAG, 'Fetch error', err);
        if (window.Swal) Swal.fire({ icon:'error', title:'Error de red', text:'Verifica tu conexión' });
      } finally {
        formEl.removeEventListener('submit', onSubmit, { capture:true });
      }
    };

    // Captura SUBMIT del FORM (antes que cualquier delegación)
    formEl.addEventListener('submit', onSubmit, { once:true, capture:true });

    // Recolgar el click del botón: capturando y evitando legacy
    btnGuardar.addEventListener('click', function (e) {
      e.preventDefault(); e.stopImmediatePropagation();
      // Usar submit real para que FormData incluya todo
      if (formEl.requestSubmit) formEl.requestSubmit();
      else onSubmit(new Event('submit'));
    }, { once:true, capture:true });
  });
})();
















// === Cuenta completa: filas no clickeables, excepto celda Plan (abre modal) y WA/TG (enlaces) ===
(function () {
  const tablaCuentas = document.querySelector('#cuentas table[data-no-row-modal="1"]') || document.querySelector('#cuentas table');
  if (!tablaCuentas) return;

  // Bloquea modal de fila; permite Plan (modal chico) y WA/TG (enlaces) sin burbujeo
  tablaCuentas.addEventListener('click', function (ev) {
    const isPlan = ev.target.closest('.plan-cell-cuenta');
    const isContact = ev.target.closest('.whatsapp-cell a, .whatsapp-cell svg, .whatsapp-cell path');

    if (isContact) {
      // Dejar que el enlace navegue pero NO burbujee al handler de fila
      ev.stopPropagation();
      return;
    }
    if (isPlan) {
      // El handler específico de Plan se encarga
      return;
    }
    // Cualquier otro click en la fila no debe abrir modal grande
    if (ev.target && ev.target.closest('tr')) {
      ev.preventDefault();
      ev.stopPropagation();
    }
  });

 

  // Telegram: abrir app (oculta) y fallback en NUEVA pestaña
  tablaCuentas.addEventListener('click', function (ev) {
    const a = ev.target.closest('.tg-link');
    if (!a) return;
    ev.preventDefault();
    ev.stopPropagation();

    const digits = (a.getAttribute('data-phone') || '').replace(/\D+/g, '');
    if (!digits) return;

    const appUrl = 'tg://resolve?phone=+' + digits;
    const webUrl = 'https://t.me/+' + digits;

    try {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = appUrl;
      document.body.appendChild(iframe);
      setTimeout(() => { try { document.body.removeChild(iframe); } catch(_){} }, 1500);
    } catch (_) {}

    window.open(webUrl, '_blank', 'noopener');
  });
})();















// === Perfiles: permitir WA/TG sin abrir el modal de la fila ===
(function () {
  const tablaPerfiles = document.querySelector('#perfiles table');
  if (!tablaPerfiles) return;

  tablaPerfiles.addEventListener('click', function (ev) {
    // Si el click viene desde los íconos/enlaces de contacto, evitar burbujeo
    const isContact = ev.target.closest('.whatsapp-cell a, .whatsapp-cell svg, .whatsapp-cell path, .whatsapp-cell i');
    if (isContact) {
      ev.stopPropagation(); // no modal de padre
      // no hacemos preventDefault para que el enlace abra normalmente
    }
  });
})();

















// === Modal Agregar CUENTA: fecha_inicio = hoy y fecha_fin = +30 días (solo UI) ===
(function () {
  const modalAgregarCuenta = document.getElementById('modalAgregarCuenta');
  if (!modalAgregarCuenta) return;

  const pad2 = (n) => String(n).padStart(2, '0');
  const toYMD = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const addDays = (d, days) => {
    const x = new Date(d.getTime());
    x.setDate(x.getDate() + days);
    return x;
  };

  // Al abrir el modal: usar helper genérico con 30 días
  modalAgregarCuenta.addEventListener('show.bs.modal', function () {
    const form = modalAgregarCuenta.querySelector('form');
    if (window.setDefaultFechas && form) {
      setDefaultFechas(form, 30); // hoy y hoy+30
    }
  });

  // Si el usuario cambia fecha_inicio manualmente: recalcular fecha_fin = +30 (solo UI)
  modalAgregarCuenta.addEventListener('change', function (ev) {
    if (!ev.target || ev.target.name !== 'fecha_inicio') return;

    const fiVal = ev.target.value;
    const ff = modalAgregarCuenta.querySelector('input[name="fecha_fin"]');
    if (!ff || !fiVal) return;

    const base = new Date(fiVal);
    if (isNaN(base.getTime())) return;

    ff.value = toYMD(addDays(base, 30));
  });
})();















// === Modal Agregar CUENTA: setear fechas automáticamente ===
(function () {
  const modalAgregarCuenta = document.getElementById('modalAgregarCuenta');
  if (!modalAgregarCuenta) return;

  function pad2(n) { return String(n).padStart(2, '0'); }
  function toYMD(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
  function addDays(d, days) {
    const x = new Date(d.getTime());
    x.setDate(x.getDate() + days);
    return x;
  }

  
})();















// === Stock & Pausa: forzar EXACTAMENTE 4 columnas (NO afectar otras pestañas) ===
(function () {
  // Normaliza texto de TH
  function norm(txt) {
    return String(txt || '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  // Reconstruye header y filas dejando solo columnas en el orden deseado
  function enforceColumns(table) {
    // **Guardas fuertes**: solo aplica en stock/pausa
    const pane = table.closest('#stock, #pausa, #cuenta-pausa');
    if (!pane) return;
    if (table.dataset.columnsReduced === '1') return;

    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');
    if (!thead || !tbody) return;

    const desired = ['plan', 'correo', 'contraseña', 'acciones'];
    const aliases = {
      plan: ['plan'],
      correo: ['correo', 'correo electronico', 'email'],
      'contraseña': ['contrasena', 'contraseña', 'password', 'clave'],
      acciones: ['acciones', 'action']
    };

    const ths = Array.from(thead.querySelectorAll('tr:first-child th'));
    const currentMap = ths.map(th => norm(th.textContent));

    function findIndexFor(key) {
      const opts = aliases[key] || [key];
      for (const opt of opts) {
        const i = currentMap.indexOf(opt);
        if (i !== -1) return i;
      }
      return -1;
    }

    const idxPlan = findIndexFor('plan');
    const idxMail = findIndexFor('correo');
    const idxPass = findIndexFor('contraseña');
    const idxAct  = findIndexFor('acciones');

    // Si falta alguno → no tocar
    if ([idxPlan, idxMail, idxPass, idxAct].some(i => i < 0)) return;

    const keepIdx = [idxPlan, idxMail, idxPass, idxAct];

    // THEAD
    const trHead = thead.querySelector('tr');
    if (trHead) {
      const newHead = document.createDocumentFragment();
      keepIdx.forEach(i => { const th = ths[i]; if (th) newHead.appendChild(th); });
      trHead.innerHTML = '';
      trHead.appendChild(newHead);
    }

    // TBODY
    Array.from(tbody.querySelectorAll('tr')).forEach(tr => {
      const tds = Array.from(tr.children);
      const frag = document.createDocumentFragment();
      keepIdx.forEach(i => { if (tds[i]) frag.appendChild(tds[i]); });
      tr.innerHTML = '';
      tr.appendChild(frag);
    });

    table.dataset.columnsReduced = '1';
  }

  function processStockPausa() {
    const stockTable = document.querySelector('#stock table');
    const pausaTable = document.querySelector('#pausa table, #cuenta-pausa table');
    if (stockTable) enforceColumns(stockTable);
    if (pausaTable) enforceColumns(pausaTable);
  }

  // Ejecutar al cargar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', processStockPausa);
  } else {
    processStockPausa();
  }

  // Ejecutar SOLO cuando se muestran tabs de stock/pausa
  document.addEventListener('shown.bs.tab', function (ev) {
    const targetSel = ev.target && ev.target.getAttribute('data-bs-target');
    if (!targetSel) return;
    if (targetSel !== '#stock' && targetSel !== '#pausa' && targetSel !== '#cuenta-pausa') return;
    const table = document.querySelector(`${targetSel} table`);
    if (table) enforceColumns(table);
  });
})();



















// === Stock & Pausa: bloquear modal de fila y permitir modal chico en Plan ===
(function () {
  const modalEl  = document.getElementById('modalCambiarPlanStockPausa');
  const selectEl = document.getElementById('stockPausaPlanSelect');
  const idEl     = document.getElementById('stockPausaPlanId');
  const tablaEl  = document.getElementById('stockPausaTabla');
  const btnSave  = document.getElementById('btnGuardarPlanStockPausa');
  if (!modalEl || !selectEl || !idEl || !tablaEl || !btnSave) return;

  // 1) Interceptor global en CAPTURA: dentro de #stock / #pausa ninguna fila abre modal grande
  document.addEventListener('click', function (ev) {
    const container = ev.target.closest('#stock table, #pausa table, #cuenta-pausa table');
    if (!container) return;

    const isPlanCell = ev.target.closest('.plan-cell-stock, .plan-cell-pausa');
    const isAction   = ev.target.closest('.btn, [data-action], a.btn, button');

    if (isPlanCell) return;          // dejamos que lo maneje el handler de abajo
    if (isAction) { ev.stopPropagation(); return; } // botones/links permitidos sin burbujeo

    // cualquier otro click en la fila: bloquear modal padre
    ev.preventDefault();
    ev.stopImmediatePropagation();
  }, true); // CAPTURE = true

  // 2) Handler para abrir modal chico desde la celda Plan
  document.addEventListener('click', function (ev) {
    const td = ev.target.closest('.plan-cell-stock, .plan-cell-pausa');
    if (!td) return;

    ev.preventDefault();
    ev.stopPropagation();

    const id    = td.getAttribute('data-id');
    const plan  = String(td.getAttribute('data-plan') || 'premium').toLowerCase();
    const tabla =
      td.classList.contains('plan-cell-stock') ? 'stock' : 'pausa';

    idEl.value = id;
    tablaEl.value = tabla;
    selectEl.value = ['individual','standard','premium'].includes(plan) ? plan : 'premium';

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();

    const onSave = async function () {
      const newPlan = selectEl.value;
      try {
        const res = await fetch('ajax/stock_pausa_plan_update.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
          body: new URLSearchParams({ id, plan: newPlan, tabla })
        });
        const data = await res.json();
        if (data && data.ok) {
          td.textContent = newPlan;
          td.setAttribute('data-plan', newPlan);
          if (window.Swal) Swal.fire({ icon: 'success', title: 'Plan actualizado', timer: 1200, showConfirmButton: false });
          modal.hide();
        } else {
          if (window.Swal) Swal.fire({ icon: 'error', title: 'No se pudo guardar', text: (data && data.error) || 'Intenta de nuevo' });
        }
      } catch (_) {
        if (window.Swal) Swal.fire({ icon: 'error', title: 'Error de red', text: 'Verifica tu conexión' });
      } finally {
        btnSave.removeEventListener('click', onSave, { once: true });
      }
    };

    btnSave.addEventListener('click', onSave, { once: true });
  });
})();



































// === STOCK: abrir modales Agregar/Editar de forma robusta (sin data-bs-*) ===
(function () {
  function cleanupBackdrops() {
    // Quita backdrops y estado modal-open si quedaron colgados
    document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('padding-right');
  }
  function resolveModalByIds(ids) {
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el && el.classList.contains('modal') && el.querySelector('.modal-dialog')) {
        return el;
      }
    }
    return null;
  }
  function resolveModalFallback(paneSel) {
    // 1) Primer .modal válido dentro del pane
    const pane = document.querySelector(paneSel);
    if (pane) {
      const m = pane.querySelector('.modal');
      if (m && m.querySelector('.modal-dialog')) return m;
    }
    // 2) Cualquier .modal válido en el documento
    const any = document.querySelector('.modal');
    if (any && any.querySelector('.modal-dialog')) return any;
    return null;
  }
  function safeShowModal(modalEl) {
    if (!modalEl) return false;
    cleanupBackdrops();
    const inst = bootstrap.Modal.getOrCreateInstance(modalEl);
    inst.show();
    return true;
  }

  // --- AGREGAR STOCK ---
  document.addEventListener('click', function (ev) {
    const btn = ev.target.closest('#btn-add-stock');
    if (!btn) return;

    ev.preventDefault();
    ev.stopImmediatePropagation();

    let modalEl =
      resolveModalByIds(['modalAgregarStock','modalAddStock','modal-stock-add','modalAgregar']) ||
      resolveModalFallback('#stock');

    if (!modalEl) {
      console.warn('[AgregarStock] Modal no encontrado: verifica el ID (p.ej. #modalAgregarStock)');
      cleanupBackdrops();
      return;
    }

    // Limpia campos mínimos si existen
    const correo = modalEl.querySelector('#agregar_stock_correo, input[name="correo"]');
    const pass   = modalEl.querySelector('#agregar_stock_password, input[name="password_plain"]');
    if (correo) correo.value = '';
    if (pass)   pass.value = '';

    safeShowModal(modalEl);
  }, true); // CAPTURA

  // --- EDITAR STOCK ---
  document.addEventListener('click', function (ev) {
    const btn = ev.target.closest('.btn-edit-stock');
    if (!btn) return;

    ev.preventDefault();
    ev.stopImmediatePropagation();

    let modalEl =
      resolveModalByIds(['modalEditarStock','modalEditStock','modal-stock-edit','modalEditar']) ||
      resolveModalFallback('#stock');

    if (!modalEl) {
      console.warn('[EditarStock] Modal no encontrado: verifica el ID (p.ej. #modalEditarStock)');
      cleanupBackdrops();
      return;
    }

    // Prefill desde data-row (JSON embebido)
    let row = {};
    try { row = JSON.parse(btn.getAttribute('data-row') || '{}'); } catch (_) {}

    const idEl   = modalEl.querySelector('#editar_stock_id, input[name="id"]');
    const mailEl = modalEl.querySelector('#editar_stock_correo, input[name="correo"]');
    const passEl = modalEl.querySelector('#editar_stock_password, input[name="password_plain"]');

    if (idEl && row.id != null) idEl.value = row.id;
    if (mailEl) mailEl.value = row.correo || '';
    if (passEl) passEl.value = row.password_plain || '';

    safeShowModal(modalEl);
  }, true); // CAPTURA
})();














// === STOCK: abrir Agregar/Editar (IDs exactos) y limpiar backdrops huérfanos ===
(function () {
  function cleanupBackdrops() {
    document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('padding-right');
  }
  // Resolver streaming_id desde varias fuentes
  function resolveStreamingIdForStock() {
    let v = '';
    const tr = document.querySelector('#stock table tbody tr');
    if (tr) v = tr.getAttribute('data-streaming_id') || tr.getAttribute('data-streaming-id') || '';
    if (!v) {
      const pane = document.querySelector('#stock');
      if (pane) v = pane.getAttribute('data-streaming_id') || pane.getAttribute('data-streaming-id') || '';
    }
    if (!v) {
      const usp = new URLSearchParams(location.search);
      v = usp.get('streaming_id') || usp.get('streaming') || '';
    }
    return String(v || '').replace(/\D+/g, '');
  }

  // AGREGAR
  document.addEventListener('click', function (ev) {
    const btn = ev.target.closest('#btn-add-stock');
    if (!btn) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();

    const modalEl = document.getElementById('modalAgregarStock');
    if (!modalEl || !modalEl.querySelector('.modal-dialog')) { cleanupBackdrops(); return; }

    // limpiar campos mínimos
    const correo = modalEl.querySelector('#agregar_stock_correo, input[name="correo"]');
    const pass   = modalEl.querySelector('#agregar_stock_password, input[name="password_plain"]');
    if (correo) correo.value = '';
    if (pass)   pass.value = '';

    // setear streaming_id/streaming ocultos
    const sid = resolveStreamingIdForStock();
    const h1 = modalEl.querySelector('input[name="streaming_id"]');
    const h2 = modalEl.querySelector('input[name="streaming"]');
    if (h1) h1.value = sid;
    if (h2) h2.value = sid;

    cleanupBackdrops();
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }, true); // CAPTURA

  // EDITAR
  document.addEventListener('click', function (ev) {
    const btn = ev.target.closest('.btn-edit-stock');
    if (!btn) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();

    const modalEl = document.getElementById('modalEditarStock');
    if (!modalEl || !modalEl.querySelector('.modal-dialog')) { cleanupBackdrops(); return; }

    let row = {};
    try { row = JSON.parse(btn.getAttribute('data-row') || '{}'); } catch (_) {}

    const idEl   = modalEl.querySelector('#editar_stock_id, input[name="id"]');
    const mailEl = modalEl.querySelector('#editar_stock_correo, input[name="correo"]');
    const passEl = modalEl.querySelector('#editar_stock_password, input[name="password_plain"]');
    if (idEl && row.id != null) idEl.value = row.id;
    if (mailEl) mailEl.value = row.correo || '';
    if (passEl) passEl.value = row.password_plain || '';

    // setear streaming_id/streaming ocultos
    let sid = '';
    try { sid = String(row.streaming_id || row.streaming || ''); } catch(_) {}
    if (!sid) sid = resolveStreamingIdForStock();
    sid = sid.replace(/\D+/g, '');
    const h1e = modalEl.querySelector('input[name="streaming_id"]');
    const h2e = modalEl.querySelector('input[name="streaming"]');
    if (h1e) h1e.value = sid;
    if (h2e) h2e.value = sid;

    cleanupBackdrops();
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }, true); // CAPTURA
})();





















function __resolveStreamingIdForStock() {
  // 1) del primer <tr> del tab #stock
  const tr = document.querySelector('#stock table tbody tr');
  let v = tr ? (tr.getAttribute('data-streaming_id') || tr.getAttribute('data-streaming-id') || '') : '';

  // 2) atributo en el contenedor del tab (si existiera)
  if (!v) {
    const pane = document.querySelector('#stock');
    if (pane) v = pane.getAttribute('data-streaming_id') || pane.getAttribute('data-streaming-id') || '';
  }

  // 3) querystring ?streaming_id=...
  if (!v) {
    const usp = new URLSearchParams(location.search);
    v = usp.get('streaming_id') || usp.get('streaming') || '';
  }

  // 4) fuerza numérico
  v = String(v || '').replace(/\D+/g, '');
  return v || '';
}






















// === PAUSA: abrir Agregar/Editar (IDs exactos) y limpiar backdrops huérfanos ===
(function () {
  function cleanupBackdrops() {
    document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('padding-right');
  }
  function resolveStreamingIdForPausa(btn) {
    let v = (btn && btn.getAttribute('data-streaming_id')) || '';
    v = String(v || '').replace(/\D+/g, '');
    if (v) return v;

    const tr = document.querySelector('#pausa table tbody tr');
    if (tr) v = tr.getAttribute('data-streaming_id') || tr.getAttribute('data-streaming-id') || '';
    if (!v) {
      const pane = document.querySelector('#pausa');
      if (pane) v = pane.getAttribute('data-streaming_id') || pane.getAttribute('data-streaming-id') || '';
    }
    if (!v) {
      const usp = new URLSearchParams(location.search);
      v = usp.get('streaming_id') || usp.get('streaming') || usp.get('id_streaming') || '';
    }
    return String(v || '').replace(/\D+/g, '');
  }

  // AGREGAR PAUSA
  document.addEventListener('click', function (ev) {
    const btn = ev.target.closest('#btn-add-pausa');
    if (!btn) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();

    const modalEl = document.getElementById('modalAgregarPausa');
    if (!modalEl || !modalEl.querySelector('.modal-dialog')) { cleanupBackdrops(); return; }

    const correo = modalEl.querySelector('#agregar_pausa_correo, input[name="correo"]');
    const pass   = modalEl.querySelector('#agregar_pausa_password, input[name="password_plain"]');
    if (correo) correo.value = '';
    if (pass)   pass.value = '';

    const sid = resolveStreamingIdForPausa(btn);
    ['streaming_id','streaming','id_streaming'].forEach(name => {
      const h = modalEl.querySelector(`input[name="${name}"]`);
      if (h) h.value = sid;
    });

    cleanupBackdrops();
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }, true);

  // EDITAR PAUSA
  document.addEventListener('click', function (ev) {
    const btn = ev.target.closest('.btn-edit-pausa');
    if (!btn) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();

    const modalEl = document.getElementById('modalEditarPausa');
    if (!modalEl || !modalEl.querySelector('.modal-dialog')) { cleanupBackdrops(); return; }

    let row = {};
    try { row = JSON.parse(btn.getAttribute('data-row') || '{}'); } catch (_) {}
    const idEl   = modalEl.querySelector('#editar_pausa_id, input[name="id"]');
    const mailEl = modalEl.querySelector('#editar_pausa_correo, input[name="correo"]');
    const passEl = modalEl.querySelector('#editar_pausa_password, input[name="password_plain"]');
    if (idEl && row.id != null) idEl.value = row.id;
    if (mailEl) mailEl.value = row.correo || '';
    if (passEl) passEl.value = row.password_plain || '';

    let sid = String(row.streaming_id || row.streaming || row.id_streaming || '').replace(/\D+/g, '');
    if (!sid) sid = resolveStreamingIdForPausa(null);
    ['streaming_id','streaming','id_streaming'].forEach(name => {
      const h = modalEl.querySelector(`input[name="${name}"]`);
      if (h) h.value = sid;
    });

    cleanupBackdrops();
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }, true);
})();

























// === Patch: fix URL rota de IPTV + inyectar "enviar_a" en AJAX de Perfiles ===
(function () {
  if (window.__patch_perfiles_enviarA__) return; // idempotente
  window.__patch_perfiles_enviarA__ = true;

  function getEnviarA() {
    const modal =
      document.getElementById('modalCambiarPlanPerfil') ||
      document.getElementById('modalCambiarPlan') ||
      document.querySelector('.modal.show');
    if (!modal) return 'none';

    const sel =
      modal.querySelector('#perfilEnviarASelect') ||
      modal.querySelector('select[name="enviar_a"]');
    const val = sel ? String(sel.value || '').toLowerCase() : 'none';
    return (val === 'stock' || val === 'pausa') ? val : 'none';
  }

  const _fetch = window.fetch;
  window.fetch = function (input, init) {
    try {
      let url = (typeof input === 'string')
        ? input
        : (input && input.url)
        ? input.url
        : '';

      // 0) HOTFIX IPTV: si la URL contiene el placeholder PHP de SAVE_URL, la
      //    reemplazamos por el endpoint correcto ajax/iptv_save.php
      if (url && (
        url.indexOf('%3C?=') !== -1 ||                 // versión URL-encoded
        url.indexOf('htmlspecialchars($SAVE_URL') !== -1 || // texto plano
        url.indexOf('<?= $SAVE_URL') !== -1
      )) {
        const fixedUrl = 'ajax/iptv_save.php';

        if (typeof input === 'string') {
          input = fixedUrl;
        } else if (input && input.url) {
          // Clonamos la Request pero con nueva URL
          input = new Request(fixedUrl, input);
        }

        url = fixedUrl;
      }

      // 1) Patch original: añadir "enviar_a" sólo para perfiles_plan_update.php
      if (url && url.indexOf('perfiles_plan_update.php') !== -1) {
        const enviarA = getEnviarA(); // 'stock' | 'pausa' | 'none'
        const method = (init && init.method ? String(init.method) : 'GET').toUpperCase();

        if (method === 'POST') {
          if (init && init.body instanceof URLSearchParams) {
            const params = new URLSearchParams(init.body);
            params.set('enviar_a', enviarA);
            init.body = params;
          } else if (init && init.body instanceof FormData) {
            init.body.set('enviar_a', enviarA);
          } else if (init && typeof init.body === 'string') {
            const headers = init.headers || {};
            let ctype = '';

            if (headers.get && typeof headers.get === 'function') {
              ctype = headers.get('Content-Type') || headers.get('content-type') || '';
            } else if (typeof headers === 'object') {
              ctype = headers['Content-Type'] || headers['content-type'] || '';
            }

            if (ctype && ctype.indexOf('application/x-www-form-urlencoded') !== -1) {
              const sep = init.body && init.body.length ? '&' : '';
              init.body = init.body + sep + 'enviar_a=' + encodeURIComponent(enviarA);
            }
          } else if (init) {
            const params = new URLSearchParams();
            params.set('enviar_a', enviarA);
            init.body = params;

            init.headers = init.headers || {};
            if (init.headers.append) {
              init.headers.append('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
            } else {
              init.headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
            }
          }
        }
      }
    } catch (_) {
      // silencioso
    }

    return _fetch.apply(this, arguments);
  };
})();











































// === Patch puntual: neutralizar "error 200" con jQuery para perfiles_plan_update.php ===
(function () {
  if (window.__perfilesAjax200Patch__) return;
  window.__perfilesAjax200Patch__ = true;

  // 1) Monkey-patch de $.ajax SOLO para perfiles_plan_update.php
  if (window.jQuery && jQuery.ajax) {
    const _ajax = jQuery.ajax;
    jQuery.ajax = function (opt) {
      try {
        if (opt && typeof opt === 'object' && /perfiles_plan_update\.php/i.test(String(opt.url || ''))) {
          const origSuccess  = opt.success;
          const origError    = opt.error;
          const origComplete = opt.complete;

          opt.success = function (data, textStatus, jqXHR) {
            let d = data;
            if (typeof d === 'string') {
              try { d = JSON.parse(d); } catch (_) { d = null; }
            }
            if (d && d.ok) {
              if (origSuccess) return origSuccess(d, 'success', jqXHR);
              return;
            } else {
              const msg = (d && d.error) || 'No se pudo guardar';
              if (origError) return origError(jqXHR, 'error', msg);
            }
          };

          opt.error = function (jqXHR, textStatus, errorThrown) {
            // Si vino 200 pero algún handler lo trata como error, lo forzamos a success
            if (jqXHR && jqXHR.status === 200) {
              let d = null;
              try { d = JSON.parse(jqXHR.responseText || '{}'); } catch (_) {}
              if (d && d.ok) {
                if (opt.success) return opt.success(d, 'success', jqXHR);
                return;
              }
            }
            if (origError) return origError(jqXHR, textStatus, errorThrown);
          };

          opt.complete = function (jqXHR, textStatus) {
            if (origComplete) return origComplete(jqXHR, textStatus);
          };
        }
      } catch (_) { /* silencioso */ }
      return _ajax.apply(this, arguments);
    };
  }

  // 2) Bloquear ajaxError global SOLO para este endpoint cuando status=200
  if (window.jQuery) {
    jQuery(document)
      .off('ajaxError.__perfiles200')
      .on('ajaxError.__perfiles200', function (e, jqXHR, settings) {
        try {
          if (settings && /perfiles_plan_update\.php/i.test(String(settings.url || '')) && jqXHR && jqXHR.status === 200) {
            e.stopImmediatePropagation(); // corta SweetAlert global "HTTP 200"
          }
        } catch (_) {}
      });
  }
})();






























































// === Perfiles: registrar ID al hacer click en la celda Plan y prellenar modal ===
(function () {
  const MODAL_SEL = '#modalCambiarPlanPerfil, #modalCambiarPlan';

  // Guardar último ID clickeado en la celda Plan (perfiles)
  document.addEventListener('click', function (ev) {
    const td = ev.target.closest('#perfiles td.plan-cell-perfil, #perfiles [data-role="plan-cell-perfil"]');
    if (!td) return;
    const id = (td.getAttribute('data-id') || td.dataset.id || '').replace(/\D+/g, '');
    if (!id) return;
    window.__perfilLastId = id;

    const modal = document.querySelector(MODAL_SEL);
    if (modal) {
      const idEl = modal.querySelector('#perfilPlanId, #perfilesPlanId, input[name="perfil_id"], input[name="id"]');
      if (idEl) idEl.value = id;
    }
  }, true);

  // Cuando se muestre el modal, si falta el ID, usa el último capturado
  document.addEventListener('shown.bs.modal', function (ev) {
    const modal = ev.target && ev.target.matches(MODAL_SEL) ? ev.target : null;
    if (!modal) return;
    const idEl = modal.querySelector('#perfilPlanId, #perfilesPlanId, input[name="perfil_id"], input[name="id"]');
    if (idEl && (!idEl.value || !/^\d+$/.test(idEl.value))) {
      if (window.__perfilLastId) idEl.value = window.__perfilLastId;
    }
  }, true);
})();



























// === Perfiles: rellenar ID al abrir el modal chico ===
(function () {
  document.addEventListener('click', function (ev) {
    const td = ev.target.closest('td'); 
    if (!td) return;

    // solo si es la celda de plan
    if (td.cellIndex === 0 && td.textContent.trim() !== '') {
      const tr = td.closest('tr');
      const id = tr ? tr.getAttribute('data-id') || tr.dataset.id : null;
      if (!id) return;

      // guardar último ID global
      window.__perfilLastId = id;

      // rellenar hidden en modal
      const modal = document.getElementById('modalPlanPerfil');
      if (modal) {
        const id1 = modal.querySelector('#planPerfilId');
        const id2 = modal.querySelector('#planPerfilId2');
        if (id1) id1.value = id;
        if (id2) id2.value = id;
      }
    }
  }, true);

  // fallback: al mostrar el modal, si falta id lo completa
  document.addEventListener('shown.bs.modal', function (ev) {
    if (ev.target.id !== 'modalPlanPerfil') return;
    const modal = ev.target;
    const id = window.__perfilLastId || '';
    if (!id) return;
    const id1 = modal.querySelector('#planPerfilId');
    const id2 = modal.querySelector('#planPerfilId2');
    if (id1 && !id1.value) id1.value = id;
    if (id2 && !id2.value) id2.value = id;
  });
})();






























// === Guardar plan perfil con fetch ===
(function () {
  const modal = document.getElementById('modalPlanPerfil');
  if (!modal) return;

  const btn = modal.querySelector('#btnGuardarPlan');
  const form = modal.querySelector('#formPlanPerfil');
  if (!btn || !form) return;

  btn.addEventListener('click', async function (ev) {
    ev.preventDefault();

    const fd = new FormData(form);
const id = fd.get('id');
const plan = fd.get('plan');
const enviar_a = fd.get('enviar_a') || form.querySelector('#enviarASelect')?.value || 'none';
const color = (fd.get('color') || '').toString(); // <- NUEVO

    if (!id) {
      Swal.fire('Error', 'ID de perfil faltante', 'error');
      return;
    }

    try {
  const params = new URLSearchParams({ id, plan, enviar_a });
  if (color !== '') params.set('color', color);   // <- SOLO si elige un color o "restablecer"
  const res = await fetch('ajax/perfiles_plan_update.php', {
    method: 'POST',
    body: params
  });
      const data = await res.json();
      if (data.ok) {
          const tr = document.querySelector(`tr.js-parent-row[data-entidad="perfil"][data-id="${id}"]`);
if (tr) {
  tr.classList.remove('row-color-rojo','row-color-azul','row-color-verde','row-color-blanco');
  tr.removeAttribute('data-color');
  if (color && color !== 'restablecer') {
    tr.classList.add('row-color-' + color);
    tr.setAttribute('data-color', color);
  }
}

        Swal.fire({ icon:'success', title:'Plan actualizado', timer:1200, showConfirmButton:false });
        bootstrap.Modal.getOrCreateInstance(modal).hide();
      } else {
        Swal.fire('Error', data.error || 'No se pudo guardar', 'error');
      }
    } catch (e) {
      Swal.fire('Error', 'Fallo de conexión', 'error');
    }
  });
})();





























// /public/assets/js/app.js














// === Perfiles: guardar plan del modal chico con fetch (envía también "enviar_a") ===
(function () {
  const modal = document.getElementById('modalCambiarPlanPerfil');
  if (!modal) return;

  const form = modal.querySelector('#formCambiarPlanPerfil');
  const btn  = modal.querySelector('#btnGuardarPlanPerfil');
  if (!form || !btn) return;

  // Alinear selección usando el valor guardado al abrir (por si reabre sin click)
  const selInit = modal.querySelector('#perfilPlanSelect');
  const currentPlanInit = (modal.dataset.currentPlan || '').toLowerCase();
  if (selInit && currentPlanInit) {
    Array.from(selInit.options).forEach(opt => {
      opt.selected = (opt.value.toLowerCase() === currentPlanInit);
    });
    selInit.style.removeProperty('display');
  }

  // Anula handlers antiguos del botón
  const btnClone = btn.cloneNode(true);
  btn.parentNode.replaceChild(btnClone, btn);

  async function submitPerfil(ev) {
  ev.preventDefault();
  ev.stopImmediatePropagation();

  // Selectores tolerantes (por si cambia el name/id en el hidden)
  const idEl = modal.querySelector('#perfilPlanId, #perfilesPlanId, input[name="perfil_id"], input[name="id"]');
  const id   = ((idEl?.value || window.__perfilLastId || '') + '').replace(/\D+/g, '');
  const plan = modal.querySelector('#perfilPlanSelect, select[name="plan"]')?.value || '';
  const enviar_a = modal.querySelector('#perfilEnviarASelect, select[name="enviar_a"]')?.value || 'none';
  const color = (modal.querySelector('select[name="color"]')?.value || '').trim(); // <-- NUEVO

  if (!id || !plan) return;

  try {
    const params = new URLSearchParams({ id, plan, enviar_a });
    // Solo enviamos color si el usuario eligió algo (incluye "restablecer")
    if (color !== '') params.set('color', color);

    const res = await fetch('ajax/perfiles_plan_update.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: params
    });

    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch (_) {
      const i = text.indexOf('{'), j = text.lastIndexOf('}');
      if (i !== -1 && j !== -1 && j > i) { try { data = JSON.parse(text.slice(i, j + 1)); } catch(_){} }
    }

    if (data && data.ok) {
      const destino = (enviar_a || 'none').trim().toLowerCase();

      // 1) Actualiza la celda de plan en la UI (si aplica)
      const tdPlan = document.querySelector(`td.plan-cell-perfil[data-id="${id}"]`);
      if (tdPlan && plan) { tdPlan.textContent = plan; tdPlan.setAttribute('data-plan', plan); }

      // 2) Color en UI (opcional, sin recargar)
      const tr = tdPlan ? tdPlan.closest('tr') : null;
      if (tr && color !== '') {
        tr.classList.remove('row-color-rojo','row-color-azul','row-color-verde','row-color-blanco');
        tr.removeAttribute('data-color');
        if (color !== 'restablecer') {
          tr.classList.add('row-color-' + color);
          tr.setAttribute('data-color', color);
        }
      }

      if (window.Swal) Swal.fire({ icon:'success', title:'Plan actualizado', timer:1200, showConfirmButton:false });
      bootstrap.Modal.getOrCreateInstance(modal).hide();
      return;
    }

    const msg = (data && data.error) ? data.error : 'No se pudo guardar (respuesta no válida)';
    if (window.Swal) Swal.fire({ icon:'error', title:'No se pudo guardar', text: msg });
  } catch (e) {
    if (window.Swal) Swal.fire({ icon:'error', title:'Error de red', text:'Verifica tu conexión' });
  }
}


  form.addEventListener('submit', submitPerfil, true);
  btnClone.addEventListener('click', submitPerfil, true);
})();























// === Perfiles: asegurar que el select de plan esté visible y sin "hidden" duplicados ===
(function () {
  let observer = null;

  function sanitizePlanSelect(modal) {
    if (!modal || modal.id !== 'modalCambiarPlanPerfil') return;

    // 1) Eliminar cualquier input hidden name="plan" inyectado por scripts/plug-ins
    modal.querySelectorAll('input[type="hidden"][name="plan"]').forEach(el => el.remove());

    // 2) Forzar visibilidad del select real
    const sel = modal.querySelector('#perfilPlanSelect');
    if (sel) {
      sel.style.removeProperty('display');
      sel.style.removeProperty('visibility');
      sel.classList.remove('d-none', 'visually-hidden');
      sel.removeAttribute('hidden');
      sel.disabled = false;
    }
  }

  // Cuando se muestra el modal, limpiamos y vigilamos cambios
  document.addEventListener('shown.bs.modal', function (ev) {
    const modal = ev.target;
    if (!modal || modal.id !== 'modalCambiarPlanPerfil') return;

    sanitizePlanSelect(modal);

    // Observa intentos posteriores de volver a ocultar o inyectar "plan" hidden
    if (observer) { try { observer.disconnect(); } catch(_) {} }
    observer = new MutationObserver(function (muts) {
      for (const m of muts) {
        if (m.type === 'childList') {
          // si agregan un hidden name="plan", lo quitamos
          m.addedNodes && m.addedNodes.forEach(node => {
            if (node.nodeType === 1) {
              if (node.matches && node.matches('input[type="hidden"][name="plan"]')) {
                node.remove();
              }
              node.querySelectorAll && node.querySelectorAll('input[type="hidden"][name="plan"]').forEach(el => el.remove());
            }
          });
        } else if (m.type === 'attributes') {
          // si vuelven a ocultar el select, lo restauramos
          if (m.target && m.target.id === 'perfilPlanSelect') {
            const sel = m.target;
            if (getComputedStyle(sel).display === 'none' || sel.hasAttribute('hidden')) {
              sel.style.removeProperty('display');
              sel.removeAttribute('hidden');
            }
          }
        }
      }
    });

    observer.observe(modal, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'hidden', 'class']
    });
  }, true);

  // Al ocultar el modal, desconectamos el observer
  document.addEventListener('hidden.bs.modal', function (ev) {
    if (ev.target && ev.target.id === 'modalCambiarPlanPerfil' && observer) {
      try { observer.disconnect(); } catch(_) {}
      observer = null;
    }
  }, true);
})();































// === Util: repaginar tabla (agrupa por data-correo y respeta data-page-size) ===
(function () {
  function rebuildPagerForTable(table) {
    if (!table) return;
    const pagerNav = table.parentElement.querySelector('.table-pager');
    const ul = pagerNav ? pagerNav.querySelector('ul.pagination') : null;

    // Page size
    const sizeAttr = table.getAttribute('data-page-size') || table.dataset.pageSize || '9999';
    const pageSize = Math.max(1, parseInt(sizeAttr, 10) || 9999);

    // Agrupar por correo (padre + hijas contiguas)
    const rows = Array.from(table.tBodies[0]?.rows || []);
    if (!rows.length) {
      if (pagerNav) { pagerNav.style.display = 'none'; if (ul) ul.innerHTML = ''; }
      return;
    }
    const groups = [];
    let i = 0;
    while (i < rows.length) {
      const start = i;
      const correo = rows[i].getAttribute('data-correo') || '';
      i++;
      while (i < rows.length) {
        const c = rows[i].getAttribute('data-correo') || '';
        if (c !== correo) break;
        i++;
      }
      groups.push(rows.slice(start, i));
    }

    // Paginación por grupos
    const pages = [];
    let cur = [];
    groups.forEach(g => {
      if (cur.length + g.length > pageSize && cur.length > 0) {
        pages.push(cur); cur = [];
      }
      cur = cur.concat(g);
    });
    if (cur.length) pages.push(cur);

    // Página activa actual
    let activeIndex = 0;
    const currentShown = rows.findIndex(r => r.style.display !== 'none');
    if (currentShown >= 0) {
      // detectar la página actual
      let count = 0;
      for (let p = 0; p < pages.length; p++) {
        count += pages[p].length;
        if (currentShown < count) { activeIndex = p; break; }
      }
    }

    // Mostrar página activa
    rows.forEach(r => r.style.display = 'none');
    (pages[activeIndex] || []).forEach(r => r.style.display = '');

    // Construir/actualizar nav
    if (!pagerNav || !ul) return;
    ul.innerHTML = '';
    pages.forEach((_, idx) => {
      const li = document.createElement('li');
      li.className = 'page-item' + (idx === activeIndex ? ' active' : '');
      const a = document.createElement('button');
      a.type = 'button';
      a.className = 'page-link';
      a.textContent = (idx + 1).toString();
      a.addEventListener('click', () => {
        rows.forEach(r => r.style.display = 'none');
        pages[idx].forEach(r => r.style.display = '');
        ul.querySelectorAll('.page-item').forEach(li2 => li2.classList.remove('active'));
        li.classList.add('active');
      });
      li.appendChild(a);
      ul.appendChild(li);
    });
    pagerNav.style.display = pages.length > 1 ? '' : 'none';
  }

  // Exponer función global segura
  window.__refreshTablePager = function (tabSelector) {
    try {
      const table = document.querySelector(`${tabSelector} table`);
      if (table) rebuildPagerForTable(table);
    } catch (_) {}
  };
})();
















// === CUENTA COMPLETA: abrir modal chico al clickear celda Plan ===
(function () {
  document.addEventListener('click', function (ev) {
    const td = ev.target.closest('td.plan-cell-cuenta');
    if (!td) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();

    const tr  = td.closest('tr');
    const id  = (td.getAttribute('data-id') || tr?.getAttribute('data-id') || '').replace(/\D+/g, '');
    const plan = (td.getAttribute('data-plan') || tr?.getAttribute('data-plan') || td.textContent || '').trim().toLowerCase();
    if (!id) return;

    const modal = document.getElementById('modalCambiarPlanCuenta');
    if (!modal) return;

    const idEl = modal.querySelector('#cuentaPlanId');
    if (idEl) idEl.value = id;

    // Marcar plan actual en select
    const sel = modal.querySelector('#cuentaPlanSelect');
    if (sel) {
      Array.from(sel.options).forEach(opt => { opt.selected = (opt.value.toLowerCase() === plan); });
      sel.style.removeProperty('display');
    }

    bootstrap.Modal.getOrCreateInstance(modal).show();
  }, true);
})();

// === CUENTA COMPLETA: guardar, mover (opcional) y RECARGAR manteniendo pestaña ===
(function () {
  const modal = document.getElementById('modalCambiarPlanCuenta');
  if (!modal) return;

  const form = modal.querySelector('#formCambiarPlanCuenta');
  const btn  = modal.querySelector('#btnGuardarPlanCuenta');
  if (!form || !btn) return;

  const btnClone = btn.cloneNode(true);
  btn.parentNode.replaceChild(btnClone, btn);

  async function submitCuenta(ev) {
    ev.preventDefault();
    ev.stopImmediatePropagation();

    const id   = (modal.querySelector('#cuentaPlanId')?.value || '').replace(/\D+/g,'');
    const plan = modal.querySelector('#cuentaPlanSelect')?.value || '';
    const enviar_a = (modal.querySelector('#cuentaEnviarASelect')?.value || 'none').toLowerCase();
    if (!id || !plan) return;

    try {
      const res = await fetch('ajax/cuenta_plan_update.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: new URLSearchParams({ id, plan, enviar_a })
      });
      const data = await res.json();

      if (data && data.ok) {
        // Guardar pestaña activa y recargar
        const activeTab = document.querySelector('.nav-tabs .nav-link.active');
        const activeTarget = activeTab ? activeTab.getAttribute('data-bs-target') : '';
        if (activeTarget) { sessionStorage.setItem('activeTab', activeTarget); }

        Swal.fire({ icon:'success', title:'Plan actualizado', timer:1200, showConfirmButton:false })
          .then(() => { window.location.reload(); });
      } else {
        Swal.fire({ icon:'error', title:'No se pudo guardar', text:(data && data.error) || 'Intenta de nuevo' });
      }
    } catch (e) {
      Swal.fire({ icon:'error', title:'Error de red', text:'Verifica tu conexión' });
    }
  }

  form.addEventListener('submit', submitCuenta, true);
  btnClone.addEventListener('click', submitCuenta, true);
})();












(function () {
  const target = sessionStorage.getItem('activeTab');
  if (!target) return;
  const tabBtn = document.querySelector(`.nav-tabs .nav-link[data-bs-target="${target}"]`);
  if (tabBtn && window.bootstrap && bootstrap.Tab) { new bootstrap.Tab(tabBtn).show(); }
  sessionStorage.removeItem('activeTab');
})();





















// === Cuenta completa: asegurar select visible y sin "hidden" duplicados ===
(function () {
  function sanitizeCuentaPlanSelect(modal) {
    if (!modal || modal.id !== 'modalCambiarPlanCuenta') return;

    // 1) eliminar cualquier hidden name="plan" inyectado
    modal.querySelectorAll('input[type="hidden"][name="plan"]').forEach(el => el.remove());

    // 2) forzar visibilidad del select real
    const sel = modal.querySelector('#cuentaPlanSelect');
    if (sel) {
      sel.style.removeProperty('display');
      sel.style.removeProperty('visibility');
      sel.classList.remove('d-none', 'visually-hidden');
      sel.removeAttribute('hidden');
      sel.disabled = false;
    }
  }

  // al mostrar el modal, saneamos y marcamos el plan actual
  document.addEventListener('shown.bs.modal', function (ev) {
    const modal = ev.target;
    if (!modal || modal.id !== 'modalCambiarPlanCuenta') return;

    sanitizeCuentaPlanSelect(modal);

    // marcar plan actual desde la celda/row
    const id = (modal.querySelector('#cuentaPlanId')?.value || '').replace(/\D+/g,'');
    const td = document.querySelector(`td.plan-cell-cuenta[data-id="${id}"]`);
    const tr = td ? td.closest('tr') : document.querySelector(`#cuenta table tbody tr[data-id="${id}"]`);
    const currentPlan = (td?.getAttribute('data-plan') || tr?.getAttribute('data-plan') || td?.textContent || '').trim().toLowerCase();

    const sel = modal.querySelector('#cuentaPlanSelect');
    if (sel && currentPlan) {
      Array.from(sel.options).forEach(opt => { opt.selected = (opt.value.toLowerCase() === currentPlan); });
    }
  }, true);
})();
































// === Normalizar teléfono (E.164 básico) al enviar formularios de Perfil/Cuenta ===
(function () {
  function normPhone(v) {
    v = String(v || '').trim();
    // permitir '+' solo al inicio, remover espacios, guiones, paréntesis y otros
    v = v.replace(/[\s\-\(\)\.]/g, '');
    v = v.replace(/^00/, '+'); // 00 -> +
    // quitar '+' intermedios; mantener solo si está al inicio
    v = v.replace(/(?!^)\+/g, '');
    // si quedó solo '+', vaciar
    if (v === '+') v = '';
    return v;
  }

  document.addEventListener('submit', function (e) {
  const form = e.target;

  // 🔒 1) Asegurarnos de que realmente es un <form>
  if (!form || !form.tagName || form.tagName.toLowerCase() !== 'form') {
    return;
  }

  // 🔒 2) Normalizar id y action como strings seguros
  const rawId     = typeof form.id === 'string' ? form.id : '';
  const rawAction = (typeof form.getAttribute === 'function'
                      ? (form.getAttribute('action') || '')
                      : '');

  const formId     = rawId.toLowerCase();
  const formAction = rawAction.toLowerCase();

  // 🔒 3) Solo actuar en formularios de PERFIL o CUENTA
  const isPerfil = formId.includes('perfil') || formAction.includes('perfilcontroller.php');
  const isCuenta = formId.includes('cuenta') || formAction.includes('cuentacontroller.php');

  if (!isPerfil && !isCuenta) {
    // 👈 Si no es ninguno de esos, salimos y no tocamos nada (ni IPTV, ni streamings)
    return;
  }

  // 🔽🔽🔽 A partir de aquí va el código que ya tenías para perfíl/cuenta
  // e.preventDefault();
  // ...
});

})();


















// === Formateo en vivo de WhatsApp (LatAm): +CC 000 000 000 ===
(function () {
  function extractCCFromPlaceholder(el) {
    const ph = (el.getAttribute('placeholder') || '').trim();
    const m = ph.match(/^\+(\d{1,3})/);
    return m ? ('+' + m[1]) : '';
  }

  // Heurística LatAm para longitud del CC cuando NO hay placeholder:
  //  - 1 si comienza con '1' (NANP)
  //  - 3 si comienza con '50' o '59' (50x: CR(506), PA(507)... | 59x: BO(591), EC(593), UY(598), etc.)
  //  - en otro caso, 2 (MX 52, AR 54, BR 55, CL 56, CO 57, VE 58, PE 51, CU 53)
  function inferCCLen(digits) {
    if (!digits) return 2;
    if (digits.startsWith('1')) return 1;
    if (digits.startsWith('50') || digits.startsWith('59')) return 3;
    return 2;
  }

  function formatIntlSpacing(raw, defaultCC) {
    if (!raw) return '';
    let v = String(raw).trim();

    // normalización básica
    v = v.replace(/\u00A0/g, ' '); // NBSP -> space
    v = v.replace(/\s+/g, '');     // quitar espacios
    v = v.replace(/^00/, '+');     // 00 -> +
    v = v.replace(/(?!^)\+/g, ''); // '+' solo al inicio
    v = v.replace(/[^\d\+]/g, ''); // solo dígitos y '+' inicial

    if (v === '+') return '+';

    // Si comienza con '+', separar CC y resto
    if (v[0] === '+') {
      const digits = v.slice(1); // todo después de '+'
      if (!digits) return v;

      let cc = '';
      let rest = '';

      // 1) Si hay CC por placeholder y coincide el prefijo, úsalo (evita "comerse" el primer dígito de la línea)
      if (defaultCC && /^\+\d{1,3}$/.test(defaultCC) && v.startsWith(defaultCC)) {
        cc = defaultCC.slice(1);
        rest = digits.slice(cc.length);
      } else {
        // 2) Sin placeholder: inferir longitud CC por heurística LatAm
        const ccLen = inferCCLen(digits);
        cc = digits.slice(0, Math.min(ccLen, digits.length));
        rest = digits.slice(cc.length);
      }

      // Agrupar resto en bloques de 3
      const parts = [];
      while (rest.length > 0) {
        parts.push(rest.slice(0, 3));
        rest = rest.slice(3);
      }
      return '+' + cc + (parts.length ? ' ' + parts.join(' ') : '');
    }

    // Sin '+': si hay CC por placeholder, anteponerlo y agrupar
    const def = (defaultCC && /^\+\d{1,3}$/.test(defaultCC)) ? defaultCC : '';
    const digits = v.replace(/\D/g, '');
    if (def) {
      let rest = digits;
      const parts = [];
      while (rest.length > 0) {
        parts.push(rest.slice(0, 3));
        rest = rest.slice(3);
      }
      return def + (parts.length ? ' ' + parts.join(' ') : '');
    }

    // Sin CC y sin placeholder: solo agrupa en 3s
    let rest = digits;
    const parts = [];
    while (rest.length > 0) {
      parts.push(rest.slice(0, 3));
      rest = rest.slice(3);
    }
    return parts.join(' ');
  }

  function handleFormat(e) {
    const el = e.target;
    if (!el || el.tagName !== 'INPUT') return;
    if (el.name !== 'whatsapp') return;

    const cc = extractCCFromPlaceholder(el); // ej. "+51"
    const before = el.value;
    const after = formatIntlSpacing(before, cc);

    if (after !== before) {
      const pos = el.selectionEnd;
      el.value = after;
      try { el.setSelectionRange(after.length, after.length); } catch (_) {}
    }
  }

  // Formatear mientras escribe y al salir del input
  document.addEventListener('input', handleFormat, true);
  document.addEventListener('blur', handleFormat, true);

  // Al abrir cualquier modal, formatea el valor inicial si ya existe
  document.addEventListener('shown.bs.modal', function (ev) {
    const modal = ev.target;
    if (!modal) return;
    modal.querySelectorAll('input[name="whatsapp"]').forEach(function (el) {
      const cc = extractCCFromPlaceholder(el);
      el.value = formatIntlSpacing(el.value, cc);
    });
  }, true);
})();














// === Abrir Telegram con tg:// y fallback si no hay app instalada ===
(function () {
  document.addEventListener('click', function (ev) {
    const a = ev.target.closest('a.tg-link');
    if (!a) return;

    ev.preventDefault();
    ev.stopPropagation();

    const href = a.getAttribute('href') || '';
    if (!href) return;

    // Intento abrir la app (tg://)
    const start = Date.now();
    window.location.href = href;

    // Fallback si el navegador no tiene handler (no abre la app)
    setTimeout(function () {
      // Si en ~1.2s seguimos en la misma pestaña, mostramos ayuda
      if (Date.now() - start < 1500) {
        const plain = href.replace(/^tg:\/\/resolve\?phone=/i, '');
        const msg = 'Si no se abrió Telegram, verifica que la app esté instalada y que el navegador permita abrir enlaces tg://.\n\nNúmero: ' + plain;
        if (window.Swal) {
          Swal.fire({ icon: 'info', title: 'Abrir Telegram', text: msg, confirmButtonText: 'Entendido' });
        } else {
          alert(msg);
        }
      }
    }, 1200);
  }, true);
})();


























// === Telegram: abrir chat por número con fallback a Web ===
(function () {
  document.addEventListener('click', function (ev) {
    const a = ev.target.closest('a.tg-link');
    if (!a) return;

    ev.preventDefault();
    ev.stopPropagation();

    let num = a.getAttribute('data-phone') || '';
    if (!num) return;

    // Asegurar prefijo '+'
    if (num[0] !== '+') num = '+' + num;

    const appUrl = 'tg://resolve?phone=' + encodeURIComponent(num);
    const webUrl = 'https://web.telegram.org/k/#?tgaddr=' + encodeURIComponent(num);

    // Intentar abrir app nativa
    const t0 = Date.now();
    // Truco: usar location para app; y si no hay handler, fallback a Web
    window.location.href = appUrl;

    // Fallback suave a Telegram Web si no hay app que maneje tg://
    setTimeout(function () {
      // Si seguimos en la misma vista (no se conmutó a app) en ~900ms, abrimos web
      if (Date.now() - t0 < 1200) {
        window.open(webUrl, '_blank', 'noopener');
      }
    }, 900);
  }, true);
})();














// === Buscador global por WhatsApp/número o correo (robusto) ===
(function () {
  const input = document.getElementById('search-whatsapp');
  if (!input) return;

  const onlyDigits = s => String(s || '').replace(/\D+/g, '');

  function extractWaDigits(tr) {
    // <a class="wa-link" href="https://wa.me/51977498954?text=...">
    const a = tr.querySelector('td.whatsapp a.wa-link');
    if (a && a.href) {
      // soporta wa.me y api.whatsapp.com
      // 1) wa.me/<num>
      let m = a.href.match(/wa\.me\/(\d+)/i);
      if (m && m[1]) return m[1];
      // 2) api.whatsapp.com/send?phone=<num>
      m = a.href.match(/[?&]phone=(\d+)/i);
      if (m && m[1]) return m[1];
    }
    // fallback: data-whatsapp en la fila
    const d = tr.getAttribute('data-whatsapp');
    if (d) return onlyDigits(d);
    // último recurso: dígitos en la celda whatsapp (si hubiera)
    const cell = tr.querySelector('td.whatsapp');
    if (cell) return onlyDigits(cell.textContent);
    return '';
  }

  function extractTgDigits(tr) {
    const a = tr.querySelector('td.whatsapp a.tg-link');
    if (!a) return '';
    // Preferir data-phone
    const dphone = a.getAttribute('data-phone');
    if (dphone) return onlyDigits(dphone);
    // href puede ser:
    // tg://resolve?phone=+NUM | https://t.me/NUM | https://web.telegram.org/k/#?tgaddr=+NUM
    const href = a.getAttribute('href') || '';
    let m = href.match(/phone=([\+\d]+)/i);
    if (m && m[1]) return onlyDigits(m[1]);
    m = href.match(/t\.me\/\+?(\d+)/i);
    if (m && m[1]) return onlyDigits(m[1]);
    m = href.match(/tgaddr=([\+\d]+)/i);
    if (m && m[1]) return onlyDigits(m[1]);
    return '';
  }

  function extractCorreoText(tr) {
    // intenta celdas con '@'
    const tdWithAt = Array.from(tr.querySelectorAll('td')).find(td => td.textContent.includes('@'));
    if (tdWithAt) return tdWithAt.textContent.trim().toLowerCase();
    // fallback: atributo data-correo
    const dc = tr.getAttribute('data-correo');
    return (dc || '').trim().toLowerCase();
  }

  input.addEventListener('input', function () {
    const raw = input.value.trim();
    const term = raw.toLowerCase();
    const termDigits = onlyDigits(raw);
    const isNumeric = termDigits.length >= 3; // con 3+ dígitos consideramos búsqueda numérica

    const rows = document.querySelectorAll(
      '#perfiles table tbody tr, #cuentas table tbody tr, #stock table tbody tr, #pausa table tbody tr'
    );

    rows.forEach(tr => {
      if (term === '') { tr.style.display = ''; return; }

      if (isNumeric) {
        const wa = extractWaDigits(tr);
        const tg = extractTgDigits(tr);
        const match = (wa && wa.includes(termDigits)) || (tg && tg.includes(termDigits));
        tr.style.display = match ? '' : 'none';
      } else {
        const correo = extractCorreoText(tr);
        const match = correo.includes(term);
        tr.style.display = match ? '' : 'none';
      }
    });
  });
})();




















































// === COBROS: click en celda para marcar día (guarda vía AJAX) ===
(function () {
  document.addEventListener('click', async function (ev) {
    const td = ev.target.closest('td.cobro-cell');
    if (!td) return;

    ev.preventDefault();
    ev.stopImmediatePropagation();

    const cliente  = td.getAttribute('data-cliente')  || '';
    const servicio = td.getAttribute('data-servicio') || '';
    const mes      = td.getAttribute('data-mes')      || '';
    if (!cliente || !servicio || !mes) return;

    const hoy = new Date();
    const diaHoy = hoy.getDate();

    // Si ya tiene valor, al hacer click lo limpia; si está vacío, lo pone a hoy
    const nuevoDia = (td.textContent.trim() === '') ? diaHoy : '';

    try {
      const res = await fetch('ajax/cobros_save.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: new URLSearchParams({ cliente, servicio, mes, dia: nuevoDia })
      });
      const data = await res.json();
      if (data && data.ok) {
        td.textContent = nuevoDia;
        if (window.Swal) Swal.fire({icon:'success', title:'Guardado', timer:800, showConfirmButton:false});
      } else {
        const msg = (data && data.error) ? data.error : 'No se pudo guardar';
        if (window.Swal) Swal.fire({icon:'error', title:'Error', text:msg});
      }
    } catch (e) {
      if (window.Swal) Swal.fire({icon:'error', title:'Error de red', text:'Intenta de nuevo'});
    }
  }, true);

  // Cambiar mes refresca la página con ?mes=YYYY-MM
  const sel = document.getElementById('cobrosMes');
  if (sel) {
    sel.addEventListener('change', function () {
      const v = sel.value || '';
      const url = new URL(window.location.href);
      if (v) url.searchParams.set('mes', v); else url.searchParams.delete('mes');
      window.location.href = url.toString();
    }, { once:false });
  }
})();

























// (opcional) app.js — asegura que el click de la fila no intercepte enlaces/botones
document.addEventListener('click', function(e){
  const row = e.target.closest('.js-parent-row');
  if (!row) return;
  if (e.target.closest('a, button, [data-no-row-modal="1"], .js-row-action')) return;
  // ... abrir modal de la fila ...
});













/* === Cuenta completa: confirmación de borrado con SweetAlert === */
(function () {
  'use strict';
  if (window.__deleteCuentaBound) return;
  window.__deleteCuentaBound = true;

  // Evita que el click del botón dispare el modal de la fila
  document.addEventListener('click', function (ev) {
    const btn = ev.target.closest('.form-delete-cuenta [type="submit"], .form-delete-cuenta .js-row-action');
    if (!btn) return;
    // Señal para otros handlers de "row click"
    btn.setAttribute('data-no-row-modal', '1');
    ev.stopPropagation();
  }, true); // capture

  // Intercepta el submit para mostrar SweetAlert
  document.addEventListener('submit', function (ev) {
    const form = ev.target.closest('.form-delete-cuenta');
    if (!form) return;

    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();

    // Anti doble submit
    if (form.dataset.submitting === '1') return;

    const proceder = () => {
      form.dataset.submitting = '1';
      const btn = form.querySelector('button[type="submit"], .js-row-action');
      if (btn) {
        btn.disabled = true;
        if (!btn.dataset.originalText) btn.dataset.originalText = btn.innerHTML;
        btn.innerHTML = 'Borrando…';
      }
      // Usamos submit nativo para no tocar el backend ni forzar AJAX
      form.submit(); // <- no dispara de nuevo el event 'submit'
    };

    if (window.Swal) {
      Swal.fire({
        title: '¿Eliminar cuenta completa?',
        text: 'Esta acción no se puede deshacer.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, borrar',
        cancelButtonText: 'Cancelar',
        reverseButtons: true,
        focusCancel: true
      }).then((r) => {
        if (r.isConfirmed) proceder();
      });
    } else {
      // Fallback sin SweetAlert
      if (confirm('¿Eliminar cuenta completa? Esta acción no se puede deshacer.')) {
        proceder();
      }
    }
  }, true); // capture para ganarle a otros listeners
})();









/* === Perfiles: marcar filas hijas y aplicar borde izquierdo (robusto) === */
(function () {
  'use strict';
  if (window.__perfilChildBorderBound) return;
  window.__perfilChildBorderBound = true;

  function getPerfilesTable() {
    // Detecta la tabla de Perfiles por una celda .plan-cell-perfil o por un parent cercano
    const cell = document.querySelector('.plan-cell-perfil');
    if (cell) return cell.closest('table');
    // fallback: si tienes un ID fijo, descomenta y ajústalo
    // return document.getElementById('tabla-perfiles');
    return null;
  }

  function markPerfilChildRows() {
    const table = getPerfilesTable();
    if (!table || !table.tBodies || !table.tBodies[0]) return;
    const tbody = table.tBodies[0];
    const rows = Array.from(tbody.rows);

    // Limpia marcas previas
    rows.forEach(r => r.classList.remove('perfil-child-row'));

    let insidePerfilGroup = false;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const isParent = r.classList.contains('js-parent-row');
      const entidad = (r.dataset && r.dataset.entidad) ? r.dataset.entidad : '';

      if (isParent && entidad === 'perfil') {
        // Comienza un grupo de perfil
        insidePerfilGroup = true;
        continue;
      }

      if (isParent && entidad !== 'perfil') {
        // Otro padre (de otra entidad) rompe el grupo de perfil
        insidePerfilGroup = false;
        continue;
      }

      // Si estamos dentro de un grupo de perfil y la fila NO es padre → es hija
      if (insidePerfilGroup && !isParent) {
        r.classList.add('perfil-child-row');
      }

      // Si encontramos una fila que termina el grupo por estructura específica,
      // (ej. filas separadoras con una clase concreta), podríamos romper aquí.
      // Por defecto, seguimos hasta el próximo padre .js-parent-row.
    }
  }

  // Observa cambios en el tbody (por si inyectas hijos por AJAX al expandir)
  let perfilesObserver = null;
  function observePerfilesTable() {
    const table = getPerfilesTable();
    if (!table || !table.tBodies || !table.tBodies[0]) return;

    if (perfilesObserver) perfilesObserver.disconnect();

    perfilesObserver = new MutationObserver(() => {
      // Recalcula cuando se agregan/eliminan filas
      markPerfilChildRows();
    });
    perfilesObserver.observe(table.tBodies[0], { childList: true, subtree: false });
  }

  // Ejecuta al cargar
  document.addEventListener('DOMContentLoaded', () => {
    markPerfilChildRows();
    observePerfilesTable();
  });

  // Al cambiar de pestaña (Bootstrap 5)
  document.addEventListener('shown.bs.tab', (e) => {
    const targetSel = e.target.getAttribute('data-bs-target') || e.target.getAttribute('href');
    if (!targetSel) return;
    const pane = document.querySelector(targetSel);
    if (!pane) return;
    if (pane.querySelector('.plan-cell-perfil')) {
      markPerfilChildRows();
      observePerfilesTable();
    }
  });

  // Si tus hijos aparecen al hacer click en el padre, re-marca tras el click
  document.addEventListener('click', (ev) => {
    const parentPerfil = ev.target.closest('tr.js-parent-row[data-entidad="perfil"]');
    if (!parentPerfil) return;
    // pequeño delay por si el click dispara un render asíncrono
    setTimeout(() => {
      markPerfilChildRows();
    }, 0);
  }, true);

  // Exponer utilidades (por si renderizas manualmente por AJAX)
  window.markPerfilChildRows = markPerfilChildRows;
  window.observePerfilesTable = observePerfilesTable;
})();


























/* === Perfiles: rail izquierdo continuo en filas hijas (solo celda Plan) === */
(function () {
  'use strict';
  if (window.__perfilLeftRailBound) return;
  window.__perfilLeftRailBound = true;

  function ensurePerfilChildRails() {
    // Ubica la tabla de Perfiles por la presencia de .plan-cell-perfil
    const table = document.querySelector('.plan-cell-perfil')?.closest('table');
    if (!table?.tBodies?.[0]) return;
    const tbody = table.tBodies[0];

    Array.from(tbody.rows).forEach(tr => {
      if (!tr.classList.contains('perfil-child-row')) return;

      // Preferimos la celda Plan; si no existe, usamos la primera celda
      let cell = tr.querySelector('td.plan-cell-perfil') || tr.cells?.[0];
      if (!cell) return;

      // Inyecta el rail si no existe
      if (!cell.querySelector('.perfil-left-rail')) {
        const rail = document.createElement('i');
        rail.className = 'perfil-left-rail';
        rail.setAttribute('aria-hidden', 'true');
        cell.appendChild(rail);
      }
    });
  }

  // Ejecutar al cargar
  document.addEventListener('DOMContentLoaded', ensurePerfilChildRails);

  // Al cambiar de pestaña (si usas nav-tabs)
  document.addEventListener('shown.bs.tab', (e) => {
    const targetSel = e.target.getAttribute('data-bs-target') || e.target.getAttribute('href');
    if (!targetSel) return;
    const pane = document.querySelector(targetSel);
    if (pane?.querySelector('.plan-cell-perfil')) {
      // pequeño delay por si hay render diferido
      setTimeout(ensurePerfilChildRails, 0);
    }
  });

  // Si tus hijos aparecen al expandir el padre o por AJAX:
  document.addEventListener('click', (e) => {
    if (e.target.closest('tr.js-parent-row[data-entidad="perfil"]')) {
      setTimeout(ensurePerfilChildRails, 0);
    }
  }, true);

  // expón por si llamas tras un render dinámico
  window.ensurePerfilChildRails = ensurePerfilChildRails;
})();





















/* === Perfiles/Cuenta: Color de fila (mini-modal) — ELIMINADO PARA EVITAR CONFLICTOS === */
/* Intencionalmente vacío. La gestión de color/submit queda a cargo de:
   - assets/js/cuentas_override.js
   - assets/js/stock_override.js
   - assets/js/ajax_guard.js
*/


















































































/* =========================================================
   PREVIEW DE COLOR → REVERTIR SI CIERRA/CANCELA (PERFILES/PLAN)
   Pegar al final de public/assets/js/app.js
   ========================================================= */
(function () {
  'use strict';

  // Reutiliza helpers existentes si están; si no, usa fallback
  const getRowFromModalForm = (window.getRowFromModalForm || window.rowFromForm || function (form) {
    try {
      const id = form.querySelector('input[name="id"]')?.value;
      if (!id) return null;
      const isCuenta = (form.getAttribute('action') || '').toLowerCase().includes('cuenta');
      const entidad = isCuenta ? 'cuenta' : 'perfil';
      return document.querySelector(`tr.js-parent-row[data-entidad="${entidad}"][data-id="${id}"]`);
    } catch (_) { return null; }
  });

  const getCurrentRowColor = (typeof window.currentRowColor === 'function'
    ? window.currentRowColor
    : function (tr) {
        if (!tr) return '';
        if (tr.classList.contains('row-color-rojo'))   return 'rojo';
        if (tr.classList.contains('row-color-azul'))   return 'azul';
        if (tr.classList.contains('row-color-verde'))  return 'verde';
        if (tr.classList.contains('row-color-blanco')) return 'blanco';
        return tr.getAttribute('data-color') || '';
      });

  const applyColor = (typeof window.applyRowColor === 'function'
    ? window.applyRowColor
    : function (tr, val) {
        if (!tr) return;
        if (val == null || val === '') return;
        const CLS = (Array.isArray(window.COLOR_CLASSES) && window.COLOR_CLASSES.length)
          ? window.COLOR_CLASSES
          : ['row-color-rojo','row-color-azul','row-color-verde','row-color-blanco'];
        tr.classList.remove(...CLS);
        tr.removeAttribute('data-color');
        if (val === 'restablecer') return;
        tr.classList.add('row-color-' + val);
        tr.setAttribute('data-color', val);
      });

  // 1) Al abrir el modal, recuerda el color original de la fila
  document.addEventListener('shown.bs.modal', function (ev) {
    const modal = ev.target;
    const form  = modal.querySelector('form');
    if (!form) return;
    // Solo mini-modales de plan (los que tienen select[name="plan"])
    if (!form.querySelector('select[name="plan"]')) return;

    const row = getRowFromModalForm(form);
    if (!row) return;

    const initial = getCurrentRowColor(row) || '';
    modal.dataset.initColor  = initial; // '' si no tenía
    modal.dataset.colorSaved = '0';     // se pondrá '1' al guardar con éxito
    // Guardamos referencia del modal activo para fetch wrapper
    window.__lastPlanModal__ = modal;
  }, true);

  // 2) Si guardas con éxito por FETCH, marca "guardado"
  if (!window.__colorFetchWrapped__) {
    window.__colorFetchWrapped__ = true;
    const _fetch = window.fetch;
    window.fetch = async function () {
      const res = await _fetch.apply(this, arguments);
      try {
        const req = arguments[0];
        const url = (typeof req === 'string') ? req : (req && req.url) ? req.url : '';
        // Solo si es el endpoint de perfiles_plan_update.php
        if (/perfiles_plan_update\.php/i.test(String(url || ''))) {
          // Intento de parseo JSON
          let ok = false;
          try {
            const clone = res.clone();
            const data = await clone.json();
            ok = !!(data && data.ok === true);
          } catch (_) { /* noop */ }
          if (ok && window.__lastPlanModal__) {
            window.__lastPlanModal__.dataset.colorSaved = '1';
          }
        }
      } catch (_) { /* noop */ }
      return res;
    };
  }

  // 3) Si guardas con éxito por jQuery.ajax, marca "guardado" (listener global no invasivo)
  if (window.jQuery && jQuery(document)) {
    jQuery(document)
      .off('ajaxSuccess.__colorSavedMark')
      .on('ajaxSuccess.__colorSavedMark', function (_e, _jqXHR, settings, data) {
        try {
          const url = settings && settings.url ? String(settings.url) : '';
          if (!/perfiles_plan_update\.php/i.test(url)) return;
          const d = (typeof data === 'string') ? JSON.parse(data) : data;
          if (d && d.ok && window.__lastPlanModal__) {
            window.__lastPlanModal__.dataset.colorSaved = '1';
          }
        } catch (_) { /* noop */ }
      });
  }

  // 4) Al cerrar el modal: si NO se guardó, revierte el preview
  document.addEventListener('hidden.bs.modal', function (ev) {
    const modal = ev.target;
    const form  = modal.querySelector('form');
    if (!form) return;
    if (!form.querySelector('select[name="plan"]')) return;

    const saved = modal.dataset.colorSaved === '1';
    const initial = modal.dataset.initColor || '';

    // Limpiar marcas
    modal.dataset.initColor  = '';
    modal.dataset.colorSaved = '0';
    if (window.__lastPlanModal__ === modal) window.__lastPlanModal__ = null;

    if (saved) return; // si se guardó, no revertimos

    const row = getRowFromModalForm(form);
    if (!row) return;

    // Eliminar cualquier preview aplicado en el modal
    try {
      const CLS = (Array.isArray(window.COLOR_CLASSES) && window.COLOR_CLASSES.length)
        ? window.COLOR_CLASSES
        : ['row-color-rojo','row-color-azul','row-color-verde','row-color-blanco'];
      row.classList.remove(...CLS);
      row.removeAttribute('data-color');
      // Restaurar color original si lo había
      if (initial) applyColor(row, initial);
    } catch (_) { /* noop */ }
  }, true);
})();














/* =========================================================
   FECHAS EN MINI-MODAL (PERFILES/PLAN y similares)
   - No sobreescribir fecha_inicio si ya viene con valor (editar)
   - Calcular fecha_fin solo cuando el usuario cambie inicio
   Pegar al final de public/assets/js/app.js
   ========================================================= */
(function () {
  'use strict';

  // Utilidad ISO (America/Lima sin TZ): YYYY-MM-DD desde Date local
  function toISODate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // Suma de días (entero, p.ej. 31)
  function addDaysYYYYMMDD(yyyy_mm_dd, days) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(yyyy_mm_dd || ''))) return '';
    const [y, m, d] = yyyy_mm_dd.split('-').map(n => parseInt(n, 10));
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + (parseInt(days, 10) || 0));
    return toISODate(dt);
  }

  // 1) Al abrir el modal: solo inicializar si está vacío (crear)
  document.addEventListener('shown.bs.modal', function (ev) {
    const modal = ev.target;
    const form  = modal.querySelector('form');
    if (!form) return;

    // Solo mini-modales de plan (los que tienen select[name="plan"])
    if (!form.querySelector('select[name="plan"]')) return;

    const fi = form.querySelector('input[name="fecha_inicio"]');
    const ff = form.querySelector('input[name="fecha_fin"]');
    if (!fi || !ff) return;

    const idVal = (form.querySelector('input[name="id"]')?.value || '').trim();
    const isEdit = idVal !== ''; // si hay id, asumimos edición

    // Si ya hay valor (editar) NO tocar fecha_inicio
    // Solo si está vacía (crear) la llenamos con hoy
    if (!isEdit && (!fi.value || !/^\d{4}-\d{2}-\d{2}$/.test(fi.value))) {
      fi.value = toISODate(new Date());
    }

    // Si fecha_fin está vacía, calcularla con la regla actual (+31 días)
    if (!ff.value && fi.value) {
      ff.value = addDaysYYYYMMDD(fi.value, 30);
    }

    // Guardamos valores iniciales por si necesitas auditoría o comparación
    form.dataset._init_fi = fi.value || '';
    form.dataset._init_ff = ff.value || '';
  }, true);

  // 2) Cuando el usuario cambie fecha_inicio, recalcular fecha_fin
  document.addEventListener('change', function (ev) {
    const fi = ev.target.closest('input[name="fecha_inicio"]');
    if (!fi) return;
    const form = fi.closest('form');
    if (!form) return;
    // Solo mini-modales de plan
    if (!form.querySelector('select[name="plan"]')) return;

    const ff = form.querySelector('input[name="fecha_fin"]');
    if (!ff) return;

    // Recalculamos siempre que el usuario cambie inicio
    if (/^\d{4}-\d{2}-\d{2}$/.test(fi.value)) {
      ff.value = addDaysYYYYMMDD(fi.value, 30);
    }
  }, true);

  // Nota: No tocamos el submit/cancel aquí; tu flujo existente ya controla persistencia.
})();





















/* =========================================================
   Abrir pestañas (Perfiles/Cuentas/Stock/Pausa) en nueva ventana
   - Ctrl/Cmd+click o click medio sobre el tab → abre nueva pestaña
   - Si se entra con URL #hash → activa esa pestaña al cargar
   ========================================================= */
(function(){
  'use strict';

  // 1) Activar pestaña según el hash (#perfiles|#cuentas|#stock|#pausa)
  function activateTabFromHash() {
    const hash = (location.hash || '').trim();
    if (!hash) return;
    // Busca el botón/trigger que apunte a ese hash
    const trigger = document.querySelector(
      `[data-bs-target="${hash}"], [data-bs-toggle="tab"][href="${hash}"]`
    );
    if (trigger && window.bootstrap?.Tab) {
      // Usa la API de Bootstrap 5 para mostrar la pestaña
      bootstrap.Tab.getOrCreateInstance(trigger).show();
    }
  }

  // Ejecutar al cargar y cuando cambie el hash
  window.addEventListener('DOMContentLoaded', activateTabFromHash, { once: true });
  window.addEventListener('hashchange', activateTabFromHash);

  // 2) Permitir abrir en nueva pestaña con Ctrl/Cmd+click o botón medio
  //    sobre los triggers de tab dentro de #streamTabs
  const tabs = document.getElementById('streamTabs');
  if (tabs) {
    tabs.addEventListener('click', function(ev){
      const btn = ev.target.closest('[data-bs-toggle="tab"]');
      if (!btn) return;

      // Detecta intención de "abrir en nueva pestaña/ventana"
      const isMiddle = (ev.button === 1);                 // click rueda
      const isModified = ev.ctrlKey || ev.metaKey;        // Ctrl/Cmd
      if (!isMiddle && !isModified) return;

      // Construye URL actual + hash del tab
      const target = btn.getAttribute('data-bs-target') || btn.getAttribute('href') || '';
      if (!target || !/^#/.test(target)) return;

      const url = location.pathname + location.search + target;

      // Evita cambiar la pestaña en la página actual
      ev.preventDefault();
      ev.stopPropagation();

      // Abre en una nueva pestaña/ventana
      window.open(url, '_blank', 'noopener');
    }, true);

    // Soporte para click medio en mousedown (algunos navegadores)
    tabs.addEventListener('mousedown', function(ev){
      if (ev.button !== 1) return;
      const btn = ev.target.closest('[data-bs-toggle="tab"]');
      if (!btn) return;

      const target = btn.getAttribute('data-bs-target') || btn.getAttribute('href') || '';
      if (!target || !/^#/.test(target)) return;

      const url = location.pathname + location.search + target;
      // Evita que Bootstrap procese el tab en la página actual
      ev.preventDefault();
      window.open(url, '_blank', 'noopener');
    }, true);
  }
})();




























/* =========================================================
   Menú contextual para tabs (#perfiles/#cuentas/#stock/#pausa)
   - Click derecho muestra opciones "Abrir en nueva pestaña/ventana"
   - Corregido: los botones ahora funcionan
   ========================================================= */
(function () {
  'use strict';

  const tabsBar = document.getElementById('streamTabs');
  if (!tabsBar) return;

  // Elimina menú previo si quedó de intentos anteriores
  const OLD = document.getElementById('tabContextMenu');
  if (OLD) OLD.remove();

  // Crear menú contextual
  const menu = document.createElement('div');
  menu.id = 'tabContextMenu';
  menu.style.cssText = [
    'position:fixed',
    'z-index:2147483647',
    'display:none',
    'min-width:220px',
    'background:#fff',
    'border:1px solid rgba(0,0,0,.15)',
    'border-radius:.5rem',
    'box-shadow:0 .5rem 1rem rgba(0,0,0,.15)',
    'font-size:.875rem',
    'overflow:hidden',
    'user-select:none'
  ].join(';');
  menu.innerHTML = [
    '<button type="button" data-act="tab" style="display:block;width:100%;text-align:left;padding:.5rem .75rem;background:none;border:0;cursor:pointer">Abrir en nueva pestaña</button>',
    '<button type="button" data-act="win" style="display:block;width:100%;text-align:left;padding:.5rem .75rem;background:none;border:0;cursor:pointer;border-top:1px solid rgba(0,0,0,.1)">Abrir en nueva ventana</button>'
  ].join('');
  document.body.appendChild(menu);

  function hideMenu() { menu.style.display = 'none'; menu.dataset.url = ''; }
  function showMenu(x, y, url) {
    menu.dataset.url = url;
    menu.style.display = 'block';
    // Ajuste a viewport
    const vw = window.innerWidth, vh = window.innerHeight;
    const rect = menu.getBoundingClientRect();
    menu.style.left = Math.max(8, Math.min(x, vw - rect.width - 8)) + 'px';
    menu.style.top  = Math.max(8, Math.min(y, vh - rect.height - 8)) + 'px';
  }

  function buildUrlForTab(trigger) {
    if (!trigger) return '';
    const hash = trigger.getAttribute('data-bs-target') || trigger.getAttribute('href') || '';
    if (!hash || hash[0] !== '#') return '';
    return location.pathname + location.search + hash; // conserva ?streaming_id=...
  }

  // Mostrar menú con click derecho
  tabsBar.addEventListener('contextmenu', function (ev) {
    const btn = ev.target.closest('[data-bs-toggle="tab"]');
    if (!btn) return;
    const url = buildUrlForTab(btn);
    if (!url) return;
    ev.preventDefault();
    ev.stopPropagation();
    showMenu(ev.clientX, ev.clientY, url);
  }, false); // ← fase de burbujeo

  // Evitar que clics dentro del menú lo cierren antes de tiempo
  menu.addEventListener('mousedown', function (ev) {
    ev.stopPropagation();
  }, false);
  menu.addEventListener('click', function (ev) {
    ev.stopPropagation();
    const act = ev.target?.getAttribute('data-act');
    const url = menu.dataset.url || '';
    if (!act || !url) return;
    hideMenu();
    if (act === 'tab') {
      window.open(url, '_blank', 'noopener'); // nueva pestaña
    } else if (act === 'win') {
      window.open(url, '_blank', 'noopener,noreferrer'); // nueva ventana (depende navegador)
    }
  }, false);

  // Cerrar menú si se clickea fuera / rueda / resize / ESC
  window.addEventListener('click', function (ev) {
    if (!menu.contains(ev.target)) hideMenu();
  }, false); // ← burbujeo (NO captura)
  window.addEventListener('wheel', hideMenu, { passive: true });
  window.addEventListener('resize', hideMenu);
  window.addEventListener('blur', hideMenu);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') hideMenu();
  }, false);
})();















/* =========================================================
   Menú contextual (click derecho) en tabs (#perfiles/#cuentas/#stock/#pausa)
   ─ Solo una opción: "Abrir en nueva pestaña"
   ========================================================= */
(function () {
  'use strict';

  const tabsBar = document.getElementById('streamTabs');
  if (!tabsBar) return;

  // Elimina menú previo si existe
  const OLD = document.getElementById('tabContextMenu');
  if (OLD) OLD.remove();

  // Crear menú contextual
  const menu = document.createElement('div');
  menu.id = 'tabContextMenu';
  menu.style.cssText = [
    'position:fixed',
    'z-index:2147483647',
    'display:none',
    'min-width:220px',
    'background:#fff',
    'border:1px solid rgba(0,0,0,.15)',
    'border-radius:.5rem',
    'box-shadow:0 .5rem 1rem rgba(0,0,0,.15)',
    'font-size:.875rem',
    'overflow:hidden',
    'user-select:none'
  ].join(';');
  menu.innerHTML = '<button type="button" data-act="tab" style="display:block;width:100%;text-align:left;padding:.5rem .75rem;background:none;border:0;cursor:pointer">Abrir en nueva pestaña</button>';
  document.body.appendChild(menu);

  function hideMenu() { menu.style.display = 'none'; menu.dataset.url = ''; }
  function showMenu(x, y, url) {
    menu.dataset.url = url;
    menu.style.display = 'block';
    const vw = window.innerWidth, vh = window.innerHeight;
    const rect = menu.getBoundingClientRect();
    menu.style.left = Math.max(8, Math.min(x, vw - rect.width - 8)) + 'px';
    menu.style.top  = Math.max(8, Math.min(y, vh - rect.height - 8)) + 'px';
  }
  function buildUrlForTab(trigger) {
    if (!trigger) return '';
    const hash = trigger.getAttribute('data-bs-target') || trigger.getAttribute('href') || '';
    if (!hash || hash[0] !== '#') return '';
    return location.pathname + location.search + hash; // conserva ?streaming_id=...
  }

  // Mostrar menú con click derecho
  tabsBar.addEventListener('contextmenu', function (ev) {
    const btn = ev.target.closest('[data-bs-toggle="tab"]');
    if (!btn) return;
    const url = buildUrlForTab(btn);
    if (!url) return;
    ev.preventDefault();
    ev.stopPropagation();
    showMenu(ev.clientX, ev.clientY, url);
  }, false);

  // Evitar cierre prematuro dentro del menú
  menu.addEventListener('mousedown', function (ev) { ev.stopPropagation(); }, false);

  // Acción: abrir en nueva pestaña
  menu.addEventListener('click', function (ev) {
    ev.stopPropagation();
    const act = ev.target?.getAttribute('data-act');
    const url = menu.dataset.url || '';
    if (act !== 'tab' || !url) return;
    hideMenu();
    window.open(url, '_blank', 'noopener');
  }, false);

  // Cerrar menú al hacer click fuera / rueda / resize / ESC
  window.addEventListener('click', function (ev) { if (!menu.contains(ev.target)) hideMenu(); }, false);
  window.addEventListener('wheel', hideMenu, { passive: true });
  window.addEventListener('resize', hideMenu);
  window.addEventListener('blur', hideMenu);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hideMenu(); }, false);
})();



























/* =========================================================
   BUSCADOR UNIFICADO (Correo + WhatsApp) POR PESTAÑA
   - Inyecta input de búsqueda en Perfiles, Cuentas, Stock, Pausa
   - No modifica HTML existente; convive con el "Filtro especial"
   - Solo refina lo visible; al limpiar, restaura lo que ocultó la búsqueda
   ========================================================= */
(function(){
  'use strict';

  // Config por pestaña (IDs de las .tab-pane y entidad de los padres)
  const TABS = [
    { idTab: 'perfiles', entidad: 'perfil' },
    { idTab: 'cuentas',  entidad: 'cuenta' },
    { idTab: 'stock',    entidad: 'stock'  },
    { idTab: 'pausa',    entidad: 'pausa'  },
  ];

  // Columnas típicas (1-based) en tus tablas:
  // 2 = Correo, 8 = Cliente (WhatsApp)
  const COLS = { correoCol: 2, whatsappCol: 8 };

  // Utils
  const norm = s => String(s||'').trim().toLowerCase();
  const digits = s => String(s||'').replace(/\D+/g,'');
  function getTdText(tr, idx1){ const td = tr?.querySelector(`td:nth-child(${idx1})`); return td ? td.textContent.trim() : ''; }

  // Recorre grupos (padre + hijas hasta el próximo padre)
  function eachGroup(tbody, entidad, cb){
    const rows = Array.from(tbody.querySelectorAll('tr'));
    let i = 0;
    while (i < rows.length) {
      const r = rows[i];
      if (r.classList?.contains('js-parent-row') && r.getAttribute('data-entidad') === entidad) {
        const group = [r];
        let j = i + 1;
        for (; j < rows.length; j++) {
          const nxt = rows[j];
          if (nxt.classList?.contains('js-parent-row') && nxt.getAttribute('data-entidad') === entidad) break;
          group.push(nxt);
        }
        cb(group, r);
        i = j;
      } else {
        i++;
      }
    }
  }

  // Lógica de match por grupo (correo / whatsapp en PADRE; suficiente para agrupar)
  function matchesQuery(parentTr, q){
    if (!q) return true;
    const qn = norm(q);
    const qd = digits(q);

    // Correo: usar data-correo y la celda #2
    const correoData = norm(parentTr.getAttribute('data-correo') || '');
    const correoCell = norm(getTdText(parentTr, COLS.correoCol));
    const correoHit  = (correoData.includes(qn) || correoCell.includes(qn));

    // WhatsApp (Cliente): celda #8 (solo dígitos)
    const waCellDigits = digits(getTdText(parentTr, COLS.whatsappCol));
    const waHit = (qd && waCellDigits.includes(qd));

    return correoHit || waHit;
  }

  // Aplica/retira ocultamiento SOLO de la búsqueda (no toca lo que ocultó el filtro especial)
  function hideGroupForSearch(group){
    group.forEach(tr => {
      tr.dataset.searchHidden = '1';
      tr.style.display = 'none';
    });
  }
  function unhideGroupForSearch(group){
    group.forEach(tr => {
      if (tr.dataset.searchHidden === '1') {
        tr.style.display = '';       // restablece display por CSS/DOM
        delete tr.dataset.searchHidden;
      }
    });
  }

  function mountSearchForPane(paneId, entidad){
    const pane = document.getElementById(paneId);
    if (!pane) return;
    const table = pane.querySelector('table.table');
    if (!table) return;
    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    // Reutiliza barra del Filtro especial si existe; si no, crea una
    let host = pane.querySelector('.table-responsive') || pane;
    let barWrap = pane.__filterBar?.wrap;
    if (!barWrap) {
      barWrap = document.createElement('div');
      barWrap.className = 'd-flex align-items-center gap-2 mb-2';
      host.prepend(barWrap);
    }

    // Evitar duplicados
    if (pane.__searchMounted) return;

    // Input de búsqueda
    const input = document.createElement('input');
    input.type = 'search';
    input.className = 'form-control form-control-sm';
    input.placeholder = 'Buscar por correo o WhatsApp';
    input.style.maxWidth = '280px';

    // Botón limpiar (opcional)
    const btnClear = document.createElement('button');
    btnClear.type = 'button';
    btnClear.className = 'btn btn-sm btn-outline-secondary';
    btnClear.textContent = 'Limpiar';

    // Inserta (si hay filtro especial, lo dejamos a la izquierda)
    if (pane.__filterBar?.wrap) {
      // Si ya hay select(es), añadimos a la derecha
      pane.__filterBar.wrap.appendChild(input);
      pane.__filterBar.wrap.appendChild(btnClear);
    } else {
      // Barra propia
      barWrap.appendChild(input);
      barWrap.appendChild(btnClear);
    }

    // Debounce básico
    let t = null;
    function schedule(fn){ clearTimeout(t); t = setTimeout(fn, 180); }

    function applySearch(){
      const q = input.value || '';

      // Si q vacío → solo desocultar lo que ESTA búsqueda ocultó
      if (!q) {
        eachGroup(tbody, entidad, (group)=> unhideGroupForSearch(group));
        return;
      }

      // Con q → evaluamos cada grupo:
      eachGroup(tbody, entidad, (group, parent)=>{
        const hit = matchesQuery(parent, q);
        if (hit) {
          // Si lo habíamos ocultado por búsqueda, desocultamos
          unhideGroupForSearch(group);
        } else {
          // No tocamos si ya está oculto por otros motivos; solo añadimos nuestra marca
          // Si ya está oculto (display='none' por filtro especial), igualmente marcamos para poder revertir luego
          hideGroupForSearch(group);
        }
      });
    }

    input.addEventListener('input', ()=> schedule(applySearch));
    btnClear.addEventListener('click', ()=>{
      input.value = '';
      applySearch();
      input.focus();
    });

    pane.__searchMounted = true;
  }

  // Montar en las 4 pestañas al mostrar la pestaña
  document.addEventListener('shown.bs.tab', (ev)=>{
    const id = (ev?.target?.getAttribute('data-bs-target') || '').replace('#','');
    const cfg = TABS.find(t => t.idTab === id);
    if (cfg) mountSearchForPane(cfg.idTab, cfg.entidad);
  });

  // Montar en la pestaña activa al cargar
  window.addEventListener('DOMContentLoaded', ()=>{
    const activeBtn = document.querySelector('#streamTabs [data-bs-toggle="tab"].active, #streamTabs .nav-link.active');
    const activeId  = activeBtn ? (activeBtn.getAttribute('data-bs-target') || activeBtn.getAttribute('href') || '').replace('#','') : '';
    const cfg = TABS.find(t => t.idTab === activeId);
    if (cfg) mountSearchForPane(cfg.idTab, cfg.entidad);

    // También intenta montar silenciosamente en panes ya renderizados (por si no hay tab activo marcado)
    TABS.forEach(cfg2 => mountSearchForPane(cfg2.idTab, cfg2.entidad));
  }, { once: true });

})();



























/* =========================================================
   FILTRADOR ESPECIAL + BUSCADOR (Correo/WhatsApp) — v6
   - Color: data-color o clase row-color-*
   - Plan: data-plan > .js-edit-plan > texto celda; mapea "individual"->"basico"
   - WhatsApp: match tolerante sin prefijo +51 (Perú) y sin 0 inicial
   ========================================================= */
(function(){
  'use strict';

  // Columnas 1-based (ajusta si difiere tu tabla)
  const COLS = { planCol: 1, correoCol: 2, diasCol: 6, whatsappCol: 8, estadoCol: 12 };

  const PLAN_MAP = {
    'basico':'basico','básico':'basico','basic':'basico','individual':'basico',
    'standard':'estandar','estandar':'estandar','estándar':'estandar',
    'premium':'premium'
  };
  const COLOR_MAP = { 'rojo':'rojo','red':'rojo','azul':'azul','blue':'azul','verde':'verde','green':'verde','blanco':'blanco','white':'blanco' };
  const PEND_MATCH = ['pendiente','por activar','por-activar','inactivo','sin activar','sin-activar'];

  const norm  = s => String(s||'').trim().toLowerCase();
  const deacc = s => norm(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const digits= s => String(s||'').replace(/\D+/g,'');

  // === Helpers de tabla ===
  function tdText(tr, idx1){ const td = tr?.querySelector(`td:nth-child(${idx1})`); return td ? td.textContent.trim() : ''; }
  function parseDias(tr){ const n = parseInt(tdText(tr, COLS.diasCol), 10); return isNaN(n) ? 0 : n; }
  function isPendiente(tr){ return PEND_MATCH.includes(deacc(tdText(tr, COLS.estadoCol))); }

  // Color del padre
  function getColor(tr){
    let c = tr?.getAttribute('data-color') || '';
    c = COLOR_MAP[deacc(c)] || '';
    if (c) return c;
    if (tr && tr.className) {
      const cls = ' ' + tr.className + ' ';
      if (/\srow-color-rojo\s/i.test(cls))  return 'rojo';
      if (/\srow-color-azul\s/i.test(cls))  return 'azul';
      if (/\srow-color-verde\s/i.test(cls)) return 'verde';
      if (/\srow-color-blanco\s/i.test(cls))return 'blanco';
    }
    return '';
  }

  // Plan del padre
  function getPlan(tr){
    const viaData = tr?.getAttribute('data-plan') || '';
    const viaLink = tr?.querySelector('.plan-cell-perfil a.js-edit-plan, .plan-cell-cuenta a.js-edit-plan')?.textContent || '';
    const viaCell = tdText(tr, COLS.planCol);
    const raw = viaData || viaLink || viaCell;
    const key = deacc(raw);
    return PLAN_MAP[key] || key; // basico|estandar|premium
  }

  // Entidad del pane
  function getEntidadFromPane(pane){
    return pane.querySelector('tbody tr.js-parent-row')?.getAttribute('data-entidad') || '';
  }

  // Iterar por grupos (padre + hijas)
  function eachGroup(tbody, entidad, cb){
    const rows = Array.from(tbody.querySelectorAll('tr'));
    let i = 0;
    while (i < rows.length) {
      const r = rows[i];
      if (r.classList?.contains('js-parent-row') && r.getAttribute('data-entidad') === entidad) {
        const group = [r];
        let j = i + 1;
        for (; j < rows.length; j++) {
          const n = rows[j];
          if (n.classList?.contains('js-parent-row') && n.getAttribute('data-entidad') === entidad) break;
          group.push(n);
        }
        cb(group, r);
        i = j;
      } else i++;
    }
  }

  // Barra de filtros
  function ensureBar(pane){
    let wrap = pane.querySelector('.__filtersWrap__');
    if (wrap) return wrap;
    const host = pane.querySelector('.table-responsive') || pane;
    wrap = document.createElement('div');
    wrap.className = '__filtersWrap__ d-flex flex-wrap align-items-center gap-2 mb-2';
    host.prepend(wrap);

    const sel = document.createElement('select');
    sel.className = 'form-select form-select-sm';
    sel.style.maxWidth = '360px';
    sel.innerHTML = [
      '<option value="">— Filtro especial —</option>',
      '<option value="color_rojo">Color ROJO (padres)</option>',
      '<option value="color_azul">Color AZUL (padres)</option>',
      '<option value="color_verde">Color VERDE (padres)</option>',
      '<option value="pendientes">Pendientes por activar</option>',
      '<option value="dias_asc">Menos días</option>',
      '<option value="dias_desc">Mayor días</option>',
      '<option value="plan">Plan…</option>',
    ].join('');

    const selPlan = document.createElement('select');
    selPlan.className = 'form-select form-select-sm';
    selPlan.style.maxWidth = '220px';
    selPlan.style.display = 'none';
    selPlan.innerHTML = [
      '<option value="">— Selecciona plan —</option>',
      '<option value="basico">Básico (incluye “Individual”)</option>',
      '<option value="estandar">Estándar</option>',
      '<option value="premium">Premium</option>',
    ].join('');

    const input = document.createElement('input');
    input.type = 'search';
    input.placeholder = 'Buscar por correo o WhatsApp';
    input.className  = 'form-control form-control-sm';
    input.style.maxWidth = '280px';

    const btnClear = document.createElement('button');
    btnClear.type = 'button';
    btnClear.className = 'btn btn-sm btn-outline-secondary';
    btnClear.textContent = 'Limpiar';

    wrap.appendChild(sel);
    wrap.appendChild(selPlan);
    wrap.appendChild(input);
    wrap.appendChild(btnClear);

    wrap.__sel = sel; wrap.__selPlan = selPlan; wrap.__input = input; wrap.__btnClear = btnClear;
    return wrap;
  }

  // Estado base (orden original + mostrar todo)
  function resetBase(pane, tbody){
    if (pane.__origOrder) {
      const frag = document.createDocumentFragment();
      pane.__origOrder.forEach(tr => frag.appendChild(tr));
      tbody.appendChild(frag);
    } else {
      pane.__origOrder = Array.from(tbody.children);
    }
    Array.from(tbody.children).forEach(tr => {
      tr.classList.remove('d-none');
      tr.style.display = '';
      if (tr.dataset.searchHidden) delete tr.dataset.searchHidden;
    });
  }

  // Ocultar grupo de forma robusta
  function hideGroup(group){
    group.forEach(tr => {
      tr.dataset.searchHidden = '1'; // marca para posibles resets de búsqueda
      tr.classList.add('d-none');
      tr.style.display = 'none';
    });
  }

  // Comparación de teléfonos tolerante a +51 y 0 inicial
  function phoneMatches(cellText, q){
    const wa = digits(cellText);     // ej: "+51 977 498 954" -> "51977498954"
    const qq = digits(q);            // ej: "977498954" -> "977498954"
    if (!qq) return false;
    if (wa.includes(qq)) return true;                 // match directo (subcadena)
    const waNo51 = wa.replace(/^51/, '');             // quitar prefijo país Perú
    if (waNo51.includes(qq)) return true;
    const waNo51No0 = waNo51.replace(/^0+/, '');      // quitar posibles 0(s) iniciales
    if (waNo51No0.includes(qq)) return true;
    return false;
  }

  function applyAll(pane){
    const table = pane.querySelector('table.table'); if (!table) return;
    const tbody = table.querySelector('tbody'); if (!tbody) return;
    const bar   = pane.querySelector('.__filtersWrap__'); if (!bar) return;

    const entidad = getEntidadFromPane(pane);
    if (!entidad) return;

    const filterVal = bar.__sel.value;
    const planVal   = bar.__selPlan.value;
    const q         = bar.__input.value || '';

    // 0) Base
    resetBase(pane, tbody);

    // 1) Filtro especial
    const wantsColor = filterVal.startsWith('color_') ? filterVal.replace('color_','') : '';
    const wantsPlan  = (filterVal === 'plan') ? planVal : '';

    if (filterVal === 'dias_asc' || filterVal === 'dias_desc') {
      const groups = [];
      eachGroup(tbody, entidad, (group, parent)=> groups.push({ group, key: parseDias(parent) }) );
      groups.sort((a,b)=> filterVal === 'dias_asc' ? a.key - b.key : b.key - a.key);
      const frag = document.createDocumentFragment();
      groups.forEach(g => g.group.forEach(tr => frag.appendChild(tr)));
      tbody.appendChild(frag);
      bar.__selPlan.style.display = 'none';
    } else {
      bar.__selPlan.style.display = (filterVal === 'plan') ? '' : 'none';

      eachGroup(tbody, entidad, (group, parent)=>{
        let ok = true;
        if (wantsColor) ok = ok && (getColor(parent) === wantsColor);
        if (filterVal === 'pendientes') ok = ok && isPendiente(parent);
        if (wantsPlan) ok = ok && (getPlan(parent) === wantsPlan);
        if (!ok) hideGroup(group);
      });
    }

    // 2) Búsqueda (refina lo visible)
    if (q) {
      const qn = deacc(q);
      eachGroup(tbody, entidad, (group, parent)=>{
        // ya oculto por filtro → no tocar
        if (group[0].classList.contains('d-none') || group[0].style.display === 'none') return;

        const correoData = deacc(parent.getAttribute('data-correo') || '');
        const correoCell = deacc(tdText(parent, COLS.correoCol));
        const correoHit  = (correoData.includes(qn) || correoCell.includes(qn));

        const waCell = tdText(parent, COLS.whatsappCol);
        const waHit  = phoneMatches(waCell, q);

        if (!(correoHit || waHit)) hideGroup(group);
      });
    }
  }

  function mountPane(paneId){
    const pane = document.getElementById(paneId);
    if (!pane || pane.__mountedFiltersV6) return;
    const bar = ensureBar(pane);

    bar.__sel.addEventListener('change', function(){
      bar.__selPlan.style.display = (this.value === 'plan') ? '' : 'none';
      applyAll(pane);
    });
    bar.__selPlan.addEventListener('change', function(){ applyAll(pane); });

    let t = null; const deb = fn => { clearTimeout(t); t = setTimeout(fn, 160); };
    bar.__input.addEventListener('input', ()=> deb(()=> applyAll(pane)));
    bar.__btnClear.addEventListener('click', ()=> { bar.__input.value=''; applyAll(pane); bar.__input.focus(); });

    pane.__mountedFiltersV6 = true;
    applyAll(pane);
  }

  // Montar en las 4 pestañas si existen
  window.addEventListener('DOMContentLoaded', function(){
    ['perfiles','cuentas','stock','pausa'].forEach(id => mountPane(id));
  }, { once:true });

  document.addEventListener('shown.bs.tab', function(ev){
    const id = (ev?.target?.getAttribute('data-bs-target') || '').replace('#','');
    if (id) mountPane(id);
  });
})();
























/* --- Limpieza de buscadores antiguos (sin modificar HTML) --- */
(function(){
  'use strict';
  window.addEventListener('DOMContentLoaded', function(){

    // 1) Eliminar el buscador antiguo por WhatsApp (tiene id="search-whatsapp")
    const oldWaInput = document.getElementById('search-whatsapp');
    if (oldWaInput) {
      const container = oldWaInput.closest('.mb-3') || oldWaInput.parentElement;
      if (container) container.remove(); else oldWaInput.remove();
    }

    // 2) Eliminar la barra antigua de "Buscar por correo o WhatsApp" (pero NO la nueva)
    //    Regla: div.d-flex.align-items-center.gap-2.mb-2 que NO tenga la clase __filtersWrap__
    //    y que contenga sólo el input de búsqueda + botón "Limpiar" (2 hijos)
    document.querySelectorAll('div.d-flex.align-items-center.gap-2.mb-2').forEach(div => {
      if (div.classList.contains('__filtersWrap__')) return; // conservar la barra nueva
      const input = div.querySelector('input[type="search"][placeholder="Buscar por correo o WhatsApp"]');
      const btn   = div.querySelector('button.btn.btn-sm.btn-outline-secondary');
      const looksLegacy = !!input && !!btn && div.children.length <= 2;
      if (looksLegacy) div.remove();
    });

  }, { once: true });
})();

















/* =========================================================
   Prefijo país + Formateo WhatsApp (persistente y/o placeholder)
   - Mantiene el prefijo (+51) entre aperturas (localStorage)
   - Muestra placeholder "+51" si decides no fijar valor
   ========================================================= */
(function () {
  'use strict';

  const DEFAULT_PREFIX = '+51';
  const LS_KEY = 'waCountryPrefix';
  const KEEP_VALUE = true; // ← true: mantener valor; false: solo placeholder

  const digitsOnly = (s) => String(s || '').replace(/\D+/g, '');
  const format3x3 = (valDigits) => valDigits ? valDigits.replace(/(\d{3})(?=\d)/g, '$1 ').trim() : '';

  function injectPrefixUI(waInput) {
    // Evitar duplicado en el mismo input
    if (waInput.__prefixInjected) return;
    waInput.__prefixInjected = true;

    // Crear input-group compacto
    const wrap = document.createElement('div');
    wrap.className = 'input-group input-group-sm mb-2';
    wrap.style.maxWidth = '280px';

    const prefixInput = document.createElement('input');
    prefixInput.type = 'text';
    prefixInput.className = 'form-control';
    prefixInput.setAttribute('aria-label', 'Prefijo país');
    prefixInput.style.maxWidth = '70px';
    prefixInput.placeholder = DEFAULT_PREFIX;

    const sep = document.createElement('span');
    sep.className = 'input-group-text';
    sep.textContent = '—';

    const displayInput = document.createElement('input');
    displayInput.type = 'text';
    displayInput.className = 'form-control';
    displayInput.setAttribute('aria-label', 'Número local');

    // Cargar prefijo guardado (o default)
    const saved = (localStorage.getItem(LS_KEY) || '').trim();
    const initialPrefix = saved || DEFAULT_PREFIX;

    // Inicializar valores desde el input original
    (function initFromOriginal() {
      const rawDigits = digitsOnly(waInput.value);
      // Determinar prefijo a usar
      if (KEEP_VALUE) {
        prefixInput.value = initialPrefix.startsWith('+') ? initialPrefix : ('+' + initialPrefix.replace(/\+/g,''));
      } else {
        prefixInput.value = ''; // solo placeholder
      }

      // Si el original trae prefijo (ej. 51...), sepáralo
      if (/^51\d{9,}$/.test(rawDigits)) {
        const local = rawDigits.slice(2);
        displayInput.value = format3x3(local);
        waInput.value = local; // solo dígitos locales
      } else {
        displayInput.value = format3x3(rawDigits);
        waInput.value = rawDigits;
      }
    })();

    // Insertar antes del input real y ocultar el real (sigue siendo la fuente)
    waInput.style.display = 'none';
    const parent = waInput.parentElement || waInput.closest('div') || waInput;
    parent.insertBefore(wrap, waInput);
    wrap.appendChild(prefixInput);
    wrap.appendChild(sep);
    wrap.appendChild(displayInput);

    // Normalizar prefijo (solo + y dígitos) y persistir
    prefixInput.addEventListener('input', () => {
      let v = prefixInput.value.trim().replace(/[^\d+]/g, '');
      if (v && v[0] !== '+') v = '+' + v.replace(/\+/g, '');
      prefixInput.value = v;
    });
    const persistPrefix = () => {
      const val = prefixInput.value.trim() || DEFAULT_PREFIX;
      localStorage.setItem(LS_KEY, val);
    };
    prefixInput.addEventListener('change', persistPrefix);
    prefixInput.addEventListener('blur', persistPrefix);

    // Formatear número local 3-3-3 mientras se escribe
    displayInput.addEventListener('input', () => {
      const d = digitsOnly(displayInput.value);
      waInput.value = d;                 // valor real (solo dígitos locales)
      displayInput.value = format3x3(d); // presentación con espacios
    });

    // Asegurar consistencia en submit (solo dígitos locales en el real)
    const form = waInput.closest('form');
    if (form && !form.__waPrefixHooked) {
      form.__waPrefixHooked = true;
      form.addEventListener('submit', () => {
        waInput.value = digitsOnly(displayInput.value);
        // Nota: si necesitas enviar el prefijo aparte, puedes leer localStorage.getItem(LS_KEY)
      }, true);
    }
  }

  // Inyectar al abrir cualquier modal que tenga input[name="whatsapp"]
  document.addEventListener('shown.bs.modal', (ev) => {
    const modal = ev.target;
    const wa = modal.querySelector('input[name="whatsapp"]');
    if (!wa) return;
    injectPrefixUI(wa);
  });

})();



























/* =========================================================
   Tras GUARDAR en el modal: reflejar prefijo + número en la tabla
   - Muestra en la celda del teléfono: "+CC 977 498 954"
   - Actualiza wa.me (con E.164 sin "+": 51 + 977498954)
   - Actualiza data-phone de Telegram a "+51977498954"
   - No cambia estructura ni HTML existente
   ========================================================= */
(function () {
  'use strict';

  // Reusar el mismo storage/constantes del bloque de prefijo
  const LS_KEY = 'waCountryPrefix';
  const DEFAULT_PREFIX = '+51';

  const digitsOnly = (s) => String(s || '').replace(/\D+/g, '');
  const format3x3 = (valDigits) => valDigits ? valDigits.replace(/(\d{3})(?=\d)/g, '$1 ').trim() : '';

  function getSavedPrefix() {
    const saved = (localStorage.getItem(LS_KEY) || '').trim();
    let v = saved || DEFAULT_PREFIX;
    v = v.replace(/[^\d+]/g, '');
    if (v && v[0] !== '+') v = '+' + v.replace(/\+/g, '');
    return v || DEFAULT_PREFIX;
  }

  // Construye valores derivados a partir de localDigits (ej. "977498954")
  function buildPhoneViews(localDigits) {
    const ccWithPlus = getSavedPrefix();           // ej. "+51"
    const ccDigits   = digitsOnly(ccWithPlus);     // "51"
    const e164       = ccDigits + digitsOnly(localDigits); // "51977498954"
    const display    = ccWithPlus + ' ' + format3x3(digitsOnly(localDigits)); // "+51 977 498 954"
    return { ccWithPlus, ccDigits, e164, display };
  }

  // Busca la fila padre (js-parent-row) relacionada a un form del modal
  function findParentRowFromForm(form) {
    try {
      const id = form.querySelector('input[name="id"]')?.value;
      if (!id) return null;
      // Determinar entidad por action o por inputs presentes
      const isCuenta = /cuenta/i.test(form.getAttribute('action') || '') ||
                       !!form.querySelector('input[name="cuenta_id"]');
      const entidad = isCuenta ? 'cuenta' : 'perfil';
      return document.querySelector(`tr.js-parent-row[data-entidad="${entidad}"][data-id="${id}"]`);
    } catch { return null; }
  }

  // Actualiza la celda visual del teléfono y links (WA/TG)
  function updateRowPhoneUI(row, localDigits) {
    if (!row) return;
    const { e164, display, ccWithPlus } = buildPhoneViews(localDigits);

    // 1) Celda del número (en tus vistas suele ser la de clase .cliente)
    const numeroCell = row.querySelector('td.cliente');
    if (numeroCell) {
      numeroCell.textContent = display; // "+51 977 498 954"
    }

    // 2) WhatsApp link (mantener query ?text=... si existe)
    const waAnchor = row.querySelector('td.whatsapp a.wa-link');
    if (waAnchor) {
      const href = String(waAnchor.getAttribute('href') || '');
      const query = href.includes('?') ? href.slice(href.indexOf('?')) : '';
      waAnchor.setAttribute('href', `https://wa.me/${e164}${query}`);
      // Opcional: título/aria
      waAnchor.setAttribute('aria-label', 'WhatsApp');
      waAnchor.setAttribute('title', 'WhatsApp');
    }

    // 3) Telegram (data-phone) — le ponemos "+E164"
    const tgAnchor = row.querySelector('td.whatsapp a.tg-link');
    if (tgAnchor) {
      tgAnchor.setAttribute('data-phone', `+${e164}`);
      if (tgAnchor.hasAttribute('data-no-row-modal')) {
        // lo dejamos tal cual; solo actualizamos el phone
      }
    }

    // 4) Si la fila padre lleva también el número como data-*, actualízalo
    if (row.hasAttribute('data-whatsapp')) {
      row.setAttribute('data-whatsapp', digitsOnly(localDigits));
    }
  }

  // --- Hook de GUARDADO (fetch y jQuery.ajax), marca y actualiza UI ---

  // Marcaremos el último modal abierto para leer su formulario al guardar
  document.addEventListener('shown.bs.modal', (ev) => {
    const modal = ev.target;
    modal.dataset._waLastModal = '1';
    // limpiamos la marca en otros modales abiertos previamente
    document.querySelectorAll('.modal[data-_waLastModal="1"]').forEach(m => { if (m !== modal) delete m.dataset._waLastModal; });
  });

  function tryUpdateFromModal(modal, responseData) {
    if (!modal) return;
    const form = modal.querySelector('form');
    if (!form) return;

    // ¿Hay input[name="whatsapp"]? Si no, no tocamos nada.
    const waReal = form.querySelector('input[name="whatsapp"]');
    if (!waReal) return;

    // Si la respuesta parece OK (ok: true) o no viene JSON pero no hubo error HTTP, actualizamos UI
    let ok = true;
    if (responseData && typeof responseData === 'object' && 'ok' in responseData) {
      ok = !!responseData.ok;
    }

    if (ok) {
      const row = findParentRowFromForm(form);
      const localDigits = digitsOnly(waReal.value);
      updateRowPhoneUI(row, localDigits);
    }
  }

  // Wrap fetch
  if (!window.__waSaveWrappedFetch__) {
    window.__waSaveWrappedFetch__ = true;
    const _fetch = window.fetch;
    window.fetch = async function () {
      const res = await _fetch.apply(this, arguments);
      try {
        // Detectar si es petición de guardar perfil/cuenta por URL
        const req = arguments[0];
        const url = (typeof req === 'string') ? req : (req && req.url) ? req.url : '';
        if (/perfil|cuenta|update|save|store|controller/i.test(String(url))) {
          let data = null;
          try { data = await res.clone().json(); } catch {}
          const modal = document.querySelector('.modal.show[data-_waLastModal="1"]');
          tryUpdateFromModal(modal, data);
        }
      } catch {}
      return res;
    };
  }

  // Hook jQuery.ajax
  if (window.jQuery && !window.__waSaveWrappedAjax__) {
    window.__waSaveWrappedAjax__ = true;
    jQuery(document).on('ajaxSuccess', function (_e, _jqXHR, settings, data) {
      try {
        const url = settings && settings.url ? String(settings.url) : '';
        if (!/perfil|cuenta|update|save|store|controller/i.test(url)) return;
        const parsed = (typeof data === 'string') ? (function(){ try { return JSON.parse(data); } catch { return null; } })() : data;
        const modal = document.querySelector('.modal.show[data-_waLastModal="1"]');
        tryUpdateFromModal(modal, parsed);
      } catch {}
    });
  }

})();





















/* ===== WhatsApp (prefijo + número) – pegar al final de app.js, dentro de la IIFE ===== */

/* Utilidades */
function _waDigitsOnly(str){ return (str || '').replace(/\D+/g, ''); }
function _waChunkLocal(localDigits){
  // agrupa en bloques de 3: 977 948 954
  return localDigits.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
}
function _waFormatDisplay(ccDigits, localDigits){
  if (!ccDigits && !localDigits) return '';
  const localFmt = _waChunkLocal(localDigits);
  return (ccDigits ? `+${ccDigits} ` : '') + localFmt;
}
function _waGetCc(form){
  let cc = form.querySelector('[name="wa_cc"]')?.value || '';
  cc = _waDigitsOnly(cc);
  // soporte opcional a data-default-cc="51" en el <form>
  if (!cc && form.dataset && form.dataset.defaultCc) {
    cc = _waDigitsOnly(form.dataset.defaultCc);
  }
  return cc;
}
function _waHydrateForm(form){
  const ccDigits    = _waGetCc(form);
  const localDigits = _waDigitsOnly(form.querySelector('[name="wa_local"]')?.value || '');

  // construir valor final "+51 977 948 954"
  const full = _waFormatDisplay(ccDigits, localDigits);

  // asegurar campo efectivo que se envía (hidden)
  let target = form.querySelector('[name="whatsapp"]');
  if (!target) {
    target = document.createElement('input');
    target.type = 'hidden';
    target.name = 'whatsapp';
    form.appendChild(target);
  }
  target.value = full;
}

/* Interceptor de envío (delegación) */
document.addEventListener('submit', function(e){
  const f = e.target;
  if (!f || !(f instanceof HTMLFormElement)) return;

  // Detecta formularios de "Agregar Perfil" o "Agregar Cuenta":
  // 1) por ID común; ajusta si tus IDs reales difieren
  // 2) o por presencia de los dos inputs wa_cc + wa_local
  const id = (f.getAttribute('id') || '');
  const hasWaParts = !!(f.querySelector('[name="wa_cc"]') && f.querySelector('[name="wa_local"]'));
  if (/(formAgregarPerfil|formAgregarCuenta)/.test(id) || hasWaParts) {
    _waHydrateForm(f);
  }
}, false);

/* (Opcional) Normaliza al teclear: deja solo dígitos en wa_cc/wa_local */
document.addEventListener('input', function(e){
  const el = e.target;
  if (!(el instanceof HTMLInputElement)) return;
  if (el.name === 'wa_cc' || el.name === 'wa_local') {
    const pos = el.selectionStart;
    const cleaned = _waDigitsOnly(el.value);
    if (el.value !== cleaned) el.value = cleaned;
    // restaurar cursor si aplica
    try { el.setSelectionRange(pos, pos); } catch {}
  }
}, false);




















/* ===== BLOQUE AUTÓNOMO (pegar AL FINAL de app.js, incluso después de `})();`) ===== */
(function () {
  'use strict';

  function wa2_digits(s){ return (s || '').replace(/\D+/g, ''); }
  function wa2_chunk3(s){ return (s || '').replace(/(\d{3})(?=\d)/g, '$1 ').trim(); }

  function wa2_hydrate(form){
    const cc    = wa2_digits(form.querySelector('[name="wa_cc"]')?.value || '');
    const local = wa2_digits(form.querySelector('[name="wa_local"]')?.value || '');
    let full = '';
    if (cc && local) full = `+${cc} ${wa2_chunk3(local)}`;
    else if (local)  full = wa2_chunk3(local);

    let target = form.querySelector('[name="whatsapp"]');
    if (!target) {
      target = document.createElement('input');
      target.type = 'hidden';
      target.name = 'whatsapp';
      form.appendChild(target);
    }
    target.value = full;
  }

  
/* removed duplicate IPTV submit listener */


  document.addEventListener('input', function(e){
    const el = e.target;
    if (!(el instanceof HTMLInputElement)) return;
    if (el.name === 'wa_cc' || el.name === 'wa_local') {
      const pos = el.selectionStart;
      const cleaned = wa2_digits(el.value);
      if (el.value !== cleaned) el.value = cleaned;
      try { el.setSelectionRange(pos, pos); } catch {}
    }
  }, false);
})();

























/* ===== WA Hydration — pegar AL FINAL de app.js (funciona aunque vaya fuera de tu IIFE) ===== */
(function () {
  function d(s){ return (s || '').replace(/\D+/g,''); }
  function chunk3(s){ return (s || '').replace(/(\d{3})(?=\d)/g,'$1 ').trim(); }

  // Busca el input del prefijo en varios alias de name/data-attr
  function pickCc(form){
    const sel = [
      '[name="wa_cc"]','[name="cc"]','[name="country_code"]',
      '[name="prefijo"]','[name="prefix"]','[name="wa_code"]',
      '[data-wa="cc"]'
    ].join(',');
    return form.querySelector(sel);
  }
  // Busca el input del número local en varios alias
  function pickLocal(form){
    const sel = [
      '[name="wa_local"]','[name="local"]','[name="telefono"]',
      '[name="phone"]','[name="whatsapp_local"]','[name="celular"]',
      '[name="numero"]','[data-wa="local"]'
    ].join(',');
    return form.querySelector(sel);
  }

  function ensureHiddenWa(form){
    let h = form.querySelector('[name="whatsapp"]');
    if (!h) {
      h = document.createElement('input');
      h.type = 'hidden';
      h.name = 'whatsapp';
      form.appendChild(h);
    }
    return h;
  }

  function hydrate(form){
    const ccEl    = pickCc(form);
    const localEl = pickLocal(form);
    const cc    = d(ccEl ? ccEl.value : '');
    const local = d(localEl ? localEl.value : '');

    // Si no hay partes, no tocamos nada
    if (!cc && !local) return;

    // Construir valor final (si hay CC lo anteponemos, si no, solo local)
    const full = cc && local ? `+${cc} ${chunk3(local)}` : (local ? chunk3(local) : '');

    // Escribir el hidden que el backend usa
    const h = ensureHiddenWa(form);
    h.value = full;
  }

  // Normaliza entradas numéricas en prefijo/número al tipear
  document.addEventListener('input', function(e){
    const el = e.target;
    if (!(el instanceof HTMLInputElement)) return;
    if (['wa_cc','cc','country_code','prefijo','prefix','wa_code','wa_local','local','telefono','phone','whatsapp_local','celular','numero'].includes(el.name)) {
      const pos = el.selectionStart;
      const val = d(el.value);
      if (el.value !== val) el.value = val;
      try { el.setSelectionRange(pos, pos); } catch {}
    }
  }, false);

  // Hidratar SIEMPRE que haya campos de WA en el form que se envía
  
/* removed duplicate IPTV submit listener */

})();

















(function(){
  function onlyDigits(s){ return (s||'').replace(/\D+/g,''); }
  function chunk3(s){ return (s||'').replace(/(\d{3})(?=\d)/g,'$1 ').trim(); }

  // Prefill al abrir modal (si editas un registro existente con data-row.whatsapp)
  document.addEventListener('click', function(e){
    const btn = e.target.closest('[data-bs-toggle="modal"][data-row]');
    if(!btn) return;
    const raw = btn.getAttribute('data-row');
    let row = null; try{ row = JSON.parse(raw); }catch{}
    const modal = document.querySelector(btn.getAttribute('data-bs-target'));
    if(!modal || !row) return;

    const ccEl = modal.querySelector('[name="wa_cc"]');
    const loEl = modal.querySelector('[name="wa_local"]');
    if(!ccEl || !loEl) return;

    const wa = (row.whatsapp || '').trim();

    // "+51 977 498 954" -> cc=51, local=977498954
    let cc = '', local = '';
    const m = /^\+(\d{1,3})\s+([\d\s]+)$/.exec(wa);
    if (m) { cc = m[1]; local = m[2]; }
    else { local = wa; } // si no trae '+', tratar todo como local

    ccEl.value = onlyDigits(cc);
    loEl.value = chunk3(onlyDigits(local));
  });

  // Limpieza al tipear
  document.addEventListener('input', function(e){
    const el = e.target;
    if(!(el instanceof HTMLInputElement)) return;
    if(el.name === 'wa_cc'){
      const pos = el.selectionStart; const v = onlyDigits(el.value);
      if(v !== el.value) el.value = v; try{ el.setSelectionRange(pos,pos);}catch{}
    }
    if(el.name === 'wa_local'){
      const pos = el.selectionStart; const v = chunk3(onlyDigits(el.value));
      if(v !== el.value) el.value = v; try{ el.setSelectionRange(pos,pos);}catch{}
    }
  });

  // No hydratamos hidden; el server construye el valor final.
})();

























// === WhatsApp local: auto-espaciado con caret estable (fix salto en 5ª cifra) ===
(function () {
  const SEL_LOCAL = 'input[name="wa_local"]';
  const SEL_CC    = 'input[name="wa_cc"]';
  const LOCAL_MAX = 12; // ajusta si tu largo local varía

  const digitsOnly = (s, max) => s.replace(/\D+/g, '').slice(0, max);
  const group3     = (d) => d.replace(/(\d{3})(?=\d)/g, '$1 ').trim();

  function caretFromDigits(dcount, formatted) {
    if (dcount <= 0) return 0;
    let seen = 0;
    for (let i = 0; i < formatted.length; i++) {
      if (/\d/.test(formatted[i])) {
        seen++;
        if (seen === dcount) return i + 1; // justo después de ese dígito
      }
    }
    return formatted.length;
  }

  function formatLocal(el) {
    if (el._fmtLock) return;
    el._fmtLock = true;

    const raw       = el.value;
    const selStart  = el.selectionStart ?? raw.length;
    const dBefore   = (raw.slice(0, selStart).match(/\d/g) || []).length;

    const digits    = digitsOnly(raw, LOCAL_MAX);
    const formatted = group3(digits);

    // Siempre reasigna y reubica caret (aunque no cambie el string)
    el.value = formatted;

    const newPos = caretFromDigits(dBefore, formatted);
    requestAnimationFrame(() => {
      el.setSelectionRange(newPos, newPos);
      el._fmtLock = false;
    });
  }

  function onLocalInput(e) { formatLocal(e.target); }

  function onCcInput(e) {
    const el  = e.target;
    const raw = el.value;
    const sel = el.selectionStart ?? raw.length;
    const dig = digitsOnly(raw, 3);
    el.value  = dig;
    requestAnimationFrame(() => {
      const p = Math.min(sel, dig.length);
      el.setSelectionRange(p, p);
    });
  }

  function bind(el, fn, flag) {
    if (el[flag]) return;
    el[flag] = true;
    el.addEventListener('input', fn);
    el.addEventListener('paste', fn);
  }

  // Bind inicial
  document.querySelectorAll(SEL_LOCAL).forEach((el) => bind(el, onLocalInput, '_waBoundLocal'));
  document.querySelectorAll(SEL_CC).forEach((el) => bind(el, onCcInput, '_waBoundCc'));

  // Bind p/inputs creados al abrir modales
  document.addEventListener('focusin', (e) => {
    if (e.target?.matches?.(SEL_LOCAL)) bind(e.target, onLocalInput, '_waBoundLocal');
    if (e.target?.matches?.(SEL_CC))    bind(e.target, onCcInput,    '_waBoundCc');
  });
})();

























// Pegar al final de: /assets/js/app.js  (idéntico patrón: delegación + fetch central)
// === IPTV: buscador, editar (prefill) y color por AJAX ===
(function () {
  const tblSel   = '#tablaIptv';
  const searchId = '#iptvSearch';

  function rowColorClass(color) {
    switch (color) {
      case 'rojo':   return 'table-danger';
      case 'azul':   return 'table-primary';
      case 'verde':  return 'table-success';
      case 'blanco': return 'table-light';
      default:       return '';
    }
  }

  // Prefill modal Editar
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-iptv-edit]');
    if (!btn) return;
    const id  = btn.getAttribute('data-id');
    const u   = btn.getAttribute('data-usuario') || '';
    const p   = btn.getAttribute('data-password') || '';
    const url = btn.getAttribute('data-url') || '';

    const m = document.querySelector('#modalEditarIptv');
    if (!m) return;
    m.querySelector('#iptv_edit_id').value       = id;
    m.querySelector('#iptv_edit_usuario').value  = u;
    m.querySelector('#iptv_edit_password').value = p;
    m.querySelector('#iptv_edit_url').value      = url;
  });

  // Cambiar color (AJAX)
  document.addEventListener('click', async function (e) {
    const a = e.target.closest('.iptv-color-opt');
    if (!a) return;
    e.preventDefault();

    const color = a.getAttribute('data-color') || '';
    const tr    = e.target.closest('tr');
    if (!tr) return;
    const id = tr.getAttribute('data-id');

    const fd = new FormData();
    fd.append('id', id);
    fd.append('color', color);

    const res  = await fetch('ajax/iptv_color.php', { method: 'POST', body: fd });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.ok !== true) {
      alert((data && data.msg) ? data.msg : 'No se pudo cambiar el color');
      return;
    }

    // Actualiza clase visual
    tr.classList.remove('table-danger','table-primary','table-success','table-light');
    const c = rowColorClass(color === 'restablecer' ? '' : color);
    if (c) tr.classList.add(c);
    tr.setAttribute('data-color', color);
  });

  // Buscador
  const search = document.querySelector(searchId);
  if (search) {
    search.addEventListener('input', function () {
      const q = this.value.trim().toLowerCase();
      document.querySelectorAll(`${tblSel} tbody tr`).forEach(tr => {
        const t = tr.textContent.toLowerCase();
        tr.style.display = t.indexOf(q) !== -1 ? '' : 'none';
      });
    });
  }
})();













// /assets/js/app.js — buscador + color desde columna "Nombre"
(function () {
  const tblSel   = '#tablaIptv';
  const searchId = '#iptvSearch';

  function rowColorClass(color) {
    switch (color) {
      case 'rojo':   return 'table-danger';
      case 'azul':   return 'table-primary';
      case 'verde':  return 'table-success';
      case 'blanco': return 'table-light';
      default:       return '';
    }
  }

  // Color desde dropdown en "Nombre"
  document.addEventListener('click', async function (e) {
    const opt = e.target.closest('.iptv-color-opt');
    if (!opt) return;
    e.preventDefault();

    const tr = opt.closest('tr');
    if (!tr) return;
    const id    = tr.getAttribute('data-id');
    const color = opt.getAttribute('data-color') || '';

    const fd = new FormData();
    fd.append('id', id);
    fd.append('color', color);

    const res  = await fetch('ajax/iptv_color.php', { method: 'POST', body: fd });
    const data = await res.json().catch(() => null);

    if (!res.ok || !data || data.ok !== true) {
      alert((data && data.msg) ? data.msg : 'No se pudo cambiar el color');
      return;
    }

    tr.classList.remove('table-danger','table-primary','table-success','table-light');
    const cls = rowColorClass(color);
    if (cls) tr.classList.add(cls);
    tr.setAttribute('data-color', color);
  });

  // Prefill Editar (si usas botón externo; puedes quitar si no lo usas)
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-iptv-edit]');
    if (!btn) return;
    const m = document.querySelector('#modalEditarIptv');
    if (!m) return;
    m.querySelector('#iptv_edit_id').value       = btn.getAttribute('data-id') || '';
    m.querySelector('#iptv_edit_nombre').value   = btn.getAttribute('data-nombre') || '';
    m.querySelector('#iptv_edit_usuario').value  = btn.getAttribute('data-usuario') || '';
    m.querySelector('#iptv_edit_password').value = btn.getAttribute('data-password') || '';
    m.querySelector('#iptv_edit_url').value      = btn.getAttribute('data-url') || '';
  });

  // Buscador
  const search = document.querySelector(searchId);
  if (search) {
    search.addEventListener('input', function () {
      const q = this.value.trim().toLowerCase();
      document.querySelectorAll(`${tblSel} tbody tr`).forEach(tr => {
        const t = tr.textContent.toLowerCase();
        tr.style.display = t.indexOf(q) !== -1 ? '' : 'none';
      });
    });
  }
})();













// === IPTV: buscador, color y prefilling de modal ===
(function () {
  function rowColorClass(color) {
    switch (color) {
      case 'rojo':   return 'table-danger';
      case 'azul':   return 'table-primary';
      case 'verde':  return 'table-success';
      case 'blanco': return 'table-light';
      default:       return '';
    }
  }

  // Cambiar color (dropdown en columna "Nombre")
  document.addEventListener('click', async function (e) {
    const opt = e.target.closest('.iptv-color-opt');
    if (!opt) return;
    e.preventDefault();

    const tr = opt.closest('tr');
    if (!tr) return;

    const id    = tr.getAttribute('data-id');
    const color = opt.getAttribute('data-color') || '';

    const fd = new FormData();
    fd.append('id', id);
    fd.append('color', color);

    const res  = await fetch('ajax/iptv_color.php', { method: 'POST', body: fd });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.ok !== true) {
      alert((data && data.msg) ? data.msg : 'No se pudo cambiar el color');
      return;
    }

    tr.classList.remove('table-danger','table-primary','table-success','table-light');
    const cls = rowColorClass(color);
    if (cls) tr.classList.add(cls);
    tr.setAttribute('data-color', color);
  });

  // Prefill modal Editar
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-iptv-edit]');
    if (!btn) return;
    const m = document.querySelector('#modalEditarIptv');
    if (!m) return;

    m.querySelector('#iptv_edit_id').value        = btn.getAttribute('data-id') || '';
    m.querySelector('#iptv_edit_nombre').value    = btn.getAttribute('data-nombre') || '';
    m.querySelector('#iptv_edit_usuario').value   = btn.getAttribute('data-usuario') || '';
    m.querySelector('#iptv_edit_password').value  = btn.getAttribute('data-password') || '';
    m.querySelector('#iptv_edit_url').value       = btn.getAttribute('data-url') || '';

    // WhatsApp: intenta dividir en cc y local
    const wa = (btn.getAttribute('data-wa') || '').trim();
    let cc = '', local = '';
    const mWa = /^\+?(\d{1,3})\s+([\d ]+)$/.exec(wa);
    if (mWa) { cc = mWa[1]; local = mWa[2]; }
    m.querySelector('#iptv_edit_wa_cc').value    = cc;
    m.querySelector('#iptv_edit_wa_local').value = local;

    m.querySelector('#iptv_edit_perfil').value   = btn.getAttribute('data-perfil') || '';
    m.querySelector('#iptv_edit_fi').value       = btn.getAttribute('data-fi') || '';
    m.querySelector('#iptv_edit_ff').value       = btn.getAttribute('data-ff') || '';
    m.querySelector('#iptv_edit_soles').value    = btn.getAttribute('data-soles') || '0.00';
    m.querySelector('#iptv_edit_estado').value   = btn.getAttribute('data-estado') || 'activo';
    m.querySelector('#iptv_edit_dispositivo').value = btn.getAttribute('data-disp') || 'tv';
    m.querySelector('#iptv_edit_combo').value    = btn.getAttribute('data-combo') || '0';
  });

  // Buscador
  const search = document.querySelector('#iptvSearch');
  if (search) {
    search.addEventListener('input', function () {
      const q = this.value.trim().toLowerCase();
      document.querySelectorAll('#tablaIptv tbody tr').forEach(tr => {
        const t = tr.textContent.toLowerCase();
        tr.style.display = t.indexOf(q) !== -1 ? '' : 'none';
      });
    });
  }
})();





















document.addEventListener('DOMContentLoaded', function () {
  // ¿Estamos en la vista IPTV?
  const hasIptv = document.getElementById('modalAgregarIptv') || document.getElementById('modalEditarIptv');
  if (!hasIptv) return;

  // Evita inicializar dos veces
  if (window.__iptvInitDone) return;
  window.__iptvInitDone = true;

  // Helpers
  function $(root, sel){ return root ? root.querySelector(sel) : null; }
  function setVal(root, sel, v){ const el = $(root, sel); if (el) el.value = v; }
  function digits(s){ return (s || '').replace(/\D+/g, ''); }
  function group3(s){ return (s || '').replace(/(\d{3})(?=\d)/g, '$1 '); }

  // Arma el hidden "whatsapp" desde wa_cc + wa_local al enviar (agregar/editar)
  document.querySelectorAll('#modalAgregarIptv form, #modalEditarIptv form').forEach(function(form){
    form.addEventListener('submit', function(){
      const modal = form.closest('.modal');
      if (!modal) return;

      const cc  = digits($(modal, '[name="wa_cc"]')?.value || '');
      const loc = digits($(modal, '[name="wa_local"]')?.value || '');
      const hidden = $(modal, 'input[name="whatsapp"]');

      if (hidden){
        hidden.value = loc ? ((cc ? ('+' + cc + ' ') : '') + group3(loc)) : '';
      }
    });
  });

  // Rellenar modal de edición desde data-row
 // --- IPTV: rellenar modal editar (sin perfil ni dispositivo) ---
document.addEventListener('click', function(e){
  const btn = e.target.closest?.('[data-bs-target="#modalEditarIptv"][data-row]');
  if(!btn) return;

  let data = {};
  try { data = JSON.parse(btn.getAttribute('data-row') || '{}'); } catch(_) {}

  const modal = document.getElementById('modalEditarIptv');
  if(!modal) return;

  const q = (s)=>modal.querySelector(s);
  const set = (sel,val)=>{ const el=q(sel); if(el) el.value = val; };

  set('input[name="id"]',              data.id || '');
  set('input[name="nombre"]',          data.nombre || '');
  set('input[name="usuario"]',         data.usuario || '');
  set('input[name="password_plain"]',  data.password_plain || '');
  set('input[name="url"]',             data.url || '');
  set('input[name="fecha_inicio"]',    data.fecha_inicio || '');
  set('input[name="fecha_fin"]',       data.fecha_fin || '');
  set('input[name="soles"]',           (data.soles != null ? String(data.soles) : '0.00'));
  set('select[name="estado"]',         data.estado || 'activo');
  set('select[name="combo"]',          String(data.combo ?? 0));

  // WhatsApp -> wa_cc / wa_local
  const waRaw = String(data.whatsapp || '').replace(/\s+/g,'');
  let cc = '', local = '';
  if (waRaw.startsWith('+')) {
    const m = /^\+(\d{1,3})(\d{5,14})$/.exec(waRaw);
    if (m){ cc = m[1]; local = m[2]; }
  } else if (waRaw) {
    local = waRaw.replace(/\D+/g,'');
  }
  set('input[name="wa_cc"]', cc);
  set('input[name="wa_local"]', local.replace(/(\d{3})(?=\d)/g, '$1 '));
});


  // Formateo en vivo del número local sin mover el cursor
  document.addEventListener('input', function(e){
    const el = e.target;
    if (el && el.name === 'wa_local') {
      const start = el.selectionStart;
      const digitsOnly = el.value.replace(/\D+/g,'');
      const grouped = digitsOnly.replace(/(\d{3})(?=\d)/g, '$1 ');
      const diff = grouped.length - el.value.length;
      el.value = grouped;
      if (typeof start === 'number') {
        const pos = start + diff;
        el.setSelectionRange(pos, pos);
      }
    }
  });
});




























document.addEventListener('shown.bs.modal', function (ev) {
  const id = ev.target && ev.target.id;
  if (id === 'modalAgregarIptv' || id === 'modalEditarIptv') {
    const phantom = ev.target.querySelector('.input-group input[aria-label="Prefijo país"]');
    if (phantom) {
      const group = phantom.closest('.input-group');
      if (group) group.remove();
    }
  }
});





















// --- IPTV: forzar submit del modal y quitar el WA fantasma ------------------
(function () {
  // 1) Cuando se muestre el modal, elimina el input-group fantasma de WA (si existiera)
  document.addEventListener('shown.bs.modal', function (ev) {
    const id = ev.target && ev.target.id;
    if (id === 'modalAgregarIptv' || id === 'modalEditarIptv') {
      const phantom = ev.target.querySelector('.input-group input[aria-label="Prefijo país"]');
      if (phantom) {
        const group = phantom.closest('.input-group');
        if (group) group.remove();
      }
    }
  });

  // 2) Forzar submit del "Agregar IPTV"
  function wireForm(formId, buttonId) {
    const form   = document.getElementById(formId);
    const button = document.getElementById(buttonId);

    if (!form || !button) return;

    // Asegura que el botón no tenga type="button"
    button.setAttribute('type', 'button');

    // Log de diagnóstico (puedes quitarlo luego)
    form.addEventListener('submit', function () {
      if (window.console) console.log('[IPTV] submit disparado ->', form.action);
    });

    button.addEventListener('click', function (e) {
      e.stopPropagation(); // por si hay listeners de fila
      // Si hay validación HTML5, muéstrala
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      // Dispara el submit real, aunque haya preventDefault en algún listener
      form.submit();
    });
  }

  wireForm('formAgregarIptv', 'btnGuardarIptv'); // IDs del modal AGREGAR
  wireForm('formEditarIptv',  'btnEditarIptv');  // (opcional) IDs del modal EDITAR
})();

























// Modal Agregar IPTV: partir WhatsApp en wa_cc y wa_local (para el controller)
(function () {
  const form = document.getElementById('formAgregarIptv');
  if (!form) return;

  form.addEventListener('submit', function () {
    const waInput = form.querySelector('#iptvAddWhatsAppUI');
    const ccInput = form.querySelector('#iptvAddWaCc');
    const localInput = form.querySelector('#iptvAddWaLocal');

    const raw = (waInput?.value || '').trim()
      .replace(/\s+/g, '')       // sin espacios
      .replace(/(?!^)\+/g, '')   // dejar un + solo al inicio si existe
      .replace(/[^\d\+]/g, '');  // solo dígitos y +

    if (raw === '' || raw === '+') {
      ccInput.value = '';
      localInput.value = '';
      return;
    }
    const digits = raw.replace(/^\+/, '');
    const local = digits.slice(-9);
    const cc = digits.length > 9 ? digits.slice(0, -9) : '';

    ccInput.value = cc;
    localInput.value = local;
  });
})();















document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('formIptvCreate');
  if (!form) return;

  form.addEventListener('submit', function () {
    const ui = (form.querySelector('#iptv-whatsapp-ui')?.value || '').trim();

    // Normaliza: quita espacios, deja solo dígitos y un '+' inicial (si hay)
    let v = ui.replace(/\s+/g, '')
              .replace(/(?!^)\+/g, '')     // elimina + que no sean el primero
              .replace(/[^\d+]/g, '');     // deja dígitos y el + inicial

    if (v === '+') v = '';                 // caso raro

    // Divide en cc/local (9 últimos dígitos = local)
    let cc = '', local = '';
    let digits = v.startsWith('+') ? v.slice(1) : v;

    if (digits.length > 9) {
      cc    = digits.slice(0, digits.length - 9);
      local = digits.slice(-9);
    } else {
      local = digits;
    }

    // Asigna a los hidden que espera el controller
    const ccInput    = form.querySelector('#iptvWaCc');
    const localInput = form.querySelector('#iptvWaLocal');
    if (ccInput)    ccInput.value = cc;
    if (localInput) localInput.value = local;
  });
});













(function () {
  const local = document.getElementById('wa_local');
  if (!local) return;

  const digitsOnly = s => s.replace(/\D+/g, '');

  const format3 = s => s.replace(/(\d{3})(?=\d)/g, '$1 ').trim();

  local.addEventListener('input', function (e) {
    const el = e.target;
    const old = el.value;
    const pos = el.selectionStart || 0;

    // cuántos dígitos había a la izquierda del cursor
    const leftDigits = digitsOnly(old.slice(0, pos));

    // normaliza + formatea
    const digits = digitsOnly(old);
    const formatted = format3(digits);

    // coloca el cursor después de los mismos dígitos a la izquierda
    let newPos = 0, count = 0;
    for (let i = 0; i < formatted.length; i++) {
      if (/\d/.test(formatted[i])) count++;
      if (count === leftDigits.length) { newPos = i + 1; break; }
    }
    if (leftDigits.length === 0) newPos = 0;
    if (leftDigits.length >= digits.length) newPos = formatted.length;

    el.value = formatted;
    el.setSelectionRange(newPos, newPos);
  });
})();












// === Modal chico para Perfiles (Plan + Color + Enviar) — robusto ===
(function () {
  const tabla = document.querySelector('#perfiles table');
  if (!tabla || !window.bootstrap) return;

  const normPlan = v => (['individual','standard','premium'].includes(String(v||'').toLowerCase().trim())
    ? String(v).toLowerCase().trim() : 'premium');
  const getRowColor = row => (row?.getAttribute('data-color') || '').trim();
  const setRowColor = (row, color) => {
    if (!row) return;
    if (color) row.setAttribute('data-color', color); else row.removeAttribute('data-color');
  };

  tabla.addEventListener('click', (ev) => {
    if (__isIptvContext(ev.target)) return; // IPTV: no abrir Cambiar plan
    const td = ev.target.closest('.plan-cell-perfil');
    if (__isIptvContext(td)) return; // IPTV: no abrir Cambiar plan
    if (!td) return;
    ev.preventDefault(); ev.stopPropagation();

    const modal = document.getElementById('modalCambiarPlanPerfil');
    if (!modal) { console.warn('[Perfiles] Falta #modalCambiarPlanPerfil'); return; }

    const row = td.closest('tr');
    modal.dataset.sourceId    = td.getAttribute('data-id') || '';
    modal.dataset.sourcePlan  = normPlan(td.getAttribute('data-plan') || td.textContent);
    modal.dataset.sourceColor = getRowColor(row) || '';

    modal.addEventListener('shown.bs.modal', function onShown() {
      modal.removeEventListener('shown.bs.modal', onShown);

      const idEl     = modal.querySelector('#perfilPlanId');
      const planSel  = modal.querySelector('#perfilPlanSelect');
      const colorSel = modal.querySelector('#perfilColorSelect, select[name="color"]');
      const destSel  = modal.querySelector('#perfilEnviarASelect, select[name="enviar_a"]');
      const btnSave  = modal.querySelector('#btnGuardarPlanPerfil');

      if (!idEl || !planSel || !btnSave) {
        console.warn('[Perfiles] Faltan elementos del modal', { idEl, planSel, btnSave });
        return;
      }

      // Set inicial
      idEl.value = modal.dataset.sourceId;
      planSel.value = modal.dataset.sourcePlan;
      if (colorSel) colorSel.value = modal.dataset.sourceColor;
      if (destSel)  destSel.value  = 'none';

      // Reata handler limpio
      btnSave.onclick = async function () {
        const id       = (idEl.value || '').trim();
        const plan     = planSel.value;
        const color    = colorSel ? String(colorSel.value || '').trim() : '';
        const enviar_a = destSel ? String(destSel.value || 'none').toLowerCase() : 'none';
        if (!id) { console.warn('[Perfiles] ID vacío'); return; }

        try {
          const params = new URLSearchParams({ id, plan, enviar_a });
          if (color !== '') params.set('color', color);
          // console.debug('[Perfiles] POST', params.toString());

          const res = await fetch('ajax/perfiles_plan_update.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
            body: params
          });

          const raw = await res.text();
          let data; try { data = JSON.parse(raw); } catch(_) { data = null; }

          if (res.ok && data && data.ok) {
            // Actualiza UI
            td.textContent = plan;
            td.setAttribute('data-plan', plan);
            setRowColor(row, color);
            if (window.Swal) Swal.fire({ icon: 'success', title: 'Actualizado', timer: 1200, showConfirmButton: false });
            bootstrap.Modal.getInstance(modal).hide();
          } else {
            const msg = (data && data.error) ? data.error : `HTTP ${res.status}`;
            if (window.Swal) Swal.fire({ icon:'error', title:'Error', text: msg }); else console.warn('[Perfiles] Guardar falló:', msg, raw);
          }
        } catch (e) {
          if (window.Swal) Swal.fire({ icon:'error', title:'Error de red' }); else console.error('[Perfiles] Error de red:', e);
        }
      };
    }, { once:true });

    bootstrap.Modal.getOrCreateInstance(modal).show();
  });
})();










































// /public/assets/js/app.js
// Guardar del modal chico (Perfiles/Familiar) — decide endpoint por contexto
(function(){
  'use strict';
  const modal = document.getElementById('modalCambiarPlanPerfil');
  if (!modal) return;

  // Utilidad para pintar color en <tr>
  function setRowColor(row, color) {
    if (!row) return;
    const classes = ['row-color-rojo','row-color-azul','row-color-verde','row-color-blanco'];
    classes.forEach(c => row.classList.remove(c));
    row.removeAttribute('data-color');
    if (color && ['rojo','azul','verde','blanco'].includes(color)) {
      row.classList.add('row-color-' + color);
      row.setAttribute('data-color', color);
    }
  }

  document.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('#btnGuardarPlanPerfil');
    if (!btn) return;

    const ctx = modal.dataset.context || 'perfiles'; // 'perfiles' | 'familiar'

    // Campos del modal
    const idEl     = modal.querySelector('#perfilPlanId');
    const planSel  = modal.querySelector('#perfilPlanSelect');
    const colorSel = modal.querySelector('#perfilColorSelect, select[name="color"]');
    const destSel  = modal.querySelector('#perfilEnviarASelect, select[name="enviar_a"]');

    const id       = (idEl?.value || '').replace(/\D+/g,'');
    const plan     = (planSel?.value || '').trim();
    const color    = (colorSel?.value || '').trim();
    const enviar_a = (destSel?.value || 'none').trim().toLowerCase();

    if (!id || !plan) { console.warn('[ModalPlan] Datos incompletos', {id, plan}); return; }

    // Endpoint según contexto
    const rel = (ctx === 'familiar')
      ? 'ajax/perfiles_familiar_plan_update.php'
      : 'ajax/perfiles_plan_update.php';
    const endpoint = new URL(rel, document.baseURI).toString();

    // Feedback
    const oldHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>Guardando...';

    try {
      const params = new URLSearchParams({ id, plan, enviar_a });
      params.set('color', color); // manda siempre color (aunque vacío)

      console.log(`[${ctx}] POST`, endpoint, params.toString());

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8' },
        body: params
      });

      const raw = await res.text();
      let data; try { data = JSON.parse(raw); } catch(_) { data = null; }
      console.log(`[${ctx}] RESP`, res.status, raw);

      if (res.ok && data && data.ok) {
        // Actualizar UI local
        const td = (ctx === 'familiar')
          ? (window.__famLastCell || document.querySelector(`#perfiles-familiar td.plan-cell-perfil[data-id="${id}"]`))
          : (window.__perfilLastCell || document.querySelector(`#perfiles td.plan-cell-perfil[data-id="${id}"]`));
        const row = td ? td.closest('tr') : null;

        if (td) {
          td.textContent = plan;
          td.setAttribute('data-plan', plan);
          setRowColor(row, color);
        }

        bootstrap.Modal.getOrCreateInstance(modal).hide();
        if (window.Swal) Swal.fire({ icon:'success', title:'Actualizado', timer:1200, showConfirmButton:false });
      } else {
        const msg = (data && data.error) || 'No se pudo guardar';
        if (window.Swal) Swal.fire({ icon:'error', title:'No se pudo guardar', text: msg });
      }
    } catch (e) {
      console.error('[ModalPlan] fetch error:', e);
      if (window.Swal) Swal.fire({ icon:'error', title:'Error de red' });
    } finally {
      btn.disabled = false;
      btn.innerHTML = oldHtml;
    }
  });
})();












// === CUENTAS: hidratar clases de color desde data-color (render inicial) ===
(function () {
  const tbody = document.querySelector('#cuentas table tbody');
  if (!tbody) return;
  tbody.querySelectorAll('tr').forEach(tr => {
    const c = (tr.getAttribute('data-color') || '').trim().toLowerCase();
    if (c && ['rojo','azul','verde','blanco'].includes(c) && !tr.classList.contains('row-color-' + c)) {
      tr.classList.add('row-color-' + c);
    }
  });
})();














// === STOCK/PAUSA: interceptar SUBMIT a ajax/stock_pausa_plan_update.php y forzar AJAX + reload ===
(function () {
  const ACTION = 'ajax/stock_pausa_plan_update.php';

  async function handleStockSubmit(form) {
    // Construye el payload EXACTO que ya estás enviando (id, tipo, plan, destino, color)
    const fd = new FormData(form);
    const params = new URLSearchParams();
    for (const [k, v] of fd.entries()) params.append(k, v == null ? '' : String(v));

    // URL absoluta (respeta baseURI) y sin cambiar el endpoint
    const url = new URL(form.action || ACTION, document.baseURI);

    // Hacer el POST por fetch y evitar que otro handler navegue
    const res = await fetch(url.href, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: params.toString(),
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'follow'
    });

    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      // Si el servidor devolvió HTML por un submit paralelo/redirect, lo mostramos como error legible
      const peek = await res.text();
      const msg = `Respuesta no JSON (posible submit/redirect paralelo)\n\n` + peek.slice(0, 300);
      if (window.Swal) await Swal.fire({ icon:'error', title:'Error', text: msg });
      return;
    }

    const data = await res.json();
    if (data && data.ok) {
      // Mantén la pestaña activa y recarga para reflejar colores
      const activeTab = document.querySelector('.nav-tabs .nav-link.active');
      const activeTarget = activeTab ? activeTab.getAttribute('data-bs-target') : '';
      if (activeTarget) sessionStorage.setItem('activeTab', activeTarget);

      if (window.Swal) {
        await Swal.fire({ icon:'success', title:'Actualizado', timer:1200, showConfirmButton:false });
      }
      window.location.reload();
    } else {
      if (window.Swal) await Swal.fire({ icon:'error', title:'No se pudo guardar', text:(data && data.error) || 'Error desconocido' });
    }
  }

  // Captura TODOS los submits a ese endpoint y cancela el submit nativo (evita doble request)
  document.addEventListener('submit', function (e) {
    const form = e.target;
    if (!form || !(form instanceof HTMLFormElement)) return;
    const action = (form.getAttribute('action') || '').trim();
    if (!action) return;
    if (action.indexOf(ACTION) === -1) return;

    e.preventDefault();
    e.stopImmediatePropagation();
    handleStockSubmit(form).catch(err => {
      if (window.Swal) Swal.fire({ icon:'error', title:'Error de red', text: String(err && err.message || err) });
    });
  }, { capture: true });

  // Además, cuando se abra el modal de Stock/Pausa, cambia el botón guardar a type="button" (evita submit nativo)
  document.addEventListener('shown.bs.modal', function (ev) {
    const modal = ev.target;
    if (!modal) return;
    // Si tu modal de stock/pausa tiene un form que postea al endpoint, ajusta el botón principal
    const form = modal.querySelector('form[action*="' + ACTION + '"]');
    if (!form) return;
    const btn = form.querySelector('button[type="submit"], #btnGuardarPlanStock, [data-role="guardar-stock"]');
    if (btn) btn.setAttribute('type', 'button');
  });
})();


















document.addEventListener('DOMContentLoaded', function () {
  (function () {
    ['#stock', '#pausa'].forEach(sel => {
      const tbody = document.querySelector(`${sel} table tbody`);
      if (!tbody) return;
      tbody.querySelectorAll('tr').forEach(tr => {
        const c = (tr.getAttribute('data-color') || '').trim().toLowerCase();
        if (c && ['rojo','azul','verde','blanco'].includes(c) && !tr.classList.contains('row-color-' + c)) {
          tr.classList.add('row-color-' + c);
        }
      });
    });
  })();
});















document.addEventListener('shown.bs.tab', function () {
  // rehidratación rápida
  ['#stock', '#pausa'].forEach(sel => {
    const tbody = document.querySelector(`${sel} table tbody`);
    if (!tbody) return;
    tbody.querySelectorAll('tr').forEach(tr => {
      const c = (tr.getAttribute('data-color') || '').trim().toLowerCase();
      if (c && ['rojo','azul','verde','blanco'].includes(c) && !tr.classList.contains('row-color-' + c)) {
        tr.classList.add('row-color-' + c);
      }
    });
  });
});














// Rehidratación initial: de data-color -> clase
(function () {
  ['#stock', '#pausa', '#cuentas', '#perfiles'].forEach(sel => {
    const tbody = document.querySelector(`${sel} table tbody`);
    if (!tbody) return;
    tbody.querySelectorAll('tr').forEach(tr => {
      const c = (tr.getAttribute('data-color') || '').trim().toLowerCase();
      tr.classList.remove('row-color-rojo','row-color-azul','row-color-verde','row-color-blanco');
      if (['rojo','azul','verde','blanco'].includes(c)) tr.classList.add('row-color-' + c);
    });
  });
})();






























/* override seguro de rowFromForm: sin redeclarar */
(function () {
  var impl = function (form) {
    var idInput = form ? form.querySelector('input[name="id"]') : null;
    var id = idInput && idInput.value ? String(idInput.value).replace(/\D+/g, '') : '';
    if (!id) return null;

    var action = (form.getAttribute('action') || '').toLowerCase();
    var seccion = 'perfiles';
    var root = document.querySelector('#perfiles');

    if (action.indexOf('cuenta') !== -1) {
      seccion = 'cuentas'; root = document.querySelector('#cuentas');
    } else if (action.indexOf('stock_pausa') !== -1 || action.indexOf('stock') !== -1) {
      seccion = 'stock'; root = document.querySelector('#stock');
    } else if (action.indexOf('perfil') !== -1) {
      seccion = 'perfiles'; root = document.querySelector('#perfiles');
    } else {
      var modal = form.closest ? form.closest('.modal') : null;
      var mid = modal && modal.id ? modal.id.toLowerCase() : '';
      if (mid.indexOf('cuenta') !== -1) { seccion = 'cuentas'; root = document.querySelector('#cuentas'); }
      else if (mid.indexOf('stock') !== -1 || mid.indexOf('pausa') !== -1) { seccion = 'stock'; root = document.querySelector('#stock'); }
    }

    var tdSelector =
      seccion === 'cuentas' ? 'td.plan-cell-cuenta' :
      seccion === 'stock'   ? 'td.plan-cell-stock'  :
                              'td.plan-cell, td.plan-cell-perfil';

    var scope = root || document;
    var td = scope.querySelector(tdSelector + '[data-id="' + id + '"]');
    var tr = td ? td.closest('tr') : null;

    if (!tr) console.warn('[rowFromForm] No se encontró la fila (seccion/id):', seccion, id);
    return tr;
  };

  try { window.rowFromForm = impl; } catch (_) { /* si existía como const, ignoramos */ }
})();






























/* === filtros_override — Filtro especial + búsqueda para Stock/Pausa (y demás) === */
;(function(){
  'use strict';
  if (window.__filtersOverrideBound) return;
  window.__filtersOverrideBound = true;

  // Helpers
  function digits(s){ return String(s||'').replace(/\D+/g,''); }
  function norm(s){ return String(s||'').toLowerCase().trim(); }
  function activeSectionEl(){
    // pestaña activa por Bootstrap
    var tabPane = document.querySelector('.tab-pane.active.show') || document.querySelector('.tab-pane.active');
    if (tabPane) return tabPane;
    // fallback: Perfiles
    return document.getElementById('perfiles') || document.body;
  }
  function sectionRowSelector(id){
    // Unificar selectores de la celda plan (no se usan aquí, pero dejamos contrato)
    if (id === 'cuentas') return 'tbody > tr';
    if (id === 'stock' || id === 'pausa') return 'tbody > tr';
    return 'tbody > tr';
  }
  function ensureRowIndex(tbody){
    // Memoriza el orden original para poder restaurarlo
    var rows = tbody.querySelectorAll('tr');
    var i = 0;
    rows.forEach(function(tr){
      if (!tr.hasAttribute('data-idx')) tr.setAttribute('data-idx', (++i).toString());
    });
  }
  function sortRows(tbody, key, dir){
    var rows = Array.from(tbody.querySelectorAll('tr'));
    var asc = (dir === 'asc');
    rows.sort(function(a,b){
      var av = parseInt(a.getAttribute(key) || '0', 10);
      var bv = parseInt(b.getAttribute(key) || '0', 10);
      if (isNaN(av)) av = 0;
      if (isNaN(bv)) bv = 0;
      return asc ? (av - bv) : (bv - av);
    });
    rows.forEach(function(tr){ tbody.appendChild(tr); });
  }
  function restoreOrder(tbody){
    var rows = Array.from(tbody.querySelectorAll('tr'));
    rows.sort(function(a,b){
      var ai = parseInt(a.getAttribute('data-idx')||'0',10);
      var bi = parseInt(b.getAttribute('data-idx')||'0',10);
      return ai - bi;
    });
    rows.forEach(function(tr){ tbody.appendChild(tr); });
  }

  // Capturar el bloque de filtros (es único)
  var wrap = document.querySelector('.__filtersWrap__');
  if (!wrap) return;

  // Controles (por orden visual del HTML que me pasaste)
  var selects = Array.from(wrap.querySelectorAll('select.form-select'));
  var selMain = selects[0] || null;   // — Filtro especial —
  var selPlan = selects[1] || null;   // — Selecciona plan —
  var input   = wrap.querySelector('input[type="search"]');
  var btnClr  = wrap.querySelector('button.btn');

  // Mostrar/ocultar el segundo select cuando toca
  function togglePlanSelect(){
    if (!selPlan) return;
    if (selMain && selMain.value === 'plan') {
      selPlan.style.display = '';
    } else {
      selPlan.value = '';
      selPlan.style.display = 'none';
    }
  }

  // Núcleo de filtrado + orden
  function applyFilters(){
    var section = activeSectionEl();
    var secId = section.id || '';
    var table = section.querySelector('table');
    var tbody = table ? table.querySelector('tbody') : null;
    if (!tbody) return;

    ensureRowIndex(tbody);

    var vMain = selMain ? selMain.value : '';
    var vPlan = selPlan ? selPlan.value : '';
    var q     = input ? norm(input.value) : '';
    var qNum  = digits(q);

    // Reset visibilidad
    var rows = Array.from(tbody.querySelectorAll(sectionRowSelector(secId)));
    rows.forEach(function(tr){ tr.classList.remove('d-none'); });

    // 1) Orden por días si corresponde, si no restaurar orden original
    if (vMain === 'dias_asc') {
      sortRows(tbody, 'data-dias', 'asc');
    } else if (vMain === 'dias_desc') {
      sortRows(tbody, 'data-dias', 'desc');
    } else {
      restoreOrder(tbody);
    }

    // 2) Aplicar filtro principal
    rows.forEach(function(tr){
      var hide = false;

      // Datos base
      var isParent = tr.getAttribute('data-parent') === '1';
      var color    = norm(tr.getAttribute('data-color') || '');
      var planKey  = norm(tr.getAttribute('data-plan_key') || '');
      var estado   = norm(tr.getAttribute('data-estado') || '');
      var diasStr  = tr.getAttribute('data-dias') || '';

      switch (vMain) {
        case 'color_rojo':
        case 'color_azul':
        case 'color_verde': {
          var expect = vMain.split('_')[1]; // rojo|azul|verde
          // "(padres)" => sólo mostramos filas padre con ese color
          if (!(isParent && color === expect)) hide = true;
          break;
        }
        case 'pendientes': {
          if (estado !== 'pendiente') hide = true;
          break;
        }
        case 'plan': {
          if (vPlan && planKey !== vPlan) hide = true;
          break;
        }
        // dias_asc / dias_desc ya ordenan; no ocultan nada aquí
        default: break;
      }

      if (hide) tr.classList.add('d-none');
    });

    // 3) Búsqueda por correo o WhatsApp (se aplica encima del filtro principal)
    if ((q && q.length >= 1) || (qNum && qNum.length >= 3)) {
      rows.forEach(function(tr){
        if (tr.classList.contains('d-none')) return; // ya oculto por el filtro principal

        var correoTd = tr.querySelector('td:nth-child(2)'); // columna Correo en Stock/Pausa
        var correo   = norm(correoTd ? correoTd.textContent : tr.getAttribute('data-correo') || '');
        var waRaw    = tr.getAttribute('data-whatsapp') || '';
        var waDig    = digits(waRaw);

        var passTxt  = true;
        if (qNum && qNum.length >= 3) {
          // si hay números, buscamos por WhatsApp (3+ dígitos)
          passTxt = waDig.indexOf(qNum) !== -1;
        } else if (q) {
          // texto => correo
          passTxt = correo.indexOf(q) !== -1;
        }

        if (!passTxt) tr.classList.add('d-none');
      });
    }
  }

  // Eventos
  function debounce(fn, t){ var h; return function(){ clearTimeout(h); var args=arguments, ctx=this; h=setTimeout(function(){ fn.apply(ctx,args); }, t||150); }; }

  if (selMain) selMain.addEventListener('change', function(){
    togglePlanSelect();
    applyFilters();
  });
  if (selPlan) selPlan.addEventListener('change', applyFilters);
  if (input)   input.addEventListener('input', debounce(applyFilters, 120));
  if (btnClr)  btnClr.addEventListener('click', function(){
    if (selMain) selMain.value = '';
    if (selPlan) { selPlan.value = ''; selPlan.style.display = 'none'; }
    if (input) { input.value = ''; }
    applyFilters();
  });

  // Reaplicar al cambiar de pestaña
  document.addEventListener('shown.bs.tab', function(){
    togglePlanSelect();
    applyFilters();
  }, false);

  // Primera pasada
  togglePlanSelect();
  applyFilters();
})();
























/* filtros_override — activar filtro por color en STOCK/PAUSA (solo padres) */
; (function(){
  'use strict';
  if (window.__colorFilterStockPausa) return;
  window.__colorFilterStockPausa = true;

  function getActivePane() {
    var pane = document.querySelector('.tab-pane.active.show') || document.querySelector('.tab-pane.active');
    return pane && (pane.id === 'stock' || pane.id === 'pausa') ? pane : null;
  }
  function colorFromRow(tr){
    var c = (tr.getAttribute('data-color') || '').toLowerCase().trim();
    if (!c) {
      if (tr.classList.contains('row-color-rojo'))   return 'rojo';
      if (tr.classList.contains('row-color-azul'))   return 'azul';
      if (tr.classList.contains('row-color-verde'))  return 'verde';
      if (tr.classList.contains('row-color-blanco')) return 'blanco';
    }
    return c;
  }
  function isParent(tr){
    return tr.classList.contains('js-parent-row') || tr.getAttribute('data-parent') === '1';
  }
  function applyColorFilter(val){
    var pane = getActivePane();
    if (!pane) return; // fuera de stock/pausa, no tocamos nada
    var tbody = pane.querySelector('tbody');
    if (!tbody) return;

    var want = (val && val.indexOf('color_') === 0) ? val.split('_')[1] : '';
    var rows = Array.from(tbody.querySelectorAll('tr'));
    rows.forEach(function(tr){
      tr.classList.remove('d-none');
      if (!want) return; // sin filtro: mostrar todo

      var c = colorFromRow(tr);
      var parent = isParent(tr);
      if (!(parent && c === want)) tr.classList.add('d-none');
    });
  }

  function currentFilterValue(){
    var wrap = document.querySelector('.__filtersWrap__');
    if (!wrap) return '';
    var sel = wrap.querySelector('select.form-select');
    return sel ? sel.value : '';
  }

  // Bind UI del filtro
  var wrap = document.querySelector('.__filtersWrap__');
  if (!wrap) return;

  var selMain = wrap.querySelector('select.form-select'); // “— Filtro especial —”
  var btnClr  = wrap.querySelector('button.btn');         // “Limpiar”

  if (selMain) selMain.addEventListener('change', function(){
    applyColorFilter(selMain.value);
  });

  if (btnClr) btnClr.addEventListener('click', function(){
    if (selMain) selMain.value = '';
    applyColorFilter('');
  });

  // Reaplicar al cambiar de pestaña
  document.addEventListener('shown.bs.tab', function(){
    applyColorFilter(currentFilterValue());
  }, false);

  // Primera pasada
  applyColorFilter(currentFilterValue());
})();













/* limpia '>' sueltos entre filtros y tabla */
(function(){
  function cleanArrowsIn(container){
    if (!container) return;
    var nodes = Array.from(container.childNodes);
    nodes.forEach(function(n){
      if (n.nodeType === 3) { // text node
        var s = (n.textContent || '').replace(/\s+/g,'');
        if (s.length && /^[>›»]+$/.test(s)) n.parentNode.removeChild(n);
      }
    });
  }

  function run(scopeSel){
    var scope = document.querySelector(scopeSel);
    if (!scope) return;
    var wrap = scope.querySelector('.table-responsive');
    if (!wrap) return;
    cleanArrowsIn(wrap);

    // por si el contenido se vuelve a regenerar (paginación, etc.)
    if (!wrap.__moCleanArrows){
      var mo = new MutationObserver(function(){ cleanArrowsIn(wrap); });
      mo.observe(wrap, { childList:true, subtree:false });
      wrap.__moCleanArrows = mo;
    }
  }

  function init(){
    ['#perfiles','#cuentas','#stock','#pausa'].forEach(run);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();















/* HOTFIX v2 — PERFILES: solo los padres con color (sin MutationObserver) */
(function () {
  'use strict';

  // Si existiera un observer viejo, intenta desconectarlo:
  try {
    const tbl = document.querySelector('#perfiles .table');
    if (tbl && tbl.__moParentsOnly && typeof tbl.__moParentsOnly.disconnect === 'function') {
      tbl.__moParentsOnly.disconnect();
      tbl.__moParentsOnly = null;
    }
  } catch (_) {}

  const COLORS = ['rojo','azul','verde','blanco'];
  const COLOR_CLASSES = COLORS.map(c => 'row-color-' + c);

  // Hidrata solo padres según data-color
  function hydrateParents(){
    const tbody = document.querySelector('#perfiles .table tbody');
    if (!tbody) return;
    tbody.querySelectorAll('tr.js-parent-row').forEach(tr=>{
      const c = (tr.getAttribute('data-color') || '').trim().toLowerCase();
      tr.classList.remove(...COLOR_CLASSES);
      if (COLORS.includes(c)) tr.classList.add('row-color-' + c);
    });
  }

  // Limpia colores/atributos en hijos UNA sola vez
  function cleanChildrenOnce(){
    const tbody = document.querySelector('#perfiles .table tbody');
    if (!tbody) return;
    tbody.querySelectorAll('tr:not(.js-parent-row)').forEach(tr=>{
      // quita clases de color si las tuviera
      tr.classList.remove(...COLOR_CLASSES);
      // quita data-color en hijos (por si vino del servidor)
      if (tr.hasAttribute('data-color')) tr.removeAttribute('data-color');
    });
  }

  // Hook: si existe applyRowColor, ignora hijos en PERFILES
  if (typeof window.applyRowColor === 'function') {
    const orig = window.applyRowColor;
    window.applyRowColor = function(row, val){
      if (row && row.closest('#perfiles') && !row.classList.contains('js-parent-row')) {
        // En perfiles, no pintamos hijos
        return;
      }
      return orig.apply(this, arguments);
    };
  }

  // Ejecuta una sola pasada al cargar
  function run(){
    hydrateParents();
    cleanChildrenOnce();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();























// Ocultar teléfono/WhatsApp SOLO en los modales de Stock y Pausa
document.addEventListener('shown.bs.modal', function (ev) {
  const m = ev.target;
  if (!m || !/^(stockModal|pausaModal)$/.test(m.id)) return;

  // intenta varias convenciones de nombre
  const phone = m.querySelector(
    'input[name="whatsapp"], input[name="telefono"], input[name="phone"], input[name="cliente"]'
  );
  if (!phone) return;

  // oculta el contenedor visualmente
  const group = phone.closest('.mb-3, .form-group, .col, div');
  if (group) group.style.display = 'none'; else phone.style.display = 'none';

  // limpia el valor para que no viaje por accidente
  phone.value = '';
}, false);






















/* === Mensaje de entrega para WhatsApp / Telegram (Perfiles y Cuenta) === */
(function () {
  'use strict';
  if (window.__waTgMsgBound) return;
  window.__waTgMsgBound = true;

  // Busca la fila TR más cercana
  function getRow(el) {
    return el && el.closest ? el.closest('tr') : null;
  }

  // Obtiene perfil desde el botón Editar (data-row JSON) o, si no, desde la celda 7
  function getPerfilFromRow(tr) {
    if (!tr) return '';
    // 1) Intentar desde el botón con data-row (más confiable)
    const btn = tr.querySelector('button[data-row]');
    if (btn) {
      try {
        const obj = JSON.parse(btn.getAttribute('data-row') || '{}');
        // En Perfiles suele ser "perfil"; en Cuenta puede venir como "cuenta"
        return (obj.perfil || obj.cuenta || '').toString().trim();
      } catch (_) {}
    }
    // 2) Fallback: tomar la 7ma celda (Perfil)
    const tds = tr.querySelectorAll('td');
    if (tds && tds.length >= 7) {
      return (tds[6].textContent || '').trim();
    }
    return '';
  }

  // Arma el texto del mensaje
  function buildMsg(tr) {
    const correo   = (tr && tr.getAttribute('data-correo'))   || '';
    const password = (tr && tr.getAttribute('data-password')) || '';
    const perfil   = getPerfilFromRow(tr) || '';

    const lines = [
      'Le hacemos la entrega de su cuenta',
      'Correo: ' + (correo || '—'),
      'Contraseña: ' + (password || '—'),
      'Perfil: ' + (perfil || '—'),
      'Nota: no ingresar a otro perfil que no es suyo por favor'
    ];
    return lines.join('\n');
  }

  // Limpia el número para wa.me (sin +, solo dígitos)
  function sanitizePhoneForWA(str) {
    if (!str) return '';
    const digits = (str.match(/\d+/g) || []).join('');
    return digits; // wa.me requiere CC + número sin "+"
  }

  document.addEventListener('click', function (ev) {
    const aWa = ev.target.closest && ev.target.closest('a.wa-link');
    const aTg = !aWa && ev.target.closest && ev.target.closest('a.tg-link');
    if (!aWa && !aTg) return;

    ev.preventDefault();
    ev.stopPropagation();

    const tr  = getRow(aWa || aTg);
    const msg = buildMsg(tr);
    const enc = encodeURIComponent(msg);

    if (aWa) {
      // Intentar extraer el teléfono del href actual (si existe)
      let phone = '';
      try {
        const href = aWa.getAttribute('href') || '';
        // ejemplos que soporta: https://wa.me/51977498954?text=..., wa.me/51977498954
        const m = href.match(/wa\.me\/(\+?\d+)/i);
        phone = m ? m[1] : '';
      } catch (_) {}
      // si no lo sacamos del href, intentar de atributos cercanos (poco común en WA)
      phone = sanitizePhoneForWA(phone);

      const url = phone
        ? ('https://wa.me/' + phone + '?text=' + enc)
        : ('https://wa.me/?text=' + enc); // sin destinatario: abre con el mensaje para que elijas contacto

      window.open(url, '_blank', 'noopener');
      return;
    }

    if (aTg) {
      // En Telegram usando share composer (fiable en web/desktop/móvil)
      // Si quisieras un deep link (app): tg://msg?text=... (no siempre abre en web)
      const url = 'https://t.me/share/url?text=' + enc;
      window.open(url, '_blank', 'noopener');
      return;
    }
  }, true);
})();





















/* === STOCK/PAUSA: ocultar UI de teléfono y evitar envío de whatsapp (sin afectar Perfiles/Cuenta) === */
(function () {
  'use strict';
  if (window.__stockPausaPhoneGuard) return;
  window.__stockPausaPhoneGuard = true;

  // Detecta si un <form> pertenece a Stock o Pausa (crear/editar o ajax update)
  function isStockPausaForm(form) {
    if (!form) return false;
    const act = String(form.getAttribute('action') || '').toLowerCase();
    // Ajusta estos nombres si tus controladores cambian
    return /stockcontroller\.php|pausacontroller\.php|ajax\/stock_pausa_plan_update\.php/.test(act);
  }

  // Oculta el bloque visual del teléfono (el input-group previo al hidden whatsapp)
  function hidePhoneUI(form) {
    try {
      // forzar whatsapp vacío
      const waHidden = form.querySelector('input[name="whatsapp"]');
      if (waHidden) {
        waHidden.value = '';
        // mantener visible si en otros módulos lo usas; aquí solo vaciamos
      }
      // tu HTML: el input-group (dos inputs + span) está justo ANTES del hidden whatsapp
      const grp = waHidden ? waHidden.previousElementSibling : null;
      if (grp && grp.classList && grp.classList.contains('input-group')) {
        grp.style.display = 'none';
        // por si el inline-style del HTML lo volviera a mostrar
        grp.hidden = true;
        grp.classList.add('d-none');
      }
    } catch (_) {}
  }

  // En cada modal que se muestre, si hay forms de Stock/Pausa -> ocultar su UI de teléfono
  document.addEventListener('shown.bs.modal', function (ev) {
    const modal = ev.target;
    if (!modal) return;
    const forms = modal.querySelectorAll('form');
    if (!forms.length) return;
    forms.forEach(f => { if (isStockPausaForm(f)) hidePhoneUI(f); });
  });

  // Si por alguna razón el modal ya está abierto al cargar
  document.querySelectorAll('.modal.show form').forEach(f => {
    if (isStockPausaForm(f)) hidePhoneUI(f);
  });

  // Antes de enviar: eliminar/inhabilitar whatsapp SOLO en Stock/Pausa
  document.addEventListener('submit', function (ev) {
    const form = ev.target && ev.target.closest ? ev.target.closest('form') : null;
    if (!isStockPausaForm(form)) return; // no tocar Perfiles/Cuenta
    const wa = form.querySelector('input[name="whatsapp"]');
    if (wa) {
      wa.value = '';
      wa.disabled = true; // lo excluye del POST nativo
      // Rehabilitarlo un ratito después por si el navegador no recarga (SPA)
      setTimeout(() => { try { wa.disabled = false; } catch (_) {} }, 2000);
    }
  }, true);

  // También interceptamos clicks a botones submit ligados a esos forms
  document.addEventListener('click', function (ev) {
    const btn = ev.target && ev.target.closest ? ev.target.closest('button[type="submit"],input[type="submit"]') : null;
    if (!btn) return;
    let form = btn.form || (btn.closest ? btn.closest('form') : null);
    if (!form && btn.hasAttribute && btn.hasAttribute('form')) {
      const fid = btn.getAttribute('form');
      if (fid) form = document.getElementById(fid);
    }
    if (!isStockPausaForm(form)) return;
    const wa = form.querySelector('input[name="whatsapp"]');
    if (wa) { wa.value = ''; wa.disabled = true; setTimeout(() => { try { wa.disabled = false; } catch (_) {} }, 2000); }
  }, true);

})();











































/* === IPTV: submit blindado (agregar/editar) — v4 === */
(function () {
  'use strict';
  if (window.__iptvSubmitV4) return;
  window.__iptvSubmitV4 = true;

  // Sólo si existe alguno de los modales IPTV en el DOM
  var inIptv = !!(document.getElementById('modalAgregarIptv') || document.getElementById('modalEditarIptv'));
  if (!inIptv) return;

  // Localizadores de formularios IPTV (por id o por action)
  function findIptvForms() {
    var list = Array.from(document.querySelectorAll(
      '#formIptv, #modalAgregarIptv form, #modalEditarIptv form, form[action*="IptvController.php"]'
    ));
    // Unicos
    return list.filter((f,i,a)=>a.indexOf(f)===i);
  }

  function onlyDigits(s){ return (s || '').replace(/\D+/g, ''); }
  function group3(s){ return (s || '').replace(/(\d{3})(?=\d)/g, '$1 '); }

  // Handler principal
  async function handleIptvSave(e){
    e.preventDefault();
    e.stopImmediatePropagation();

    var form = e.target && e.target.closest ? e.target.closest('form') : null;
    if (!form) return;

    // Evitar dobles envíos
    if (form.dataset.submitting === '1') return;
    form.dataset.submitting = '1';

    // Anular validación nativa para que no bloquee
    form.setAttribute('novalidate', 'novalidate');

    // Botón
    var btn = form.querySelector('button[type="submit"], .btn-primary');
    if (btn) { btn.disabled = true; btn.setAttribute('aria-disabled','true'); }

    var modal = form.closest('.modal');

    try {
      // Campos mínimos
      var usuario = (form.querySelector('#iptv_usuario')?.value || '').trim();
      var pass    = (form.querySelector('#iptv_password')?.value || '').trim();
      var urlVal  = (form.querySelector('#iptv_url')?.value || '').trim();

      /*if (!usuario || !pass || !urlVal) {
        (window.Swal
          ? Swal.fire({ icon:'warning', title:'Campos incompletos', text:'Usuario, contraseña y URL son obligatorios.' })
          : alert('Usuario, contraseña y URL son obligatorios.')
        );
        return;
      }*/
      
      
      if (!/^https?:\/\//i.test(urlVal)) urlVal = 'https://' + urlVal;

      var fd = new FormData(form);
      fd.set('usuario', usuario);
      fd.set('password_plain', pass);
      fd.set('url', urlVal);

      // WhatsApp desde wa_cc + wa_local → whatsapp
      var cc    = onlyDigits(form.querySelector('#iptv_wa_cc')?.value || '');
      var local = onlyDigits(form.querySelector('#iptv_wa_local')?.value || '');
      var wa    = local ? ((cc ? ('+' + cc + ' ') : '') + group3(local)) : '';
      fd.set('whatsapp', wa);

      // Combo checkbox → '1'/'0'
      var combo = form.querySelector('#iptv_combo');
      fd.set('combo', combo && combo.checked ? '1' : '0');

      // Soles limpio
      var soles = (fd.get('soles') || '').toString().trim().replace(/[^\d.]/g,'');
      fd.set('soles', soles || '0.00');

      // action por si acaso
      if (!fd.get('action')) {
        fd.set('action', (form.querySelector('#iptv_id')?.value ? 'update' : 'create'));
      }

      // Armar urlencoded
      var params = new URLSearchParams();
      for (const [k,v] of fd.entries()) params.append(k, v == null ? '' : String(v));

      var url = new URL(form.action || '../app/controllers/IptvController.php', document.baseURI).href;

      // Enviar
      var res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json, text/plain, */*'
        },
        body: params.toString()
      });

      var ct  = (res.headers.get('content-type') || '').toLowerCase();
      var txt = await res.text();
      var data = null;

      // Si devuelve HTML (login/plantilla/errores), cerramos modal y recargamos para “destrabar”
      if (!ct.includes('application/json') || /^\s*</.test(txt)) {
        try { if (modal && window.bootstrap?.Modal) window.bootstrap.Modal.getInstance(modal)?.hide(); } catch(_){}
        setTimeout(function(){ location.reload(); }, 100);
        return;
      }

      try { data = JSON.parse(txt); } catch (_) { data = null; }

      if (!res.ok || !data || data.ok !== true) {
        var msg = (data && (data.error || data.message)) || ('HTTP ' + res.status);
        (window.Swal
          ? Swal.fire({ icon:'error', title:'No se pudo guardar', text: msg })
          : alert('No se pudo guardar: ' + msg)
        );
        return;
      }

      // OK → cerrar, toast y recargar
      try { if (modal && window.bootstrap?.Modal) window.bootstrap.Modal.getInstance(modal)?.hide(); } catch(_){}
      if (window.Swal) Swal.fire({ toast:true, position:'top', timer:900, showConfirmButton:false, icon:'success', title:'Guardado' });
      setTimeout(function(){ location.reload(); }, 120);

    } catch (err) {
      (window.Swal
        ? Swal.fire({ icon:'error', title:'Error', text:String(err && err.message || err) })
        : alert('Error: ' + String(err && err.message || err))
      );
    } finally {
      form.dataset.submitting = '0';
      if (btn) { btn.disabled = false; btn.removeAttribute('aria-disabled'); }
    }
  }

  // Vinculación en CAPTURA para ganar a otros listeners
  function bindForm(f){
    if (!f || f.__iptvBind) return;
    f.__iptvBind = true;
    f.setAttribute('novalidate','novalidate');
    f.addEventListener('submit', handleIptvSave, true);

    // Por si alguien intenta bloquear el submit, también capturamos el click en el botón
    var submitBtn = f.querySelector('button[type="submit"], input[type="submit"]');
    if (submitBtn && !submitBtn.__iptvBind) {
      submitBtn.__iptvBind = true;
      submitBtn.addEventListener('click', function(ev){
        // dejamos que el submit normal dispare y nuestro listener lo captura
        // si otro handler hiciera stopImmediatePropagation(), nosotros ya estamos en captura
      }, true);
    }
  }

  // Bind inicial y también cuando se abra el modal
  findIptvForms().forEach(bindForm);
  document.addEventListener('shown.bs.modal', function(){
    findIptvForms().forEach(bindForm);
  }, true);

  // Log para depurar
  try { console.log('[IPTV] binding forms:', findIptvForms().length); } catch(_){}
})();


















/* === IPTV hard-override: submit a prueba de todo (v6) === */
(function(){
  'use strict';
  if (window.__iptvHardV6) return;
  window.__iptvHardV6 = true;

  function onlyDigits(s){ return (s||'').replace(/\D+/g,''); }
  function group3(s){ return (s||'').replace(/(\d{3})(?=\d)/g,'$1 '); }

  function bindModal(modal){
    if (!modal) return;
    const form = modal.querySelector('form[action*="IptvController.php"]') || modal.querySelector('#formIptv');
    if (!form || form.__iptvHardBound) return;
    form.__iptvHardBound = true;

    // Bloquea por completo el submit nativo
    form.setAttribute('novalidate','novalidate');
    form.addEventListener('submit', function(ev){
      ev.preventDefault();
      ev.stopImmediatePropagation();
      return false;
    }, true);

    // Reemplaza el botón "submit" por uno "button" controlado
    let btn = form.querySelector('button[type="submit"], input[type="submit"], .btn-primary');
    if (btn) {
      const clone = btn.cloneNode(true);
      clone.type = 'button';
      clone.id = 'iptvForceSave';
      btn.replaceWith(clone);
      btn = clone;
    } else {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'iptvForceSave';
      btn.className = 'btn btn-sm btn-primary';
      btn.textContent = 'Guardar';
      (form.querySelector('.modal-footer') || form).appendChild(btn);
    }

    // Enter dentro del form → que haga click en nuestro botón
    form.addEventListener('keydown', function(e){
      if (e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); btn.click(); }
    }, true);

    btn.addEventListener('click', async function(){
      if (btn.disabled) return;
      btn.disabled = true;

      try {
        // Campos mínimos
        let usuario = (form.querySelector('[name="usuario"]')?.value || '').trim();
        let pass    = (form.querySelector('[name="password_plain"]')?.value || '').trim();
        let urlVal  = (form.querySelector('[name="url"]')?.value || '').trim();
        
        /*if (!usuario || !pass || !urlVal) {
          window.Swal ? Swal.fire({icon:'warning',title:'Faltan datos',text:'Usuario, contraseña y URL son obligatorios.'})
                      : alert('Usuario, contraseña y URL son obligatorios.');
          return;
        }*/
        
        
        if (!/^https?:\/\//i.test(urlVal)) urlVal = 'https://' + urlVal;

        const fd = new FormData(form);
        fd.set('usuario', usuario);
        fd.set('password_plain', pass);
        fd.set('url', urlVal);

        // WhatsApp desde wa_cc + wa_local → whatsapp
        const cc = onlyDigits(form.querySelector('[name="wa_cc"]')?.value || '');
        const loc = onlyDigits(form.querySelector('[name="wa_local"]')?.value || '');
        fd.set('whatsapp', loc ? ((cc ? ('+'+cc+' ') : '') + group3(loc)) : '');

        // Combo → '1'/'0'
        fd.set('combo', form.querySelector('[name="combo"]')?.checked ? '1' : '0');

        // Soles limpio
        const soles = (fd.get('soles')||'').toString().trim().replace(/[^\d.]/g,'') || '0.00';
        fd.set('soles', soles);

        // action por defecto si no vino
        if (!fd.get('action')) {
          const hasId = !!(form.querySelector('[name="id"]')?.value);
          fd.set('action', hasId ? 'update' : 'create');
        }

        // URL final
        const url = new URL(form.action || '../app/controllers/IptvController.php', document.baseURI).href;

        // x-www-form-urlencoded
        const params = new URLSearchParams();
        for (const [k,v] of fd.entries()) params.append(k, v==null?'':String(v));

        console.log('[IPTV] POST →', url, Object.fromEntries(fd.entries()));

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': 'application/json, text/plain, */*'
          },
          body: params.toString()
        });

        const ct = (res.headers.get('content-type') || '').toLowerCase();
        const txt = await res.text();
        let data = null;

        // Si el server devuelve HTML (login/plantilla/notice), cerramos y recargamos para “destrabar”
        if (!ct.includes('application/json') || /^\s*</.test(txt)) {
          console.warn('[IPTV] Respuesta no-JSON, se recarga.', txt.slice(0,120));
          try { window.bootstrap?.Modal.getInstance(modal)?.hide(); } catch(_){}
          location.reload();
          return;
        }

        try { data = JSON.parse(txt); } catch(_){ data = null; }

        if (!res.ok || !data || data.ok !== true) {
          const msg = (data && (data.error || data.message)) || ('HTTP '+res.status);
          window.Swal ? Swal.fire({icon:'error',title:'No se pudo guardar',text:msg}) : alert('No se pudo guardar: '+msg);
          return;
        }

        // Éxito → cerrar y recargar
        try { window.bootstrap?.Modal.getInstance(modal)?.hide(); } catch(_){}
        window.Swal ? Swal.fire({toast:true,position:'top',timer:900,showConfirmButton:false,icon:'success',title:'Guardado'}) : null;
        setTimeout(()=>location.reload(), 120);

      } catch (err) {
        window.Swal ? Swal.fire({icon:'error',title:'Error',text:String(err?.message || err)})
                    : alert('Error: ' + String(err?.message || err));
      } finally {
        btn.disabled = false;
      }
    });
  }

  function scan(){
    document.querySelectorAll('#modalAgregarIptv, #modalEditarIptv').forEach(bindModal);
  }

  // Bind inicial + cuando se muestre el modal
  scan();
  document.addEventListener('shown.bs.modal', function(ev){
    const m = ev.target;
    if (m && (m.id === 'modalAgregarIptv' || m.id === 'modalEditarIptv')) bindModal(m);
  }, true);

  // Por si el modal ya estaba abierto antes de cargar el script
  setTimeout(scan, 0);
  console.log('[IPTV hard-override v6] listo');
})();














/* === IPTV: submit nativo que ignora todos los interceptores (hard bypass) === */
(function(){
  'use strict';
  if (window.__iptvNativeBypass) return;
  window.__iptvNativeBypass = true;

  function onlyDigits(s){ return (s||'').replace(/\D+/g,''); }
  function group3(s){ return (s||'').replace(/(\d{3})(?=\d)/g,'$1 '); }

  window._iptvNativeSubmit = function(btn){
    try {
      const form = btn.closest('form');
      if (!form) return;

      // Armar whatsapp desde wa_cc + wa_local
      const cc  = onlyDigits(form.querySelector('[name="wa_cc"]')?.value || '');
      const loc = onlyDigits(form.querySelector('[name="wa_local"]')?.value || '');
      let hWa = form.querySelector('input[name="whatsapp"]');
      if (!hWa) { hWa = document.createElement('input'); hWa.type='hidden'; hWa.name='whatsapp'; form.appendChild(hWa); }
      hWa.value = loc ? ((cc ? ('+'+cc+' ') : '') + group3(loc)) : '';

      // Combo: enviar 1/0
      const cb = form.querySelector('[name="combo"]');
      if (cb) {
        // Si está marcado, que mande "1"; si no, añadimos un hidden "0"
        if (cb.checked) {
          cb.value = '1';
        } else {
          let h0 = form.querySelector('input[type="hidden"][name="combo"]');
          if (!h0) { h0 = document.createElement('input'); h0.type = 'hidden'; h0.name = 'combo'; form.appendChild(h0); }
          h0.value = '0';
        }
      }

      // URL (si el user puso sin http)
      const urlIn = form.querySelector('[name="url"]');
      if (urlIn && urlIn.value && !/^https?:\/\//i.test(urlIn.value)) {
        urlIn.value = 'https://' + urlIn.value.trim();
      }

      // Asegurar "action" por si falta
      if (!form.querySelector('[name="action"]')) {
        const h = document.createElement('input');
        h.type = 'hidden';
        h.name = 'action';
        h.value = (form.querySelector('[name="id"]')?.value ? 'update' : 'create');
        form.appendChild(h);
      }

      // BYPASS total: submit nativo sin disparar eventos de submit
      HTMLFormElement.prototype.submit.call(form);
    } catch (err) {
      window.Swal ? Swal.fire({icon:'error',title:'Error',text:String(err?.message || err)}) : alert(String(err?.message || err));
    }
  };

  // Fallback por si CSP bloquea onClick inline: botón con id #iptvGuardar o data-iptv-save
  document.addEventListener('click', function(e){
    const b = e.target.closest('#iptvGuardar,[data-iptv-save]');
    if (!b) return;
    e.preventDefault();
    window._iptvNativeSubmit(b);
  }, true);

  console.log('[IPTV] bypass de submit nativo listo');
})();


















// === IPTV: Forzar submit del botón #iptvForceSave ===
(function(){
  if (window.__iptvForceSaveBound) return;
  window.__iptvForceSaveBound = true;

  document.addEventListener('click', function(ev){
    const btn = ev.target.closest('#iptvForceSave');
    if (!btn) return;

    // Localiza el modal y el <form>
    const modal = btn.closest('.modal') || document;
    const form  = modal.querySelector('form#formIptv') || modal.querySelector('form[action*="IptvController.php"]') || null;
    if (!form) { console.warn('[IPTV] No se encontró form'); return; }

    // Armar/actualizar el hidden "whatsapp" a partir de wa_cc + wa_local
    const ccRaw   = (modal.querySelector('[name="wa_cc"]')    ?.value || '').replace(/\D+/g,'');
    const localRaw= (modal.querySelector('[name="wa_local"]') ?.value || '').replace(/\D+/g,'');
    let waPretty  = '';
    if (localRaw) {
      const grouped = localRaw.replace(/(\d{3})(?=\d)/g,'$1 ');
      waPretty = (ccRaw ? ('+'+ccRaw+' ') : '') + grouped;
    }
    let waHidden = form.querySelector('input[name="whatsapp"]');
    if (!waHidden) {
      waHidden = document.createElement('input');
      waHidden.type = 'hidden';
      waHidden.name = 'whatsapp';
      form.appendChild(waHidden);
    }
    waHidden.value = waPretty;

    // Validación nativa
    if (typeof form.reportValidity === 'function' && !form.reportValidity()) return;

    // Bloquear doble click
    if (btn.dataset.submitting === '1') return;
    btn.dataset.submitting = '1';
    btn.disabled = true;

    try {
      // Submit nativo (evita listeners que hagan preventDefault)
      HTMLFormElement.prototype.submit.call(form);
    } catch (e) {
      console.warn('[IPTV] submit error:', e);
      btn.dataset.submitting = '0';
      btn.disabled = false;
    }
  });
})();






























// IPTV — forzar submit nativo desde window/captura (anti-bloqueos)
(function () {
  if (window.__IPTV_FORCE_NATIVE) return;
  window.__IPTV_FORCE_NATIVE = true;

  function onlyDigits(s){ return String(s||'').replace(/\D+/g,''); }
  function group3(s){ return String(s||'').replace(/(\d{3})(?=\d)/g,'$1 '); }

  function buildWhatsapp(form){
    const scope = form.closest('.modal') || document;
    const cc  = onlyDigits(scope.querySelector('[name="wa_cc"]')?.value || '');
    const loc = onlyDigits(scope.querySelector('[name="wa_local"]')?.value || '');
    const pretty = loc ? (cc ? ('+'+cc+' ') : '') + group3(loc) : '';
    let hidden = form.querySelector('input[name="whatsapp"]');
    if (!hidden) {
      hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.name = 'whatsapp';
      form.appendChild(hidden);
    }
    hidden.value = pretty;
  }

  function forceSubmit(form){
    // compón whatsapp y envía nativamente sin disparar eventos de submit
    try { buildWhatsapp(form); } catch(_) {}
    try {
      HTMLFormElement.prototype.submit.call(form);
      return;
    } catch(e) {
      // Fallback AJAX si el submit nativo fallara por CSP extraña
      const fd = new FormData(form);
      const params = new URLSearchParams();
      for (const [k,v] of fd.entries()) params.append(k, v == null ? '' : String(v));
      fetch(form.action || 'IptvController.php', {
        method:'POST',
        headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},
        body: params.toString()
      }).then(()=>location.reload());
    }
  }

  // Capturamos el click del botón en WINDOW (va antes que document/body)
  window.addEventListener('click', function(ev){
    const path = ev.composedPath ? ev.composedPath() : [];
    const btn = path && path.find(n => n && n.nodeType === 1 && n.id === 'iptvForceSave');
    if (!btn) return;

    const form = btn.closest('form') || document.getElementById('formIptv');
    if (!form) return;

    // Cortamos la propagación de ese click y enviamos
    ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();
    forceSubmit(form);
  }, true); // <-- CAPTURA en window (se ejecuta primero)

  console.log('[IPTV] force-native listo');
})();










/* === IPTV: mensaje WhatsApp/Telegram con plantilla propia (NO streaming) === */
(function(){
  'use strict';

  // Solo activar en la vista IPTV (detectamos por la existencia de los modales IPTV)
  const isIptvPage = !!(document.getElementById('modalAgregarIptv') || document.getElementById('modalEditarIptv'));
  if (!isIptvPage) return;

  function digits(s){ return String(s||'').replace(/\D+/g,''); }

  // Intenta leer valores desde data-* del <tr>; si no existen, puedes ampliar aquí
  function valFromRow(tr, key){
    if (!tr) return '';
    // data-usuario, data-password_plain, data-url, etc.
    if (tr.dataset && tr.dataset[key] != null) return String(tr.dataset[key]).trim();
    // fallback: si marcas las celdas con data-col="usuario" / "password" / "url"
    const col = tr.querySelector(`[data-col="${key}"]`);
    return col ? col.textContent.trim() : '';
  }

  function buildIptvMessage(tr){
    const usuario = valFromRow(tr,'usuario');
    const pass    = valFromRow(tr,'password_plain') || valFromRow(tr,'password');
    const url     = valFromRow(tr,'url');
    return `Le hacemos la entrega de su IPTV
Usuario: ${usuario}
Contraseña: ${pass}
URL: ${url}
Nota: no ingresar a otro perfil que no es suyo por favor`;
  }

  function openWA(phone, text){
    const p = digits(phone);
    const url = p ? `https://wa.me/${p}?text=${encodeURIComponent(text)}` 
                  : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function openTG(text){
    const url = `https://t.me/share/url?url=&text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  // Intercepta clics SOLO en IPTV (deja el handler de Streaming hacer lo suyo en las otras páginas)
  document.addEventListener('click', function(ev){
    const a = ev.target.closest('.wa-link, .tg-link');
    if (!a) return;
    if (!isIptvPage) return; // importante: no tocar Streaming
    if (a.closest('#iptv') || a.dataset.scope === 'iptv') return;

    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();

    const tr  = a.closest('tr');
    const msg = buildIptvMessage(tr);

    if (a.classList.contains('wa-link')) {
      const phone = a.getAttribute('data-phone') || a.getAttribute('href') || '';
      openWA(phone, msg);
    } else {
      openTG(msg);
    }
  }, true);
})();














/* === IPTV: plantilla propia de WhatsApp/Telegram === */
(function(){
  'use strict';

  // Activar sólo si estamos en IPTV
  const isIptvPage = !!(document.getElementById('iptv') || document.getElementById('modalAgregarIptv') || document.getElementById('modalEditarIptv'));
  if (!isIptvPage) return;

  function digits(s){ return String(s||'').replace(/\D+/g,''); }
  function valFromRow(tr, key){
    if (!tr) return '';
    if (tr.dataset && tr.dataset[key] != null) return String(tr.dataset[key]).trim();
    const col = tr.querySelector(`[data-col="${key}"]`);
    return col ? col.textContent.trim() : '';
  }
  function buildIptvMessage(tr){
    const usuario = valFromRow(tr,'usuario');
    const pass    = valFromRow(tr,'password_plain') || valFromRow(tr,'password');
    const url     = valFromRow(tr,'url');
    return `Le hacemos la entrega de su IPTV
Usuario: ${usuario}
Contraseña: ${pass}
URL: ${url}
Nota: no ingresar a otro perfil que no es suyo por favor`;
  }
  function openWA(phone, text){
    const p = digits(phone);
    const url = p ? `https://wa.me/${p}?text=${encodeURIComponent(text)}`
                  : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }
  function openTG(text){
    const url = `https://t.me/share/url?url=&text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  // Interceptar SOLO IPTV
  document.addEventListener('click', function(ev){
    const a = ev.target.closest('.wa-link, .tg-link');
    if (!a) return;
    // Sólo actuamos si es IPTV (por scope o por estar dentro de #iptv)
    if (!(a.dataset.scope === 'iptv' || a.closest('#iptv'))) return;

    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();

    const tr  = a.closest('tr');
    const msg = buildIptvMessage(tr);

    if (a.classList.contains('wa-link')) {
      const phone = a.getAttribute('data-phone') || a.getAttribute('href') || '';
      openWA(phone, msg);
    } else {
      openTG(msg);
    }
  }, true); // captura para que nadie aguas-arriba lo procese
})();













/* === IPTV: tagging + mensaje WA/TG exclusivo, sin depender de 'hasIptv' === */
(function(){
  'use strict';
  if (window.__iptvMsgBound) return;
  window.__iptvMsgBound = true;

  // ¿Un nodo parece pertenecer a IPTV?
  const isIptvRoot = el => !!el && (
    el.id === 'iptv' || el.id === 'iptv-root' ||
    el.dataset.page === 'iptv' || el.dataset.iptvRoot === '1' ||
    el.id === 'modalEditarIptv' || el.id === 'modalAgregarIptv' ||
    (el.matches && el.matches('form[action*="IptvController.php"]')) ||
    (el.closest && el.closest('form[action*="IptvController.php"]'))
  );

  // Etiqueta los links WA/TG que estén dentro de “algo que huela a IPTV”
  function markLinks(scope){
    const root = scope || document;
    const candidates = root.querySelectorAll(
      '#iptv, #iptv-root, [data-page="iptv"], [data-iptv-root], #modalEditarIptv, #modalAgregarIptv, form[action*="IptvController.php"]'
    );
    candidates.forEach(c => {
      const host = c.closest('.modal') || c;
      host.querySelectorAll('a.wa-link, a.tg-link').forEach(a => { a.dataset.iptv = '1'; });
    });
  }

  // Primera marcación + observar modales/DOM que aparezcan luego
  markLinks();
  const mo = new MutationObserver(muts => muts.forEach(m => {
    if ([...m.addedNodes].some(n => n.nodeType===1 && isIptvRoot(n))) markLinks();
  }));
  mo.observe(document.documentElement, {childList:true, subtree:true});

  // Click exclusivo para IPTV (captura + corta propagación)
  document.addEventListener('click', function(ev){
    const a = ev.target.closest('a.wa-link[data-iptv="1"], a.tg-link[data-iptv="1"]');
    if (!a) return;

    ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();

    const tr = a.closest('tr');
    const get = (sel, attr) => {
      if (!tr) return '';
      if (attr) return tr.getAttribute(attr) || '';
      const el = tr.querySelector(sel);
      return el ? el.textContent.trim() : '';
    };

    // Prefiere data-* si existen; si no, cae a celdas típicas
    const usuario  = tr?.dataset.usuario  || get('[data-usuario]') || get('td:nth-child(2)');
    const password = tr?.dataset.password || get('[data-password]') || get('td:nth-child(3)');
    const url      = tr?.dataset.url      || get('[data-url]');     // opcional

    const lines = [
      'Le hacemos la entrega de su IPTV',
      `Usuario: ${usuario || '-'}`,
      `Contraseña: ${password || '-'}`,
    ];
    if (url) lines.push(`URL: ${url}`);
    lines.push('Nota: no compartir su acceso, por favor.');
    const msg = lines.join('\n');

    const phone = (a.dataset.phone || '').replace(/\D+/g,'');
    const href = a.matches('.wa-link')
      ? (phone ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}` : a.href)
      : `https://t.me/share/url?url=&text=${encodeURIComponent(msg)}`;

    window.open(href, '_blank', 'noopener');
  }, true); // captura = true
})();
















// STREAMING (Perfiles/Cuenta): ignorar enlaces marcados como IPTV
document.addEventListener('click', function(ev){
  const a = ev.target.closest('a.wa-link:not([data-iptv="1"]), a.tg-link:not([data-iptv="1"])');
  if (!a) return;

  // Si por cualquier motivo el link vive bajo algo “tipo IPTV”, también ignorar
  if (a.closest('#iptv, #iptv-root, [data-page="iptv"], [data-iptv-root], #modalEditarIptv, #modalAgregarIptv, form[action*="IptvController.php"]')) {
    return;
  }

  // ... tu lógica actual para armar el mensaje de cuenta (Perfiles/Cuenta)
}, false);














(function () {
  (function () {
  const SAVE_URL   = (typeof BASE !== 'undefined' ? BASE : '') + 'ajax/iptv_save.php';
  const DELETE_URL = ''; // ya NO usamos esta constante


  function val(form,n){return (form.querySelector(`[name="${n}"]`)?.value||'').trim();}
  function checked(form,n){return !!form.querySelector(`[name="${n}"]`)?.checked;}
  function tipoActivo(){const a=document.querySelector('#iptvTabs .nav-link.active');return a&&a.id.includes('perfiles')?'perfil':'cuenta';}

  function swalOK(t,m){return window.Swal?.fire?Swal.fire({icon:'success',title:t,text:m}):(alert(t+'\n'+m),Promise.resolve());}
  function swalWarn(t,m){return window.Swal?.fire?Swal.fire({icon:'warning',title:t,text:m}):(alert(t+'\n'+m),Promise.resolve());}
  function swalErr(t,m){return window.Swal?.fire?Swal.fire({icon:'error',title:t,text:m}):(alert(t+'\n'+m),Promise.resolve());}

  function bindOnce(selector, handler){
    const f = document.querySelector(selector);
    if (!f || f.dataset.bound) return;
    f.dataset.bound = '1';
    f.addEventListener('submit', handler);
  }

  function disableSubmit(form, on){
    const btn = form.querySelector('button[type="submit"], .modal-footer .btn-primary');
    if (btn) btn.disabled = !!on;
    form.dataset.sending = on ? '1' : '';
  }

  function payloadBase(form){
    return {
      nombre: val(form,'nombre'),
      usuario: val(form,'usuario'),
      password_plain: val(form,'password_plain'),
      url: val(form,'url'),
      wa_cc: val(form,'wa_cc'),
      wa_local: val(form,'wa_local'),
      fecha_inicio: val(form,'fecha_inicio'),
      fecha_fin: val(form,'fecha_fin'),
      soles: val(form,'soles') || '0.00',
      estado: (val(form,'estado')==='pendiente')?'pendiente':'activo',
      combo: checked(form,'combo')?1:0
    };
  }

  async function doSave(form, data) {
  // Anti doble submit
  if (form.dataset.sending === '1') return;

  // Validación básica de IPTV
  if (!data.usuario || !data.password_plain || !data.url) {
    await swalWarn('Campos incompletos', 'Usuario, contraseña y URL son obligatorios.');
    return;
  }

  // 🔐 NUEVO: asegurar servicio_id ANTES de llamar al backend
  (function ensureServicioId() {
    let sid = 0;

    // 1) Si ya viene en data y es >0, lo respetamos
    if (data.servicio_id && !isNaN(Number(data.servicio_id))) {
      sid = Number(data.servicio_id);
    }

    // 2) Si sigue en 0, intentamos leerlo del input hidden del formulario
    if (!sid) {
      const hidden = form.querySelector('[name="servicio_id"]');
      if (hidden) {
        sid = parseInt(hidden.value || '0', 10) || 0;
      }
    }

    // 3) Si aún no hay, lo sacamos de la URL (?servicio_id=69 o ?id=69)
    if (!sid) {
      try {
        const qs = new URLSearchParams(window.location.search || '');
        sid = parseInt(qs.get('servicio_id') || qs.get('id') || '0', 10) || 0;
      } catch (e) {
        // ignorar
      }
    }

    if (sid > 0) {
      data.servicio_id = sid;
    }
  })();

  // Log para ver exactamente qué se está mandando
  console.log('IPTV doSave payload', data);

  // Si después de todo sigue sin servicio_id válido, ni siquiera llamamos al PHP
  if (!data.servicio_id || Number(data.servicio_id) <= 0) {
    await swalErr('Error', 'servicio_id es 0 o inválido antes de enviar.');
    return;
  }

  try {
    form.dataset.sending = '1';
    disableSubmit(form, true);

    const res = await fetch(SAVE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const js = await res.json().catch(() => ({}));
    if (!res.ok || !js.ok) {
      throw new Error(js.error || 'No se pudo guardar');
    }

    const modalEl = form.closest('.modal');
    if (modalEl) {
      bootstrap.Modal.getOrCreateInstance(modalEl).hide();
    }
    await swalOK(data.action === 'update' ? 'Actualizado' : 'Guardado', 'Operación exitosa.');
    location.reload();

  } catch (err) {
    console.error('save error', err);
    await swalErr('Error', err.message || 'No se pudo guardar');
  } finally {
    disableSubmit(form, false);
    form.dataset.sending = '';
  }
}


  // AGREGAR PERFIL
  bindOnce('#formAgregarPerfil', async (e)=>{
    e.preventDefault();
    const form=e.currentTarget;
    const data=Object.assign({action:'create',id:0,tipo:'perfil'}, payloadBase(form));
    await doSave(form,data);
  });

  // AGREGAR CUENTA
  bindOnce('#formAgregarCuenta', async (e)=>{
    e.preventDefault();
    const form=e.currentTarget;
    const data=Object.assign({action:'create',id:0,tipo:'cuenta'}, payloadBase(form));
    await doSave(form,data);
  });

  // EDITAR
  bindOnce('#formEditarIptv', async (e)=>{
    e.preventDefault();
    const form=e.currentTarget;
    const data=Object.assign({action:'update',
                              id: Number(val(form,'id'))||0,
                              tipo: (val(form,'tipo')==='perfil')?'perfil':'cuenta'
                             }, payloadBase(form));
    await doSave(form,data);
  });

  // Rellenar MODAL EDITAR desde data-row (sin duplicar handlers)
  document.addEventListener('click', function (ev) {
    const btn = ev.target.closest('[data-bs-target="#modalEditarIptv"]');
    if (!btn) return;
    let data={}; try{ data=JSON.parse(btn.getAttribute('data-row')||'{}'); }catch(_){}
    const f = document.querySelector('#formEditarIptv'); if (!f) return;
    const set=(n,v)=>{const el=f.querySelector(`[name="${n}"]`); if(!el) return; if(el.type==='checkbox') el.checked=!!v; else el.value=(v??'');};
    set('action','update'); set('id', data.id||0);
    const pane = btn.closest('.tab-pane'); const t=(pane?.dataset?.tipo)||tipoActivo();
    set('tipo', t==='perfil'?'perfil':'cuenta');
    set('nombre',data.nombre??''); set('usuario',data.usuario??''); set('password_plain',data.password_plain??'');
    set('url',data.url??''); set('fecha_inicio',(data.fecha_inicio&&data.fecha_inicio!=='0000-00-00')?data.fecha_inicio:'');
    set('fecha_fin',(data.fecha_fin&&data.fecha_fin!=='0000-00-00')?data.fecha_fin:'');
    set('soles',data.soles??'0.00'); set('estado',(data.estado==='pendiente')?'pendiente':'activo'); set('combo',Number(data.combo||0)===1);
    // WhatsApp → CC/local
    const raw=(data.whatsapp||'').toString().trim().replace(/\s+/g,'').replace(/(?!^)\+/g,'').replace(/[^\d\+]/g,'');
    const nums=(raw==='+'?'':raw).replace(/\D/g,''); let cc='',local=''; if(nums.length>9){cc=nums.slice(0,nums.length-9);local=nums.slice(-9);} else {local=nums;}
    set('wa_cc', cc?('+'+cc):''); set('wa_local', local?local.replace(/(\d{3})(?=\d)/g,'$1 ').trim():'');
  });

  
  // BORRAR (confirmación + AJAX)
  // BORRAR (confirmación + AJAX)
document.addEventListener('submit', async function (ev) {
  const form = ev.target.closest('.js-delete-form');
  if (!form) return;

  ev.preventDefault();

  const ok = window.Swal?.fire
    ? await Swal.fire({
        icon: 'warning',
        title: 'Confirmar',
        text: '¿Borrar este registro?',
        showCancelButton: true,
        confirmButtonText: 'Sí, borrar'
      }).then(r => r.isConfirmed)
    : confirm('¿Borrar este registro?');

  if (!ok) return;

  try {
    // 👉 Usamos SIEMPRE el action del formulario
    const url = form.getAttribute('action') || '';
    if (!url) throw new Error('No se encontró URL de borrado');

    const fd  = new FormData(form);
    const res = await fetch(url, { method: 'POST', body: fd });

    if (!res.ok) throw new Error('No se pudo borrar');

    let js = null;
    const ct = res.headers ? (res.headers.get('Content-Type') || '') : '';
    if (ct.indexOf('application/json') !== -1) {
      js = await res.json().catch(() => null);
    }
    if (js && js.ok === false) throw new Error(js.error || 'No se pudo borrar');

    if (window.swalOK) {
      await swalOK('Borrado', 'El registro fue eliminado.');
    } else if (window.Swal?.fire) {
      await Swal.fire({
        icon: 'success',
        title: 'Borrado',
        text: 'El registro fue eliminado.'
      });
    }

    location.reload();
  } catch (err) {
    if (window.swalErr) {
      await swalErr('Error', err.message || 'No se pudo borrar');
    } else if (window.Swal?.fire) {
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err.message || 'No se pudo borrar'
      });
    } else {
      alert(err.message || 'No se pudo borrar');
    }
  }
});

})();  // 🔚 IMPORTANTE: cierra el IIFE




















// Precio “de cabecera” → modal (readonly)
(function () {
  'use strict';

  function bindReadonlyPrice(modalSelector, headInputSelector, fieldSelector) {
    document.addEventListener('show.bs.modal', function (ev) {
      const modal = ev.target;
      if (!modal.matches(modalSelector)) return;

      const head = document.querySelector(headInputSelector);
      const field = modal.querySelector(fieldSelector);
      if (!field) return;

      const value = head && head.value !== '' ? head.value : '0.00';
      field.value = value;
      field.readOnly = true;
    });
  }

  // Perfil
  bindReadonlyPrice('#modalPerfilCreate', '#precioPerfilHead', 'input[name="soles"]');

  // Cuenta
  bindReadonlyPrice('#modalCuentaCreate', '#precioCuentaHead', 'input[name="soles"]');
})();











// Solo prefill desde cabecera cuando se abre desde el botón "Agregar perfil" (padre).
document.addEventListener('show.bs.modal', function (ev) {
  if (!ev.target.matches('#perfilModal')) return;

  const btn = ev.relatedTarget;
  const isAddPerfil = !!(btn && (btn.classList?.contains('btn-add-perfil') || (btn.matches && btn.matches('.btn-add-perfil'))));
  if (!isAddPerfil) return;

  const head  = document.querySelector('#precioPerfilHead');
  const field = ev.target.querySelector('input[name="soles"]');
  if (!field) return;

  if ((field.value == null || field.value === '') && head && head.value !== '') {
    field.value = head.value;
  }
  field.readOnly = false;
  field.removeAttribute('readonly');
}, true);










// Copiar precio de encabezado a modal de CUENTAS (readonly)
document.addEventListener('show.bs.modal', function (ev) {
  if (!ev.target.matches('#cuentaModal')) return;
  const head  = document.querySelector('#precioCuentaHead');
  const field = ev.target.querySelector('input[name="soles"]');
  if (!field) return;
  field.value = head && head.value !== '' ? head.value : '0.00';
  field.readOnly = true;
});
















// public/assets/js/app.js
// === Bandera "modo hijo" para modal de Perfiles + permitir escritura del usuario en "soles" ===
(function () {
  var perfilModal = null;
  var inputPerfil = null;
  var inputSoles  = null;

  var __origValueDesc = null; // descriptor original del getter/setter
  var __wrapped = false;
  var __allowUserSet = false; // se activa mientras el usuario interactúa con el campo
  var __userSetOnce  = false; // el usuario ya escribió manualmente un valor

  function setChildMode(enabled) {
    if (!perfilModal) return;
    try { perfilModal.dataset.childMode = enabled ? '1' : '0'; } catch (_) {}
  }
  function isChildMode() {
    return !!(perfilModal && perfilModal.dataset && perfilModal.dataset.childMode === '1');
  }
  function isPerfilModal(modalEl) {
    if (!modalEl) return false;
    var form = modalEl.querySelector('form[action*="PerfilController.php"]');
    return !!form;
  }

  // Solo limpiar si: estamos en modo hijo y el usuario NO escribió manualmente
  function clearSolesIfChild() {
    if (!inputSoles) return;
    if (isChildMode() && !__userSetOnce) {
      if (inputSoles.value !== '') inputSoles.value = '';
    }
  }

  // Permite escritura del usuario: elevamos una bandera justo antes de que el navegador cambie el value
  function armUserWriteGuards(el) {
    if (!el) return;
    var allow = function(){ __allowUserSet = true; };
    var disallowSoon = function(){ setTimeout(function(){ __allowUserSet = false; }, 0); };

    // El navegador dispara "beforeinput" antes de aplicar el cambio al value
    el.addEventListener('beforeinput', allow, true);
    // Tras aplicar el cambio, bajamos la bandera y marcamos que el usuario escribió
    el.addEventListener('input', function(){
      __userSetOnce = true;
      disallowSoon();
    }, true);

    // Backups por si algún navegador no emite beforeinput
    el.addEventListener('keydown', allow, true);
    el.addEventListener('pointerdown', allow, true);
    el.addEventListener('touchstart', allow, true);
    el.addEventListener('keyup', disallowSoon, true);
    el.addEventListener('pointerup', disallowSoon, true);
    el.addEventListener('touchend', disallowSoon, true);
    el.addEventListener('change', function(){ __userSetOnce = true; }, true);
  }

  // Envolver el setter "value" del input "soles" para bloquear solo asignaciones programáticas en modo hijo
  function wrapSolesValueSetter() {
    if (!inputSoles || __wrapped) return;
    try {
      var proto = Object.getPrototypeOf(inputSoles);
      __origValueDesc = Object.getOwnPropertyDescriptor(proto, 'value');
      if (!__origValueDesc || typeof __origValueDesc.set !== 'function') return;

      Object.defineProperty(inputSoles, 'value', {
        configurable: true,
        enumerable: __origValueDesc.enumerable,
        get: function () { return __origValueDesc.get.call(this); },
        set: function (v) {
          // Si el usuario está escribiendo, respetamos su input SIEMPRE
          if (__allowUserSet) {
            __origValueDesc.set.call(this, v);
            __userSetOnce = true; // cuenta como escritura manual
            return;
          }
          // Si NO es escritura del usuario y estamos en modo hijo, anulamos sets programáticos
          if (isChildMode()) {
            // Solo limpiar automáticamente si el usuario no puso precio aún
            __origValueDesc.set.call(this, __userSetOnce ? this.value : '');
            return;
          }
          // Fuera de modo hijo, se comporta normal
          __origValueDesc.set.call(this, v);
        }
      });

      __wrapped = true;
      armUserWriteGuards(inputSoles);
    } catch (_) {}
  }

  // Restaurar el comportamiento original al cerrar el modal
  function unwrapSolesValueSetter() {
    if (!inputSoles || !__wrapped) return;
    try { delete inputSoles.value; } catch (_) {}
    __wrapped = false;
    __origValueDesc = null;
    __allowUserSet = false;
    __userSetOnce  = false;
  }

  function onPerfilInput(e) {
    var val = (e && e.target && typeof e.target.value === 'string') ? e.target.value.trim() : '';
    setChildMode(val.length > 0);
    // Si se activó modo hijo, solo limpiamos si el usuario AÚN no puso precio
    setTimeout(clearSolesIfChild, 0);
  }

  // Apertura del modal de Perfiles
  document.addEventListener('show.bs.modal', function (ev) {
    var m = ev.target;
    if (!isPerfilModal(m)) return;

    perfilModal = m;
    inputPerfil = m.querySelector('input[name="perfil"]');
    inputSoles  = m.querySelector('input[name="soles"]');

    // Estado inicial de modo hijo
    var hasPerfil = !!(inputPerfil && inputPerfil.value && inputPerfil.value.trim() !== '');
    setChildMode(hasPerfil);

    // Envolver setter del value SOLAMENTE para este input y mientras el modal está activo
    wrapSolesValueSetter();

    // Si ya abre como hijo y el usuario aún no escribió, limpiar
    clearSolesIfChild();

    if (inputPerfil) {
      inputPerfil.removeEventListener('input', onPerfilInput, false);
      inputPerfil.addEventListener('input', onPerfilInput, false);
      inputPerfil.addEventListener('change', onPerfilInput, false);
      inputPerfil.addEventListener('keyup', onPerfilInput, false);
    }
  }, true);

  // Una pasada extra tras mostrar, por si hay autocompletados tardíos
  document.addEventListener('shown.bs.modal', function (ev) {
    var m = ev.target;
    if (!isPerfilModal(m)) return;
    setTimeout(clearSolesIfChild, 0);
  }, true);

  // Cierre: restaurar todo
  document.addEventListener('hide.bs.modal', function (ev) {
    var m = ev.target;
    if (!isPerfilModal(m)) return;
    unwrapSolesValueSetter();
    perfilModal = null;
    inputPerfil = null;
    inputSoles  = null;
  }, true);
})();






















// /public/assets/js/app.js
// === Modal Perfiles: el precio por defecto SOLO se aplica para PADRE; no bloquear ni sobreescribir cuando escribes "perfil" o "precio" ===
(function () {
  function isPerfilModal(modalEl){
    if(!modalEl) return false;
    return !!modalEl.querySelector('form[action*="PerfilController.php"]');
  }
  function qToolbarDefault(){
    // Primer match que exista (no cambiamos nada del DOM actual)
    return document.querySelector('#precioDefault, #defaultSoles, #precio, .js-default-soles, [data-role="default-soles"]');
  }
  function getInputs(m){
    return {
      perfil: m.querySelector('input[name="perfil"]'),
      soles:  m.querySelector('input[name="soles"]'),
      plan:   m.querySelector('[name="plan"]')
    };
  }
  function isChild(perfilEl){
    return !!(perfilEl && perfilEl.value && perfilEl.value.trim() !== '');
  }
  function ensureEditable(input){
    if (!input) return;
    try { input.readOnly = false; input.removeAttribute('readonly'); } catch(_){}
  }

  document.addEventListener('show.bs.modal', function(ev){
    var m = ev.target;
    if(!isPerfilModal(m)) return;

    var I = getInputs(m);
    if (!I.soles) return;

    // Tomar default del atributo o de la casilla “precio” junto a “Agregar Perfil” (si existe)
    var def = I.soles.getAttribute('data-default-soles') || '';
    if (!def) {
      var tb = qToolbarDefault();
      if (tb && typeof tb.value === 'string') def = tb.value.trim();
    }
    I.soles.dataset.defaultSoles = def;

    // Estado inicial
    ensureEditable(I.soles);
    delete I.soles.dataset.userTyped;
    delete I.soles.dataset.auto;
    var childNow = isChild(I.perfil);

    if (!childNow) {
      // PADRE: si no hay valor, aplica default si existe
      if (I.soles.value === '' && def !== '') {
        I.soles.value = def;
        I.soles.dataset.auto = '1';
      }
    } else {
      // HIJO: no autocompletar; limpiar solo si no lo escribió el usuario antes
      if (!I.soles.dataset.userTyped) {
        I.soles.value = '';
      }
    }

    // Cuando escribes en PERFIL (cambiar entre padre/hijo)
    var onPerfilChange = function(){
      ensureEditable(I.soles);
      var c = isChild(I.perfil);
      if (c) {
        // Modo hijo: NO auto-rellenar; si el valor fue autocompletado, limpiar
        if (I.soles.dataset.auto === '1' && !I.soles.dataset.userTyped) {
          I.soles.value = '';
          delete I.soles.dataset.auto;
        }
      } else {
        // Volvió a padre: si usuario no escribió y no hay valor, aplicar default
        if (!I.soles.dataset.userTyped && I.soles.value === '' && I.soles.dataset.defaultSoles) {
          I.soles.value = I.soles.dataset.defaultSoles;
          I.soles.dataset.auto = '1';
        }
      }
    };
    ['input','change','keyup'].forEach(function(evt){
      if (I.perfil) I.perfil.addEventListener(evt, onPerfilChange, true);
    });

    // Cuando el usuario escribe PRECIO, respetar y marcar como manual
    ['beforeinput','input','change','keydown','keyup','paste'].forEach(function(evt){
      I.soles.addEventListener(evt, function(){
        ensureEditable(I.soles);
        I.soles.dataset.userTyped = '1';
        delete I.soles.dataset.auto;
      }, true);
    });

    // Cambio de plan: NO tocar el precio si es hijo o si el usuario ya escribió
    if (I.plan) {
      I.plan.addEventListener('change', function(){
        ensureEditable(I.soles);
        if (isChild(I.perfil) || I.soles.dataset.userTyped) {
          // Ignorar cualquier autocompletado por plan en estos casos
          return;
        }
        // Si es padre y no hay valor manual, se permite que otro script ponga el default;
        // si no lo hace, mantenemos lo actual.
      }, true);
    }
  }, true);

  // Tras mostrar, asegurar que nadie dejó readonly ni reinyectó el precio del padre
  document.addEventListener('shown.bs.modal', function(ev){
    var m = ev.target;
    if(!isPerfilModal(m)) return;
    var I = getInputs(m);
    ensureEditable(I.soles);
    // Si está en modo hijo y el valor fue autocompletado, limpiarlo una vez más (sin tocar lo que haya escrito el usuario)
    if (isChild(I.perfil) && I.soles && I.soles.dataset && I.soles.dataset.auto === '1' && !I.soles.dataset.userTyped) {
      I.soles.value = '';
      delete I.soles.dataset.auto;
    }
  }, true);
})();






























// /public/assets/js/app.js
// === Guard precio (Perfiles): no borrar ni bloquear al escribir "perfil"; default SOLO para padre ===
(function () {
  function isPerfilModal(m){ return !!(m && m.querySelector('form[action*="PerfilController.php"]')); }
  function getInputs(m){
    return {
      perfil: m.querySelector('input[name="perfil"]'),
      soles:  m.querySelector('input[name="soles"]'),
      plan:   m.querySelector('[name="plan"]')
    };
  }
  function isChild(perfilEl){ return !!(perfilEl && perfilEl.value && perfilEl.value.trim() !== ''); }

  // Lee el default de la “casilla de precio” junto al botón Agregar Perfil (si existe)
  function readToolbarDefault(){
    const el = document.querySelector(
      '#precioDefault, #defaultSoles, #precio, .js-default-soles, [data-role="default-soles"], input[name="precio_default"]'
    );
    return el && typeof el.value === 'string' ? el.value.trim() : '';
  }

  function ensureEditable(input){
    if (!input) return;
    try { input.readOnly = false; input.removeAttribute('readonly'); } catch(_){}
  }

  // public/assets/js/app.js
// [REEMPLAZO COMPLETO DE FUNCIÓN] — endurecer guardia del precio para Perfiles
// Qué buscar (exacto):  "function startGuardLoop(m){"  y reemplazar TODO el cuerpo de la función hasta su "return loop;" y cierre "}"
// Pega este bloque completo en su lugar:

  // public/assets/js/app.js — REEMPLAZAR FUNCIÓN COMPLETA startGuardLoop(m)
function startGuardLoop(m){
  const {perfil, soles} = getInputs(m);
  if (!soles) return null;

  // Defaults pasivos (solo si el campo está vacío)
  const defFromAttr = soles.getAttribute('data-default-soles') || '';
  const defToolbar  = readToolbarDefault();
  const DEF = defFromAttr || defToolbar || '';

  // Estado de usuario
  soles.dataset.userTyped = soles.dataset.userTyped || ''; // '' | '1'
  let lastUserPrice = (soles.dataset.userTyped === '1') ? (soles.value || '') : '';

  // Marcar escritura manual + memorizar último valor válido del usuario
  const markUserTyped = function() {
    ensureEditable(soles);
    soles.dataset.userTyped = '1';
    lastUserPrice = soles.value || '';
  };
  ['beforeinput','input','change','keydown','keyup','paste','blur'].forEach(function(evt){
    soles.addEventListener(evt, markUserTyped, true);
  });

  // Si se tipea en PERFIL y otro script cambia el precio, vuelve al valor del usuario
  if (perfil) {
    ['input','change','keyup'].forEach(function(evt){
      perfil.addEventListener(evt, function(){
        ensureEditable(soles);
        if (soles.dataset.userTyped === '1' && soles.value !== lastUserPrice) {
          soles.value = lastUserPrice;
        }
      }, true);
    });
  }

  // Bucle que protege contra reinyectores (cada ~80ms)
  const loop = setInterval(function(){
    ensureEditable(soles);

    // Si el usuario YA escribió, revertir cualquier cambio externo
    if (soles.dataset.userTyped === '1') {
      if (soles.value !== lastUserPrice) {
        soles.value = lastUserPrice;
      }
      return;
    }

    // Si es HIJO y el usuario aún no escribió: no imponer anclas ni valores “forzados”
    const child = isChild(perfil);
    if (child) {
      return;
    }

    // PADRE sin valor: aplicar default una sola vez si existe
    if (soles.value === '' && DEF !== '') {
      soles.value = DEF;
    }
  }, 80);

  return loop;
}



 // public/assets/js/app.js
// [AÑADIDO PEQUEÑO] — refuerzo inmediato cuando el modal se muestra
// Qué buscar: el listener existente de 'shown.bs.modal' del modal de Perfiles.
// Justo DESPUÉS de iniciar el guard (startGuardLoop), añade este bloque:

  document.addEventListener('shown.bs.modal', function(ev){
    const m = ev.target;
    if (!isPerfilModal(m)) return;
    // Asegurar que el precio está editable y no se toquetea en la apertura
    const {soles} = getInputs(m);
    if (soles) { try { soles.readOnly = false; soles.removeAttribute('readonly'); } catch(_){} }
  }, true);


  document.addEventListener('shown.bs.modal', function(ev){
    const m = ev.target;
    if (!isPerfilModal(m)) return;
    // iniciar guard y guardar id para limpiarlo después
    const id = startGuardLoop(m);
    if (id) m.dataset.priceGuardId = String(id);
  }, true);

  document.addEventListener('hide.bs.modal', function(ev){
    const m = ev.target;
    if (!isPerfilModal(m)) return;
    const id = m.dataset.priceGuardId ? parseInt(m.dataset.priceGuardId,10) : 0;
    if (id) { try { clearInterval(id); } catch(_) {} }
    delete m.dataset.priceGuardId;
  }, true);
})();




























// public/assets/js/app.js
// --- BLOQUE A AGREGAR (al final del archivo o tras las utilidades de modales) ---
// Objetivo: (1) Prefill NO intrusivo del precio en CUENTAS desde #precioCuentaHead
//           (2) Evitar readonly y cualquier "guard" de Perfiles aplicado por colisión de ID
(function cuentaModalPriceAndReadonlyFix(){
  try {
    var cuentaModal = document.getElementById('cuentaModal');
    if (!cuentaModal) return;

    // Asegurar que, al mostrar el modal de CUENTA, los campos sigan editables
    cuentaModal.addEventListener('show.bs.modal', function(){
      try {
        // Si existe precio global de cabecera para CUENTAS, usarlo como valor inicial (sin bloquear)
        var head = document.getElementById('precioCuentaHead');
        var priceInput = cuentaModal.querySelector('input[name="soles"]');
        if (priceInput) {
          var v = (head && head.value !== '') ? head.value : '';
          if (v !== '') priceInput.value = v;
          priceInput.readOnly = false; // nunca bloquear en CUENTA
        }

        // Desbloquear explícitamente campos que alguna lógica legacy pudo marcar
        ['correo','password_plain','soles'].forEach(function(n){
          var el = cuentaModal.querySelector('input[name="'+n+'"]');
          if (el) el.readOnly = false;
        });
      } catch(_){}
    }, { capture:true });

    // En "shown", refuerza la edición por si otro listener tardío tocó el readonly
    cuentaModal.addEventListener('shown.bs.modal', function(){
      try {
        ['correo','password_plain','soles'].forEach(function(n){
          var el = cuentaModal.querySelector('input[name="'+n+'"]');
          if (el) el.readOnly = false;
        });
      } catch(_){}
    }, { capture:true });

  } catch(_){}
})();














(function presetPrecioFromHeadForPerfil(){
  try {
    var modal = document.getElementById('perfilModal');
    if (!modal) return;
    if (modal.dataset.presetFromHead === '1') return;
    modal.dataset.presetFromHead = '1';

    // SOLO cuando se abre desde el botón "Agregar perfil" (padre)
    modal.addEventListener('show.bs.modal', function(ev){
      try {
        // Si es edición, no tocar
        var idField = modal.querySelector('input[name="id"]');
        var isEdit  = !!(idField && idField.value && idField.value !== '');
        if (isEdit) return;

        // Verificar disparador .btn-add-perfil
        var btn = ev.relatedTarget;
        var isAddPerfil = !!(btn && (btn.classList && btn.classList.contains('btn-add-perfil') || (btn.matches && btn.matches('.btn-add-perfil'))));
        if (!isAddPerfil) return;

        var soles = modal.querySelector('input[name="soles"]');
        if (!soles) return;

        // Tomar default desde cabecera si está vacío
        var head = document.getElementById('precioPerfilHead');
        var headVal = (head && head.value !== '') ? head.value : '';
        if (headVal !== '' && (soles.value == null || soles.value === '')) {
          soles.value = headVal;
        }

        // Siempre editable
        try { soles.readOnly = false; soles.removeAttribute('readonly'); } catch(_) {}
      } catch (_){}
    }, { capture: true });
  } catch (_){}
})();














// Forzar que en el flujo hijo (Agregar a correo) NO haya precio por defecto y sea editable
document.addEventListener('show.bs.modal', function (ev) {
  if (!ev.target || !ev.target.matches || !ev.target.matches('#perfilModal')) return;

  var btn = ev.relatedTarget;
  var isAddPerfil = !!(btn && ( (btn.classList && btn.classList.contains('btn-add-perfil')) || (btn.matches && btn.matches('.btn-add-perfil')) ));
  if (isAddPerfil) return; // solo afecta hijos u otras aperturas programáticas

  var modal  = ev.target;
  var idFld  = modal.querySelector('input[name="id"]');
  var isEdit = !!(idFld && idFld.value && idFld.value !== '');
  if (isEdit) return; // en edición no tocamos

  var soles = modal.querySelector('input[name="soles"]');
  if (!soles) return;

  // Vaciar y habilitar: sin default, sin readonly, sin 0.00 preinyectado
  soles.value = '';
  try { soles.readOnly = false; soles.removeAttribute('readonly'); } catch (_) {}
}, true);


















// [public/assets/js/app.js]
// Hook de modo parent/child para #perfilModal
(function attachPerfilModalMode(){
  try {
    var modal = document.getElementById('perfilModal');
    if (!modal) return;
    if (modal.dataset.modeHook === '1') return;
    modal.dataset.modeHook = '1';

    modal.addEventListener('show.bs.modal', function(ev){
      var trigger = ev.relatedTarget || null;
      var isParent = !!(trigger && ((trigger.classList && trigger.classList.contains('btn-add-perfil')) || (trigger.matches && trigger.matches('.btn-add-perfil'))));
      modal.dataset.openMode = isParent ? 'parent' : 'child';
    }, true);

    modal.addEventListener('hidden.bs.modal', function(){
      delete modal.dataset.openMode;
    }, true);
  } catch(_){}
})();































// [public/assets/js/app.js]
// Evitar que tipeo en 'perfil' limpie el precio en modo padre
(function protectPrecioOnPerfilTyping(){
  try {
    var modal = document.getElementById('perfilModal');
    if (!modal) return;
    if (modal.dataset.perfilTypingGuard === '1') return;
    modal.dataset.perfilTypingGuard = '1';

    var perfilInput = modal.querySelector('input[name="perfil"]');
    if (!perfilInput) return;

    perfilInput.addEventListener('input', function(){
      if (!modal || !modal.dataset) return;
      if (modal.dataset.openMode === 'parent') {
        var precio = modal.querySelector('input[name="soles"]');
        if (!precio) return;
        try { precio.readOnly = false; precio.removeAttribute('readonly'); } catch(_){}
        // No limpiamos ni reinyectamos valor aquí: solo impedimos que otro listener lo ponga readonly/vacío.
      }
    }, true);
  } catch(_){}
})();

















// [public/assets/js/perfiles_cuentas_filters.js]
// Requiere que app.js haya seteado modal.dataset.openMode = 'parent'|'child'
function isChildModal(modal){
  return (modal && modal.dataset && modal.dataset.openMode === 'child');
}

// Úsalo dentro de tu refresh()/applyToCreateModal(modal) o en el handler de input de 'perfil'
(function(){
  var modal  = document.getElementById('perfilModal');
  if (!modal) return;
  var precio = modal.querySelector('input[name="soles"]');
  if (!precio) return;

  if (isChildModal(modal)) {
    // HIJO: no imponer defaults ni limpiar lo escrito
    try { precio.readOnly = false; precio.removeAttribute('readonly'); } catch(_){}
    // No tocar precio.value; si está vacío, se queda vacío; si el usuario escribió, se respeta
    return;
  } else {
    // PADRE: no limpiar precio al tipear en 'perfil'; respetar prefill inicial o lo escrito
    try { precio.readOnly = false; precio.removeAttribute('readonly'); } catch(_){}
    // No reasignar precio.value aquí
  }
})();






















// === PRECIO: header -> modal SOLO cuando se abre desde "Agregar perfil" (PADRE) ===
(function (){
  try {
    var modal = document.getElementById('perfilModal');        // el ÚNICO modal
    var head  = document.getElementById('precioPerfilHead');   // casilla de cabecera
    if (!modal || !head) return;

    // 1) Marcamos "PADRE" solo cuando el click viene del botón Agregar
    document.addEventListener('click', function(e){
      var t = e.target;
      var isAddBtn = !!(t && (t.classList?.contains('btn-add-perfil') || t.matches?.('.btn-add-perfil')));
      if (isAddBtn) {
        modal.dataset._openMode = 'parent';
        modal.dataset._lastHead = head.value || '';
      }
    }, true);

    // 2) En cualquier otro caso lo tratamos como HIJO (apertura programática o desde filas)
    modal.addEventListener('show.bs.modal', function(){
    var ev = ev; if (ev && ev.target && ev.target.id === 'perfilModal') return;
      if (modal.dataset._openMode !== 'parent') modal.dataset._openMode = 'child';
      var price = modal.querySelector('input[name="soles"]');
      if (price) { price.dataset._userTyped = '0'; }
    }, true);

    // 3) Prefill tardío (tras otros listeners): SOLO padre
    modal.addEventListener('shown.bs.modal', function(){
    var ev = ev; if (ev && ev.target && ev.target.id === 'perfilModal') return;
      if (modal.dataset._openMode !== 'parent') return;
      var price = modal.querySelector('input[name="soles"]');
      if (!price) return;

      // prefill solo una vez si está vacío
      if (!price.value && (head.value || modal.dataset._lastHead)) {
        price.value = head.value || modal.dataset._lastHead || '';
      }
      price.readOnly = false; price.removeAttribute('readonly');
      modal.dataset._lastPrice = price.value || '';
    }, true);

    // 4) Si escriben en el campo precio, dejamos de sincronizar
    modal.addEventListener('input', function(ev){
      if (ev.target && ev.target.name === 'soles') {
        ev.target.dataset._userTyped = '1';
        modal.dataset._lastPrice = ev.target.value || '';
      }
    }, true);

    // 5) Mientras el modal PADRE esté abierto y el usuario NO tocó precio, sincroniza head -> price
    head.addEventListener('input', function(){
      if (!modal.classList.contains('show')) return;
      if (modal.dataset._openMode !== 'parent') return;
      var price = modal.querySelector('input[name="soles"]');
      if (!price || price.dataset._userTyped === '1') return;
      price.value = head.value;
      modal.dataset._lastPrice = price.value || '';
      price.readOnly = false; price.removeAttribute('readonly');
    }, { passive:true });

    // 6) Si al tipear en "perfil" (PADRE) otro script borrara el precio, lo reponemos
    modal.addEventListener('input', function(ev){
      if (ev.target && ev.target.name === 'perfil' && modal.dataset._openMode === 'parent') {
        // dejamos que otros listeners corran y luego verificamos
        setTimeout(function(){
          var price = modal.querySelector('input[name="soles"]');
          if (!price) return;
          if (price.dataset._userTyped === '1') return;   // si el usuario ya tocó, respetamos
          if (!price.value) {                              // si quedó vacío, restauramos
            price.value = modal.dataset._lastPrice || head.value || '';
            price.readOnly = false; price.removeAttribute('readonly');
          }
        }, 0);
      }
    }, true);

    // 7) Limpieza al cerrar
    modal.addEventListener('hidden.bs.modal', function(){
    var ev = ev; if (ev && ev.target && ev.target.id === 'perfilModal') return;
      delete modal.dataset._openMode;
      delete modal.dataset._lastHead;
      delete modal.dataset._lastPrice;
    }, true);

  } catch (e) {
    console.error('[precio-perfil minimal patch]', e);
  }
})();












// === BLOQUEAR PRECIO EN MODAL (solo cuando se abre con "Agregar perfil") ===
// Pega esto al final de public/assets/js/app.js
(function lockParentPrice(){
  try {
    var modal = document.getElementById('perfilModal');
    var head  = document.getElementById('precioPerfilHead');
    if (!modal || !head) return;
    /* patched: disable lockParentPrice to avoid readonly bleed */ return; if (window.__pfLockBound) return; window.__pfLockBound = true;

    function getPrice(){ return modal.querySelector('input[name="soles"]'); }

    // Marcar apertura como PADRE al click del botón "Agregar perfil"
    document.addEventListener('click', function(e){
      var t = e.target;
      if (!t) return;
      if (t.matches && t.matches('.btn-add-perfil')) {
        modal.dataset._mode = 'parent';
        modal.dataset._lockVal = head.value || '';
      }
    }, true);

    // En otras aperturas, es HIJO
    modal.addEventListener('show.bs.modal', function(){
    var ev = ev; if (ev && ev.target && ev.target.id === 'perfilModal') return;
      if (modal.dataset._mode !== 'parent') modal.dataset._mode = 'child';
    }, true);

    // Al mostrar: en PADRE fijar precio, poner readonly y bloquear cambios externos
    modal.addEventListener('shown.bs.modal', function(){
    var ev = ev; if (ev && ev.target && ev.target.id === 'perfilModal') return;
      var price = getPrice(); if (!price) return;

      if (modal.dataset._mode === 'parent') {
        // valor a bloquear
        var v = modal.dataset._lockVal || head.value || price.value || '';
        modal.dataset._lockVal = v;

        // set y bloquear
        price.value = v;
        price.readOnly = true;
        price.setAttribute('readonly','readonly');
        price.classList.add('bg-light');

        // impedir que otros listeners borren el precio (si llegan a tocar el campo)
        price.addEventListener('input', function(ev){
          // restaurar inmediatamente y cortar propagación
          ev.stopImmediatePropagation();
          price.value = modal.dataset._lockVal || '';
        }, true);

      } else {
        // HIJO: no bloquear
        price.readOnly = false;
        price.removeAttribute('readonly');
        price.classList.remove('bg-light');
      }
    }, true);

    // Si escriben en PERFIL en modo PADRE, reponemos el precio si alguien lo borra por código
    modal.addEventListener('input', function(ev){
      if (modal.dataset._mode !== 'parent') return;
      if (!ev.target || ev.target.name !== 'perfil') return;
      var price = getPrice(); if (!price) return;
      // microtarea para ir después de otros handlers
      Promise.resolve().then(function(){
        if (price.value !== (modal.dataset._lockVal || '')) {
          price.value = modal.dataset._lockVal || '';
          price.readOnly = true;
          price.setAttribute('readonly','readonly');
        }
      });
    }, true);

    // Si cambian la cabecera con el modal PADRE abierto, actualizar bloqueo
    head.addEventListener('input', function(){
      if (!modal.classList.contains('show')) return;
      if (modal.dataset._mode !== 'parent') return;
      var price = getPrice(); if (!price) return;
      modal.dataset._lockVal = head.value || '';
      price.value = modal.dataset._lockVal;
      price.readOnly = true;
      price.setAttribute('readonly','readonly');
    }, {passive:true});

    // Limpieza al cerrar
    modal.addEventListener('hidden.bs.modal', function(){
    var ev = ev; if (ev && ev.target && ev.target.id === 'perfilModal') return;
      delete modal.dataset._mode;
      delete modal.dataset._lockVal;
      var price = getPrice(); if (price){
        price.readOnly = false;
        price.removeAttribute('readonly');
        price.classList.remove('bg-light');
      }
    }, true);
  } catch(e){}
})();













// === Precio en PADRE/HIJO: sanea el DOM y monta el input correcto ===
(function(){
  try {
    var modal = document.getElementById('perfilModal');
    
    // neutralized for perfilModal
    return;var head  = document.getElementById('precioPerfilHead');
    if (!modal || !head) return;
    if (window.__pfPriceSwapBound) return; window.__pfPriceSwapBound = true;

    // Helpers
    function qForm(){ return modal.querySelector('form') || modal; }
    function qSlot(form){ return form.querySelector('#childPriceSlot'); }
    function rebuildSlot(form){
      // reconstruye el bloque de precio siempre limpio
      var group = form.querySelector('#childPriceGroup');
      if (!group) return null;
      var labelHTML = group.querySelector('label')?.outerHTML || '<label class="form-label">Precio (S/)</label>';
      group.innerHTML = labelHTML + '<div id="childPriceSlot" data-price-slot></div>';
      return group.querySelector('#childPriceSlot');
    }
    function purgeForeignSoles(form, keep){
      // borra todo name="soles" salvo el que indiquemos
      form.querySelectorAll('input[name="soles"]').forEach(function(inp){
        if (!keep || inp !== keep) inp.remove();
      });
      // borra residuos conocidos
      form.querySelectorAll('#modalChildPrecio, #modalChildPrecio_display, [data-price-mount]').forEach(function(n){ n.remove(); });
      // también borra un posible hidden inyectado al final del form
      // (por si otro script lo pone fuera del slot)
      var tailHidden = form.querySelector(':scope > input[name="soles"]');
      if (tailHidden && (!keep || tailHidden !== keep)) tailHidden.remove();
    }

    // Marca aperturas desde el botón "Agregar perfil" como PADRE
    document.addEventListener('click', function(e){
      var t = e.target;
      if (t && (t.classList?.contains('btn-add-perfil') || t.matches?.('.btn-add-perfil'))) {
        modal.dataset._mode = 'parent';
        modal.dataset._headSnapshot = head.value || '';
      }
    }, true);

    // Cualquier otra apertura => HIJO
    modal.addEventListener('show.bs.modal', function(){
      if (modal.dataset._mode !== 'parent') modal.dataset._mode = 'child';
    }, true);

    // Montaje cuando el modal ya está visible
    modal.addEventListener('shown.bs.modal', function(){
      var mode = modal.dataset._mode || 'child';
      var form = qForm();
      if (!form) return;

      // 1) Slot limpio SIEMPRE
      var slot = rebuildSlot(form);
      if (!slot) return;

      // 2) Limpia cualquier "soles" fuera del slot
      purgeForeignSoles(form, null);

      if (mode === 'parent') {
        // ===== PADRE: bloqueado al valor de cabecera =====
        var lockVal = head.value || modal.dataset._headSnapshot || '';
        modal.dataset._lockVal = lockVal;

        // Visible readonly (sin name)
        var clone = document.createElement('input');
        clone.type = 'text';
        clone.readOnly = true;
        clone.setAttribute('readonly','readonly');
        clone.className = 'form-control bg-light';
        clone.id = 'modalPrecio_display';
        clone.value = lockVal;
        slot.appendChild(clone);
        modal.__priceClone = clone;

        // Hidden para enviar
        var hidden = document.createElement('input');
        hidden.type  = 'hidden';
        hidden.name  = 'soles';
        hidden.value = lockVal;
        slot.appendChild(hidden); // lo dejamos dentro del slot
        modal.__priceHidden = hidden;

        // Si cambia la cabecera con el modal abierto, sincroniza
        function syncFromHead(){
          if (!modal.classList.contains('show')) return;
          if (modal.dataset._mode !== 'parent') return;
          var v = head.value || '';
          modal.dataset._lockVal = v;
          if (modal.__priceClone)  modal.__priceClone.value  = v;
          if (modal.__priceHidden) modal.__priceHidden.value = v;
        }
        if (!modal.__headSyncBound) {
          head.addEventListener('input', syncFromHead, {passive:true});
          modal.__headSyncBound = true;
        }

      } else {
        // ===== HIJO: primer hijo editable =====
        var pr = document.createElement('input');
        pr.type = 'number';
        pr.step = '0.01';
        pr.min  = '0';
        pr.name = 'soles';
        pr.id   = 'modalChildPrecio';
        pr.className = 'form-control';
        pr.autocomplete = 'off';
        slot.appendChild(pr);

        // Asegura que no quede ningún hidden extra del servidor
        purgeForeignSoles(form, pr);
      }
    }, true);

    // Limpieza al cerrar
    modal.addEventListener('hidden.bs.modal', function(){
    var ev = ev; if (ev && ev.target && ev.target.id === 'perfilModal') return;
      var form = qForm();
      if (!form) return;
      // limpiar referencias internas y dataset
      if (modal.__priceClone)  { modal.__priceClone.remove();  modal.__priceClone  = null; }
      if (modal.__priceHidden) { modal.__priceHidden.remove(); modal.__priceHidden = null; }
      delete modal.dataset._mode;
      delete modal.dataset._headSnapshot;
      delete modal.dataset._lockVal;
      // re-sanea el slot para futuras aperturas
      rebuildSlot(form);
      purgeForeignSoles(form, null);
    }, true);

  } catch(e) {
    console.error('[pf price swap]', e);
  }
})();


























// === Precio ancla para HIJOS (primer hijo fija, siguientes bloqueados) ===
(function(){
  try {
    var modal = document.getElementById('perfilModal');
    if (!modal) return;
    if (window.__pfChildAnchorBound) return; window.__pfChildAnchorBound = true;

    // Helpers
    function qPrice() { return modal.querySelector('input[name="soles"]'); }
    function parseNum(s){
      if (s == null) return NaN;
      var n = String(s).replace(/[^\d.,-]/g,'').replace(',', '.');
      var f = parseFloat(n);
      return isNaN(f) ? NaN : f;
    }

    // 1) Cuando clicas una FILA PADRE, guardamos el row y su precio ancla (si viene en data-* o lo calculamos)
    document.addEventListener('click', function(e){
      var row = e.target && e.target.closest && e.target.closest('tr.js-parent-row');
      if (!row) return;

      modal.dataset._mode = 'child';
      modal.__anchorRow   = row;

      // si el backend nos lo da:
      var fromData = row.getAttribute('data-anchor-price') || '';
      if (fromData) { modal.dataset._anchor = fromData; return; }

      // plan B: calcularlo mirando el PRIMER hijo existente (siguiente filas hasta próximo padre)
      var anchor = '';
      var r = row.nextElementSibling;
      while (r && !r.classList.contains('js-parent-row')) {

        // intenta data-precio, o celda con clase .precio-cell, o cualquier número en texto
        var dp = r.getAttribute('data-precio');
        if (dp != null && dp !== '') { anchor = dp; break; }
        var td = r.querySelector('.precio-cell,.cell-precio,[data-precio-cell]');
        if (td) { 
          var n = parseNum(td.textContent);
          if (!isNaN(n)) { anchor = n; break; }
        }
        // fallback: primer número parseable en la fila
        var n2 = parseNum(r.textContent);
        if (!isNaN(n2)) { anchor = n2; break; }
        r = r.nextElementSibling;
      }
      modal.dataset._anchor = String(anchor || '');
    }, true);

    // 2) Al abrir el modal de HIJO, aplicar el ancla si existe; si no, permitir escribir
    modal.addEventListener('show.bs.modal', function(ev){
 
      if (modal.dataset._mode !== 'child') return; // solo hij@
      var price = qPrice(); if (!price) return;

      // si no tenemos anchor aún, limpia para que el usuario ponga el 1er precio
      var anchor = modal.dataset._anchor || '';
      if (anchor !== '') {
        price.value = anchor;
        price.readOnly = true;
        price.setAttribute('readonly','readonly');
        price.classList.add('bg-light');
      } else {
        price.value = '';
        price.readOnly = false;
        price.removeAttribute('readonly');
        price.classList.remove('bg-light');
      }
    }, true);

    // 3) Al cerrar, limpiar estado
    modal.addEventListener('hidden.bs.modal', function(){
    
      delete modal.dataset._mode;
      delete modal.dataset._anchor;
      modal.__anchorRow = null;
      var price = qPrice(); 
      if (price) { price.readOnly = false; price.removeAttribute('readonly'); price.classList.remove('bg-light'); }
    }, true);

    // 4) (Opcional para AJAX): si creas el 1er hijo por AJAX, fija el ancla en el DOM del PADRE
    // Llama a window.setPerfilAnchorForParent(rowElement, precio) al confirmar creación del 1er hijo.
    window.setPerfilAnchorForParent = function(parentRow, precio){
      try {
        if (!parentRow) parentRow = modal && modal.__anchorRow;
        if (!parentRow) return;
        var v = String(precio || '').trim();
        if (!v) return;
        parentRow.setAttribute('data-anchor-price', v);
      } catch(_){}
    };

  } catch(e) { console.error('[child-anchor]', e); }
})();

























// expone un callback global para fijar el ancla en el DOM del padre
window.onPerfilChildCreated = function(response){
  try {
    if (!response || response.ok === false) return;
    var pane = document.getElementById('perfiles');
    if (!pane) return;
    // busca la fila padre por correo (ajusta si usas otro identificador)
    var row = pane.querySelector('tr.js-parent-row[data-correo="'+ CSS.escape(response.correo) +'"]');
    if (!row) return;

    // si el backend te mandó anchor_price, úsalo; si no, usa el enviado en el form
    var anchor = (response.anchor_price != null && response.anchor_price !== '')
      ? String(response.anchor_price)
      : (response.soles || '');

    if (!anchor) return;
    row.setAttribute('data-anchor-price', anchor);
  } catch (e) { console.error('onPerfilChildCreated error', e); }
};

















/* =============================================================================
   public/assets/js/app.js — REEMPLAZO DEL SUBMIT (AJAX seguro) de #perfilModal
   (BUSCA tu bloque "bindPerfilChildSubmit" y REMPLÁZALO entero por este)
   ============================================================================= */
(function bindPerfilChildSubmit(){
  var modal = document.getElementById('perfilModal');
  if (!modal) return;
  var form = modal.querySelector('form');
  if (!form) return;
  if (form.__pfSubmitBound) return; form.__pfSubmitBound = true;

  // si usas submit nativo y quieres toast tras redirect:
  window.markFlashReload && window.markFlashReload('#perfilModal form');

  form.addEventListener('submit', async function onSubmit(e){
    e.preventDefault();
    // sanitiza "soles" antes de armar FormData
    (function dedupe(){
      var fields = Array.from(form.querySelectorAll('input[name="soles"]'));
      if (fields.length > 1) {
        var keeper = fields.find(n => n.closest('#childPriceSlot')) ||
                     fields.find(n => n.type !== 'hidden' && getComputedStyle(n).display !== 'none') ||
                     fields[0];
        fields.forEach(function(n){ if (n !== keeper) n.name = 'soles_dummy'; });
      }
    })();

    var fd = new FormData(form);
    var correo = fd.get('correo');
    var soles  = fd.get('soles');

    var url = getFormActionURL(form); // <- NO usar form.action
    if (!url) { form.removeEventListener('submit', onSubmit); form.submit(); return; }

    try {
      var resp = await fetch(url, { method: 'POST', body: fd, credentials:'same-origin' });
      var data = {};
      try { data = await resp.json(); } catch(_){ data = {}; }
      data = Object.assign({ ok: resp.ok, correo, soles }, data);

      // fija ancla en el DOM del padre (si aplica)
      window.onPerfilChildCreated && window.onPerfilChildCreated(data);

      try { bootstrap.Modal.getInstance(modal)?.hide(); } catch(_){}
      okToastReload('Guardado');
    } catch (err) {
      // Fallback a submit nativo si el fetch falla
      form.removeEventListener('submit', onSubmit);
      form.submit();
    }
  }, true);
})();








































































/* =============================================================================
   public/assets/js/app.js — SANITIZADOR: 1 solo name="soles" por formulario
   (pegar DESPUÉS de tus bloques actuales de precio — no importa si hay más)
   ============================================================================= */
(function(){
  var modal = document.getElementById('perfilModal');
  
    // neutralized for perfilModal
    return;if (!modal) return;
  var form = modal.querySelector('form');
  if (!form) return;

  function dedupeSoles(){
    var fields = Array.from(form.querySelectorAll('input[name="soles"]'));
    if (fields.length <= 1) return;
    // Preferimos el del #childPriceSlot (si existe), luego uno visible, si no el primero
    var keeper = fields.find(n => n.closest('#childPriceSlot')) ||
                 fields.find(n => n.type !== 'hidden' && getComputedStyle(n).display !== 'none') ||
                 fields[0];
    fields.forEach(function(n){ if (n !== keeper) n.name = 'soles_dummy'; });
  }
  function dropHiddenSoles(){
    (form.querySelectorAll('input[type="hidden"][name="soles"]')||[]).forEach(function(x){ x.remove(); });
  }

  modal.addEventListener('show.bs.modal', function(){
    var ev = ev; if (ev && ev.target && ev.target.id === 'perfilModal') return; dropHiddenSoles(); }, true);
  modal.addEventListener('shown.bs.modal', function(){
    var ev = ev; if (ev && ev.target && ev.target.id === 'perfilModal') return; dedupeSoles(); }, true);
  modal.addEventListener('hidden.bs.modal', function(){
    var ev = ev; if (ev && ev.target && ev.target.id === 'perfilModal') return; dropHiddenSoles(); }, true);
  form.addEventListener('submit', function(){ dedupeSoles(); }, true);
})();
















/* =============================================================================
   public/assets/js/app.js — PREFILL del precio de cabecera (solo PADRE)
   (pegar AL FINAL del archivo, tras tus bloques de precio)
   ============================================================================= */
(function(){
  var pane  = document.getElementById('perfiles');
  var modal = document.getElementById('perfilModal');
  
    // neutralized for perfilModal
    return;if (!pane || !modal) return;

  function qHead(){ return document.getElementById('precioPerfilHead'); }
  function qPrice(){ return modal.querySelector('#childPriceSlot input[name="soles"]') || modal.querySelector('input[name="soles"]'); }

  // Al hacer click en "Agregar perfil" prellenar y poner modo padre
  document.addEventListener('click', function(e){
    var t = e.target;
    if (!t || !t.classList) return;
    if (t.classList.contains('btn-add-perfil')) {
      var head = qHead(); var price = qPrice();
      if (price && head) { price.value = head.value || ''; }
      modal.dataset._mode = 'parent';
    }
  }, true);

  // Seguridad: si el modal se abre específicamente con el botón de agregar
  modal.addEventListener('show.bs.modal', function(ev){
    var ev = ev; if (ev && ev.target && ev.target.id === 'perfilModal') return;
    if (ev.relatedTarget && ev.relatedTarget.classList.contains('btn-add-perfil')) {
      var head = qHead(); var price = qPrice();
      if (price && head) { price.value = head.value || ''; }
      modal.dataset._mode = 'parent';
    }
  }, true);
})();
































// /public/assets/js/app.js
// [PARCHE 1] — Reset agresivo al click de FILA PADRE (asegura modo HIJO limpio)
(function(){
  var modal = document.getElementById('perfilModal');
  if (!modal) return;
  if (window.__pfChildResetBound) return; window.__pfChildResetBound = true;

  document.addEventListener('click', function(e){
    var row = e.target && e.target.closest && e.target.closest('tr.js-parent-row');
    if (!row) return;

    // Forzar modo hijo y limpiar restos de "padre"
    modal.dataset._mode = 'child';
    delete modal.dataset._lockVal;
    delete modal.dataset._headSnapshot;

    // limpia artefactos del swap de PADRE si quedaron
    if (modal.__priceClone)  { try{ modal.__priceClone.remove(); }catch(_){} modal.__priceClone  = null; }
    if (modal.__priceHidden) { try{ modal.__priceHidden.remove(); }catch(_){} modal.__priceHidden = null; }

    // guarda el posible ancla del padre (si existe)
    modal.dataset._childAnchor = row.getAttribute('data-anchor-price') || '';
  }, true);
})();













































// /public/assets/js/app.js
// [PEGAR] — Reset al hacer click en una FILA PADRE (modo hijo limpio)
(function(){
  var modal = document.getElementById('perfilModal');
  if (!modal) return;
  if (window.__pfChildResetV5) return; window.__pfChildResetV5 = true;

  document.addEventListener('click', function(e){
    var row = e.target && e.target.closest && e.target.closest('tr.js-parent-row');
    if (!row) return;

    // Forzar modo HIJO y limpiar restos del modo PADRE
    modal.dataset._mode = 'child';
    modal.dataset._childAnchor = row.getAttribute('data-anchor-price') || '';
    delete modal.dataset._lockVal;
    delete modal.dataset._headSnapshot;

    // limpiar artefactos del swap PADRE si quedaran
    if (modal.__priceClone)  { try{ modal.__priceClone.remove(); }catch(_){} modal.__priceClone  = null; }
    if (modal.__priceHidden) { try{ modal.__priceHidden.remove(); }catch(_){} modal.__priceHidden = null; }
  }, true);
})();


















// /public/assets/js/app.js
// [REEMPLAZO COMPLETO] — HIJO: bloquear precio solo si hay ancla; si no, dejar libre
(function(){
  try {
    var modal = document.getElementById('perfilModal'); 
    // neutralized for perfilModal
    return;// modal "Agregar a correo"
    if (!modal) return;
    if (window.__pfChildSwapBoundV4) return; window.__pfChildSwapBoundV4 = true;

    function qForm(){ return modal.querySelector('form') || modal; }
    function qSlot(){ return modal.querySelector('#childPriceSlot'); }
    function qReal(){ return modal.querySelector('#childPriceSlot input[name="soles"]'); }

    // por seguridad, captura también el click en la fila para cachear ancla
    document.addEventListener('click', function(e){
      var row = e.target && e.target.closest && e.target.closest('tr.js-parent-row');
      if (!row) return;
      modal.dataset._childAnchor = row.getAttribute('data-anchor-price') || '';
    }, true);

    modal.addEventListener('shown.bs.modal', function(){
    var ev = ev; if (ev && ev.target && ev.target.id === 'perfilModal') return;
      var form = qForm(); if (!form) return;
      var slot = qSlot(); if (!slot) return;

      // limpia clones/hidden previos (hijo o padre)
      if (modal.__childClone)  { modal.__childClone.remove();  modal.__childClone  = null; }
      if (modal.__childHidden) { modal.__childHidden.remove(); modal.__childHidden = null; }
      if (modal.__priceClone)  { modal.__priceClone.remove();  modal.__priceClone  = null; }
      if (modal.__priceHidden) { modal.__priceHidden.remove(); modal.__priceHidden = null; }

      var anchorVal = modal.dataset._childAnchor || '';
      var real = qReal();

      if (anchorVal !== '') {
        // ——— HAY ANCLA: bloquea con clon readonly + hidden para submit
        if (real) { modal.__childReal = real; real.remove(); }

        var clone = document.createElement('input');
        clone.type = 'text';
        clone.value = anchorVal;
        clone.readOnly = true; clone.setAttribute('readonly','readonly');
        clone.className = (modal.__childReal?.className || 'form-control') + ' bg-light';
        clone.id = (modal.__childReal?.id ? modal.__childReal.id + '_display' : 'modalChildPrecio_display');
        slot.appendChild(clone);
        modal.__childClone = clone;

        var hidden = document.createElement('input');
        hidden.type  = 'hidden';
        hidden.name  = 'soles';
        hidden.value = anchorVal;
        form.appendChild(hidden);
        modal.__childHidden = hidden;

      } else {
        // ——— SIN ANCLA: libre y vacío (primer hijo define el precio)
        if (modal.__childClone)  { modal.__childClone.remove();  modal.__childClone  = null; }
        if (modal.__childHidden) { modal.__childHidden.remove(); modal.__childHidden = null; }

        // asegúrate de que exista el input real dentro del slot
        if (!qReal()) {
          var r = modal.__childReal || document.createElement('input');
          if (!modal.__childReal) {
            r.type = 'number'; r.step = '0.01'; r.name = 'soles'; r.className = 'form-control'; r.id = 'modalChildPrecio';
          }
          slot.appendChild(r);
        }

        var rr = qReal();
        rr.value = '';                      // <<< clave: NO arrastrar valor del padre
        rr.readOnly = false;
        rr.removeAttribute('readonly');
        rr.classList.remove('bg-light');
      }
    }, true);

    modal.addEventListener('hidden.bs.modal', function(){
    var ev = ev; if (ev && ev.target && ev.target.id === 'perfilModal') return;
      // reubica el real dentro del slot si lo sacamos
      var slot = qSlot();
      if (slot && modal.__childReal && !modal.__childReal.isConnected) {
        slot.appendChild(modal.__childReal);
      }
      if (modal.__childClone)  { modal.__childClone.remove();  modal.__childClone  = null; }
      if (modal.__childHidden) { modal.__childHidden.remove(); modal.__childHidden = null; }
      delete modal.dataset._childAnchor;
    }, true);

  } catch(e) { console.error('[child price swap v4]', e); }
})();

















// === CHILD HARD RESET (al abrir desde FILA): limpia restos de PADRE y prepara ancla ===
(function(){
  var modal = document.getElementById('perfilModal');
  if (!modal) return;
  if (window.__pfChildHardReset) return; window.__pfChildHardReset = true;

  // Click en FILA PADRE => marcar modo hijo + cachear ancla
  document.addEventListener('click', function(e){
    var row = e.target && e.target.closest && e.target.closest('tr.js-parent-row');
    if (!row) return;

    modal.dataset._mode = 'child';
    modal.dataset._childAnchor = row.getAttribute('data-anchor-price') || '';

    // limpiar cualquier rastro del swap PADRE
    if (modal.__priceClone)  { try{ modal.__priceClone.remove(); }catch(_){} modal.__priceClone  = null; }
    if (modal.__priceHidden) { try{ modal.__priceHidden.remove(); }catch(_){} modal.__priceHidden = null; }
    delete modal.dataset._lockVal;
    delete modal.dataset._headSnapshot;
  }, true);

  // En show: si NO viene del botón "Agregar perfil", fuerzo modo hijo limpio
  modal.addEventListener('show.bs.modal', function(ev){
    var ev = ev; if (ev && ev.target && ev.target.id === 'perfilModal') return;
    var isParent = !!(ev.relatedTarget && ev.relatedTarget.classList && ev.relatedTarget.classList.contains('btn-add-perfil'));
    if (isParent) return; // padre: no tocar aquí

    modal.dataset._mode = 'child';
    delete modal.dataset._lockVal;
    delete modal.dataset._headSnapshot;

    // quita hidden/clones que podrían venir del flujo padre
    var form = modal.querySelector('form');
    if (form){
      (form.querySelectorAll('input[type="hidden"][name="soles"]')||[]).forEach(function(n){ n.remove(); });
    }
    if (modal.__priceClone)  { try{ modal.__priceClone.remove(); }catch(_){} modal.__priceClone  = null; }
    if (modal.__priceHidden) { try{ modal.__priceHidden.remove(); }catch(_){} modal.__priceHidden = null; }
  }, true);
})();


























// === CHILD APPLY (en shown): si NO hay ancla → campo vacío y editable; si hay → bloquear
(function(){
  var modal = document.getElementById('perfilModal');
  
    // neutralized for perfilModal
    return;if (!modal) return;
  if (window.__pfChildApplyOnce) return; window.__pfChildApplyOnce = true;

  function qForm(){ return modal.querySelector('form') || modal; }
  function qSlot(){ return modal.querySelector('#childPriceSlot'); }
  function qReal(){ return modal.querySelector('#childPriceSlot input[name="soles"]'); }

  modal.addEventListener('shown.bs.modal', function(ev){
    var ev = ev; if (ev && ev.target && ev.target.id === 'perfilModal') return;
    var isParent = !!(ev.relatedTarget && ev.relatedTarget.classList && ev.relatedTarget.classList.contains('btn-add-perfil'));
    if (isParent) return; // padre: otro flujo

    var form = qForm(); if (!form) return;
    var slot = qSlot(); if (!slot) return;

    // limpieza de cualquier artefacto previo (padre/hijo)
    if (modal.__childClone)  { modal.__childClone.remove();  modal.__childClone  = null; }
    if (modal.__childHidden) { modal.__childHidden.remove(); modal.__childHidden = null; }
    if (modal.__priceClone)  { modal.__priceClone.remove();  modal.__priceClone  = null; }
    if (modal.__priceHidden) { modal.__priceHidden.remove(); modal.__priceHidden = null; }
    (form.querySelectorAll('input[type="hidden"][name="soles"]')||[]).forEach(function(n){ n.remove(); });

    var anchorVal = modal.dataset._childAnchor || '';   // ← ancla del padre si existe
    var real = qReal();

    if (anchorVal !== '') {
      // HAY ANCLA: bloqueado
      if (real) { modal.__childReal = real; real.remove(); }

      var clone = document.createElement('input');
      clone.type = 'text';
      clone.value = anchorVal;
      clone.readOnly = true; clone.setAttribute('readonly','readonly');
      clone.className = (modal.__childReal?.className || 'form-control') + ' bg-light';
      clone.id = (modal.__childReal?.id ? modal.__childReal.id + '_display' : 'modalChildPrecio_display');
      slot.appendChild(clone);
      modal.__childClone = clone;

      var hidden = document.createElement('input');
      hidden.type  = 'hidden';
      hidden.name  = 'soles';
      hidden.value = anchorVal;
      form.appendChild(hidden);
      modal.__childHidden = hidden;

    } else {
      // SIN ANCLA: libre y VACÍO
      if (!qReal()) {
        var r = modal.__childReal || document.createElement('input');
        if (!modal.__childReal) {
          r.type = 'number'; r.step = '0.01'; r.name = 'soles'; r.className = 'form-control'; r.id = 'modalChildPrecio';
        }
        slot.appendChild(r);
      }
      var rr = qReal();
      rr.value = '';                   // ← clave: no arrastrar valor del padre
      rr.readOnly = false;
      rr.removeAttribute('readonly');
      rr.classList.remove('bg-light');
    }
  }, true);

  // al cerrar: reponer el input real en el slot y limpiar flags
  modal.addEventListener('hidden.bs.modal', function(){
    var ev = ev; if (ev && ev.target && ev.target.id === 'perfilModal') return;
    var slot = qSlot();
    if (slot && modal.__childReal && !modal.__childReal.isConnected) {
      slot.appendChild(modal.__childReal);
    }
    if (modal.__childClone)  { modal.__childClone.remove();  modal.__childClone  = null; }
    if (modal.__childHidden) { modal.__childHidden.remove(); modal.__childHidden = null; }
    delete modal.dataset._childAnchor;
    modal.dataset._mode = ''; // reset
  }, true);
})();
































// === CHILD GUARD: hijo SIN ancla siempre libre (vacío, editable) ===
(function(){
  'use strict';
  var modal = document.getElementById('perfilModal');
  
    // neutralized for perfilModal
    return;if (!modal) return;
  if (window.__pfChildHardGuard) return; window.__pfChildHardGuard = true;

  // Helpers
  function qForm(){ return modal.querySelector('form') || modal; }
  function qSlot(){ return modal.querySelector('#childPriceSlot'); }
  function qReal(){ return modal.querySelector('#childPriceSlot input[name="soles"]'); }
  function qHead(){ return document.getElementById('precioPerfilHead'); }

  // 1) Al CLICK en una FILA PADRE ⇒ marcar flujo HIJO y cachear ancla
  document.addEventListener('click', function(e){
    var row = e.target && e.target.closest && e.target.closest('tr.js-parent-row');
    if (!row) return;
    modal.dataset._mode = 'child';
    modal.dataset._childAnchor = row.getAttribute('data-anchor-price') || '';
    // limpiar artefactos del flujo PADRE
    delete modal.dataset._lockVal;
    delete modal.dataset._headSnapshot;
    if (modal.__priceClone)  { try{ modal.__priceClone.remove(); }catch(_){} modal.__priceClone  = null; }
    if (modal.__priceHidden) { try{ modal.__priceHidden.remove(); }catch(_){} modal.__priceHidden = null; }
  }, true); // <<< captura

  // 2) show.bs.modal: si NO viene del botón "Agregar perfil", fuerzo modo HIJO limpio
  modal.addEventListener('show.bs.modal', function(ev){
    var ev = ev; if (ev && ev.target && ev.target.id === 'perfilModal') return;
    var isParent = !!(ev.relatedTarget && ev.relatedTarget.classList && ev.relatedTarget.classList.contains('btn-add-perfil'));
    if (isParent) return; // PADRE no se toca aquí

    modal.dataset._mode = 'child';

    var form = qForm(); if (!form) return;
    // borrar cualquier hidden[name=soles] que pueda forzar precio
    (form.querySelectorAll('input[type="hidden"][name="soles"]')||[]).forEach(function(n){ n.remove(); });

    // si otro código intenta rellenar en "show", lo sobreescribimos en microtarea:
    Promise.resolve().then(function(){
      var slot = qSlot(); if (!slot) return;
      var real = qReal();
      if (!real) {
        // si no existe, crea uno nuevo compatible (sin romper IDs si ya existen)
        real = document.createElement('input');
        real.type = 'number'; real.step = '0.01'; real.name = 'soles'; real.className = 'form-control'; real.id = 'modalChildPrecio';
        slot.appendChild(real);
      }
      // si NO hay ancla ⇒ vacío y editable sí o sí
      var anchorVal = modal.dataset._childAnchor || '';
      if (anchorVal === '') {
        real.value = '';
        real.readOnly = false; real.removeAttribute('readonly'); real.classList.remove('bg-light');
      }
    });
  }, true); // <<< captura (se ejecuta pronto)

  // 3) shown.bs.modal: blindaje contra reinyectores (observador corto)
  modal.addEventListener('shown.bs.modal', function(ev){
    var ev = ev; if (ev && ev.target && ev.target.id === 'perfilModal') return;
    var isParent = !!(ev.relatedTarget && ev.relatedTarget.classList && ev.relatedTarget.classList.contains('btn-add-perfil'));
    if (isParent) return; // PADRE: no aplican estos blindajes

    var anchorVal = modal.dataset._childAnchor || '';
    if (anchorVal !== '') return; // si hay ancla, no es primer hijo → nada que hacer

    var head = qHead();
    var form = qForm(); if (!form) return;
    var real = qReal(); if (!real) return;

    // El valor del header que suele "pegarse"
    var headerVal = head ? (head.value || '') : '';

    // En el PRIMER HIJO: si alguien setea programáticamente el valor justo ahora, lo anulamos
    real.value = ''; // aseguramos vacío al final del ciclo
    real.readOnly = false; real.removeAttribute('readonly'); real.classList.remove('bg-light');

    // Observador 1: si algún script cambia el 'value' del input en los próximos ms, lo revertimos
    var obs = new MutationObserver(function(){
      if (!modal.classList.contains('show')) { try{ obs.disconnect(); }catch(_){} return; }
      // si detectamos que se "pegó" el header, lo limpiamos
      if (real.value === headerVal) real.value = '';
    });
    try { obs.observe(real, { attributes:true, attributeFilter:['value'] }); } catch(_){}

    // Observador 2 (fallback por timers ajenos): un par de ticks que limpian si se coló el header
    var ticks = 4;
    (function tick(){
      if (!modal.classList.contains('show')) return;
      if (real.value === headerVal) real.value = '';
      if (--ticks > 0) setTimeout(tick, 30);
      else { try{ obs.disconnect(); }catch(_){} }
    })();

    // Si el usuario escribe, ya no tocamos más el campo
    real.addEventListener('input', function once(){
      try{ obs.disconnect(); }catch(_){} ticks = 0;
      real.removeEventListener('input', once, true);
    }, true);
  }, true);

  // 4) hidden: limpieza de estado
  modal.addEventListener('hidden.bs.modal', function(){
    var ev = ev; if (ev && ev.target && ev.target.id === 'perfilModal') return;
    delete modal.dataset._mode;
    delete modal.dataset._childAnchor;
  }, true);
})();
























// === Prefill de CABECERA solo en PADRE (no toca hijo) ===
(function(){
  var pane  = document.getElementById('perfiles');
  var modal = document.getElementById('perfilModal');
  
    // neutralized for perfilModal
    return;if (!pane || !modal) return;

  function qHead(){ return document.getElementById('precioPerfilHead'); }
  function qPrice(){ return modal.querySelector('#childPriceSlot input[name="soles"]') || modal.querySelector('input[name="soles"]'); }

  // Click en "Agregar perfil"
  document.addEventListener('click', function(e){
    var t = e.target;
    if (!t || !t.classList) return;
    if (t.classList.contains('btn-add-perfil')) {
      var head = qHead(), inp = qPrice();
      if (head && inp) { inp.value = head.value || ''; }
      modal.dataset._mode = 'parent';
    }
  }, true);

  // show: si viene del botón de agregar, repite el prefill
  modal.addEventListener('show.bs.modal', function(ev){
    var ev = ev; if (ev && ev.target && ev.target.id === 'perfilModal') return;
    if (ev.relatedTarget && ev.relatedTarget.classList && ev.relatedTarget.classList.contains('btn-add-perfil')) {
      var head = qHead(), inp = qPrice();
      if (head && inp) { inp.value = head.value || ''; }
      modal.dataset._mode = 'parent';
    }
  }, true);
})();


























// [public/assets/js/app.js]
// === HOTFIX: Hijo SIN ancla => precio 100% editable (quita readonly heredado) ===
(function(){
  var modal = document.getElementById('perfilModal');
  
    // neutralized for perfilModal
    return;if (!modal) return;
  if (window.__pfChildUnlockFix) return; window.__pfChildUnlockFix = true;

  function qSlot(){ return modal.querySelector('#childPriceSlot'); }
  function makeReal(){
    var r = document.createElement('input');
    r.type = 'number';
    r.step = '0.01';
    r.name = 'soles';
    r.className = 'form-control';
    r.id = 'modalChildPrecio'; // mantenemos el ID
    return r;
  }

  modal.addEventListener('shown.bs.modal', function(ev){
    var ev = ev; if (ev && ev.target && ev.target.id === 'perfilModal') return;
    // Si viene del botón "Agregar perfil" es PADRE => no tocar
    if (ev.relatedTarget && ev.relatedTarget.classList && ev.relatedTarget.classList.contains('btn-add-perfil')) return;

    // Solo si NO hay ancla (primer hijo)
    var anchor = modal.dataset._childAnchor || '';
    if (anchor !== '') return;

    var slot = qSlot(); if (!slot) return;

    // Limpia restos de clones/hidden que bloquean o reinyectan
    if (modal.__childClone)  { try{ modal.__childClone.remove(); }catch(_){} modal.__childClone  = null; }
    if (modal.__childHidden) { try{ modal.__childHidden.remove(); }catch(_){} modal.__childHidden = null; }
    if (modal.__priceClone)  { try{ modal.__priceClone.remove(); }catch(_){} modal.__priceClone  = null; }
    if (modal.__priceHidden) { try{ modal.__priceHidden.remove(); }catch(_){} modal.__priceHidden = null; }

    // Quita cualquier <input type="hidden" name="soles"> del form (puede forzar valor)
    var form = modal.querySelector('form');
    if (form) (form.querySelectorAll('input[type="hidden"][name="soles"]')||[]).forEach(function(n){ n.remove(); });

    // Reemplaza el input actual por uno NUEVO (elimina listeners y readonly heredados)
    var fresh = makeReal();
    var old = slot.querySelector('input[name="soles"]');
    if (old) slot.replaceChild(fresh, old); else slot.appendChild(fresh);

    // Asegura LIBRE y VACÍO
    fresh.value = '';
    fresh.readOnly = false;
    fresh.removeAttribute('readonly');
    fresh.disabled = false;
    fresh.classList.remove('bg-light');
  }, true);
})();





























































// === CHILD ULTRA-FIX: sin ancla => Precio = 0 y editable, sí o sí (FIX catch) ===
(function(){
  'use strict';
  var modal = document.getElementById('perfilModal');
  
    // neutralized for perfilModal
    return;if (!modal) return;
  if (window.__pfChildUltraFix) return; window.__pfChildUltraFix = true;

  function qForm(){ return modal.querySelector('form') || modal; }
  function qSlot(){ return modal.querySelector('#childPriceSlot'); }
  function mkRealInput(){
    var r = document.createElement('input');
    r.type = 'number'; r.step = '0.01'; r.name = 'soles';
    r.className = 'form-control'; r.id = 'modalChildPrecio';
    return r;
  }
  function isParentOpen(ev){
    return !!(ev && ev.relatedTarget && ev.relatedTarget.classList && ev.relatedTarget.classList.contains('btn-add-perfil'));
  }
  function hardReplaceWithZero(){
    var slot = qSlot(); if (!slot) return null;
    var form = qForm();
    if (form) (form.querySelectorAll('input[type="hidden"][name="soles"]')||[]).forEach(function(n){ n.remove(); });
    if (modal.__childClone)  { try{ modal.__childClone.remove(); }catch(_){ } modal.__childClone  = null; }
    if (modal.__priceClone)  { try{ modal.__priceClone.remove(); }catch(_){ } modal.__priceClone  = null; }
    if (modal.__childHidden) { try{ modal.__childHidden.remove(); }catch(_){ } modal.__childHidden = null; }
    if (modal.__priceHidden) { try{ modal.__priceHidden.remove(); }catch(_){ } modal.__priceHidden = null; }

    var fresh = mkRealInput();
    var old = slot.querySelector('input[name="soles"]');
    if (old) slot.replaceChild(fresh, old); else slot.appendChild(fresh);

    fresh.value = '0';
    fresh.readOnly = false; fresh.removeAttribute('readonly'); fresh.disabled = false;
    fresh.classList.remove('bg-light');
    try { fresh.focus(); fresh.select && fresh.select(); } catch(_){ }

    return fresh;
  }

  document.addEventListener('click', function(e){
    var row = e.target && e.target.closest && e.target.closest('tr.js-parent-row');
    if (!row) return;
    modal.dataset._mode = 'child';
    modal.dataset._childAnchor = row.getAttribute('data-anchor-price') || '';
    delete modal.dataset._lockVal;
    delete modal.dataset._headSnapshot;
  }, true);

  modal.addEventListener('show.bs.modal', function(ev){
    var ev = ev; if (ev && ev.target && ev.target.id === 'perfilModal') return;
    if (isParentOpen(ev)) return;
    modal.dataset._mode = 'child';
    Promise.resolve().then(function(){
      var anchor = modal.dataset._childAnchor || '';
      if (anchor === '') hardReplaceWithZero();
    });
  }, true);

  modal.addEventListener('shown.bs.modal', function(ev){
    var ev = ev; if (ev && ev.target && ev.target.id === 'perfilModal') return;
    if (isParentOpen(ev)) return;
    var anchor = modal.dataset._childAnchor || '';
    if (anchor !== '') return;

    var slot = qSlot(); if (!slot) return;
    var input = slot.querySelector('input[name="soles"]');
    if (!input) input = hardReplaceWithZero();
    if (!input) return;

    var head = document.getElementById('precioPerfilHead');
    var headerVal = head ? (head.value || '') : '';

    input.value = '0';
    input.readOnly = false; input.removeAttribute('readonly'); input.disabled = false;
    input.classList.remove('bg-light');

    var obs = new MutationObserver(function(){
      if (!modal.classList.contains('show')) { try{ obs.disconnect(); }catch(_){ } return; }
      if (input.value === headerVal) input.value = '0';
      if (input.hasAttribute('readonly') || input.readOnly) { input.readOnly = false; input.removeAttribute('readonly'); }
      if (input.disabled) input.disabled = false;
      input.classList.remove('bg-light');
    });
    try { obs.observe(input, { attributes:true, attributeFilter:['value','readonly','disabled','class'] }); } catch(_){ }

    var ticks = 6;
    (function tick(){
      if (!modal.classList.contains('show')) { try{ obs.disconnect(); }catch(_){ } return; }
      if (input.value === headerVal) input.value = '0';
      input.readOnly = false; input.removeAttribute('readonly'); input.disabled = false;
      input.classList.remove('bg-light');
      if (--ticks > 0) setTimeout(tick, 40); else { try{ obs.disconnect(); }catch(_){ } }
    })();

    var userTyped = function(){
      try{ obs.disconnect(); }catch(_){ }
      input.removeEventListener('input', userTyped, true);
      setTimeout(function(){
        input.readOnly = false; input.removeAttribute('readonly'); input.disabled = false;
        input.classList.remove('bg-light');
      }, 0);
    };
    input.addEventListener('input', userTyped, true);
  }, true);

  modal.addEventListener('hidden.bs.modal', function(){
    var ev = ev; if (ev && ev.target && ev.target.id === 'perfilModal') return;
    delete modal.dataset._mode;
    delete modal.dataset._childAnchor;
  }, true);
})();



















/* ============================================
   /public/assets/js/app.js
   === HIJO CANÓNICO (primer hijo libre; siguientes con ancla) ===
   ============================================ */
(function(){
  'use strict';
  var modal = document.getElementById('perfilModal');
  
    // neutralized for perfilModal
    return;if (!modal) return;
  if (window.__pfChildCanonicalV7) return; window.__pfChildCanonicalV7 = true;

  // Helpers
  function qForm(){ return modal.querySelector('form') || modal; }
  function qSlot(){ return modal.querySelector('#childPriceSlot'); }
  function qReal(){ return modal.querySelector('#childPriceSlot input[name="soles"]'); }
  function mkReal(){
    var r = document.createElement('input');
    r.type = 'number'; r.step = '0.01';
    r.name = 'soles'; r.className = 'form-control';
    r.id = 'modalChildPrecio';
    return r;
  }
  function isParentOpen(ev){
    return !!(ev && ev.relatedTarget && ev.relatedTarget.classList && ev.relatedTarget.classList.contains('btn-add-perfil'));
  }
  function cleanupResidues(){
    var f = qForm(); if (f) {
      (f.querySelectorAll('input[type="hidden"][name="soles"]')||[]).forEach(function(n){ n.remove(); });
    }
    if (modal.__childClone)  { try{ modal.__childClone.remove(); }catch(_){} modal.__childClone  = null; }
    if (modal.__childHidden) { try{ modal.__childHidden.remove(); }catch(_){} modal.__childHidden = null; }
    if (modal.__priceClone)  { try{ modal.__priceClone.remove(); }catch(_){} modal.__priceClone  = null; }
    if (modal.__priceHidden) { try{ modal.__priceHidden.remove(); }catch(_){} modal.__priceHidden = null; }
  }
  function forceFreeZero(input){
    input.value = '0';
    input.readOnly = false; input.removeAttribute('readonly');
    input.disabled = false; input.classList.remove('bg-light');
  }

  // 1) Click en FILA PADRE → cachear ancla (si existe)
  document.addEventListener('click', function(e){
    var row = e.target && e.target.closest && e.target.closest('tr.js-parent-row');
    if (!row) return;
    modal.dataset._childAnchor = row.getAttribute('data-anchor-price') || '';
  }, true);

  // 2) show: si no es PADRE, limpiar residuos que reinyectan/bloquean
  modal.addEventListener('show.bs.modal', function(ev){
    var ev = ev; if (ev && ev.target && ev.target.id === 'perfilModal') return;
    if (isParentOpen(ev)) return; // PADRE: no tocamos
    cleanupResidues();
  }, true);

  // 3) shown: aplicar reglas del hijo
  modal.addEventListener('shown.bs.modal', function(ev){
    var ev = ev; if (ev && ev.target && ev.target.id === 'perfilModal') return;
    if (isParentOpen(ev)) return; // PADRE: fuera
    var slot = qSlot(); var form = qForm();
    if (!slot || !form) return;

    var anchor = modal.dataset._childAnchor || '';
    var head   = document.getElementById('precioPerfilHead');
    var headerVal = head ? (head.value || '') : '';

    // Asegura que haya input real en el slot
    var real = qReal();
    if (!real) { real = mkReal(); slot.appendChild(real); }

    if (anchor === '') {
      // ========== PRIMER HIJO: 0 y editable ==========
      forceFreeZero(real);

      // Defensa contra reinyectores (que copian el header)
      var obs = new MutationObserver(function(){
        if (!modal.classList.contains('show')) { try{ obs.disconnect(); }catch(_){ } return; }
        if (real.value === headerVal) forceFreeZero(real);
        if (real.readOnly || real.hasAttribute('readonly')) { real.readOnly=false; real.removeAttribute('readonly'); }
        if (real.disabled) real.disabled = false;
        real.classList.remove('bg-light');
      });
      try { obs.observe(real, { attributes:true, attributeFilter:['value','readonly','disabled','class'] }); } catch(_){}

      // ticks por si hay timers externos
      var ticks = 6;
      (function tick(){
        if (!modal.classList.contains('show')) { try{ obs.disconnect(); }catch(_){ } return; }
        if (real.value === headerVal) forceFreeZero(real);
        // siempre libre en los primeros ms
        forceFreeZero(real);
        if (--ticks > 0) setTimeout(tick, 40); else { try{ obs.disconnect(); }catch(_){ } }
      })();

      // cuando el usuario escribe, dejamos de “tocar valor” pero seguimos evitando readonly
      real.addEventListener('input', function once(){
        try{ obs.disconnect(); }catch(_){ }
        real.removeEventListener('input', once, true);
        setTimeout(function(){
          real.readOnly=false; real.removeAttribute('readonly'); real.disabled=false; real.classList.remove('bg-light');
        },0);
      }, true);

    } else {
      // ========== YA HAY ANCLA: bloquear con anchor ==========
      real.value = anchor;
      real.readOnly = true; real.setAttribute('readonly','readonly');
      real.classList.add('bg-light');

      // hidden de seguridad para el POST
      var h = document.createElement('input');
      h.type='hidden'; h.name='soles'; h.value=anchor;
      form.appendChild(h);
      modal.__childHidden = h;
    }
  }, true);

  // 4) hidden: limpiar flags y reponer real si hiciera falta
  modal.addEventListener('hidden.bs.modal', function(){
    var ev = ev; if (ev && ev.target && ev.target.id === 'perfilModal') return;
    cleanupResidues();
    delete modal.dataset._childAnchor;
  }, true);
})();































// Bloquear precio en "siguientes hijos" (solo lectura + hidden para enviar)
(function () {
  var modal = document.getElementById('perfilModal');
  if (!modal) return;

  modal.addEventListener('show.bs.modal', function (ev) {
    var ev = ev; if (ev && ev.target && ev.target.id === 'perfilModal') return;
    var trigger = ev.relatedTarget;
    // Si no vino desde una fila, no hacemos nada (esto deja libre al padre y al primer hijo)
    if (!trigger || trigger.tagName !== 'TR') return;

    var form = modal.querySelector('form');
    if (!form) return;

    // Detectar si ya existe primer hijo (por atributos que ya pones en la fila)
    var hasChild = (trigger.getAttribute('data-has-child') === '1');
    var anchor   = (trigger.getAttribute('data-first-child-price') || trigger.getAttribute('data-anchor-price') || '').trim();

    if (!hasChild) return; // primer hijo => debe ser editable

    // Tomar precio a fijar: ancla si existe; si no, lo que ya llenó el servidor en el input
    var currentInput = form.querySelector('input[name="soles"]');
    var price = anchor || (currentInput ? (currentInput.value || '') : '');

    // Limpiar todo "soles" previo para evitar duplicados
    form.querySelectorAll('input[name="soles"]').forEach(function (el) { el.remove(); });
    // Borrar displays antiguos si quedaron
    form.querySelectorAll('#modalChildPrecio_display').forEach(function (el) { el.remove(); });

    // Montar dentro del slot
    var slot = form.querySelector('#childPriceSlot') || form;

    // Visible solo lectura (sin name)
    var vis = document.createElement('input');
    vis.type = 'text';
    vis.className = 'form-control bg-light';
    vis.id = 'modalChildPrecio_display';
    vis.readOnly = true;
    vis.value = price;
    slot.innerHTML = '';
    slot.appendChild(vis);

    // Hidden real para submit
    var hid = document.createElement('input');
    hid.type = 'hidden';
    hid.name = 'soles';
    hid.value = price;
    slot.appendChild(hid);
  }, true);
})();














// Bloquear precio en "siguientes hijos" (solo lectura + hidden para enviar)
(function () {
  var modal = document.getElementById('perfilModal');
  if (!modal) return;

  modal.addEventListener('shown.bs.modal', function (ev) {
    var ev = ev; if (ev && ev.target && ev.target.id === 'perfilModal') return;
    var trigger = ev.relatedTarget;
    // Solo aplica cuando abres desde una FILA (TR) y esa fila ya tiene primer hijo
    if (!trigger || trigger.tagName !== 'TR') return;

    var hasChild = (trigger.getAttribute('data-has-child') === '1');
    if (!hasChild) return; // si NO hay primer hijo, este es el primero => editable (no tocamos)

    var form = modal.querySelector('form');
    if (!form) return;
    var slot = form.querySelector('#childPriceSlot') || form;

    // Precio de referencia: first-child-price / anchor-price o, de fallback, lo que haya en el input
    var anchor = (trigger.getAttribute('data-first-child-price') || trigger.getAttribute('data-anchor-price') || '').trim();
    var current = (function(){ var pr=form.querySelector('input[name="soles"]'); return pr ? (pr.value || '') : ''; })();
    var price = anchor || current || '';

    // Limpiar cualquier "soles" previo y displays viejos
    form.querySelectorAll('input[name="soles"]').forEach(function (el) { el.remove(); });
    form.querySelectorAll('#modalChildPrecio_display').forEach(function (el) { el.remove(); });

    // Reconstruir el slot solo con:
    // 1) visible SOLO LECTURA (sin name) y 2) hidden real para enviar
    slot.innerHTML = '';

    var vis = document.createElement('input');
    vis.type = 'text';
    vis.className = 'form-control bg-light';
    vis.id = 'modalChildPrecio_display';
    vis.readOnly = true;
    vis.setAttribute('readonly','readonly');
    vis.value = price;
    slot.appendChild(vis);

    var hid = document.createElement('input');
    hid.type = 'hidden';
    hid.name = 'soles';
    hid.value = price;
    slot.appendChild(hid);

    // Observador para impedir que otro JS lo haga editable o duplique inputs
    if (modal.__childLockObs) modal.__childLockObs.disconnect();
    modal.__childLockObs = new MutationObserver(function () {
      // Mantener un solo hidden "soles" (el nuestro)
      form.querySelectorAll('input[name="soles"]').forEach(function (el) {
        if (el !== hid) el.remove();
      });
      // Reforzar solo-lectura del visible
      var d = slot.querySelector('#modalChildPrecio_display');
      if (d) {
        d.readOnly = true;
        d.setAttribute('readonly','readonly');
        d.classList.add('bg-light');
        // evitar que otro script cambie el valor mostrado
        d.value = price;
      }
    });
    modal.__childLockObs.observe(form, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['name','type','readonly','class','value']
    });
  });

  modal.addEventListener('hidden.bs.modal', function () {
    var ev = ev; if (ev && ev.target && ev.target.id === 'perfilModal') return;
    if (modal.__childLockObs) { modal.__childLockObs.disconnect(); modal.__childLockObs = null; }
  });
})();




















// Adjunta la lógica de precio a un modal + input de cabecera
(function attachPriceSwap(modalId, headId, slotSelector, groupSelector){
  try {
    var modal = document.getElementById(modalId);
    var head  = document.getElementById(headId);
    if (!modal || !head) return;

    function qForm(){ return modal.querySelector('form') || modal; }

    function rebuildSlot(form){
      var group = form.querySelector(groupSelector);
      if (!group) return null;
      var labelHTML = group.querySelector('label')?.outerHTML || '<label class="form-label">Precio (S/)</label>';
      group.innerHTML = labelHTML + '<div '+slotSelector.replace('#','id="')+'" data-price-slot></div>';
      return form.querySelector(slotSelector);
    }

    function purgeForeignSoles(form, keep){
      form.querySelectorAll('input[name="soles"]').forEach(function(inp){
        if (!keep || inp !== keep) inp.remove();
      });
      form.querySelectorAll('#modalChildPrecio,#modalChildPrecio_display,[data-price-mount]').forEach(function(n){ n.remove(); });
      var tailHidden = form.querySelector(':scope > input[name="soles"]');
      if (tailHidden && (!keep || tailHidden !== keep)) tailHidden.remove();
    }

    function mountEditable(slot){
      slot.innerHTML = '';
      var pr = document.createElement('input');
      pr.type = 'number'; pr.step = '0.01'; pr.min = '0';
      pr.name = 'soles'; pr.id = 'modalChildPrecio';
      pr.className = 'form-control'; pr.placeholder = 'Ingrese precio';
      pr.autocomplete = 'off'; pr.removeAttribute('readonly');
      slot.appendChild(pr);
      return pr;
    }

    function mountLocked(slot, v){
      slot.innerHTML = '';
      var vis = document.createElement('input');
      vis.type='text'; vis.className='form-control bg-light'; vis.id='modalChildPrecio_display';
      vis.readOnly = true; vis.value = v || '';
      slot.appendChild(vis);
      var hid = document.createElement('input');
      hid.type='hidden'; hid.name='soles'; hid.value=v||'';
      slot.appendChild(hid);
      return hid;
    }

    // marca aperturas desde el botón "Agregar perfil (familiar)" como PADRE
    document.addEventListener('click', function(e){
      var t = e.target;
      if (t && (t.classList?.contains('btn-add-perfil-fam') || t.matches?.('.btn-add-perfil-fam'))) {
        modal.dataset._mode = 'parent';
        modal.dataset._headSnapshot = head.value || '';
        // apertura desde botón → NO es desde fila
        delete modal.dataset._fromRow;
        delete modal.dataset._anchor;
      }
    }, true);

    // cualquier otra apertura => HIJO
    modal.addEventListener('show.bs.modal', function(ev){
      if (ev && ev.target && ev.target.id === 'perfilModal') return;
      if (modal.dataset._mode !== 'parent') modal.dataset._mode = 'child';
      // si no viene marcado como "desde fila", no usamos anchor
      if (!modal.dataset._fromRow) {
        delete modal.dataset._anchor;
      }
    }, true);

    modal.addEventListener('shown.bs.modal', function(ev){
      if (ev && ev.target && ev.target.id === 'perfilModal') return;
      var form = qForm(); if (!form) return;
      var slot = rebuildSlot(form); if (!slot) return;

      var anchor = modal.dataset._anchor || '';

      purgeForeignSoles(form, null);

      var mode  = modal.dataset._mode || 'child';

      // === CASO: abierto desde click en FILA (Streaming familiar) ===
      if (modal.dataset._fromRow === '1') {
        // consumimos el flag para esta apertura
        delete modal.dataset._fromRow;

        if (anchor) {
          // Ya existe primer hijo → precio anclado y bloqueado
          var keep = mountLocked(slot, anchor);
          purgeForeignSoles(form, keep);
          return;
        } else {
          // NO hay primer hijo aún → primer hijo editable, "Ingrese precio"
          mountEditable(slot);
          // aquí no necesitamos el estabilizador agresivo
          return;
        }
      }

      // === Resto de casos (botón Agregar perfil, etc.) ===
      if (mode === 'parent') {
        var lockVal = head.value || modal.dataset._headSnapshot || '';
        var keep = mountLocked(slot, lockVal);
        purgeForeignSoles(form, keep);

        function syncFromHead(){
          if (!modal.classList.contains('show')) return;
          if (modal.dataset._mode !== 'parent') return;
          var v = head.value || '';
          var vis = form.querySelector('#modalChildPrecio_display');
          var hid = form.querySelector('input[name="soles"]');
          if (vis) vis.value = v;
          if (hid) hid.value = v;
        }
        if (!modal.__famHeadSyncBound) {
          head.addEventListener('input', syncFromHead, {passive:true});
          modal.__famHeadSyncBound = true;
        }
      } else {
        // HIJO abierto desde botón u otros → editable normal
        var pr = mountEditable(slot);

        // estabilizador: evita que otros scripts lo bloqueen/dupliquen (solo en este caso)
        if (modal.__famStab) clearInterval(modal.__famStab);
        var t0 = Date.now();
        modal.__famStab = setInterval(function(){
          if (!modal.classList.contains('show') || (Date.now() - t0) > 1200) {
            clearInterval(modal.__famStab);
            modal.__famStab = null; return;
          }
          var inside = slot.querySelector('input[name="soles"]');
          if (!inside) inside = mountEditable(slot);
          inside.readOnly = false;
          inside.removeAttribute('readonly');
          inside.classList.remove('bg-light');
          form.querySelectorAll('input[name="soles"]').forEach(function(inp){
            if (!slot.contains(inp)) inp.remove();
          });
          var disp = form.querySelector('#modalChildPrecio_display'); if (disp) disp.remove();
        }, 50);
      }
    }, true);

    modal.addEventListener('hidden.bs.modal', function(){
      var form = qForm(); if (!form) return;
      if (modal.__famStab) { clearInterval(modal.__famStab); modal.__famStab = null; }
      delete modal.dataset._mode;
      delete modal.dataset._headSnapshot;
      delete modal.dataset._fromRow;
      delete modal.dataset._anchor;

      purgeForeignSoles(form, null);
      var slot = form.querySelector(slotSelector);
      if (slot) slot.innerHTML = '';
    }, true);

  } catch(e) {
    console.error('[fam price swap]', e);
  }
})('perfilFamiliarModal','precioFamiliarHead','#famChildPriceSlot','#famChildPriceGroup');
































;(function(){ 'use strict';
  if (window.__famOpenSmallV2) return; window.__famOpenSmallV2 = true;

  // Click en celda Plan (solo dentro de #perfiles-familiar) => abrir modal chico de Familiar
  // ================================================================
// CLICK EN CELDA PLAN (modal chico) — VERSIÓN CORREGIDA COMPLETA
// ================================================================
document.addEventListener('click', function(ev){
    // Solo si estamos dentro de la pestaña PERFILES
    const tab = document.getElementById('perfiles');
    if (!tab || !tab.contains(ev.target)) return;

    const td = ev.target.closest('td.plan-cell-perfil');
    if (!td) return;

    // Evitamos que la fila padre abra su propio modal
    ev.preventDefault();
    ev.stopPropagation();

    // 🔥 LIMPIAR SIEMPRE BACKDROPS ANTES DE ABRIR ESTE MODAL
    document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
    document.body.classList.remove('modal-open');
    document.body.style.removeProperty('padding-right');

    const modal = document.getElementById('modalCambiarPlanPerfil');
    if (!modal) return;

    const tr = td.closest('tr');

    // Obtener ID del perfil
    const idRaw =
        (td.dataset.id || '') ||
        (tr?.dataset.id || '')
        ? (td.dataset.id || tr.dataset.id || '').replace(/\D+/g, '')
        : '';

    if (!idRaw) {
        console.warn('[Perfiles] Celda Plan sin data-id');
        return;
    }

    // Guardamos celda origen por si la necesitamos
    window.__perfilLastCell = td;
    modal.dataset.context = 'perfiles';

    // Campos dentro del modal
    const idEl     = modal.querySelector('#perfilPlanId');
    const planSel  = modal.querySelector('#perfilPlanSelect');
    const colorSel = modal.querySelector('#perfilColorSelect');
    const destSel  = modal.querySelector('#perfilEnviarASelect, select[name="enviar_a"]');

    if (idEl) idEl.value = idRaw;

    // Normalizar plan
    const normPlan = p => (p || '').trim().toLowerCase();
    if (planSel) planSel.value = normPlan(td.dataset.plan || td.textContent);

    // Color de la fila
    if (colorSel && tr) {
        const c = (tr.dataset.color || '').trim();
        colorSel.value = c;
    }

    // Destino por defecto
    if (destSel) destSel.value = 'none';

    // MOSTRAR MODAL CHICO
    bootstrap.Modal.getOrCreateInstance(modal).show();
}, true);

})();


;(function(){ 'use strict';
  if (window.__famSaveSmallV2) return; window.__famSaveSmallV2 = true;

  // Guardar (solo familiar) => endpoint propio
  document.addEventListener(
    'click',
    async function (ev) {
      const btn = ev.target.closest('#btnGuardarPlanFamiliar');
      if (!btn) return;

      const modal = btn.closest('#modalCambiarPlanFamiliar');
      if (!modal) return;

      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

      const id = (modal.querySelector('#famPlanId')?.value || '').trim();
      const plan = (modal.querySelector('#famPlanSelect')?.value || '').trim();
      const color = (modal.querySelector('#famColorSelect')?.value || '').trim();
      const enviar_a = (
        modal.querySelector('#famEnviarASelect')?.value || 'none'
      )
        .trim()
        .toLowerCase();

      if (!id || !plan) {
        if (window.Swal) {
          Swal.fire({
            icon: 'warning',
            title: 'Falta ID o Plan',
            text: 'Reabre el modal desde la celda Plan.'
          });
        }
        return;
      }

      // Evitar doble submit
      if (btn.disabled) return;
      btn.disabled = true;
      const oldHtml = btn.innerHTML;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

      try {
        // Endpoint relativo al streaming.php
        const endpoint = new URL(
          'ajax/perfiles_familiar_plan_update.php',
          document.baseURI
        ).toString();

        const body = new URLSearchParams();
        body.set('id', id);
        body.set('plan', plan);
        body.set('enviar_a', enviar_a);
        if (color !== '') body.set('color', color);

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/x-www-form-urlencoded;charset=UTF-8'
          },
          credentials: 'same-origin',
          redirect: 'follow',
          body
        });

        const ct = res.headers.get('content-type') || '';
        let data = null;
        if (ct.includes('application/json')) {
          try {
            data = await res.json();
          } catch (_) {
            data = null;
          }
        }

        if (!res.ok || !data || !data.ok) {
          throw new Error(
            (data && data.error) || 'Error del servidor (' + res.status + ')'
          );
        }

        // ✅ Actualizar la UI en la tabla Familiar
        const td =
          document.querySelector(
            '#perfiles-familiar td.plan-cell-perfil[data-id="' + id + '"]'
          ) ||
          document.querySelector(
            '#perfiles-familiar tr[data-entidad="perfil_fam"][data-id="' +
              id +
              '"] .plan-cell-perfil'
          );
        const row =
          td?.closest('tr') ||
          document.querySelector(
            '#perfiles-familiar tr[data-entidad="perfil_fam"][data-id="' +
              id +
              '"]'
          );

        if (td) {
          td.textContent = plan;
          td.setAttribute('data-plan', plan);
        }
        if (row) {
          row.classList.remove(
            'row-color-rojo',
            'row-color-azul',
            'row-color-verde',
            'row-color-blanco'
          );
          row.removeAttribute('data-color');
          if (color && ['rojo', 'azul', 'verde', 'blanco'].includes(color)) {
            row.classList.add('row-color-' + color);
            row.setAttribute('data-color', color);
          }
        }

        // Cerrar modal y mostrar éxito + RECARGAR
        bootstrap.Modal.getOrCreateInstance(modal).hide();
        if (window.Swal) {
          Swal.fire({
            icon: 'success',
            title: 'Actualizado',
            timer: 1200,
            showConfirmButton: false
          }).then(() => {
            // Recargar la página para que se vean los cambios
            window.location.reload();
          });
        } else {
          // Si no existe Swal por alguna razón, igual recargamos
          window.location.reload();
        }
      } catch (err) {
        console.error('[Familiar] Guardar plan:', err);
        if (window.Swal) {
          Swal.fire({
            icon: 'error',
            title: 'No se pudo guardar',
            text: err.message || 'Intenta de nuevo'
          });
        }
      } finally {
        btn.disabled = false;
        btn.innerHTML = oldHtml;
      }
    },
    true // captura
  );

})();












// /public/assets/js/app.js
// Perfiles — abrir modal chico desde celda Plan y setear ID correctamente
(function(){
  'use strict';
  const tab   = document.getElementById('perfiles');
  const modal = document.getElementById('modalCambiarPlanPerfil');
  if (!tab || !modal || !window.bootstrap) return;

  const normPlan = s => {
    s = String(s||'').trim().toLowerCase();
    return ['individual','standard','premium'].includes(s) ? s : 'premium';
  };

  // Click en celda Plan (solo dentro de la pestaña Perfiles)
  document.addEventListener('click', function(ev){
    if (!tab.contains(ev.target)) return;
    const td = ev.target.closest('td.plan-cell-perfil');
    if (!td) return;

    ev.preventDefault(); ev.stopPropagation();

    const tr    = td.closest('tr');
    const idRaw = (td.getAttribute('data-id') || tr?.getAttribute('data-id') || '').replace(/\D+/g,'');
    if (!idRaw) { console.warn('[Perfiles] sin data-id en celda/row'); return; }

    // Guardamos referencia de la última celda (para el safety net)
    window.__perfilLastCell = td;

    // Contexto para el botón Guardar
    modal.dataset.context = 'perfiles';

    // Prefill de campos del modal
    const idEl     = modal.querySelector('#perfilPlanId');
    const planSel  = modal.querySelector('#perfilPlanSelect');
    const colorSel = modal.querySelector('#perfilColorSelect, select[name="color"]');
    const destSel  = modal.querySelector('#perfilEnviarASelect, select[name="enviar_a"]');

    if (idEl)    idEl.value = idRaw;
    if (planSel) planSel.value = normPlan(td.getAttribute('data-plan') || td.textContent);

    if (colorSel && tr) {
      const c = (tr.getAttribute('data-color') || '').trim();
      colorSel.value = c;
    }
    if (destSel) destSel.value = 'none';

    bootstrap.Modal.getOrCreateInstance(modal).show();
  }, true);

  // Safety net: si el modal se abre por otro camino y el hidden quedó 0, lo corregimos
  modal.addEventListener('show.bs.modal', function(){
    const idEl = modal.querySelector('#perfilPlanId');
    if (idEl && (!idEl.value || idEl.value === '0')) {
      const td = window.__perfilLastCell || tab.querySelector('td.plan-cell-perfil[data-id]');
      const idRaw = td ? (td.getAttribute('data-id')||'').replace(/\D+/g,'') : '';
      if (idRaw) idEl.value = idRaw;
    }
  }, true);
})();





















// /public/assets/js/app.js
// (FAMILIAR) Abrir modal chico desde la celda Plan y setear contexto + ID correctos
(function () {
  'use strict';
  const famPane = document.getElementById('perfiles-familiar');
  const modal   = document.getElementById('modalCambiarPlanPerfil');
  if (!famPane || !modal || !window.bootstrap) return;

  const normPlan = s => {
    s = String(s||'').trim().toLowerCase();
    return ['individual','standard','premium'].includes(s) ? s : 'premium';
  };

  document.addEventListener('click', function (ev) {
    if (!famPane.contains(ev.target)) return;

    const td = ev.target.closest('td.plan-cell-perfil');
    if (!td) return;                          // no es la celda Plan
    const tr = td.closest('tr');
    if (!tr || tr.getAttribute('data-entidad') !== 'perfil_fam') return;

    ev.preventDefault(); ev.stopPropagation();

    // Guardamos la última celda de FAMILIAR para actualizar UI luego
    window.__famLastCell = td;

    // Contexto y prefill
    modal.dataset.context = 'familiar';

    const id   = (td.getAttribute('data-id') || tr.getAttribute('data-id') || '').replace(/\D+/g,'');
    const plan = normPlan(td.getAttribute('data-plan') || td.textContent);

    const idEl     = modal.querySelector('#perfilPlanId');
    const planSel  = modal.querySelector('#perfilPlanSelect');
    const colorSel = modal.querySelector('#perfilColorSelect, select[name="color"]');
    const destSel  = modal.querySelector('#perfilEnviarASelect, select[name="enviar_a"]');

    if (idEl)    idEl.value = id;
    if (planSel) planSel.value = plan;
    if (colorSel) {
      const cur = (tr.getAttribute('data-color') || '').trim();
      colorSel.value = cur || '';
    }
    if (destSel) destSel.value = 'none';

    bootstrap.Modal.getOrCreateInstance(modal).show();
  }, true);
})();














;(function(){
  'use strict';
  if (!window.bootstrap) return;
  if (window.__famPlanHandlerV1) return; window.__famPlanHandlerV1 = true;

  // Área de la pestaña "Streaming familiar"
  const famPane = document.getElementById('perfiles-familiar');
  if (!famPane) return;

  // Abrir modal chico desde la celda Plan, SOLO en familiar
  document.addEventListener('click', function(ev){
    const td = ev.target.closest('.plan-cell-perfil');
    if (!td) return;

    const row = td.closest('tr');
    if (!row || row.getAttribute('data-entidad') !== 'perfil_fam') return; // <- clave: solo familiar

    ev.preventDefault(); ev.stopPropagation();

    const modal = document.getElementById('modalCambiarPlanPerfil');
    if (!modal) { console.warn('[Familiar] Falta #modalCambiarPlanPerfil'); return; }

    // Contexto para que el Guardar sepa que es FAMILIAR
    modal.dataset.context = 'familiar';

    // ID del registro familiar (preferir el de la celda; si no, el del tr)
    const id = (td.getAttribute('data-id') || row.getAttribute('data-id') || '').replace(/\D+/g,'');
    const plan = (td.getAttribute('data-plan') || td.textContent || 'individual').trim().toLowerCase();

    // Prellenar modal chico
    const idEl    = modal.querySelector('#perfilPlanId');
    const planSel = modal.querySelector('#perfilPlanSelect');
    const colorEl = modal.querySelector('#perfilColorSelect, select[name="color"]');
    const destEl  = modal.querySelector('#perfilEnviarASelect, select[name="enviar_a"]');

    if (idEl)    idEl.value = id;
    if (planSel) planSel.value = ['individual','standard','premium'].includes(plan) ? plan : 'premium';
    if (colorEl) colorEl.value = (row.getAttribute('data-color') || '');
    if (destEl)  destEl.value = 'none';

    // Guardar última celda para actualizar UI luego
    window.__famLastPlanCell = td;

    bootstrap.Modal.getOrCreateInstance(modal).show();
  }, true);

  // Guardar — SOLO cuando el modal está en contexto "familiar"
  document.addEventListener('click', async function(ev){
    const btn = ev.target.closest('#btnGuardarPlanPerfil');
    if (!btn) return;

    const modal = btn.closest('.modal');
    if (!modal || modal.dataset.context !== 'familiar') return; // <- no interferimos con Perfiles

    const idEl     = modal.querySelector('#perfilPlanId');
    const planSel  = modal.querySelector('#perfilPlanSelect');
    const colorSel = modal.querySelector('#perfilColorSelect, select[name="color"]');
    const destSel  = modal.querySelector('#perfilEnviarASelect, select[name="enviar_a"]');

    const id       = (idEl?.value || '').replace(/\D+/g,'');
    const plan     = planSel ? String(planSel.value||'').toLowerCase() : '';
    const color    = colorSel ? String(colorSel.value||'').toLowerCase().trim() : '';
    const enviar_a = destSel ? String(destSel.value||'none').toLowerCase() : 'none';

    if (!id || !plan) { console.warn('[Familiar] Datos incompletos', {id,plan}); return; }

    // Feedback
    const oldHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>Guardando...';

    // Endpoint EXCLUSIVO de familiar
    const endpoint = new URL('ajax/perfiles_familiar_plan_update.php', document.baseURI).toString();

    try {
      const params = new URLSearchParams({ id, plan, enviar_a });
      if (color !== '') params.set('color', color);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8' },
        body: params,
        credentials: 'same-origin',
        redirect: 'follow',
        cache: 'no-store'
      });

      const ct = res.headers.get('content-type') || '';
      const raw = await res.text();
      const data = ct.includes('application/json') ? (JSON.parse(raw)) : null;

      if (res.ok && data && data.ok) {
        // Actualizar UI local
        const td  = window.__famLastPlanCell || document.querySelector(`tr[data-entidad="perfil_fam"] td.plan-cell-perfil[data-id="${id}"]`);
        const row = td ? td.closest('tr') : null;

        if (td) {
          td.textContent = plan;
          td.setAttribute('data-plan', plan);
        }
        if (row) {
          // color opcional
          row.classList.remove('row-color-rojo','row-color-azul','row-color-verde','row-color-blanco');
          row.removeAttribute('data-color');
          const newColor = (typeof data.color === 'string' ? data.color : (color || '')).trim();
          if (['rojo','azul','verde','blanco'].includes(newColor)) {
            row.classList.add('row-color-' + newColor);
            row.setAttribute('data-color', newColor);
          }
        }

        bootstrap.Modal.getOrCreateInstance(modal).hide();
        if (window.Swal) Swal.fire({icon:'success',title:'Actualizado',timer:1200,showConfirmButton:false});
      } else {
        const msg = (data && data.error) || raw || 'Intenta de nuevo';
        if (window.Swal) Swal.fire({icon:'error',title:'No se pudo guardar',text:msg});
        else alert('No se pudo guardar: ' + msg);
      }
    } catch (err) {
      console.error('[Familiar] Fetch error:', err);
      if (window.Swal) Swal.fire({icon:'error',title:'Error de red'});
    } finally {
      btn.disabled = false;
      btn.innerHTML = oldHtml;
    }
  }, true);
})();

















// === Familiar: modal chico (Plan + Color + Enviar) — independiente ===
(function () {
  const pane  = document.getElementById('perfiles-familiar');
  const tabla = pane ? pane.querySelector('table') : null;
  if (!pane || !tabla || !window.bootstrap) return;

  const normPlan = v => (['individual','standard','premium'].includes(String(v||'').toLowerCase().trim()) ? String(v).toLowerCase().trim() : 'premium');

  tabla.addEventListener('click', (ev) => {
    const td = ev.target.closest('.plan-cell-perfil');
    if (!td || !pane.contains(td)) return;
    ev.preventDefault(); ev.stopPropagation();

    const modal = document.getElementById('modalCambiarPlanPerfil');
    if (!modal) { console.warn('[Familiar] Falta #modalCambiarPlanPerfil'); return; }
    modal.dataset.context = 'familiar';

    const row   = td.closest('tr');
    const id    = (td.getAttribute('data-id') || row?.getAttribute('data-id') || '').replace(/\D+/g,'');
    const plan  = normPlan(td.getAttribute('data-plan') || td.textContent);

    const idEl     = modal.querySelector('#perfilPlanId');
    const planSel  = modal.querySelector('#perfilPlanSelect');
    const colorSel = modal.querySelector('#perfilColorSelect, select[name="color"]');
    const destSel  = modal.querySelector('#perfilEnviarASelect, select[name="enviar_a"]');
    const btnSave  = modal.querySelector('#btnGuardarPlanPerfil');
    if (!idEl || !planSel || !btnSave) return;

    idEl.value = id;
    planSel.value = plan;
    if (colorSel) colorSel.value = (row?.getAttribute('data-color')||'');
    if (destSel)  destSel.value  = 'none';

    btnSave.onclick = async function () {
      const _id       = (idEl.value || '').trim();
      const _plan     = planSel.value;
      const _enviar_a = destSel ? String(destSel.value || 'none').toLowerCase() : 'none';
      const _color    = colorSel ? String(colorSel.value || '').trim() : '';
      if (!_id) { console.warn('[Familiar] ID vacío'); return; }

      const endpoint = new URL('ajax/perfiles_familiar_plan_update.php', document.baseURI).toString();

      const oldHtml = btnSave.innerHTML;
      btnSave.disabled = true;
      btnSave.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>Guardando...';

      try {
        // redundancia de nombres por compatibilidad
        const params = new URLSearchParams({ id:_id, perfil_fam_id:_id, plan:_plan, enviar_a:_enviar_a });
        if (_color !== '') params.set('color', _color);

        console.log('[familiar] POST', endpoint, params.toString());
        const res = await fetch(endpoint, { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'}, body: params });
        const raw = await res.text(); let data; try { data = JSON.parse(raw); } catch { data = null; }
        console.log('[familiar] RESP', res.status, raw);

        if (res.ok && data && data.ok) {
          // opcionalmente refresca
          if (window.Swal) await Swal.fire({icon:'success',title:'Actualizado',timer:1200,showConfirmButton:false});
          bootstrap.Modal.getOrCreateInstance(modal).hide();
          location.reload();
        } else {
          const msg = (data && data.error) || `HTTP ${res.status}`;
          if (window.Swal) Swal.fire({icon:'error', title:'No se pudo guardar', text: msg});
        }
      } catch (_) {
        if (window.Swal) Swal.fire({icon:'error', title:'Error de red'});
      } finally {
        btnSave.disabled = false; btnSave.innerHTML = oldHtml;
      }
    };

    bootstrap.Modal.getOrCreateInstance(modal).show();
  });
})();















































;(function(){ if (window.__spMoveBound) return; window.__spMoveBound = true; 
    document.addEventListener('click', async (ev) => {
  const btn = ev.target.closest('.js-move-to');
  if (!btn) return;

  const tr  = btn.closest('tr');
  const id  = tr?.dataset.id || '';
  const dst = btn.dataset.dst; // 'stock' | 'pausa' | 'perfiles' (si también vuelves a perfiles usa tu endpoint actual)
  const from= tr?.dataset.entidad; // 'stock' | 'pausa'

  if (!id || !from || !dst) return;

  const body = new URLSearchParams({ id, from, to: dst });

  try {
    const res = await fetch('ajax/move_stock_pausa.php', {
      method:'POST',
      headers:{ 'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8' },
      body
    });
    const data = await res.json();
    if (data.ok) {
      if (window.Swal) await Swal.fire({ icon:'success', title:'Movido', timer:1000, showConfirmButton:false });
      location.reload();
    } else {
      Swal?.fire({ icon:'error', title:'No se pudo mover', text:data.error || 'Error' });
    }
  } catch (e) {
    Swal?.fire({ icon:'error', title:'Error de red' });
  }
});

})();































// === Perfiles & Familiar: modal chico unificado (abre y guarda plan/color/movimiento) ===
(function () {
  if (window.__pfBound) return; window.__pfBound = true;

  const MODAL_ID = 'modalCambiarPlanPerfil';

  // Normaliza valores de plan a los 3 admitidos por el backend
  function normalizePlan(v) {
    v = String(v || '').toLowerCase().trim();
    if (v === 'estándar' || v === 'estandar') v = 'standard';
    return ['individual','standard','premium'].includes(v) ? v : 'premium';
  }

  // Helpers para “desbloquear” selects que queden disabled/readOnly por herencia de HTML
  function enableSelectHard(sel) {
    if (!sel) return;
    sel.disabled = false;
    sel.removeAttribute('disabled');
    sel.removeAttribute('readonly');
    sel.removeAttribute('aria-disabled');
    sel.style.pointerEvents = '';
    const fs = sel.closest('fieldset[disabled]'); if (fs) fs.removeAttribute('disabled');
    const dis = sel.closest('.disabled');        if (dis) dis.classList.remove('disabled');
  }
  function replaceIfStillDisabled(sel) {
    if (!sel) return sel;
    if (!sel.disabled) return sel;
    const clone = sel.cloneNode(true);
    clone.disabled = false;
    clone.removeAttribute('disabled');
    clone.removeAttribute('readonly');
    clone.removeAttribute('aria-disabled');
    clone.style.pointerEvents = '';
    sel.replaceWith(clone);
    return clone;
  }

  // Aplica/actualiza color visual en la fila si usas clases row-color-*
  function applyRowColor(tr, val) {
    if (!tr) return;
    tr.classList.remove('row-color-rojo','row-color-azul','row-color-verde','row-color-blanco');
    if (!val || val === 'restablecer') {
      tr.removeAttribute('data-color');
      return;
    }
    tr.setAttribute('data-color', val);
    if (val === 'rojo')   tr.classList.add('row-color-rojo');
    if (val === 'azul')   tr.classList.add('row-color-azul');
    if (val === 'verde')  tr.classList.add('row-color-verde');
    if (val === 'blanco') tr.classList.add('row-color-blanco');
  }

  // Pinta el <select> de destino según el contexto y lo habilita
  function patchDestino(modal, ctx) {
    const nodes = modal.querySelectorAll('#perfilEnviarASelect, select[name="enviar_a"]');
    nodes.forEach((node) => {
      let sel = node;
      // Opciones permitidas (habilitamos movimiento también en Familiar)
      if (ctx === 'familiar') {
        sel.innerHTML = [
          '<option value="none">(mantener en Familiar)</option>',
          '<option value="stock">Mover a Stock</option>',
          '<option value="pausa">Mover a Pausa</option>'
        ].join('');
      } else {
        sel.innerHTML = [
          '<option value="none">(mantener en Perfiles)</option>',
          '<option value="stock">Mover a Stock</option>',
          '<option value="pausa">Mover a Pausa</option>'
        ].join('');
      }
      enableSelectHard(sel);
      sel = replaceIfStillDisabled(sel);
      if (!sel.value || !['none','stock','pausa'].includes(sel.value)) sel.value = 'none';
      sel.title = '';
    });
  }

  let lastCell = null; // recordamos la celda clickeada para actualizar UI local

  // --- Abrir modal desde la celda de plan (CAPTURE para cortar handlers viejos/duplicados)
  document.addEventListener('click', function (ev) {
    const td = ev.target.closest('.plan-cell-perfil, .plan-cell-familiar');
    if (!td) return;

    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();

    const ctx   = td.classList.contains('plan-cell-familiar') ? 'familiar' : 'perfiles';
    const modal = document.getElementById(MODAL_ID);
    if (!modal) return;

    // Guardamos contexto y preparamos el select de destino
    modal.dataset.context = ctx;
    patchDestino(modal, ctx);

    lastCell = td;

    // ID/Plan actuales
    const id   = String(td.getAttribute('data-id') || '').replace(/\D+/g, '');
    const plan = normalizePlan(td.getAttribute('data-plan') || td.textContent);

    // Setear inputs del modal (sin optional chaining en asignación)
    const idEl = modal.querySelector('#perfilPlanId');
    if (!idEl) { console.warn('[PF] Falta #perfilPlanId'); return; }
    idEl.value = id;

    const selPlan = modal.querySelector('#perfilPlanSelect');
    if (selPlan) selPlan.value = plan;

    // Color: si existe control, no forzamos nada si ya trae valor; si no, default vacío
    const selColor = modal.querySelector('#perfilColorSelect, select[name="color"]');
    if (selColor && !selColor.value) selColor.value = '';

    // Y mostramos el modal
    bootstrap.Modal.getOrCreateInstance(modal).show();
  }, true);

  // Reaplica estado del destino si el modal se reusa en otros flujos
  document.addEventListener('shown.bs.modal', function (ev) {
    const modal = ev.target;
    if (!modal || modal.id !== MODAL_ID) return;
    patchDestino(modal, modal.dataset.context || 'perfiles');
  });

  // --- Guardar (un solo listener global, con busy-flag y CAPTURE para evitar dobles envíos)
  document.addEventListener('click', async function (ev) {
    const btn = ev.target.closest('#btnGuardarPlanPerfil');
    if (!btn) return;

    const modal = document.getElementById(MODAL_ID);
    if (!modal) return;

    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();

    if (btn.dataset.busy === '1') return;
    btn.dataset.busy = '1';

    const idEl     = modal.querySelector('#perfilPlanId');
    const planSel  = modal.querySelector('#perfilPlanSelect');
    const colorSel = modal.querySelector('#perfilColorSelect, select[name="color"]');
    const destSel  = modal.querySelector('#perfilEnviarASelect, select[name="enviar_a"]');

    const id       = idEl ? String(idEl.value || '').replace(/\D+/g, '') : '';
    const plan     = planSel ? String(planSel.value || '').trim() : 'premium';
    const color    = colorSel ? String(colorSel.value || '').trim() : '';
    const ctx      = (modal.dataset.context === 'familiar') ? 'familiar' : 'perfiles';
    const enviar_a = destSel ? String(destSel.value || 'none').toLowerCase() : 'none';
    if (!id) { btn.dataset.busy = '0'; return; }

    const endpointRel = (ctx === 'familiar')
      ? 'ajax/perfiles_familiar_plan_update.php'
      : 'ajax/perfiles_plan_update.php';
    const url = new URL(endpointRel, document.baseURI);

    const params = new URLSearchParams({ id, plan });
    if (color !== '')    params.set('color', color);
    if (enviar_a !== '') params.set('enviar_a', enviar_a); // 'none' o destino válido

    const old = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>Guardando...';

    try {
      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: params.toString(),
        credentials: 'same-origin',
        cache: 'no-store'
      });

      const raw = await res.text();
      let data; try { data = JSON.parse(raw); } catch { data = null; }

      if (res.ok && data && data.ok) {
        // Si hay movimiento, recargamos para reflejar cambio de tabla
        if (enviar_a && enviar_a !== 'none') {
          bootstrap.Modal.getOrCreateInstance(modal).hide();
          if (window.Swal) await Swal.fire({ icon:'success', title:'Movido', timer:900, showConfirmButton:false });
          location.reload();
          return;
        }

        // Solo actualización local (plan/color)
        if (lastCell) {
          lastCell.textContent = plan;
          lastCell.setAttribute('data-plan', plan);
          applyRowColor(lastCell.closest('tr'), color);
        }
        bootstrap.Modal.getOrCreateInstance(modal).hide();
        if (window.Swal) Swal.fire({ icon:'success', title:'Actualizado', timer:900, showConfirmButton:false });

      } else {
        const msg = (data && data.error) || `HTTP ${res.status}`;
        // Si otro handler disparó antes y el registro ya no existe, recarga en caso de movimiento
        if (/registro no existe/i.test(msg) && enviar_a !== 'none') {
          bootstrap.Modal.getOrCreateInstance(modal).hide();
          location.reload();
          return;
        }
        if (window.Swal) Swal.fire({ icon:'error', title:'No se pudo guardar', text: msg });
      }
    } catch (e) {
      if (window.Swal) Swal.fire({ icon:'error', title:'Error de red' });
      console.error('[PF] Fetch error:', e);
    } finally {
      btn.disabled = false;
      btn.innerHTML = old;
      btn.dataset.busy = '0';
    }
  }, true);
})();


// === FAMILIAR: Agregar (cabecera) / Editar (botón) — sin tocar el flujo Hijo ===
(function () {
  const m = document.getElementById('perfilFamiliarModal');
  if (!m) return;

  function $(sel) { return m.querySelector(sel); }
  function set(sel, v) { const el = $(sel); if (el) el.value = (v == null ? '' : String(v)); }
  function today() { const d = new Date(); return d.toISOString().slice(0,10); }
  function inNDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10); }

  function clearFormForAdd() {
    const f = m.querySelector('form'); if (!f) return;
    f.reset();
    ['correo','password_plain','wa_cc','wa_local','perfil','soles'].forEach(n => set(`[name="${n}"]`, ''));
    set('select[name="combo"]', '0');
    set('select[name="estado"]', 'activo');
    set('select[name="dispositivo"]', 'tv');
    set('input[name="fecha_inicio"]', today());
    set('input[name="fecha_fin"]', inNDays(30));
    ['correo','password_plain'].forEach(n => {
      const el = $(`input[name="${n}"]`);
      if (el) { el.removeAttribute('readonly'); el.classList.remove('bg-light'); }
    });
  }

  m.addEventListener('show.bs.modal', function (ev) {
    const btn = ev.relatedTarget || null;
    const isAddFromHead = !!(btn && btn.classList && btn.classList.contains('btn-add-perfil-fam'));
    const isEditFromRow = !!(btn && btn.classList && btn.classList.contains('btn-edit-perfil-fam'));

    if (!isAddFromHead && !isEditFromRow) return; // flujo Hijo

    const titleEl  = $('#perfilFamiliarModalLabel') || m.querySelector('.modal-title');
    const submitEl = m.querySelector('button[type="submit"]');

    if (isEditFromRow) {
      let row = {};
      try { row = JSON.parse(btn.getAttribute('data-row') || '{}'); } catch (_) {}
      clearFormForAdd();
      set('input[name="action"]', 'update');
      set('input[name="id"]', row.id);
      set('input[name="correo"]', row.correo || '');
      set('input[name="password_plain"]', row.password_plain || '');
      set('input[name="fecha_inicio"]', row.fecha_inicio || today());
      set('input[name="fecha_fin"]', row.fecha_fin || inNDays(30));
      set('input[name="perfil"]', row.perfil || '');
      set('input[name="soles"]', row.soles || '');
      set('select[name="estado"]', row.estado || 'activo');
      set('select[name="dispositivo"]', row.dispositivo || 'tv');
      set('select[name="combo"]', (row.combo != null ? String(row.combo) : '0'));
      if (row.whatsapp && String(row.whatsapp).charAt(0) === '+') {
        const digits = String(row.whatsapp).replace(/\s+/g,'').replace(/^\+/,'');
        const cc = digits.length > 9 ? digits.slice(0, digits.length - 9) : '';
        const local = digits.length > 9 ? digits.slice(-9) : digits;
        set('input[name="wa_cc"]', cc);
        set('input[name="wa_local"]', local.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3'));
      }
      if (titleEl)  titleEl.textContent = 'Editar Perfil (familiar)';
      if (submitEl) submitEl.textContent = 'Guardar cambios';
      ev.stopImmediatePropagation(); ev.stopPropagation();
      return;
    }

    if (isAddFromHead) {
      clearFormForAdd();
      set('input[name="action"]', 'create');
      const head = document.getElementById('precioFamiliarHead');
      if (head && head.value) set('input[name="soles"]', head.value);
      if (titleEl)  titleEl.textContent = 'Agregar Perfil (familiar)';
      if (submitEl) submitEl.textContent = 'Guardar';
      ev.stopImmediatePropagation(); ev.stopPropagation();
      return;
    }
  }, true);

  m.addEventListener('hidden.bs.modal', function () {
    const f = m.querySelector('form'); if (f) f.reset();
    delete m.dataset.context;
    delete m.dataset.mode;
    ['correo','password_plain'].forEach(n => {
      const el = $(`input[name="${n}"]`);
      if (el) { el.removeAttribute('readonly'); el.classList.remove('bg-light'); }
    });
  });
})();


// === CHILD FIX (append-only): ensure child price editable and 0.00; no clones/readonly ===
(function(){
  var pm = document.getElementById('perfilModal');
  if (!pm) return;
  function isChild(ev){
    var rt = ev && ev.relatedTarget;
    if (rt && rt.closest && rt.closest('tr.js-parent-row[data-entidad="perfil"]')) return true;
    return !!(pm.dataset && pm.dataset.context === 'child');
  }
  function fixOnce(){
    if (!pm.classList.contains('show')) return;
    var f = pm.querySelector('form'); if (!f) return;
    var real = f.querySelector('#modalChildPrecio') || f.querySelector('input[name="soles"]');
    if (real){
      real.readOnly = false; real.removeAttribute('readonly'); real.classList.remove('bg-light');
      if (!real.value || /^\s*$/.test(real.value) || /^0+(\.0+)?$/.test(real.value)) real.value = '0.00';
    }
    f.querySelectorAll('#modalChildPrecio_display,[data-price-mount],[data-price-slot]').forEach(function(n){ n.remove(); });
    var all = f.querySelectorAll('input[name="soles"]');
    all.forEach(function(el){ if (real && el !== real) el.remove(); });
  }
  pm.addEventListener('shown.bs.modal', function(ev){
    if (!isChild(ev)) return;
    [0,20,60,120,240].forEach(function(ms){ setTimeout(fixOnce, ms); });
    requestAnimationFrame(fixOnce);
  }, true);
  pm.addEventListener('hidden.bs.modal', function(){ delete pm.dataset.context; }, true);
})();



/* =======================================================================
   CUENTAS — Filtros (scope=cuentas) v6 (estable)
   - Soporta múltiples <tbody>.
   - En "Menos días / Mayor días" reordena grupos (padre + hijos) en el PRIMER <tbody>.
   - Durante cualquier filtro/orden oculta los <tr data-sep>.
   - Al limpiar TODO restaura EXACTAMENTE el DOM original (incluidos separadores) sin recargar.
   - Plan normalizado: 'estandar'~'standard'; 'basico' incluye 'individual'.
   ======================================================================= */
(function(){
  'use strict';
  if (window.__cuFilterBoundV6) return;
  window.__cuFilterBoundV6 = true;

  var table = document.getElementById('cuentasTable');
  var box   = document.querySelector('div.__cuFilter__[data-scope="cuentas"]');
  if (!table || !box || !table.tBodies || !table.tBodies.length) return;

  var main   = box.querySelector('.cu-main');
  var plan   = box.querySelector('.cu-plan');
  var search = box.querySelector('.cu-search');
  var clear  = box.querySelector('.cu-clear');

  var targetTbody = table.tBodies[0];

  // ===== Helpers
  function debounce(fn, wait){ var t; return function(){ var a=arguments, ctx=this; clearTimeout(t); t=setTimeout(function(){ fn.apply(ctx,a); }, wait||120); }; }
  function normPlan(s){
    s = (s||'').toLowerCase();
    try { s = s.normalize('NFD').replace(/[\u0300-\u036f]/g,''); } catch(_){}
    if (s==='standard') s='estandar';
    if (s==='basic')    s='basico';
    return s;
  }
  function parseDaysFromParent(tr){
    var td = tr && tr.cells && tr.cells[5];
    if (!td) return 0;
    var m = (td.textContent||'').trim().match(/-?\d+/);
    return m ? parseInt(m[0],10) : 0;
  }
  function togglePlanSel(){
    if (!plan || !main) return;
    if ((main.value||'')==='plan') plan.style.display='';
    else { plan.style.display='none'; plan.value=''; }
  }
  function collectAllRows(){
    var out = [];
    for (var b=0;b<table.tBodies.length;b++){
      var rows = table.tBodies[b].rows;
      for (var i=0;i<rows.length;i++) out.push(rows[i]);
    }
    return out;
  }
  function setSeparatorsDisplay(show){
    for (var b=0;b<table.tBodies.length;b++){
      var rows = table.tBodies[b].rows;
      for (var i=0;i<rows.length;i++){
        var tr = rows[i];
        if (tr.hasAttribute('data-sep')) tr.style.display = show ? '' : 'none';
      }
    }
  }
  function buildGroups(){
    var rows = collectAllRows();
    var groups = [], cur=null;
    for (var i=0;i<rows.length;i++){
      var tr = rows[i];
      if (tr.hasAttribute('data-sep')) continue;
      if (tr.classList.contains('js-parent-row')){
        cur = { parent: tr, children: [], orig: parseInt(tr.getAttribute('data-orig-idx')||'0',10) || 0 };
        groups.push(cur);
      } else if (cur){ cur.children.push(tr); }
    }
    return groups;
  }
  function groupMatchesFilters(g, sel, planSel, q){
    var tr = g.parent, show = true;
    if (sel==='pendientes'){
      show = ((tr.textContent||'').toLowerCase().indexOf('pendiente')!==-1);
    } else if (sel==='plan'){
      var rowPlan = normPlan(tr.getAttribute('data-plan')||'');
      if (planSel){
        show = (planSel==='basico') ? (rowPlan==='basico'||rowPlan==='individual') : (rowPlan===planSel);
      }
    } else if (/^color_/.test(sel)){
      show = tr.classList.contains('row-color-'+sel.replace(/^color_/,''));
    }
    if (show && q){
      var correo  = (tr.getAttribute('data-correo')||'').toLowerCase();
      var cliente = (tr.querySelector('.cliente')?.textContent||'').toLowerCase();
      if (correo.indexOf(q)===-1 && cliente.indexOf(q)===-1) show=false;
    }
    return show;
  }

  // ===== Índice original (incluye separadores y su <tbody> destino)
  var __origOrder = (function snapshotOriginal(){
    var snap = [];
    for (var b=0;b<table.tBodies.length;b++){
      var tb = table.tBodies[b];
      var rows = tb.rows;
      for (var i=0;i<rows.length;i++){
        var tr = rows[i];
        snap.push({ row: tr, parent: tb });
      }
    }
    // asigna data-orig-idx solo a padres
    var idx=0;
    for (var k=0;k<snap.length;k++){
      var tr = snap[k].row;
      if (!tr.hasAttribute('data-sep') && tr.classList.contains('js-parent-row') && !tr.hasAttribute('data-orig-idx')){
        tr.setAttribute('data-orig-idx', String(idx++));
      }
    }
    return snap;
  })();

  function restoreOriginal(){
    // reinyectamos TODAS las filas a su <tbody> original en el orden exacto
    for (var i=0;i<__origOrder.length;i++){
      var it = __origOrder[i];
      it.parent.appendChild(it.row);
      it.row.style.display = ''; // visible
    }
    setSeparatorsDisplay(true);   // fechas visibles en modo "todo limpio"
  }

  function apply(){
    var q        = (search && search.value || '').trim().toLowerCase();
    var sel      = (main && main.value || '');
    var planSel  = normPlan(plan && plan.value || '');

    var isDaysSort     = (sel==='dias_asc' || sel==='dias_desc');
    var isAnyFilter    = !!(q || planSel || (/^(pendientes|plan|color_)/.test(sel)));
    var somethingOn    = isDaysSort || isAnyFilter;

    // separadores: ocultos si hay algo activo; visibles si todo está limpio
    setSeparatorsDisplay(!somethingOn);

    if (!somethingOn){
      // restaurar DOM original
      restoreOriginal();
      return;
    }

    if (isDaysSort){
      // ordenar por días: mover grupos al primer <tbody>
      var groups = buildGroups();
      for (var i=0;i<groups.length;i++){
        var g = groups[i];
        g.show = groupMatchesFilters(g, sel, planSel, q);
        g.days = parseDaysFromParent(g.parent);
      }
      var order = groups.slice();
      if (sel==='dias_asc') order.sort(function(a,b){ return (a.days-b.days) || (a.orig-b.orig); });
      else                  order.sort(function(a,b){ return (b.days-a.days) || (a.orig-b.orig); });

      var frag = document.createDocumentFragment();
      for (var j=0;j<order.length;j++){
        var gg = order[j];
        gg.parent.style.display = gg.show ? '' : 'none';
        frag.appendChild(gg.parent);
        for (var h=0; h<gg.children.length; h++){
          gg.children[h].style.display = gg.show ? '' : 'none';
          frag.appendChild(gg.children[h]);
        }
      }
      targetTbody.appendChild(frag);
      return;
    }

    // solo filtrar (sin reordenar)
    var rows = collectAllRows();
    var parentVisible = true;
    for (var r=0;r<rows.length;r++){
      var tr = rows[r];
      if (tr.hasAttribute('data-sep')) continue;
      var isParent = tr.classList.contains('js-parent-row');
      if (isParent){
        var show = groupMatchesFilters({parent:tr}, sel, planSel, q);
        tr.style.display = show ? '' : 'none';
        parentVisible = show;
      } else {
        tr.style.display = parentVisible ? '' : 'none';
      }
    }
  }

  // Bind
  if (main)   main.addEventListener('change', function(){ togglePlanSel(); apply(); });
  if (plan)   plan.addEventListener('change', apply);
  if (search) search.addEventListener('input', debounce(apply, 150));
  if (clear)  clear.addEventListener('click', function(){
    if (main)   main.value = '';
    if (plan)   plan.value = '';
    if (search) search.value = '';
    togglePlanSel();
    apply(); // esto restaura DOM original
  });

  // Init
  togglePlanSel();
  apply();

  document.addEventListener('shown.bs.tab', function(e){
    var t = e.target && (e.target.getAttribute('data-bs-target') || e.target.getAttribute('href')) || '';
    if (t === '#cuentas') { togglePlanSel(); apply(); }
  });
})();




/* =======================================================================
   CUENTAS — Filtros (scope=cuentas) v6 (estable)
   - Multi-<tbody> soportado
   - Orden por DÍAS reubica grupos (padre+hijos) en el PRIMER <tbody>
   - Oculta separadores (tr[data-sep]) cuando hay filtro/orden
   - "Limpiar" restaura el DOM EXACTO original (sin recargar)
   - Plan normalizado: 'estandar'~'standard'; 'basico' incluye 'individual'
   ======================================================================= */
(function(){
  'use strict';
  if (window.__cuFilterBoundV6) return;
  window.__cuFilterBoundV6 = true;

  var table = document.getElementById('cuentasTable');
  var box   = document.querySelector('div.__cuFilter__[data-scope="cuentas"]');
  if (!table || !box || !table.tBodies || !table.tBodies.length) return;

  var main   = box.querySelector('.cu-main');
  var plan   = box.querySelector('.cu-plan');
  var search = box.querySelector('.cu-search');
  var clear  = box.querySelector('.cu-clear');
  var targetTbody = table.tBodies[0];

  function debounce(fn, wait){ var t; return function(){ var a=arguments, ctx=this; clearTimeout(t); t=setTimeout(function(){ fn.apply(ctx,a); }, wait||120); }; }
  // ✅ Normaliza cualquier texto de plan a un slug sin tildes
function normPlan(p){
  const s = String(p || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'') // quita tildes
    .toLowerCase().trim();

  if (s.includes('premium')) return 'premium';
  if (s.includes('stand') || s.includes('estandar')) return 'estandar';
  if (s.includes('basic') || s.includes('individual')) return 'individual';
  return 'individual';
}

// (Opcional) etiqueta para mostrar bonito en UI
function planLabel(slug){
  if (slug === 'estandar') return 'Estándar';
  if (slug === 'individual') return 'Individual';
  return 'Premium';
}

  function parseDaysFromParent(tr){
    var td = tr && tr.cells && tr.cells[5];
    if (!td) return 0;
    var m = (td.textContent||'').trim().match(/-?\d+/);
    return m ? parseInt(m[0],10) : 0;
  }
  function togglePlanSel(){
    if (!plan || !main) return;
    if ((main.value||'')==='plan') plan.style.display='';
    else { plan.style.display='none'; plan.value=''; }
  }
  function collectAllRows(){
    var out = [];
    for (var b=0;b<table.tBodies.length;b++){
      var rows = table.tBodies[b].rows;
      for (var i=0;i<rows.length;i++) out.push(rows[i]);
    }
    return out;
  }
  function setSeparatorsDisplay(show){
    for (var b=0;b<table.tBodies.length;b++){
      var rows = table.tBodies[b].rows;
      for (var i=0;i<rows.length;i++){
        var tr = rows[i];
        if (tr.hasAttribute('data-sep')) tr.style.display = show ? '' : 'none';
      }
    }
  }
  function buildGroups(){
    var rows = collectAllRows();
    var groups = [], cur=null;
    for (var i=0;i<rows.length;i++){
      var tr = rows[i];
      if (tr.hasAttribute('data-sep')) continue;
      if (tr.classList.contains('js-parent-row')){
        cur = { parent: tr, children: [], orig: parseInt(tr.getAttribute('data-orig-idx')||'0',10) || 0 };
        groups.push(cur);
      } else if (cur){ cur.children.push(tr); }
    }
    return groups;
  }
  function groupMatchesFilters(g, sel, planSel, q){
    var tr = g.parent, show = true;
    if (sel==='pendientes'){
      show = ((tr.textContent||'').toLowerCase().indexOf('pendiente')!==-1);
    } else if (sel==='plan'){
      var rowPlan = normPlan(tr.getAttribute('data-plan')||'');
      if (planSel){
        show = (planSel==='basico') ? (rowPlan==='basico'||rowPlan==='individual') : (rowPlan===planSel);
      }
    } else if (/^color_/.test(sel)){
      show = tr.classList.contains('row-color-'+sel.replace(/^color_/,''));
    }
    if (show && q){
      var correo  = (tr.getAttribute('data-correo')||'').toLowerCase();
      var cliente = (tr.querySelector('.cliente')?.textContent||'').toLowerCase();
      if (correo.indexOf(q)===-1 && cliente.indexOf(q)===-1) show=false;
    }
    return show;
  }

  // Snapshot DOM original (todas las filas y su tbody)
  var __origOrder = (function(){
    var snap = [];
    for (var b=0;b<table.tBodies.length;b++){
      var tb = table.tBodies[b];
      var rows = tb.rows;
      for (var i=0;i<rows.length;i++){
        var tr = rows[i];
        snap.push({ row: tr, parent: tb });
      }
    }
    // Asignar indice original a padres (si falta)
    var idx=0;
    for (var k=0;k<snap.length;k++){
      var tr = snap[k].row;
      if (!tr.hasAttribute('data-sep') && tr.classList.contains('js-parent-row') && !tr.hasAttribute('data-orig-idx')){
        tr.setAttribute('data-orig-idx', String(idx++));
      }
    }
    return snap;
  })();

  function restoreOriginal(){
    for (var i=0;i<__origOrder.length;i++){
      var it = __origOrder[i];
      it.parent.appendChild(it.row);
      it.row.style.display = '';
    }
    setSeparatorsDisplay(true);
  }

  function apply(){
    var q        = (search && search.value || '').trim().toLowerCase();
    var sel      = (main && main.value || '');
    var planSel  = normPlan(plan && plan.value || '');

    var isDays   = (sel==='dias_asc' || sel==='dias_desc');
    var anyFilter= isDays || !!(q || planSel || (/^(pendientes|plan|color_)/.test(sel)));

    setSeparatorsDisplay(!anyFilter);

    if (!anyFilter){ restoreOriginal(); return; }

    if (isDays){
      var groups = buildGroups();
      for (var i=0;i<groups.length;i++){
        var g = groups[i];
        g.show = groupMatchesFilters(g, sel, planSel, q);
        g.days = parseDaysFromParent(g.parent);
      }
      var order = groups.slice();
      if (sel==='dias_asc') order.sort(function(a,b){ return (a.days-b.days)||(a.orig-b.orig); });
      else                  order.sort(function(a,b){ return (b.days-a.days)||(a.orig-b.orig); });

      var frag = document.createDocumentFragment();
      for (var j=0;j<order.length;j++){
        var gg = order[j];
        gg.parent.style.display = gg.show ? '' : 'none';
        frag.appendChild(gg.parent);
        for (var h=0; h<gg.children.length; h++){
          gg.children[h].style.display = gg.show ? '' : 'none';
          frag.appendChild(gg.children[h]);
        }
      }
      targetTbody.appendChild(frag);
      return;
    }

    // solo filtro
    var rows = collectAllRows();
    var parentVisible = true;
    for (var r=0;r<rows.length;r++){
      var tr = rows[r];
      if (tr.hasAttribute('data-sep')) continue;
      var isParent = tr.classList.contains('js-parent-row');
      if (isParent){
        var show = groupMatchesFilters({parent:tr}, sel, planSel, q);
        tr.style.display = show ? '' : 'none';
        parentVisible = show;
      } else {
        tr.style.display = parentVisible ? '' : 'none';
      }
    }
  }

  if (main)   main.addEventListener('change', function(){ togglePlanSel(); apply(); });
  if (plan)   plan.addEventListener('change', apply);
  if (search) search.addEventListener('input', debounce(apply, 150));
  if (clear)  clear.addEventListener('click', function(){
    if (main)   main.value = '';
    if (plan)   plan.value = '';
    if (search) search.value = '';
    togglePlanSel();
    apply(); // restaura DOM exacto
  });

  togglePlanSel();
  apply();

  document.addEventListener('shown.bs.tab', function(e){
    var t = e.target && (e.target.getAttribute('data-bs-target') || e.target.getAttribute('href')) || '';
    if (t === '#cuentas') { togglePlanSel(); apply(); }
  });
})();



/* =======================================================================
   SPP (Plan/Color/Enviar) — Prefill por fila y reset en cierre
   - Evita "estado pegado" entre filas: lee siempre data-plan/data-color de la fila activa
   - Funciona con modal chico (#sppModal|#stockPausaPlanModal) o popover equivalente
   ======================================================================= */
(function(){
  'use strict';
  if (window.__sppFixBoundV2) return;
  window.__sppFixBoundV2 = true;

  var nextPlan = null, nextColor = null;

  function pickRow(el){
    var tr = el && el.closest ? el.closest('tr.js-parent-row') : null;
    return tr || null;
  }

  // Capturamos el click en la celda de plan para "recordar" el contexto de la fila
  document.addEventListener('click', function(ev){
    var cell = ev.target.closest && (ev.target.closest('.plan-cell-cuenta') || ev.target.closest('.plan-cell-perfil'));
    if (!cell) return;
    var row = pickRow(cell);
    if (!row) return;
    nextPlan  = (row.getAttribute('data-plan') || '').toLowerCase();
    nextColor = (row.getAttribute('data-color') || '').toLowerCase();
    // No bloqueamos otros listeners: dejamos que se abra su modal/popover habitual
  }, true);

  function applyIfPresent(root){
    if (!root) return;
    // PLAN
    var selPlan = root.querySelector('#spp_plan, select[name="plan"], select[data-spp="plan"]');
    if (selPlan && nextPlan){
      selPlan.value = nextPlan;
      selPlan.dispatchEvent(new Event('change', { bubbles:true }));
    }
    // COLOR (select o radios)
    var selColor = root.querySelector('#spp_color, select[name="color"], select[data-spp="color"]');
    if (selColor){
      if (nextColor){ selColor.value = nextColor; selColor.dispatchEvent(new Event('change',{bubbles:true})); }
    } else {
      var radio = nextColor ? root.querySelector('input[type="radio"][name="color"][value="'+nextColor+'"]') : null;
      if (radio){ radio.checked = true; radio.dispatchEvent(new Event('change',{bubbles:true})); }
    }
  }

  // Cuando el mini-modal esté visible, precargamos con el contexto de la fila
  document.addEventListener('shown.bs.modal', function(e){
    var id = (e.target && e.target.id) || '';
    if (id==='sppModal' || id==='stockPausaPlanModal'){ applyIfPresent(e.target); }
  });
  // Si en tu implementación es popover, intenta inyectar cuando aparece en DOM
  document.addEventListener('shown.bs.popover', function(e){
    var tip = e.target && (e.target.getAttribute && document.querySelector(e.target.getAttribute('aria-describedby'))) || null;
    if (tip) applyIfPresent(tip);
  });

  // Reset al cerrar para no heredar estado
  document.addEventListener('hidden.bs.modal', function(e){
    var id = (e.target && e.target.id) || '';
    if (id==='sppModal' || id==='stockPausaPlanModal'){
      var form = e.target.querySelector('form');
      if (form) try { form.reset(); } catch(_){}
      nextPlan = null; nextColor = null;
    }
  });
})();



/* ================================================================
   PATCH: CuentaModal — Precio correcto en EDITAR + sin sobrescribir
   - En EDITAR rellena `name="soles"` desde data-row.soles
   - No toma precio de cabecera en EDITAR
   - Elimina duplicados de inputs name="soles" en el modal
   - Evita que otros listeners lo pisen re-aplicando en shown.bs.modal
   ================================================================ */
(function(){
  'use strict';
  var modal = document.getElementById('cuentaModal');
  if (!modal || window.__cuentaModalPricePatchV1) return;
  window.__cuentaModalPricePatchV1 = true;

  function ensureSingleSoles(form){
    if (!form) return null;
    var list = Array.from(form.querySelectorAll('input[name="soles"]'));
    if (!list.length) return null;
    // Preferimos el primer input de tipo number
    var keeper = list.find(function(i){ return (i.type||'').toLowerCase()==='number'; }) || list[0];
    list.forEach(function(i){ if (i!==keeper) i.remove(); });
    return keeper;
  }

  // Para guardar el contexto del trigger
  modal.addEventListener('show.bs.modal', function(ev){
    var trigger = ev.relatedTarget;
    var form = modal.querySelector('form');
    modal.dataset._mode = '';            // create|edit|prefill
    modal.dataset._row  = '';

    // Determinar modo
    if (trigger && trigger.classList && trigger.classList.contains('btn-edit-cuenta')) {
      modal.dataset._mode = 'edit';
      // Capturamos el row del botón para usarlo en shown
      var raw = trigger.getAttribute('data-row') || '';
      if (!raw) {
        // fallback a data-* o celdas
        var tmp = {
          soles: trigger.getAttribute('data-soles') || ''
        };
        modal.dataset._row = JSON.stringify(tmp);
      } else {
        modal.dataset._row = raw;
      }
    } else if (modal.dataset.prefill === '1') {
      modal.dataset._mode = 'prefill';
    } else {
      modal.dataset._mode = 'create';
    }

    // Normalizamos inputs de precio antes de pintar
    ensureSingleSoles(form);
  }, true);

  modal.addEventListener('shown.bs.modal', function(){
    var form = modal.querySelector('form');
    var inp  = ensureSingleSoles(form);
    if (!inp) return;

    var mode = modal.dataset._mode || '';
    if (mode === 'edit') {
      // Rellenar desde data-row.soles SÓLO en editar
      var row = {};
      try { row = JSON.parse(modal.dataset._row || '{}') || {}; } catch(_){ row = {}; }
      var val = (row.soles != null) ? String(row.soles).trim() : '';
      if (val !== '') {
        inp.readOnly = false;
        inp.removeAttribute('readonly');
        inp.value = val;
        // Disparar eventos por si hay validaciones externas
        inp.dispatchEvent(new Event('input', { bubbles:true }));
        inp.dispatchEvent(new Event('change', { bubbles:true }));
      }
    } else if (mode === 'create') {
      // En crear, si hay cabezera de precio y QUIERES prefijar, déjalo vacío o usa header:
      // const head = document.getElementById('precioCuentaHead');
      // if (head && head.value.trim() !== '') inp.value = head.value.trim();
      // Por defecto no tocamos para evitar pisar
      inp.readOnly = false;
      inp.removeAttribute('readonly');
    } else if (mode === 'prefill') {
      // Prefill desde fila padre: si hubiera dataset.soles, puedes bloquear o no. Aquí no forzamos readonly.
      inp.readOnly = false;
      inp.removeAttribute('readonly');
    }
  }, false);

  // Limpieza al cerrar
  modal.addEventListener('hidden.bs.modal', function(){
    var form = modal.querySelector('form');
    if (form) {
      var inp = form.querySelector('input[name="soles"]');
      if (inp) { inp.readOnly = false; inp.removeAttribute('readonly'); }
    }
    delete modal.dataset._mode;
    delete modal.dataset._row;
  }, false);
})();



















(function(){
  // Usa el modal propio de Familiar si existe; si no, el modal genérico (si lo compartes)
  const modal = document.getElementById('modalCambiarPlanFamiliar')
              || document.getElementById('modalCambiarPlanStockPausa');
  if (!modal) return;

  let lastFamTrigger = null;

  // Captura la celda que abrió el modal (solo Familiar)
  document.addEventListener('click', function(e){
    const cell = e.target.closest('.plan-cell-familiar');
    if (cell) lastFamTrigger = cell;
  }, true);

  function setField(form, nameOrSelector, value){
    // Acepta: name="..." o un selector (ej. #idDelCampo)
    let el = form.querySelector('[name="'+nameOrSelector+'"]') || form.querySelector(nameOrSelector);
    if (el) el.value = value == null ? '' : value;
  }

  // ✅ Normaliza cualquier texto de plan a un slug sin tildes
function normPlan(p){
  const s = String(p || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'') // quita tildes
    .toLowerCase().trim();

  if (s.includes('premium')) return 'premium';
  if (s.includes('stand') || s.includes('estandar')) return 'estandar';
  if (s.includes('basic') || s.includes('individual')) return 'individual';
  return 'individual';
}

// (Opcional) etiqueta para mostrar bonito en UI
function planLabel(slug){
  if (slug === 'estandar') return 'Estándar';
  if (slug === 'individual') return 'Individual';
  return 'Premium';
}


  modal.addEventListener('show.bs.modal', function(){
    const form = modal.querySelector('form');
    if (!form) return;

    // Reset duro para no arrastrar valores previos
    form.reset();

    const cell = lastFamTrigger;
    const tr   = cell ? cell.closest('tr') : null;

    const id    = cell?.dataset.id || tr?.dataset.id || '';
    const planR = cell?.dataset.plan || tr?.dataset.plan || '';
    const plan  = normPlan(planR);
    const color = (tr?.getAttribute('data-color') || '').toLowerCase();
    const allowedColors = ['rojo','azul','verde','blanco'];

    // Volcado al formulario (intenta por name=..., si no, por #id)
    setField(form, 'tipo', 'familiar');      // name="tipo"
    setField(form, '#spp_tipo', 'familiar'); // o #spp_tipo si compartes modal
    setField(form, 'id', id);
    setField(form, '#spp_id', id);
    setField(form, 'plan', plan);
    setField(form, '#spp_plan', plan);
    setField(form, 'color', allowedColors.includes(color) ? color : '');
    setField(form, '#spp_color', allowedColors.includes(color) ? color : '');
    setField(form, 'destino', ''); // limpia destino previo
    setField(form, '#spp_destino', '');
  });

  modal.addEventListener('hidden.bs.modal', function(){
    const form = modal.querySelector('form');
    if (form) form.reset();
    lastFamTrigger = null;
  });
})();
















// --- PATCH SCOPED Familiar: forzar apertura y prefill, sin bloquear otros modals ---
(function(){
  'use strict';
  if (window.__famForceOpenPatch) return;
  window.__famForceOpenPatch = true;

  // Ubica el modal de Familiar (propio o compartido)
  var famModal = document.getElementById('modalCambiarPlanFamiliar')
             || document.getElementById('modalCambiarPlanStockPausa');
  if (!famModal) return;

  // Normaliza triggers dentro de Familiar para que apunten al modal correcto
  function normalizeFamTriggers(){
    var sel = [
      '#familiar .plan-cell-familiar',
      '#familiarTable .plan-cell-familiar',
      '[data-scope="familiar"] .plan-cell-familiar',
      '[data-familiar="1"] .plan-cell-familiar'
    ].join(',');
    document.querySelectorAll(sel).forEach(function(cell){
      cell.setAttribute('data-bs-toggle', 'modal');
      cell.setAttribute('data-bs-target', '#'+famModal.id);
    });
  }
  normalizeFamTriggers();
  document.addEventListener('DOMContentLoaded', normalizeFamTriggers);

  // Si algún script impide que Bootstrap abra el modal por Data-API,
  // abrimos programáticamente sin bloquear a otros
  document.addEventListener('click', function(e){
    var cell = e.target.closest('.plan-cell-familiar');
    if (!cell) return;
    // Deja que Bootstrap lo intente; si no abre, abrimos en fallback
    setTimeout(function(){
      if (!famModal.classList.contains('show')) {
        var m = bootstrap.Modal.getOrCreateInstance(famModal);
        m.show();
      }
    }, 0);
  }, false);

  // ✅ Normaliza cualquier texto de plan a un slug sin tildes
function normPlan(p){
  const s = String(p || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'') // quita tildes
    .toLowerCase().trim();

  if (s.includes('premium')) return 'premium';
  if (s.includes('stand') || s.includes('estandar')) return 'estandar';
  if (s.includes('basic') || s.includes('individual')) return 'individual';
  return 'individual';
}

// (Opcional) etiqueta para mostrar bonito en UI
function planLabel(slug){
  if (slug === 'estandar') return 'Estándar';
  if (slug === 'individual') return 'Individual';
  return 'Premium';
}

  function setVal(form, a, b, v){
    var el = form.querySelector(a) || form.querySelector(b);
    if (!el) return;
    el.value = (v==null) ? '' : v;
    el.dispatchEvent(new Event('change', {bubbles:true}));
  }
  function getRowColor(tr){
    if (!tr) return '';
    var attr = (tr.getAttribute('data-color')||'').toLowerCase();
    if (attr) return attr;
    var cls = (Array.from(tr.classList||[]).find(function(c){return c.indexOf('row-color-')===0;})||'');
    return cls.replace('row-color-','');
  }

  // Prefill SOLO cuando se abre el modal de Familiar (o el compartido), usando el trigger
  famModal.addEventListener('show.bs.modal', function(ev){
    var form = famModal.querySelector('form');
    if (!form) return;

    // Reset duro (evita “color pegado”)
    form.reset();

    var trigger = ev.relatedTarget || document.querySelector('.plan-cell-familiar:focus') || null;
    var cell = trigger && trigger.closest ? trigger.closest('.plan-cell-familiar') : null;
    var tr   = cell ? cell.closest('tr') : null;

    // Si el trigger no viene de Familiar, no tocamos nada (no interferimos con otros modals)
    if (!cell) return;

    // PLAN / ID / TIPO
    var planRaw = (cell.getAttribute('data-plan') || (tr ? tr.getAttribute('data-plan') : '') || '');
    setVal(form, '#spp_plan',  '[name="plan"]',  normPlan(planRaw));
    setVal(form, '#spp_id',    '[name="id"]',    cell.getAttribute('data-id') || (tr ? tr.getAttribute('data-id') : '') || '');
    setVal(form, '#spp_tipo',  '[name="tipo"]',  'familiar');

    // COLOR: reset select y aplicar el color de ESTA fila
    var sel = form.querySelector('#spp_color') || form.querySelector('[name="color"]');
    if (sel) {
      sel.querySelectorAll('option[selected]').forEach(function(o){ o.removeAttribute('selected'); });
      sel.selectedIndex = 0; sel.value = '';
      sel.dispatchEvent(new Event('change', {bubbles:true}));

      var picked = getRowColor(tr);
      var ok = ['rojo','azul','verde','blanco'].indexOf(picked) >= 0 ? picked : '';
      if (ok === '' && sel.options.length > 0 && !sel.querySelector('option[value=""]')) {
        sel.selectedIndex = 0;
      } else {
        sel.value = ok;
      }
      sel.dispatchEvent(new Event('change', {bubbles:true}));
    }
  });

  famModal.addEventListener('hidden.bs.modal', function(){
    var form = famModal.querySelector('form');
    if (form) form.reset();
  });
})();













// --- PATCH SCOPED Familiar v2: color predeterminado según la fila ---
(function(){
  'use strict';
  if (window.__famColorScopedV2) return;
  window.__famColorScopedV2 = true;

  let lastFamTrigger = null;
  document.addEventListener('click', function(e){
    const cell = e.target.closest('.plan-cell-familiar');
    if (cell) lastFamTrigger = cell;
  }, true);

  function getFamModal(){
    const el = document.getElementById('perfilColorSelect') || document.getElementById('perfilPlanSelect');
    return el ? el.closest('.modal') : null;
  }
  const modal = getFamModal();
  if (!modal) return;

  // ✅ Normaliza cualquier texto de plan a un slug sin tildes
function normPlan(p){
  const s = String(p || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'') // quita tildes
    .toLowerCase().trim();

  if (s.includes('premium')) return 'premium';
  if (s.includes('stand') || s.includes('estandar')) return 'estandar';
  if (s.includes('basic') || s.includes('individual')) return 'individual';
  return 'individual';
}

// (Opcional) etiqueta para mostrar bonito en UI
function planLabel(slug){
  if (slug === 'estandar') return 'Estándar';
  if (slug === 'individual') return 'Individual';
  return 'Premium';
}


  function getRow(tr){
    if (tr) return tr;
    if (lastFamTrigger) return lastFamTrigger.closest('tr');
    return null;
  }

  function pickColorFromRow(tr){
    if (!tr) return '';
    let picked = (tr.getAttribute('data-color') || '').toLowerCase();
    if (!picked) {
      const cls = Array.from(tr.classList || []).find(c => c.indexOf('row-color-') === 0);
      if (cls) picked = cls.replace('row-color-','');
    }
    const allowed = ['rojo','azul','verde','blanco'];
    return allowed.includes(picked) ? picked : '';
  }

  function setSelectValue(sel, value){
    if (!sel) return;
    // reset duro
    Array.from(sel.options).forEach(o => o.selected = false);
    if (value) {
      const opt = Array.from(sel.options).find(o => o.value === value);
      if (opt) opt.selected = true; else sel.selectedIndex = 0;
    } else {
      sel.selectedIndex = 0;
    }
    sel.dispatchEvent(new Event('change', {bubbles:true}));
  }

  // Prefill final al estar visible (evita que otros listeners lo pisen)
  modal.addEventListener('shown.bs.modal', function(ev){
    const planSel   = modal.querySelector('#perfilPlanSelect');
    const colorSel  = modal.querySelector('#perfilColorSelect');
    const enviarSel = modal.querySelector('#perfilEnviarASelect');
    const idHidden  = modal.querySelector('#perfilPlanId');

    // Contexto
    let trigger = ev.relatedTarget || document.activeElement || lastFamTrigger;
    let tr = trigger ? trigger.closest && trigger.closest('tr') : null;
    tr = getRow(tr);
    if (!tr) return;

    // ID
    const rid = (trigger?.dataset?.id || tr.getAttribute('data-id') || '').trim();
    if (idHidden) idHidden.value = rid;

    // PLAN
    if (planSel) {
      const planRaw = (trigger?.dataset?.plan || tr.getAttribute('data-plan') || '');
      planSel.value = normPlan(planRaw);
      planSel.dispatchEvent(new Event('change', {bubbles:true}));
    }

    // COLOR (como predeterminado el de la fila)
    if (colorSel) {
      const picked = pickColorFromRow(tr);
      setSelectValue(colorSel, picked);
      // Etiqueta de la primera opción: “actual: <color>” o “(sin color)”
      if (colorSel.options[0]) {
        colorSel.options[0].textContent = picked ? ('actual: ' + picked) : '(sin color)';
      }
    }

    // Enviar a (restablecer)
    if (enviarSel) {
      enviarSel.value = 'none';
      enviarSel.dispatchEvent(new Event('change', {bubbles:true}));
    }

    // Salvaguarda: si algún script reescribe luego, re-aplicamos al siguiente tick
    setTimeout(function(){
      if (colorSel) {
        const picked = pickColorFromRow(tr);
        if (colorSel.value !== picked) {
          setSelectValue(colorSel, picked);
          if (colorSel.options[0]) {
            colorSel.options[0].textContent = picked ? ('actual: ' + picked) : '(sin color)';
          }
        }
      }
    }, 0);
  });

  // Limpieza al cerrar
  modal.addEventListener('hidden.bs.modal', function(){
    const colorSel  = modal.querySelector('#perfilColorSelect');
    const enviarSel = modal.querySelector('#perfilEnviarASelect');
    if (colorSel) {
      Array.from(colorSel.options).forEach(o => o.selected = false);
      colorSel.selectedIndex = 0;
      colorSel.value = '';
      if (colorSel.options[0]) colorSel.options[0].textContent = '(sin color)';
    }
    if (enviarSel) enviarSel.value = 'none';
  });
})();


















// PATCH: Editar → prefill de precio y split de teléfono (wa_cc / wa_local)
(function(){
  'use strict';

  // Ids de modales donde queremos el comportamiento (ajusta si usas otros)
  var MODALS = ['perfilModal','perfilFamiliarModal','cuentaModal'];

  function parsePhone(raw){
    var s = String(raw || '').trim();
    // quita espacios, deja solo + y dígitos
    s = s.replace(/\s+/g,'');
    if (s.startsWith('+')) s = s.slice(1);
    s = s.replace(/[^\d]/g,'');
    if (!s) return { cc:'', local:'' };

    // Regla: últimos 9 dígitos = número local; lo anterior = CC
    if (s.length > 9){
      return { cc: s.slice(0, s.length - 9), local: s.slice(-9).replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3') };
    }
    // si solo hay 9 dígitos, va todo al local
    return { cc:'', local: s.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3') };
  }

  function wireEditModal(modalId){
    var modal = document.getElementById(modalId);
    if (!modal) return;

    modal.addEventListener('show.bs.modal', function(ev){
      var trigger = ev.relatedTarget;
      if (!trigger) return; // sin disparador (apertura programática): no tocamos

      // Solo si el botón tiene data-row (caso EDITAR). El "Agregar" no lo trae.
      var raw = trigger.getAttribute('data-row');
      if (!raw) return;

      var row = {};
      try { row = JSON.parse(raw); } catch(_){}

      // --- PRECIO ---
      // Buscamos un input[name="soles"] (cubre #modalChildPrecio, #modalPerfilPrecio, etc)
      var priceInput = modal.querySelector('input[name="soles"]');
      if (priceInput){
        var pv = (row.soles != null && row.soles !== '') ? String(row.soles) : '';
        if (pv !== ''){
          // Quitar cualquier readonly que venga de la lógica "Agregar hijo"
          priceInput.readOnly = false;
          priceInput.removeAttribute('readonly');
          // Normaliza a decimal con punto
          var n = parseFloat(pv);
          priceInput.value = isNaN(n) ? pv : n.toString();
          // Notificar a posibles listeners
          priceInput.dispatchEvent(new Event('input', {bubbles:true}));
          priceInput.dispatchEvent(new Event('change', {bubbles:true}));
        }
      }

      // --- TELÉFONO ---
      // Si el modal tiene wa_cc / wa_local, los rellenamos a partir de row.whatsapp / row.wa_e164 / row.wa_digits
      var ccInp    = modal.querySelector('input[name="wa_cc"]');
      var localInp = modal.querySelector('input[name="wa_local"]');
      if (ccInp || localInp){
        var src = row.whatsapp || row.wa_e164 || row.wa_digits || '';
        var ph  = parsePhone(src);
        if (ccInp)    ccInp.value    = ph.cc;
        if (localInp) localInp.value = ph.local;
      }
    });
  }

  MODALS.forEach(wireEditModal);
})();


























// ==== Filtros SOLO para STREAMING FAMILIAR (scope: perfiles-fam) ====
(function(){
  'use strict';
  if (window.__famFiltersV2__) return;
  window.__famFiltersV2__ = true;

  const SCOPE  = document.querySelector('[data-scope="perfiles-fam"]');
  const TABLE  = document.getElementById('perfilesFamiliarTable');
  if (!SCOPE || !TABLE || !TABLE.tBodies.length) return;
  const TBODY  = TABLE.tBodies[0];

  const selMain   = SCOPE.querySelector('.pc-main');
  const selPlan   = SCOPE.querySelector('.pc-plan');
  const inpSearch = SCOPE.querySelector('.pc-search');
  const btnClear  = SCOPE.querySelector('.btn.cu-clear, .btn.pc-clear') || SCOPE.querySelector('.btn.btn-outline-secondary');

  const norm = (s)=> (s||'').toString().toLowerCase().trim();

  function isSeparator(tr){
    return tr.hasAttribute('data-sep');
  }

  function isParentRow(tr){
    if (tr.classList.contains('js-parent-row')) return true;
    if ((tr.getAttribute('data-entidad')||'') === 'perfil_fam' && tr.getAttribute('tabindex') === '0') return true;
    const c = tr.querySelector('td.correo-cell');
    return !!(c && c.textContent.trim() !== '');
  }

  function buildGroups(){
    const rows   = Array.from(TBODY.querySelectorAll('tr'));
    const groups = [];
    let current  = [];
    for (const r of rows){
      if (isSeparator(r)) {
        // No lo incluimos en grupos; se maneja aparte (mostrar/ocultar)
        if (current.length) { groups.push(current); current = []; }
        continue;
      }
      if (isParentRow(r)) {
        if (current.length) groups.push(current);
        current = [r];
      } else {
        if (!current.length) current = [r];
        else current.push(r);
      }
    }
    if (current.length) groups.push(current);
    return groups;
  }

  function parentColor(tr){
    const attr = norm(tr.getAttribute('data-color'));
    if (attr) return attr;
    const m = (tr.className||'').match(/\brow-color-([a-záéíóúñ]+)\b/i);
    return m ? norm(m[1]) : '';
  }

  function parentPlan(tr){
    const raw = norm(tr.getAttribute('data-plan') || (tr.querySelector('.plan-cell-familiar')?.textContent));
    if (!raw) return '';
    if (raw.includes('premium')) return 'premium';
    if (raw.includes('estándar') || raw.includes('estandar') || raw.includes('standard')) return 'estandar';
    if (raw.includes('básico') || raw.includes('basico') || raw.includes('individual')) return 'basico';
    return raw;
  }

  function parentEstado(tr){
    const fromBadge = tr.querySelector('.badge')?.textContent;
    return norm(fromBadge || tr.getAttribute('data-estado'));
  }

  function parentDias(tr){
    // Columna 6 = DÍAS (como en el HTML actual)
    const cell = tr.querySelector('td:nth-child(6)');
    if (!cell) return 0;
    const n = parseInt(cell.textContent.replace(/[^\d\-]/g, ''), 10);
    return Number.isFinite(n) ? n : 0;
  }

  function hideSeparators(hide){
    TBODY.querySelectorAll('tr[data-sep]').forEach(sep=>{
      sep.classList.toggle('d-none', !!hide);
    });
  }

  function applyFilters(){
  const groups = buildGroups();

  const mainVal = selMain ? selMain.value : '';
  if (selPlan) {
    // Mostrar subfiltro de plan solo cuando corresponde
    selPlan.style.display = (mainVal === 'plan') ? '' : 'none';
    if (mainVal !== 'plan') selPlan.value = '';
  }
  const planReq = selPlan ? selPlan.value : '';
  const q = norm(inpSearch ? inpSearch.value : '');

  const anyFilter = !!(mainVal || planReq || q);
  hideSeparators(anyFilter);
  // Mostrar/ocultar paginador de PERFILES según haya filtros activos
  try {
    const pane   = SCOPE.closest('#perfiles'); // tab-pane de Perfiles
    if (pane) {
      const pager = pane.querySelector('nav[data-pager="perfiles"]');
      if (pager) {
        pager.classList.toggle('d-none', !!anyFilter);
      }
    }
  } catch(e) {
    // silencioso
  }

  // Aplica filtros por grupo (padre + hijos)
  groups.forEach(g=>{
    const parent = g[0];
    let ok = true;

    if (q) {
      const txt = norm(g.map(r=>r.textContent).join(' '));
      if (!txt.includes(q)) ok = false;
    }

    if (ok && mainVal) {
      if (mainVal === 'pendientes') {
        if (parentEstado(parent) !== 'pendiente') ok = false;
      } else if (mainVal === 'color_rojo' || mainVal === 'color_azul' || mainVal === 'color_verde' || mainVal === 'color_blanco') {
        const want = mainVal.split('_')[1]; // rojo|azul|verde|blanco
        if (parentColor(parent) !== want) ok = false;
      } else if (mainVal === 'plan' && planReq) {
        if (parentPlan(parent) !== planReq) ok = false;
      }
      // dias_asc / dias_desc se manejan como orden, no filtran
    }

    g.forEach(tr => tr.classList.toggle('d-none', !ok));
  });

  if (mainVal === 'dias_asc' || mainVal === 'dias_desc') {
    const visibleGroups = groups.filter(g => !g[0].classList.contains('d-none'));
    visibleGroups.sort((a,b)=>{
      const da = parentDias(a[0]), db = parentDias(b[0]);
      return mainVal === 'dias_asc' ? (da - db) : (db - da);
    });
    const frag = document.createDocumentFragment();
    visibleGroups.forEach(g => g.forEach(tr => frag.appendChild(tr)));
    TBODY.appendChild(frag);
  }

  // FIX: 'anyfilters' -> 'anyFilter' (JS es case-sensitive)
  if (!anyFilter) {
    hideSeparators(false);
  }
}


  // Listeners
  if (selMain) selMain.addEventListener('change', applyFilters);
  if (selPlan) selPlan.addEventListener('change', applyFilters);
  if (inpSearch) {
    let t; 
    inpSearch.addEventListener('input', ()=>{ clearTimeout(t); t = setTimeout(applyFilters, 120); });
  }
  if (btnClear) {
    btnClear.addEventListener('click', ()=>{
      if (selMain) selMain.value = '';
      if (selPlan){ selPlan.value=''; selPlan.style.display='none'; }
      if (inpSearch) inpSearch.value = '';
      hideSeparators(false);
      applyFilters();
    });
  }

  // Primera pasada
  applyFilters();
})();


















(function () {
  'use strict';
  if (window.__famChildPatch) return; window.__famChildPatch = true;

  // 🔧 Si tu modal de familiar tiene otro id, cámbialo aquí:
  var MODAL_ID = 'perfilFamiliarModal';

  // Asegura que al clickear "Agregar hijo" el modal conozca el modo
  document.addEventListener('click', function (ev) {
    var btn = ev.target.closest('[data-bs-target="#' + MODAL_ID + '"][data-mode="add-hijo"]');
    if (!btn) return;
    var m = document.getElementById(MODAL_ID);
    if (m) m.dataset.mode = 'add-hijo';
  });

  // Al abrir el modal en modo "add-hijo", forzamos valores y desbloqueos
  document.addEventListener('show.bs.modal', function (ev) {
    var m = ev.target;
    if (m.id !== MODAL_ID) return;
    if ((m.dataset.mode || '') !== 'add-hijo') return;

    // Evita prefills heredados/“precio ancla” de otros scripts
    m.dataset.skipAnchor = '1';

    // Campos
    var correo  = m.querySelector('input[name="correo"], #correo');
    var pass    = m.querySelector('input[name="password"], #password');
    var precio  = m.querySelector('input[name="soles"], input[name="precio"], #soles');

    if (correo) {
      correo.value = '';                 // correo en blanco
      correo.readOnly = false;
      correo.disabled = false;
      correo.classList.remove('disabled','is-invalid','readonly');
    }

    if (pass) {
      pass.value = 'reasonly';           // contraseña por defecto
      pass.readOnly = false;
      pass.disabled = false;
      pass.classList.remove('disabled','readonly');
    }

    if (precio) {
      // precio editable (por si hay lógica de bloqueo previa)
      precio.readOnly = false;
      precio.disabled = false;
      precio.removeAttribute('data-locked');
      precio.classList.remove('disabled','readonly');
    }
  });
})();



















// SOLO FAMILIAR: abrir modal al clickear fila PADRE dentro del pane #perfiles-familiar
(function () {
  var MODAL_ID = 'perfilFamiliarModal';

  // Reemplaza el document.addEventListener('click', ...) global por este:
  document.addEventListener('click', function (ev) {
    // Limita el alcance al tab Familiar
    var famPane = document.getElementById('perfiles-familiar');
    if (!famPane || !famPane.contains(ev.target)) return;

    // Ignora botones/acciones explícitas
    var ignore = ev.target.closest('.js-row-action, [data-no-row-modal="1"]');
    if (ignore) return;

    // Solo filas PADRE de la tabla familiar
    var tr = ev.target.closest('#perfilesFamiliarTable tr.js-parent-row');
    if (!tr) return;

    var m = document.getElementById(MODAL_ID);
    if (!m) return;

    // --- lo que ya tenías a partir de aquí, sin cambios ---
    // Señales de contexto
    m.dataset.mode = 'add-hijo';
    m.dataset.skipAnchor = '1';

    // Limpia el formulario
    var form = m.querySelector('form');
    if (form) form.reset();

    // Prellenar campos desde el padre (correo, pass, etc.)
    var correo = tr.dataset.correo || (tr.querySelector('.correo-cell')?.textContent || '').trim();
    var pass   = m.querySelector('input[name="password_plain"]');
    var correoInput = m.querySelector('input[name="correo"]');

    if (correoInput) correoInput.value = correo || '';
    if (pass) {
      // Si prefieres copiar la del padre:
      // pass.value = tr.dataset.password || '';
      // Si prefieres tu DEFAULT_PASS, deja como estaba:
      pass.value = (typeof DEFAULT_PASS !== 'undefined') ? DEFAULT_PASS : (tr.dataset.password || '');
      pass.readOnly = true;
      pass.disabled = false;
      pass.classList.add('readonly');
    }

    // Otros datos útiles del padre
    var hidSid = m.querySelector('input[name="streaming_id"]');
    if (hidSid && tr.dataset.streaming_id) {
      hidSid.value = tr.dataset.streaming_id;
    }

    // Muestra modal
    if (window.bootstrap?.Modal) {
      bootstrap.Modal.getOrCreateInstance(m).show();
    } else {
      m.classList.add('show');
      m.style.display = 'block';
    }
  }, true);
})();





(function () {
  const form = document.getElementById('formPlanStockPausa');
  if (!form || form.dataset._colorBound === '1') return; // evitar doble binding
  form.dataset._colorBound = '1';

  form.addEventListener('submit', async function (ev) {
    // OJO: si ya tienes otro handler que hace el fetch/submit, NO dupliques envío.
    // Este bloque SOLO re-pinta el <tr> cuando la respuesta es OK.
    // Si tú manejas el fetch en otro lado, deja ese y añade SOLO la parte "aplicarColorEnFila(...)".

    // Deja que el handler que ya tengas haga el submit/fetch.
    // Para enganchar post-OK, usa un pequeño retardo y lee el último estado del modal.
    setTimeout(() => {
      try {
        const id   = Number(document.getElementById('spp_id')?.value || 0);
        const tipo = (document.getElementById('spp_tipo')?.value === 'pausa') ? 'pausa' : 'stock';
        let color  = document.getElementById('spp_color')?.value || '';

        // normaliza color
        if (color === 'restablecer') color = '';
        const allowed = ['rojo','azul','verde','blanco',''];
        if (!allowed.includes(color)) color = '';

        // aplica en DOM
        const cellSel = (tipo === 'pausa')
          ? `.plan-cell-pausa[data-id="${id}"]`
          : `.plan-cell-stock[data-id="${id}"]`;

        const td = document.querySelector(cellSel);
        const tr = td?.closest('tr');
        if (tr) {
          tr.dataset.color = color || '';
          tr.classList.remove('row-color-rojo','row-color-azul','row-color-verde','row-color-blanco');
          if (color) tr.classList.add('row-color-' + color);
        }
      } catch (_) {}
    }, 0);
  }, true);
})();


(function () {
  'use strict';
  if (window.__famPassFixBound) return; window.__famPassFixBound = true;

  var famModal = document.getElementById('perfilFamiliarModal');
  if (!famModal) return;

  // 1) Al hacer clic en "Agregar familiar" (PADRE), fuerza contexto padre
  document.addEventListener('click', function(e){
    var btn = e.target.closest('.btn-add-perfil-fam, [data-modal-context="parent"]');
    if (!btn) return;
    famModal.dataset.prefill = '';              // quita prefill de hijo
    famModal.dataset.modalContext = 'parent';   // marca contexto PADRE
  }, true);

  // 2) En show: si es PADRE, habilita contraseña editable y limpia mirrors
  famModal.addEventListener('show.bs.modal', function(ev){
    var form = famModal.querySelector('form'); if (!form) return;

    var isParent = (famModal.dataset.modalContext === 'parent') ||
                   (!!ev.relatedTarget && ev.relatedTarget.matches &&
                    ev.relatedTarget.matches('.btn-add-perfil-fam, [data-modal-context="parent"]'));
    if (!isParent) return;

    var pass = form.querySelector('input[name="password_plain"]');
    if (pass) {
      pass.removeAttribute('readonly');
      pass.disabled = false;
      pass.classList.remove('bg-light','disabled');
      pass.value = '';                 // editable y vacío
      pass.placeholder = 'Contraseña';
    }
    // Eliminar mirrors que se usan en modo hijo
    var mirror  = form.querySelector('input[name="password_plain_mirror"]');
    if (mirror) mirror.remove();
    var truePass = form.querySelector('input[name="password_plain__true"]');
    if (truePass) truePass.remove();
  }, true);

  // 3) Cleanup: al cerrar, limpia flags para que no se arrastre el modo
  famModal.addEventListener('hidden.bs.modal', function(){
    delete famModal.dataset.prefill;
    delete famModal.dataset.modalContext;
  }, true);
})();















/* ====== STREAMING FAMILIAR: abrir SIEMPRE el modal correcto (hijo) ====== */
(function () {
  'use strict';
  if (window.__famRowOpenFixV2) return; window.__famRowOpenFixV2 = true;

  var famPane  = document.getElementById('perfiles-familiar');
  var famModal = document.getElementById('perfilFamiliarModal');
  if (!famPane || !famModal || !window.bootstrap) return;

  function openFamChildFromRow(tr){
    // Señales del padre
    var correo = tr.getAttribute('data-correo') || '';
    var pass   = tr.getAttribute('data-password') || '';
    var soles  = tr.getAttribute('data-soles') || '';
    var plan   = tr.getAttribute('data-plan') || 'premium';
    var combo  = tr.getAttribute('data-combo') || '0';
    var sid    = tr.getAttribute('data-streaming_id') || '';

    // Contexto para show.bs.modal
    famModal.dataset.prefill       = '1';
    famModal.dataset.modalContext  = 'child';
    famModal.dataset.correo        = correo;
    famModal.dataset.password      = pass;
    famModal.dataset.soles         = soles;
    famModal.dataset.plan          = plan;
    famModal.dataset.combo         = combo;
    famModal.dataset.streaming_id  = sid;

    // Título
    var title = document.getElementById('perfilFamiliarModalLabel');
    if (title) title.textContent = 'Agregar a correo: ' + correo;

    // Limpieza y prefill básico de campos
    var form = famModal.querySelector('form');
    if (form) {
      try { form.reset(); } catch(_){}
      // correo vacío/editable
      var iCorreo = form.querySelector('input[name="correo"]');
      if (iCorreo) { iCorreo.value = ''; iCorreo.readOnly = false; iCorreo.disabled = false; iCorreo.placeholder = correo; }
      // precio vacío/editable
      var iPrecio = form.querySelector('input[name="soles"]');
      if (iPrecio) { iPrecio.value = ''; iPrecio.readOnly = false; iPrecio.disabled = false; }
      // password visible: predeterminado y readonly (UI), espejo oculto con la real
      var iPass = form.querySelector('input[name="password_plain"]');
      if (iPass) {
        // espejo
        var mirror = form.querySelector('input[name="password_plain_mirror"]') || (function(){
          var h = document.createElement('input'); h.type='hidden'; h.name='password_plain_mirror'; form.appendChild(h); return h;
        })();
        mirror.value = pass || '1234';
        iPass.value = '1234'; iPass.readOnly = true; iPass.classList.add('bg-light');
      }
      // plan hidden (si existe)
      var iPlan = form.querySelector('input[name="plan"]'); if (iPlan) iPlan.value = plan || 'premium';
    }

    // Abrir modal familiar (hijo)
    bootstrap.Modal.getOrCreateInstance(famModal).show();
  }

  // Captura de clicks SOLO dentro de la pestaña Familiar
  // Captura de clicks SOLO dentro de la pestaña Familiar
// Captura de clicks SOLO dentro de la pestaña Familiar

  // Captura de clicks SOLO dentro de la pestaña Familiar
   // captura para ganar prioridad



})();










/* ================================
   FAMILIAR: ancla de precio (primer hijo)
   ================================ */
(function(){
  'use strict';
  if (window.__famAnchorScoped) return; window.__famAnchorScoped = true;

  var famPane  = document.getElementById('perfiles-familiar');
  var famModal = document.getElementById('perfilFamiliarModal');
  if (!famPane || !famModal) return;

  var lastFamParentRow = null;

  // Detecta última fila padre clickeada en la pestaña Familiar
  document.addEventListener('click', function(e){
    var tr = e.target && e.target.closest && e.target.closest('tr.js-parent-row');
    if (!tr) return;
    if (!famPane.contains(tr)) return;
    if ((tr.getAttribute('data-entidad') || '') !== 'perfil_fam') return;
    lastFamParentRow = tr;
  }, false); // en burbuja, no bloqueamos nada de Perfiles

  // Al abrir el modal de Familiar en modo hijo, si hay ancla => fijar precio readonly
  famModal.addEventListener('show.bs.modal', function(){
    // Solo si venimos de fila (modo hijo)
    if (!(famModal.dataset && famModal.dataset.prefill === '1')) return;
    if (!lastFamParentRow) return;

    var inp = famModal.querySelector('input[name="soles"]');
    if (!inp) return;

    var anchor = lastFamParentRow.getAttribute('data-child-anchor') || '';
    if (anchor) {
      inp.value = anchor;
      inp.readOnly = true;
      inp.classList.add('bg-light');
    } else {
      inp.readOnly = false;
      inp.classList.remove('bg-light');
      if (!inp.value) inp.value = '';
    }

    // Título con correo (si no lo tienes en otro lado)
    var correo = famModal.dataset.correo || lastFamParentRow.getAttribute('data-correo') || '';
    var title  = document.getElementById('perfilFamiliarModalLabel');
    if (title && correo) title.textContent = 'Agregar a correo: ' + correo;
  }, false);

  // Al guardar el PRIMER hijo (sin ancla previa), fijamos el ancla en el <tr>
  famModal.addEventListener('click', function(e){
    var btn = e.target && e.target.closest && e.target.closest('button[type="submit"], input[type="submit"]');
    if (!btn) return;
    if (!(famModal.dataset && famModal.dataset.prefill === '1')) return; // solo hijos
    if (!lastFamParentRow) return;

    var hasAnchor = !!lastFamParentRow.getAttribute('data-child-anchor');
    if (hasAnchor) return;

    var form = famModal.querySelector('form'); if (!form) return;
    if (typeof form.checkValidity === 'function' && !form.checkValidity()) return;

    var inp = famModal.querySelector('input[name="soles"]');
    var val = (inp && String(inp.value||'').trim()) || '';
    if (val) {
      lastFamParentRow.setAttribute('data-child-anchor', val);
      // no hacemos preventDefault: dejamos que el envío nativo continúe
    }
  }, false);
})();












/* ===========================================================
   PERFILES — Fijar precio del segundo hijo (ancla fiable)
   Lee el precio del primer hijo desde la col 9 del primer <tr>
   hijo y bloquea el input en el modal.
   =========================================================== */
(function fixPerfilSecondChildAnchor(){
  'use strict';
  try {
    var modal = document.getElementById('perfilModal');
    if (!modal || window.__perfilAnchorFixV2) return;
    window.__perfilAnchorFixV2 = true;

    function parseNum(s){
      if (s == null) return NaN;
      var n = String(s).replace(/[^\d.,-]/g,'').replace(',', '.');
      var f = parseFloat(n);
      return isNaN(f) ? NaN : f;
    }

    // Ancla: 1) data-first-child-price / data-anchor-price  2) 1er hijo -> td:nth-child(9)
    function computeAnchorForParentRow(row){
      var fromAttr = (row.getAttribute('data-first-child-price') || row.getAttribute('data-anchor-price') || '').trim();
      if (fromAttr) {
        var f = parseNum(fromAttr);
        if (!isNaN(f) && f > 0) return f.toFixed(2);
      }
      // Buscar el primer hijo visual debajo del padre
      var r = row.nextElementSibling;
      while (r && !r.classList.contains('js-parent-row')) {
        // PRECIO está en la columna 9 del listado de Perfiles
        var td9 = r.querySelector('td:nth-child(9)');
        if (td9) {
          var f9 = parseNum(td9.textContent);
          if (!isNaN(f9) && f9 > 0) return f9.toFixed(2);
        }
        // Fallbacks por si existieran en tu markup
        var dp = r.getAttribute('data-precio');
        if (dp) {
          var fdp = parseNum(dp);
          if (!isNaN(fdp) && fdp > 0) return fdp.toFixed(2);
        }
        var tdAlt = r.querySelector('.precio-cell,.cell-precio,[data-precio-cell]');
        if (tdAlt) {
          var falt = parseNum(tdAlt.textContent);
          if (!isNaN(falt) && falt > 0) return falt.toFixed(2);
        }
        r = r.nextElementSibling;
      }
      return '';
    }

    // En el click de la fila padre (Perfiles), calcula y guarda el ancla para el show
    document.addEventListener('click', function(e){
      var row = e.target && e.target.closest && e.target.closest('tr.js-parent-row');
      if (!row) return;
      if ((row.getAttribute('data-entidad') || '') !== 'perfil') return;

      // marca modo hijo y pre-calcula ancla antes de que se abra el modal
      modal.dataset._mode = 'child';
      modal.__anchorRow   = row;
      modal.dataset._anchor = computeAnchorForParentRow(row);
    }, true); // captura para correr antes del show

    // En el show del modal hijo, aplica el ancla y bloquea edición
    modal.addEventListener('show.bs.modal', function(ev){
      if (modal.dataset._mode !== 'child') return; // solo hijo
      var price = modal.querySelector('input[name="soles"]');
      if (!price) return;

      var anchor = modal.dataset._anchor || '';
      if (anchor) {
        price.value = anchor;
        price.readOnly = true;
        price.setAttribute('readonly','readonly');
        price.classList.add('bg-light');
      } else {
        price.readOnly = false;
        price.removeAttribute('readonly');
        price.classList.remove('bg-light');
        if (!price.value) price.value = '';
      }
    }, true);

  } catch(_){}
})();






/* ================================
   STREAMING FAMILIAR
   - Hijo (click fila): título + correo/contraseña readonly
   - Padre (botón Agregar familiar): correo/contraseña editables
   ================================ */
(function(){
  'use strict';
  if (window.__famChildEnforcerV3) return; window.__famChildEnforcerV3 = true;

  var famPane  = document.getElementById('perfiles-familiar');
  var famModal = document.getElementById('perfilFamiliarModal');
  if (!famPane || !famModal || !window.bootstrap) return;

  // Helpers
  function $(sel, ctx){ return (ctx||document).querySelector(sel); }
  function setRO(input, val){
    if (!input) return;
    input.value = val != null ? String(val) : '';
    input.readOnly = true;
    input.setAttribute('readonly','readonly');
    input.classList.add('bg-light');
    input.disabled = false; // importante: readonly, NO disabled (para que se envíe)
  }
  function setEditable(input, val, placeholder){
    if (!input) return;
    input.value = val != null ? String(val) : '';
    input.readOnly = false;
    input.removeAttribute('readonly');
    input.classList.remove('bg-light');
    input.disabled = false;
    if (placeholder) input.placeholder = placeholder;
  }

  // 1) CLICK en fila de Familiar → abrir modo HIJO (readonly correo/contraseña)
  // Captura de clicks SOLO dentro de la pestaña Familiar




  // 2) BOTÓN “Agregar familiar” → abrir modo PADRE (editable correo/contraseña)
  document.addEventListener('click', function(e){
    var btn = e.target.closest('.btn-add-perfil-fam, [data-modal-context="parent"]');
    if (!btn) return;
    famModal.dataset.mode = 'parent';
    famModal.dataset.prefill = '';
    delete famModal.dataset.correo;
    delete famModal.dataset.pass;
    // El título lo dejas como “Agregar familiar” (o el que tengas por defecto)
  }, true);

  // 3) En show: aplicar readonly/edición según modo
  famModal.addEventListener('show.bs.modal', function(){
    var form = $('form', famModal);
    if (!form) return;

    var correoInput = $('input[name="correo"]', form) || $('input[name="email"]', form);
    var passInput   = $('input[name="password_plain"]', form);

    if ((famModal.dataset.mode || '') === 'child') {
      // Hijo: correo y pass readonly siempre
      setRO(correoInput, famModal.dataset.correo || '');
      setRO(passInput, famModal.dataset.pass || '1234');

      // Título redundante (por si otro script lo cambia)
      var t = $('#perfilFamiliarModalLabel');
      if (t && famModal.dataset.correo) t.textContent = 'Agregar a correo: ' + famModal.dataset.correo;

    } else {
      // Padre: ambos editables
      setEditable(correoInput, '', 'Correo');
      setEditable(passInput,   '', 'Contraseña');
    }
  }, true);

  // 4) Limpieza al cerrar
  famModal.addEventListener('hidden.bs.modal', function(){
    delete famModal.dataset.mode;
    delete famModal.dataset.prefill;
    delete famModal.dataset.correo;
    delete famModal.dataset.pass;
  }, true);

})();

/* ================================
   FAMILIAR: abrir modal hijo correcto + título + readonly + submit nativo
   ================================ */
(function(){
  'use strict';
  if (window.__famChildOpenFixFinal) return; window.__famChildOpenFixFinal = true;

  var famPane  = document.getElementById('perfiles-familiar');
  var famModal = document.getElementById('perfilFamiliarModal');
  if (!famPane || !famModal || !window.bootstrap) return;

  function q(sel, ctx){ return (ctx||document).querySelector(sel); }
  function setRO(input, val){
    if (!input) return;
    input.value = val != null ? String(val) : '';
    input.readOnly = true;
    input.setAttribute('readonly','readonly');
    input.classList.add('bg-light');
    input.disabled = false; // readonly, NO disabled (para que se envíe)
  }
  function setEditable(input, val){
    if (!input) return;
    input.value = val != null ? String(val) : '';
    input.readOnly = false;
    input.removeAttribute('readonly');
    input.classList.remove('bg-light');
    input.disabled = false;
  }

  // 1) Click en FILA de Familiar → abrir SIEMPRE el modal hijo correcto
  // ===== STREAMING FAMILIAR: click en fila padre → modal grande hijo,
//       pero NUNCA cuando el clic viene de la celda PLAN =====
famPane.addEventListener('click', function (e) {
  // Ignorar:
  // - Botones de acción (.js-row-action)
  // - Enlaces, botones, elementos con role="button"
  // - Elementos marcados con data-no-row-modal="1"
  // - Y la celda de plan (td.plan-cell-perfil), que tiene su propio modal chico
  if (
    e.target.closest('.js-row-action, a, button, [role="button"], [data-no-row-modal="1"]') ||
    e.target.closest('td.plan-cell-perfil')
  ) {
    return;
  }

  var tr = e.target.closest && e.target.closest('tr.js-parent-row');
  if (!tr) return;

  var entidad = (tr.getAttribute('data-entidad') || '').toLowerCase();
  if (entidad !== 'perfil_fam') return;

  // Cortar otros listeners que podrían abrir modales equivocados
  e.preventDefault();
  e.stopPropagation();
  if (e.stopImmediatePropagation) e.stopImmediatePropagation();

  // 👉 Abrir SOLO el modal grande de familiar a partir de la fila
  openFamChildFromRow(tr);
}, true);

 // captura para ganar a otros listeners

  // 2) Botón "Agregar familiar" (PADRE) → modo editable
  document.addEventListener('click', function(e){
    var btn = e.target.closest && e.target.closest('.btn btn-primary.btn-add-perfil-fam, .btn-add-perfil-fam, [data-modal-context="parent"]');
    if (!btn) return;
    delete famModal.dataset.prefill;
    famModal.dataset.mode = 'parent';
  }, true);

  // 3) En show: aplica readonly/edición según modo + repara backdrop
  famModal.addEventListener('show.bs.modal', function(){
    // Quita posibles atributos "estáticos" heredados
    famModal.removeAttribute('data-bs-backdrop');
    famModal.removeAttribute('data-bs-keyboard');

    var form = q('form', famModal); if (!form) return;
    var correoInput = q('input[name="correo"]', form) || q('input[name="email"]', form);
    var passInput   = q('input[name="password_plain"]', form);

    if ((famModal.dataset.mode || '') === 'child') {
      setRO(correoInput, famModal.dataset.correo || '');
      setRO(passInput,   famModal.dataset.pass   || '1234');

      var title = q('#perfilFamiliarModalLabel');
      if (title && famModal.dataset.correo) title.textContent = 'Agregar a correo: ' + famModal.dataset.correo;
    } else {
      setEditable(correoInput, '');
      setEditable(passInput,   '');
      var title = q('#perfilFamiliarModalLabel');
      if (title) title.textContent = 'Agregar familiar';
    }
  }, true);

  // 4) Submit nativo (evita preventDefault ajenos en burbuja)
  famModal.addEventListener('submit', function(ev){
    // No hacemos preventDefault; sólo impedimos que otros listeners en burbuja lo anulen
    ev.stopPropagation(); // seguimos permitiendo envío nativo
  }, true); // captura: ganamos a handlers globales que previenen

  // 5) Limpieza al cerrar
  famModal.addEventListener('hidden.bs.modal', function(){
    delete famModal.dataset.mode;
    delete famModal.dataset.prefill;
    delete famModal.dataset.correo;
    delete famModal.dataset.pass;
  }, true);
})();















/* ======= Stock/Pausa: repinta color en fila tras submit ======= */
(function () {
  const form = document.getElementById('formPlanStockPausa');
  if (!form || form.dataset._colorBound === '1') return;
  form.dataset._colorBound = '1';

  form.addEventListener('submit', function () {
    // No duplicamos fetch; solo repintamos después
    setTimeout(() => {
      try {
        const id   = Number(document.getElementById('spp_id')?.value || 0);
        const tipo = (document.getElementById('spp_tipo')?.value === 'pausa') ? 'pausa' : 'stock';
        let color  = document.getElementById('spp_color')?.value || '';

        if (color === 'restablecer') color = '';
        const allowed = ['rojo','azul','verde','blanco',''];
        if (!allowed.includes(color)) color = '';

        const cellSel = (tipo === 'pausa')
          ? `.plan-cell-pausa[data-id="${id}"]`
          : `.plan-cell-stock[data-id="${id}"]`;

        const td = document.querySelector(cellSel);
        const tr = td?.closest('tr');
        if (tr) {
          tr.dataset.color = color || '';
          tr.classList.remove('row-color-rojo','row-color-azul','row-color-verde','row-color-blanco');
          if (color) tr.classList.add('row-color-' + color);
        }
      } catch (_) {}
    }, 0);
  }, true);
})();

/* ======= (Desactivado) Cualquier hook de Streaming Familiar aquí =======
   La lógica de abrir modal, título, correo/contraseña y precio del hijo/padre
   se centraliza en app_familiar_modal_fix.js para evitar conflictos.
========================================================================= */

/* ======= (Mantener desactivado) lockParentPrice en #perfilModal ======= */
(function lockParentPrice(){
  try {
    var modal = document.getElementById('perfilModal');
    var head  = document.getElementById('precioPerfilHead');
    if (!modal || !head) return;
    /* patched: disable lockParentPrice to avoid readonly bleed */
    return;
  } catch(e){}
})();













// === OVERRIDE: Click en FILA de PERFILES abre SIEMPRE el modal de HIJO ===
;(function () {
  'use strict';
  if (window.__PerfilesChildRowOverride) return;
  window.__PerfilesChildRowOverride = true;

  document.addEventListener('click', function (e) {
    // Solo filas padre dentro de la tabla PERFILES
    const row = e.target.closest('#perfilesTable tr.js-parent-row');
    if (!row) return;

    // No disparar si el click viene de:
    // - botones / links / acciones
    // - la celda de PLAN
    // - elementos marcados con data-no-row-modal
    if (
      e.target.closest('.js-row-action') ||
      e.target.closest('a, button, [role="button"]') ||
      e.target.closest('[data-no-row-modal="1"]') ||
      e.target.closest('td.plan-cell-perfil')
    ) {
      return;
    }

    // Cortar aquí para que otros listeners viejos no se metan
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();

    // Desde PERFILES queremos abrir el modal de HIJO (perfil_fam)
    const entidad = 'perfil_fam';

    if (typeof openPrefillModal === 'function') {
      // Usamos el mismo helper que el resto del sistema
      openPrefillModal(entidad, {
        correo:          row.getAttribute('data-correo') || '',
        firstChildPrice: row.getAttribute('data-first-child-price') || '',
        password:        row.getAttribute('data-password') || '',
        soles:           row.getAttribute('data-soles') || '',
        plan:            row.getAttribute('data-plan') || 'premium',
        combo:           row.getAttribute('data-combo') || '0',
        streaming_id:    row.getAttribute('data-streaming_id') || ''
      });
    } else {
      // Fallback por si acaso cambia el helper en el futuro
      const famModal = document.getElementById('perfilFamiliarModal');
      if (!famModal || !window.bootstrap) return;

      famModal.dataset.prefill       = '1';
      famModal.dataset.correo        = row.getAttribute('data-correo') || '';
      famModal.dataset.password      = row.getAttribute('data-password') || '';
      famModal.dataset.soles         = row.getAttribute('data-soles') || '';
      famModal.dataset.plan          = row.getAttribute('data-plan') || 'premium';
      famModal.dataset.combo         = row.getAttribute('data-combo') || '0';
      famModal.dataset.streaming_id  = row.getAttribute('data-streaming_id') || '';

      const modalInstance = bootstrap.Modal.getOrCreateInstance(famModal);
      modalInstance.show();
    }
  }, true);
})();

// Helper genérico: setear fecha_inicio = hoy y fecha_fin = hoy + N días
window.setDefaultFechas = function (form, days) {
  if (!form) return;
  const dias = typeof days === 'number' ? days : 30;

  const today = new Date();
  const end   = new Date(today);
  end.setDate(end.getDate() + dias);

  const yyyyMmDd = d => d.toISOString().slice(0, 10);

  const fi = form.querySelector('[name="fecha_inicio"]');
  const ff = form.querySelector('[name="fecha_fin"]');

  // Solo sobreescribe si están vacías, para no pisar ediciones
  if (fi && !fi.value) fi.value = yyyyMmDd(today);
  if (ff && !ff.value) ff.value = yyyyMmDd(end);
};

})();  // 🔚 Cierre del bloque principal



;(function () {
  'use strict';
  if (window.__famPlanMiniModalV4__) return;
  window.__famPlanMiniModalV4__ = true;

  const SMALL_MODAL_ID = 'modalCambiarPlanFamiliar';

  // Interceptar clic en la celda PLAN del PADRE (familiar)
  document.addEventListener('click', function (e) {
    const cell = e.target.closest('.plan-cell-familiar[data-no-row-modal="1"]');
    if (!cell) return;

    // Bloquear que llegue a Bootstrap (y por tanto al modal grande)
    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === 'function') {
      e.stopImmediatePropagation();
    }

    const row   = cell.closest('tr.js-parent-row[data-entidad="familiar"]');
    const id    = cell.getAttribute('data-id')   || (row ? row.getAttribute('data-id') : '') || '';
    const plan  = (cell.getAttribute('data-plan') || (row ? row.getAttribute('data-plan') : '') || '').toLowerCase();
    const color = row ? (row.getAttribute('data-color') || '') : '';

    const modalEl = document.getElementById(SMALL_MODAL_ID);
    if (!modalEl) {
      console.warn('No se encontró el modal chico de familiar #' + SMALL_MODAL_ID);
      return;
    }

    const planIdInput  = modalEl.querySelector('#famPlanId');
    const planSelect   = modalEl.querySelector('#famPlanSelect');
    const colorSelect  = modalEl.querySelector('#famColorSelect');
    const enviarSelect = modalEl.querySelector('#famEnviarASelect');

    if (planIdInput) {
      planIdInput.value = id;
    }

    if (planSelect) {
      const opts  = Array.from(planSelect.options);
      const match = opts.find(function (o) {
        return String(o.value || '').toLowerCase() === plan;
      });
      planSelect.value = match ? match.value : (plan || 'individual');
    }

    if (colorSelect) {
      const c     = (color || '').toLowerCase();
      const opts  = Array.from(colorSelect.options);
      const match = opts.find(function (o) {
        return String(o.value || '').toLowerCase() === c;
      });
      colorSelect.value = match ? match.value : '';
    }

    if (enviarSelect) {
      // Por defecto, mantener en perfiles (no mover)
      enviarSelect.value = 'none';
    }

    // Abrir modal chico
    var modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
    modalInstance.show();
  }, true); // usamos captura para adelantarnos a Bootstrap
})();










;(function () {
  'use strict';

  document.addEventListener('click', async function (ev) {
    const btn = ev.target.closest('.btnDeleteFamiliar');
    if (!btn) return;

    ev.preventDefault();

    const tr = btn.closest('tr');
    if (!tr) return;

    const id = btn.getAttribute('data-id');
    if (!id) return;

    const isParent    = tr.classList.contains('js-parent-row');
    const hasChildren = String(tr.dataset.hasChild || '') === '1';

    const SwalRef = typeof Swal !== 'undefined' ? Swal : null;

    // Confirmación
    if (SwalRef) {
      const res = await SwalRef.fire({
        icon: 'warning',
        title: '¿Eliminar registro?',
        text: 'Esta acción no se puede deshacer.',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
      });
      if (!res.isConfirmed) return;
    } else {
      if (!confirm('¿Eliminar registro?')) return;
    }

    // 🔁 Si es PADRE → usamos el controlador de PERFILES
    if (isParent) {
      // Creamos un form oculto que poste a PerfilController.php
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = '../app/controllers/PerfilController.php'; // 👈 ajusta el path si hace falta

      const inAction = document.createElement('input');
      inAction.type = 'hidden';
      inAction.name = 'action';
      inAction.value = 'delete';

      const inId = document.createElement('input');
      inId.type = 'hidden';
      inId.name = 'id';
      inId.value = id;

      // opcional: para que el controller sepa a dónde regresar
      const inBack = document.createElement('input');
      inBack.type = 'hidden';
      inBack.name = 'back';
      inBack.value = window.location.href;

      form.appendChild(inAction);
      form.appendChild(inId);
      form.appendChild(inBack);
      document.body.appendChild(form);
      form.submit(); // 👈 aquí ya entra a PerfilModel::delete()

      return;
    }

    // 👇 Si NO es padre (es hijo), seguimos usando tu endpoint actual vía AJAX
    try {
      const resp = await fetch('actions/perfil_familiar_delete.php', { // ajusta si se llama distinto
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: 'id=' + encodeURIComponent(id)
      });
      const js = await resp.json().catch(() => ({}));
      if (!resp.ok || !js.ok) {
        throw new Error(js.error || 'No se pudo eliminar');
      }

      tr.remove();

      if (SwalRef) {
        await SwalRef.fire({
          icon: 'success',
          title: 'Eliminado',
          text: 'Registro eliminado correctamente.'
        });
      }
    } catch (err) {
      console.error('Error al borrar familiar', err);
      if (SwalRef) {
        await SwalRef.fire({
          icon: 'error',
          title: 'Error',
          text: err.message || 'No se pudo eliminar.'
        });
      } else {
        alert('Error al eliminar: ' + (err.message || 'desconocido'));
      }
    }
  }, false);
})();

