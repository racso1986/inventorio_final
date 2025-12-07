<?php
ini_set('display_errors', '1');
ini_set('display_startup_errors', '1');
error_reporting(E_ALL);
// ===== DEBUG opcional =====
// Abre /public/iptv.php?debug=1 para ver errores en pantalla
$DEBUG = isset($_GET['debug']) ? 1 : 0;
if ($DEBUG) { ini_set('display_errors','1'); error_reporting(E_ALL); }

// ===== CARGAS BÁSICAS =====
require_once __DIR__ . '/../config/db.php';   // Debe exponer get_pdo()


// Id del servicio IPTV actual (viene por GET)
$servicio_id = isset($_GET['servicio_id']) ? (int)$_GET['servicio_id'] : 0;
if ($servicio_id < 0) {
  $servicio_id = 0;
}




// -------- Helpers fallback --------
if (!function_exists('estado_badge_class')) {
  function estado_badge_class(string $estado): string {
    $e = strtolower(trim($estado));
    return match($e) {
      'activo'    => 'bg-success',
      'pendiente' => 'bg-warning',
      default     => 'bg-secondary',
    };
  }
}

date_default_timezone_set('America/Lima');
if (!function_exists('row_json_attr')) {
  function row_json_attr(array $row): string {
    return htmlspecialchars(
      json_encode($row, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),
      ENT_QUOTES, 'UTF-8'
    );
  }
}
if (!function_exists('format_cliente_num')) {
  function format_cliente_num(string $wa_e164 = '', string $wa_digits = ''): string {
    $digits = ltrim($wa_e164 !== '' ? $wa_e164 : $wa_digits, '+');
    if ($digits === '') return '';
    if (strlen($digits) > 9) {
      $cc    = substr($digits, 0, strlen($digits) - 9);
      $local = substr($digits, -9);
      return '+' . $cc . ' '
           . substr($local, 0, 3) . ' '
           . substr($local, 3, 3) . ' '
           . substr($local, 6, 3);
    }
    if (strlen($digits) === 9) {
      return substr($digits, 0, 3) . ' '
           . substr($digits, 3, 3) . ' '
           . substr($digits, 6, 3);
    }
    return ($wa_e164 !== '' && $wa_e164[0] === '+') ? $wa_e164 : ('+' . $digits);
  }
}
// ---------------------------------------------------------------------------

// ===== CONEXIÓN PDO =====
// ===============================================
// NUEVO: filtro por servicio IPTV
// ===============================================
// NUEVO: filtro por servicio IPTV
$servicio_id = isset($_GET['servicio_id']) ? (int)$_GET['servicio_id'] : 0;
$servicio    = null;

try {
    $pdo = get_pdo();

    // Si NO viene servicio_id en la URL, mandamos a la lista
    if ($servicio_id <= 0) {
        header('Location: iptv_servicios.php');
        exit;
    }

    // Cargar el servicio; si no existe, también redirigimos
    $st = $pdo->prepare("SELECT id, nombre, plan, precio, logo, created_at
                           FROM iptv_servicios
                          WHERE id = ?");
    $st->execute([$servicio_id]);
    $servicio = $st->fetch(PDO::FETCH_ASSOC) ?: null;

    if (!$servicio) {
        header('Location: iptv_servicios.php');
        exit;
    }
} catch (Throwable $e) {
    if ($DEBUG) {
        echo "<pre>DB ERROR en get_pdo()/iptv_servicios: " .
             htmlspecialchars($e->getMessage(), ENT_QUOTES, 'UTF-8') .
             "</pre>";
    }
    http_response_code(500);
    exit;
}



// ... tus require, session, etc.

// ENDPOINTS AJAX IPTV
$SAVE_URL   = 'ajax/iptv_save.php';
$DELETE_URL = 'ajax/iptv_delete.php';
$COLOR_URL  = 'ajax/iptv_color.php';


// ===== CARGA DEL MODELO / DATOS =====
$iptv_perfiles = [];
$iptv_cuentas  = [];
try {
  $use_fallback = false;
  // Si no tienes /app/ no pasa nada; entramos al fallback.
  $modelPath = __DIR__ . '/../app/models/IptvModel.php';
  if (is_file($modelPath)) {
    require_once $modelPath;
    if (!class_exists('IptvModel')) $use_fallback = true;
  } else {
    $use_fallback = true;
  }

  // SPLIT en tablas (flag en config/config.php): IPTV_SPLIT_TABLES
  if (defined('IPTV_SPLIT_TABLES') && IPTV_SPLIT_TABLES) {
    if ($use_fallback || !method_exists('IptvModel','allFrom')) {
      
      if ($servicio_id > 0) {
  // Solo registros del servicio actual
  $stmt = $pdo->prepare(
    "SELECT id, servicio_id, nombre, usuario, password_plain, url, whatsapp,
            fecha_inicio, fecha_fin, soles, estado, combo, color, created_at
       FROM iptv_perfiles
      WHERE servicio_id = :sid
   ORDER BY usuario ASC, fecha_fin ASC, id ASC"
  );
  $stmt->execute([':sid' => $servicio_id]);
  $iptv_perfiles = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

  $stmt = $pdo->prepare(
    "SELECT id, servicio_id, nombre, usuario, password_plain, url, whatsapp,
            fecha_inicio, fecha_fin, soles, estado, combo, color, created_at
       FROM iptv_cuentas
      WHERE servicio_id = :sid
   ORDER BY usuario ASC, fecha_fin ASC, id ASC"
  );
  $stmt->execute([':sid' => $servicio_id]);
  $iptv_cuentas = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
} else {
  // Vista global (sin filtro, como antes)
  $stmt = $pdo->query(
    "SELECT id, servicio_id, nombre, usuario, password_plain, url, whatsapp,
            fecha_inicio, fecha_fin, soles, estado, combo, color, created_at
       FROM iptv_perfiles
   ORDER BY usuario ASC, fecha_fin ASC, id ASC"
  );
  $iptv_perfiles = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

  $stmt = $pdo->query(
    "SELECT id, servicio_id, nombre, usuario, password_plain, url, whatsapp,
            fecha_inicio, fecha_fin, soles, estado, combo, color, created_at
       FROM iptv_cuentas
   ORDER BY usuario ASC, fecha_fin ASC, id ASC"
  );
  $iptv_cuentas = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
}

    } else {
      if ($servicio_id > 0) {
    // Solo registros del servicio actual
    $iptv_perfiles = IptvModel::allFrom('perfil', $servicio_id);
    $iptv_cuentas  = IptvModel::allFrom('cuenta', $servicio_id);
} else {
    // Vista global (como antes, sin filtro)
    $iptv_perfiles = IptvModel::allFrom('perfil');
    $iptv_cuentas  = IptvModel::allFrom('cuenta');
}

    }
  } else {
  // Modo legacy: una sola tabla iptv
  if ($use_fallback || !method_exists('IptvModel','all')) {
    if ($servicio_id > 0) {
      $stmt = $pdo->prepare(
        "SELECT id, nombre, usuario, password_plain, url, whatsapp,
                fecha_inicio, fecha_fin, soles, estado, combo,
                color, created_at
           FROM iptv
          WHERE servicio_id = :sid
          ORDER BY id DESC"
      );
      $stmt->execute([':sid' => $servicio_id]);
    } else {
      // Fallback: vista global (sin filtro)
      $stmt  = $pdo->query(
        "SELECT id, nombre, usuario, password_plain, url, whatsapp,
                fecha_inicio, fecha_fin, soles, estado, combo,
                color, created_at
           FROM iptv
          ORDER BY id DESC"
      );
    }
    $iptv_cuentas = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
  } else {
    // TODO: si usas IptvModel::all() y quieres filtrar por servicio_id,
    // crea un método IptvModel::allByServicio(int $servicio_id).
    $iptv_cuentas = IptvModel::all();
  }
}

    

} catch (Throwable $e) {
  if ($DEBUG) {
    echo "<pre>QUERY ERROR: " . htmlspecialchars($e->getMessage(), ENT_QUOTES, 'UTF-8') . "</pre>";
  }
  http_response_code(500);
  exit;
}

$hoy = date('Y-m-d');


// Etiqueta "10 noviembre"
if (!function_exists('iptv_day_label')) {
  function iptv_day_label(int $ts): string {
    static $mes = [
      1=>'enero',2=>'febrero',3=>'marzo',4=>'abril',5=>'mayo',6=>'junio',
      7=>'julio',8=>'agosto',9=>'septiembre',10=>'octubre',11=>'noviembre',12=>'diciembre'
    ];
    $d = (int)date('j', $ts);
    $m = (int)date('n', $ts);
    return $d . ' ' . ($mes[$m] ?? '');
  }
}

// created_at -> (fi) -> (ff) -> ahora
if (!function_exists('iptv_created_ts')) {
  function iptv_created_ts(array $row, string $hoyYmd): int {
    $raw = $row['created_at'] ?? $row['createdAt'] ?? $row['fecha_creacion'] ?? '';
    $ts  = $raw ? (strtotime((string)$raw) ?: 0) : 0;

    if (!$ts) {
      $fi = (string)($row['fecha_inicio'] ?? '');
      $ff = (string)($row['fecha_fin'] ?? '');
      if ($fi && $fi !== '0000-00-00') $ts = strtotime($fi);
      elseif ($ff && $ff !== '0000-00-00') $ts = strtotime($ff);
      else $ts = strtotime($hoyYmd);
    }
    return (int)$ts;
  }
}

// Si viene id por GET (ej: iptv.php?id=3#perfiles), lo usamos
$iptv_id_get = isset($_GET['id']) ? (int)$_GET['id'] : 0;

// Si ya tenías $servicio_id calculado antes, lo respetamos pero dejamos que GET lo sobrescriba
if ($iptv_id_get > 0) {
    $servicio_id = $iptv_id_get;
}

// === Determinar el "padre" por correo: el registro más antiguo (id más pequeño) ===
function iptv_heads_by_usuario(array $rows): array {
  $heads = [];
  foreach ($rows as $r) {
    $u = strtolower(trim((string)($r['usuario'] ?? '')));
    if ($u === '') continue;
    $id = (int)($r['id'] ?? 0);
    if (!isset($heads[$u]) || $id < $heads[$u]) {
      $heads[$u] = $id; // padre = id más pequeño de ese correo
    }
  }
  return $heads;
}
$IPTV_HEADS_PERFILES = iptv_heads_by_usuario($iptv_perfiles);
$IPTV_HEADS_CUENTAS  = iptv_heads_by_usuario($iptv_cuentas);

// ===== Includes de layout =====
include __DIR__ . '/../includes/header.php';
include __DIR__ . '/../includes/navbar.php';

// ===== RUTAS (sin app/, solo /public/ajax/...) =====
$BASE = rtrim(dirname($_SERVER['PHP_SELF']), '/');          // /public
$saveFile   = is_file(__DIR__ . '/ajax/iptv_save.php')   ? 'iptv_save.php'
           : (is_file(__DIR__ . '/ajax/ipt_save.php')    ? 'ipt_save.php' : '');
$deleteFile = is_file(__DIR__ . '/ajax/iptv_delete.php') ? 'iptv_delete.php' : '';
$colorFile  = is_file(__DIR__ . '/ajax/iptv_color.php')  ? 'iptv_color.php'  : '';

$SAVE_URL   = $saveFile   ? ($BASE . '/ajax/' . $saveFile)   : '';
$DELETE_URL = $deleteFile ? ($BASE . '/ajax/' . $deleteFile) : '';
$COLOR_URL  = $colorFile  ? ($BASE . '/ajax/' . $colorFile)  : '';
?>
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>IPTV</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    .row-color-rojo   { background: #ffe5e5 !important; }
    .row-color-azul   { background: #e5f0ff !important; }
    .row-color-verde  { background: #e9ffe5 !important; }
    .row-color-blanco { background: #ffffff !important; }
    .cursor-pointer   { cursor: pointer; }
    .plan-cell-perfil { min-width: 140px; }
    .correo-cell      { min-width: 180px; }
    .text-truncate    { max-width: 260px; }

    /* === IPTV Perfiles — hueco igual a Streaming (cols 1–4 de HIJOS) === */
    #iptv-perfiles table.table.table-bordered tbody tr.js-parent-row > td:nth-child(-n+4){
      border-bottom: 0 !important;
    }
    #iptv-perfiles table.table.table-bordered tbody tr.js-child-row > td:nth-child(-n+4){
      border-top: 0 !important;
      border-bottom: 0 !important;
      border-left: 0 !important;
      border-right: 0 !important;
      background: #fff !important;
      color: transparent !important;
      pointer-events: none;
    }
    #iptv-perfiles table.table.table-bordered tbody tr.js-child-row{
      border-top-width: 0 !important;
      border-bottom-width: 0 !important;
    }
    #iptv-perfiles table.table.table-bordered tbody tr.js-child-row > td:first-child{
      border-left-width: 1px !important;
      border-left-style: solid !important;
      border-left-color: #000 !important;
    }
    #iptv-perfiles table.table.table-bordered{
      border-bottom: 1px solid #000 !important;
    }
    #iptv-perfiles table.table.table-bordered > :not(caption) > tbody > tr:last-child,
    #iptv-perfiles table.table.table-bordered tbody tr:last-child > td{
      border-bottom-width: 1px !important;
      border-bottom-style: solid !important;
      border-bottom-color: #000 !important;
    }

    /* Celda clickeable para IPTV (Nombre) */
    .iptv-cell-perfil { min-width: 140px; cursor: pointer; }

    /* ===== Filtros locales: reset de cualquier filtro heredado (streamings) ===== */
    body[data-page="iptv"] #filterBar,
    body[data-page="iptv"] .filters,
    body[data-page="iptv"] .filters-bar,
    body[data-page="iptv"] .toolbar-filtros,
    body[data-page="iptv"] .js-filters-root {
      display: none !important;
    }
    .iptv-local-filters { display: block; }
    .tab-pane:not(.active) .iptv-local-filters { display: none !important; }
    .iptv-local-filters .form-control,
    .iptv-local-filters .form-select { height: calc(1.5em + .5rem + 2px); }
    
    
    #iptv-perfiles .__filtersWrap__ {
        display: none !important;
    }
     #iptv-cuentas .__filtersWrap__ {
        display: none !important;
    }
  </style>
</head>
<body data-page="iptv" >

<div class="container py-3">
  <div class="d-flex justify-content-between align-items-center mb-3">
  <div class="d-flex flex-column">
    <h5 class="m-0">
      IPTV<?= $servicio ? ' · ' . htmlspecialchars($servicio['nombre'], ENT_QUOTES, 'UTF-8') : '' ?>
    </h5>
    <?php if ($servicio): ?>
      <small class="text-muted">
        <?= htmlspecialchars($servicio['plan'] ?? '', ENT_QUOTES, 'UTF-8') ?>
        <?php if (isset($servicio['precio'])): ?>
          · S/<?= number_format((float)($servicio['precio'] ?? 0), 2) ?>
        <?php endif; ?>
      </small>
    <?php endif; ?>
  </div>
  
  

  <div class="d-flex gap-2">
    <?php if ($servicio_id > 0): ?>
      <a href="iptv_servicios.php" class="btn btn-sm btn-outline-secondary">
        Volver a servicios
      </a>
    <?php endif; ?>

    <?php if (!defined('IPTV_SPLIT_TABLES') || !IPTV_SPLIT_TABLES): ?>
      <!-- Botón Agregar IPTV (modo legacy) -->
      <button type="button"
              class="btn btn-sm btn-success"
              data-bs-toggle="modal"
              data-bs-target="#modalEditarIptv"
              id="btnAgregarIptv"
              data-row='<?= row_json_attr([
                "id" => 0,
                "nombre" => "",
                "usuario" => "",
                "password_plain" => "",
                "url" => "",
                "whatsapp" => "",
                "fecha_inicio" => date('Y-m-d'),
                "fecha_fin" => date('Y-m-d', strtotime('+30 days')),
                "soles" => "0.00",
                "estado" => "activo",
                "combo" => 0,
                "tipo" => "cuenta",
                "servicio_id" => (int)$servicio_id   // NUEVO
              ]) ?>'>
        + Agregar IPTV
      </button>
    <?php endif; ?>
  </div>
</div>


    <?php if (!defined('IPTV_SPLIT_TABLES') || !IPTV_SPLIT_TABLES): ?>
      <!-- Botón Agregar IPTV (solo modo legacy: una sola tabla) -->
      <button type="button"
              class="btn btn-sm btn-success"
              data-bs-toggle="modal"
              data-bs-target="#modalEditarIptv"
              id="btnAgregarIptv"
              data-row='<?= row_json_attr([
                "id" => 0,
                "nombre" => "",
                "usuario" => "",
                "password_plain" => "",
                "url" => "",
                "whatsapp" => "",
                "fecha_inicio" => date('Y-m-d'),
                "fecha_fin" => date('Y-m-d', strtotime('+30 days')),
                "soles" => "0.00",
                "estado" => "activo",
                "combo" => 0,
                "tipo" => "cuenta"
              ]) ?>'>
        + Agregar IPTV
      </button>
    <?php endif; ?>
  </div>

  <?php if (defined('IPTV_SPLIT_TABLES') && IPTV_SPLIT_TABLES): ?>
  
  
  <div class="container">
    <!-- Tabs -->
    <ul class="nav nav-tabs" id="iptvTabs" role="tablist">
  <li class="nav-item" role="presentation">
    <a class="nav-link active"
       id="iptv-perfiles-tab"
       data-bs-toggle="tab"
       data-bs-target="#iptv-perfiles"
       href="iptv.php?servicio_id=<?= (int)$servicio_id ?>#perfiles"
       role="tab">
      Perfiles
    </a>
  </li>

  <li class="nav-item" role="presentation">
    <a class="nav-link"
       id="iptv-cuentas-tab"
       data-bs-toggle="tab"
       data-bs-target="#iptv-cuentas"
      href="iptv.php?servicio_id=<?= (int)$servicio_id ?>#cuentas"
       role="tab">
      Cuentas
    </a>
  </li>
</ul>
</div>

    <div class="tab-content">
      <!-- TAB: PERFILES -->
      <div class="tab-pane fade show active container" id="iptv-perfiles" role="tabpanel" aria-labelledby="iptv-perfiles-tab" data-tipo="perfil">
        <!-- Botón Agregar SOLO Perfiles -->
        <!-- Botón Agregar SOLO Perfiles -->
<?php if ($servicio_id > 0): ?>
  <div class="d-flex justify-content-end mb-2">
    <button type="button" class="btn btn-sm btn-primary" id="btnAddPerfil"
            data-bs-toggle="modal" data-bs-target="#modalAgregarPerfil">
      + Agregar Perfil IPTV
    </button>

    <a href="export_iptv_items.php?servicio_id=<?= $servicio_id ?>&tipo=perfil"
       class="btn btn-sm btn-outline-success" style="margin-left: 25px;">
      Exportar Excel (Perfiles)
    </a>
  </div>
<?php else: ?>
  <div class="alert alert-info py-2">
    Selecciona primero un servicio IPTV para poder agregar perfiles.
  </div>
<?php endif; ?>


        <!-- Filtro local: PERFILES -->
        <div class="iptv-local-filters mb-2" data-scope="perfiles">
          <div class="row g-2 align-items-center">
            <div class="col-sm-4">
              <input type="search" class="form-control form-control-sm" placeholder="Buscar nombre, correo o URL" data-role="search">
            </div>
            <div class="col-sm-2">
              <select class="form-select form-select-sm" data-role="estado">
                <option value="">Estado: Todos</option>
                <option value="activo">Activo</option>
                <option value="pendiente">Pendiente</option>
                <option value="moroso">Moroso</option>
              </select>
            </div>
            <div class="col-sm-2">
              <select class="form-select form-select-sm" data-role="combo">
                <option value="">Combo: Todos</option>
                <option value="1">Sí</option>
                <option value="0">No</option>
              </select>
            </div>
            <div class="col-sm-2">
              <select class="form-select form-select-sm" data-role="color">
                <option value="">Color: Todos</option>
                <option value="rojo">Rojo</option>
                <option value="azul">Azul</option>
                <option value="verde">Verde</option>
                <option value="blanco">Blanco</option>
              </select>
            </div>
            <div class="col-sm-2">
              <button class="btn btn-sm btn-outline-secondary w-100" data-role="clear">Limpiar</button>
            </div>
          </div>
        </div>

        <div class="table-responsive">
          <table class="table align-middle table-bordered table-compact">
            <thead>
              <tr>
                <th>Nombre</th><th>Usuario</th><th>Contraseña</th><th>URL</th>
                <th>Inicio</th><th>Fin</th><th>Días</th><th>Cliente</th>
                <th>Precio</th><th>Combo</th><th>Estado</th><th>Entrega</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
                
                <?php
// === ORDENAR PERFILES: grupo por usuario; grupo más reciente arriba,
//     y dentro del grupo: padre primero (id más chico), luego hijos por id DESC ===
$__grupos = [];
foreach ($iptv_perfiles as $r) {
  $u = strtolower(trim((string)($r['usuario'] ?? '')));
  if ($u === '') $u = '__id_' . ($r['id'] ?? uniqid()); // evita mezclar "sin usuario"
  $__grupos[$u][] = $r;
}

// key por grupo = "más reciente": created_at si existe; si no, id (más alto)
$__grpKeys = [];
foreach ($__grupos as $u => &$items) {
  $maxKey = 0;
  foreach ($items as $it) {
    $ts = 0;
    if (!empty($it['created_at'])) { $ts = strtotime((string)$it['created_at']) ?: 0; }
    if (!$ts) { $ts = (int)($it['id'] ?? 0); }
    if ($ts > $maxKey) $maxKey = $ts;
  }
  $__grpKeys[$u] = $maxKey;

  // En cada grupo: padre primero (id más chico), luego hijos por id DESC
  usort($items, function($a, $b) use ($u, $IPTV_HEADS_PERFILES) {
    $headId  = (int)($IPTV_HEADS_PERFILES[$u] ?? 0);
    $ida     = (int)($a['id'] ?? 0);
    $idb     = (int)($b['id'] ?? 0);
    $aIsHead = ($ida === $headId);
    $bIsHead = ($idb === $headId);
    if ($aIsHead && !$bIsHead) return -1;
    if (!$aIsHead && $bIsHead) return 1;
    return $idb <=> $ida; // resto por "nuevo primero"
  });
}
unset($items);

// Grupos: más reciente arriba
uksort($__grupos, function($u1, $u2) use ($__grpKeys) {
  return ($__grpKeys[$u2] ?? 0) <=> ($__grpKeys[$u1] ?? 0);
});

// Aplanar para el render
$iptv_perfiles_sorted = [];
foreach ($__grupos as $items) {
  foreach ($items as $it) { $iptv_perfiles_sorted[] = $it; }
}
?>
<?php $___lastDayKeyP = null; ?>
<?php
// Filtrar PERFILES y CUENTAS solo para el servicio_id actual
$currId = isset($servicio_id) ? (int)$servicio_id : 0;


$iptv_cuentas_filtradas = [];







if ($currId > 0) {
    if (!empty($iptv_perfiles_sorted) && is_array($iptv_perfiles_sorted)) {
        $iptv_perfiles_sorted = array_values(array_filter(
            $iptv_perfiles_sorted,
            function ($row) use ($currId) {
                return (int)($row['servicio_id'] ?? 0) === $currId;
            }
        ));
    }

    if (!empty($iptv_cuentas_sorted) && is_array($iptv_cuentas_sorted)) {
        $iptv_cuentas_sorted = array_values(array_filter(
            $iptv_cuentas_sorted,
            function ($row) use ($currId) {
                return (int)($row['servicio_id'] ?? 0) === $currId;
            }
        ));
    }
}
?>

            <?php if (empty($iptv_perfiles_sorted)): ?>
            <tr>
              <td colspan="13" class="text-center text-muted py-4">
                No hay perfiles IPTV para este servicio.
              </td>
            </tr>
            <?php else: ?>
            <?php
              foreach ($iptv_perfiles_sorted as $p):
                $id            = (int)($p['id'] ?? 0);
                $nombre        = trim((string)($p['nombre'] ?? ''));
                $usuario       = (string)($p['usuario'] ?? '');
                $password      = (string)($p['password_plain'] ?? '');
                $url_raw       = trim((string)($p['url'] ?? ''));
                $wa_raw        = (string)($p['whatsapp'] ?? '');
                $fecha_inicio  = (string)($p['fecha_inicio'] ?? '');
                $fecha_fin     = (string)($p['fecha_fin'] ?? '');
                $soles         = (string)($p['soles'] ?? '0.00');
                $estado        = (string)($p['estado'] ?? 'activo');
                $combo         = (int)($p['combo'] ?? 0);

                $url_href = $url_raw && !preg_match('#^https?://#i', $url_raw) ? ('https://' . $url_raw) : $url_raw;
                $nombre_ui = ($nombre !== '' ? $nombre : '(sin nombre)');

                $fi_ok  = ($fecha_inicio && $fecha_inicio !== '0000-00-00');
                $ff_ok  = ($fecha_fin    && $fecha_fin    !== '0000-00-00');
                $fi_fmt = $fi_ok ? date('d/m/y', strtotime($fecha_inicio)) : '';
                $ff_fmt = $ff_ok ? date('d/m/y', strtotime($fecha_fin))    : '';

                $dias = $ff_ok ? (int) floor((strtotime($fecha_fin) - strtotime($hoy)) / 86400) : null;
                $estadoReal = ($ff_ok && $dias < 0) ? 'moroso' : $estado;
                $badgeClass = estado_badge_class($estadoReal);
                $comboLabel = $combo === 1 ? 'Sí' : 'No';

                $__wa = preg_replace('/\s+/', '', $wa_raw);
                $__wa = preg_replace('/(?!^)\+/', '', $__wa);
                $__wa = preg_replace('/[^\d\+]/', '', $__wa);
                if ($__wa === '+') $__wa = '';

                $wa_num          = ltrim($__wa, '+');
                $tg_phone        = ($__wa !== '' && $__wa[0] === '+') ? $__wa : ($__wa !== '' ? ('+' . $__wa) : '');
                $cliente_display = format_cliente_num($__wa, $wa_num);

                $__color      = isset($p['color']) ? strtolower((string)$p['color']) : '';
                $__allowedCol = ['rojo','azul','verde','blanco'];
                $__color      = in_array($__color, $__allowedCol, true) ? $__color : '';
                $__colorClass = $__color ? ' row-color-'.htmlspecialchars($__color, ENT_QUOTES, 'UTF-8') : '';

                // --- padre/hijo por correo (padre = id más antiguo para ese correo)
                $u_key       = strtolower(trim($usuario));
                $isHead      = ($id === ($IPTV_HEADS_PERFILES[$u_key] ?? -1));
                $showCorreo  = $isHead;

                // Payload para modal EDITAR (incluye tipo)
                $rowIptv = [
                  'id'             => $id,
                  'nombre'         => $nombre,
                  'usuario'        => $usuario,
                  'password_plain' => $password,
                  'url'            => (string)$p['url'],
                  'whatsapp'       => $wa_raw,
                  'fecha_inicio'   => $fecha_inicio,
                  'fecha_fin'      => $fecha_fin,
                  'soles'          => $soles,
                  'estado'         => $estado,
                  'combo'          => $combo,
                  'tipo'           => 'perfil',
                ];

                $lines = ['Le hacemos la entrega de su IPTV'];
                if ($nombre_ui !== '') { $lines[] = "Nombre: {$nombre_ui}"; }
                $lines[] = "Usuario: {$usuario}";
                $lines[] = "Contraseña: {$password}";
                if ($url_raw !== '') { $lines[] = "URL: {$url_raw}"; }
                $lines[] = "Nota: no compartir su acceso, por favor.";
                $iptv_msg = rawurlencode(implode("\n", $lines));
            ?>
            <?php
  // Para separador: sólo cuando es PADRE
  if ($isHead) {
    $created_ts = iptv_created_ts($p, $hoy);
    $dayKey     = date('Y-m-d', $created_ts);
    if ($dayKey !== $___lastDayKeyP) {
      $___lastDayKeyP = $dayKey;
      echo '<tr class="sep-fecha"><td colspan="13">'.htmlspecialchars(iptv_day_label($created_ts), ENT_QUOTES, 'UTF-8').'</td></tr>';
    }
  }
  
  $created_ts = iptv_created_ts($p, $hoy);
$dayLabel   = iptv_day_label($created_ts);
?>

            <tr
  class="<?= trim(($showCorreo ? 'js-parent-row cursor-pointer' : 'js-child-row') . $__colorClass) ?>"
  data-row-kind="<?= $showCorreo ? 'parent' : 'child' ?>"
  data-color="<?= $__color ?: '' ?>"
  data-estado="<?= htmlspecialchars($estadoReal, ENT_QUOTES) ?>"
  data-combo="<?= $combo === 1 ? '1' : '0' ?>"
  data-nombre="<?= htmlspecialchars($nombre_ui, ENT_QUOTES) ?>"
  data-usuario="<?= htmlspecialchars($usuario, ENT_QUOTES) ?>"
  data-url="<?= htmlspecialchars($url_raw, ENT_QUOTES) ?>"
>
              <td class="iptv-cell-perfil" data-id="<?= $id ?>" role="button" tabindex="0">
                <?= $showCorreo ? htmlspecialchars($nombre_ui) : '' ?>
              </td>
              <td class="correo-cell"><?= $showCorreo ? htmlspecialchars($usuario) : '' ?></td>
              
              
              
            
              <td>
  <?= htmlspecialchars($password, ENT_QUOTES, 'UTF-8') ?>
</td>

             <td class="text-truncate iptv-url-col">
  <?php if ($url_raw !== ''): ?>
    <a href="<?= htmlspecialchars($url_href, ENT_QUOTES, 'UTF-8') ?>" target="_blank" rel="noopener">
      <?= htmlspecialchars($url_raw, ENT_QUOTES, 'UTF-8') ?>
    </a>
  <?php else: ?>
    <span class="text-muted">—</span>
  <?php endif; ?>
</td>

              
              
              
              
              
              
              
              
              <td><?= $fi_fmt ?></td>
              <td><?= $ff_fmt ?></td>
              <td>
                <?php if ($dias === null): ?>
                <?php elseif ($dias < 0): ?>
                  <span class="text-danger"><?= $dias ?></span>
                <?php else: ?>
                  <?= $dias ?>
                <?php endif; ?>
              </td>
              <td class="cliente text-nowrap"><?= htmlspecialchars($cliente_display) ?></td>
              <td><?= $isHead ? '' : number_format((float)$soles, 2) ?></td>
              <td><?= $isHead ? '' : $comboLabel ?></td>
              <td>
                <?php if (!$isHead): ?>
                  <span class="badge <?= $badgeClass ?> text-capitalize"><?= htmlspecialchars($estadoReal) ?></span>
                <?php endif; ?>
              </td>
              <td class="whatsapp">
                <?php if (!$isHead && $wa_num !== ''): ?>
                  <a class="iptv-wa-link js-row-action"
                     data-scope="iptv" data-no-row-modal="1"
                     onclick="event.stopPropagation();"
                     href="https://wa.me/<?= htmlspecialchars($wa_num, ENT_QUOTES); ?>?text=<?= $iptv_msg; ?>"
                     target="_blank" rel="noopener"
                     aria-label="WhatsApp" title="WhatsApp">
                   <i class="bi bi-whatsapp" aria-hidden="true"></i>
                  </a>
                <?php endif; ?>
                <?php if (!$isHead && $tg_phone !== '' && $tg_phone !== '+'): ?>
                  <a class="ms-2 iptv-tg-link js-row-action"
                     data-scope="iptv" data-no-row-modal="1"
                     onclick="event.stopPropagation();"
                     href="https://t.me/share/url?url=&text=<?= $iptv_msg; ?>"
                     target="_blank" rel="noopener"
                     aria-label="Telegram" title="Telegram">
                   <i class="bi bi-telegram" aria-hidden="true"></i>
                  </a>
                <?php endif; ?>
              </td>
              <td class="text-nowrap">
                <button type="button"
                        class="btn btn-sm btn-primary btn-edit js-row-action"
                        data-bs-toggle="modal"
                        data-bs-target="#modalEditarIptv"
                        data-row='<?= row_json_attr($rowIptv) ?>'>Editar</button>

                <form method="post" class="d-inline js-delete-form" action="<?= htmlspecialchars($DELETE_URL ?: '#', ENT_QUOTES) ?>">
                  <input type="hidden" name="action" value="delete">
                  <input type="hidden" name="id" value="<?= $id ?>">
                  <input type="hidden" name="tipo" value="perfil">
                  <button type="submit" class="btn btn-sm btn-outline-danger js-row-action" <?= $DELETE_URL ? '' : 'disabled title="No hay endpoint de borrado"' ?>>Borrar</button>
                </form>
              </td>
            </tr>
            <?php endforeach; ?>
            <?php endif; ?>
            </tbody>
          </table>
        </div>
      </div>

      <!-- TAB: CUENTAS -->
      <div class="tab-pane fade container" id="iptv-cuentas" role="tabpanel" aria-labelledby="iptv-cuentas-tab" data-tipo="cuenta">
        <div class="d-flex justify-content-end mb-2">
          <button type="button" class="btn btn-sm btn-primary" id="btnAddCuenta"
                  data-bs-toggle="modal" data-bs-target="#modalAgregarCuenta">
            + Agregar Cuenta IPTV
          </button>
          <a href="export_iptv_items.php?servicio_id=<?= $servicio_id ?>&tipo=cuenta"
   class="btn btn-sm btn-outline-success mb-2">
  Exportar Excel (Cuentas)
</a>
        </div>

        <!-- Filtro local: CUENTAS -->
        <div class="iptv-local-filters mb-2" data-scope="cuentas">
          <div class="row g-2 align-items-center">
            <div class="col-sm-4">
              <input type="search" class="form-control form-control-sm" placeholder="Buscar nombre, correo o URL" data-role="search">
            </div>
            <div class="col-sm-2">
              <select class="form-select form-select-sm" data-role="estado">
                <option value="">Estado: Todos</option>
                <option value="activo">Activo</option>
                <option value="pendiente">Pendiente</option>
                <option value="moroso">Moroso</option>
              </select>
            </div>
            <div class="col-sm-2">
              <select class="form-select form-select-sm" data-role="combo">
                <option value="">Combo: Todos</option>
                <option value="1">Sí</option>
                <option value="0">No</option>
              </select>
            </div>
            <div class="col-sm-2">
              <select class="form-select form-select-sm" data-role="color">
                <option value="">Color: Todos</option>
                <option value="rojo">Rojo</option>
                <option value="azul">Azul</option>
                <option value="verde">Verde</option>
                <option value="blanco">Blanco</option>
              </select>
            </div>
            <div class="col-sm-2">
              <button class="btn btn-sm btn-outline-secondary w-100" data-role="clear">Limpiar</button>
            </div>
          </div>
        </div>

        <div class="table-responsive">
          <table class="table align-middle table-bordered table-compact">
            <thead>
              <tr>
                <th>Nombre</th><th>Correo</th><th>Contraseña</th><th>URL</th>
                <th>Inicio</th><th>Fin</th><th>Días</th><th>Cliente</th>
                <th>Precio</th><th>Combo</th><th>Estado</th><th>Entrega</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
                
            <?php
// === ORDENAR CUENTAS: grupo por usuario; grupo más reciente arriba,
//     y dentro del grupo: por id DESC (nuevo primero)
$__gruposC = [];
foreach ($iptv_cuentas as $r) {
  $u = strtolower(trim((string)($r['usuario'] ?? '')));
  if ($u === '') $u = '__id_' . ($r['id'] ?? uniqid()); // evita mezclar vacíos
  $__gruposC[$u][] = $r;
}

// clave de recencia por grupo: created_at (si hay), si no id
$__grpKeysC = [];
foreach ($__gruposC as $u => &$items) {
  $maxKey = 0;
  foreach ($items as $it) {
    $ts = 0;
    if (!empty($it['created_at'])) { $ts = strtotime((string)$it['created_at']) ?: 0; }
    if (!$ts) { $ts = (int)($it['id'] ?? 0); }
    if ($ts > $maxKey) $maxKey = $ts;
  }
  $__grpKeysC[$u] = $maxKey;

  // Dentro del grupo de CUENTAS: simplemente nuevo primero
  usort($items, function($a,$b){
    return (int)($b['id'] ?? 0) <=> (int)($a['id'] ?? 0);
  });
}
unset($items);

// Orden de grupos: más reciente arriba
uksort($__gruposC, function($u1,$u2) use ($__grpKeysC) {
  return ($__grpKeysC[$u2] ?? 0) <=> ($__grpKeysC[$u1] ?? 0);
});

// Aplanar para el render
$iptv_cuentas_sorted = [];
foreach ($__gruposC as $items) {
  foreach ($items as $it) { $iptv_cuentas_sorted[] = $it; }
}

// Filtrar CUENTAS solo para el servicio actual si $servicio_id está definido
if (isset($servicio_id) && (int)$servicio_id > 0) {
  $currId = (int)$servicio_id;
  $iptv_cuentas_sorted = array_values(array_filter(
    $iptv_cuentas_sorted,
    function($row) use ($currId) {
      return (int)($row['servicio_id'] ?? 0) === $currId;
    }
  ));
}
?>
<?php $___lastDayKeyC = null; ?>

            <?php if (empty($iptv_cuentas_sorted)): ?>
            <tr>
              <td colspan="13" class="text-center text-muted py-4">
                No hay cuentas IPTV para este servicio.
              </td>
            </tr>
            <?php else: ?>
            <?php
              foreach ($iptv_cuentas_sorted as $p):
                $id            = (int)($p['id'] ?? 0);
                $nombre        = trim((string)($p['nombre'] ?? ''));
                $usuario       = (string)($p['usuario'] ?? '');
                $password      = (string)($p['password_plain'] ?? '');
                $url_raw       = trim((string)($p['url'] ?? ''));
                $wa_raw        = (string)($p['whatsapp'] ?? '');
                $fecha_inicio  = (string)($p['fecha_inicio'] ?? '');
                $fecha_fin     = (string)($p['fecha_fin'] ?? '');
                $soles         = (string)($p['soles'] ?? '0.00');
                $estado        = (string)($p['estado'] ?? 'activo');
                $combo         = (int)($p['combo'] ?? 0);

                $url_href  = $url_raw && !preg_match('#^https?://#i', $url_raw) ? ('https://' . $url_raw) : $url_raw;
                $nombre_ui = ($nombre !== '' ? $nombre : '(sin nombre)');

                $fi_ok  = ($fecha_inicio && $fecha_inicio !== '0000-00-00');
                $ff_ok  = ($fecha_fin    && $fecha_fin    !== '0000-00-00');
                $fi_fmt = $fi_ok ? date('d/m/y', strtotime($fecha_inicio)) : '';
                $ff_fmt = $ff_ok ? date('d/m/y', strtotime($fecha_fin))    : '';

                $dias = $ff_ok ? (int) floor((strtotime($fecha_fin) - strtotime($hoy)) / 86400) : null;
                $estadoReal = ($ff_ok && $dias < 0) ? 'moroso' : $estado;
                $badgeClass = estado_badge_class($estadoReal);
                $comboLabel = $combo === 1 ? 'Sí' : 'No';

                $__wa = preg_replace('/\s+/', '', $wa_raw);
                $__wa = preg_replace('/(?!^)\+/', '', $__wa);
                $__wa = preg_replace('/[^\d\+]/', '', $__wa);
                if ($__wa === '+') $__wa = '';

                $wa_num          = ltrim($__wa, '+');
                $tg_phone        = ($__wa !== '' && $__wa[0] === '+') ? $__wa : ($__wa !== '' ? ('+' . $__wa) : '');
                $cliente_display = format_cliente_num($__wa, $wa_num);

                $__color      = isset($p['color']) ? strtolower((string)$p['color']) : '';
                $__allowedCol = ['rojo','azul','verde','blanco'];
                $__color      = in_array($__color, $__allowedCol, true) ? $__color : '';
                $__colorClass = $__color ? ' row-color-'.htmlspecialchars($__color, ENT_QUOTES, 'UTF-8') : '';

                $lines = ['Le hacemos la entrega de su IPTV'];
                if ($nombre_ui !== '') { $lines[] = "Nombre: {$nombre_ui}"; }
                $lines[] = "Usuario: {$usuario}";
                $lines[] = "Contraseña: {$password}";
                if ($url_raw !== '') { $lines[] = "URL: {$url_raw}"; }
                $lines[] = "Nota: no compartir su acceso, por favor.";
                $iptv_msg = rawurlencode(implode("\n", $lines));
            ?>
            <?php
  $created_ts = iptv_created_ts($p, $hoy);
  $dayKey     = date('Y-m-d', $created_ts);
  if ($dayKey !== $___lastDayKeyC) {
    $___lastDayKeyC = $dayKey;
    echo '<tr class="sep-fecha"><td colspan="13">'.htmlspecialchars(iptv_day_label($created_ts), ENT_QUOTES, 'UTF-8').'</td></tr>';
  }
  
  $created_ts = iptv_created_ts($p, $hoy);
$dayLabel   = iptv_day_label($created_ts);
?>

            <tr
  class="<?= trim($__colorClass) ?>"
  data-row-kind="single"
  data-color="<?= $__color ?: '' ?>"
  data-estado="<?= htmlspecialchars($estadoReal, ENT_QUOTES) ?>"
  data-combo="<?= $combo === 1 ? '1' : '0' ?>"
  data-nombre="<?= htmlspecialchars($nombre_ui, ENT_QUOTES) ?>"
  data-usuario="<?= htmlspecialchars($usuario, ENT_QUOTES) ?>"
  data-url="<?= htmlspecialchars($url_raw, ENT_QUOTES) ?>"
>
              <td class="iptv-cell-perfil" data-id="<?= $id ?>" role="button" tabindex="0">
                <?= htmlspecialchars($nombre_ui) ?>
              </td>
              <td class="correo-cell"><?= htmlspecialchars($usuario) ?></td>
              <td><?= htmlspecialchars($password) ?></td>
              <td class="text-truncate">
                <?php if ($url_raw !== ''): ?>
                  <a href="<?= htmlspecialchars($url_href, ENT_QUOTES) ?>" target="_blank" rel="noopener">
                    <?= htmlspecialchars($url_raw, ENT_QUOTES) ?>
                  </a>
                <?php endif; ?>
              </td>
              <td><?= $fi_fmt ?></td>
              <td><?= $ff_fmt ?></td>
              <td>
                <?php if ($dias === null): ?>
                <?php elseif ($dias < 0): ?>
                  <span class="text-danger"><?= $dias ?></span>
                <?php else: ?>
                  <?= $dias ?>
                <?php endif; ?>
              </td>
              <td class="cliente text-nowrap"><?= htmlspecialchars($cliente_display) ?></td>
              <td><?= number_format((float)$soles, 2) ?></td>
              <td><?= $comboLabel ?></td>
              <td><span class="badge <?= $badgeClass ?> text-capitalize"><?= htmlspecialchars($estadoReal) ?></span></td>
              <td class="whatsapp">
                <?php if ($wa_num !== ''): ?>
                  <a class="iptv-wa-link js-row-action"
                     data-scope="iptv" data-no-row-modal="1"
                     onclick="event.stopPropagation();"
                     href="https://wa.me/<?= htmlspecialchars($wa_num, ENT_QUOTES); ?>?text=<?= $iptv_msg; ?>"
                     target="_blank" rel="noopener"
                     aria-label="WhatsApp" title="WhatsApp">
                   <i class="bi bi-whatsapp" aria-hidden="true"></i>
                  </a>
                <?php endif; ?>
                <?php if ($tg_phone !== '' && $tg_phone !== '+'): ?>
                  <a class="ms-2 iptv-tg-link js-row-action"
                     data-scope="iptv" data-no-row-modal="1"
                     onclick="event.stopPropagation();"
                     href="https://t.me/share/url?url=&text=<?= $iptv_msg; ?>"
                     target="_blank" rel="noopener"
                     aria-label="Telegram" title="Telegram">
                    <i class="bi bi-telegram" aria-hidden="true"></i>
                  </a>
                <?php endif; ?>
              </td>
              <td class="text-nowrap">
                <button type="button"
                        class="btn btn-sm btn-primary btn-edit js-row-action"
                        data-bs-toggle="modal"
                        data-bs-target="#modalEditarIptv"
                        data-row='<?= row_json_attr([
                          "id"=>$id,"nombre"=>$nombre,"usuario"=>$usuario,"password_plain"=>$password,
                          "url"=>(string)$p["url"],"whatsapp"=>$wa_raw,"fecha_inicio"=>$fecha_inicio,
                          "fecha_fin"=>$fecha_fin,"soles"=>$soles,"estado"=>$estado,"combo"=>$combo,"tipo"=>"cuenta"
                        ]) ?>'>Editar</button>

                <form method="post" class="d-inline js-delete-form" action="<?= htmlspecialchars($DELETE_URL ?: '#', ENT_QUOTES) ?>">
                  <input type="hidden" name="action" value="delete">
                  <input type="hidden" name="id" value="<?= $id ?>">
                  <input type="hidden" name="tipo" value="cuenta">
                  <button type="submit" class="btn btn-sm btn-outline-danger js-row-action" <?= $DELETE_URL ? '' : 'disabled title="No hay endpoint de borrado"' ?>>Borrar</button>
                </form>
              </td>
            </tr>
            <?php endforeach; ?>
            <?php endif; ?>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  <?php else: ?>
    <!-- LEGACY: una sola tabla (se muestra como "Cuentas") -->
    <div class="table-responsive">
      <table class="table align-middle table-bordered table-compact">
        <thead>
          <tr>
            <th>Nombre</th><th>Correo</th><th>Contraseña</th><th>URL</th>
            <th>Inicio</th><th>Fin</th><th>Días</th><th>Cliente</th>
            <th>Precio</th><th>Combo</th><th>Estado</th><th>Entrega</th><th>Acciones</th>
          </tr>
        </thead>
        <tbody>
<?php
  foreach ($iptv_cuentas as $p):
    $id            = (int)($p['id'] ?? 0);
    $nombre        = trim((string)($p['nombre'] ?? ''));
    $usuario       = (string)($p['usuario'] ?? '');
    $password      = (string)($p['password_plain'] ?? '');
    $url_raw       = trim((string)($p['url'] ?? ''));
    $wa_raw        = (string)($p['whatsapp'] ?? '');
    $fecha_inicio  = (string)($p['fecha_inicio'] ?? '');
    $fecha_fin     = (string)($p['fecha_fin'] ?? '');
    $soles         = (string)($p['soles'] ?? '0.00');
    $estado        = (string)($p['estado'] ?? 'activo');
    $combo         = (int)($p['combo'] ?? 0);

    $url_href = $url_raw && !preg_match('#^https?://#i', $url_raw) ? ('https://' . $url_raw) : $url_raw;
    $nombre_ui = ($nombre !== '' ? $nombre : '(sin nombre)');

    $fi_ok  = ($fecha_inicio && $fecha_inicio !== '0000-00-00');
    $ff_ok  = ($fecha_fin    && $fecha_fin    !== '0000-00-00');
    $fi_fmt = $fi_ok ? date('d/m/y', strtotime($fecha_inicio)) : '';
    $ff_fmt = $ff_ok ? date('d/m/y', strtotime($fecha_fin))    : '';

    $dias = $ff_ok ? (int) floor((strtotime($fecha_fin) - strtotime($hoy)) / 86400) : null;
    $estadoReal = ($ff_ok && $dias < 0) ? 'moroso' : $estado;
    $badgeClass = estado_badge_class($estadoReal);
    $comboLabel = $combo === 1 ? 'Sí' : 'No';

    $__wa = preg_replace('/\s+/', '', $wa_raw);
    $__wa = preg_replace('/(?!^)\+/', '', $__wa);
    $__wa = preg_replace('/[^\d\+]/', '', $__wa);
    if ($__wa === '+') $__wa = '';

    $wa_num          = ltrim($__wa, '+');
    $tg_phone        = ($__wa !== '' && $__wa[0] === '+') ? $__wa : ($__wa !== '' ? ('+' . $__wa) : '');
    $cliente_display = format_cliente_num($__wa, $wa_num);

    $__color      = isset($p['color']) ? strtolower((string)$p['color']) : '';
    $__allowedCol = ['rojo','azul','verde','blanco'];
    $__color      = in_array($__color, $__allowedCol, true) ? $__color : '';
    $__colorClass = $__color ? ' row-color-'.htmlspecialchars($__color, ENT_QUOTES, 'UTF-8') : '';

    // --- padre/hijo por correo (legacy usa cuentas)
    $u_key       = strtolower(trim($usuario));
    $isHead      = ($id === ($IPTV_HEADS_CUENTAS[$u_key] ?? -1));
    $showCorreo  = $isHead;

    $rowIptv = [
      'id'             => $id,
      'nombre'         => $nombre,
      'usuario'        => $usuario,
      'password_plain' => $password,
      'url'            => (string)$p['url'],
      'whatsapp'       => $wa_raw,
      'fecha_inicio'   => $fecha_inicio,
      'fecha_fin'      => $fecha_fin,
      'soles'          => $soles,
      'estado'         => $estado,
      'combo'          => $combo,
      'tipo'           => 'cuenta',
    ];

    $lines = ['Le hacemos la entrega de su IPTV'];
    if ($nombre_ui !== '') { $lines[] = "Nombre: {$nombre_ui}"; }
    $lines[] = "Usuario: {$usuario}";
    $lines[] = "Contraseña: {$password}";
    if ($url_raw !== '') { $lines[] = "URL: {$url_raw}"; }
    $lines[] = "Nota: no compartir su acceso, por favor.";
    $iptv_msg = rawurlencode(implode("\n", $lines));
?>
<tr class="<?= trim(($showCorreo ? 'js-parent-row cursor-pointer' : 'js-child-row') . $__colorClass) ?>">

  <td class="iptv-cell-perfil" data-id="<?= $id ?>" role="button" tabindex="0">
    <?= $showCorreo ? htmlspecialchars($nombre_ui) : '' ?>
  </td>
  <td class="correo-cell"><?= $showCorreo ? htmlspecialchars($usuario) : '' ?></td>
  
  
  
  
  <td>
  <?= htmlspecialchars($password, ENT_QUOTES, 'UTF-8') ?>
</td>

<td class="text-truncate">
  <?php if ($url_raw !== ''): ?>
    <a href="<?= htmlspecialchars($url_href, ENT_QUOTES, 'UTF-8') ?>" target="_blank" rel="noopener">
      <?= htmlspecialchars($url_raw, ENT_QUOTES, 'UTF-8') ?>
    </a>
  <?php else: ?>
    <span class="text-muted">—</span>
  <?php endif; ?>
</td>

 
  
  
  
  
  
  <td><?= $fi_fmt ?></td>
  <td><?= $ff_fmt ?></td>
  <td>
    <?php if ($dias === null): ?>
    <?php elseif ($dias < 0): ?>
      <span class="text-danger"><?= $dias ?></span>
    <?php else: ?>
      <?= $dias ?>
    <?php endif; ?>
  </td>
  <td class="cliente text-nowrap"><?= htmlspecialchars($cliente_display) ?></td>
  <td><?= $isHead ? '' : number_format((float)$soles, 2) ?></td>
  <td><?= $isHead ? '' : $comboLabel ?></td>
  <td>
    <?php if (!$isHead): ?>
      <span class="badge <?= $badgeClass ?> text-capitalize"><?= htmlspecialchars($estadoReal) ?></span>
    <?php endif; ?>
  </td>
  <td class="whatsapp">
    <?php if (!$isHead && $wa_num !== ''): ?>
      <a class="iptv-wa-link js-row-action"
         data-scope="iptv" data-no-row-modal="1"
         onclick="event.stopPropagation();"
         href="https://wa.me/<?= htmlspecialchars($wa_num, ENT_QUOTES); ?>?text=<?= $iptv_msg; ?>"
         target="_blank" rel="noopener"
         aria-label="WhatsApp" title="WhatsApp">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
             fill="currentColor" viewBox="0 0 16 16" aria-hidden="true"><path d="M13.601 2.326A7.854 7.854 0 0 0 8.03.002C3.6.002.008 3.594.008 8.023c0 1.414.37 2.792 1.074 4.005L.01 16l3.996-1.05a7.96 7.96 0  0 0 4.024 1.073h.003c4.43 0 8.022-3.592 8.022-8.021 0-2.144-.835-4.162-2.354-5.676zM8.033 14.5h-.002a6.48 6.48 0 0 1-3.302-.905l-.237-.141-2.371.623.633-2.31-.154-.237A6.47 6.47 0 0 1 1.53 8.02c0-3.575 2.91-6.485 6.5-6.485 1.738 0 3.37.676 4.598 1.901a6.46 6.46 0 0 1 1.907 4.585c0 3.575-2.91 6.48-6.5 6.48zm3.69-4.844c-.202-.1-1.194-.59-1.378-.657-.184-.068-.318-.101-.452.1-.134.201-.518.657-.635.792-.117.134-.234.151-.436.05-.202-.1-.853-.314-1.625-1.002-.6-.533-1.005-1.19-1.123-1.392-.117-.201-.013-.31.088-.41.09-.089.202-.234.302-.351.101-.117.134-.201.202-.335.067-.134.034-.251-.017-.351-.05-.1-.452-1.09-.619-1.49-.163-.392-.329-.339-.452-.345l-.386-.007c-.118 0-.31.045-.471.224-.16.177-.618.604-.618 1.475s.633 1.71.72 1.83c.084.118 1.245 1.9 3.016 2.665.422.182.75.29 1.006.371.422.134.807.115 1.11.069.339-.05 1.194-.488 1.363-.96.168-.472.168-.877.118-.964-.05-.084-.184-.134-.386-.234z"/></svg>
      </a>
    <?php endif; ?>
    <?php if (!$isHead && $tg_phone !== '' && $tg_phone !== '+'): ?>
      <a class="ms-2 iptv-tg-link js-row-action"
         data-scope="iptv" data-no-row-modal="1"
         onclick="event.stopPropagation();"
         href="https://t.me/share/url?url=&text=<?= $iptv_msg; ?>"
         target="_blank" rel="noopener"
         aria-label="Telegram" title="Telegram">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
             fill="currentColor" viewBox="0 0 16 16" aria-hidden="true"><path d="M15.953 1.737a1.01 1.01 0 0 0-1.04-.2L1.253 6.78c-.86.33-.854 1.54.01 1.86l3.17 1.18 1.24 3.98c.24.77 1.2.99 1.76.41l2.12-2.18 3.54 2.62c.73.54 1.79.14 1.98-.75l2.34-11.02a1.02 1.02 0 0 0-.46-1.18z"/></svg>
      </a>
    <?php endif; ?>
  </td>
  <td class="text-nowrap">
    <button type="button"
            class="btn btn-sm btn-primary btn-edit js-row-action"
            data-bs-toggle="modal"
            data-bs-target="#modalEditarIptv"
            data-row='<?= row_json_attr($rowIptv) ?>'>Editar</button>

    <form method="post" class="d-inline js-delete-form" action="<?= htmlspecialchars($DELETE_URL ?: '#', ENT_QUOTES) ?>">
      <input type="hidden" name="action" value="delete">
      <input type="hidden" name="id" value="<?= $id ?>">
      <input type="hidden" name="tipo" value="cuenta">
      <button type="submit" class="btn btn-sm btn-outline-danger js-row-action" <?= $DELETE_URL ? '' : 'disabled title="No hay endpoint de borrado"' ?>>Borrar</button>
    </form>
  </td>
</tr>
<?php endforeach; ?>
        </tbody>
      </table>
    </div>
  <?php endif; ?>
</div>

<!-- ===================== MODAL EDITAR ===================== -->
<div class="modal fade" id="modalEditarIptv" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered">
    <form class="modal-content" action="<?= htmlspecialchars($SAVE_URL, ENT_QUOTES) ?>" method="post" id="formEditarIptv">
      <div class="modal-header">
        <h5 class="modal-title" id="editTitle">Editar IPTV</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
      </div>

      <div class="modal-body">
  <input type="hidden" name="id" id="iptv_id" value="0">
  <input type="hidden" name="tipo" id="iptv_tipo" value="cuenta">

  <!-- NUEVO: el servicio al que pertenece esta cuenta/perfil -->
  <input type="hidden"
         name="servicio_id"
         id="iptv_servicio_id"
         value="<?= (int)$servicio_id ?>">


        <div class="mb-2">
          <label class="form-label form-label-sm">Nombre</label>
          <input type="text" class="form-control form-control-sm" name="nombre" id="iptv_nombre" autocomplete="off">
        </div>
        <div class="mb-2">
          <label class="form-label form-label-sm">Usuario (correo/alias)</label>
          <input type="text" class="form-control form-control-sm" name="usuario" id="iptv_usuario" autocomplete="off" required>
        </div>
        <div class="mb-2">
          <label class="form-label form-label-sm">Contraseña</label>
          <input type="text" class="form-control form-control-sm" name="password_plain" id="iptv_password" autocomplete="off" required>
        </div>
        <div class="mb-2">
          <label class="form-label form-label-sm">URL</label>
          <input type="text" class="form-control form-control-sm" name="url" id="iptv_url" placeholder="https://..." autocomplete="off" required>
        </div>

        <div class="mb-2">
          <label class="form-label form-label-sm d-block">WhatsApp</label>
          <div class="input-group input-group-sm" style="max-width: 320px;">
            <input type="text" class="form-control" name="wa_cc" id="iptv_wa_cc" placeholder="+51" inputmode="numeric" pattern="[0-9+]{1,5}" style="max-width: 80px;">
            <span class="input-group-text">—</span>
            <input type="text" class="form-control" name="wa_local" id="iptv_wa_local" placeholder="977 948 954" inputmode="numeric" pattern="[0-9 ]{6,20}" maxlength="20">
          </div>
          <div class="form-text">Escribe el número local en grupos (3-3-3). El prefijo es opcional.</div>
        </div>

        <div class="row g-2">
          <div class="col-6">
            <label class="form-label form-label-sm">Inicio</label>
            <input type="date" class="form-control form-control-sm" name="fecha_inicio" id="iptv_fi">
          </div>
          <div class="col-6">
            <label class="form-label form-label-sm">Fin</label>
            <input type="date" class="form-control form-control-sm" name="fecha_fin" id="iptv_ff">
          </div>
        </div>

        <div class="row g-2 mt-1">
          <div class="col-4">
            <label class="form-label form-label-sm">Precio (S/)</label>
            <input type="text" class="form-control form-control-sm" name="soles" id="iptv_soles" placeholder="0.00">
          </div>
          <div class="col-4">
            <label class="form-label form-label-sm">Estado</label>
            <select class="form-select form-select-sm" name="estado" id="iptv_estado">
              <option value="activo">Activo</option>
              <option value="pendiente">Pendiente</option>
            </select>
          </div>
        </div>

        <div class="form-check mt-2">
          <input class="form-check-input" type="checkbox" value="1" id="iptv_combo" name="combo">
          <label class="form-check-label" for="iptv_combo">Combo</label>
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn btn-sm btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
        <button type="submit" class="btn btn-sm btn-primary">Guardar</button>
      </div>
    </form>
  </div>
</div>

<!-- ===================== MODAL AGREGAR PERFIL ===================== -->
<div class="modal fade" id="modalAgregarPerfil" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered">
    <form class="modal-content" action="<?= htmlspecialchars($SAVE_URL, ENT_QUOTES) ?>" method="post" id="formAgregarPerfil">
      <div class="modal-header">
        <h5 class="modal-title">Agregar Perfil IPTV</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
      </div>
      <div class="modal-body">
        <input type="hidden" name="id" value="0">
        <input type="hidden" name="tipo" value="perfil">
        <input type="hidden" name="servicio_id" value="<?= (int)$servicio_id ?>">
           

        <div class="mb-2">
          <label class="form-label form-label-sm">Nombre</label>
          <input type="text" class="form-control form-control-sm" name="nombre" autocomplete="off">
        </div>
        <div class="mb-2">
          <label class="form-label form-label-sm">Usuario (correo/alias)</label>
          <input type="text" class="form-control form-control-sm" name="usuario" autocomplete="off" required>
        </div>
        <div class="mb-2">
          <label class="form-label form-label-sm">Contraseña</label>
          <input type="text" class="form-control form-control-sm" name="password_plain" autocomplete="off" required>
        </div>
        <div class="mb-2">
          <label class="form-label form-label-sm">URL</label>
          <input type="text" class="form-control form-control-sm" name="url" placeholder="https://..." autocomplete="off" required>
        </div>

        <div class="mb-2">
          <label class="form-label form-label-sm d-block">WhatsApp</label>
          <div class="input-group input-group-sm" style="max-width: 320px;">
            <input type="text" class="form-control" name="wa_cc" placeholder="+51" inputmode="numeric" pattern="[0-9+]{1,5}" style="max-width: 80px;">
            <span class="input-group-text">—</span>
            <input type="text" class="form-control" name="wa_local" placeholder="977 948 954" inputmode="numeric" pattern="[0-9 ]{6,20}" maxlength="20">
          </div>
        </div>

        <div class="row g-2">
          <div class="col-6">
            <label class="form-label form-label-sm">Inicio</label>
            <input type="date" class="form-control form-control-sm" name="fecha_inicio" value="<?= date('Y-m-d') ?>">
          </div>
          <div class="col-6">
            <label class="form-label form-label-sm">Fin</label>
            <input type="date" class="form-control form-control-sm" name="fecha_fin" value="<?= date('Y-m-d', strtotime('+30 days')) ?>">
          </div>
        </div>

        <div class="row g-2 mt-1">
          <div class="col-4">
            <label class="form-label form-label-sm">Precio (S/)</label>
            <input type="text" class="form-control form-control-sm" name="soles" placeholder="0.00" value="0.00">
          </div>
          <div class="col-4">
            <label class="form-label form-label-sm">Estado</label>
            <select class="form-select form-select-sm" name="estado">
              <option value="activo" selected>Activo</option>
              <option value="pendiente">Pendiente</option>
            </select>
          </div>
        </div>

        <div class="form-check mt-2">
          <input class="form-check-input" type="checkbox" value="1" id="perfil_combo" name="combo">
          <label class="form-check-label" for="perfil_combo">Combo</label>
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn btn-sm btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
        <button type="submit" class="btn btn-sm btn-primary">Guardar</button>
      </div>
    </form>
  </div>
</div>

<!-- ===================== MODAL AGREGAR CUENTA ===================== -->
<div class="modal fade" id="modalAgregarCuenta" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered">
    <form class="modal-content" action="<?= htmlspecialchars($SAVE_URL, ENT_QUOTES) ?>" method="post" id="formAgregarCuenta">
      <div class="modal-header">
        <h5 class="modal-title">Agregar Cuenta IPTV</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
      </div>
      <div class="modal-body">
        <input type="hidden" name="id" value="0">
        <input type="hidden" name="tipo" value="cuenta">
         <input type="hidden" name="servicio_id" value="<?= (int)$servicio_id ?>">

        <div class="mb-2">
          <label class="form-label form-label-sm">Nombre</label>
          <input type="text" class="form-control form-control-sm" name="nombre" autocomplete="off">
        </div>
        <div class="mb-2">
          <label class="form-label form-label-sm">Usuario (correo/alias)</label>
          <input type="text" class="form-control form-control-sm" name="usuario" autocomplete="off" required>
        </div>
        <div class="mb-2">
          <label class="form-label form-label-sm">Contraseña</label>
          <input type="text" class="form-control form-control-sm" name="password_plain" autocomplete="off" required>
        </div>
        <div class="mb-2">
          <label class="form-label form-label-sm">URL</label>
          <input type="text" class="form-control form-control-sm" name="url" placeholder="https://..." autocomplete="off" required>
        </div>

        <div class="mb-2">
          <label class="form-label form-label-sm d-block">WhatsApp</label>
          <div class="input-group input-group-sm" style="max-width: 320px;">
            <input type="text" class="form-control" name="wa_cc" placeholder="+51" inputmode="numeric" pattern="[0-9+]{1,5}" style="max-width: 80px;">
            <span class="input-group-text">—</span>
            <input type="text" class="form-control" name="wa_local" placeholder="977 948 954" inputmode="numeric" pattern="[0-9 ]{6,20}" maxlength="20">
          </div>
        </div>

        <div class="row g-2">
          <div class="col-6">
            <label class="form-label form-label-sm">Inicio</label>
            <input type="date" class="form-control form-control-sm" name="fecha_inicio" value="<?= date('Y-m-d') ?>">
          </div>
          <div class="col-6">
            <label class="form-label form-label-sm">Fin</label>
            <input type="date" class="form-control form-control-sm" name="fecha_fin" value="<?= date('Y-m-d', strtotime('+30 days')) ?>">
          </div>
        </div>

        <div class="row g-2 mt-1">
          <div class="col-4">
            <label class="form-label form-label-sm">Precio (S/)</label>
            <input type="text" class="form-control form-control-sm" name="soles" placeholder="0.00" value="0.00">
          </div>
          <div class="col-4">
            <label class="form-label form-label-sm">Estado</label>
            <select class="form-select form-select-sm" name="estado">
              <option value="activo" selected>Activo</option>
              <option value="pendiente">Pendiente</option>
            </select>
          </div>
        </div>

        <div class="form-check mt-2">
          <input class="form-check-input" type="checkbox" value="1" id="cuenta_combo" name="combo">
          <label class="form-check-label" for="cuenta_combo">Combo</label>
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn btn-sm btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
        <button type="submit" class="btn btn-sm btn-primary">Guardar</button>
      </div>
    </form>
  </div>
</div>

<!-- ===================== MODAL AGREGAR PERFIL A CORREO (HIJO) ===================== -->
<div class="modal fade" id="modalAgregarPerfilHijo" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered">
    <form class="modal-content" action="<?= htmlspecialchars($SAVE_URL, ENT_QUOTES) ?>" method="post" id="formAgregarPerfilHijo">
      <div class="modal-header">
        <h5 class="modal-title">Agregar perfil al correo: <span id="correoHijoTitle"></span></h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
      </div>

      <div class="modal-body">
        <input type="hidden" name="id" value="0">
        <input type="hidden" name="tipo" value="perfil">
        <input type="hidden" name="usuario" id="iptv_hijo_usuario">
         <input type="hidden" name="servicio_id" value="<?= (int)$servicio_id ?>">
         <input type="hidden" name="parent_id" id="iptv_parent_id" value="0">
        <div class="mb-2">
          <label class="form-label form-label-sm">Correo</label>
          <input type="text" class="form-control form-control-sm" id="iptv_hijo_usuario_view" readonly>
          <div class="form-text">Este correo se hereda del registro padre y no se puede modificar.</div>
        </div>

        <div class="mb-2">
          <label class="form-label form-label-sm">Nombre (heredado)</label>
          <input type="text" class="form-control form-control-sm" name="nombre" id="iptv_hijo_nombre" readonly>
          <div class="form-text">Si el padre no tiene nombre, este campo quedará en blanco.</div>
        </div>

        <div class="mb-2">
          <label class="form-label form-label-sm">Contraseña (heredada)</label>
          <input type="text" class="form-control form-control-sm" name="password_plain" id="iptv_hijo_password" readonly>
          <div class="form-text">Se copia del padre para visualizarla, pero no se edita aquí.</div>
        </div>

        <div class="mb-2">
          <label class="form-label form-label-sm">URL (heredada)</label>
          <input type="text" class="form-control form-control-sm" name="url" id="iptv_hijo_url" readonly>
          <div class="form-text">Se copia del padre para visualizarla, pero no se edita aquí.</div>
        </div>

        <div class="mb-2">
          <label class="form-label form-label-sm d-block">WhatsApp</label>
          <div class="input-group input-group-sm" style="max-width: 320px;">
            <input type="text" class="form-control" name="wa_cc" placeholder="+51" inputmode="numeric" pattern="[0-9+]{1,5}" style="max-width: 80px;">
            <span class="input-group-text">—</span>
            <input type="text" class="form-control" name="wa_local" placeholder="977 948 954" inputmode="numeric" pattern="[0-9 ]{6,20}" maxlength="20">
          </div>
        </div>

        <div class="row g-2">
          <div class="col-6">
            <label class="form-label form-label-sm">Inicio</label>
            <input type="date" class="form-control form-control-sm" name="fecha_inicio">
          </div>
          <div class="col-6">
            <label class="form-label form-label-sm">Fin</label>
            <input type="date" class="form-control form-control-sm" name="fecha_fin">
          </div>
        </div>

        <div class="row g-2 mt-1">
          <div class="col-4">
            <label class="form-label form-label-sm">Precio (S/)</label>
            <input type="text" class="form-control form-control-sm" name="soles" placeholder="0.00" value="0.00">
          </div>
          <div class="col-4">
            <label class="form-label form-label-sm">Estado</label>
            <select class="form-select form-select-sm" name="estado">
              <option value="activo" selected>Activo</option>
              <option value="pendiente">Pendiente</option>
            </select>
          </div>
        </div>

        <div class="form-check mt-2">
          <input class="form-check-input" type="checkbox" value="1" id="perfil_hijo_combo" name="combo">
          <label class="form-check-label" for="perfil_hijo_combo">Combo</label>
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn btn-sm btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
        <button type="submit" class="btn btn-sm btn-primary">Guardar</button>
      </div>
    </form>
  </div>
</div>

<!-- ===================== MODAL CAMBIAR COLOR ===================== -->
<div class="modal fade" id="modalCambiarColor" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered">
    <form class="modal-content" id="formCambiarColor">
      <div class="modal-header">
        <h5 class="modal-title">Cambiar color</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
      </div>
      <div class="modal-body">
        <input type="hidden" name="id" id="cc_id" value="0">
        <input type="hidden" name="tipo" id="cc_tipo" value="">
        <div class="mb-2">
          <label class="form-label form-label-sm">Color de la fila</label>
          <select class="form-select form-select-sm" name="color" id="cc_color" required>
            <option value="">Sin color</option>
            <option value="blanco">Blanco</option>
            <option value="rojo">Rojo</option>
            <option value="azul">Azul</option>
            <option value="verde">Verde</option>
          </select>
          <div class="form-text">Se aplicará al grupo (fila actual).</div>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-sm btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
        <button type="submit" class="btn btn-sm btn-primary">Guardar</button>
      </div>
    </form>
  </div>
</div>

<!-- ===================== /MODALES ===================== -->

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
<script>
// Endpoints expuestos a JS (rutas relativas desde /public/)
window.IPTV_ENDPOINTS = {
  save: 'ajax/iptv_save.php',
  del : 'ajax/iptv_delete.php',
  color: 'ajax/iptv_color.php'
};
</script>


<script>
// ----------- ÚNICO BLOQUE JS (CRUD + acciones) -----------
(function () {
    
    return; 
    
  const EP = window.IPTV_ENDPOINTS || {};
  const SAVE_URL   = EP.save  || '';
  const DELETE_URL = EP.del   || '';
  
    // 🔒 Si no estamos en una página IPTV clásica,
  // salimos y NO enganchamos nada (dashboard, etc.)
  const hasIptvClassicForms =
    document.getElementById('formAgregarPerfil')     ||
    document.getElementById('formAgregarPerfilHijo') ||
    document.getElementById('formAgregarCuenta')     ||
    document.getElementById('formEditarIptv');

  if (!hasIptvClassicForms) {
    // No hay formularios de IPTV con usuario/contraseña/URL,
    // así que NO aplicamos este JS aquí (evitamos el Swal de "Usuario, contraseña y URL...")
    return;
  }


  function swalOK(t,m){return window.Swal?.fire?Swal.fire({icon:'success',title:t,text:m}):(alert(t+'\n'+m),Promise.resolve());}
  function swalWarn(t,m){return window.Swal?.fire?Swal.fire({icon:'warning',title:t,text:m}):(alert(t+'\n'+m),Promise.resolve());}
  function swalErr(t,m){return window.Swal?.fire?Swal.fire({icon:'error',title:t,text:m}):(alert(t+'\n'+m),Promise.resolve());}

  document.addEventListener('click', function (ev) {
    const btn = ev.target.closest('.btn-edit[data-bs-target="#modalEditarIptv"]');
    if (!btn) return;
    let data = {};
    try { data = JSON.parse(btn.getAttribute('data-row') || '{}'); } catch(e){}
    const $ = (id)=> document.getElementById(id);
    const set = (id,v)=>{ const el=$(id); if(el) el.value = (v ?? ''); };

    set('iptv_id', data.id || 0);
    set('iptv_tipo', (data.tipo === 'perfil') ? 'perfil' : 'cuenta');
    set('iptv_nombre', data.nombre ?? '');
    set('iptv_usuario', data.usuario ?? '');
    set('iptv_password', data.password_plain ?? '');
    set('iptv_url', data.url ?? '');
    set('iptv_soles', data.soles ?? '0.00');
    set('iptv_estado', (data.estado === 'pendiente') ? 'pendiente' : 'activo');
    const combo = document.getElementById('iptv_combo'); if (combo) combo.checked = !!(Number(data.combo ?? 0) === 1);

    const fi = (data.fecha_inicio && data.fecha_inicio !== '0000-00-00') ? data.fecha_inicio : '';
    const ff = (data.fecha_fin    && data.fecha_fin    !== '0000-00-00') ? data.fecha_fin    : '';
    set('iptv_fi', fi); set('iptv_ff', ff);

    const raw = (data.whatsapp ?? '').toString().trim();
    let digits = raw.replace(/\s+/g,'').replace(/(?!^)\+/g,'').replace(/[^\d\+]/g,''); if (digits === '+') digits = '';
    let cc = '', local = ''; const justNums = digits.replace(/\D/g, '');
    if (justNums.length > 9) { cc = justNums.slice(0, justNums.length - 9); local = justNums.slice(-9); }
    else { local = justNums; }
    set('iptv_wa_cc', cc ? ('+'+cc) : '');
    set('iptv_wa_local', local ? local.replace(/(\d{3})(?=\d)/g,'$1 ').trim() : '');

    const title = document.getElementById('editTitle');
    if (title) title.textContent = 'Editar ' + (data.tipo === 'perfil' ? 'Perfil' : 'Cuenta') + ' IPTV';
  });

  
  
  
  
  
  
 
async function saveForm(form, override = {}) {
  if (!SAVE_URL) {
    await swalErr('Config', 'SAVE_URL no está configurado');
    return;
  }
  if (form.dataset.sending === '1') return;

  // 🔐 FORZAR servicio_id DESDE LA URL (con fallback a PHP)
  (function ensureServicioId() {
    // Si ya está seteado y es >0, no tocamos
    if (window.IPTV_SERVICIO_ID && window.IPTV_SERVICIO_ID > 0) return;

    let fromUrl = 0;
    try {
      const qs = new URLSearchParams(window.location.search || '');
      fromUrl = Number(qs.get('servicio_id') || qs.get('id') || 0) || 0;
    } catch (_) {}

    // Fallback a lo que venga de PHP por si acaso
    const fromPhp = Number(<?= (int)$servicio_id ?>) || 0;

    window.IPTV_SERVICIO_ID = fromUrl || fromPhp || 0;
  })();

  const q = (n) => form.querySelector(`[name="${n}"]`);
  const v = (n) => (q(n)?.value || '').trim();
  const c = (n) => !!q(n)?.checked;

  const id = Number(v('id') || 0);
  const allowBlankCore  = !!override.allowBlankCore;
  const cleanOverride   = { ...override };
  delete cleanOverride.allowBlankCore;

  const payload = {
    action: id > 0 ? 'update' : 'create',
    id,
    tipo: (v('tipo') === 'perfil') ? 'perfil' : 'cuenta',
    nombre: v('nombre'),
    usuario: v('usuario'),
    password_plain: v('password_plain'),
    url: v('url'),
    wa_cc: v('wa_cc'),
    wa_local: v('wa_local'),
    fecha_inicio: v('fecha_inicio'),
    fecha_fin: v('fecha_fin'),
    soles: v('soles') || '0.00',
    estado: (v('estado') === 'pendiente') ? 'pendiente' : 'activo',
    combo: c('combo') ? 1 : 0,
    servicio_id: Number(v('servicio_id') || window.IPTV_SERVICIO_ID || 0),
    parent_id: Number(v('parent_id') || 0),
    ...cleanOverride
  };

  // 🔍 Log para depurar si algo sigue fallando
  console.log('IPTV save payload', payload);

  // Si por algún motivo seguimos sin servicio_id, ni siquiera llamamos al backend
  if (!payload.servicio_id || payload.servicio_id <= 0) {
    await swalErr('Config', 'servicio_id es 0 o inválido en el payload.');
    return;
  }

  // Validación opcional de campos básicos (de momento comentada como ya la tenías)
  /*
  if (!payload.usuario || (!allowBlankCore && (!payload.password_plain || !payload.url))) {
    await swalWarn(
      'Campos incompletos',
      allowBlankCore ? 'Falta el usuario.' : 'Usuario, contraseña y URL son obligatorios.'
    );
    return;
  }
  */

  try {
    form.dataset.sending = '1';
    const res = await fetch(SAVE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'same-origin'
    });

    const js = await res.json().catch(() => ({ ok: false, error: 'Respuesta inválida' }));
    if (!res.ok || !js.ok) {
      throw new Error(js.error || ('HTTP ' + res.status));
    }

    const modalEl = form.closest('.modal');
    if (modalEl && window.bootstrap?.Modal) {
      bootstrap.Modal.getOrCreateInstance(modalEl).hide();
    }

    await swalOK(id > 0 ? 'Actualizado' : 'Guardado', 'Operación exitosa.');
    location.reload();
  } catch (e) {
    await swalErr('Error', e.message || 'No se pudo guardar');
  } finally {
    form.dataset.sending = '';
  }
}


  
  
  
  
  
  
  
  
  

  function bindOnce(id, handler){
    const f = document.getElementById(id);
    if (!f || f.dataset.bound) return;
    f.dataset.bound = '1';
    f.addEventListener('submit', handler);
  }

  bindOnce('formAgregarPerfil', function(ev){
    ev.preventDefault(); ev.stopPropagation();
    this.querySelector('[name="id"]')?.setAttribute('value','0');
    this.querySelector('[name="tipo"]')?.setAttribute('value','perfil');
    saveForm(this, {action:'create', id:0, tipo:'perfil'});
  });

  bindOnce('formAgregarPerfilHijo', function(ev){
    ev.preventDefault(); ev.stopPropagation();
    this.querySelector('[name="id"]')?.setAttribute('value','0');
    this.querySelector('[name="tipo"]')?.setAttribute('value','perfil');
    saveForm(this, {action:'create', id:0, tipo:'perfil', allowBlankCore:true});
  });

  bindOnce('formAgregarCuenta', function(ev){
    ev.preventDefault(); ev.stopPropagation();
    this.querySelector('[name="id"]')?.setAttribute('value','0');
    this.querySelector('[name="tipo"]')?.setAttribute('value','cuenta');
    saveForm(this, {action:'create', id:0, tipo:'cuenta'});
  });

  bindOnce('formEditarIptv', function(ev){
    ev.preventDefault(); ev.stopPropagation();
    saveForm(this);
  });

  document.addEventListener('submit', async function(ev){
    const f = ev.target.closest('.js-delete-form');
    if (!f) return;
    ev.preventDefault(); ev.stopPropagation();

    if (!DELETE_URL && f.action === '#') { await swalErr('Config', 'DELETE_URL no está configurado'); return; }

    const ok = window.Swal?.fire
      ? await Swal.fire({icon:'warning',title:'Confirmar borrado',text:'¿Borrar este registro?',showCancelButton:true,confirmButtonText:'Sí, borrar'})
          .then(r=>r.isConfirmed)
      : confirm('¿Borrar este registro?');
    if (!ok) return;

    const body = new URLSearchParams(new FormData(f));
    try {
      const res = await fetch(DELETE_URL || f.action, {
        method: 'POST',
        headers: {'Accept':'application/json'},
        body,
        credentials: 'same-origin'
      });
      const js = await res.json().catch(()=>({ok:false,error:'Respuesta inválida'}));
      if (!res.ok || !js.ok) throw new Error(js.error || ('HTTP '+res.status));
      await swalOK('Borrado','Registro eliminado.');
      location.reload();
    } catch(e) {
      await swalErr('Error al borrar', e.message || 'No se pudo borrar');
    }
  }, true);
})();
</script>

<script>
/* Click en fila PADRE de PERFILES -> abrir modal HIJO con correo y campos heredados */
(function () {
  if (window.__iptvPerfilRowClickInit2) return;
  window.__iptvPerfilRowClickInit2 = true;

  const cont = document.querySelector('#iptv-perfiles');
  if (!cont) return;

  cont.addEventListener('click', function (e) {
    if (e.target.closest('.js-row-action, a, button, input, select, textarea, .whatsapp, form, td.iptv-cell-perfil')) return;

    const tr = e.target.closest('tr.js-parent-row');
    if (!tr) return;

    // --- NUEVO: frenamos cualquier burbuja para que no dispare otros triggers
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();

    const raw = (tr.querySelector('.correo-cell')?.textContent || '').trim();
    if (!raw) return;
    const correo = raw.toLowerCase();

    const modalEl = document.getElementById('modalAgregarPerfilHijo');
    const form    = document.getElementById('formAgregarPerfilHijo');
    if (!modalEl || !form) return;

    let data = {};
    try {
      const btnEdit = tr.querySelector('.btn-edit[data-row]');
      if (btnEdit) data = JSON.parse(btnEdit.getAttribute('data-row') || '{}');
    } catch(_) {}

    form.reset();
    form.querySelector('[name="id"]').value   = '0';
    form.querySelector('[name="tipo"]').value = 'perfil';
    form.querySelector('#iptv_hijo_usuario').value      = correo;
    form.querySelector('#iptv_hijo_usuario_view').value = correo;
    const ttl = document.getElementById('correoHijoTitle'); 
    if (ttl) ttl.textContent = correo;

    // ✅ NUEVO: setear parent_id con el id del PADRE
    const parentInput = form.querySelector('[name="parent_id"]');
    if (parentInput) {
      let parentId = 0;

      // 1) Si en data viene el id (de data-row)
      if (data && typeof data.id !== 'undefined' && data.id !== null) {
        parentId = Number(data.id);
      }
      // 2) Si la fila tiene data-id
      else if (tr.dataset.id) {
        parentId = Number(tr.dataset.id);
      }
      // 3) Último recurso: algún hidden "id" dentro de la fila
      else {
        const hiddenId = tr.querySelector('input[type="hidden"][name="id"]');
        if (hiddenId) parentId = Number(hiddenId.value || 0);
      }

      parentInput.value = String(parentId || 0);
    }

    const iNombre = form.querySelector('#iptv_hijo_nombre');
    const iPass   = form.querySelector('#iptv_hijo_password');
    const iUrl    = form.querySelector('#iptv_hijo_url');

    if (iNombre) iNombre.value = (data?.nombre ?? '');
    if (iPass)   iPass.value   = (data?.password_plain ?? '');
    if (iUrl)    iUrl.value    = (data?.url ?? '');

    // Fechas por defecto: hoy y hoy + 30 días
if (window.setDefaultFechas) {
  setDefaultFechas(form, 30);
}

    
    
    
    
    const soles = form.querySelector('[name="soles"]'); if (soles) soles.value = '0.00';
    const estado= form.querySelector('[name="estado"]'); if (estado) estado.value = 'activo';
    const combo = form.querySelector('[name="combo"]'); if (combo) combo.checked = false;

    // --- NUEVO: cierra cualquier modal abierto antes de mostrar el "hijo"
    document.querySelectorAll('.modal.show').forEach(m => {
      const inst = bootstrap.Modal.getInstance(m);
      if (inst) inst.hide();
    });

    // --- NUEVO: desactiva temporalmente el botón "+ Agregar Perfil IPTV" para que no se dispare
    const addBtn = document.getElementById('btnAddPerfil');
    const toggleBackup = addBtn?.getAttribute('data-bs-toggle') || null;
    if (addBtn && toggleBackup !== null) {
      addBtn.removeAttribute('data-bs-toggle');
    }

    // Mostramos el modal hijo
    bootstrap.Modal.getOrCreateInstance(modalEl).show();

    // Al cerrar el hijo, reponemos el data-bs-toggle del botón
    modalEl.addEventListener('hidden.bs.modal', () => {
      if (addBtn && toggleBackup !== null) {
        addBtn.setAttribute('data-bs-toggle', toggleBackup);
      }
    }, { once: true });

    setTimeout(() => form.querySelector('[name="fecha_inicio"]')?.focus(), 60);
  });
})();
</script>



<script>
/* Helper para aplicar color a filas padre/hijo o single */
function updateGroupRowsColor(tr, color){
  const rows = [];
  const isSingle = tr.dataset.rowKind === 'single';
  const isChild  = tr.dataset.rowKind === 'child';
  let parent = tr;

  // Si es hijo, busca el padre hacia arriba
  if (!isSingle && isChild) {
    let prev = tr.previousElementSibling;
    // salta separadores
    while (prev && prev.classList.contains('iptv-day-sep')) {
      prev = prev.previousElementSibling;
    }
    while (prev && prev.dataset.rowKind !== 'parent') {
      prev = prev.previousElementSibling;
      while (prev && prev.classList.contains('iptv-day-sep')) {
        prev = prev.previousElementSibling;
      }
    }
    if (prev) parent = prev;
  }

  if (isSingle) {
    rows.push(tr);
  } else {
    // padre + todos sus hijos hasta el siguiente padre
    rows.push(parent);
    let nxt = parent.nextElementSibling;
    while (nxt && !nxt.classList.contains('iptv-day-sep') && nxt.dataset.rowKind === 'child') {
      rows.push(nxt);
      nxt = nxt.nextElementSibling;
    }
  }

  rows.forEach(r => {
    r.classList.remove('row-color-rojo','row-color-azul','row-color-verde','row-color-blanco');
    if (color) r.classList.add('row-color-'+color);
    r.dataset.color = color || '';
  });
}

(function () {
  // 🔹 Ajusta estos IDs para que coincidan con tu HTML
  const formEl  = document.getElementById('iptvColorForm');     // <form id="iptvColorForm">
  const idEl    = document.getElementById('iptv_color_id');     // <input type="hidden" id="iptv_color_id">
  const tipoEl  = document.getElementById('iptv_color_tipo');   // <input/select id="iptv_color_tipo">
  const colorEl = document.getElementById('iptv_color_value');  // <select id="iptv_color_value">
  const modalEl = document.getElementById('iptvColorModal');    // <div id="iptvColorModal" class="modal">

  // Si falta el form, salimos sin hacer nada
  if (!formEl) return;

  formEl.addEventListener('submit', async function (ev) {
    ev.preventDefault();
    ev.stopPropagation();

    // URL del endpoint que cambia el color (debe estar definida en algún <script>)
    if (!window.COLOR_URL) {
      alert('COLOR_URL no configurado');
      return;
    }

    const id    = Number(idEl && idEl.value ? idEl.value : 0);
    const tipo  = (tipoEl && tipoEl.value === 'perfil') ? 'perfil' : 'cuenta';
    const color = colorEl ? colorEl.value : '';

    try {
      const res = await fetch(window.COLOR_URL, {
        method: 'POST',
        headers: {
          'Content-Type':'application/json',
          'Accept':'application/json'
        },
        body: JSON.stringify({action:'color', id, tipo, color}),
        credentials: 'same-origin'
      });

      const js = await res.json().catch(() => ({ok:false,error:'Respuesta inválida'}));
      if (!res.ok || !js.ok) {
        throw new Error(js.error || ('HTTP '+res.status));
      }

      const td = document.querySelector(
        `[data-tipo="${tipo}"] table tbody tr td.iptv-cell-perfil[data-id="${id}"]`
      );
      const tr = td ? td.closest('tr') : null;
      if (tr) updateGroupRowsColor(tr, color);

      if (modalEl) {
        bootstrap.Modal.getOrCreateInstance(modalEl).hide();
      }
    } catch (e) {
      alert('No se pudo cambiar el color: ' + (e && e.message ? e.message : 'Error'));
    }
  });
})();
</script>




<script>
/* ===== Filtros locales + ocultar separadores de día cuando no tienen filas visibles ===== */
(function(){
  document.body.setAttribute('data-page', 'iptv');

  const norm = (s) => (s||'')
    .toString()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().trim();

  function readControls(scope){
    const box = document.querySelector(`.iptv-local-filters[data-scope="${scope}"]`);
    if (!box) return null;
    return {
      q:      norm(box.querySelector('[data-role="search"]')?.value || ''),
      estado: (box.querySelector('[data-role="estado"]')?.value || '').toLowerCase(),
      combo:  (box.querySelector('[data-role="combo"]')?.value ?? ''),
      color:  (box.querySelector('[data-role="color"]')?.value || '').toLowerCase(),
      box
    };
  }

  function refreshSeparators(tbody){
    if (!tbody) return;
    const visibleDays = new Set();
    // Toma en cuenta sólo filas de datos (no separadores)
    tbody.querySelectorAll('tr:not(.iptv-day-sep)').forEach(tr => {
      if (!tr.classList.contains('d-none')) {
        const d = (tr.dataset.day || '').trim();
        if (d) visibleDays.add(d);
      }
    });
    // Oculta separadores que no tengan filas visibles
    tbody.querySelectorAll('tr.iptv-day-sep').forEach(sep => {
      const day = (sep.dataset.day || '').trim();
      sep.classList.toggle('d-none', !visibleDays.has(day));
    });
  }

  function applyPerfiles(){
    const c = readControls('perfiles');
    const tbody = document.querySelector('#iptv-perfiles table tbody');
    if (!c || !tbody) return;

    const rows = Array.from(tbody.querySelectorAll('tr'));
    let showGroup = true;

    rows.forEach(tr => {
      // Ignora separadores de día en el matching
      if (tr.classList.contains('iptv-day-sep')) return;

      const kind   = tr.dataset.rowKind;         // parent|child
      const color  = (tr.dataset.color||'').toLowerCase();
      const estado = (tr.dataset.estado||'').toLowerCase();
      const combo  = (tr.dataset.combo||'');
      const text   = norm(
        (tr.dataset.nombre||'')+' '+
        (tr.dataset.usuario||'')+' '+
        (tr.dataset.url||'')+' '+
        tr.textContent
      );

      if (kind === 'parent') {
        let match = true;
        if (c.q && !text.includes(c.q))             match = false;
        if (c.color && color !== c.color)           match = false;
        if (c.estado && estado !== c.estado)        match = false;
        if (c.combo !== '' && combo !== c.combo)    match = false;

        showGroup = match;
        tr.classList.toggle('d-none', !match);
      } else {
        tr.classList.toggle('d-none', !showGroup);
      }
    });

    refreshSeparators(tbody);
  }

  function applyCuentas(){
    const c = readControls('cuentas');
    const tbody = document.querySelector('#iptv-cuentas table tbody');
    if (!c || !tbody) return;

    Array.from(tbody.querySelectorAll('tr')).forEach(tr => {
      // Ignora separadores de día en el matching
      if (tr.classList.contains('iptv-day-sep')) return;

      const color  = (tr.dataset.color||'').toLowerCase();
      const estado = (tr.dataset.estado||'').toLowerCase();
      const combo  = (tr.dataset.combo||'');
      const text   = norm(
        (tr.dataset.nombre||'')+' '+
        (tr.dataset.usuario||'')+' '+
        (tr.dataset.url||'')+' '+
        tr.textContent
      );

      let match = true;
      if (c.q && !text.includes(c.q))             match = false;
      if (c.color && color !== c.color)           match = false;
      if (c.estado && estado !== c.estado)        match = false;
      if (c.combo !== '' && combo !== c.combo)    match = false;

      tr.classList.toggle('d-none', !match);
    });

    refreshSeparators(tbody);
  }

  function bindLocalFilter(scope, applyFn){
    const box = document.querySelector(`.iptv-local-filters[data-scope="${scope}"]`);
    if (!box || box.dataset.bound) return;
    box.dataset.bound = '1';

    const onChange = () => applyFn();
    box.querySelectorAll('[data-role="search"],[data-role="estado"],[data-role="combo"],[data-role="color"]')
      .forEach(el => el.addEventListener('input', onChange));
    box.querySelectorAll('[data-role="estado"],[data-role="combo"],[data-role="color"]')
      .forEach(el => el.addEventListener('change', onChange));
    const clearBtn = box.querySelector('[data-role="clear"]');
    if (clearBtn) {
      clearBtn.addEventListener('click', (e)=>{
        e.preventDefault();
        box.querySelectorAll('[data-role="search"]').forEach(i=> i.value='');
        box.querySelectorAll('[data-role="estado"],[data-role="combo"],[data-role="color"]')
          .forEach(s=> s.value='');
        applyFn();
      });
    }
  }

  function boot(){
    bindLocalFilter('perfiles', applyPerfiles);
    bindLocalFilter('cuentas',  applyCuentas);

    const active = document.querySelector('.tab-pane.active');
    if (active?.id === 'iptv-perfiles') applyPerfiles();
    if (active?.id === 'iptv-cuentas')  applyCuentas();
  }

  document.addEventListener('shown.bs.tab', (e)=>{
    const target = e.target?.getAttribute('data-bs-target');
    if (target === '#iptv-perfiles') { bindLocalFilter('perfiles', applyPerfiles); applyPerfiles(); }
    if (target === '#iptv-cuentas')  { bindLocalFilter('cuentas',  applyCuentas);  applyCuentas();  }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  window.addEventListener('load', boot);
})();
</script>


<?php if ($DEBUG): ?>
<pre style="position:fixed;bottom:0;left:0;right:0;max-height:40vh;overflow:auto;background:#111;color:#0f0;padding:8px;margin:0;font-size:12px">
IPTV perfiles: <?= (int)count($iptv_perfiles) . PHP_EOL ?>
IPTV cuentas : <?= (int)count($iptv_cuentas) . PHP_EOL ?>
SAVE_URL    : <?= $SAVE_URL . PHP_EOL ?>
DELETE_URL  : <?= $DELETE_URL . PHP_EOL ?>
COLOR_URL  : <?= $COLOR_URL . PHP_EOL ?>
__DIR__     : <?= __DIR__ . PHP_EOL ?>
PHP_SELF    : <?= (($_SERVER['PHP_SELF'] ?? '') . PHP_EOL) ?>
</pre>
<?php endif; ?>
<script>
// Garantiza que sólo haya un modal abierto a la vez
(function () {
  document.addEventListener('show.bs.modal', function (ev) {
    document.querySelectorAll('.modal.show').forEach(m => {
      if (m !== ev.target) {
        const inst = bootstrap.Modal.getInstance(m);
        if (inst) inst.hide();
      }
    });
  });
})();
</script>
<script>
document.addEventListener('click', function (e) {
  const btn = e.target.closest('.js-add-child-iptv');
  if (!btn) return;

  const parentId = btn.getAttribute('data-parent-id') || '0';

  // 🔹 Modo hijo: siempre action=create y tipo=perfil
  const idInput        = document.getElementById('iptv_id');
  const tipoInput      = document.getElementById('iptv_tipo');
  const parentInput    = document.getElementById('iptv_parent_id');
  const nombreInput    = document.getElementById('iptv_nombre');   // si tienes este id
  const usuarioInput   = document.getElementById('iptv_usuario');  // si tienes este id
  const passwordInput  = document.getElementById('iptv_password'); // si tienes este id

  if (idInput)       idInput.value = '0';       // siempre nuevo
  if (tipoInput)     tipoInput.value = 'perfil';
  if (parentInput)   parentInput.value = parentId;

  // Opcional: limpiar campos para que el hijo empiece "en blanco"
  if (nombreInput)   nombreInput.value = '';
  if (usuarioInput)  usuarioInput.value = '';
  if (passwordInput) passwordInput.value = '';

  // No hace falta abrir el modal aquí porque ya lo abre Bootstrap
  // con data-bs-toggle="modal" y data-bs-target="#modalEditarIptv"
});
</script>



<script>
(function () {
  if (window.__iptvHijoSubmitInit) return;
  window.__iptvHijoSubmitInit = true;

  const form = document.getElementById('formAgregarPerfilHijo');
  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const modalEl = document.getElementById('modalAgregarPerfilHijo');
    const actionUrl = form.getAttribute('action') || 'public/ajax/iptv_save.php';

    // Armamos el payload desde el form
    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());

    // 🔐 NUEVO: asegurar que password_plain tenga el valor de password si existe
    if (!payload.password_plain && payload.password) {
      payload.password_plain = payload.password;
    }

    // Siempre es perfil hijo
    payload.tipo   = 'perfil';
    payload.action = (payload.id && payload.id !== '0') ? 'update' : 'create';

    // Normalizar numéricos básicos
    payload.servicio_id = Number(payload.servicio_id || window.IPTV_SERVICIO_ID || 0);
    payload.parent_id   = Number(payload.parent_id || 0);
    payload.soles       = String(payload.soles || '0.00');

    try {
      if (window.Swal) {
        Swal.fire({
          title: 'Guardando...',
          text: 'Por favor espera un momento',
          allowOutsideClick: false,
          allowEscapeKey: false,
          showConfirmButton: false,
          didOpen: () => {
            Swal.showLoading();
          }
        });
      }

      const resp = await fetch(actionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify(payload)
      });

      let data;
      try {
        data = await resp.json();
      } catch (_) {
        data = { ok: false, error: 'Respuesta inválida del servidor.' };
      }

      if (!data.ok) {
        if (window.Swal) {
          Swal.fire('Error', data.error || 'No se pudo guardar el perfil hijo.', 'error');
        } else {
          alert(data.error || 'No se pudo guardar el perfil hijo.');
        }
        return;
      }

      if (window.Swal) {
        Swal.fire({
          icon: 'success',
          title: 'Perfil hijo guardado',
          text: data.message || 'El perfil hijo se creó correctamente.',
          timer: 1200,
          showConfirmButton: false
        });
      }

      if (modalEl && window.bootstrap) {
        const inst = bootstrap.Modal.getInstance(modalEl) || bootstrap.Modal.getOrCreateInstance(modalEl);
        inst.hide();
      }

      setTimeout(() => {
        window.location.reload();
      }, 1300);

    } catch (err) {
      if (window.Swal) {
        Swal.fire('Error', 'Ocurrió un error al guardar el perfil hijo.', 'error');
      } else {
        alert('Ocurrió un error al guardar el perfil hijo.');
      }
      console.error(err);
    }
  });
})();
</script>


<script>
document.addEventListener('DOMContentLoaded', function () {
  const hash = (window.location.hash || '').toLowerCase();

  // Solo nos interesan estos dos
  if (hash !== '#perfiles' && hash !== '#cuentas') return;

  // Buscar el <a> cuya href termina en ese hash
  const trigger = document.querySelector(
    '#iptvTabs a.nav-link[href$="' + hash + '"]'
  );

  if (!trigger || !window.bootstrap) return;

  // Mostrar la pestaña correspondiente
  // Bootstrap se encarga de desactivar la anterior y activar la nueva
  const tab = new bootstrap.Tab(trigger);
  tab.show();
});
</script>

<script>
;(function () {
  'use strict';

  const tabsBar = document.getElementById('iptvTabs');
  if (!tabsBar) return;

  // Elimina menú previo si quedó de intentos anteriores
  const OLD = document.getElementById('iptvTabContextMenu');
  if (OLD) OLD.remove();

  // Crear menú contextual
  const menu = document.createElement('div');
  menu.id = 'iptvTabContextMenu';
  menu.style.cssText = [
    'position:fixed',
    'z-index:2147483647',
    'display:none',
    'min-width:220px',
    'background:#fff',
    'border:1px solid rgba(0,0,0,.15)',
    'border-radius:.5rem',
    'box-shadow:0 .5rem 1rem rgba(0,0,0,.15)',
    'font-size:.875rem',
    'overflow:hidden',
    'user-select:none'
  ].join(';');

  menu.innerHTML = [
    '<button type="button" data-act="tab" style="display:block;width:100%;text-align:left;padding:.5rem .75rem;background:none;border:0;cursor:pointer">Abrir en nueva pestaña</button>',
    '<button type="button" data-act="win" style="display:block;width:100%;text-align:left;padding:.5rem .75rem;background:none;border:0;border-top:1px solid rgba(0,0,0,.1);cursor:pointer">Abrir en nueva ventana</button>'
  ].join('');

  document.body.appendChild(menu);

  function hideMenu() {
    menu.style.display = 'none';
    menu.dataset.url = '';
  }

  function showMenu(x, y, url) {
    menu.dataset.url = url;
    menu.style.display = 'block';
    const vw = window.innerWidth || document.documentElement.clientWidth || 0;
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;
    const rect = menu.getBoundingClientRect();
    menu.style.left = Math.max(8, Math.min(x, vw - rect.width - 8)) + 'px';
    menu.style.top  = Math.max(8, Math.min(y, vh - rect.height - 8)) + 'px';
  }

  function buildUrlForTab(trigger) {
    if (!trigger) return '';
    // En IPTV usamos <a href="iptv.php?id=XX#perfiles">
    const href = trigger.getAttribute('href') || trigger.getAttribute('data-bs-target') || '';
    if (!href) return '';
    if (href[0] === '#') {
      // Por si en algún momento se usan solo hashes
      return location.pathname + location.search + href;
    }
    return href;
  }

  // Mostrar menú con click derecho sobre las pestañas
  tabsBar.addEventListener('contextmenu', function (ev) {
    const link = ev.target.closest('[data-bs-toggle="tab"]');
    if (!link) return;
    const url = buildUrlForTab(link);
    if (!url) return;
    ev.preventDefault();
    ev.stopPropagation();
    showMenu(ev.clientX, ev.clientY, url);
  }, false);

  // Click en las opciones del menú
  menu.addEventListener('click', function (ev) {
    const btn = ev.target.closest('button[data-act]');
    if (!btn) return;
    const url = menu.dataset.url;
    hideMenu();
    if (!url) return;

    if (btn.dataset.act === 'tab') {
      // Abrir en nueva pestaña
      window.open(url, '_blank');
    } else if (btn.dataset.act === 'win') {
      // Abrir en nueva ventana (según navegador)
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, false);

  // Cerrar menú si clicas fuera / scroll / resize / ESC / blur
  window.addEventListener('click', function (ev) {
    if (!menu.contains(ev.target)) hideMenu();
  }, false);
  window.addEventListener('wheel', hideMenu, { passive: true });
  window.addEventListener('resize', hideMenu);
  window.addEventListener('blur', hideMenu);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') hideMenu();
  }, false);
})();
</script>



</body>
</html>

<?php
// Modales y footer
include __DIR__ . '/../includes/modals.php';
include __DIR__ . '/../includes/footer.php';
