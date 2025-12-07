<script>
document.addEventListener('DOMContentLoaded', function () {
  const modal = document.getElementById('streamingModal');
  if (!modal) return;

  // Helper para obtener el form del modal
  function getForm() {
    return modal.querySelector('#streamingForm') || modal.querySelector('form');
  }

  // 🟢 MODO CREAR: cuando haces clic en "Agregar Streaming"
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('.btn-add-streaming');
    if (!btn) return;

    const form  = getForm();
    const title = modal.querySelector('#streamingModalLabel') || modal.querySelector('.modal-title');
    if (!form) return;

    const actionEl = form.querySelector('input[name="action"]');
    const idEl     = form.querySelector('input[name="id"]');

    if (actionEl) actionEl.value = 'create';
    if (idEl)     idEl.value     = '';

    if (title) title.textContent = 'Agregar Streaming';
  });

  // 🟡 MODO EDITAR: cuando se abre desde un botón .btn-edit-streaming
  modal.addEventListener('show.bs.modal', function (ev) {
    const opener = ev.relatedTarget;
    if (!opener || !opener.classList.contains('btn-edit-streaming')) return;

    const form  = getForm();
    const title = modal.querySelector('#streamingModalLabel') || modal.querySelector('.modal-title');
    if (!form) return;

    // 🔴 Aquí forzamos que sea UPDATE
    const actionEl = form.querySelector('input[name="action"]');
    const idEl     = form.querySelector('input[name="id"]');

    if (actionEl) actionEl.value = 'update';
    if (idEl)     idEl.value     = opener.getAttribute('data-id') || idEl.value || '';

    if (title) title.textContent = 'Editar Streaming';
  });
});
</script>


<?php
// public/dashboard.php
session_start();
if (empty($_SESSION['user_id'])) { header('Location: index.php'); exit; }

require_once __DIR__ . '/../config/db.php';
$pdo = get_pdo();



function row_json_attr(array $row): string {
  $json = json_encode($row, JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT);
  return htmlspecialchars($json, ENT_QUOTES, 'UTF-8');
}

$streamings = $pdo->query("SELECT * FROM streamings ORDER BY created_at DESC, id DESC")
                  ->fetchAll(PDO::FETCH_ASSOC);
                  
$iptvList = $pdo->query("SELECT * FROM iptv_servicios ORDER BY created_at DESC, id DESC")
                ->fetchAll(PDO::FETCH_ASSOC);

include __DIR__ . '/../includes/header.php';
include __DIR__ . '/../includes/navbar.php';
?>

<?php if (!empty($_SESSION['flash_text'])): ?>
  <div id="flash"
       data-type="<?= htmlspecialchars($_SESSION['flash_type'] ?? 'success', ENT_QUOTES, 'UTF-8') ?>"
       data-text="<?= htmlspecialchars($_SESSION['flash_text'], ENT_QUOTES, 'UTF-8') ?>"></div>
  <?php unset($_SESSION['flash_text'], $_SESSION['flash_type']); ?>
<?php endif; ?>


<div class="d-flex align-items-center justify-content-between mb-3 container" style="margin-top: 1rem !important;">
  <!-- LADO IZQUIERDO: título + Agregar + Cobros -->
  <div class="d-flex align-items-center gap-2">
    <h3 class="mb-0">Streamings</h3>

   

    <a href="cobros.php" class="btn btn-sm btn-warning">
      Cobros
    </a>
  </div>

  <!-- LADO DERECHO: IPTV (celeste / primary) -->
  <div>
     <button type="button"
          class="btn btn-sm btn-primary btn-add-iptv"
          data-bs-toggle="modal"
          data-bs-target="#iptvModal">
    Agregar IPTV
  </button>
  </div>
  
 <button type="button"
        class="btn btn-sm btn-success btn-add-streaming"
        data-bs-toggle="modal"
        data-bs-target="#streamingModal">
  Agregar Streaming
</button>










<a href="export_streamings.php" class="btn btn-success btn-sm">
  Exportar Excel (.xlsx)
</a>

  <form action="import_streamings.php" method="post" enctype="multipart/form-data" class="d-inline">
  <div class="input-group input-group-sm">
    <input type="file" name="excel" class="form-control form-control-sm" accept=".xlsx" required>
    <button type="submit" class="btn btn-primary btn-sm">
      Importar Excel
    </button>
  </div>
</form>




</div>


  <?php if (!empty($_SESSION['flash_text'])): ?>
    <div id="flash"
         data-type="<?= htmlspecialchars($_SESSION['flash_type'] ?? 'success') ?>"
         data-text="<?= htmlspecialchars($_SESSION['flash_text']) ?>"></div>
    <?php unset($_SESSION['flash_text'], $_SESSION['flash_type']); ?>
  <?php endif; ?>

 <div class="row g-3 container" style="margin: 0 auto;">
  <?php foreach ($streamings as $s):
  // Datos base del streaming
  $filename = basename((string)($s['logo'] ?? ''));
  $logoRel  = $filename ? 'uploads/' . $filename : '';

  $id       = (int)$s['id'];
  $nombre   = (string)$s['nombre'];
  $plan     = (string)$s['plan'];
  $precio   = (string)$s['precio'];

  // Si en la BD el logo es ruta completa, nos quedamos con el filename
  $logoFilename = $s['logo'] ? basename($s['logo']) : '';
?>
  <div class="col-12 col-sm-6 col-md-4 col-lg-3">
    <div class="card h-100 shadow-sm">
      <div class="ratio ratio-16x9 bg-light">
        <?php if ($logoRel): ?>
          <img
            src="<?= htmlspecialchars($logoRel, ENT_QUOTES, 'UTF-8') ?>"
            class="img-fluid w-100 h-100 p-2"
            style="object-fit:contain"
            alt="logo">
        <?php else: ?>
          <div class="d-flex align-items-center justify-content-center text-muted">
            Sin logo
          </div>
        <?php endif; ?>
      </div>

      <div class="card-body">
        <h5 class="card-title mb-1">
          <?= htmlspecialchars($nombre, ENT_QUOTES, 'UTF-8') ?>
        </h5>
        <p class="card-text mb-2">
          <small class="text-muted">
            <?= htmlspecialchars($plan, ENT_QUOTES, 'UTF-8') ?>
          </small>
        </p>
        <div class="fw-semibold mb-3">
          S/<?= number_format((float)$precio, 2) ?>
        </div>

        <div class="d-flex flex-wrap gap-2">
          <!-- Abrir detalle del STREAMING (no IPTV) -->
          <a class="btn btn-sm btn-outline-primary"
             href="streaming.php?id=<?= $id ?>">
            Abrir
          </a>

          <!-- ✅ Botón correcto para EDITAR STREAMING -->
          <button type="button"
                  class="btn btn-sm btn-primary btn-edit-streaming"
                  data-bs-toggle="modal"
                  data-bs-target="#streamingModal"
                  data-id="<?= $id ?>"
                  data-nombre="<?= htmlspecialchars($nombre, ENT_QUOTES, 'UTF-8') ?>"
                  data-plan="<?= htmlspecialchars($plan, ENT_QUOTES, 'UTF-8') ?>"
                  data-precio="<?= htmlspecialchars($precio, ENT_QUOTES, 'UTF-8') ?>"
                  data-logo="<?= htmlspecialchars($logoFilename, ENT_QUOTES, 'UTF-8') ?>">
            Editar
          </button>

          <!-- Borrar STREAMING -->
          <form action="../app/controllers/StreamingController.php"
                method="post"
                class="d-inline form-delete-streaming">
            <input type="hidden" name="action" value="delete">
            <input type="hidden" name="id" value="<?= $id ?>">
            <button type="submit" class="btn btn-sm btn-outline-danger">
              Borrar
            </button>
          </form>
        </div>
      </div>
    </div>
  </div>
<?php endforeach; ?>


    <?php foreach ($iptvList as $i):
    $filenameIptv = basename((string)($i['logo'] ?? ''));
    $logoRelIptv  = $filenameIptv ? 'uploads/' . $filenameIptv : '';
    $id           = (int)$i['id'];
    $nombre       = (string)$i['nombre'];
    $plan         = (string)$i['plan'];   // "individual", "standard", "premium"
    $precio       = (string)$i['precio'];
    $logoFilename = $filenameIptv;
    $logoPath     = $logoRelIptv;
  ?>
    <div class="col-12 col-sm-6 col-md-4 col-lg-3">
      <div class="card h-100 shadow-sm">
        <div class="ratio ratio-16x9 bg-light">
          <?php if ($logoRelIptv): ?>
            <img
              src="<?= htmlspecialchars($logoRelIptv, ENT_QUOTES, 'UTF-8') ?>"
              class="img-fluid w-100 h-100 p-2"
              style="object-fit:contain"
              alt="logo">
          <?php else: ?>
            <div class="d-flex align-items-center justify-content-center text-muted">Sin logo</div>
          <?php endif; ?>
        </div>

        <div class="card-body">
          <h5 class="card-title mb-1"><?= htmlspecialchars($nombre, ENT_QUOTES, 'UTF-8') ?></h5>
          
          <div class="fw-semibold mb-3">
            S/<?= number_format((float)$precio, 2) ?>
          </div>

          <div class="d-flex flex-wrap gap-2">
            <!-- Abrir detalle IPTV -->
            <a class="btn btn-sm btn-outline-primary"
               href="iptv.php?servicio_id=<?= $id ?>">Abrir</a>

            <!-- EDITAR IPTV (este alimenta el modal #iptvModal) -->
            <button type="button"
                    class="btn btn-sm btn-primary btn-edit-iptv"
                    data-bs-toggle="modal"
                    data-bs-target="#iptvModal"
                    data-id="<?= $id ?>"
                    data-nombre="<?= htmlspecialchars($nombre, ENT_QUOTES, 'UTF-8') ?>"
                    data-plan="<?= htmlspecialchars($plan, ENT_QUOTES, 'UTF-8') ?>"
                    data-precio="<?= htmlspecialchars($precio, ENT_QUOTES, 'UTF-8') ?>"
                    data-logo="<?= htmlspecialchars($logoPath, ENT_QUOTES, 'UTF-8') ?>"
                    data-logo-filename="<?= htmlspecialchars($logoFilename, ENT_QUOTES, 'UTF-8') ?>">
              Editar
            </button>

           <!-- BORRAR IPTV (SERVICIO) -->
<form action="actions/iptv_servicio_save.php"
      method="post"
      class="d-inline js-delete-iptv-servicio">
  <input type="hidden" name="action" value="delete">
  <input type="hidden" name="id" value="<?= $id ?>">
  <!-- 👇 para que vuelva al dashboard -->
  <input type="hidden" name="redirect" value="../dashboard.php">
  <button type="submit" class="btn btn-sm btn-outline-danger">
    Borrar
  </button>
</form>


          </div>
        </div>
      </div>
    </div>
  <?php endforeach; ?>



  <?php if (empty($streamings) && empty($iptvList)): ?>
    <div class="col-12">
      <div class="alert alert-info">
        Aún no hay servicios. Crea el primero con “Agregar Streaming” o “IPTV”.
      </div>
    </div>
  <?php endif; ?>
</div>

</div>


<script>
document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('iptvDashboardForm');
  if (!form) return;

  // 1) Asegurar que el select de plan sea visible
  var planSelect = form.querySelector('#iptv_plan');
  if (planSelect) {
    var group = planSelect.closest('.mb-3') || planSelect.closest('.form-group');
    if (group) {
      group.style.display = '';  // quita cualquier display:none inline
    }
  }

  // 2) Eliminar cualquier input hidden "plan" dentro de ESTE form
  var hiddenPlans = form.querySelectorAll('input[type="hidden"][name="plan"]');
  hiddenPlans.forEach(function (el) {
    if (el.parentNode) {
      el.parentNode.removeChild(el);
    }
  });
});
</script>

<script>
document.addEventListener('DOMContentLoaded', function () {
  var modal = document.getElementById('iptvModal');
  var form  = document.getElementById('iptvDashboardForm');
  if (!modal || !form) return;

  var actionEl  = form.querySelector('input[name="action"]');
  var idEl      = form.querySelector('input[name="id"]');
  var nombreEl  = form.querySelector('[name="nombre"]');
  var planEl    = form.querySelector('[name="plan"]');    // select
  var precioEl  = form.querySelector('[name="precio"]');
  var logoEl    = form.querySelector('[name="logo"]');
  var logoActEl = document.getElementById('iptv_logo_hidden');
  var titleEl   = document.getElementById('iptvModalLabel');

  var prevImg  = document.getElementById('iptvLogoPreviewDashboard');
  var prevText = document.getElementById('iptvLogoPreviewTextDashboard');

  // ---------- MODO CREAR ----------
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.btn-add-iptv');
    if (!btn) return;

    if (titleEl)  titleEl.textContent = 'Agregar IPTV';
    if (actionEl) actionEl.value = 'create';
    if (idEl)     idEl.value   = '';

    if (nombreEl) nombreEl.value = '';
    if (planEl) {
      planEl.value = '';
      if (planEl.selectedIndex > 0) planEl.selectedIndex = 0;
    }
    if (precioEl) precioEl.value = '';

    if (logoActEl) logoActEl.value = '';
    if (logoEl)    logoEl.value    = '';

    if (prevImg) {
      prevImg.src = '';
      prevImg.classList.add('d-none');
    }
    if (prevText) {
      prevText.textContent = 'Sin logo actual.';
    }
  });

  // ---------- MODO EDITAR ----------
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.btn-edit-iptv');
    if (!btn) return;

    if (titleEl)  titleEl.textContent = 'Editar IPTV';
    if (actionEl) actionEl.value = 'update';

    if (idEl)      idEl.value      = btn.getAttribute('data-id')      || '';
    if (nombreEl)  nombreEl.value  = btn.getAttribute('data-nombre')  || '';
    if (precioEl)  precioEl.value  = btn.getAttribute('data-precio')  || '';

    // --- seleccionar plan correcto en el <select> ---
        // Plan: primero intentamos asignar directamente el value
    if (planEl) {
      var rawPlanOriginal = (btn.dataset.plan || '').trim();
      var rawPlanLower    = rawPlanOriginal.toLowerCase();

      if (rawPlanOriginal !== '') {
        // 1) Intento directo: value exacto
        planEl.value = rawPlanOriginal;

        // 2) Si por alguna razón no coincide, hacemos fallback por texto/value en minúsculas
        if (planEl.value !== rawPlanOriginal) {
          var found = false;

          Array.prototype.forEach.call(planEl.options, function (opt) {
            var val = (opt.value || '').trim().toLowerCase();
            var txt = (opt.textContent || '').trim().toLowerCase();
            if (val === rawPlanLower || txt === rawPlanLower) {
              opt.selected = true;
              found = true;
            }
          });

          if (!found) {
            planEl.selectedIndex = 0;
          }
        }
      } else {
        // Si viene vacío desde el dataset, mostramos la opción por defecto
        planEl.selectedIndex = 0;
      }
    }


    // --- logo actual + preview ---
    var logoPath  = btn.getAttribute('data-logo') || '';
    var logoFile  = btn.getAttribute('data-logo-filename') || '';

    // hidden logo_actual para el backend
    if (logoActEl) {
      // puedes guardar solo el filename o la ruta, según cómo lo uses en PHP
      logoActEl.value = logoPath || logoFile || '';
    }

    // limpiamos el input file
    if (logoEl) {
      logoEl.value = '';
    }

    if (prevImg && prevText) {
      if (logoPath) {
        // si no empieza con /, lo dejamos tal cual (ej. "uploads/logo.png")
        prevImg.src = logoPath;
        prevImg.classList.remove('d-none');
        prevText.textContent = logoFile ? logoFile : '';
      } else {
        prevImg.src = '';
        prevImg.classList.add('d-none');
        prevText.textContent = 'Sin logo actual.';
      }
    }
  });
});
</script>
<script>
document.addEventListener('DOMContentLoaded', function () {
  var streamingModal = document.getElementById('streamingModal');
  if (!streamingModal) return;

  // Formulario dentro del modal
  var streamingForm = document.getElementById('streamingForm') || streamingModal.querySelector('form');
  if (!streamingForm) return;

  // Asegurar action/method correctos
  streamingForm.method = 'post';
  if (!streamingForm.action) {
    streamingForm.action = '../app/controllers/StreamingController.php';
  }

  // Hidden action
  var actionEl = streamingForm.querySelector('input[name="action"]');
  if (!actionEl) {
    actionEl = document.createElement('input');
    actionEl.type  = 'hidden';
    actionEl.name  = 'action';
    actionEl.value = 'create';
    streamingForm.prepend(actionEl);
  }

  // Utilidad para normalizar plan
  function normStreamingPlan(p) {
    p = String(p || '').trim().toLowerCase();

    if (p === 'individual') return 'individual';

    // Estándar / Standard → estandar
    if (['standard', 'estandar', 'estándar', 'estándard', 'estandard'].includes(p)) {
      return 'estandar';
    }

    if (['premium', 'premiun', 'premier'].includes(p)) {
      return 'premium';
    }

    return ''; // desconocido
  }

  // ---------- AGREGAR STREAMING (si tienes btn-add-streaming) ----------
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.btn-add-streaming');
    if (!btn) return;

    var titleEl  = streamingModal.querySelector('#streamingModalLabel') || streamingModal.querySelector('.modal-title');
    var idEl     = streamingForm.querySelector('input[name="id"]');
    var nombreEl = streamingForm.querySelector('input[name="nombre"]');
    var precioEl = streamingForm.querySelector('input[name="precio"]');
    var planSel  = streamingForm.querySelector('select[name="plan"]');
    var logoHid  = streamingForm.querySelector('input[name="logo"]');
    var fileEl   = streamingForm.querySelector('input[type="file"]');

    if (titleEl)  titleEl.textContent = 'Agregar Streaming';
    if (actionEl) actionEl.value = 'create';
    if (idEl)     idEl.value   = '0';
    if (nombreEl) nombreEl.value = '';
    if (precioEl) precioEl.value = '';
    if (planSel)  planSel.selectedIndex = 0;
    if (logoHid)  logoHid.value = '';
    if (fileEl)   fileEl.value  = '';

    var prevImg = streamingModal.querySelector('#streamingLogoPreview');
    if (prevImg) {
      prevImg.src = '';
      prevImg.style.display = 'none';
      prevImg.classList.add('d-none');
    }

    if (window.bootstrap && bootstrap.Modal) {
      bootstrap.Modal.getOrCreateInstance(streamingModal).show();
    }
  });

  // ---------- EDITAR STREAMING ----------
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.btn-edit-streaming');
    if (!btn) return;

    var titleEl  = streamingModal.querySelector('#streamingModalLabel') || streamingModal.querySelector('.modal-title');
    var idEl     = streamingForm.querySelector('input[name="id"]');
    var nombreEl = streamingForm.querySelector('input[name="nombre"]');
    var precioEl = streamingForm.querySelector('input[name="precio"]');
    var planSel  = streamingForm.querySelector('select[name="plan"]');
    var logoHid  = streamingForm.querySelector('input[name="logo"]');
    var fileEl   = streamingForm.querySelector('input[type="file"]');

    // Datos del botón
    var data = {};
    var raw = btn.getAttribute('data-row') || '';
    if (raw) {
      try { data = JSON.parse(raw.replace(/&quot;/g,'"')); } catch(e) { data = {}; }
    }
    data.id     = data.id     || btn.dataset.id     || '';
    data.nombre = data.nombre || btn.dataset.nombre || '';
    data.plan   = data.plan   || btn.dataset.plan   || '';
    data.precio = data.precio || btn.dataset.precio || '';
    data.logo   = data.logo   || btn.dataset.logo   || '';

    if (titleEl)  titleEl.textContent = 'Editar Streaming';
    if (actionEl) actionEl.value = 'update';

    if (idEl)     idEl.value     = data.id || '';
    if (nombreEl) nombreEl.value = data.nombre || '';
    if (precioEl) precioEl.value = data.precio || '';

    if (planSel) {
      var norm = normStreamingPlan(data.plan);
      if (norm) {
        planSel.value = norm;
        // Fallback por si el value no existe tal cual y quieres añadirlo
        if (planSel.value !== norm) {
          var opt = document.createElement('option');
          opt.value = norm;
          opt.textContent = norm.charAt(0).toUpperCase() + norm.slice(1);
          planSel.appendChild(opt);
          planSel.value = norm;
        }
      } else {
        planSel.selectedIndex = 0;
      }
    }

    if (logoHid) {
      var cleanLogo = (data.logo || '').replace(/^uploads\//,'');
      logoHid.value = cleanLogo;
    }
    if (fileEl) {
      fileEl.value = '';
    }

    // Preview
    var prevImg = streamingModal.querySelector('#streamingLogoPreview');
    if (prevImg) {
      var path = data.logo || '';
      if (!path) {
        prevImg.src = '';
        prevImg.style.display = 'none';
        prevImg.classList.add('d-none');
      } else {
        if (!/^https?:\/\//i.test(path) && !path.startsWith('/')) {
          path = 'uploads/' + path.replace(/^uploads\//,'');
        }
        prevImg.src = path;
        prevImg.style.display = 'block';
        prevImg.classList.remove('d-none');
      }
    }

    if (window.bootstrap && bootstrap.Modal) {
      bootstrap.Modal.getOrCreateInstance(streamingModal).show();
    }
  });

});
</script>

<script>
document.addEventListener('DOMContentLoaded', function () {
  // Confirmar borrado de servicio IPTV con SweetAlert
  document.addEventListener('submit', function (e) {
    var form = e.target.closest('.js-delete-iptv-servicio');
    if (!form) return; // no es el form que nos interesa

    e.preventDefault();

    if (typeof Swal === 'undefined') {
      // Por si no está cargado SweetAlert2, hacemos submit normal
      form.submit();
      return;
    }

    Swal.fire({
      title: '¿Eliminar IPTV?',
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    }).then(function (result) {
      if (result.isConfirmed) {
        form.submit(); // aquí ya va al PHP
      }
    });
  }, true);
});
</script>

<script>
document.addEventListener('DOMContentLoaded', function () {
  var flash = document.getElementById('flash');
  if (!flash || typeof Swal === 'undefined') return;

  var type = flash.getAttribute('data-type') || 'success';
  var text = flash.getAttribute('data-text') || '';
  if (!text) return;

  var icon = 'success';
  if (type === 'error') icon = 'error';
  else if (type === 'warning') icon = 'warning';
  else if (type === 'info') icon = 'info';

  Swal.fire({
    icon: icon,
    title: text,
    confirmButtonText: 'OK'
  });
});
</script>
<script>
document.addEventListener('DOMContentLoaded', function () {
  const input = document.getElementById('excelFileInput');
  if (!input) return;

  input.addEventListener('change', function () {
    if (this.files && this.files.length > 0) {
      this.form.submit();
    }
  });
});
</script>
<?php if ($import_ok || $import_error): ?>
<script>
document.addEventListener('DOMContentLoaded', function () {
  <?php if ($import_ok): ?>
  Swal.fire({
    icon: 'success',
    title: 'Importación completada',
    text: 'El archivo Excel se importó correctamente y las tablas fueron actualizadas.'
  });
  <?php elseif ($import_error): ?>
  let msg = 'Ocurrió un error al importar el archivo.';

  <?php if ($import_error === 1): ?>
  msg = 'No se recibió el archivo o hubo un error al subirlo.';
  <?php elseif ($import_error === 2): ?>
  msg = 'No se pudo leer el Excel. Verifica que sea .xls o .xlsx válido.';
  <?php elseif ($import_error === 3): ?>
  msg = 'Error interno al procesar las tablas en la base de datos.';
  <?php endif; ?>

  Swal.fire({
    icon: 'error',
    title: 'Error al importar',
    text: msg
  });
  <?php endif; ?>
});
</script>
<?php endif; ?>
<script>
document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('excelImportForm');
  const btn  = document.getElementById('btnImportExcel');

  if (!form || !btn) return;

  btn.addEventListener('click', function () {
    const fileInput = form.querySelector('input[name="excel_file"]');
    if (!fileInput || !fileInput.files.length) {
      Swal.fire({
        icon: 'warning',
        title: 'Sin archivo',
        text: 'Selecciona un archivo Excel para importar.'
      });
      return;
    }

    const formData = new FormData();
    formData.append('excel_file', fileInput.files[0]);

    Swal.fire({
      title: 'Importando...',
      text: 'Esto puede tardar unos segundos.',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    fetch('actions/import_streamings_excel.php', {
      method: 'POST',
      body: formData
    })
    .then(resp => resp.json().catch(() => null))
    .then(data => {
      if (!data) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Respuesta inválida del servidor.'
        });
        return;
      }

      if (data.ok) {
        let extra = '';
        if (data.stats) {
          const resumen = [];
          for (const [tabla, st] of Object.entries(data.stats)) {
            if (st.inserted || st.updated) {
              resumen.push(`${tabla}: ${st.inserted} nuevos / ${st.updated} editados`);
            }
          }
          if (resumen.length) {
            extra = '\n\n' + resumen.join('\n');
          }
        }

        Swal.fire({
          icon: 'success',
          title: 'Importación completada',
          text: 'Los datos se actualizaron correctamente.' + extra
        }).then(() => {
          // Si quieres refrescar datos:
          // location.reload();
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error al importar',
          text: data.message || 'Ocurrió un error al procesar el archivo.'
        });
      }
    })
    .catch(() => {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo comunicar con el servidor.'
      });
    });
  });
});
</script>

<?php
// Debe existir #streamingModal en includes/modals.php
include __DIR__ . '/../includes/modals.php';
include __DIR__ . '/../includes/footer.php';
