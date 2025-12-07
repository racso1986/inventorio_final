/* stock_pausa_filters.js — filtro por Color/Plan + búsqueda de CORREO (solo STOCK/PAUSA) */
; (function () {
  'use strict';
  if (window.__spFiltersBound) return;
  window.__spFiltersBound = true;

  function norm(s){ return String(s||'').toLowerCase().trim(); }
  function colorFromRow(tr){
    var c = norm(tr.getAttribute('data-color') || '');
    if (c) return c;
    if (tr.classList.contains('row-color-rojo'))   return 'rojo';
    if (tr.classList.contains('row-color-azul'))   return 'azul';
    if (tr.classList.contains('row-color-verde'))  return 'verde';
    if (tr.classList.contains('row-color-blanco')) return 'blanco';
    return '';
  }
  function planKeyFromText(txt){
    var s = norm(txt);
    if (s.indexOf('premium') !== -1) return 'premium';
    if (s.indexOf('estándar') !== -1 || s.indexOf('estandar') !== -1 || s.indexOf('standard') !== -1) return 'estandar';
    return 'basico'; // incluye individual
  }
  function planFromRow(tr){
    var td = tr.querySelector('[data-plan]') || tr.querySelector('.plan-cell-stock, .plan-cell-pausa, .plan-cell, .plan-cell-perfil, .plan-cell-cuenta');
    var val = td ? (td.getAttribute('data-plan') || td.textContent || '') : '';
    return planKeyFromText(val);
  }
  function correoFromRow(tr){
    var c = tr.getAttribute('data-correo') || '';
    if (!c) {
      var tds = tr.querySelectorAll('td');
      if (tds && tds[1]) c = tds[1].textContent || '';
    }
    return norm(c);
  }

  function bindInPane(pane){
    var wrap = pane.querySelector('.__spFilter__');
    if (!wrap || wrap.dataset.bound === '1') return;
    wrap.dataset.bound = '1';

    var cSel = wrap.querySelector('.sp-color');
    var pSel = wrap.querySelector('.sp-plan');
    var qInp = wrap.querySelector('.sp-search');
    var btnC = wrap.querySelector('.sp-clear');
    var tbody = pane.querySelector('tbody');

    if (!tbody) return;

    function apply(){
      var wantColor = (cSel && cSel.value) ? cSel.value : '';
      var wantPlan  = (pSel && pSel.value) ? pSel.value : '';
      var q         = (qInp && qInp.value) ? norm(qInp.value) : '';

      Array.from(tbody.querySelectorAll('tr')).forEach(function (tr) {
        var show = true;

        if (wantColor && colorFromRow(tr) !== wantColor) show = false;
        if (show && wantPlan && planFromRow(tr) !== wantPlan) show = false;
        if (show && q) {
          var correo = correoFromRow(tr);
          if (!correo || correo.indexOf(q) === -1) show = false;
        }

        tr.classList.toggle('d-none', !show);
      });
    }

    if (cSel) cSel.addEventListener('change', apply);
    if (pSel) pSel.addEventListener('change', apply);
    if (qInp) qInp.addEventListener('input', apply);
    if (btnC) btnC.addEventListener('click', function(){
      if (cSel) cSel.value = '';
      if (pSel) pSel.value = '';
      if (qInp) qInp.value = '';
      apply();
    });

    apply();
  }

  function init(){
    var stock = document.getElementById('stock');
    var pausa = document.getElementById('pausa');
    if (stock) bindInPane(stock);
    if (pausa) bindInPane(pausa);
  }

  // iniciar y re-iniciar al cambiar de pestaña
  document.addEventListener('DOMContentLoaded', init);
  try { document.addEventListener('shown.bs.tab', init, false); } catch (_) {}

  // por si el DOM ya está listo
  init();
})();
