/*
  iptv_price_autofill.js
  - Pre-rellena y preserva el campo 'soles' en los modales de IPTV (agregar/editar).
  - Lee desde el botón .btn-edit-perfil[data-row], desde la fila (data-*) o desde un input de cabecera si existe.
  - Normaliza a 2 decimales al enviar.
*/
(function(){
  'use strict';
  if (window.__iptvPriceAutofillV1__) return;
  window.__iptvPriceAutofillV1__ = true;

  function findForm(modal){
    return modal ? (modal.querySelector('form') || null) : null;
  }
  function ensureSolesInput(form){
    if (!form) return null;
    let el = form.querySelector('input[name="soles"]');
    if (!el) {
      el = document.createElement('input');
      el.type = 'number'; el.step = '0.01'; el.name = 'soles'; el.className = 'form-control';
      el.placeholder = '0.00';
      // intenta insertarlo junto a "Soles" si hay un contenedor conocido, si no, al inicio del form
      const holder = form.querySelector('[data-field="soles"], .iptv-soles-field');
      if (holder) holder.appendChild(el);
      else form.prepend(el);
    }
    return el;
  }
  function getHeaderDefault(){
    var inp = document.getElementById('precioIptvHead') || document.querySelector('#precioHead, #precioPerfilHead');
    if (!inp) return '';
    return (inp.value || '').trim();
  }
  function normMoney(v){
    if (v == null) return '';
    var s = String(v).replace(',', '.').trim();
    var f = parseFloat(s);
    if (!isFinite(f)) return '';
    return f.toFixed(2);
  }

  function prefillFromTrigger(modal, evt){
    const form = findForm(modal);
    const solesInput = ensureSolesInput(form);
    if (!form || !solesInput) return;

    // valor por defecto “limpio”
    solesInput.value = '';

    let data = null;
    // data desde el botón que abrió el modal
    if (evt && evt.relatedTarget) {
      try {
        const json = evt.relatedTarget.getAttribute('data-row') || '{}';
        data = JSON.parse(json);
      } catch(e) { data = null; }
    }
    // si no, intentar desde la fila seleccionada
    if (!data && evt && evt.relatedTarget) {
      const tr = evt.relatedTarget.closest('tr');
      if (tr) {
        data = {
          soles: tr.getAttribute('data-soles') || (tr.querySelector('td:nth-child(9)')?.textContent||'')
        };
      }
    }

    // fallback: input de cabecera
    const fallback = getHeaderDefault();

    const raw = (data && (data.soles != null) ? data.soles : fallback);
    const val = normMoney(raw);
    if (val) solesInput.value = val;
  }

  function bind(modalId){
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.addEventListener('show.bs.modal', function(ev){
      prefillFromTrigger(modal, ev);
    });
    // Al enviar, normaliza el valor
    const form = findForm(modal);
    if (form) {
      form.addEventListener('submit', function(){
        const el = form.querySelector('input[name="soles"]');
        if (el) {
          const n = normMoney(el.value);
          if (n) el.value = n;
        }
      });
    }
  }

  // Modales conocidos
  ['modalEditarIptv','modalAgregarIptv'].forEach(bind);
})();
