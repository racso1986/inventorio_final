

(function(){
  'use strict';
  if (window.__famModalFixUnified) return; window.__famModalFixUnified = true;

  var modal = document.getElementById('perfilFamiliarModal');
  if (!modal) return;

  function q(sel, ctx){ return (ctx||document).querySelector(sel); }
  function isNum(v){ return v!=null && String(v).trim()!=='' && !isNaN(parseFloat(String(v).replace(',','.'))); }
  function to2(v){ var n=parseFloat(String(v).replace(',','.')); return Number.isFinite(n)? n.toFixed(2):''; }
  function setRO(input, on){ if(!input) return; input.readOnly=!!on; input.classList.toggle('bg-light', !!on); }

  // Decide si el trigger fue una fila padre (modo hijo) o un botón (modo padre)
  function isChildTrigger(t){
    return !!(t && t.matches && t.matches('tr.js-parent-row[data-entidad="perfil_fam"][data-modal-context="child"]'));
  }
  function isParentTrigger(t){
    return !!(t && t.matches && t.matches('.btn-add-perfil-fam, [data-modal-context="parent"]'));
  }

  modal.addEventListener('show.bs.modal', function(ev){
    // Aseguramos que sea cerrable por backdrop/ESC
    try { bootstrap.Modal.getOrCreateInstance(modal, { backdrop: true, keyboard: true }); } catch(_){}

    var t    = ev.relatedTarget || null;
    var form = q('form', modal); if (!form) return;

    var correoEl = q('input[name="correo"]', form);
    var passEl   = q('input[name="password_plain"]', form);
    var priceEl  = q('input[name="soles"]', form);
    var sidEl    = q('input[name="streaming_id"]', form);
    var titleEl  = document.getElementById('perfilFamiliarModalLabel');

    // Limpieza mínima
    if (priceEl){ priceEl.removeAttribute('data-locked'); priceEl.dataset.locked=''; }

    if (isChildTrigger(t)) {
      // === MODO HIJO === (abriste desde la FILA padre)
      var tr     = t;
      var correo = tr.getAttribute('data-correo') || '';
      var pass   = tr.getAttribute('data-password') || '';
      var sid    = tr.getAttribute('data-streaming_id') || '';
      var anchor = tr.getAttribute('data-first-child-price') || '';

      if (titleEl) titleEl.textContent = 'Agregar a correo: ' + correo;

      if (correoEl){ correoEl.value = correo; setRO(correoEl, false); }
      if (passEl)  { passEl.value   = pass || passEl.value || ''; setRO(passEl, true); } // contraseña readonly heredada
      if (sidEl)   { sidEl.value    = sid; }

      // Precio: si hay ancla (primer hijo ya fijado) -> readonly; si no, BLANCO+editable
      if (priceEl){
        if (isNum(anchor)) {
          priceEl.value = to2(anchor);
          setRO(priceEl, true);
          priceEl.dataset.locked = '1';
        } else {
          priceEl.value = '';
          setRO(priceEl, false);
          priceEl.dataset.locked = '';
        }
      }

      // Defaults útiles en hijo
      var selE = q('select[name="estado"]', form); if (selE) selE.value = 'pendiente';
      var selD = q('select[name="dispositivo"]', form); if (selD) selD.value = 'tv';
      var selC = q('select[name="combo"]', form); if (selC) selC.value = tr.getAttribute('data-combo')==='1' ? '1':'0';

      // Fechas
      var today=new Date(), fin=new Date(today.getTime()+31*86400000);
      var iso=(d)=>d.toISOString().slice(0,10);
      var fi=q('input[name="fecha_inicio"]',form), ff=q('input[name="fecha_fin"]',form);
      if (fi) fi.value = iso(today); if (ff) ff.value = iso(fin);

      return; // no entrar a modo padre
    }

    if (isParentTrigger(t)) {
      // === MODO PADRE === (botón Agregar familiar)
      if (titleEl) titleEl.textContent = 'Agregar Perfil (familiar)';

      // Limpiar/asegurar editables
      if (correoEl){ correoEl.value=''; setRO(correoEl, false); }
      if (passEl)  { passEl.value='';   setRO(passEl,   false); }
      if (priceEl) {
        // Sugerencia desde el header si existe
        var head = document.getElementById('precioFamiliarHead');
        priceEl.value = head && head.value ? head.value : '';
        setRO(priceEl, false);
        priceEl.dataset.locked='';
      }

      // Defaults en padre
      var selE = q('select[name="estado"]', form); if (selE) selE.value = 'activo';
      var selD = q('select[name="dispositivo"]', form); if (selD) selD.value = 'tv';
      var selC = q('select[name="combo"]', form); if (selC) selC.value = '0';

      var today=new Date(), fin=new Date(today.getTime()+31*86400000);
      var iso=(d)=>d.toISOString().slice(0,10);
      var fi=q('input[name="fecha_inicio"]',form), ff=q('input[name="fecha_fin"]',form);
      if (fi) fi.value = iso(today); if (ff) ff.value = iso(fin);

      return;
    }

    // Fallback: si no viene relatedTarget claro, no forzamos nada
  });

  // Si algún script externo vacía el precio justo al terminar de abrir, re-afirmamos si estaba “locked”
  modal.addEventListener('shown.bs.modal', function(){
    var price = q('input[name="soles"]', modal);
    if (price && price.dataset.locked==='1' && !price.value){
      // restablece el defaultValue si existe
      if (price.defaultValue) { price.value = price.defaultValue; setRO(price,true); }
    }
  });

  // Limpieza al cerrar
  modal.addEventListener('hidden.bs.modal', function(){
    var price = q('input[name="soles"]', modal);
    if (price){ price.dataset.locked=''; }
  });
})();

