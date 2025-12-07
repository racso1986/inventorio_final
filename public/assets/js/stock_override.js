/* stock_override.js — Unificado (Stock, Pausa, Perfiles, Cuenta)
   - Anti doble submit y envío AJAX solo para Stock/Pausa
   - Ocultar/limpiar teléfono en modales de Stock/Pausa
   - Guarda “pista” (tipo/id/correo) ANTES de enviar en TODAS las pestañas
   - Tras recargar, reubica la última fila afectada AL FINAL del tbody (con reintentos)
*/
(function () {
  'use strict';
  if (window.__overrideAllTabsV1) return;
  window.__overrideAllTabsV1 = true;

  console.log('[ALL_TABS_OVERRIDE] cargado');

  // ===== Constantes / claves =====
  const ENDPOINT_RX     = /ajax\/stock_pausa_plan_update\.php/i;
  const CTRL_RX         = /controllers\/(StockController|PausaController)\.php/i;  // para stock/pausa
  const ACTIVE_TAB_KEY  = 'activeTab';
  const LAST_HINT_KEY   = '__lastRowHintAll'; // {tipo:'stock|pausa|perfiles|cuenta', id:'', correo:''}

  let __reloaded = false;
  let __highlighted = false;

  // ===== Helpers =====
  function isStockForm(form) {
    if (!form || !form.action) return false;
    try {
      const href = new URL(form.action, document.baseURI).href;
      return ENDPOINT_RX.test(href) || CTRL_RX.test(href);
    } catch (_) { return false; }
  }
  function fdToParams(fd) {
    const p = new URLSearchParams();
    for (const [k, v] of fd.entries()) p.append(k, v == null ? '' : String(v));
    return p;
  }
  function xhrPost(url, params, cb) {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
      xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
      xhr.setRequestHeader('Accept', 'application/json, text/plain, */*');
      xhr.setRequestHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        const ct  = (xhr.getResponseHeader('content-type') || '').toLowerCase();
        const txt = xhr.responseText || '';
        let data = null, err = null, nonJson = false;
        if (!ct.includes('application/json') || /^\s*</.test(txt)) nonJson = true;
        if (!nonJson) { try { data = JSON.parse(txt); } catch (e) { err = e; nonJson = true; } }
        cb(err, data, xhr, nonJson, txt);
      };
      xhr.send(params.toString());
    } catch (e) { cb(e); }
  }
  function forceReload() {
    if (__reloaded) return;
    __reloaded = true;

    // recordar pestaña activa
    try {
      const activeTab = document.querySelector('.nav-tabs .nav-link.active');
      const target = activeTab ? activeTab.getAttribute('data-bs-target') : '';
      if (target) sessionStorage.setItem(ACTIVE_TAB_KEY, target);
    } catch (_) {}

    // cerrar modales abiertos
    try {
      document.querySelectorAll('.modal.show').forEach(m => {
        if (window.bootstrap && window.bootstrap.Modal) {
          (window.bootstrap.Modal.getInstance(m) || new window.bootstrap.Modal(m)).hide();
        }
      });
    } catch (_) {}

    // recarga agresiva con buster
    let baseHref;
    try {
      const u = new URL(window.location.href);
      u.hash = '';
      u.searchParams.set('_r', Date.now().toString());
      baseHref = u.href;
    } catch (_) {
      baseHref = window.location.href.split('#')[0] + (window.location.search ? '&' : '?') + '_r=' + Date.now();
    }
    try { window.location.replace(baseHref); } catch (_) {}
    setTimeout(()=>{ try { window.location.reload(); } catch(_){} },120);
    setTimeout(()=>{ try { window.location.assign(baseHref); } catch(_){} },300);
    setTimeout(()=>{
      try { const f=document.createElement('form'); f.method='GET'; f.action=baseHref; f.style.display='none'; document.body.appendChild(f); f.submit(); } catch(_){}
    },450);
  }
  function tabIdFromForm(form) {
    const pane = form && form.closest ? form.closest('.tab-pane') : null;
    if (pane && pane.id && ['stock','pausa','perfiles','cuenta'].includes(pane.id)) return pane.id;
    const act = (form && form.action || '').toLowerCase();
    if (act.includes('cuenta'))   return 'cuenta';
    if (act.includes('perfil'))   return 'perfiles';
    if (act.includes('pausa'))    return 'pausa';
    if (act.includes('stock'))    return 'stock';
    return 'stock';
  }
  function stashHintFromForm(form) {
    const tipo    = tabIdFromForm(form);
    const id      = (form.querySelector('[name="id"]')?.value || '').replace(/\D+/g,'');
    const correo  = (form.querySelector('[name="correo"]')?.value || '').trim().toLowerCase();
    const destino = (form.querySelector('[name="destino"]')?.value || '').trim().toLowerCase();

    // si hay destino válido (stock|pausa), úsalo como scope final
    const scope = destino && ['stock','pausa'].includes(destino) ? destino : tipo;
    const hint  = { tipo: scope, id, correo };

    try { sessionStorage.setItem(LAST_HINT_KEY, JSON.stringify(hint)); } catch(_) {}
  }
  function readHint() {
    let h = null;
    try { h = JSON.parse(sessionStorage.getItem(LAST_HINT_KEY) || 'null'); } catch(_){}
    if (h) { try { sessionStorage.removeItem(LAST_HINT_KEY); } catch(_){} }
    return h;
  }
  function findRowByHint(hint) {
    if (!hint) return null;
    const scope = document.getElementById(hint.tipo);
    if (!scope) return null;
    const tbody = scope.querySelector('tbody');
    if (!tbody) return null;

    // 1) por id (estructura según tabla)
    if (hint.id) {
      if (hint.tipo === 'stock' || hint.tipo === 'pausa') {
        const td = tbody.querySelector(`td.plan-cell-${hint.tipo}[data-id="${hint.id}"]`)
              || tbody.querySelector(`td.plan-cell-stock[data-id="${hint.id}"]`)
              || tbody.querySelector(`td.plan-cell-pausa[data-id="${hint.id}"]`);
        if (td) return td.closest('tr');
      } else {
        const entidad = (hint.tipo === 'perfiles') ? 'perfil' : 'cuenta';
        const tr = tbody.querySelector(`tr.js-parent-row[data-entidad="${entidad}"][data-id="${hint.id}"]`);
        if (tr) return tr;
      }
    }

    // 2) por correo (columna 2 suele ser Correo en todas)
    if (hint.correo) {
      const rows = tbody.querySelectorAll('tr');
      for (const tr of rows) {
        const tdCorreo = tr.cells && tr.cells[1];
        const txt = tdCorreo ? tdCorreo.textContent.trim().toLowerCase() : '';
        if (txt === hint.correo) return tr;
      }
    }
    return null;
  }
  function moveRowToEndOnce() {
    const hint = readHint();
    if (!hint) return false;
    const tr = findRowByHint(hint);
    if (!tr) return false;
    const tbody = tr.closest('tbody');
    if (!tbody) return false;
    tbody.appendChild(tr);

    // highlight visual una vez
    if (!__highlighted) {
      __highlighted = true;
      try {
        const css = '.recently-moved{outline:2px dashed;animation:rmblink 1s ease-in-out 2} @keyframes rmblink{0%,100%{outline-offset:0}50%{outline-offset:3px}}';
        const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
        tr.classList.add('recently-moved');
        setTimeout(()=>tr.classList.remove('recently-moved'), 1600);
      } catch(_) {}
    }
    return true;
  }
  function kickReappend() {
    let tries = 12;      // ~12 reintentos
    const delay = 140;   // c/u
    const attempt = ()=>{ moveRowToEndOnce(); if (--tries > 0) setTimeout(attempt, delay); };
    requestAnimationFrame(()=>requestAnimationFrame(attempt));
  }

  // ===== Ocultar teléfono en modales de Stock/Pausa =====
  function hidePhoneBlock(modal) {
    if (!modal) return;
    try {
      // si el form es de stock/pausa, ocultamos bloque de teléfono
      const form = modal.querySelector('form');
      if (!isStockForm(form)) return;
      modal.querySelectorAll('input[name="whatsapp"]').forEach(h=>{
        const grp = h.previousElementSibling;
        if (grp && grp.classList && grp.classList.contains('input-group')) grp.style.display='none';
        h.value = '';
        h.style.display='none';
      });
      modal.querySelectorAll('input[aria-label="Prefijo país"], input[aria-label="Número local"], .input-group-text')
           .forEach(el => { const g = el.closest && el.closest('.input-group'); if (g) g.style.display='none'; });
    } catch(_) {}
  }

  // ===== Listeners globales =====

  // 0) stash de “pista” para TODAS las pestañas (no prevenimos submit aquí)
  document.addEventListener('submit', function (e) {
    const form = e.target && e.target.closest ? e.target.closest('form') : null;
    if (!form) return;
    // Solo si estamos en una de las 4 pestañas o el action sugiere que lo es
    const pane = form.closest && form.closest('.tab-pane');
    const okPane = pane && ['stock','pausa','perfiles','cuenta'].includes(pane.id);
    const maybe  = /perfil|cuenta|pausa|stock/i.test(form.action || '');
    if (!okPane && !maybe) return;
    try { stashHintFromForm(form); } catch(_) {}
  }, true); // capture: antes de que cualquier otro handler lo cancele

  // 1) Interceptar SOLO Stock/Pausa para enviar por AJAX (y limpiar teléfono)
  document.addEventListener('submit', function (e) {
    const form = e.target && e.target.closest ? e.target.closest('form') : null;
    if (!isStockForm(form)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    handleStockSave(form);
  }, true);

  document.addEventListener('click', function (e) {
    const btn = e.target && e.target.closest ? e.target.closest('button[type="submit"], input[type="submit"]') : null;
    if (!btn) return;
    let form = null;
    if (btn && btn.getAttribute && btn.hasAttribute('form')) {
      const fid = btn.getAttribute('form'); if (fid) form = document.getElementById(fid);
    }
    if (!form) form = btn && btn.form ? btn.form : (btn ? btn.closest('form') : null);
    if (!isStockForm(form)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    handleStockSave(form);
  }, true);

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    const form = e.target && e.target.closest ? e.target.closest('form') : null;
    if (!isStockForm(form)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    handleStockSave(form);
  }, true);

  // 2) Ocultar teléfono cuando se abre un modal (solo stock/pausa)
  document.addEventListener('shown.bs.modal', function (ev) { hidePhoneBlock(ev.target); });

  // 3) Reintentos de reubicar al final post-reload
  document.addEventListener('DOMContentLoaded', kickReappend);
  window.addEventListener('load', kickReappend);
  document.addEventListener('visibilitychange', ()=>{ if (!document.hidden) kickReappend(); });

  // ===== Core: guardar Stock/Pausa por AJAX =====
  function handleStockSave(form) {
    try {
      if (form.dataset.submitting === '1') return;
      form.dataset.submitting = '1';

      const btn = form.querySelector('button[type="button"], .btn-primary, [data-role="guardar-stock"]');
      if (btn) { btn.disabled = true; btn.setAttribute('aria-disabled','true'); }

      // Tomar datos + LIMPIAR teléfono
      const fd = new FormData(form);
      ['whatsapp','telefono','phone','cliente','celular'].forEach(n => fd.delete(n));

      // Defaults + pista extra (tipo/destino)
      const tipo    = (fd.get('tipo') || tabIdFromForm(form) || 'stock').toString().toLowerCase();
      const destino = (fd.get('destino') || '').toString().toLowerCase();
      const id      = (fd.get('id') || '').toString().replace(/\D+/g,'');
      const correo  = (fd.get('correo') || '').toString().trim().toLowerCase();

      // Guarda “pista” robusta para reubicar
      try {
        const scope = destino && ['stock','pausa'].includes(destino) ? destino : tipo;
        sessionStorage.setItem(LAST_HINT_KEY, JSON.stringify({ tipo: scope, id, correo }));
      } catch(_) {}

      if (!fd.get('tipo'))    fd.set('tipo', tipo || 'stock');
      if (!fd.get('plan'))    fd.set('plan', 'estándar');
      if (!fd.get('destino')) fd.set('destino', '');
      if (!fd.has('color'))   fd.set('color', '');

      const params = fdToParams(fd);
      const url = new URL(form.action || 'ajax/stock_pausa_plan_update.php', document.baseURI).href;

      xhrPost(url, params, function (err, data, xhr, nonJson) {
        form.dataset.submitting = '0';
        if (btn) { btn.disabled = false; btn.removeAttribute('aria-disabled'); }

        if (nonJson) { forceReload(); return; }
        if (err)     { if (window.Swal) Swal.fire({ icon:'error', title:'Error', text:String(err?.message || err) }); return; }
        if (!data || data.ok !== true) {
          const msg = (data && data.error) ? data.error : `HTTP ${xhr && xhr.status}`;
          if (window.Swal) Swal.fire({ icon:'error', title:'No se pudo guardar', text: msg });
          return;
        }

        // éxito -> recargar (y después reubicar al final)
        forceReload();
      });
    } catch (e) {
      if (window.Swal) Swal.fire({ icon:'error', title:'Error', text:String(e.message || e) });
    }
  }

})();
