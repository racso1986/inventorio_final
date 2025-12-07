<?php
// public/iptv_servicios.php
session_start();
if (empty($_SESSION['user_id'])) { header('Location: index.php'); exit; }

require_once __DIR__ . '/../config/db.php';
$pdo = get_pdo();

// Traemos todos los servicios con # de cuentas asociadas
$sql = "SELECT  s.id,
                s.nombre,
                s.logo,
                s.plan,
                s.precio,
                s.created_at,
                COUNT(i.id) AS total_cuentas
          FROM iptv_servicios s
     LEFT JOIN iptv i ON i.servicio_id = s.id
      GROUP BY s.id
      ORDER BY s.created_at DESC, s.id DESC";

$servicios = $pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC) ?: [];

include __DIR__ . '/../includes/header.php';
include __DIR__ . '/../includes/navbar.php';
?>
<?php if (!empty($_SESSION['flash_text'])): ?>
  <div id="flash"
       data-type="<?= htmlspecialchars($_SESSION['flash_type'] ?? 'success', ENT_QUOTES, 'UTF-8') ?>"
       data-text="<?= htmlspecialchars($_SESSION['flash_text'], ENT_QUOTES, 'UTF-8') ?>"></div>
  <?php unset($_SESSION['flash_text'], $_SESSION['flash_type']); ?>
<?php endif; ?>

<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>IPTV • Servicios</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body data-page="iptv-servicios">
    
    
<div class="container my-4">
  <div class="d-flex justify-content-between align-items-center mb-3">
    <h3 class="mb-0">Servicios IPTV</h3>
  </div>
</div>
  
  <div class="container my-4">
  <div class=" mb-3" style="float: right;">
    
    <button type="button"
            class="btn btn-sm btn-success"
            data-bs-toggle="modal"
            data-bs-target="#modalServicioIptv" style="float:">
      + Agregar servicio IPTV
    </button>
     <a href="export_iptv_servicios.php"
     class="btn btn-sm btn-outline-success">
    Exportar Excel
  </a>
  </div>
 </div>

<?php
require_once __DIR__ . '/../config/db.php';
$pdo = get_pdo();
$servicios = $pdo->query("SELECT * FROM iptv_servicios ORDER BY created_at DESC, id DESC")
                 ->fetchAll(PDO::FETCH_ASSOC);
?>

<div class="container mt-3">
  <div class="d-flex align-items-center justify-content-between mb-3">
    <h3 class="mb-0">Servicios IPTV</h3>
    <div class="d-flex gap-2">
      <a href="dashboard.php" class="btn btn-sm btn-outline-secondary">Volver al dashboard</a>
      <button type="button"
              class="btn btn-sm btn-success btn-add-iptv"
              data-bs-toggle="modal"
              data-bs-target="#iptvModal">
        Agregar servicio IPTV
      </button>
    </div>
  </div>

  <div class="container mt-3">
  <div class="d-flex align-items-center justify-content-between mb-3">
    <h3 class="mb-0">Servicios IPTV</h3>
    <div class="d-flex gap-2">
      <a href="dashboard.php" class="btn btn-sm btn-outline-secondary">Volver al dashboard</a>
      <button type="button"
              class="btn btn-sm btn-success btn-add-iptv"
              data-bs-toggle="modal"
              data-bs-target="#iptvModal">
        Agregar servicio IPTV
      </button>
    </div>
  </div>

  <?php if (!empty($_SESSION['flash_text'])): ?>
    <div id="flash"
         data-type="<?= htmlspecialchars($_SESSION['flash_type'] ?? 'success') ?>"
         data-text="<?= htmlspecialchars($_SESSION['flash_text']) ?>"></div>
    <?php unset($_SESSION['flash_text'], $_SESSION['flash_type']); ?>
  <?php endif; ?>

  <div class="row g-3">
    <?php if (empty($servicios)): ?>
      <div class="col-12">
        <div class="alert alert-info mb-0">
          Aún no hay servicios IPTV. Usa el botón “Agregar servicio IPTV” para crear el primero.
        </div>
      </div>
    <?php endif; ?>

    <?php foreach ($servicios as $s):
      $id        = (int)$s['id'];
      $nombre    = (string)$s['nombre'];
      $plan      = (string)($s['plan'] ?? '');
      $precio    = (string)($s['precio'] ?? '0');
      $totalCtas = (int)($s['total_cuentas'] ?? 0);
      $filename  = basename((string)($s['logo'] ?? ''));
      $logoRel   = $filename ? 'uploads/' . $filename : '';
    ?>
      <div class="col-12 col-sm-6 col-md-4 col-lg-3">
        <div class="card h-100 shadow-sm">
          <div class="ratio ratio-16x9 bg-light">
            <?php if ($logoRel): ?>
              <img src="<?= htmlspecialchars($logoRel, ENT_QUOTES, 'UTF-8') ?>"
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
            <p class="card-text mb-1">
              <small class="text-muted">
                <?= htmlspecialchars($plan, ENT_QUOTES, 'UTF-8') ?>
              </small>
            </p>
            <p class="card-text mb-2">
              <small class="text-muted">
                Cuentas asociadas: <?= $totalCtas ?>
              </small>
            </p>
            <div class="fw-semibold mb-3">
              S/<?= number_format((float)$precio, 2) ?>
            </div>

            <div class="d-flex flex-wrap gap-2">
              <a class="btn btn-sm btn-outline-primary"
                 href="iptv.php?servicio_id=<?= $id ?>">
                Abrir
              </a>

              <button type="button"
                      class="btn btn-sm btn-primary btn-edit-iptv"
                      data-bs-toggle="modal"
                      data-bs-target="#iptvModal"
                      data-id="<?= $id ?>"
                      data-nombre="<?= htmlspecialchars($nombre, ENT_QUOTES, 'UTF-8') ?>"
                      data-plan="<?= htmlspecialchars($plan, ENT_QUOTES, 'UTF-8') ?>"
                      data-precio="<?= htmlspecialchars($precio, ENT_QUOTES, 'UTF-8') ?>"
                      data-logo="<?= htmlspecialchars($filename, ENT_QUOTES, 'UTF-8') ?>"
                      data-logo-filename="<?= htmlspecialchars($filename, ENT_QUOTES, 'UTF-8') ?>">
                Editar
              </button>

              <form action="actions/iptv_servicio_save.php"
                    method="post"
                    class="d-inline js-delete-iptv-servicio">
                <input type="hidden" name="action" value="delete">
                <input type="hidden" name="id" value="<?= $id ?>">
                <input type="hidden" name="redirect" value="../iptv_servicios.php">
                <button type="submit" class="btn btn-sm btn-outline-danger">
                  Borrar
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    <?php endforeach; ?>
  </div>
</div>

</div>




<div class="modal fade" id="modalServicioIptv" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog">
    <!-- AQUÍ va el FORM, NO en iptv_servicio_save.php -->
    <form id="iptvServicioForm"
      class="modal-content"
      method="post"
      action="actions/iptv_servicio_save.php"
      enctype="multipart/form-data"
      autocomplete="off">




      <div class="modal-header">
        <h5 class="modal-title" id="modalServicioTitle">Agregar servicio IPTV</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
      </div>

      <div class="modal-body">
        <input type="hidden" name="action" id="iptv_servicio_action" value="create">
        <input type="hidden" name="id" id="iptv_servicio_id" value="0">

        <div class="mb-3">
          <label class="form-label" for="iptv_servicio_nombre">Nombre</label>
          <input type="text"
                 name="nombre"
                 id="iptv_servicio_nombre"
                 class="form-control"
                 required>
        </div>

        <div class="mb-3">
          <label class="form-label" for="iptv_servicio_plan">Plan</label>
          <select
              name="plan"
              id="iptv_servicio_plan"
              class="form-select"
              required>
            <option value="" disabled selected>Selecciona un plan</option>
            <option value="BÁSICO">BÁSICO</option>
            <option value="ESTÁNDAR">ESTÁNDAR</option>
            <option value="PREMIUM">PREMIUM</option>
          </select>
        </div>

        <div class="mb-3">
          <label class="form-label" for="iptv_servicio_precio">Precio (S/)</label>
          <input type="number"
                 name="precio"
                 id="iptv_servicio_precio"
                 class="form-control"
                 step="0.01"
                 min="0"
                 required>
        </div>

       <div class="mb-3">
  <label class="form-label" for="iptv_servicio_logo">Logo (jpg/png/gif, máx 2MB)</label>
  <input type="file"
         name="logo"
         id="iptv_servicio_logo"
         class="form-control"
         accept=".jpg,.jpeg,.png,.gif">

  <div class="form-text mt-2">
    <span class="text-muted small d-block mb-1">
      Puedes subir un nuevo logo si lo deseas.
    </span>
    <div id="iptvLogoPreviewWrapper" class="d-flex align-items-center gap-2">
      <img id="iptvLogoPreview"
           src=""
           alt="Logo actual"
           class="img-thumbnail d-none"
           style="max-height:60px;">
      <span id="iptvLogoPreviewText" class="text-muted small">
        Sin logo actual.
      </span>
    </div>
  </div>
</div>


<!-- Preview del logo actual / nuevo -->
<div class="mb-2" id="iptv_servicio_logo_preview_wrap" style="display:none;">
  <small class="text-muted d-block mb-1">Vista previa del logo</small>
  <img id="iptv_servicio_logo_preview"
       src=""
       alt="Logo IPTV"
       class="img-fluid border rounded"
       style="max-height:120px;object-fit:contain;">
</div>

      </div>

     <div class="modal-footer">
  <button type="button"
          class="btn btn-secondary"
          data-bs-dismiss="modal">
    Cancelar
  </button>

  <!-- CHANGED: botón tipo button + submit() directo sobre el form -->
  <button type="button"
        class="btn btn-primary"
        onclick="document.getElementById('iptvServicioForm').submit();">
  Guardar
</button>


</div>

    </form>
  </div>
</div>



<script>
(function () {
  const modal = document.getElementById('modalServicioIptv');
  if (!modal) return;

  function fixPlanField() {
    const form = modal.querySelector('form');
    const selectPlan = document.getElementById('iptv_servicio_plan');
    if (selectPlan) {
      const wrapper = selectPlan.closest('.mb-3');
      if (wrapper && wrapper.style && wrapper.style.display === 'none') {
        wrapper.style.display = '';
      }
    }
    if (form) {
      const hiddenPlans = form.querySelectorAll('input[type="hidden"][name="plan"]');
      hiddenPlans.forEach(function (el) {
        if (el !== selectPlan) el.parentNode.removeChild(el);
      });
    }
  }

  modal.addEventListener('show.bs.modal', function (ev) {
    const btn         = ev.relatedTarget;
    const inputId     = document.getElementById('iptv_servicio_id');
    const inputAct    = document.getElementById('iptv_servicio_action');
    const inputNom    = document.getElementById('iptv_servicio_nombre');
    const selectPlan  = document.getElementById('iptv_servicio_plan');
    const inputPrecio = document.getElementById('iptv_servicio_precio');
    const inputLogo   = document.getElementById('iptv_servicio_logo');
    const title       = document.getElementById('modalServicioTitle');

    const prevImg  = document.getElementById('iptvLogoPreview');
    const prevText = document.getElementById('iptvLogoPreviewText');

    fixPlanField();

    // Siempre limpiar file input
    if (inputLogo) {
      inputLogo.value = '';
    }

    // ===== MODO CREAR =====
    if (!btn || !btn.dataset.id) {
      if (inputId)     inputId.value     = '0';
      if (inputAct)    inputAct.value    = 'create';
      if (inputNom)    inputNom.value    = '';
      if (inputPrecio) inputPrecio.value = '';

      if (selectPlan) {
        selectPlan.value = '';
        if (selectPlan.selectedIndex > 0) {
          selectPlan.selectedIndex = 0;
        }
      }

      if (prevImg) {
        prevImg.src = '';
        prevImg.classList.add('d-none');
      }
      if (prevText) {
        prevText.textContent = 'Sin logo actual.';
      }

      if (title) title.textContent = 'Agregar servicio IPTV';
      return;
    }

    // ===== MODO EDITAR =====
    if (inputId)     inputId.value     = btn.dataset.id || '0';
    if (inputAct)    inputAct.value    = 'update';
    if (inputNom)    inputNom.value    = btn.dataset.nombre || '';
    if (inputPrecio) inputPrecio.value = btn.dataset.precio || '';

    if (selectPlan) {
      const plan = btn.dataset.plan || '';
      let found = false;
      for (const opt of selectPlan.options) {
        if (opt.value === plan) {
          selectPlan.value = plan;
          found = true;
          break;
        }
      }
      if (!found) {
        selectPlan.selectedIndex = 0;
      }
    }

    const logo = btn.dataset.logo || '';

    if (prevImg) {
      if (logo) {
        prevImg.src = logo;
        prevImg.classList.remove('d-none');
      } else {
        prevImg.src = '';
        prevImg.classList.add('d-none');
      }
    }
    if (prevText) {
      prevText.textContent = logo ? 'Logo actual' : 'Sin logo actual.';
    }

    if (title) title.textContent = 'Editar servicio IPTV';
  });
})();
</script>







<script>
(function () {
  // Asegúrate que SweetAlert2 esté cargado (Swal global).
  // Si no lo está, simplemente no hacemos nada.
  if (typeof Swal === 'undefined') return;

  document.addEventListener('submit', function (ev) {
    // ¿El submit viene de un form de borrar IPTV?
    const form = ev.target.closest('.form-delete-iptv-servicio');
    if (!form) return;

    ev.preventDefault();

    const id = form.querySelector('input[name="id"]')?.value || '';

    Swal.fire({
      title: '¿Eliminar servicio IPTV?',
      html: id
        ? 'Esta acción eliminará el servicio <b>ID ' + id + '</b> y sus perfiles/cuentas asociadas.'
        : 'Esta acción eliminará el servicio IPTV.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      reverseButtons: true
    }).then(function (result) {
      if (result.isConfirmed) {
        form.submit(); // ahora sí se envía al PHP y se borra
      }
    });
  });
})();
</script>
<script>
(function () {
  // Comprueba que SweetAlert2 esté disponible
  if (typeof Swal === 'undefined') {
    console.warn('SweetAlert2 (Swal) no está definido en iptv_servicios.php');
    return;
  }

  console.log('SweetAlert IPTV delete hook inicializado');

  document.addEventListener('click', function (ev) {
    const btn = ev.target.closest('.btn-delete-iptv');
    if (!btn) return;

    ev.preventDefault();

    const form = btn.closest('form');
    if (!form) return;

    // ID desde data-id o hidden
    const id = btn.dataset.id || form.querySelector('input[name="id"]')?.value || '';

    Swal.fire({
      title: '¿Eliminar servicio IPTV?',
      html: id
        ? 'Esta acción eliminará el servicio <b>ID ' + id + '</b> y sus perfiles/cuentas asociadas.'
        : 'Esta acción eliminará el servicio IPTV.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      reverseButtons: true
    }).then(function (result) {
      if (result.isConfirmed) {
        form.submit(); // recién aquí se hace el POST a iptv_servicio_save.php
      }
    });
  });
})();
</script>

<!-- Si no estás 100% seguro de ya tener SweetAlert2 cargado en esta página,
     puedes dejar esta línea. Si tu layout ya lo incluye, puedes omitirla. -->
<script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>

<script>
(function () {
  console.log('Hook de delete IPTV inicializado');

  document.addEventListener('click', function (ev) {
    const btn = ev.target.closest('.btn-delete-iptv');
    if (!btn) return; // click en otro lado

    ev.preventDefault();

    const form = btn.closest('form');
    if (!form) return;

    const id = btn.dataset.id || form.querySelector('input[name="id"]')?.value || '';

    // Fallback por si SweetAlert2 no está cargado
    if (typeof Swal === 'undefined') {
      const msg = id
        ? '¿Eliminar servicio IPTV ID ' + id + ' y sus perfiles/cuentas asociadas?'
        : '¿Eliminar este servicio IPTV?';

      if (confirm(msg)) {
        form.submit();
      }
      return;
    }

    // SweetAlert2
    Swal.fire({
      title: '¿Eliminar servicio IPTV?',
      html: id
        ? 'Esta acción eliminará el servicio <b>ID ' + id + '</b> y sus perfiles/cuentas asociadas.'
        : 'Esta acción eliminará el servicio IPTV.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      reverseButtons: true
    }).then(function (result) {
      if (result.isConfirmed) {
        form.submit();
      }
    });
  });
})();
</script>
<script>
(function () {
  const form  = document.getElementById('iptvServicioForm');
  const btn   = document.getElementById('btnGuardarServicioIptv');
  if (!form || !btn) return;

  let isSubmitting = false;

  btn.addEventListener('click', function () {
    if (isSubmitting) return; // evita doble click

    // Validación mínima (HTML5 ya valida, pero reforzamos)
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    isSubmitting = true;
    btn.disabled = true;

    form.submit(); // envío normal
  });
})();
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

</body>
</html>

<?php
include __DIR__ . '/../includes/modals.php';
include __DIR__ . '/../includes/footer.php';
