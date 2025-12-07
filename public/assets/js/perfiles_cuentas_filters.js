// /* public/assets/js/perfiles-precio-hijos.js */
// /* SOLO el modal de AGREGAR PERFIL. El PRIMER HIJO fija el precio; siguientes hijos readonly.
//   El PADRE SIEMPRE editable e independiente. */
// (function () {
//   'use strict';

//   const SS_KEY = '__anchorPricesByCorreo';
//   const PARENT_SENTINELS = new Set(['', '-', '—', 'padre', 'parent']);

//   // --- utils ---
//   const norm = s => (s || '').trim().toLowerCase();
//   const money2 = v => {
//     const n = parseFloat(String(v).replace(/[^\d.,-]/g, '').replace(',', '.'));
//     return isFinite(n) ? n.toFixed(2) : '0.00';
//   };
//   const text = (root, sel) => {
//     const el = root.querySelector(sel);
//     return (el ? el.textContent : '').trim();
//   };

//   function rowData(tr) {
//     const correo = norm(tr.dataset.correo || text(tr, '[data-col="correo"]'));
//     const perfilRaw = (tr.dataset.perfil || text(tr, '[data-col="perfil"]') || '').trim();
//     const perfil = perfilRaw; // NO tocar: usaremos sentinels para detectar padre
//     const soles  = money2(tr.dataset.soles || text(tr, '[data-col="soles"]'));
//     const idTxt  = tr.dataset.id || text(tr, '[data-col="id"]');
//     const id     = parseInt(idTxt, 10) || 0;
//     return { correo, perfil, soles, id };
//   }
//   const isParentRow = r => PARENT_SENTINELS.has(norm(r.perfil));

//   function findAnchorInTable(correo) {
//     const rows = Array.from(document.querySelectorAll('tr'));
//     const kids = [];
//     for (const tr of rows) {
//       if (!tr.querySelector('[data-col="correo"]') && !tr.dataset.correo) continue;
//       const r = rowData(tr);
//       if (r.correo !== norm(correo)) continue;
//       if (isParentRow(r)) continue; // EXCLUIR PADRE
//       kids.push(r);
//     }
//     if (!kids.length) return null;
//     kids.sort((a,b)=>a.id-b.id);
//     return kids[0].soles || '0.00';
//   }

//   function getMap() {
//     try { return JSON.parse(sessionStorage.getItem(SS_KEY) || '{}'); } catch { return {}; }
//   }
//   function getAnchor(correo) {
//     return getMap()[norm(correo)] || null;
//   }
//   function setAnchor(correo, soles) {
//     const m = getMap();
//     m[norm(correo)] = money2(soles);
//     sessionStorage.setItem(SS_KEY, JSON.stringify(m));
//   }

//   function isCreateModal(modal) {
//     const form = modal.querySelector('form');
//     const act  = form?.querySelector('[name="action"]')?.value || '';
//     return norm(act) === 'create';
//   }
  
//   // [public/assets/js/perfiles_cuentas_filters.js]
// // Saber si el modal está en modo hijo o padre usando el flag de app.js
// function isChildModal(modal){
//   return (modal && modal.dataset && modal.dataset.openMode === 'child');
// }


//   function applyToCreateModal(modal) {
//     if (!isCreateModal(modal)) return; // NO tocar otros modales (p.ej. del padre)

//     const precio   = modal.querySelector('#modalperfilprecio') || modal.querySelector('input[name="soles"]');
//     const correoIn = modal.querySelector('input[name="correo"]');
//     const perfilIn = modal.querySelector('input[name="perfil"]');
//     const head     = document.querySelector('#precioPerfilHead');
//     const form     = modal.querySelector('form');
//     if (!precio || !correoIn || !perfilIn) return;
    
//     // Respetar escritura manual del usuario
// precio.addEventListener('input', function () {
//   try { precio.dataset.userTyped = '1'; } catch(_) {}
// }, true);


//     // Prefill desde header 1 sola vez, sin bloquear
//     // Prefill desde header: SOLO cuando NO es hijo
// // (hijo = tiene algo en input[name="perfil"])






//     precio.value = money2(precio.value || '0.00');
//     // HIJO: NUNCA imponer anchor ni ningún default automático
// precio.readOnly = false;
// precio.removeAttribute('readonly');
// return;


//     function refresh() {
//   const correo  = norm(correoIn.value);
//   const isChild = !!(perfilIn.value || '').trim();

//   // Siempre editable
//   precio.readOnly = false;
//   precio.removeAttribute('readonly');

//   if (!correo) return;

//   const anchor = getAnchor(correo) || findAnchorInTable(correo);

//   if (isChild) {
//     // HIJO: NUNCA imponer anchor ni ningún default automático
// // Siempre editable; si está vacío, se queda vacío hasta que el usuario escriba.
// precio.readOnly = false;
// precio.removeAttribute('readonly');
// return;

//     // Siempre editable para hijos
//     precio.readOnly = false;
//     precio.removeAttribute('readonly');
//     return;
//   }

//   // PADRE: editable; si está vacío se respeta el default de cabecera (que ya se aplicó arriba)
//   precio.readOnly = false;
//   precio.removeAttribute('readonly');
// }


//     function onSubmitSetAnchor() {
//       const correo  = norm(correoIn.value);
//       const isChild = !!(perfilIn.value || '').trim();
//       if (!isChild || !correo) return;
//       // Sólo si NO existe anchor aún, fijar con el precio actual (PRIMER HIJO)
//       const exists = !!(getAnchor(correo) || findAnchorInTable(correo));
//       if (!exists) setAnchor(correo, precio.value || '0.00');
//     }

//     refresh();
//     ['input','change','keyup'].forEach(evt => {
//       correoIn.addEventListener(evt, refresh);
//       perfilIn.addEventListener(evt, refresh);
//     });

//     if (form) form.addEventListener('submit', onSubmitSetAnchor);
//     const submitBtn = modal.querySelector('button[type="submit"], input[type="submit"]');
//     if (submitBtn) submitBtn.addEventListener('click', onSubmitSetAnchor);

//     // Reforzar al final por si otro script pisa readonly
//     requestAnimationFrame(refresh);
//     setTimeout(refresh, 0);
//   }

//   document.addEventListener('shown.bs.modal', function (ev) {
//     applyToCreateModal(ev.target);
//   });
// })();

















// // Blindaje adicional: si el modal de perfil se abrió como hijo, asegurar que no se reinstale un default tras el shown
// (function ensureChildModalHasNoDefaultPrice(){
//   try {
//     var modal = document.getElementById('perfilModal');
//     if (!modal) return;
//     if (modal.dataset.noChildDefaultHook === '1') return;
//     modal.dataset.noChildDefaultHook = '1';

//     modal.addEventListener('shown.bs.modal', function(ev){
//       try {
//         var btn = ev.relatedTarget;
//         var isAddPerfil = !!(btn && ( (btn.classList && btn.classList.contains('btn-add-perfil')) || (btn.matches && btn.matches('.btn-add-perfil')) ));
//         var idFld  = modal.querySelector('input[name="id"]');
//         var isEdit = !!(idFld && idFld.value && idFld.value !== '');
//         if (isAddPerfil || isEdit) return;

//         var soles = modal.querySelector('input[name="soles"]');
//         if (!soles) return;

//         // Si algún listener tardío colocó "0", "0.00" o similar, lo vaciamos y habilitamos
//         if (soles.value && /^\s*0+(?:[.,]0+)?\s*$/.test(soles.value)) {
//           soles.value = '';
//         }
//         try { soles.readOnly = false; soles.removeAttribute('readonly'); } catch (_) {}
//       } catch(_){}
//     }, true);
//   } catch(_){}
// })();

