
/**
 * perfiles_familiar_filters.js
 * Filtros para la pestaña "Familiar" (scope: data-scope="perfiles-fam").
 * - Respeta separadores de fecha (tr[data-sep="1"]).
 * - Filtra por color (padres), pendientes, búsqueda (correo/whatsapp),
 *   plan (básico/estándar/premium) y ordena por días (asc/desc).
 * - Cuando se ordena por días, se ocultan los separadores de fecha para
 *   evitar que "suban" a la cabecera. Al limpiar, se restaura todo.
 */
(function () {
  'use strict';

  // Scope UI
  const scope = document.querySelector('div.__pcFilter__[data-scope="perfiles-fam"]');
  const table = document.getElementById('perfilesFamiliarTable');
  if (!scope || !table || !table.tBodies || !table.tBodies[0]) return;

  const tbody   = table.tBodies[0];
  const mainSel = scope.querySelector('.pc-main');
  const planSel = scope.querySelector('.pc-plan');
  const searchI = scope.querySelector('.pc-search');
  const clearBt = scope.querySelector('.pc-clear');

  // Helpers
  const toNum = (v) => {
    const n = parseInt(String(v || '').replace(/[^\d\-]/g, ''), 10);
    return isNaN(n) ? 0 : n;
  };
  const norm = (s) => String(s || '').toLowerCase();
  const hasClass = (el, c) => el && el.classList && el.classList.contains(c);

  // == Construir SECUENCIA original (seps + grupos) ==
  const sequence = [];             // [{type:'sep', row}, {type:'group', rows:[...]}]
  const groups   = [];             // objetos de grupo para acceso directo
  const parents  = new Set();      // set de filas padre
  const seps     = [];             // separadores

  (function buildSequence() {
    const rows = Array.from(tbody.rows);
    for (let i = 0; i < rows.length; i++) {
      const tr = rows[i];
      // Separadores de fecha
      if (tr.getAttribute('data-sep') === '1') {
        sequence.push({ type: 'sep', row: tr });
        seps.push(tr);
        continue;
      }
      // Padre
      if (hasClass(tr, 'js-parent-row') && (tr.getAttribute('data-entidad') === 'perfil_fam')) {
        const pack = { type: 'group', parent: tr, rows: [tr], originalIndex: groups.length };
        parents.add(tr);
        // Hijos hasta antes de otro padre o separador
        let j = i + 1;
        for (; j < rows.length; j++) {
          const nx = rows[j];
          if (nx.getAttribute('data-sep') === '1') break;
          if (hasClass(nx, 'js-parent-row') && (nx.getAttribute('data-entidad') === 'perfil_fam')) break;
          pack.rows.push(nx);
        }
        // saltar hijos ya añadidos
        i = j - 1;
        sequence.push(pack);
        groups.push(pack);
        continue;
      }
      // Fila suelta (sin padre detectado) -> trátala como grupo unitario
      sequence.push({ type: 'group', parent: tr, rows: [tr], originalIndex: groups.length });
      groups.push(sequence[sequence.length - 1]);
    }
  })();

  function setGroupVisible(group, vis) {
    group.rows.forEach(tr => { tr.style.display = vis ? '' : 'none'; });
  }

  function showPlanPicker(show) {
    if (!planSel) return;
    if (show) {
      planSel.style.display = '';
    } else {
      planSel.style.display = 'none';
      planSel.value = '';
    }
  }

  function groupMatchesColor(group, colorKey) {
    // Sólo el PADRE pinta el color de la familia
    const tr = group.parent;
    return tr.classList.contains('row-color-' + colorKey);
  }

  function groupMatchesPendiente(group) {
    // Si ALGUNA fila del grupo tiene "pendiente" en la columna de estado
    return group.rows.some(tr => /pendiente/i.test(tr.textContent || ''));
  }

  function groupMatchesPlan(group, planKey) {
    // Tomamos el texto de la celda plan del PADRE
    const tdPlan = group.parent && group.parent.cells && group.parent.cells[0];
    const plan = norm(tdPlan ? tdPlan.textContent : '');
    if (planKey === 'premium')   return plan.includes('premium');
    if (planKey === 'estandar')  return plan.includes('estándar') || plan.includes('estandar') || plan.includes('standard');
    // 'basico' incluye "individual"
    return plan.includes('básico') || plan.includes('basico') || plan.includes('individual');
  }

  function groupMatchesSearch(group, q) {
    if (!q) return true;
    const ql = norm(q);
    // Buscar en correo del padre y en teléfonos (wa) de todas las filas
    //  - correo está en la 2da columna
    const correoTd = group.parent && group.parent.cells && group.parent.cells[1];
    const correoTxt = norm(correoTd ? correoTd.textContent : '');
    if (correoTxt.includes(ql)) return true;
    //  - whatsapp puede estar en la columna con link 'wa.me' o texto "WA"
    return group.rows.some(tr => {
      const waTd = tr.querySelector('td.whatsapp');
      if (!waTd) return false;
      const text = norm(waTd.textContent || '');
      const href  = norm(waTd.querySelector('a')?.getAttribute('href') || '');
      return text.includes(ql) || href.includes(ql);
    });
  }

  function getGroupDias(group) {
    // Usar la columna "Días" del PADRE (6ta columna, index 5)
    const td = group.parent && group.parent.cells && group.parent.cells[5];
    return toNum(td ? td.textContent : 0);
  }

  function hideAllSeps(hide) {
    seps.forEach(tr => { tr.style.display = hide ? 'none' : ''; });
  }

  function rebuildTbodyWithGroups(orderedGroups, withSeps = false) {
    // Vaciar TBODY y rearmar con (opcional) separadores + grupos
    const frag = document.createDocumentFragment();
    if (withSeps) {
      // reconstruye "sequence" original completa
      sequence.forEach(item => {
        if (item.type === 'sep') frag.appendChild(item.row);
        else item.rows.forEach(r => frag.appendChild(r));
      });
    } else {
      // Sólo los grupos en el orden solicitado (sin separadores)
      orderedGroups.forEach(g => g.rows.forEach(r => frag.appendChild(r)));
    }
    tbody.appendChild(frag);
  }

  function restoreOriginalOrder() {
    hideAllSeps(false);
    // reconstruir EXACTAMENTE como al inicio
    const frag = document.createDocumentFragment();
    sequence.forEach(item => {
      if (item.type === 'sep') frag.appendChild(item.row);
      else item.rows.forEach(r => frag.appendChild(r));
    });
    tbody.appendChild(frag);
  }

  function applyFilters() {
    const mode = mainSel ? mainSel.value : '';
    const search = searchI ? searchI.value.trim() : '';

    // Mostrar u ocultar el picker de plan
    showPlanPicker(mode === 'plan');

    // Si el modo es por días => reordenar y ocultar separadores
    if (mode === 'dias_asc' || mode === 'dias_desc') {
      // Primero: todos visibles
      groups.forEach(g => setGroupVisible(g, true));
      // Ordenar por días del padre
      const dir = (mode === 'dias_asc') ? 1 : -1;
      const sorted = groups.slice().sort((a, b) => (getGroupDias(a) - getGroupDias(b)) * dir);
      hideAllSeps(true);
      rebuildTbodyWithGroups(sorted, /*withSeps*/ false);
      // Además, aplicar búsqueda si hay
      if (search) {
        sorted.forEach(g => setGroupVisible(g, groupMatchesSearch(g, search)));
      }
      return;
    }

    // Para cualquier otro modo, restaurar el orden original si se alteró antes
    restoreOriginalOrder();

    // Ocultar/mostrar por modo
    groups.forEach(g => {
      let visible = true;

      if (mode.startsWith('color_')) {
        const key = mode.split('_')[1]; // rojo|azul|verde
        visible = groupMatchesColor(g, key);
      } else if (mode === 'pendientes') {
        visible = groupMatchesPendiente(g);
      } else if (mode === 'plan') {
        const pv = planSel ? planSel.value : '';
        if (pv) visible = groupMatchesPlan(g, pv);
      }

      // Aplicar búsqueda
      if (visible && search) visible = groupMatchesSearch(g, search);

      setGroupVisible(g, visible);
    });
  }

  // Listeners
  mainSel && mainSel.addEventListener('change', applyFilters);
  planSel && planSel.addEventListener('change', applyFilters);

  let t;
  searchI && searchI.addEventListener('input', function () {
    clearTimeout(t);
    t = setTimeout(applyFilters, 120);
  });

  clearBt && clearBt.addEventListener('click', function () {
    if (mainSel) mainSel.value = '';
    if (planSel) planSel.value = '';
    if (searchI) searchI.value = '';
    // Restaurar orden y mostrar todo
    restoreOriginalOrder();
    groups.forEach(g => setGroupVisible(g, true));
    hideAllSeps(false);
    showPlanPicker(false);
  });

  // Inicial
  showPlanPicker(false);
})();
