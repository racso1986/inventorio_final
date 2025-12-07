/* cuentas_override.js — CUENTAS con anti-redirect + anti-doble-submit + reload seguro */
(function () {
  const TAG = 'CUENTAS_OVERRIDE';
  let __reloaded = false;

  function forceReload() {
    if (__reloaded) return;
    __reloaded = true;
    try {
      const activeTab = document.querySelector('.nav-tabs .nav-link.active');
      const activeTarget = activeTab ? activeTab.getAttribute('data-bs-target') : '';
      if (activeTarget) sessionStorage.setItem('activeTab', activeTarget);
    } catch (_) {}
    window.location.reload();
  }

  function fdToParams(fd) {
    const p = new URLSearchParams();
    for (const [k, v] of fd.entries()) p.append(k, v == null ? '' : String(v));
    return p;
  }

  function xhrPost(url, params, cb) {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
      xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
      xhr.setRequestHeader('Accept', 'application/json, text/plain, */*');
      xhr.setRequestHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          const ct = (xhr.getResponseHeader('content-type') || '').toLowerCase();
          const txt = xhr.responseText || '';
          let data = null, err = null, nonJson = false;

          if (!ct.includes('application/json') || /^\s*</.test(txt)) {
            nonJson = true;
          }
          if (!nonJson) {
            try { data = JSON.parse(txt); } catch (e) { err = e; nonJson = true; }
          }
          cb(err, data, xhr, nonJson, txt);
        }
      };
      xhr.send(params.toString());
    } catch (e) { cb(e); }
  }

  // Submit CUENTAS
  window.submitCuenta = function submitCuenta(ev) {
    try {
      if (ev) { ev.preventDefault(); ev.stopImmediatePropagation(); }

      const modal = document.getElementById('modalCambiarPlanCuenta');
      const form  = modal ? modal.querySelector('#formCambiarPlanCuenta') : null;
      if (!modal || !form) return false;

      if (form.dataset.submitting === '1') return false;
      form.dataset.submitting = '1';

      const btn = form.querySelector('#btnGuardarPlanCuenta');
      if (btn) { btn.disabled = true; btn.setAttribute('aria-disabled','true'); }

      // Campos
      const idEl     = form.querySelector('#cuentaPlanId');
      const planEl   = form.querySelector('#cuentaPlanSelect');
      const enviarEl = form.querySelector('#cuentaEnviarASelect');
      const colorEl  = form.querySelector('select[name="color"]');

      const idVal = (idEl && idEl.value ? idEl.value : '').replace(/\D+/g,'');
      if (!idVal) {
        form.dataset.submitting = '0';
        if (btn) { btn.disabled = false; btn.removeAttribute('aria-disabled'); }
        if (window.Swal) Swal.fire({icon:'error', title:'ID inválido'});
        return false;
      }

      const fd = new FormData(form);
      fd.set('id', idVal);
      fd.set('cuenta_id', idVal);
      fd.set('plan', (planEl && planEl.value) ? planEl.value : (fd.get('plan') || ''));
      fd.set('enviar_a', (enviarEl && enviarEl.value) ? enviarEl.value : (fd.get('enviar_a') || 'none'));
      fd.set('color', colorEl ? (colorEl.value || '') : (fd.get('color') || ''));

      try { console.log(`[${TAG}] payload`, Object.fromEntries(fd.entries())); } catch (_) {}

      const params = fdToParams(fd);
      const url = new URL(form.action || 'ajax/cuenta_plan_update.php', document.baseURI).href
                    .replace('cuentas_plan_update.php','cuenta_plan_update.php');

      xhrPost(url, params, function (err, data, xhr, nonJson, raw) {
        form.dataset.submitting = '0';
        if (btn) { btn.disabled = false; btn.removeAttribute('aria-disabled'); }

        // Si no-JSON (redirect/login/template), mostrar y recargar
        if (nonJson) {
          const peek = (raw || '').slice(0, 300);
          if (window.Swal) {
            Swal.fire({
              icon:'error',
              title:'Respuesta no válida',
              text:'Parece que la sesión expiró o hubo una redirección. Se recargará la página.'
            }).then(forceReload);
            setTimeout(forceReload, 1200);
          } else {
            forceReload();
          }
          return;
        }

        if (err) {
          if (window.Swal) Swal.fire({icon:'error', title:'Error', text:String(err && err.message || err)});
          return;
        }
        if (!data || data.ok !== true) {
          const msg = (data && data.error) ? data.error : `HTTP ${xhr && xhr.status}`;
          if (window.Swal) Swal.fire({icon:'error', title:'No se pudo guardar', text:msg});
          return;
        }

        // Pintado mínimo en UI (opcional, habrá reload)
        const id = idVal;
        const td = document.querySelector(`td.plan-cell-cuenta[data-id="${id}"], td.plan-cell-cuenta[data-cu-id="${id}"]`);
        if (td) {
          const planTxt = String(fd.get('plan') || '').trim();
          if (planTxt) {
            td.textContent = planTxt;
            td.setAttribute('data-plan', planTxt);
            td.setAttribute('data-current-plan', planTxt);
          }
          const tr = td.closest('tr');
          if (tr) {
            const hasRespColor = Object.prototype.hasOwnProperty.call(data, 'color');
            const chosen = String(fd.get('color') || '').trim();
            const newColor = hasRespColor ? (data.color === null ? '' : (data.color || '')) : chosen;
            tr.classList.remove('row-color-rojo','row-color-azul','row-color-verde','row-color-blanco');
            tr.removeAttribute('data-color');
            if (['rojo','azul','verde','blanco'].includes(newColor)) {
              tr.classList.add('row-color-' + newColor);
              tr.setAttribute('data-color', newColor);
            }
          }
        }

        // Reload seguro
        if (window.Swal) {
          Swal.fire({icon:'success', title:'Plan actualizado', timer:900, showConfirmButton:false})
            .then(forceReload);
          setTimeout(forceReload, 1200);
        } else {
          forceReload();
        }
      });

      return false;
    } catch (e) {
      if (window.Swal) Swal.fire({icon:'error', title:'Error', text:String(e.message || e)});
      return false;
    }
  };

  // Hook modal: limpiar handlers legacy + bloquear Enter submit nativo
  document.addEventListener('shown.bs.modal', function (ev) {
    const modal = ev.target;
    if (!modal || modal.id !== 'modalCambiarPlanCuenta') return;

    const form = modal.querySelector('#formCambiarPlanCuenta');
    if (form && !form.dataset._boundCuenta) {
      form.dataset._boundCuenta = '1';

      form.addEventListener('submit', function (e) {
        e.preventDefault(); e.stopImmediatePropagation();
        window.submitCuenta(e);
      }, { capture:true });

      form.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); window.submitCuenta(e); }
      }, { capture:true });

      const btn = modal.querySelector('#btnGuardarPlanCuenta');
      if (btn) {
        const clone = btn.cloneNode(true);
        clone.type = 'button';
        btn.parentNode.replaceChild(clone, btn);
        clone.addEventListener('click', function (e) {
          e.preventDefault(); e.stopImmediatePropagation();
          window.submitCuenta(e);
        }, { capture:true });
      }
    }
  });
})();
