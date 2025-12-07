/* ajax_guard.js — Previene submits/clicks nativos que generan HTML/doctype en SweetAlert */
(function () {
  // 1) Detectores
  const RX_PLAN = /\/ajax\/[a-z_]*_plan_update\.php(?:$|\?)/i;
  function isAjaxPlanUrl(href) {
    try { const u = new URL(href, document.baseURI); return RX_PLAN.test(u.pathname + (u.search || '')); }
    catch (_) { return false; }
  }
  function isAjaxPlanForm(form) {
    if (!form || !form.action) return false;
    return isAjaxPlanUrl(form.action);
  }
  function getOpenModal() { return document.querySelector('.modal.show'); }

  // 2) SUBMIT nativo → bloquear si es ajax/*_plan_update.php
  document.addEventListener('submit', function (e) {
    const form = e.target;
    if (!(form instanceof HTMLFormElement)) return;

    // Guard 2.1: bloquear cualquier submit a endpoints ajax plan_update
    if (isAjaxPlanForm(form)) {
      e.preventDefault(); e.stopImmediatePropagation();
      return;
    }

    // Guard 2.2: si hay un modal abierto, bloquear submits de forms fuera del modal (ej. js-delete-form)
    const modal = getOpenModal();
    if (modal && !modal.contains(form)) {
      e.preventDefault(); e.stopImmediatePropagation();
      return;
    }
  }, { capture: true });

  // 3) Click en botones submit o inputs submit (incluye botones con form="…")
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('button[type="submit"], input[type="submit"]');
    if (!btn) return;

    // Resolver form por atributo HTML5 "form" o por jerarquía DOM
    let form = null;
    if (btn.hasAttribute('form')) {
      const fid = btn.getAttribute('form');
      if (fid) form = document.getElementById(fid);
    }
    if (!form) form = btn.form || btn.closest('form');

    if (isAjaxPlanForm(form)) {
      e.preventDefault(); e.stopImmediatePropagation();
      return;
    }

    const modal = getOpenModal();
    if (modal && form && !modal.contains(form)) {
      e.preventDefault(); e.stopImmediatePropagation();
      return;
    }
  }, { capture: true });

  // 4) Anchors que apuntan a ajax/*_plan_update.php
  document.addEventListener('click', function (e) {
    const a = e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (href && isAjaxPlanUrl(href)) {
      e.preventDefault(); e.stopImmediatePropagation();
    }
  }, { capture: true });

  // 5) ENTER dentro de forms → bloquear si es ajax plan_update o si el form está fuera del modal abierto
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    const form = e.target && e.target.closest ? e.target.closest('form') : null;

    if (isAjaxPlanForm(form)) {
      e.preventDefault(); e.stopImmediatePropagation();
      return;
    }

    const modal = getOpenModal();
    if (modal && form && !modal.contains(form)) {
      e.preventDefault(); e.stopImmediatePropagation();
      return;
    }
  }, { capture: true });
})();
