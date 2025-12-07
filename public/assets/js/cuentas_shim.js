/* cuentas_shim.js — intercepta fetch hacia cuenta(s)_plan_update.php y asegura payload correcto */
(function () {
  if (window.__cuentasShimInstalled) return;
  window.__cuentasShimInstalled = true;

  const LOG = function(){ try{ console.log('[CUENTAS_SHIM]', ...arguments); }catch(_){} };
  const ERR = function(){ try{ console.error('[CUENTAS_SHIM]', ...arguments); }catch(_){} };

  const origFetch = window.fetch;
  window.fetch = async function(input, init) {
    try {
      // Normaliza a string URL
      let url = (typeof input === 'string') ? input
              : (input && input.url) ? input.url
              : String(input || '');

      // Sólo interceptar cuenta_plan_update.php (singular o plural)
      const hit = /\/ajax\/cuentas?_plan_update\.php(?:\?|$)/.test(url);
      if (!hit) {
        return origFetch.apply(this, arguments);
      }

      // Siempre usar el endpoint singular
      url = url.replace('cuentas_plan_update.php', 'cuenta_plan_update.php');

      // Asegurar objetos iniciales
      init = init || {};
      const headers = new Headers(init.headers || {});
      const ct = (headers.get('Content-Type') || '').toLowerCase();

      // Convertir body actual a URLSearchParams (para poder mutarlo)
      let usp = new URLSearchParams();
      if (init.body instanceof URLSearchParams) {
        usp = new URLSearchParams(init.body.toString());
      } else if (init.body instanceof FormData) {
        init.body.forEach((v, k) => usp.append(k, v));
      } else if (typeof init.body === 'string') {
        usp = new URLSearchParams(init.body);
      } else if (input instanceof Request) {
        // Si vino como Request, intentar leer su body sólo si es urlencoded
        const req = input;
        const rct = (req.headers && req.headers.get && (req.headers.get('Content-Type')||'').toLowerCase()) || '';
        if (rct.includes('application/x-www-form-urlencoded') && req.text) {
          try {
            const txt = await req.text();
            usp = new URLSearchParams(txt || '');
          } catch(e) { /* noop */ }
        }
      }

      // Tomar valores REALES del modal chico de Cuentas (scoped)
      const modal = document.getElementById('modalCambiarPlanCuenta');
      const form  = modal ? modal.querySelector('#formCambiarPlanCuenta') : null;

      const idInput   = form ? form.querySelector('#cuentaPlanId') : null;
      const planSel   = form ? form.querySelector('#cuentaPlanSelect') : null;
      const enviarSel = form ? form.querySelector('#cuentaEnviarASelect') : null;
      // MUY IMPORTANTE: color sólo dentro del modal, no por id global
      const colorSel  = form ? form.querySelector('select[name="color"]') : null;

      const idVal = idInput ? (idInput.value || '').replace(/\D+/g,'') : '';
      const plan  = planSel ? (planSel.value || '') : (usp.get('plan') || '');
      const enviar = enviarSel ? (enviarSel.value || 'none') : (usp.get('enviar_a') || 'none');
      const color = colorSel ? (colorSel.value || '') : (usp.get('color') || '');

      // Inyectar/normalizar parámetros mínimos
      if (!usp.has('id') && idVal) { usp.set('id', idVal); }
      if (!usp.has('cuenta_id') && idVal) { usp.set('cuenta_id', idVal); } // tolerante con back
      if (!usp.has('plan') && plan) { usp.set('plan', plan); }
      if (!usp.has('enviar_a')) { usp.set('enviar_a', enviar || 'none'); }
      // Forzar presencia de color (aunque sea vacío) para que aparezca en Payload
      if (!usp.has('color')) { usp.set('color', color); }

      // Traza visible
      LOG('intercept →', url, {
        id: usp.get('id'), cuenta_id: usp.get('cuenta_id'),
        plan: usp.get('plan'), enviar_a: usp.get('enviar_a'), color: usp.get('color')
      });

      // Re-armar init como POST urlencoded same-origin
      headers.set('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
      init.method = 'POST';
      init.headers = headers;
      init.credentials = init.credentials || 'same-origin';
      init.redirect = init.redirect || 'follow';
      init.cache = 'no-store';
      init.body = usp.toString();

      return origFetch.call(this, url, init);
    } catch (e) {
      ERR('shim error', e);
      return origFetch.apply(this, arguments);
    }
  };
})();
