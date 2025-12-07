// app_perfiles_familiar_context.js
// Un solo bloque para abrir y guardar el “modal chico” con CONTEXTO (perfiles vs familiar)
// Requiere un único modal chico existente con id #modalCambiarPlanPerfil
// y botón #btnGuardarPlanPerfil (se reutiliza para ambos contextos).

;(function () {
  'use strict';
  if (window.__PF_CTX_PATCH__) return; window.__PF_CTX_PATCH__ = true;
  if (!window.bootstrap) { console.warn('[PF-CTX] Bootstrap no disponible'); return; }

  // === Helpers ===
  const $ = (sel, ctx=document) => ctx.querySelector(sel);
  const $$ = (sel, ctx=document) => Array.prototype.slice.call(ctx.querySelectorAll(sel));
  const normPlan = v => {
    v = String(v || '').toLowerCase().trim();
    return ['individual','standard','premium'].includes(v) ? v : 'premium';
  };
  const colorClasses = ['row-color-rojo','row-color-azul','row-color-verde','row-color-blanco'];
  const setRowColor = (row, color) => {
    if (!row) return;
    // limpiar rastro previo
    row.classList.remove(...colorClasses);
    row.removeAttribute('data-color');
    // aplicar
    const c = String(color || '').trim().toLowerCase();
    if (['rojo','azul','verde','blanco'].includes(c)) {
      row.classList.add('row-color-' + c);
      row.setAttribute('data-color', c);
    }
  };

  // Guardamos la última celda clickeada para fallback de UI-update
  let lastCell = null;

  // === 1) Abrir modal chico desde cualquier celda de plan (.plan-cell-perfil) ===
  document.addEventListener('click', function (ev) {
    const td = ev.target.closest('td.plan-cell-perfil');
    if (!td) return;

    const row   = td.closest('tr');
    const modal = document.getElementById('modalCambiarPlanPerfil');
    if (!modal) { console.warn('[PF-CTX] Falta #modalCambiarPlanPerfil'); return; }

    ev.preventDefault();
    ev.stopPropagation();

    lastCell = td; // record

         // Detectar contexto según la TABLA, no solo por data-entidad
    // - Si la celda está en #perfilesFamiliarTable → contexto "familiar"
    // - En cualquier otra tabla (perfiles normal) → contexto "perfiles"
        // Detectar contexto según la TABLA, no solo por data-entidad
    // - Si la celda está en #perfilesFamiliarTable  → contexto "familiar"
    // - En cualquier otra tabla (PERFILES normal)  → contexto "perfiles"
    const table = row && row.closest('table');
    const isFam = !!(table && table.id === 'perfilesFamiliarTable');
    modal.dataset.context = isFam ? 'familiar' : 'perfiles';




    // ID robusto
    const id = (td.getAttribute('data-id') || row?.getAttribute('data-id') || '').replace(/\D+/g,'');
    if (!id) { console.warn('[PF-CTX] Sin ID en la celda/fila'); return; }

    // Plan/color actuales
    const planAttr  = td.getAttribute('data-plan') || td.textContent || '';
    const plan      = normPlan(planAttr);
    const rowColor  = (row?.getAttribute('data-color') || '').trim();

    // Inputs del modal
    const idEl     = modal.querySelector('#perfilPlanId');
    const planSel  = modal.querySelector('#perfilPlanSelect');
    const colorSel = modal.querySelector('#perfilColorSelect, select[name="color"]');
    const destSel  = modal.querySelector('#perfilEnviarASelect, select[name="enviar_a"]');

    if (!idEl || !planSel) { console.warn('[PF-CTX] Faltan inputs del modal', {idEl, planSel}); return; }

    idEl.value = id;
    planSel.value = plan;
    if (colorSel) colorSel.value = rowColor || '';
    if (destSel)  destSel.value  = 'none';

    // Mostrar
    bootstrap.Modal.getOrCreateInstance(modal).show();
  }, true);

  // === 2) Guardar (unificado) — decide endpoint por contexto ===
  document.addEventListener('click', async function (ev) {
    const btn = ev.target.closest('#btnGuardarPlanPerfil');
    if (!btn) return;

    const modal = btn.closest('.modal');
    if (!modal) { console.warn('[PF-CTX] Guardar sin modal'); return; }

    const idEl     = modal.querySelector('#perfilPlanId');
    const planSel  = modal.querySelector('#perfilPlanSelect');
    const colorSel = modal.querySelector('#perfilColorSelect, select[name="color"]');
    const destSel  = modal.querySelector('#perfilEnviarASelect, select[name="enviar_a"]');

    const id       = (idEl?.value || '').replace(/\D+/g,'');
    const plan     = planSel ? String(planSel.value || '').trim() : '';
    const color    = colorSel ? String(colorSel.value || '').trim() : '';
    const enviar_a = destSel ? String(destSel.value || 'none').trim().toLowerCase() : 'none';

    if (!id || !planSel) { console.warn('[PF-CTX] Datos incompletos', { id, planSel }); return; }

    // Contexto y endpoint
    const ctx = (modal.dataset.context === 'familiar') ? 'familiar' : 'perfiles';
    const rel = (ctx === 'familiar')
      ? 'ajax/perfiles_familiar_plan_update.php'
      : 'ajax/perfiles_plan_update.php';
    const endpoint = new URL(rel, document.baseURI).toString();

    // Feedback UI
    const oldHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>Guardando...';

    try {
      const params = new URLSearchParams({ id, plan, enviar_a });
      if (color !== '') params.set('color', color);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        credentials: 'same-origin',
        body: params
      });

      const ct = res.headers.get('content-type') || '';
      const raw = await res.text();
      let data = null;
      if (ct.includes('application/json')) {
        try { data = JSON.parse(raw); } catch (_) { /* ignore */ }
      }
      if (!(res.ok && data && data.ok)) {
        const msg = (data && (data.error || data.message)) || raw || 'Error al guardar';
        if (window.Swal) Swal.fire({ icon:'error', title:'No se pudo guardar', text: msg });
        else alert('No se pudo guardar: ' + msg);
        return;
      }

      // === OK: actualizar UI local ===
      const scopeSel = (ctx === 'familiar') ? '#perfiles-familiar' : '#perfiles';
      let td = lastCell && document.contains(lastCell) ? lastCell : null;
      if (!td) td = document.querySelector(`${scopeSel} td.plan-cell-perfil[data-id="${id}"]`);
      const row = td ? td.closest('tr') : null;

      if (td) {
        td.textContent = plan;
        td.setAttribute('data-plan', plan);
      }
      if (row) {
        // si backend envía color, úsalo; si no, aplica el elegido por el usuario
        const newColor = (Object.prototype.hasOwnProperty.call(data, 'color'))
          ? (data.color || '')
          : color;
        setRowColor(row, newColor);
      }

      bootstrap.Modal.getOrCreateInstance(modal).hide();
      if (window.Swal) Swal.fire({ icon:'success', title:'Actualizado', timer:1200, showConfirmButton:false });

    } catch (err) {
      console.error('[PF-CTX] Fetch error', err);
      if (window.Swal) Swal.fire({ icon:'error', title:'Error de red' });
      else alert('Error de red');
    } finally {
      btn.disabled = false;
      btn.innerHTML = oldHtml;
    }
  }, true);
})();