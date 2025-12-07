/* perfiles_filters.fixed.js — Filtro/orden PERFILES
   - Soporta: color_*, pendientes, plan (con subselect), dias_asc/dias_desc, búsqueda por correo/WhatsApp
   - Oculta separadores cuando hay filtro/orden activo; botón Limpiar restablece todo.
*/
;(function(){
  'use strict';
  if (window.__perfilesFilterBoundV2) return;
  window.__perfilesFilterBoundV2 = true;

  var pane  = document.getElementById('perfiles');
  if (!pane) return;

  var table = pane.querySelector('#perfilesTable') || pane.querySelector('table');
  if (!table) return;

  var tbody = table.tBodies && table.tBodies[0];
  if (!tbody) return;

  // ===== utilidades
  function norm(s){ return String(s||'').toLowerCase().trim(); }
  function digits(s){ return String(s||'').replace(/\D+/g,''); }
  function isSep(tr){ return tr && tr.getAttribute('data-sep') === '1'; }

  // Inyección CSS para ocultar separadores cuando hay filtro/orden
  (function injectSepCss(){
    if (document.getElementById('pfSepCss')) return;
    var st = document.createElement('style');
    st.id = 'pfSepCss';
    st.textContent = '#perfilesTable.pf-filtering tr[data-sep="1"]{display:none!important;}';
    document.head.appendChild(st);
  })();

  // Controles
  var wrap   = pane.querySelector('.__pcFilter__[data-scope="perfiles"]') || pane;
  var input  = wrap.querySelector('.pc-search');
  var main   = wrap.querySelector('.pc-main');
  var planEl = wrap.querySelector('.pc-plan');
  var btnClr = wrap.querySelector('.pc-clear');

  // Oculta el subselect de plan al iniciar (si no está en "plan")
  if (planEl) {
    if (!main || main.value !== 'plan') planEl.style.display = 'none';
  }

  // ==== Agrupar: separadores, padres, hijos (en orden visual)
  function buildGroups(){
    var rows = Array.from(tbody.querySelectorAll('tr'));
    var groups = [];
    var currentSep = null;
    var currentGroup = null;

    rows.forEach(function(tr){
      if (isSep(tr)) {
        currentSep = tr;
        currentGroup = null; // nueva zona
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
    // Mantiene los separadores originales por bloque
    var lastSep = null;
    groups.forEach(function(g){
      if (g.sep && g.sep !== lastSep) {
        tbody.appendChild(g.sep);
        lastSep = g.sep;
      } else if (!g.sep && lastSep && isSep(lastSep)) {
        // nada
      }
      tbody.appendChild(g.parent);
      g.children.forEach(function(ch){ tbody.appendChild(ch); });
    });
  }

  // Lectores
  function planKeyFromText(txt){
    var s = norm(txt);
    if (s.indexOf('premium') !== -1) return 'premium';
    if (s.indexOf('estándar') !== -1 || s.indexOf('estandar') !== -1 || s.indexOf('standard') !== -1) return 'estandar';
    return 'basico'; // incluye “individual”
  }
  function planFromParent(tr){
    var td = tr.querySelector('.plan-cell-perfil,[data-plan]');
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
    // 6ª columna (DÍAS). Soporta <span> y negativos.
    var cell = tr.children[5];
    if (!cell) return 0;
    var m = String(cell.textContent||'').match(/-?\d+/);
    return m ? parseInt(m[0],10) : 0;
  }

  // === NUEVO: WhatsApp tolerante a formato, con fallback a .cliente ===
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
    // Padre
    var dp = waDigitsFromParent(g.parent);
    if (dp) buf += dp + ' ';
    // Hijos
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

  // orden inicial por “creado” si existe data-created-ts
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

  // orden por días
  function sortByDays(groups, dir){
    var asc = (dir === 'asc');
    groups.sort(function(a,b){
      var av = daysFromParent(a.parent), bv = daysFromParent(b.parent);
      return asc ? (av - bv) : (bv - av);
    });
  }

  // Estado “hay filtro/orden”
  function setFilteringClass(on){
    table.classList.toggle('pf-filtering', !!on);
  }
  function hasActiveControls(){
    var vMain = (main && main.value) || '';
    var vPlan = (planEl && planEl.style.display !== 'none' && planEl.value) || '';
    var q     = (input && input.value) || '';
    return !!(vMain || vPlan || q);
  }

  // === flujo principal
  var groups = buildGroups();
  // orden base por creado desc (si no hay ts, no cambia nada)
  sortByCreated(groups, 'desc');
  reappendGroups(groups);

  function apply(){
    // mostrar todo
    groups.forEach(function(g){ hideGroup(g,false); });

    // 1) filtro “principal”
    var vMain = main ? main.value : '';
    var vPlan = planEl ? planEl.value : '';

    // Orden por días si aplica
    if (vMain === 'dias_asc' || vMain === 'dias_desc') {
      sortByDays(groups, vMain === 'dias_asc' ? 'asc' : 'desc');
      reappendGroups(groups);
    }

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
        // dias_asc/dias_desc no filtran, sólo ordenan
      }
      if (hide) hideGroup(g,true);
    });

    // 2) búsqueda (correo + WhatsApp sin espacios) — incluye hijos
    var q = input ? norm(input.value) : '';
    var qNum = digits(q);

    if (q || (qNum && qNum.length>=3)) {
      groups.forEach(function(g){
        if (g.parent.classList.contains('d-none')) return; // ya oculto por select
        var ok = false;

        // correo del padre
        if (q && correoFromParent(g.parent).indexOf(q) !== -1) ok = true;

        // whatsapp (padre o hijos) — ahora también desde .cliente
        if (!ok && qNum && qNum.length>=3) {
          var allDigits = waDigitsFromGroup(g); // incluye hijos
          if (allDigits.indexOf(qNum) !== -1) ok = true;
        }

        // texto libre en hijos
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
    // reconstruir grupos por si el DOM cambió por otras acciones
    groups = buildGroups();
    // restaurar orden base por creado desc
    sortByCreated(groups, 'desc');
    reappendGroups(groups);
    groups.forEach(function(g){ hideGroup(g,false); });
    setFilteringClass(false);
  }

  // eventos
  input && input.addEventListener('input', apply);
  main  && main.addEventListener('change', function(){ togglePlan(); apply(); });
  planEl&& planEl.addEventListener('change', apply);
  btnClr && btnClr.addEventListener('click', function(e){
    e.preventDefault();
    clearAll();
  });

  // primera pasada
  togglePlan();
  apply();
})();
