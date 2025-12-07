
/*
  app_fixed_sp_minimodals_v7.js
  Carga este archivo DESPUÉS de tu app principal (v5 recomendado).
  - Rehabilita los modals PEQUEÑOS para Stock y Pausa (solo correo/contraseña).
  - Evita que se dispare el modal grande (#stockModal / #pausaModal).
  - No toca Perfiles.
*/
(function () {
  "use strict";
  if (window.__spMiniBound) return;
  window.__spMiniBound = true;

  function openModalById(id) {
    var el = document.getElementById(id);
    if (!el || !window.bootstrap) return null;
    var m = bootstrap.Modal.getOrCreateInstance(el);
    m.show();
    return el;
  }

  // ---------- ADD: STOCK ----------
  document.addEventListener(
    "click",
    function (e) {
      var btn = e.target.closest("#btn-add-stock");
      if (!btn) return;
      // Capturamos antes que Bootstrap Data-API
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      var el = openModalById("modalAgregarStock");
      if (!el) return;
      var f = el.querySelector("form");
      if (!f) return;
      f.reset();
      var set = function (n, v) {
        var inp = f.querySelector('[name="' + n + '"]');
        if (inp != null) inp.value = v == null ? "" : v;
      };
      set("action", "create");
      set("id", "");
      // NO tocamos streaming_id (ya viene en hidden)
      setTimeout(function () {
        var foco = f.querySelector('input[name="correo"]');
        if (foco) foco.focus();
      }, 0);
    },
    true
  );

  // ---------- EDIT: STOCK ----------
  document.addEventListener(
    "click",
    function (e) {
      var btn = e.target.closest(".btn-edit-stock");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      var data = {};
      try {
        data = JSON.parse(btn.getAttribute("data-row") || "{}");
      } catch (_) {}

      var el = openModalById("modalEditarStock");
      if (!el) return;
      var f = el.querySelector("form");
      if (!f) return;
      f.reset();

      var set = function (n, v) {
        var inp = f.querySelector('[name="' + n + '"]');
        if (inp != null) inp.value = v == null ? "" : v;
      };

      set("action", "update");
      set("id", data.id);
      if (data.streaming_id != null && data.streaming_id !== "")
        set("streaming_id", data.streaming_id);
      set("correo", data.correo);
      set("password_plain", data.password_plain);

      setTimeout(function () {
        var foco = f.querySelector('input[name="correo"]');
        if (foco) foco.focus();
      }, 0);
    },
    true
  );

  // ---------- ADD: PAUSA ----------
  document.addEventListener(
    "click",
    function (e) {
      var btn = e.target.closest("#btn-add-pausa");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      var el = openModalById("modalAgregarPausa");
      if (!el) return;
      var f = el.querySelector("form");
      if (!f) return;
      f.reset();

      var set = function (n, v) {
        var inp = f.querySelector('[name="' + n + '"]');
        if (inp != null) inp.value = v == null ? "" : v;
      };
      set("action", "create");
      set("id", "");

      setTimeout(function () {
        var foco = f.querySelector('input[name="correo"]');
        if (foco) foco.focus();
      }, 0);
    },
    true
  );

  // ---------- EDIT: PAUSA ----------
  document.addEventListener(
    "click",
    function (e) {
      var btn = e.target.closest(".btn-edit-pausa");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      var data = {};
      try {
        data = JSON.parse(btn.getAttribute("data-row") || "{}");
      } catch (_) {}

      var el = openModalById("modalEditarPausa");
      if (!el) return;
      var f = el.querySelector("form");
      if (!f) return;
      f.reset();

      var set = function (n, v) {
        var inp = f.querySelector('[name="' + n + '"]');
        if (inp != null) inp.value = v == null ? "" : v;
      };

      set("action", "update");
      set("id", data.id);
      if (data.streaming_id != null && data.streaming_id !== "")
        set("streaming_id", data.streaming_id);
      set("correo", data.correo);
      set("password_plain", data.password_plain);

      setTimeout(function () {
        var foco = f.querySelector('input[name="correo"]');
        if (foco) foco.focus();
      }, 0);
    },
    true
  );

  // ---------- Anti modal de fila / data-no-row-modal ----------
  document.addEventListener(
    "click",
    function (e) {
      var inSP = e.target.closest("#stock, #pausa");
      if (!inSP) return;
      var tr = e.target.closest("tr");
      if (tr) tr.setAttribute("data-no-row-modal", "1");
    },
    true
  );
})();
