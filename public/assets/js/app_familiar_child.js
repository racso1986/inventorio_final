(function(){
  'use strict';
  if (window.__famChildModalV1) return; window.__famChildModalV1 = true;

  var modalEl = document.getElementById('perfilFamiliarChildModal');
  if (!modalEl) return;

  function q(sel, ctx){ return (ctx||document).querySelector(sel); }
  function isNum(v){ return v!=null && String(v).trim()!=='' && !isNaN(parseFloat(String(v).replace(',','.'))); }
  function toISO(d){ return d.toISOString().slice(0,10); }
  function setRO(input, on){ if(!input) return; input.readOnly=!!on; input.classList.toggle('bg-light', !!on); }

  // Abre como HIJO cuando el trigger es la fila de familiar
  document.addEventListener('click', function(e){
    var tr = e.target && e.target.closest && e.target.closest('tr.js-parent-row[data-entidad="perfil_fam"][data-modal-context="child"]');
    if (!tr) return;

    // Mostrar el modal hijo
    var bs = bootstrap.Modal.getOrCreateInstance(modalEl, { backdrop: true, keyboard: true });
    bs.show();

    // Prefill al vuelo
    var form   = q('form', modalEl);
    var title  = document.getElementById('perfilFamiliarChildTitle');
    var correo = tr.getAttribute('data-correo') || '';
    var pass   = tr.getAttribute('data-password') || '';
    var sid    = tr.getAttribute('data-streaming_id') || '';
    var combo  = (String(tr.getAttribute('data-combo')) === '1') ? '1':'0';
    var anchor = tr.getAttribute('data-soles') || tr.getAttribute('data-first-child-price') || '';

    if (title) title.textContent = 'agregar a correo: ' + correo;

    // Campos
    var correoEl = q('input[name="correo"]', form);
    var passEl   = q('input[name="password_plain"]', form);
    var priceEl  = q('input[name="soles"]', form);
    var sidEl    = q('input[name="streaming_id"]', form);

    if (correoEl){ correoEl.value = correo; setRO(correoEl, false); }
    if (passEl)  { passEl.value   = pass || ''; setRO(passEl, false); }
    if (sidEl)   { sidEl.value    = sid; }

    // Precio: si la fila ya trae (o ancla) => readonly; si no => blanco + editable (primer hijo)
    if (priceEl){
      if (isNum(anchor)) {
        priceEl.value = String(parseFloat(anchor).toFixed(2));
        setRO(priceEl, true);
      } else {
        priceEl.value = '';
        setRO(priceEl, false);
      }
    }

    // Combos/estado/dispositivo
    var selC = q('select[name="combo"]', form); if (selC) selC.value = combo;
    var selE = q('select[name="estado"]', form); if (selE) selE.value = 'pendiente';
    var selD = q('select[name="dispositivo"]', form); if (selD) selD.value = 'tv';

    // Fechas
    var today = new Date(), fin = new Date(Date.now()+31*86400000);
    var fi = q('input[name="fecha_inicio"]', form), ff = q('input[name="fecha_fin"]', form);
    if (fi) fi.value = toISO(today); if (ff) ff.value = toISO(fin);
  }, true);

  // Limpieza al cerrar (por seguridad)
  modalEl.addEventListener('hidden.bs.modal', function(){
    var f = q('form', modalEl); if (f) f.reset();
  });
})();
