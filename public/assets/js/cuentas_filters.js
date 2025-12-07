/* cuentas_filters.fixed.js — Filtros/orden para CUENTAS
   - Soporta: color_*, pendientes, plan (con subselect), dias_asc/dias_desc
   - Búsqueda por correo y WhatsApp (con o sin espacios)
   - Oculta separadores (tr[data-sep="1"]) cuando hay filtro/orden activo
   - Botón "Limpiar" restablece todo
*/
;(function(){
  'use strict';
  if (window.__cuentasFilterBoundV1) return;
  window.__cuentasFilterBoundV1 = true;

  var pane  = document.getElementById('cuentas');
  if (!pane) return;

  var table = pane.querySelector('#cuentasTable') || pane.querySelector('table');
  if (!table) return;

  var tbody = table.tBodies && table.tBodies[0];
  if (!tbody) return;

  // utilidades
  function norm(s){ return String(s||'').toLowerCase().trim(); }
  function digits(s){ return String(s||'').replace(/\D+/g,''); }
  function isSep(tr){ return tr && tr.getAttribute('data-sep') === '1'; }

  // CSS: ocultar separadores cuando hay filtro/orden
  (function injectSepCss(){
    if (document.getElementById('cuSepCss')) return;
    var st = document.createElement('style');
    st.id = 'cuSepCss';
    st.textContent = '#cuentasTable.cu-filtering tr[data-sep="1"]{display:none!important;}';
    document.head.appendChild(st);
  })();

  // Controles
  var wrap   = pane.querySelector('.__cuFilter__[data-scope="cuentas"]') || pane;
  var input  = wrap.querySelector('.cu-search');
  var main   = wrap.querySelector('.cu-main');
  var planEl = wrap.querySelector('.cu-plan');
  var btnClr = wrap.querySelector('.cu-clear');

  // Ocultar subselect Plan al inicio si no corresponde
  if (planEl) {
    if (!main || main.value !== 'plan') planEl.style.display = 'none';
  }

  // --- Agrupar por bloques: (separador) -> padre -> hijos
  function buildGroups(){
    var rows = Array.from(tbody.querySelectorAll('tr'));
    var groups = [];
    var currentSep = null;
    var currentGroup = null;

    rows.forEach(function(tr){
      if (isSep(tr)) {
        currentSep = tr;
        currentGroup = null;
        return;
      }
      var isParent = tr.classList.contains('js-parent-row') || tr.getAttribute('data-parent') === '1';
      if (isParent || !currentGroup) {
        currentGroup = { sep: currentSep, parent: tr, children: [] };
        groups.push(currentGroup);
      } else {
        currentGroup.children.push(tr);
      }
    });
    return groups;
  }

  function reappendGroups(groups){
    var lastSep = null;
    groups.forEach(function(g){
      if (g.sep && g.sep !== lastSep) {
        tbody.appendChild(g.sep);
        lastSep = g.sep;
      }
      tbody.appendChild(g.parent);
      g.children.forEach(function(ch){ tbody.appendChild(ch); });
    });
  }

  // Lectores desde el DOM
  function planKeyFromText(txt){
    var s = norm(txt);
    if (s.indexOf('premium') !== -1) return 'premium';
    if (s.indexOf('estándar') !== -1 || s.indexOf('estandar') !== -1 || s.indexOf('standard') !== -1) return 'estandar';
    return 'basico'; // incluye “individual”
  }
  function planFromParent(tr){
    var td = tr.querySelector('.plan-cell-cuenta,[data-plan]');
    var val = td ? (td.getAttribute('data-plan') || td.textContent || '') : (tr.getAttribute('data-plan')||'');
    return planKeyFromText(val);
  }
  function estadoFromParent(tr){
    var est = norm(tr.getAttribute('data-estado') || '');
    if (est) return est;
    var badge = tr.querySelector('.badge');
    return badge ? norm(badge.textContent) : '';
  }
  function colorFromParent(tr){
    var c = norm(tr.getAttribute('data-color') || '');
    if (c) return c;
    if (tr.classList.contains('row-color-rojo'))   return 'rojo';
    if (tr.classList.contains('row-color-azul'))   return 'azul';
    if (tr.classList.contains('row-color-verde'))  return 'verde';
    if (tr.classList.contains('row-color-blanco')) return 'blanco';
    return '';
  }
  function correoFromParent(tr){
    var c = tr.getAttribute('data-correo') || '';
    if (!c){
      var ccell = tr.querySelector('.correo-cell,[data-correo-cell]');
      c = ccell ? ccell.textContent : ((tr.children[1] && tr.children[1].textContent) || '');
    }
    return norm(c);
  }
  function daysFromParent(tr){
    // 6ª columna (DÍAS)
    var cell = tr.children[5];
    if (!cell) return 0;
    var m = String(cell.textContent||'').match(/-?\d+/);
    return m ? parseInt(m[0],10) : 0;
  }
  // WhatsApp tolerante (href y/o celda .cliente)
  function waDigitsFromParent(tr){
    var a   = tr.querySelector('.wa-link');
    var raw = a && a.href ? a.href : (tr.getAttribute('data-whatsapp') || '');
    var d   = digits(raw);
    if (!d) {
      var c = tr.querySelector('.cliente');
      d = c ? digits(c.textContent) : '';
    }
    return d;
  }
  function waDigitsFromGroup(g){
    var buf = '';
    var dp = waDigitsFromParent(g.parent);
    if (dp) buf += dp + ' ';
    g.children.forEach(function(ch){
      var a   = ch.querySelector('.wa-link');
      var raw = a && a.href ? a.href : '';
      var d   = digits(raw);
      if (!d) {
        var c = ch.querySelector('.cliente');
        d = c ? digits(c.textContent) : '';
      }
      if (d) buf += d + ' ';
    });
    return buf.replace(/\s+/g,'');
  }
  function childText(tr){ return norm(tr.textContent); }

  function hideGroup(g, on){
    var hide = !!on;
    [g.parent].concat(g.children).forEach(function(tr){
      tr.classList.toggle('d-none', hide);
      tr.style.setProperty('display', hide ? 'none' : '', hide ? 'important' : '');
    });
  }

  // Orden base (si hay data-created-ts)
  function createdTsFromRow(tr){
    var v = tr.getAttribute('data-created-ts');
    if (!v) return 0;
    var n = parseInt(v,10);
    if (isNaN(n)) return 0;
    return (n < 1e12 ? n*1000 : n);
  }
  function sortByCreated(groups, dir){
    var asc = (dir === 'asc');
    groups.sort(function(a,b){
      var av = createdTsFromRow(a.parent), bv = createdTsFromRow(b.parent);
      return asc ? (av - bv) : (bv - av);
    });
  }
  function sortByDays(groups, dir){
    var asc = (dir === 'asc');
    groups.sort(function(a,b){
      var av = daysFromParent(a.parent), bv = daysFromParent(b.parent);
      return asc ? (av - bv) : (bv - av);
    });
  }

  function setFilteringClass(on){ table.classList.toggle('cu-filtering', !!on); }
  function hasActiveControls(){
    var vMain = (main && main.value) || '';
    var vPlan = (planEl && planEl.style.display !== 'none' && planEl.value) || '';
    var q     = (input && input.value) || '';
    return !!(vMain || vPlan || q);
  }

  // Estado inicial
  var groups = buildGroups();
  sortByCreated(groups, 'desc');
  reappendGroups(groups);

  function apply(){
    // mostrar todo
    groups.forEach(function(g){ hideGroup(g,false); });

    var vMain = main ? main.value : '';
    var vPlan = planEl ? planEl.value : '';

    // Orden por días
    if (vMain === 'dias_asc' || vMain === 'dias_desc') {
      sortByDays(groups, vMain === 'dias_asc' ? 'asc' : 'desc');
      reappendGroups(groups);
    }

    // Filtros principales
    groups.forEach(function(g){
      var hide = false;
      switch(vMain){
        case 'color_rojo':
        case 'color_azul':
        case 'color_verde':
          hide = (colorFromParent(g.parent) !== vMain.split('_')[1]);
          break;
        case 'pendientes':
          hide = (estadoFromParent(g.parent) !== 'pendiente');
          break;
        case 'plan':
          hide = (vPlan && planFromParent(g.parent) !== vPlan);
          break;
        // dias_asc/dias_desc solo ordenan
      }
      if (hide) hideGroup(g,true);
    });

    // Búsqueda (correo + WhatsApp sin espacios, en padre e hijos)
    var q = input ? norm(input.value) : '';
    var qNum = digits(q);

    if (q || (qNum && qNum.length>=3)) {
      groups.forEach(function(g){
        if (g.parent.classList.contains('d-none')) return;
        var ok = false;

        if (q && correoFromParent(g.parent).indexOf(q) !== -1) ok = true;

        if (!ok && qNum && qNum.length>=3) {
          var allDigits = waDigitsFromGroup(g);
          if (allDigits.indexOf(qNum) !== -1) ok = true;
        }

        if (!ok && q){
          for (var i=0;i<g.children.length;i++){
            if (childText(g.children[i]).indexOf(q) !== -1){ ok = true; break; }
          }
        }

        if (!ok) hideGroup(g,true);
      });
    }

    setFilteringClass(hasActiveControls());
  }

  function togglePlan(){
    if (!main || !planEl) return;
    if (main.value === 'plan') {
      planEl.style.display = '';
    } else {
      planEl.value = '';
      planEl.style.display = 'none';
    }
  }

  function clearAll(){
    if (input)  input.value = '';
    if (main)   main.value = '';
    if (planEl){
      planEl.value = '';
      planEl.style.display = 'none';
    }
    groups = buildGroups();
    sortByCreated(groups, 'desc');
    reappendGroups(groups);
    groups.forEach(function(g){ hideGroup(g,false); });
    setFilteringClass(false);
  }

  // Eventos
  input && input.addEventListener('input', apply);
  main  && main.addEventListener('change', function(){ togglePlan(); apply(); });
  planEl&& planEl.addEventListener('change', apply);
  btnClr && btnClr.addEventListener('click', function(e){
    e.preventDefault();
    clearAll();
  });

  // Primera pasada
  togglePlan();
  apply();
})();
