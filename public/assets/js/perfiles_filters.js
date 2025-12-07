/* PERFIL FILTER – mínimo, compatible con tu HTML del DOC */
;(function(){
  'use strict';
  if (window.__perfilesFilterBound) return;
  window.__perfilesFilterBound = true;

  var pane  = document.getElementById('perfiles');
  if (!pane) { console.error('[PF] no existe #perfiles'); return; }

  var table = pane.querySelector('#perfilesTable') || pane.querySelector('table');
  if (!table) { console.error('[PF] no hay #perfilesTable dentro de #perfiles'); return; }

  var tbody = table.querySelector('tbody');
  if (!tbody) { console.error('[PF] la tabla no tiene <tbody>'); return; }

  var input = pane.querySelector('.__pcFilter__[data-scope="perfiles"] .pc-search') || pane.querySelector('.pc-search');
  if (!input) { console.error('[PF] no encontré input .pc-search dentro de #perfiles'); return; }

  // agrupa por padre (js-parent-row) + sus hijos siguientes
  function buildGroups(){
    var groups=[], curr=null;
    Array.from(tbody.querySelectorAll('tr')).forEach(function(tr){
      var isParent = tr.classList.contains('js-parent-row') || tr.getAttribute('data-parent') === '1';
      if (isParent || !curr){ curr = { parent: tr, children: [] }; groups.push(curr); }
      else { curr.children.push(tr); }
    });
    return groups;
  }
  var groups = buildGroups();
  console.log('[PF] grupos detectados:', groups.length);

  function norm(s){ return String(s||'').toLowerCase().trim(); }
  function digits(s){ return String(s||'').replace(/\D+/g,''); }
  
  function createdTsFromRow(tr){
  var v = tr.getAttribute('data-created-ts');
  var n = v ? parseInt(v,10) : NaN;
  return isNaN(n) ? 0 : n;
}
function sortGroupsByCreated(groups, dir){
  var asc = (dir === 'asc');
  groups.sort(function(a,b){
    var av = createdTsFromRow(a.parent), bv = createdTsFromRow(b.parent);
    return asc ? (av - bv) : (bv - av);
  });
}
function reindexGroups(groups){
  var i = 0;
  groups.forEach(function(g){ g.parent.dataset.idx = String(++i); });
}


  function correoFromParent(tr){
    var c = tr.getAttribute('data-correo') || '';
    if (!c){
      var el = tr.querySelector('.correo-cell,[data-correo-cell]');
      c = el ? el.textContent : ((tr.children[1] && tr.children[1].textContent) || '');
    }
    return norm(c);
  }
  function waFromParent(tr){
    var a = tr.querySelector('.wa-link');
    return digits(a && a.href ? a.href : (tr.getAttribute('data-whatsapp') || tr.textContent || ''));
  }
  function childText(tr){ return norm(tr.textContent); }

  function hideGroup(g, hide){
    var v = hide ? 'none' : '';
    [g.parent].concat(g.children).forEach(function(tr){
      // intenta con clase
      tr.classList.toggle('d-none', !!hide);
      // si .d-none está pisado, forzamos display
      tr.style.setProperty('display', v, hide ? 'important' : '');
    });
  }

  function apply(){
    var q = norm(input.value);
    var qNum = digits(q);
    // mostrar todo
    groups.forEach(function(g){ hideGroup(g,false); });
    if (!q && !(qNum && qNum.length>=3)) return;

    groups.forEach(function(g){
      var hide = true;
      // padre: correo o whatsapp
      if (q && correoFromParent(g.parent).indexOf(q) !== -1) hide = false;
      if (hide && qNum && qNum.length>=3 && waFromParent(g.parent).indexOf(qNum) !== -1) hide = false;
      // hijos: texto
      if (hide && q){
        for (var i=0;i<g.children.length;i++){
          if (childText(g.children[i]).indexOf(q) !== -1){ hide = false; break; }
        }
      }
      hideGroup(g, hide);
    });
  }

  // listeners
  input.addEventListener('input', apply);
  // si hay selects pc-main / pc-plan en tu wrapper, engancha rápido:
  var selMain = pane.querySelector('.__pcFilter__[data-scope="perfiles"] .pc-main');
  var selPlan = pane.querySelector('.__pcFilter__[data-scope="perfiles"] .pc-plan');

  function planKey(txt){
    var s = norm(txt);
    if (s.indexOf('premium')!==-1) return 'premium';
    if (s.indexOf('estándar')!==-1||s.indexOf('estandar')!==-1||s.indexOf('standard')!==-1) return 'estandar';
    if (s.indexOf('básico')!==-1||s.indexOf('basico')!==-1||s.indexOf('individual')!==-1) return 'basico';
    return s||'';
  }
  function planFromParent(tr){
    // en tu HTML, la celda 0 (Plan) tiene <td class="plan-cell-perfil" data-plan="...">
    var td = tr.querySelector('.plan-cell-perfil,[data-plan]');
    var v = td ? (td.getAttribute('data-plan') || td.textContent) : (tr.getAttribute('data-plan') || '');
    return planKey(v);
  }
  function estadoFromParent(tr){
    var e = norm(tr.getAttribute('data-estado')||'');
    if (e) return e;
    // busca texto "pendiente/activo/pausado" en celdas
    var xs = tr.querySelectorAll('td, .badge');
    for (var i=0;i<xs.length;i++){
      var t = norm(xs[i].textContent);
      if (t==='pendiente'||t==='activo'||t==='pausado'||t==='libre'||t==='ocupado'||t==='moroso') return t;
    }
    return '';
  }
  function togglePlan(){
    if (!selMain||!selPlan) return;
    if (selMain.value==='plan') selPlan.style.display='';
    else { selPlan.value=''; selPlan.style.display='none'; }
  }
  function applyMain(){
    if (!selMain) return apply();
    var vMain = selMain.value;
    var vPlan = selPlan ? selPlan.value : '';
    // reset visibles
    groups.forEach(function(g){ hideGroup(g,false); });
    // aplicar
    groups.forEach(function(g){
      var hide=false;
      switch(vMain){
        case 'color_rojo':
        case 'color_azul':
        case 'color_verde': {
          var want = vMain.split('_')[1];
          var c = (g.parent.getAttribute('data-color')||'').toLowerCase();
          hide = (c!==want);
          break;
        }
        case 'pendientes': {
          hide = (estadoFromParent(g.parent) !== 'pendiente');
          break;
        }
        case 'plan': {
          if (vPlan) hide = (planFromParent(g.parent) !== vPlan);
          break;
        }
      }
      if (hide) hideGroup(g,true);
    });
  }
  selMain && selMain.addEventListener('change', function(){ togglePlan(); applyMain(); });
  selPlan && selPlan.addEventListener('change', applyMain);
  togglePlan();

  // primera corrida
  applyMain(); // aplica select si hay
  apply();     // luego palabra

  // sanity CSS
  var tr0 = tbody.rows[0];
  if (tr0){
    tr0.classList.add('d-none');
    var disp = getComputedStyle(tr0).display;
    tr0.classList.remove('d-none');
    if (disp !== 'none'){
      console.warn('[PF] .d-none está siendo pisado por CSS; forzamos display:none!important en runtime.');
    }
  }
})();













// === Auto-orden por fecha de inserción (desc) sin tocar bindPerfiles ===
(function(){
  'use strict';
  var pane  = document.getElementById('perfiles');
  if (!pane) return;
  var table = pane.querySelector('#perfilesTable') || pane.querySelector('table');
  if (!table) return;
  var tbody = table.tBodies && table.tBodies[0];
  if (!tbody) return;

  // Reusa helpers si existen; si no, define locales
  var buildGroups = window.buildGroups || function(tbody){
    var groups=[], curr=null;
    Array.from(tbody.querySelectorAll('tr')).forEach(function(tr){
      var isParent = tr.classList.contains('js-parent-row') || tr.getAttribute('data-parent') === '1';
      if (isParent || !curr){ curr = { parent: tr, children: [] }; groups.push(curr); }
      else { curr.children.push(tr); }
    });
    return groups;
  };
  var reappendGroups = window.reappendGroups || function(tbody, groups){
    groups.forEach(function(g){
      tbody.appendChild(g.parent);
      g.children.forEach(function(ch){ tbody.appendChild(ch); });
    });
  };

  function createdTsFromRow(tr){
    var v = tr.getAttribute('data-created-ts');
    var n = v ? parseInt(v,10) : NaN;
    return isNaN(n) ? 0 : n;
  }
  function sortGroupsByCreated(groups, dir){
    var asc = (dir === 'asc');
    groups.sort(function(a,b){
      var av = createdTsFromRow(a.parent), bv = createdTsFromRow(b.parent);
      return asc ? (av - bv) : (bv - av);
    });
  }
  function reindexGroups(groups){
    var i = 0;
    groups.forEach(function(g){ g.parent.dataset.idx = String(++i); });
  }

  // Solo una vez por carga
  if (window.__pfCreatedOrderApplied) return;
  window.__pfCreatedOrderApplied = true;

  var groups = buildGroups(tbody);
  if (!groups.length) return;

  // Ordena por creación DESC (nuevos primero), reanexa y fija ese orden como base
  sortGroupsByCreated(groups, 'desc');
  reappendGroups(tbody, groups);
  reindexGroups(groups);
})();

