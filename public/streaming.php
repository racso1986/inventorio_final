<?php
declare(strict_types=1);
error_reporting(E_ALL);
ini_set('display_errors', 1);

// NO llames session_start() aquí; config.php ya lo hace
require_once __DIR__ . '/../app/helpers.php';     // redirect(), set_flash(), etc.
require_once __DIR__ . '/../config/db.php';        // get_pdo()ffff

/* MODELOS necesarios para esta vista */
require_once __DIR__ . '/../app/models/StreamingModel.php';
require_once __DIR__ . '/../app/models/PerfilModel.php';
require_once __DIR__ . '/../app/models/CuentaModel.php';
require_once __DIR__ . '/../app/models/StockModel.php';
require_once __DIR__ . '/../app/models/PausaModel.php';
require_once __DIR__ . '/../app/models/PerfilFamiliarModel.php';


ini_set('display_errors', '1');
error_reporting(E_ALL);

/* Autenticación */
if (empty($_SESSION['user_id'])) {
  redirect('index.php');
}

/* ID válido o volvemos al dashboard antes de imprimir HTML */
$streaming_id = (int)($_GET['id'] ?? 0);
if ($streaming_id <= 0) {
  set_flash('warning','ID de streaming inválido.');
  redirect('dashboard.php');
}


// Helper (una sola vez en la vista)
if (!function_exists('format_cliente_num')) {
  function format_cliente_num(string $wa_e164 = '', string $wa_digits = ''): string {
    $digits = ltrim($wa_e164 !== '' ? $wa_e164 : $wa_digits, '+');
    if ($digits === '') return '';
    if (strlen($digits) > 9) {
      $cc    = substr($digits, 0, strlen($digits) - 9);
      $local = substr($digits, -9);
      return '+' . $cc . ' ' .
             substr($local, 0, 3) . ' ' .
             substr($local, 3, 3) . ' ' .
             substr($local, 6, 3);
    }
    if (strlen($digits) === 9) {
      return substr($digits, 0, 3) . ' ' .
             substr($digits, 3, 3) . ' ' .
             substr($digits, 6, 3);
    }
    return ($wa_e164 !== '' && $wa_e164[0] === '+') ? $wa_e164 : ('+' . $digits);
  }
}


/* Carga de datos protegida */
try {
  $streaming = StreamingModel::get($streaming_id);
  if (!$streaming) {
    set_flash('warning','Streaming no encontrado.');
    redirect('dashboard.php');
  }

  // Conexión PDO para consultas puntuales
  $pdo = get_pdo();

  // Perfiles y Cuentas (ordenados por correo para agrupar visualmente)
// Usamos los modelos para centralizar la lógica de orden y futuros cambios

// Detectar página actual para PERFILES (desde la query string)

$perfiles = PerfilModel::byStreaming($streaming_id);
$cuentas  = CuentaModel::byStreaming($streaming_id);




// Pausas desde el modelo
  $perfiles_pausa = PausaModel::byStreaming($streaming_id);

  /* Helpers usados por las tablas (locales a este archivo) */
  function estado_badge_class($estado) {
    return $estado === 'pendiente' ? 'bg-warning text-dark'
         : ($estado === 'moroso' ? 'bg-danger'
         : 'bg-light text-dark');
  }
  function row_json_attr(array $row): string {
    $json = json_encode($row, JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT);
    return htmlspecialchars($json, ENT_QUOTES, 'UTF-8');
  }

  /* Título de la página (por si tu header lo usa) */
  $pageTitle = sprintf(
    '%s • %s • S/%0.2f',
    (string)($streaming['nombre'] ?? 'Streaming'),
    (string)($streaming['plan']   ?? ''),
    (float)($streaming['precio']  ?? 0)
  );

  /* Normaliza ruta del logo */
  $logo = (string)($streaming['logo'] ?? '');
  if ($logo && strpos($logo, 'uploads/') === false) {
    $logo = 'uploads/' . ltrim($logo, '/');
  }
  
 
// --- Helper para imprimir la leyenda de "Perfil familiar" una sola vez ---
if (!function_exists('render_perfil_familiar_legend_once')) {
  function render_perfil_familiar_legend_once(): string {
    static $printed = false;
    if ($printed) return '';
    $printed = true;

    return '
      <div id="pf-legend" class="alert alert-info small mb-2 perfil-familiar-legend" role="status">
        <strong>Perfil familiar:</strong> Usa este perfil solo cuando el plan lo incluya. No se comparte fuera del núcleo familiar.
      </div>
    ';
  }
}


  /* Fecha hoy */
  $hoy = date('Y-m-d');

  /* Header + Navbar (una sola vez) */
  include __DIR__ . '/../includes/header.php';
  include __DIR__ . '/../includes/navbar.php';

} catch (Throwable $e) {
  error_log('public/streaming.php error: ' . $e->getMessage());
  http_response_code(500);
  // Pintamos un layout mínimo para no dejar pantalla en blanco
  include __DIR__ . '/../includes/header.php';
  include __DIR__ . '/../includes/navbar.php';
  echo '<div class="container py-4"><div class="alert alert-danger">Error interno. Revisa logs.</div></div>';
  include __DIR__ . '/../includes/footer.php';
  exit;
}
?>

<div class="container py-4">
  <div class="d-flex align-items-center justify-content-between mb-3">
    <h3 class="mb-0">
      <?php if (!empty($logo)): ?>
        <img src="<?= htmlspecialchars($logo) ?>"
             alt="<?= htmlspecialchars($streaming['nombre']) ?>"
             class="rounded me-2 align-text-bottom"
             style="height:32px;width:32px;object-fit:contain;">
      <?php endif; ?>
      <?= htmlspecialchars($streaming['nombre']) ?>
      <small class="text-muted">
        (<?= htmlspecialchars((string)$streaming['plan']) ?> • S/<?= number_format((float)$streaming['precio'], 2, '.', '') ?>)
      </small>
    </h3>

    <div class="d-flex gap-2">
     

     

      <a href="dashboard.php" class="btn btn-sm btn-outline-secondary">Volver</a>
    </div>
  </div>

  <ul class="nav nav-tabs" id="streamTabs" role="tablist">

    <li class="nav-item" role="presentation">
      <button class="nav-link active" id="perfiles-tab" data-bs-toggle="tab" data-bs-target="#perfiles" type="button" role="tab" aria-controls="perfiles" aria-selected="true">Perfiles</button>
    </li>
    <li class="nav-item" role="presentation">
      <button class="nav-link" id="cuentas-tab" data-bs-toggle="tab" data-bs-target="#cuentas" type="button" role="tab" aria-controls="cuentas" aria-selected="false">Cuenta completa</button>
    </li>
    <li class="nav-item" role="presentation">
      <button class="nav-link" id="stock-tab" data-bs-toggle="tab" data-bs-target="#stock" type="button" role="tab" aria-controls="stock" aria-selected="false">Stock</button>
    </li>
    <li class="nav-item" role="presentation">
      <button class="nav-link" id="pausa-tab" data-bs-toggle="tab" data-bs-target="#pausa" type="button" role="tab" aria-controls="pausa" aria-selected="false">Cuenta en pausa</button>
    </li>
   <li class="nav-item" role="presentation">
  <button class="nav-link" id="perfiles-familiar-tab"
          data-bs-toggle="tab"
          data-bs-target="#perfiles-familiar"
          type="button" role="tab"
          aria-controls="perfiles-familiar" aria-selected="false">
    Streaming familiar
  </button>
</li>


  </ul>
  
 


  <div class="tab-content border border-top-0 p-3 rounded-bottom shadow-sm bg-white">
      








 <!-- PERFILES -->
<div class="tab-pane fade show active" id="perfiles" role="tabpanel" aria-labelledby="perfiles-tab">
  
  <!-- Botón + precio cabecera -->
  <div class="d-flex align-items-center flex-wrap gap-2" style="float: right;">
    <button type="button" class="btn btn-sm btn-primary btn-add-perfil"
            data-bs-toggle="modal" data-bs-target="#perfilModal"
            data-streaming_id="<?= (int)$streaming_id ?>" style="float: right;">
      Agregar perfil
    </button>
   <a href="export_streaming_items.php?streaming_id=<?= (int)$streaming_id ?>&tipo=perfiles"
   class="btn btn-sm btn-outline-success">
  Exportar Excel (Perfiles)
</a>


    <input
      id="precioPerfilHead"
      name="precioPerfilHead"
      type="number"
      step="0.01"
      min="0"
      class="form-control"
      placeholder="0.00"
      inputmode="decimal"
      style="width:120px"
    >
  </div>

  <!-- Filtros PERFILES (solo esta pestaña) -->
  <div class="__pcFilter__ d-flex flex-wrap align-items-center gap-2 mb-2" data-scope="perfiles">
    <select class="form-select form-select-sm pc-main" style="max-width: 360px;">
      <option value="">— Filtro especial —</option>
      <option value="color_rojo">Color ROJO (padres)</option>
      <option value="color_azul">Color AZUL (padres)</option>
      <option value="color_verde">Color VERDE (padres)</option>
      <option value="pendientes">Pendientes por activar</option>
      <option value="dias_asc">Menos días</option>
      <option value="dias_desc">Mayor días</option>
      <option value="plan">Plan…</option>
    </select>

    <select class="form-select form-select-sm pc-plan" style="max-width: 220px; display: none;">
      <option value="">— Selecciona plan —</option>
      <option value="basico">Básico (incluye “Individual”)</option>
      <option value="estandar">Estándar</option>
      <option value="premium">Premium</option>
    </select>

    <input type="search" placeholder="Buscar por correo o WhatsApp" class="form-control form-control-sm pc-search js-whatsapp-search" style="max-width: 280px;">
    <button type="button" class="btn btn-sm btn-outline-secondary pc-clear">Limpiar</button>
  </div>

  <div class="table-responsive">
    <table
  class="table align-middle table-bordered"
  id="perfilesTable"
 
>

      <thead>
      <tr>
        <th>Plan</th>
        <th>Correo</th>
        <th>Contraseña</th>
        <th>Inicio</th>
        <th>Fin</th>
        <th>Días</th>
        <th>Perfil</th>
        <th>Cliente</th>
        <th>Precio</th>
        <th>Dispositivo</th>
        <th>Combo</th>
        <th>Estado</th>
        <th>Entrega</th>
        <th>Acciones</th>
      </tr>
      </thead>

      <?php
      // helper para formatear cliente (igual que tenías)
      if (!function_exists('format_cliente_num')) {
        function format_cliente_num(string $wa_e164 = '', string $wa_digits = ''): string {
          $digits = ltrim($wa_e164 !== '' ? $wa_e164 : $wa_digits, '+');
          if ($digits === '') return '';
          if (strlen($digits) > 9) {
            $cc    = substr($digits, 0, strlen($digits) - 9);
            $local = substr($digits, -9);
            return '+' . $cc . ' ' . substr($local,0,3) . ' ' . substr($local,3,3) . ' ' . substr($local,6,3);
          }
          if (strlen($digits) === 9) {
            return substr($digits,0,3) . ' ' . substr($digits,3,3) . ' ' . substr($digits,6,3);
          }
          return ($wa_e164 !== '' && $wa_e164[0] === '+') ? $wa_e164 : ('+' . $digits);
        }
      }

      // === Agrupar por correo y calcular anclas/actividad ===
      $groups = [];
foreach ($perfiles as $row) {
    $correo = (string)($row['correo'] ?? '');
    if ($correo === '') continue;
    $groups[$correo][] = $row;
}




      // Helpers de timestamps
      $tsCreated = function(array $r): int {
        $raw = $r['created_at'] ?? $r['createdAt'] ?? $r['fecha_creacion'] ?? '';
        $t   = $raw ? strtotime($raw) : 0;
        return $t ?: (int)($r['id'] ?? 0);
      };
      $tsUpdated = function(array $r) use ($tsCreated): int {
        $raw = $r['updated_at'] ?? $r['updatedAt'] ?? '';
        $t   = $raw ? strtotime($raw) : 0;
        return $t ?: $tsCreated($r);
      };

      // Estructuras por grupo
      $countsByCorreo      = [];
      $parentIdByCorreo    = [];
      $anchorPriceByCorreo = [];   // precio del PRIMER hijo
      $parentDayTsByCorreo = [];   // día del padre (ancla)
      $lastActivityByCorreo= [];   // actividad reciente (para ordenar grupos)

      foreach ($groups as $correo => &$rows) {
        // Orden interno por creación asc (padre primero)
        usort($rows, function($a,$b) use($tsCreated){
          $ta = $tsCreated($a); $tb = $tsCreated($b);
          if ($ta === $tb) return ((int)$a['id']) <=> ((int)$b['id']);
          return $ta <=> $tb;
        });

        $countsByCorreo[$correo]   = count($rows);
        $parentIdByCorreo[$correo] = (int)($rows[0]['id'] ?? 0);
        $parentDayTsByCorreo[$correo] = $tsCreated($rows[0]);

        // Ancla: precio del 1er hijo si existe
        if (count($rows) > 1) {
          $firstChild = $rows[1];
          $anchorPriceByCorreo[$correo] = isset($firstChild['soles']) ? (float)$firstChild['soles'] : null;
        } else {
          $anchorPriceByCorreo[$correo] = null;
        }

        // Actividad reciente = max(updated_at|created_at)
        $maxAct = 0;
        foreach ($rows as $r) {
          $act = $tsUpdated($r);
          if ($act > $maxAct) $maxAct = $act;
        }
        $lastActivityByCorreo[$correo] = $maxAct;
      }
      unset($rows);

      // Ordenar grupos por actividad reciente DESC (sube al inicio el grupo editado)
      uksort($groups, function($a,$b) use($lastActivityByCorreo){
        return ($lastActivityByCorreo[$b] ?? 0) <=> ($lastActivityByCorreo[$a] ?? 0);
      });
      ?>

      <tbody>
      <?php
        $hoy        = date('Y-m-d');
        $meses      = ['', 'enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
        $lastDayKey = null;

        foreach ($groups as $correoKey => $rows):
          // Separador por día del PADRE (anclado)
          $pTs    = (int)($parentDayTsByCorreo[$correoKey] ?? 0);
          $dayKey = $pTs ? date('Y-m-d', $pTs) : '';
          if ($dayKey && $dayKey !== $lastDayKey) {
            $diaLabel = date('j', $pTs) . ' ' . $meses[(int)date('n', $pTs)];
            echo '<tr data-sep="1" class="table-light"><td colspan="14" class="py-1 fw-semibold text-muted">'
               . htmlspecialchars($diaLabel, ENT_QUOTES, 'UTF-8')
               . '</td></tr>';
            $lastDayKey = $dayKey;
          }

          $hasChildren = (($countsByCorreo[$correoKey] ?? 0) > 1);
          foreach ($rows as $idx => $p):

            $isParent    = ((int)$p['id'] === (int)($parentIdByCorreo[$correoKey] ?? 0));
            $showCorreo  = $isParent;

            $dias       = (int) floor((strtotime($p['fecha_fin']) - strtotime($hoy))/86400);
            $estadoReal = $dias < 0 ? 'moroso' : $p['estado'];
            $badgeClass = $estadoReal === 'pendiente' ? 'bg-warning text-dark' : ($estadoReal === 'moroso' ? 'bg-danger' : 'bg-light text-dark');

            $plan       = (string)($p['plan'] ?? 'individual');
            $comboLabel = ((int)($p['combo'] ?? 0) === 1) ? 'Sí' : 'No';

            $rowPerfil = [
              'id'            => (int)$p['id'],
              'streaming_id'  => (int)$p['streaming_id'],
              'correo'        => (string)$p['correo'],
              'password_plain'=> (string)$p['password_plain'],
              'perfil'        => (string)$p['perfil'],
              'whatsapp'      => (string)$p['whatsapp'],
              'fecha_inicio'  => (string)$p['fecha_inicio'],
              'fecha_fin'     => (string)$p['fecha_fin'],
              'soles'         => (string)$p['soles'],
              'estado'        => (string)$p['estado'],
              'dispositivo'   => (string)$p['dispositivo'],
              'plan'          => $plan,
              'combo'         => (int)($p['combo'] ?? 0),
            ];

            $ini_fmt = (!empty($p['fecha_inicio']) && $p['fecha_inicio'] !== '0000-00-00' && $p['fecha_inicio'] !== '0000-00-00 00:00:00')
              ? date('d/m/y', strtotime($p['fecha_inicio'])) : '';
            $fin_fmt = (!empty($p['fecha_fin']) && $p['fecha_fin'] !== '0000-00-00' && $p['fecha_fin'] !== '0000-00-00 00:00:00')
              ? date('d/m/y', strtotime($p['fecha_fin'])) : '';

            // WhatsApp / Cliente
            $__correo = $rowPerfil['correo'] ?: $p['correo'];
            $__fin    = $rowPerfil['fecha_fin'] ?: $p['fecha_fin'];
            $__wa     = $rowPerfil['whatsapp'] ?: $p['whatsapp'];
            $__wa     = preg_replace('/\s+/', '', (string)$__wa);
            $__wa     = preg_replace('/(?!^)\+/', '', $__wa);
            $__wa     = preg_replace('/[^\d\+]/', '', $__wa);
            if ($__wa === '+') { $__wa = ''; }
            $wa_num   = ltrim($__wa, '+');
            $tg_phone = ($__wa !== '' && $__wa[0] === '+') ? $__wa : ($__wa !== '' ? ('+' . $__wa) : '');
            $msg      = rawurlencode($__correo . ' - ' . $__fin);

            // Color de fila (opcional)
            $__color      = isset($p['color']) ? strtolower((string)$p['color']) : '';
            $__allowed    = ['rojo','azul','verde','blanco'];
            $__color      = in_array($__color, $__allowed, true) ? $__color : '';
            $__colorClass = $__color ? ' row-color-'.htmlspecialchars($__color, ENT_QUOTES, 'UTF-8') : '';

            // Ancla de precio SOLO en el PADRE y SOLO si hay hijos (precio del 1er hijo)
            $anchorAttr = '';
            if ($isParent && $hasChildren) {
              $ap = $anchorPriceByCorreo[$correoKey] ?? null;
              if ($ap !== null && $ap !== '') {
                $anchorAttr = number_format((float)$ap, 2, '.', '');
              }
            }

            // Atributos del <tr> padre
            $__parentAttrs = '';
            if ($showCorreo) {
              $attrs = [
                'data-id="'.(int)$p['id'].'"',
                'data-entidad="perfil"',
                'data-correo="'.htmlspecialchars($p['correo'], ENT_QUOTES).'"',
                'data-password="'.htmlspecialchars($p['password_plain'], ENT_QUOTES).'"',
                'data-soles="'.htmlspecialchars($p['soles'], ENT_QUOTES).'"',
                'data-plan="'.htmlspecialchars($plan, ENT_QUOTES).'"',
                'data-combo="'.(int)($p['combo'] ?? 0).'"',
                'data-streaming_id="'.(int)$p['streaming_id'].'"',
              ];
              if ($__color) {
                $attrs[] = 'data-color="'.htmlspecialchars($__color, ENT_QUOTES, 'UTF-8').'"';
              }
              if ($anchorAttr !== '') {
                $attrs[] = 'data-anchor-price="'.htmlspecialchars($anchorAttr, ENT_QUOTES).'"';
              }
              $attrs[] = 'role="button"';
              $attrs[] = 'tabindex="0"';
              $__parentAttrs = ' '.implode(' ', $attrs);
            }
      ?>
      <tr class="<?= trim(($showCorreo ? 'js-parent-row cursor-pointer'.($hasChildren ? ' has-children' : '') : '').$__colorClass) ?>"<?= $__parentAttrs ?>>
        <td class="plan-cell-perfil"
    data-id="<?= (int)$p['id'] ?>"
    data-plan="<?= htmlspecialchars($plan, ENT_QUOTES, 'UTF-8') ?>"
    data-no-row-modal="1"
    role="button"
    tabindex="0">
  <?= $showCorreo ? htmlspecialchars($plan) : '' ?>
</td>



        <!-- 2) CORREO -->
        <td class="correo-cell"><?= $showCorreo ? htmlspecialchars($p['correo']) : '' ?></td>

        <!-- 3) CONTRASEÑA -->
        <td><?= htmlspecialchars($p['password_plain']) ?></td>

        <!-- 4) INICIO -->
        <td class="fi"><?= $ini_fmt ?></td>

        <!-- 5) FIN -->
        <td class="ff"><?= $fin_fmt ?></td>

        <!-- 6) DÍAS -->
        <td><?= $dias < 0 ? '<span class="text-danger">'.$dias.'</span>' : $dias ?></td>

        <!-- 7) PERFIL -->
        <!-- 7) PERFIL -->
<td><?= htmlspecialchars((string)($p['perfil'] ?? ''), ENT_QUOTES, 'UTF-8') ?></td>


        <!-- 8) CLIENTE -->
        <?php $cliente_display = format_cliente_num($__wa, $wa_num); ?>
        <td class="cliente text-nowrap"><?= htmlspecialchars($cliente_display) ?></td>

        <!-- 9) PRECIO -->
        <td><?= number_format((float)$p['soles'], 2) ?></td>

        <!-- 10) DISPOSITIVO -->
        <td><?= htmlspecialchars($p['dispositivo']) ?></td>

        <!-- 11) COMBO -->
        <td><?= $comboLabel ?></td>

        <!-- 12) ESTADO -->
        <td><span class="badge <?= $badgeClass ?> text-capitalize"><?= htmlspecialchars($estadoReal) ?></span></td>

        <!-- 13) ENTREGA -->
        <td class="whatsapp">
          <?php if ($wa_num !== ''): ?>
            <a class="wa-link"
               href="https://wa.me/<?= htmlspecialchars($wa_num, ENT_QUOTES); ?>?text=<?= $msg; ?>"
               target="_blank" rel="noopener"
               aria-label="WhatsApp" title="WhatsApp">
              <!-- ícono WA -->
              <i class="bi bi-whatsapp" aria-hidden="true"></i>
            </a>
          <?php endif; ?>
          <?php if ($tg_phone !== '' && $tg_phone !== '+'): ?>
            <a class="ms-2 tg-link"
               href="#"
               data-phone="<?= htmlspecialchars($tg_phone, ENT_QUOTES); ?>"
               data-no-row-modal="1"
               aria-label="Telegram" title="Telegram">
              <!-- ícono TG -->
              <i class="bi bi-telegram" aria-hidden="true"></i>
            </a>
          <?php endif; ?>
        </td>

        <!-- 14) ACCIONES -->
        <td class="text-nowrap">
          <button type="button"
                  class="btn btn-sm btn-primary btn-edit-perfil js-row-action"
                  data-bs-toggle="modal"
                  data-bs-target="#perfilModal"
                  data-row='<?= htmlspecialchars(json_encode($rowPerfil, JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT), ENT_QUOTES, "UTF-8") ?>'>Editar</button>
          <form action="../app/controllers/PerfilController.php" method="post" class="d-inline form-delete-perfil">
            <input type="hidden" name="action" value="delete">
            <input type="hidden" name="id" value="<?= (int)$p['id'] ?>">
            <input type="hidden" name="streaming_id" value="<?= (int)$p['streaming_id'] ?>">
            <button type="submit" class="btn btn-sm btn-outline-danger js-row-action">Borrar</button>
          </form>
        </td>
      </tr>
      <?php
          endforeach; // rows del grupo
        endforeach;   // grupos
      ?>
      </tbody>

            </tbody>

       </table>
 
    

  </div>
</div>



    
    
    
    
    
    
    
    
    
  
    
    
    

<!-- CUENTA COMPLETA -->
<div class="tab-pane fade" id="cuentas" role="tabpanel" aria-labelledby="cuentas-tab">

  <button type="button" class="btn btn-sm btn-primary btn-add-cuenta"
          data-bs-toggle="modal" data-bs-target="#cuentaModal"
          data-streaming_id="<?= (int)$streaming_id ?>" style="float: right;">Agregar Cuenta</button>
<a href="export_streaming_items.php?streaming_id=<?= $streaming_id ?>&tipo=cuentas"
   class="btn btn-sm btn-outline-success">
  Exportar Excel (Cuenta)
</a>

  <input type="number" step="0.01" min="0" style="float: right; margin-right:20px"
         id="precioCuentaHead" placeholder="S/ 0.00" aria-label="Precio cuenta">

  <!-- Filtros CUENTAS (solo esta pestaña) -->
  <div class="__cuFilter__ d-flex flex-wrap align-items-center gap-2 mb-2" data-scope="cuentas">
    <select class="form-select form-select-sm cu-main" style="max-width: 360px;">
      <option value="">— Filtro especial —</option>
      <option value="color_rojo">Color ROJO (padres)</option>
      <option value="color_azul">Color AZUL (padres)</option>
      <option value="color_verde">Color VERDE (padres)</option>
      <option value="pendientes">Pendientes por activar</option>
      <option value="dias_asc">Menos días</option>
      <option value="dias_desc">Mayor días</option>
      <option value="plan">Plan…</option>
    </select>

    <select class="form-select form-select-sm cu-plan" style="max-width: 220px; display: none;">
      <option value="">— Selecciona plan —</option>
      <option value="basico">Básico (incluye “Individual”)</option>
      <option value="estandar">Estándar</option>
      <option value="premium">Premium</option>
    </select>

    <input type="search" placeholder="Buscar por correo o WhatsApp"
           class="form-control form-control-sm cu-search js-whatsapp-search" style="max-width: 280px;">
    <button type="button" class="btn btn-sm btn-outline-secondary cu-clear">Limpiar</button>
  </div>

  <div class="table-responsive">
    <table class="table align-middle table-bordered" id="cuentasTable">
      <thead>
      <tr>
        <th>Plan</th>
        <th>Correo</th>
        <th>Contraseña</th>
        <th>Inicio</th>
        <th>Fin</th>
        <th>Días</th>
        <th>Perfil</th>
        <th>Cliente</th>
        <th>Precio</th>
        <th>Dispositivo</th>
        <th>Combo</th>
        <th>Estado</th>
        <th>Entrega</th>
        <th>Acciones</th>
      </tr>
      </thead>

<?php
// Helper para cliente (compartido con Perfiles)
if (!function_exists('format_cliente_num')) {
  function format_cliente_num(string $wa_e164 = '', string $wa_digits = ''): string {
    $digits = ltrim($wa_e164 !== '' ? $wa_e164 : $wa_digits, '+');
    if ($digits === '') return '';
    if (strlen($digits) > 9) {
      $cc    = substr($digits, 0, strlen($digits) - 9);
      $local = substr($digits, -9);
      return '+' . $cc . ' ' . substr($local,0,3) . ' ' . substr($local,3,3) . ' ' . substr($local,6,3);
    }
    if (strlen($digits) === 9) {
      return substr($digits,0,3) . ' ' . substr($digits,3,3) . ' ' . substr($digits,6,3);
    }
    return ($wa_e164 !== '' && $wa_e164[0] === '+') ? $wa_e164 : ('+' . $digits);
  }
}

// (si no lo tienes arriba en la vista)
$hoy = $hoy ?? date('Y-m-d');
?>

      <tbody>
<?php
  // Conteo por correo (padre con hijos)
  $cuentaCorreoCounts = [];
  foreach ($cuentas as $cc) {
    $k = (string)($cc['correo'] ?? '');
    if ($k !== '') $cuentaCorreoCounts[$k] = ($cuentaCorreoCounts[$k] ?? 0) + 1;
  }

  $lastCorreo = null;
  $lastDayKey = null;
  $meses = ['', 'enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

  foreach ($cuentas as $c):

    // Separador por día (usa created_at)
    $createdRaw = $c['created_at'] ?? '';
    $ts = $createdRaw ? strtotime($createdRaw) : 0;
    $dayKey = $ts ? date('Y-m-d', $ts) : '';
    if ($dayKey && $dayKey !== $lastDayKey) {
      $diaLabel = date('j', $ts) . ' ' . $meses[(int)date('n', $ts)];
      echo '<tr data-sep="1" class="table-light"><td colspan="14" class="py-1 fw-semibold text-muted">'
         . htmlspecialchars($diaLabel, ENT_QUOTES, 'UTF-8')
         . '</td></tr>';
      $lastDayKey = $dayKey;
    }

    $showCorreo  = ($c['correo'] !== $lastCorreo);
    $hasChildren = (($cuentaCorreoCounts[$c['correo']] ?? 0) > 1);

    $dias       = (int) floor((strtotime($c['fecha_fin']) - strtotime($hoy))/86400);
    $estadoReal = $dias < 0 ? 'moroso' : $c['estado'];
    $badgeClass = estado_badge_class($estadoReal);

    // Default visual/atributos a 'premium' cuando plan está vacío
    $plan = (string)($c['plan'] ?? '');
    $plan = $plan !== '' ? $plan : 'premium';

    $comboLabel = ((int)($c['combo'] ?? 0) === 1) ? 'Sí' : 'No';

    $__correo = (string)$c['correo'];
    $__fin    = (string)$c['fecha_fin'];
    $__wa     = (string)$c['whatsapp'];
    $__wa     = preg_replace('/\s+/', '', $__wa);
    $__wa     = preg_replace('/(?!^)\+/', '', $__wa);
    $__wa     = preg_replace('/[^\d\+]/', '', $__wa);
    if ($__wa === '+') { $__wa = ''; }
    $wa_num   = ltrim($__wa, '+');
    $tg_phone = ($__wa !== '' && $__wa[0] === '+') ? $__wa : ($__wa !== '' ? ('+' . $__wa) : '');
    $msg      = rawurlencode($__correo . ' - ' . $__fin);

    $__color      = isset($c['color']) ? strtolower((string)$c['color']) : '';
    $__allowed    = ['rojo','azul','verde','blanco'];
    $__color      = in_array($__color, $__allowed, true) ? $__color : '';
    $__colorClass = $__color ? (' row-color-'.htmlspecialchars($__color, ENT_QUOTES, 'UTF-8')) : '';

    $ini_fmt_c = (!empty($c['fecha_inicio']) && $c['fecha_inicio'] !== '0000-00-00' && $c['fecha_inicio'] !== '0000-00-00 00:00:00')
      ? date('d/m/y', strtotime($c['fecha_inicio'])) : '';
    $fin_fmt_c = (!empty($c['fecha_fin']) && $c['fecha_fin'] !== '0000-00-00' && $c['fecha_fin'] !== '0000-00-00 00:00:00')
      ? date('d/m/y', strtotime($c['fecha_fin'])) : '';
?>
<tr class="<?= trim(($showCorreo ? 'js-parent-row cursor-pointer' . ($hasChildren ? ' has-children' : '') : '') . $__colorClass) ?>"
  <?php if ($showCorreo): ?>
    data-id="<?= (int)$c['id'] ?>"
    data-entidad="cuenta"
    data-correo="<?= htmlspecialchars($c['correo'], ENT_QUOTES) ?>"
    data-password="<?= htmlspecialchars($c['password_plain'], ENT_QUOTES) ?>"
    data-soles="<?= htmlspecialchars($c['soles'], ENT_QUOTES) ?>"
    data-plan="<?= htmlspecialchars($plan, ENT_QUOTES) ?>"
    data-combo="<?= (int)($c['combo'] ?? 0) ?>"
    data-streaming_id="<?= (int)$c['streaming_id'] ?>"
    <?= $__color ? 'data-color="'.htmlspecialchars($__color, ENT_QUOTES, 'UTF-8').'"' : '' ?>
    role="button" tabindex="0"
  <?php endif; ?>
>
  <td class="plan-cell-cuenta" data-id="<?= (int)$c['id'] ?>" role="button" tabindex="0" data-cu-id="<?= (int)$c['id'] ?>">
    <?= $showCorreo ? htmlspecialchars($plan) : '' ?>
  </td>
  <td><?= $showCorreo ? htmlspecialchars($c['correo']) : '' ?></td>
  <td><?= htmlspecialchars($c['password_plain']) ?></td>
  <td class="fi"><?= $ini_fmt_c ?></td>
  <td class="ff"><?= $fin_fmt_c ?></td>
  <td><?= $dias < 0 ? '<span class="text-danger">'.$dias.'</span>' : $dias ?></td>
  <td><?= htmlspecialchars($c['cuenta']) ?></td>
  <?php $cliente_display = format_cliente_num($__wa, $wa_num); ?>
  <td class="cliente text-nowrap"><?= htmlspecialchars($cliente_display) ?></td>
  <td><?= number_format((float)$c['soles'], 2) ?></td>
  <td><?= htmlspecialchars($c['dispositivo']) ?></td>
  <td><?= $comboLabel ?></td>
  <td><span class="badge <?= $badgeClass ?> text-capitalize"><?= htmlspecialchars($estadoReal) ?></span></td>
  <td class="whatsapp">
    <?php if ($wa_num !== ''): ?>
      <a class="wa-link js-row-action"
         data-no-row-modal="1"
         onclick="event.stopPropagation();"
         href="https://wa.me/<?= htmlspecialchars($wa_num, ENT_QUOTES); ?>?text=<?= $msg; ?>"
         target="_blank" rel="noopener"
         aria-label="WhatsApp" title="WhatsApp">
        <!-- ícono -->
       <i class="bi bi-whatsapp" aria-hidden="true"></i>
      </a>
    <?php endif; ?>
    <?php if ($tg_phone !== '' && $tg_phone !== '+'): ?>
      <a class="ms-2 tg-link js-row-action"
         data-no-row-modal="1"
         onclick="event.stopPropagation();"
         href="#"
         data-phone="<?= htmlspecialchars($tg_phone, ENT_QUOTES); ?>"
         aria-label="Telegram" title="Telegram">
        <i class="bi bi-telegram" aria-hidden="true"></i>
      </a>
    <?php endif; ?>
  </td>
  <td class="text-nowrap">
    <button type="button"
            class="btn btn-sm btn-primary btn-edit-cuenta js-row-action"
            data-bs-toggle="modal"
            data-bs-target="#cuentaModal"
            data-row='<?= row_json_attr([
              "id"            => (int)$c["id"],
              "streaming_id"  => (int)$c["streaming_id"],
              "correo"        => (string)$c["correo"],
              "password_plain"=> (string)$c["password_plain"],
              "cuenta"        => (string)$c["cuenta"],
              "whatsapp"      => (string)$c["whatsapp"],
              "fecha_inicio"  => (string)$c["fecha_inicio"],
              "fecha_fin"     => (string)$c["fecha_fin"],
              "soles"         => (string)$c["soles"],
              "estado"        => (string)$c["estado"],
              "dispositivo"   => (string)$c["dispositivo"],
              "plan"          => $plan,
              "combo"         => (int)($c["combo"] ?? 0),
            ]) ?>'>Editar</button>

    <form action="../app/controllers/CuentaController.php" method="post" class="d-inline form-delete-cuenta">
      <input type="hidden" name="action" value="delete">
      <input type="hidden" name="id" value="<?= (int)$c['id'] ?>">
      <input type="hidden" name="streaming_id" value="<?= (int)$c['streaming_id'] ?>">
      <button type="submit" class="btn btn-sm btn-outline-danger js-row-action" data-no-row-modal="1">Borrar</button>
    </form>
  </td>
</tr>
<?php
    $lastCorreo = $c['correo'];
  endforeach;
?>
      </tbody>
    </table>
  </div>
</div>











<!-- STREAMING FAMILIAR (pane completo con celdas “presentes” y ocultas vía visibility) -->
<div class="tab-pane fade" id="perfiles-familiar" role="tabpanel" aria-labelledby="perfiles-familiar-tab">

  <!-- Estilos: bordes y helper .vh (oculta pero mantiene espacio) -->
  <style>
    #perfilesFamiliarTable,
    #perfilesFamiliarTable th,
    #perfilesFamiliarTable td { border-color:#000 !important; }
    #perfilesFamiliarTable th:first-child,
    #perfilesFamiliarTable td:first-child { border-left:1px solid #000 !important; }

    /* Oculta visualmente el contenido pero conserva el espacio del elemento */
    #perfilesFamiliarTable .vh { visibility: hidden; display: inline-block; width: 100%; }
  </style>

  <!-- Botón + precio cabecera -->
  <div class="d-flex align-items-center flex-wrap gap-2" style="float: right;">
    <button type="button"
      class="btn btn-sm btn-primary btn-add-perfil-fam"
      data-bs-toggle="modal"
      data-bs-target="#perfilFamiliarModal"
      data-modal-context="parent">Agregar familiar</button>
    <a href="export_streaming_items.php?streaming_id=<?= $streaming_id ?>&tipo=familiar"
   class="btn btn-sm btn-outline-success">
  Exportar Excel (Familiar)
</a>


    <input
      id="precioFamiliarHead"
      name="precioFamiliarHead"
      type="number"
      step="0.01"
      min="0"
      class="form-control"
      placeholder="0.00"
      inputmode="decimal"
      style="width:120px">
  </div>

  <!-- Filtros (aislados por scope) -->
  <div class="__pcFilter__ d-flex flex-wrap align-items-center gap-2 mb-2" data-scope="perfiles-fam">
    <select class="form-select form-select-sm pc-main" style="max-width: 360px;">
      <option value="">— Filtro especial —</option>
      <option value="color_rojo">Color ROJO (padres)</option>
      <option value="color_azul">Color AZUL (padres)</option>
      <option value="color_verde">Color VERDE (padres)</option>
      <option value="pendientes">Pendientes por activar</option>
      <option value="dias_asc">Menos días</option>
      <option value="dias_desc">Mayor días</option>
      <option value="plan">Plan…</option>
    </select>

    <select class="form-select form-select-sm pc-plan" style="max-width: 220px; display: none;">
      <option value="">— Selecciona plan —</option>
      <option value="basico">Básico (incluye “Individual”)</option>
      <option value="estandar">Estándar</option>
      <option value="premium">Premium</option>
    </select>

    <input type="search" placeholder="Buscar por correo o WhatsApp" class="form-control form-control-sm pc-search js-whatsapp-search" style="max-width: 280px;">
    <button type="button" class="btn btn-sm btn-outline-secondary pc-clear">Limpiar</button>
  </div>

  <?php
  // Carga de registros familiar (vía modelo dedicado)
  $perfilesFam = PerfilFamiliarModel::byStreaming($streaming_id);


if (!function_exists('format_cliente_num')) {
    function format_cliente_num(string $wa_e164 = '', string $wa_digits = ''): string {
      $digits = ltrim($wa_e164 !== '' ? $wa_e164 : $wa_digits, '+');
      if ($digits === '') return '';
      if (strlen($digits) > 9) {
        $cc    = substr($digits, 0, strlen($digits) - 9);
        $local = substr($digits, - 9);
        return '+' . $cc . ' ' . substr($local,0,3) . ' ' . substr($local,3,3) . ' ' . substr($local,6,3);
      }
      if (strlen($digits) === 9) {
        return substr($digits,0,3) . ' ' . substr($digits,3,3) . ' ' . substr($digits,6,3);
      }
      return ($wa_e164 !== '' && $wa_e164[0] === '+') ? $wa_e164 : ('+' . $digits);
    }
  }

  // === Agrupar por correo y calcular anclas/actividad (FAMILIAR) ===
  $famGroups = [];
  foreach ($perfilesFam as $row) {
    $correo = (string)($row['correo'] ?? '');
    if ($correo === '') continue;
    $famGroups[$correo][] = $row;
  }

  $tsCreated = function(array $r): int {
    $raw = $r['created_at'] ?? $r['createdAt'] ?? $r['fecha_creacion'] ?? '';
    $t   = $raw ? strtotime($raw) : 0;
    return $t ?: (int)($r['id'] ?? 0);
  };
  $tsUpdated = function(array $r) use ($tsCreated): int {
    $raw = $r['updated_at'] ?? $r['updatedAt'] ?? '';
    $t   = $raw ? strtotime($raw) : 0;
    return $t ?: $tsCreated($r);
  };

  $famCountsByCorreo      = [];
  $famParentIdByCorreo    = [];
  $famFirstPriceByCorreo  = [];
  $famParentDayTsByCorreo = [];
  $famLastActByCorreo     = [];

  foreach ($famGroups as $correo => &$rows) {
    // Orden interno: padre primero (antiguo → reciente)
    usort($rows, function($a,$b) use($tsCreated){
      $ta = $tsCreated($a); $tb = $tsCreated($b);
      if ($ta === $tb) return ((int)$a['id']) <=> ((int)$b['id']);
      return $ta <=> $tb;
    });

    $famCountsByCorreo[$correo]      = count($rows);
    $famParentIdByCorreo[$correo]    = (int)($rows[0]['id'] ?? 0);
    $famParentDayTsByCorreo[$correo] = $tsCreated($rows[0]);

    if (count($rows) > 1) {
      $firstChild = $rows[1];
      $famFirstPriceByCorreo[$correo] = isset($firstChild['soles']) ? (float)$firstChild['soles'] : null;
    } else {
      $famFirstPriceByCorreo[$correo] = null;
    }

    $maxAct = 0;
    foreach ($rows as $r) {
      $act = $tsUpdated($r);
      if ($act > $maxAct) $maxAct = $act;
    }
    $famLastActByCorreo[$correo] = $maxAct;
  }
  unset($rows);

  // Ordenar grupos por actividad reciente DESC
  uksort($famGroups, function($a,$b) use($famLastActByCorreo){
    return ($famLastActByCorreo[$b] ?? 0) <=> ($famLastActByCorreo[$a] ?? 0);
  });

  $hoy        = date('Y-m-d');
  $meses      = ['', 'enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  $lastDayKey = null;
  ?>

  <div class="table-responsive">
    <table class="table align-middle table-bordered" id="perfilesFamiliarTable">
      <thead>
      <tr>
        <th>Plan</th>
        <th>Correo</th>
        <th>Contraseña</th>
        <th>Inicio</th>
        <th>Fin</th>
        <th>Días</th>
        <th>Perfil</th>
        <th>Cliente</th>
        <th>Precio</th>
        <th>Dispositivo</th>
        <th>Combo</th>
        <th>Estado</th>
        <th>Entrega</th>
        <th>Acciones</th>
      </tr>
      </thead>
      <tbody>
      <?php foreach ($famGroups as $correoKey => $rows):
        // Separador por día del PADRE (anclado)
        $pTs    = (int)($famParentDayTsByCorreo[$correoKey] ?? 0);
        $dayKey = $pTs ? date('Y-m-d', $pTs) : '';
        if ($dayKey && $dayKey !== $lastDayKey) {
          $diaLabel = date('j', $pTs) . ' ' . $meses[(int)date('n', $pTs)];
          echo '<tr data-sep="1" class="table-light"><td colspan="14" class="py-1 fw-semibold text-muted">'
              . htmlspecialchars($diaLabel, ENT_QUOTES, 'UTF-8')
              . '</td></tr>';
          $lastDayKey = $dayKey;
        }

        $hasChildren = (($famCountsByCorreo[$correoKey] ?? 0) > 1);

        foreach ($rows as $idx => $p):
          $isParent   = ((int)$p['id'] === (int)($famParentIdByCorreo[$correoKey] ?? 0));
          $showCorreo = $isParent;

          $dias       = (int) floor((strtotime($p['fecha_fin']) - strtotime($hoy))/86400);
          $estadoReal = $dias < 0 ? 'moroso' : $p['estado'];
          $badgeClass = $estadoReal === 'pendiente' ? 'bg-warning text-dark' : ($estadoReal === 'moroso' ? 'bg-danger' : 'bg-light text-dark');

          $plan       = (string)($p['plan'] ?? 'individual');
          $comboLabel = ((int)($p['combo'] ?? 0) === 1) ? 'Sí' : 'No';

          $ini_fmt = (!empty($p['fecha_inicio']) && $p['fecha_inicio'] !== '0000-00-00' && $p['fecha_inicio'] !== '0000-00-00 00:00:00')
            ? date('d/m/y', strtotime($p['fecha_inicio'])) : '';
          $fin_fmt = (!empty($p['fecha_fin']) && $p['fecha_fin'] !== '0000-00-00' && $p['fecha_fin'] !== '0000-00-00 00:00:00')
            ? date('d/m/y', strtotime($p['fecha_fin'])) : '';

          // WhatsApp / Cliente
          $__wa   = (string)($p['whatsapp'] ?? '');
          $__wa   = preg_replace('/\s+/', '', $__wa);
          $__wa   = preg_replace('/(?!^)\+/', '', $__wa);
          $__wa   = preg_replace('/[^\d\+]/', '', $__wa);
          if ($__wa === '+') { $__wa = ''; }
          $wa_num   = ltrim($__wa, '+');
          $tg_phone = ($__wa !== '' && $__wa[0] === '+') ? $__wa : ($__wa !== '' ? ('+' . $__wa) : '');
          $msg      = rawurlencode(($p['correo'] ?? '') . ' - ' . ($p['fecha_fin'] ?? ''));

          // Color de fila (opcional)
          $__color      = isset($p['color']) ? strtolower((string)$p['color']) : '';
          $__allowed    = ['rojo','azul','verde','blanco'];
          $__color      = in_array($__color, $__allowed, true) ? $__color : '';
          $__colorClass = $__color ? ' row-color-'.htmlspecialchars($__color, ENT_QUOTES, 'UTF-8') : '';

          // Anchor price: precio del 1er hijo si existe (solo expuesto en el padre)
          $anchorAttr = '';
          if ($isParent && $hasChildren) {
            $ap = $famFirstPriceByCorreo[$correoKey] ?? null;
            if ($ap !== null && $ap !== '') {
              $anchorAttr = number_format((float)$ap, 2, '.', '');
            }
          }

          // === Atributos del <tr> padre (exponer señales útiles) ===
          $__parentAttrs = '';
          if ($showCorreo) {
            $attrs = [
              'data-id="'.(int)$p['id'].'"',
              'data-entidad="familiar"',
              'data-modal-context="child"', // ← esta fila abre HIJO
              'data-correo="'.htmlspecialchars($p['correo'], ENT_QUOTES).'"',
              'data-password="'.htmlspecialchars($p['password_plain'] ?? '', ENT_QUOTES).'"',
              'data-soles="'.htmlspecialchars($p['soles'] ?? '', ENT_QUOTES).'"',
              'data-plan="'.htmlspecialchars($plan, ENT_QUOTES).'"',
              'data-combo="'.(int)($p['combo'] ?? 0).'"',
              'data-streaming_id="'.(int)$p['streaming_id'].'"',
              'data-has-child="'.($hasChildren ? '1' : '0').'"',

              // Trigger del modal único
              'data-bs-toggle="modal"',
              'data-bs-target="#perfilFamiliarModal"',

              'role="button"',
              'tabindex="0"',
            ];
            if ($anchorAttr !== '') {
              $attrs[] = 'data-first-child-price="'.htmlspecialchars($anchorAttr, ENT_QUOTES).'"';
            }
            if ($__color) {
              $attrs[] = 'data-color="'.htmlspecialchars($__color, ENT_QUOTES).'"';
            }
            $__parentAttrs = ' '.implode(' ', $attrs);
          }
      ?>
      <tr class="<?= trim(($showCorreo ? 'js-parent-row cursor-pointer'.($hasChildren ? ' has-children' : '') : 'is-child').$__colorClass) ?>"<?= $__parentAttrs ?>>


        <!-- Plan -->
        <?php if ($isParent): ?>
          <td class="plan-cell-familiar"
              data-id="<?= (int)$p['id'] ?>"
              data-plan="<?= htmlspecialchars($p['plan'] ?? 'premium', ENT_QUOTES, 'UTF-8') ?>"
              data-no-row-modal="1"
              onclick="event.stopPropagation();"
              role="button" tabindex="0">
            <?= htmlspecialchars($p['plan'] ?? 'premium', ENT_QUOTES, 'UTF-8') ?>
          </td>
        <?php else: ?>
          <!-- hijo: celda “vacía” real para mantener alineado -->
          <td class="plan-cell-familiar">
            <span class="vh">&nbsp;</span>
          </td>
        <?php endif; ?>

        <!-- Correo (padre e hijo lo muestran) -->
        <td class="correo-cell<?= $showCorreo ? '' : ' child-gap' ?>">
          <?= htmlspecialchars($p['correo']) ?>
        </td>

        <!-- Contraseña -->
        <?php if ($isParent): ?>
          <td><?= htmlspecialchars($p['password_plain']) ?></td>
        <?php else: ?>
          <td><span class="vh">&nbsp;</span></td>
        <?php endif; ?>

        <!-- Inicio -->
        <td>
          <span class="<?= $showCorreo ? 'vh' : '' ?>">
            <?= $ini_fmt ?: '&nbsp;' ?>
          </span>
        </td>

        <!-- Fin -->
        <td>
          <span class="<?= $showCorreo ? 'vh' : '' ?>">
            <?= $fin_fmt ?: '&nbsp;' ?>
          </span>
        </td>

        <!-- Días -->
        <td>
          <span class="<?= $showCorreo ? 'vh' : '' ?>">
            <?= $dias < 0 ? '<span class="text-danger">'.$dias.'</span>' : $dias ?>
          </span>
        </td>

        <!-- Perfil -->
        <td>
          <span class="<?= $showCorreo ? 'vh' : '' ?>">
            <?= htmlspecialchars($p['perfil'] ?? '') ?: '&nbsp;' ?>
          </span>
        </td>

        <!-- Cliente -->
        <?php $cliente_display = format_cliente_num('', $wa_num); ?>
        <td class="cliente text-nowrap">
          <span class="<?= $showCorreo ? 'vh' : '' ?>">
            <?= htmlspecialchars($cliente_display) ?: '&nbsp;' ?>
          </span>
        </td>

        <!-- Precio -->
        <td>
          <span class="<?= $showCorreo ? 'vh' : '' ?>">
            <?= number_format((float)$p['soles'], 2) ?>
          </span>
        </td>

        <!-- Dispositivo -->
        <td>
          <span class="<?= $showCorreo ? 'vh' : '' ?>">
            <?= htmlspecialchars($p['dispositivo']) ?: '&nbsp;' ?>
          </span>
        </td>

        <!-- Combo -->
        <td>
          <span class="<?= $showCorreo ? 'vh' : '' ?>">
            <?= $comboLabel ?>
          </span>
        </td>

        <!-- Estado -->
        <td>
          <span class="<?= $showCorreo ? 'vh' : '' ?>">
            <span class="badge <?= $badgeClass ?> text-capitalize"><?= htmlspecialchars($estadoReal) ?></span>
          </span>
        </td>

        <!-- Entrega (WhatsApp / Telegram) -->
        <td class="whatsapp">
          <span class="<?= $showCorreo ? 'vh' : '' ?>">
            <?php if ($wa_num !== ''): ?>
              <a class="wa-link js-row-action"
                 data-no-row-modal="1"
                 onclick="event.stopPropagation();"
                 href="https://wa.me/<?= htmlspecialchars($wa_num, ENT_QUOTES); ?>?text=<?= $msg; ?>"
                 target="_blank" rel="noopener"
                 aria-label="WhatsApp" title="WhatsApp">
                <i class="bi bi-whatsapp" aria-hidden="true"></i>
              </a>
            <?php endif; ?>
            <?php if ($tg_phone !== '' && $tg_phone !== '+'): ?>
              <a class="ms-2 tg-link js-row-action"
                 data-no-row-modal="1"
                 onclick="event.stopPropagation();"
                 href="#"
                 data-phone="<?= htmlspecialchars($tg_phone, ENT_QUOTES); ?>"
                 aria-label="Telegram" title="Telegram">
                <i class="bi bi-telegram" aria-hidden="true"></i>
              </a>
            <?php endif; ?>
            <?= ($wa_num === '' && ($tg_phone === '' || $tg_phone === '+')) ? '&nbsp;' : '' ?>
          </span>
        </td>

        <!-- Acciones -->
        <td class="text-nowrap">
          <button
  type="button"
  class="btn btn-sm btn-primary btn-edit-perfil-fam js-row-action"
  data-no-row-modal="1"
  data-row='<?= htmlspecialchars(json_encode($p, JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT), ENT_QUOTES, "UTF-8") ?>'>
  Editar
</button>



         <button
  type="button"
  class="btn btn-sm btn-danger btnDeleteFamiliar js-row-action"
  data-no-row-modal="1"
  data-id="<?= $p['id']; ?>"
>
  <i class="bi bi-trash"></i>
</button>

        </td>

      </tr>
      <?php endforeach; // rows del grupo ?>
      <?php endforeach; // grupos ?>
      </tbody>
    </table>
  </div>
</div>



<script>
(function(){
  if (window.__famEditBindV1) return; window.__famEditBindV1 = true;

  const m = document.getElementById('perfilFamiliarModal');
  if (!m) return;

  const $ = (s) => m.querySelector(s);
  const setByName = (name, val) => {
    const el = m.querySelector('[name="'+name+'"]');
    if (el) el.value = (val == null ? '' : String(val));
  };

  m.addEventListener('show.bs.modal', function(ev){
    const t = ev.relatedTarget;
    const isEdit = t && t.classList && t.classList.contains('btn-edit-perfil-fam');
    if (!isEdit) return; // otros flujos (agregar hijo / agregar familiar) quedan con tu lógica actual

    // Forzar contexto edición
    m.dataset.context = 'edit';

    // Prefill desde data-row
    let row = {};
    try { row = JSON.parse(t.getAttribute('data-row') || '{}'); } catch(_){}

    const title  = m.querySelector('.modal-title');
    const submit = m.querySelector('button[type="submit"]');

    if (title)  title.textContent = 'Editar Perfil (familiar)';
    if (submit) submit.textContent = 'Guardar cambios';

    setByName('action', 'update');
    setByName('id', row.id || '');
    setByName('streaming_id', row.streaming_id || '');
    setByName('correo', row.correo || '');
    setByName('password_plain', row.password_plain || '');
    setByName('perfil', row.perfil || '');
    setByName('soles', row.soles || '');

    // Fechas a YYYY-MM-DD
    setByName('fecha_inicio', (row.fecha_inicio || '').slice(0,10));
    setByName('fecha_fin', (row.fecha_fin || '').slice(0,10));

    // Selects
    const est  = $('select[name="estado"]');       if (est)  est.value  = row.estado || 'activo';
    const disp = $('select[name="dispositivo"]');  if (disp) disp.value = row.dispositivo || 'tv';
    const combo= $('select[name="combo"]');        if (combo) combo.value= (row.combo!=null ? String(row.combo) : '0');

    // En edición, que correo sea editable (o ajústalo a tu gusto)
    const correoInp = $('input[name="correo"]');
    if (correoInp){ correoInp.readOnly = false; correoInp.classList.remove('bg-light'); }

    // Si tienes lógica de “precio ancla” para crear-hijo, desactívala en edición:
    const priceInp = $('input[name="soles"]');
    if (priceInp){
      priceInp.removeAttribute('readonly');
      priceInp.dataset.anchorLock = '0';
    }
  });

  // Limpieza al cerrar
  m.addEventListener('hidden.bs.modal', function(){
    delete m.dataset.context;
  });
})();
</script>





<!-- Oculta Plan y Contraseña sólo en hijos manteniendo el ancho/alineado -->
<style>
  #perfilesFamiliarTable td.child-hide{
    color: transparent !important;
    border-color: transparent !important;
    background: transparent !important;
    pointer-events: none !important;
  }
  #perfilesFamiliarTable tr.is-child td.plan-cell-familiar{
    cursor: default !important;
  }
</style>




















<!-- STOCK -->
<div class="tab-pane fade" id="stock" role="tabpanel" aria-labelledby="stock-tab">
  <div class="d-flex justify-content-end mb-2" style="float: right;">
    <?php
    $__sid = 0;
    if (isset($streaming['id'])) $__sid = (int)$streaming['id'];
    elseif (isset($_GET['streaming_id'])) $__sid = (int)$_GET['streaming_id'];
    elseif (isset($_GET['streaming'])) $__sid = (int)$_GET['streaming'];
    ?>
    <button type="button"
            id="btn-add-stock"
            class="btn btn-sm btn-primary"
            data-streaming_id="<?= $__sid ?>"
            data-bs-toggle="modal"
            data-bs-target="#modalAgregarStock"
            data-no-row-modal="1"
            style="float: right;">Agregar Stock</button>
            
            <a href="export_streaming_items.php?streaming_id=<?= $streaming_id ?>&tipo=stock"
   class="btn btn-sm btn-outline-success">
  Exportar Excel (Stock)
</a>

  </div>
  
  

  <!-- Filtros STOCK -->
  <div class="__spFilter__ d-flex flex-wrap align-items-center gap-2 mb-2" data-scope="stock">
    <select class="form-select form-select-sm sp-color" style="max-width: 220px;">
      <option value="">Color: todos</option>
      <option value="rojo">Rojo</option>
      <option value="azul">Azul</option>
      <option value="verde">Verde</option>
      <option value="blanco">Blanco</option>
    </select>
    <select class="form-select form-select-sm sp-plan" style="max-width: 240px;">
      <option value="">Plan: todos</option>
      <option value="basico">Básico (incluye Individual)</option>
      <option value="estandar">Estándar</option>
      <option value="premium">Premium</option>
    </select>
    <input type="search" class="form-control form-control-sm sp-search js-whatsapp-search" style="max-width: 280px;" placeholder="Buscar correo…">
    <button type="button" class="btn btn-sm btn-outline-secondary sp-clear">Limpiar</button>
  </div>

  <div class="table-responsive">
    <table class="table align-middle table-bordered" style="--bs-border-color:#000;" data-no-row-modal="1" id="stockTable">
      <thead>
        <tr>
          <th>Plan</th>
          <th>Correo</th>
          <th>Contraseña</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
<?php
  $stmt = $pdo->prepare("
    SELECT id, streaming_id, plan, color, correo, password_plain, whatsapp, perfil, combo, soles, estado, dispositivo, fecha_inicio, fecha_fin, created_at
    FROM perfiles_stock
    WHERE streaming_id = :sid
    ORDER BY created_at DESC, id DESC
  ");
  $stmt->execute([':sid' => $streaming_id]);
  $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

  $lastDayKey = null;
  $meses = ['', 'enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

  foreach ($rows as $r):
    // Separador por día
    $createdRaw = $r['created_at'] ?? '';
    $ts = $createdRaw ? strtotime($createdRaw) : 0;
    $dayKey = $ts ? date('Y-m-d', $ts) : '';
    if ($dayKey && $dayKey !== $lastDayKey) {
      $diaLabel = date('j', $ts) . ' ' . $meses[(int)date('n', $ts)];
      echo '<tr data-sep="1" class="table-light"><td colspan="4" class="py-1 fw-semibold text-muted">'
         . htmlspecialchars($diaLabel, ENT_QUOTES, 'UTF-8')
         . '</td></tr>';
      $lastDayKey = $dayKey;
    }

    $plan   = $r['plan'] ?? 'individual';
    $combo  = isset($r['combo']) ? (int)$r['combo'] : 0;

    // Color saneado y atributos para persistir en DOM
    $__rawColor = strtolower((string)($r['color'] ?? ''));
    $__allowed  = ['rojo','azul','verde','blanco'];
    $__color    = in_array($__rawColor, $__allowed, true) ? $__rawColor : '';
    $__rowCls   = $__color ? ('row-color-' . $__color) : '';

    $rowData = [
      'id'            => (int)$r['id'],
      'streaming_id'  => (int)$r['streaming_id'],
      'correo'        => (string)$r['correo'],
      'password_plain'=> (string)$r['password_plain'],
      'whatsapp'      => (string)$r['whatsapp'],
      'fecha_inicio'  => (string)$r['fecha_inicio'],
      'fecha_fin'     => (string)$r['fecha_fin'],
      'perfil'        => (string)($r['perfil'] ?? ''),
      'soles'         => (string)$r['soles'],
      'estado'        => (string)$r['estado'],
      'dispositivo'   => (string)$r['dispositivo'],
      'plan'          => (string)$plan,
      'combo'         => (int)$combo,
    ];
    $dataAttrJson = htmlspecialchars(json_encode($rowData), ENT_QUOTES, 'UTF-8');
?>
<tr class="<?= htmlspecialchars($__rowCls, ENT_QUOTES) ?>"
    data-id="<?= (int)$r['id'] ?>"
  data-streaming_id="<?= (int)$row['streaming_id'] ?>"
  data-correo="<?= htmlspecialchars($row['correo']) ?>"
  data-entidad="stock"
    data-color="<?= htmlspecialchars($__color, ENT_QUOTES) ?>">
  <td class="plan-cell-stock"
      data-id="<?= (int)$r['id'] ?>"
      data-plan="<?= htmlspecialchars($plan, ENT_QUOTES) ?>"
      role="button" tabindex="0">
    <?= htmlspecialchars($plan, ENT_QUOTES) ?>
  </td>
  <td><?= htmlspecialchars($r['correo']); ?></td>
  <td><?= htmlspecialchars($r['password_plain']); ?></td>
  <td class="text-nowrap">
    <button type="button"
            class="btn btn-sm btn-outline-primary btn-edit-stock js-row-action"
            data-bs-toggle="modal"
            data-bs-target="#modalEditarStock"
            data-no-row-modal="1"
            onclick="event.stopPropagation();"
            data-row="<?= $dataAttrJson ?>">Editar</button>
    <form action="ajax/stock_delete.php"
      method="post"
      class="d-inline form-delete-stock">
  <input type="hidden" name="id" value="<?= (int)$r['id'] ?>">
  <button type="submit" class="btn btn-sm btn-outline-danger js-row-action">
    Borrar
  </button>
</form>

<script>
    // BORRAR EN STOCK con SweetAlert
document.addEventListener('submit', function (e) {
  const form = e.target.closest('.form-delete-stock');
  if (!form) return; // no es un form de stock

  e.preventDefault();

  Swal.fire({
    title: '¿Eliminar registro en STOCK?',
    text: 'Esta acción no se puede deshacer.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, borrar',
    cancelButtonText: 'Cancelar'
  }).then((result) => {
    if (!result.isConfirmed) return;

    fetch(form.action, {
      method: 'POST',
      body: new FormData(form)
    })
      .then(r => r.json())
      .then(resp => {
        if (!resp.ok) {
          Swal.fire('Error', resp.error || 'No se pudo borrar el registro.', 'error');
          return;
        }

        Swal.fire('Eliminado', 'El registro en STOCK fue eliminado correctamente.', 'success')
          .then(() => {
            location.reload();
          });
      })
      .catch(err => {
        console.error(err);
        Swal.fire('Error', 'Error de comunicación con el servidor.', 'error');
      });
  });
});

</script>


  </td>
</tr>
<?php endforeach; ?>

<?php if (empty($rows)): ?>
  <tr><td colspan="4" class="text-center">Sin registros</td></tr>
<?php endif; ?>
      </tbody>
    </table>
  </div>
</div>




<!-- PAUSA -->
<div class="tab-pane fade" id="pausa" role="tabpanel" aria-labelledby="pausa-tab">
  <div class="d-flex justify-content-end mb-2" style="float: right">
<?php
if (!isset($__sid)) {
  $__sid = 0;
  if (isset($streaming['id'])) $__sid = (int)$streaming['id'];
  elseif (isset($_GET['streaming_id'])) $__sid = (int)$_GET['streaming_id'];
  elseif (isset($_GET['streaming'])) $__sid = (int)$_GET['streaming'];
}
?>
    <button id="btn-add-pausa" class="btn btn-sm btn-primary" data-streaming_id="<?= $__sid ?>">Agregar cuenta en pausa</button>
    <a href="export_streaming_items.php?streaming_id=<?= $streaming_id ?>&tipo=pausa"
   class="btn btn-sm btn-outline-success">
  Exportar Excel (Pausa)
</a>

  </div>

  <!-- Filtros PAUSA -->
  <div class="__spFilter__ d-flex flex-wrap align-items-center gap-2 mb-2" data-scope="pausa">
    <select class="form-select form-select-sm sp-color" style="max-width: 220px;">
      <option value="">Color: todos</option>
      <option value="rojo">Rojo</option>
      <option value="azul">Azul</option>
      <option value="verde">Verde</option>
      <option value="blanco">Blanco</option>
    </select>
    <select class="form-select form-select-sm sp-plan" style="max-width: 240px;">
      <option value="">Plan: todos</option>
      <option value="basico">Básico (incluye Individual)</option>
      <option value="estandar">Estándar</option>
      <option value="premium">Premium</option>
    </select>
    <input type="search" class="form-control form-control-sm sp-search js-whatsapp-search" style="max-width: 280px;" placeholder="Buscar correo…">
    <button type="button" class="btn btn-sm btn-outline-secondary sp-clear">Limpiar</button>
  </div>

  <div class="table-responsive">
    <table class="table align-middle table-bordered" style="--bs-border-color:#000;" data-no-row-modal="1" id="pausaTable">
      <thead>
        <tr>
          <th>Plan</th>
          <th>Correo</th>
          <th>Contraseña</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
<?php
  $stmt = $pdo->prepare("
    SELECT id, streaming_id, plan, color, correo, password_plain, whatsapp, perfil, combo, soles, estado, dispositivo, fecha_inicio, fecha_fin, created_at
    FROM perfiles_pausa
    WHERE streaming_id = :sid
    ORDER BY created_at DESC, id DESC
  ");
  $stmt->execute([':sid' => $streaming_id]);
  $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

  $lastDayKey = null;
  $meses = ['', 'enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

  foreach ($rows as $r):
    // Separador por día
    $createdRaw = $r['created_at'] ?? '';
    $ts = $createdRaw ? strtotime($createdRaw) : 0;
    $dayKey = $ts ? date('Y-m-d', $ts) : '';
    if ($dayKey && $dayKey !== $lastDayKey) {
      $diaLabel = date('j', $ts) . ' ' . $meses[(int)date('n', $ts)];
      echo '<tr data-sep="1" class="table-light"><td colspan="4" class="py-1 fw-semibold text-muted">'
         . htmlspecialchars($diaLabel, ENT_QUOTES, 'UTF-8')
         . '</td></tr>';
      $lastDayKey = $dayKey;
    }

    $plan  = $r['plan'] ?? 'individual';
    $combo = isset($r['combo']) ? (int)$r['combo'] : 0;

    // Color saneado y atributos para persistir en DOM
    $__rawColor = strtolower((string)($r['color'] ?? ''));
    $__allowed  = ['rojo','azul','verde','blanco'];
    $__color    = in_array($__rawColor, $__allowed, true) ? $__rawColor : '';
    $__rowCls   = $__color ? ('row-color-' . $__color) : '';

    $rowData = [
      'id'            => (int)$r['id'],
      'streaming_id'  => (int)$r['streaming_id'],
      'correo'        => (string)$r['correo'],
      'password_plain'=> (string)$r['password_plain'],
      'whatsapp'      => (string)$r['whatsapp'],
      'fecha_inicio'  => (string)$r['fecha_inicio'],
      'fecha_fin'     => (string)$r['fecha_fin'],
      'perfil'        => (string)($r['perfil'] ?? ''),
      'soles'         => (string)$r['soles'],
      'estado'        => (string)$r['estado'],
      'dispositivo'   => (string)$r['dispositivo'],
      'plan'          => (string)$plan,
      'combo'         => (int)$combo,
    ];
    $dataAttr = htmlspecialchars(json_encode($rowData), ENT_QUOTES, 'UTF-8');
?>
<tr class="<?= htmlspecialchars($__rowCls, ENT_QUOTES) ?>"
    data-id="<?= (int)$r['id'] ?>"
    data-streaming_id="<?= (int)$r['streaming_id'] ?>"
    data-correo="<?= htmlspecialchars($r['correo']) ?>"
    data-entidad="stock"
    data-color="<?= htmlspecialchars($__color, ENT_QUOTES) ?>">

  <td class="plan-cell-pausa"
      data-id="<?= (int)$r['id'] ?>"
      data-plan="<?= htmlspecialchars($r['plan'] ?? 'premium', ENT_QUOTES, 'UTF-8') ?>"
      role="button" tabindex="0">
    <?= htmlspecialchars($r['plan'] ?? 'premium', ENT_QUOTES, 'UTF-8') ?>
  </td>
  <td><?= htmlspecialchars($r['correo']); ?></td>
  <td><?= htmlspecialchars($r['password_plain']); ?></td>
  <td class="text-nowrap">
    <button type="button"
            class="btn btn-sm btn-outline-primary btn-edit-pausa"
            data-bs-toggle="modal" data-bs-target="#pausaModal"
            data-row="<?= $dataAttr ?>">Editar</button>

 <form action="ajax/pausa_delete.php" 
      method="post" 
      class="d-inline form-delete-pausa">
  <input type="hidden" name="id" value="<?= (int)$r['id'] ?>">
  <button type="submit" class="btn btn-sm btn-outline-danger js-row-action">
    Borrar
  </button>
</form>

<script>
    document.addEventListener('submit', function (e) {
  const form = e.target.closest('.form-delete-pausa');
  if (!form) return; // no es un form de pausa

  e.preventDefault();

  Swal.fire({
    title: '¿Eliminar registro en PAUSA?',
    text: 'Esta acción no se puede deshacer.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, borrar',
    cancelButtonText: 'Cancelar'
  }).then((result) => {
    if (!result.isConfirmed) return;

    fetch(form.action, {
      method: 'POST',
      body: new FormData(form)
    })
      .then(r => r.json())
      .then(resp => {
        if (!resp.ok) {
          Swal.fire('Error', resp.error || 'No se pudo borrar el registro.', 'error');
          return;
        }

        Swal.fire('Eliminado', 'El registro en PAUSA fue eliminado correctamente.', 'success')
          .then(() => {
            // recarga la página o quita la fila de la tabla
            location.reload();
          });
      })
      .catch(err => {
        console.error(err);
        Swal.fire('Error', 'Error de comunicación con el servidor.', 'error');
      });
  });
});

</script>


  </td>
</tr>
<?php endforeach; ?>

<?php if (empty($rows)): ?>
  <tr><td colspan="4" class="text-center">Sin registros</td></tr>
<?php endif; ?>
      </tbody>
    </table>
  </div>
</div>




    
    
    
  




  </div>
</div>
<!-- al final de public/streaming.php -->
<script>
// ===== perfiles_filters_diag.js =====
(function(){
  'use strict';
  if (window.__PF_DIAG_BOUND__) return;
  window.__PF_DIAG_BOUND__ = true;

  const LOG_PREFIX = '[PF-DIAG]';
  const log  = (...a)=>console.log(LOG_PREFIX, ...a);
  const warn = (...a)=>console.warn(LOG_PREFIX, ...a);
  const err  = (...a)=>console.error(LOG_PREFIX, ...a);

  function norm(s){ return String(s||'').toLowerCase().trim(); }

  function findPane(){
    // 1) pane por id "perfiles"
    let pane = document.getElementById('perfiles');
    if (pane) { log('Pane #perfiles OK'); return pane; }
    // 2) plan B: por data-scope
    pane = document.querySelector('[data-scope="perfiles"]')?.closest('.tab-pane, section, div');
    if (pane) { log('Pane por data-scope OK:', pane); return pane; }
    warn('No se encontró el pane de Perfiles (#perfiles). ¿El id de la pestaña es otro?');
    return null;
  }

  function findWrapper(pane){
    let wrap = pane ? pane.querySelector('.__pfFilter__[data-scope="perfiles"]') : null;
    if (wrap) { log('Wrapper filtros OK'); return wrap; }
    warn('No se encontró wrapper de filtros .__pfFilter__[data-scope="perfiles"] dentro del pane.');
    return null;
  }

  function findTable(pane){
    // busca tabla dentro del pane
    let table = pane ? pane.querySelector('table') : null;
    if (table) { log('Tabla encontrada dentro del pane'); return table; }
    // plan B: alguna tabla marcada explícitamente
    table = document.getElementById('perfilesTable') || document.querySelector('[data-perfiles-table]');
    if (table) { log('Tabla encontrada por id/data fuera del pane'); return table; }
    warn('No encontré una tabla de Perfiles.');
    return null;
  }

  function getTBody(table){
    let tbody = table ? table.tBodies[0] : null;
    if (tbody) { log('TBody OK, filas:', tbody.rows.length); return tbody; }
    warn('La tabla no tiene <tbody> (o está vacío).');
    return null;
  }

  function detectGroups(tbody){
    const rows = Array.from(tbody.querySelectorAll('tr'));
    if (!rows.length){ warn('No hay filas en tbody.'); return {groups:[], parents:0, children:0}; }

    let groups = [];
    let curr = null;
    let parents=0, children=0;

    rows.forEach(tr=>{
      const isParent = tr.classList.contains('js-parent-row') || tr.getAttribute('data-parent') === '1';
      if (isParent || !curr) {
        curr = { parent: tr, children: [] };
        groups.push(curr);
        parents++;
      } else {
        curr.children.push(tr);
        children++;
      }
    });

    log('Agrupación detectada -> grupos:', groups.length, 'padres:', parents, 'hijos:', children);
    if (parents === 0) warn('No se detectaron filas PADRE (js-parent-row o data-parent="1").');

    return {groups, parents, children};
  }

  function bindMinimalFilter(pane, tbody){
    // intenta agarrar algún input de búsqueda existente
    const q = pane.querySelector('.pf-search') || pane.querySelector('input[type="search"]') || pane.querySelector('input[type="text"]');
    if (!q){
      warn('No encontré input de búsqueda (.pf-search). Voy a crear un input temporal arriba de la tabla para probar.');
      const tmp = document.createElement('input');
      tmp.type = 'text';
      tmp.placeholder = 'Buscar (diagnóstico Perfiles)…';
      tmp.className = 'form-control mb-2';
      table.parentNode.insertBefore(tmp, table);
      tmp.addEventListener('input', ()=>applyMinimal(tmp.value));
      return;
    }
    log('Input de búsqueda detectado:', q);
    q.addEventListener('input', ()=>applyMinimal(q.value));

    function applyMinimal(val){
      const qv = norm(val);
      const rows = Array.from(tbody.querySelectorAll('tr'));
      let hits=0;
      rows.forEach(tr=>{
        const txt = norm(tr.textContent);
        const match = !qv || txt.includes(qv);
        tr.style.display = match ? '' : 'none';
        if (match) hits++;
      });
      log('Filtro mínimo aplicado. Query:', qv, 'Visibles:', hits, 'Total filas:', rows.length);
    }

    // autoaplicar si ya hay valor
    if (q.value) { q.dispatchEvent(new Event('input')); }
  }

  function reportControls(wrap){
    if (!wrap){ warn('Sin wrapper de filtros, se usará filtro mínimo por texto.'); return; }
    const selMain   = wrap.querySelector('.pf-main');
    const selPlan   = wrap.querySelector('.pf-plan');
    const selEstado = wrap.querySelector('.pf-estado');
    const qInput    = wrap.querySelector('.pf-search');
    const btnClr    = wrap.querySelector('.pf-clear');

    log('Controles encontrados:',
      { main: !!selMain, plan: !!selPlan, estado: !!selEstado, q: !!qInput, clear: !!btnClr }
    );
    if (!selMain && !qInput) warn('No hay ni pf-main ni pf-search; ¿seguro que el wrapper es el correcto?');
  }

  function run(){
    const pane  = findPane();
    if (!pane) return;
    const wrap  = findWrapper(pane); // puede ser null (seguimos con filtro mínimo)
    reportControls(wrap);

    const table = findTable(pane);
    if (!table) return;
    const tbody = getTBody(table);
    if (!tbody) return;

    const {groups, parents, children} = detectGroups(tbody);

    // Si no hay padres, el filtro “por grupos” no puede funcionar. Usamos filtro mínimo por texto.
    if (parents === 0){
      warn('Sin filas padre detectadas. Los filtros de perfiles esperan agrupar por padre/hijos.');
      bindMinimalFilter(pane, tbody);
      return;
    }

    // Para aislar problemas de listeners: probamos un filtro MÍNIMO sobre grupos (por correo del padre).
    const q = wrap?.querySelector('.pf-search');
    if (q){
      log('Enganchando filtro rápido por correo del PADRE para probar.');
      q.addEventListener('input', function(){
        const val = norm(q.value);
        groups.forEach(g=>{
          const correo = norm(g.parent.getAttribute('data-correo') || g.parent.textContent);
          const match = !val || correo.includes(val);
          [g.parent].concat(g.children).forEach(tr => tr.classList.toggle('d-none', !match));
        });
        log('Filtro-TEST aplicado. Query:', val);
      });
    } else {
      bindMinimalFilter(pane, tbody);
    }

    log('DIAGNÓSTICO listo. Ahora escribe en la búsqueda y observa si oculta/ muestra filas. Si NO pasa nada:');
    log('- Revisa si hay CSS que impida display:none (ej: !important en .d-none override).');
    log('- Revisa si otra función vuelve a mostrar filas tras el filtro.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
</script>
<script>
// --- TEST MINIMAL PERFILES (no depende de wrapper ni selects) ---
(function(){
  // 1) localiza pane, tabla y tbody
  var pane  = document.getElementById('perfiles');
  if (!pane) { console.error('[PF-TEST] no existe #perfiles'); return; }
  var table = pane.querySelector('table');
  if (!table) { console.error('[PF-TEST] no hay <table> dentro de #perfiles'); return; }
  var tbody = table.querySelector('tbody');
  if (!tbody) { console.error('[PF-TEST] la tabla no tiene <tbody>'); return; }

  // 2) agrupa por PADRE/Hijos
  function buildGroups(){
    var groups=[], curr=null;
    Array.from(tbody.querySelectorAll('tr')).forEach(function(tr){
      var isParent = tr.classList.contains('js-parent-row') || tr.getAttribute('data-parent') === '1';
      if (isParent || !curr) { curr = { parent: tr, children: [] }; groups.push(curr); }
      else { curr.children.push(tr); }
    });
    return groups;
  }
  var groups = buildGroups();
  console.log('[PF-TEST] grupos:', groups.length);

  // 3) input de búsqueda (usa el que ya tienes .pc-search)
  var qInput = pane.querySelector('.pc-search');
  if (!qInput) {
    // si no existe, creo uno temporal arriba de la tabla
    qInput = document.createElement('input');
    qInput.className = 'form-control mb-2';
    qInput.placeholder = 'Buscar (test Perfiles)…';
    table.parentNode.insertBefore(qInput, table);
  }

  function norm(s){ return String(s||'').toLowerCase().trim(); }

  // 4) aplicar filtro: correo (padre) o texto en hijos
  function correoFromParentRow(tr){
    var c = tr.getAttribute('data-correo') || '';
    if (!c) {
      var tds = tr.querySelectorAll('td');
      if (tds && tds[1]) c = tds[1].textContent || ''; // 2da col = Correo en tu tabla
    }
    return norm(c);
  }
  function childText(tr){ return norm(tr.textContent); }

  function setHidden(g, hide){
    [g.parent].concat(g.children).forEach(function(tr){ tr.classList.toggle('d-none', !!hide); });
  }

  function apply(){
    var q = norm(qInput.value);
    // mostrar todo
    groups.forEach(function(g){ setHidden(g,false); });
    if (!q) return;

    groups.forEach(function(g){
      var hide = true;
      if (correoFromParentRow(g.parent).includes(q)) hide = false;
      if (hide) {
        for (var i=0;i<g.children.length;i++){
          if (childText(g.children[i]).includes(q)) { hide = false; break; }
        }
      }
      setHidden(g, hide);
    });
  }

  qInput.addEventListener('input', apply);
  apply();

  // 5) sanity check de CSS: intenta ocultar la primera fila
  var tr0 = tbody.rows[0];
  if (tr0) {
    tr0.classList.add('d-none');
    var disp = getComputedStyle(tr0).display;
    console.log('[PF-TEST] display fila 0 =', disp);
    // revertimos
    tr0.classList.remove('d-none');
    if (disp !== 'none') {
      console.warn('[PF-TEST] .d-none NO oculta filas. Revisa tu CSS: alguna regla está pisando display:none.');
    }
  }
})();
</script>


<!-- /public/streaming.php — Pegar AL FINAL del archivo (o justo después de la tabla de #perfiles-familiar) -->
<script>
;(function(){
  'use strict';
  if (window.__famPlanHardGuard) return; window.__famPlanHardGuard = true;

  var tab    = document.getElementById('perfiles-familiar');
  var modal  = document.getElementById('modalCambiarPlanPerfil');
  if (!tab || !modal || !window.bootstrap) return;

  function norm(s){ return String(s||'').trim().toLowerCase(); }

  function suspendRowModal(row){
    if (!row || row.dataset.rowmodalSuspended === '1') return;
    var t  = row.getAttribute('data-bs-toggle');
    var tg = row.getAttribute('data-bs-target');
    if (t  != null) row.dataset.rowmodalToggle  = t;
    if (tg != null) row.dataset.rowmodalTarget  = tg;
    row.removeAttribute('data-bs-toggle');
    row.removeAttribute('data-bs-target');
    row.dataset.rowmodalSuspended = '1';
  }
  function resumeRowModal(row){
    if (!row || row.dataset.rowmodalSuspended !== '1') return;
    var t  = row.dataset.rowmodalToggle;
    var tg = row.dataset.rowmodalTarget;
    if (t  != null) row.setAttribute('data-bs-toggle', t);
    if (tg != null) row.setAttribute('data-bs-target', tg);
    delete row.dataset.rowmodalToggle;
    delete row.dataset.rowmodalTarget;
    delete row.dataset.rowmodalSuspended;
  }

  // 1) pointerdown (antes que click): neutraliza el data-api del <tr>
  document.addEventListener('pointerdown', function(ev){
    var td = ev.target && ev.target.closest && ev.target.closest('#perfiles-familiar .plan-cell-perfil');
    if (!td) return;
    var tr = td.closest('tr.js-parent-row');
    suspendRowModal(tr);
  }, true);

  // 2) click: abre SOLO el modal chico y evita cualquier otro listener
  document.addEventListener('click', function(ev){
    var td = ev.target && ev.target.closest && ev.target.closest('#perfiles-familiar .plan-cell-perfil');
    if (!td) return;

    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();

    var tr    = td.closest('tr.js-parent-row');
    suspendRowModal(tr);

    // Prefill del modal chico
    var id    = td.getAttribute('data-id') || (tr && tr.getAttribute('data-id')) || '';
    var plan  = norm(td.getAttribute('data-plan') || td.textContent);
    var color = tr ? (tr.getAttribute('data-color') || '') : '';

    var idEl     = modal.querySelector('#perfilPlanId');
    var planSel  = modal.querySelector('#perfilPlanSelect');
    var colorSel = modal.querySelector('#perfilColorSelect, select[name="color"]');
    var destSel  = modal.querySelector('#perfilEnviarASelect, select[name="enviar_a"]');

    if (idEl)     idEl.value = String(id).replace(/\D+/g,'');
    if (planSel)  planSel.value = plan || 'individual';
    if (colorSel) colorSel.value = color || '';
    if (destSel)  destSel.value = 'none';

    var inst = bootstrap.Modal.getOrCreateInstance(modal);
    modal.addEventListener('hidden.bs.modal', function restoreOnce(){
      resumeRowModal(tr);
      modal.removeEventListener('hidden.bs.modal', restoreOnce);
    }, {once:true});
    inst.show();
  }, true);

  // 3) Teclado (Enter/Espacio) sólo en familiar
  document.addEventListener('keydown', function(ev){
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    var td = ev.target && ev.target.closest && ev.target.closest('#perfiles-familiar .plan-cell-perfil');
    if (!td) return;

    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();

    var tr = td.closest('tr.js-parent-row');
    suspendRowModal(tr);

    var idEl = modal.querySelector('#perfilPlanId');
    if (idEl) idEl.value = String(td.getAttribute('data-id') || tr?.getAttribute('data-id') || '').replace(/\D+/g,'');

    var inst = bootstrap.Modal.getOrCreateInstance(modal);
    modal.addEventListener('hidden.bs.modal', function restoreOnce(){
      resumeRowModal(tr);
      modal.removeEventListener('hidden.bs.modal', restoreOnce);
    }, {once:true});
    inst.show();
  }, true);
})();
</script>



<!-- /public/streaming.php  — SOLO para “Streaming familiar”.
     Pega este bloque INLINE al final del archivo (o justo después de la tabla de #perfiles-familiar). -->
<script>
;(function(){
  'use strict';
  if (window.__famPlanStrictGuard) return; window.__famPlanStrictGuard = true;

  var famPane = document.getElementById('perfiles-familiar');
  var rowModal = document.getElementById('perfilFamiliarModal');        // GRANDE (agregar perfil familiar)
  var planModal = document.getElementById('modalCambiarPlanPerfil');    // CHICO (cambiar plan/color/enviar a)
  if (!famPane || !rowModal || !planModal || !window.bootstrap) return;

  var lastPlanHitTS = 0;

  function norm(s){ return String(s||'').trim().toLowerCase(); }
  function isPlanCellTarget(ev){
    if (!ev || !ev.target) return null;
    var td = ev.target.closest && ev.target.closest('.plan-cell-perfil');
    if (!td) return null;
    if (!famPane.contains(td)) return null; // limitar SOLO a la pestaña Streaming familiar
    return td;
  }
  function prefillPlanModalFromCell(td){
    var tr    = td.closest('tr');
    var id    = td.getAttribute('data-id') || (tr && tr.getAttribute('data-id')) || '';
    var plan  = norm(td.getAttribute('data-plan') || td.textContent);
    var color = tr ? (tr.getAttribute('data-color') || '') : '';

    var idEl     = planModal.querySelector('#perfilPlanId');
    var planSel  = planModal.querySelector('#perfilPlanSelect');
    var colorSel = planModal.querySelector('#perfilColorSelect, select[name="color"]');
    var destSel  = planModal.querySelector('#perfilEnviarASelect, select[name="enviar_a"]');

    if (idEl)     idEl.value = String(id).replace(/\D+/g,'');
    if (planSel)  planSel.value = plan || 'individual';
    if (colorSel) colorSel.value = color || '';
    if (destSel)  destSel.value = 'none';
  }
  function openPlanOnly(td){
    lastPlanHitTS = Date.now();
    prefillPlanModalFromCell(td);
    bootstrap.Modal.getOrCreateInstance(planModal).show();
  }

  // 1) BLOQUEAR en captura cualquier click que nazca en la celda Plan (familiar) y abrir SOLO el modal chico
  document.addEventListener('click', function(ev){
    var td = isPlanCellTarget(ev);
    if (!td) return;
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();
    openPlanOnly(td);
  }, true);

  // 2) También bloquear con teclado (Enter / Space) sobre la celda Plan
  document.addEventListener('keydown', function(ev){
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    var td = isPlanCellTarget(ev);
    if (!td) return;
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();
    openPlanOnly(td);
  }, true);

  // 3) CORTAFUEGOS definitivo: si, pese a todo, se intenta abrir el modal GRANDE por un listener previo,
  //    lo cancelamos si el click reciente vino de una celda Plan (ventana de 800 ms)
  document.addEventListener('show.bs.modal', function(ev){
    if (ev.target !== rowModal) return;
    if (Date.now() - lastPlanHitTS < 800) {
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();
      try { bootstrap.Modal.getOrCreateInstance(rowModal).hide(); } catch(_){}
    }
  }, true);

  // 4) Extra: en mousedown/pointerdown, marcamos también el “intento plan” lo antes posible
  ['pointerdown','mousedown','touchstart'].forEach(function(type){
    document.addEventListener(type, function(ev){
      var td = isPlanCellTarget(ev);
      if (!td) return;
      lastPlanHitTS = Date.now();
      // No prevenimos aquí para no romper selección de texto; el corte real es en click/show.bs.modal
    }, true);
  });
})();
</script>

<!-- /public/streaming.php — Pegar AL FINAL (o justo después de la tabla de #perfiles-familiar) -->
<script>
;(function(){
  'use strict';
  if (window.__famPlanRouterV2) return; window.__famPlanRouterV2 = true;

  var famTab   = document.getElementById('perfiles-familiar');
  var bigModal = document.getElementById('perfilFamiliarModal');      // grande (agregar hijo)
  var smlModal = document.getElementById('modalCambiarPlanPerfil');   // chico  (cambiar plan/color/enviar)
  if (!famTab || !bigModal || !smlModal || !window.bootstrap) return;

  var blockBigUntil = 0;

  function norm(s){ return String(s||'').trim().toLowerCase(); }
  function prefillSmallFromCell(td){
    var tr    = td.closest('tr');
    var id    = td.getAttribute('data-id') || (tr && tr.getAttribute('data-id')) || '';
    var plan  = norm(td.getAttribute('data-plan') || td.textContent);
    var color = tr ? (tr.getAttribute('data-color') || '') : '';

    var idEl     = smlModal.querySelector('#perfilPlanId');
    var planSel  = smlModal.querySelector('#perfilPlanSelect');
    var colorSel = smlModal.querySelector('#perfilColorSelect, select[name="color"]');
    var destSel  = smlModal.querySelector('#perfilEnviarASelect, select[name="enviar_a"]');

    if (idEl)     idEl.value = String(id).replace(/\D+/g,'');
    if (planSel)  planSel.value = plan || 'individual';
    if (colorSel) colorSel.value = color || '';
    if (destSel)  destSel.value = 'none';
  }

  // 1) Captura de click en celda Plan (familiar): SOLO modal chico + bloquear grande
  document.addEventListener('click', function(ev){
    var td = ev.target && ev.target.closest && ev.target.closest('#perfiles-familiar .plan-cell-perfil');
    if (!td) return;
    blockBigUntil = Date.now() + 800;
    ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();
    prefillSmallFromCell(td);
    bootstrap.Modal.getOrCreateInstance(smlModal).show();
  }, true);

  // 2) Accesibilidad (Enter/Espacio) en celda Plan (familiar)
  document.addEventListener('keydown', function(ev){
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    var td = ev.target && ev.target.closest && ev.target.closest('#perfiles-familiar .plan-cell-perfil');
    if (!td) return;
    blockBigUntil = Date.now() + 800;
    ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();
    prefillSmallFromCell(td);
    bootstrap.Modal.getOrCreateInstance(smlModal).show();
  }, true);

  // 3) Cortafuegos: si aún así intenta abrirse el GRANDE por data-api del <tr>, lo cancelamos
  bigModal.addEventListener('show.bs.modal', function(ev){
    var rel = ev.relatedTarget || null;
    var fromPlan = false;
    if (rel && rel.closest) {
      if (rel.closest('#perfiles-familiar .plan-cell-perfil')) fromPlan = true;
      if (rel.hasAttribute && rel.hasAttribute('data-no-row-modal')) fromPlan = true;
    }
    if (fromPlan || Date.now() < blockBigUntil) {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      try { bootstrap.Modal.getInstance(bigModal)?.hide(); } catch(_){}
    }
  }, true);
})();
</script>


<!-- /public/streaming.php — PÉGALO al final del archivo o justo después de la tabla de #perfiles-familiar -->

<script>
;(function(){
  'use strict';
  if (window.__famRowRouterV5) return;
  window.__famRowRouterV5 = true;

  var famPane    = document.getElementById('perfiles-familiar');
  var bigModal   = document.getElementById('perfilFamiliarModal');      // grande (Agregar / Hijo)
  var smallModal = document.getElementById('modalCambiarPlanPerfil');   // chico (cambiar plan/color/enviar)
  if (!famPane || !bigModal || !smallModal || !window.bootstrap) return;

  function q(sel, ctx){ return (ctx || document).querySelector(sel); }
  function norm(s){ return String(s || '').trim().toLowerCase(); }

  // --- Modal chico: cambiar plan/color/enviar ---
  function openSmallFromPlanCell(td){
    var tr    = td.closest('tr');
    var id    = td.getAttribute('data-id') || (tr && tr.getAttribute('data-id')) || '';
    var plan  = norm(td.getAttribute('data-plan') || td.textContent);
    var color = tr && tr.getAttribute('data-color') || '';

    var idEl     = q('#perfilPlanId', smallModal);
    var planSel  = q('#perfilPlanSelect', smallModal);
    var colorSel = q('#perfilColorSelect, select[name="color"]', smallModal);
    var destSel  = q('#perfilEnviarASelect, select[name="enviar_a"]', smallModal);

    if (idEl)     idEl.value = String(id).replace(/\D+/g,'');
    if (planSel)  planSel.value = plan || 'individual';
    if (colorSel) colorSel.value = color || '';
    if (destSel)  destSel.value = 'none';

    bootstrap.Modal.getOrCreateInstance(smallModal).show();
  }

  // --- Candado: solo se muestra el modal grande si lo permitimos explícitamente ---
  bigModal.addEventListener('show.bs.modal', function(ev){
    if (bigModal.dataset._allowShow === '1') {
      delete bigModal.dataset._allowShow;
      return; // permitimos apertura
    }
    if (ev && ev.preventDefault) ev.preventDefault();
    if (ev && ev.stopImmediatePropagation) ev.stopImmediatePropagation();
    try {
      var inst = bootstrap.Modal.getInstance(bigModal);
      if (inst) inst.hide();
    } catch(e){}
  }, true);

  function allowAndShowBigModal(){
    bigModal.dataset._allowShow = '1';
    bootstrap.Modal.getOrCreateInstance(bigModal).show();
  }

  // --- Helper precio ancla (primer hijo) ---
  function to2(v){
    var n = parseFloat(String(v).replace(',','.'));
    return Number.isFinite(n) ? n.toFixed(2) : '';
  }

  function getAnchorFromParentTr(parentTr){
    if (!parentTr) return '';
    // 1) data-first-child-price (lo manda el backend si ya hay 1er hijo)
    var anchor = (parentTr.getAttribute('data-first-child-price') || '').trim();
    if (anchor) return to2(anchor);
    // 2) Fallback: lee la 1ª hija, columna 9 (index 8), hasta separador o nuevo padre
    var p = parentTr.nextElementSibling;
    while (p){
      if (p.getAttribute && p.getAttribute('data-sep') === '1') break;
      if (p.classList && p.classList.contains('js-parent-row')) break;
      var td = p.children && p.children[8];
      if (td){
        var n = parseFloat(String(td.textContent || '').replace(',','.'));
        if (!isNaN(n)) return n.toFixed(2);
      }
      p = p.nextElementSibling;
    }
    return '';
  }

  // --- Modal grande en modo HIJO (fila padre en familiar) ---
  function openBigFromRow(tr){
    var qs = function(sel){ return bigModal.querySelector(sel); };

    // marcamos contexto hijo para scripts auxiliares
    bigModal.dataset._mode    = 'child';
    bigModal.dataset._fromRow = '1';

    // Datos base del padre
    var correo = tr.getAttribute('data-correo') || '';
    var pass   = tr.getAttribute('data-password') || '';
    var sid    = tr.getAttribute('data-streaming_id') || '';
    var combo  = String(tr.getAttribute('data-combo') || '0');

    // Título
    var title = bigModal.querySelector('#perfilFamiliarModalLabel') || bigModal.querySelector('.modal-title');
    if (title) {
      title.textContent = correo ? ('agregar a correo: ' + correo) : 'Agregar a correo';
    }

    // Prefills básicos
    var set = function(sel, val){
      var el = qs(sel);
      if (el) el.value = val;
    };
    set('input[name="action"]', 'create');
    set('input[name="id"]', '');
    set('input[name="streaming_id"]', sid);
    set('input[name="correo"]', correo);
    set('input[name="password_plain"]', pass);
    set('select[name="estado"]', 'pendiente');
    set('select[name="dispositivo"]', 'tv');
    set('select[name="combo"]', (combo === '1' ? '1' : '0'));

    // Fechas: hoy y +31 días
    var hoy = new Date();
    var fin = new Date(hoy.getTime() + 30*24*60*60*1000);
    var toISO = function(d){ return d.toISOString().slice(0,10); };
    set('input[name="fecha_inicio"]', toISO(hoy));
    set('input[name="fecha_fin"]', toISO(fin));

    // Precio ancla para hijos (no tocamos inputs, sólo dataset)
    var anchor = getAnchorFromParentTr(tr) || '';
    if (anchor) {
      bigModal.dataset._anchor = anchor;
    } else {
      delete bigModal.dataset._anchor;
    }

    // Marca de contexto hijo en el form (para validaciones de correo, etc.)
    var form = bigModal.querySelector('form') || bigModal;
    if (!form.querySelector('input[name="action_child"]')) {
      var h = document.createElement('input');
      h.type  = 'hidden';
      h.name  = 'action_child';
      h.value = '1';
      form.appendChild(h);
    }

    // Ahora sí: permitimos y mostramos el modal grande
    allowAndShowBigModal();
  }

  // --- Permitir apertura cuando se hace click en "Agregar familiar" (botón padre) ---
  document.addEventListener('click', function(ev){
    var btn = ev.target.closest && ev.target.closest('.btn-add-perfil-fam');
    if (!btn) return;
    // Modo padre: otros scripts ya ajustan dataset._mode, aquí sólo damos permiso
    bigModal.dataset._allowShow = '1';
  }, true);

  // --- Router de CLICK sólo para Streaming familiar ---
  document.addEventListener('click', function(e){
    if (!famPane.contains(e.target)) return;

    var td = e.target.closest('td');
    if (!td) return;

    // 1) PLAN → sólo modal chico
    var planCell = td.closest('.plan-cell-familiar');
    if (planCell) {
      e.preventDefault();
      if (e.stopPropagation) e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      openSmallFromPlanCell(planCell);
      return;
    }

    // No interceptar acciones explícitas: botones, links, formularios
    if (e.target.closest('.js-row-action, button, a, form')) return;
    // No interceptar celdas marcadas
    if (td.closest('[data-no-row-modal="1"]')) return;

    var tr = td.closest('tr');
    if (!tr) return;
    if (tr.getAttribute('data-sep') === '1') return; // separadores de día

    // Buscar fila PADRE js-parent-row[data-entidad="familiar"]
    var parentTr;
    if (tr.classList.contains('js-parent-row') && tr.getAttribute('data-entidad') === 'familiar') {
      parentTr = tr;
    } else {
      parentTr = tr.previousElementSibling;
      while (parentTr && !parentTr.classList.contains('js-parent-row')) {
        if (parentTr.getAttribute('data-sep') === '1') {
          parentTr = null;
          break;
        }
        parentTr = parentTr.previousElementSibling;
      }
      if (parentTr && parentTr.getAttribute('data-entidad') !== 'familiar') {
        parentTr = null;
      }
    }

    if (!parentTr) return;

    e.preventDefault();
    if (e.stopPropagation) e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();

    // Abrimos SIEMPRE modal grande en modo hijo usando datos del padre
    openBigFromRow(parentTr);
  }, true);

  // --- ENTER accesible en Streaming familiar ---
  document.addEventListener('keydown', function(e){
    if (e.key !== 'Enter') return;
    if (!famPane.contains(e.target)) return;
    if (e.target.closest('.js-row-action, button, a, form')) return;

    var td = e.target.closest('td');
    if (!td) return;

    // ENTER en plan → modal chico
    var planCell = td.closest('.plan-cell-familiar');
    if (planCell) {
      e.preventDefault();
      if (e.stopPropagation) e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      openSmallFromPlanCell(planCell);
      return;
    }

    var tr = td.closest('tr.js-parent-row[data-entidad="familiar"]');
    if (!tr) return;

    e.preventDefault();
    if (e.stopPropagation) e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    openBigFromRow(tr);
  }, true);

})();
</script>





<!-- /public/streaming.php  (PEGAR AL FINAL DEL ARCHIVO, después de la tabla de #perfiles-familiar) -->
<script>
;(function(){
  'use strict';
  if (window.__famRowOpenBigV1) return; window.__famRowOpenBigV1 = true;

  var famPane   = document.getElementById('perfiles-familiar');
  var bigModal  = document.getElementById('perfilFamiliarModal');      // GRANDE: agregar hijo
  var smallModal= document.getElementById('modalCambiarPlanPerfil');   // CHICO: cambiar plan/color/enviar
  if (!famPane || !bigModal || !window.bootstrap) return;

  function q(sel, ctx){ return (ctx||document).querySelector(sel); }
  function toISO(d){ return d.toISOString().slice(0,10); }

  
// REEMPLAZO UNIFICADO para TODAS las definiciones de openBigFromRow(tr)
function openBigFromRow(tr){
  // Helper local: query dentro del modal grande
  var qs = function(sel){ return bigModal.querySelector(sel); };

  // === Datos del padre (fila) ===
  var correo = tr.getAttribute('data-correo') || '';
  var pass   = tr.getAttribute('data-password') || '';
  var sid    = tr.getAttribute('data-streaming_id') || '';
  var combo  = String(tr.getAttribute('data-combo') || '0');

  // === Título ===
  var title = bigModal.querySelector('#perfilFamiliarModalLabel') || bigModal.querySelector('.modal-title');
  if (title) title.textContent = correo ? ('agregar a correo: ' + correo) : 'Agregar a correo';

  // === Prefills base del formulario (modo HIJO) ===
  var set = function(sel, val){ var el = qs(sel); if (el) el.value = val; };
  set('input[name="action"]', 'create');
  set('input[name="id"]', '');
  set('input[name="streaming_id"]', sid);
  set('input[name="correo"]', correo);
  set('input[name="password_plain"]', pass);
  set('select[name="estado"]', 'pendiente');
  set('select[name="dispositivo"]', 'tv');
  set('select[name="combo"]', (combo === '1' ? '1' : '0'));

  // Fechas: hoy y +31 días
  var hoy = new Date(), fin = new Date(hoy.getTime() + 30*24*60*60*1000);
  var toISO = function(d){ return d.toISOString().slice(0,10); };
  set('input[name="fecha_inicio"]', toISO(hoy));
  set('input[name="fecha_fin"]', toISO(fin));

  // === Precio: ancla si existe; si NO, primer hijo editable en blanco ===
  function to2(v){ var n = parseFloat(String(v).replace(',','.')); return Number.isFinite(n) ? n.toFixed(2) : ''; }

  function getAnchorFromParentTr(parentTr){
    if (!parentTr) return '';
    // 1) data-first-child-price
    var anchor = (parentTr.getAttribute('data-first-child-price') || '').trim();
    if (anchor) return to2(anchor);
    // 2) Fallback: lee la 1ª hija, columna 9 (index 8), hasta separador o nuevo padre
    var p = parentTr.nextElementSibling;
    while (p){
      if (p.hasAttribute && p.hasAttribute('data-sep')) break;
      if (p.classList && p.classList.contains('js-parent-row')) break;
      var td = p.children && p.children[8];
      if (td){
        var n = parseFloat(String(td.textContent || '').replace(',','.'));
        if (!isNaN(n)) return n.toFixed(2);
      }
      p = p.nextElementSibling;
    }
    return '';
  }

  var priceEl = qs('input[name="soles"]');
  var anchor  = getAnchorFromParentTr(tr);

  if (priceEl){
    // quitar restos de parches anteriores
    priceEl.removeAttribute('data-locked');
    priceEl.dataset.anchorLock = '0';
    priceEl.removeAttribute('readonly');
    priceEl.classList.remove('bg-light');

    if (anchor){
      // Ya hay 1er hijo → mostrar ancla y bloquear
      priceEl.value = anchor;
      priceEl.setAttribute('readonly','readonly');
      priceEl.classList.add('bg-light');
      priceEl.dataset.anchorLock = '1';
    } else {
      // Primer hijo → precio en BLANCO y editable
      priceEl.value = '';
    }
  }

  // Marca de contexto hijo (opcional)
  if (!qs('input[name="action_child"]')) {
    var h = document.createElement('input');
    h.type='hidden'; h.name='action_child'; h.value='1';
    (bigModal.querySelector('form')||bigModal).appendChild(h);
  }

  // Mostrar modal grande
  bootstrap.Modal.getOrCreateInstance(bigModal).show();
}



  // CLICK router SOLO en Streaming familiar
  document.addEventListener('click', function(e){
    if (!famPane.contains(e.target)) return;

    // Ignorar click si fue en la celda Plan (esa abre el modal chico)
    if (e.target.closest('.plan-cell-perfil')) return;

    // Ignorar controles/acciones dentro de la fila
    if (e.target.closest('.js-row-action, button, a, input, select, textarea')) return;

    var tr = e.target.closest('tr.js-parent-row[data-entidad="perfil_fam"][data-modal-context="child"]');
    if (!tr) return;

    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    // Cerrar el chico si estuviera abierto por algún motivo
    try { if (smallModal) bootstrap.Modal.getInstance(smallModal)?.hide(); } catch(_){}
    openBigFromRow(tr);
  }, true);

  // ENTER/ESPACIO en la fila (no en Plan ni en controles)
  document.addEventListener('keydown', function(e){
    if (!famPane.contains(e.target)) return;
    if (e.key !== 'Enter' && e.key !== ' ') return;

    if (e.target.closest('.plan-cell-perfil')) return;
    if (e.target.closest('.js-row-action, button, a, input, select, textarea')) return;

    var tr = e.target.closest('tr.js-parent-row[data-entidad="perfil_fam"][data-modal-context="child"]');
    if (!tr) return;

    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    try { if (smallModal) bootstrap.Modal.getInstance(smallModal)?.hide(); } catch(_){}
    openBigFromRow(tr);
  }, true);
})();
</script>

<!-- /public/streaming.php  ── SOLO para la pestaña “Streaming familiar”
Pega este bloque INLINE al final del archivo (o justo después de la tabla de #perfiles-familiar). -->
<script>
;(function(){
  'use strict';
  if (window.__famBigModalRouterHard) return; window.__famBigModalRouterHard = true;

  var famPane    = document.getElementById('perfiles-familiar');
  var bigModal   = document.getElementById('perfilFamiliarModal');      // GRANDE (Agregar a correo…)
  var smallModal = document.getElementById('modalCambiarPlanPerfil');   // CHICO (Cambiar plan/color/enviar)
  if (!famPane || !bigModal || !window.bootstrap) return;

  // Rellena el modal GRANDE con los datos del <tr>
  
// REEMPLAZO UNIFICADO para TODAS las definiciones de openBigFromRow(tr)
function openBigFromRow(tr){
  // Helper local: query dentro del modal grande
  var qs = function(sel){ return bigModal.querySelector(sel); };

  // === Datos del padre (fila) ===
  var correo = tr.getAttribute('data-correo') || '';
  var pass   = tr.getAttribute('data-password') || '';
  var sid    = tr.getAttribute('data-streaming_id') || '';
  var combo  = String(tr.getAttribute('data-combo') || '0');

  // === Título ===
  var title = bigModal.querySelector('#perfilFamiliarModalLabel') || bigModal.querySelector('.modal-title');
  if (title) title.textContent = correo ? ('agregar a correo: ' + correo) : 'Agregar a correo';

  // === Prefills base del formulario (modo HIJO) ===
  var set = function(sel, val){ var el = qs(sel); if (el) el.value = val; };
  set('input[name="action"]', 'create');
  set('input[name="id"]', '');
  set('input[name="streaming_id"]', sid);
  set('input[name="correo"]', correo);
  set('input[name="password_plain"]', pass);
  set('select[name="estado"]', 'pendiente');
  set('select[name="dispositivo"]', 'tv');
  set('select[name="combo"]', (combo === '1' ? '1' : '0'));

  // Fechas: hoy y +31 días
  var hoy = new Date(), fin = new Date(hoy.getTime() + 30*24*60*60*1000);
  var toISO = function(d){ return d.toISOString().slice(0,10); };
  set('input[name="fecha_inicio"]', toISO(hoy));
  set('input[name="fecha_fin"]', toISO(fin));

  // === Precio: ancla si existe; si NO, primer hijo editable en blanco ===
  function to2(v){ var n = parseFloat(String(v).replace(',','.')); return Number.isFinite(n) ? n.toFixed(2) : ''; }

  function getAnchorFromParentTr(parentTr){
    if (!parentTr) return '';
    // 1) data-first-child-price
    var anchor = (parentTr.getAttribute('data-first-child-price') || '').trim();
    if (anchor) return to2(anchor);
    // 2) Fallback: lee la 1ª hija, columna 9 (index 8), hasta separador o nuevo padre
    var p = parentTr.nextElementSibling;
    while (p){
      if (p.hasAttribute && p.hasAttribute('data-sep')) break;
      if (p.classList && p.classList.contains('js-parent-row')) break;
      var td = p.children && p.children[8];
      if (td){
        var n = parseFloat(String(td.textContent || '').replace(',','.'));
        if (!isNaN(n)) return n.toFixed(2);
      }
      p = p.nextElementSibling;
    }
    return '';
  }

  var priceEl = qs('input[name="soles"]');
  var anchor  = getAnchorFromParentTr(tr);

  if (priceEl){
    // quitar restos de parches anteriores
    priceEl.removeAttribute('data-locked');
    priceEl.dataset.anchorLock = '0';
    priceEl.removeAttribute('readonly');
    priceEl.classList.remove('bg-light');

    if (anchor){
      // Ya hay 1er hijo → mostrar ancla y bloquear
      priceEl.value = anchor;
      priceEl.setAttribute('readonly','readonly');
      priceEl.classList.add('bg-light');
      priceEl.dataset.anchorLock = '1';
    } else {
      // Primer hijo → precio en BLANCO y editable
      priceEl.value = '';
    }
  }

  // Marca de contexto hijo (opcional)
  if (!qs('input[name="action_child"]')) {
    var h = document.createElement('input');
    h.type='hidden'; h.name='action_child'; h.value='1';
    (bigModal.querySelector('form')||bigModal).appendChild(h);
  }

  // Mostrar modal grande
  bootstrap.Modal.getOrCreateInstance(bigModal).show();
}


  // Flags de enrutado por evento
  var hitPlanCell = false;
  var hitControl  = false;
  var hitRow      = null;

  // Marcar lo más temprano posible (fase de captura) dónde fue el clic
  ['pointerdown','mousedown','touchstart'].forEach(function(type){
    document.addEventListener(type, function(ev){
      if (!famPane.contains(ev.target)) { hitPlanCell=false; hitControl=false; hitRow=null; return; }
      hitPlanCell = !!(ev.target.closest && ev.target.closest('#perfiles-familiar .plan-cell-perfil'));
      hitControl  = !!(ev.target.closest && ev.target.closest('.js-row-action, button, a, input, select, textarea'));
      hitRow      = (ev.target.closest && ev.target.closest('#perfiles-familiar tr.js-parent-row[data-entidad="perfil_fam"][data-modal-context="child"]')) || null;
    }, true);
  });

  // CLICK (fase de captura): si es fila familiar y NO fue en Plan ni en un control, abrimos SOLO el GRANDE
  document.addEventListener('click', function(ev){
    if (!hitRow) return;
    if (hitPlanCell || hitControl) { hitPlanCell=false; hitControl=false; hitRow=null; return; }

    // Cortar a TODOS los demás listeners que estaban impidiendo el flujo
    ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();

    // Por si algún script intenta abrir el chico, lo cerramos
    try { if (smallModal) bootstrap.Modal.getInstance(smallModal)?.hide(); } catch(_){}

    openBigFromRow(hitRow);

    // reset
    hitPlanCell=false; hitControl=false; hitRow=null;
  }, true);

  // ENTER / ESPACIO sobre la fila (fase de captura)
  document.addEventListener('keydown', function(ev){
    if (!famPane.contains(ev.target)) return;
    if (ev.key !== 'Enter' && ev.key !== ' ') return;

    var tr = ev.target.closest && ev.target.closest('#perfiles-familiar tr.js-parent-row[data-entidad="perfil_fam"][data-modal-context="child"]');
    if (!tr) return;

    if (ev.target.closest && (ev.target.closest('#perfiles-familiar .plan-cell-perfil') || ev.target.closest('.js-row-action, button, a, input, select, textarea'))) return;

    ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();
    try { if (smallModal) bootstrap.Modal.getInstance(smallModal)?.hide(); } catch(_){}
    openBigFromRow(tr);
  }, true);

  // Corta cualquier intento residual de abrir el grande DESDE un click en Plan (sólo por si acaso)
  bigModal.addEventListener('show.bs.modal', function(ev){
    var rel = ev.relatedTarget || null;
    if (rel && rel.closest && rel.closest('#perfiles-familiar .plan-cell-perfil')) {
      ev.preventDefault(); ev.stopImmediatePropagation();
      try { bootstrap.Modal.getInstance(bigModal)?.hide(); } catch(_){}
    }
  }, true);
})();
</script>














<script>
(function () {
  const pm = document.getElementById('perfilModal');
  if (!pm) return;

  let lastTrigger = null; // botón que abrió

  // Solo registramos el invocador
  pm.addEventListener('show.bs.modal', function(ev){
    lastTrigger = ev.relatedTarget || null;
  });

  // Ya visible: setear valor y estabilizar backdrop/clase
  pm.addEventListener('shown.bs.modal', function(){
    const form = pm.querySelector('form');
    if (!form) return;

    // 1) Campo precio fijo
    const price = form.querySelector('#modalChildPrecio');
    if (price) {
      const isEditChild = !!(lastTrigger && lastTrigger.hasAttribute('data-row'));
      if (isEditChild) {
        // Prefill desde data-row
        try {
          const row = JSON.parse(lastTrigger.getAttribute('data-row') || '{}');
          const v = (row && (row.soles ?? row.precio));
          if (v != null && v !== '') price.value = String(v);
        } catch(_){}
      } else {
        // Agregar: desde la cabecera (si existe)
        const head = document.getElementById('precioPerfilHead');
        const val  = head ? (head.value || '').trim() : '';
        if (val) price.value = val;
      }
      // Enfoque
      setTimeout(() => { try { price.focus(); } catch(_) {} }, 0);
    }

    // 2) Estabilizadores: un modal, un backdrop, body con modal-open
    if (!document.body.classList.contains('modal-open')) {
      document.body.classList.add('modal-open');
    }
    const backs = document.querySelectorAll('.modal-backdrop');
    if (backs.length > 1) {
      backs.forEach((b, i) => { if (i < backs.length - 1) b.remove(); });
    }

    // 3) Quitar cualquier atributo que bloquee interacción (defensivo)
    pm.removeAttribute('aria-hidden');
    pm.querySelectorAll('[inert]').forEach(el => el.removeAttribute('inert'));
    const dlg = pm.querySelector('.modal-dialog');
    if (dlg) dlg.style.pointerEvents = 'auto';
  }, { capture: true }); // captura para ejecutar antes de otros 'shown'

  // Limpieza
  pm.addEventListener('hidden.bs.modal', function(){
    lastTrigger = null;
    if (!document.querySelector('.modal.show')) {
      document.body.classList.remove('modal-open');
      document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
    }
  }, { capture: true });
})();
</script>




<script>
document.addEventListener('shown.bs.modal', function (ev) {
  if (ev.target.id !== 'perfilModal') return;
  var form  = ev.target.querySelector('form'); if (!form) return;
  var price = form.querySelector('#modalChildPrecio');
  if (!price) {
    var grp = form.querySelector('#childPriceGroup');
    if (!grp) return;
    var inp = document.createElement('input');
    inp.type = 'number';
    inp.step = '0.01';
    inp.min  = '0';
    inp.name = 'soles';
    inp.id   = 'modalChildPrecio';
    inp.className = 'form-control';
    inp.value = '0.00';
    inp.autocomplete = 'off';
    inp.setAttribute('data-keep-soles','1');
    grp.appendChild(inp);
  }
}, true);
</script>











<script>
(function(){
  'use strict';

  var pm = document.getElementById('perfilModal');
  if (!pm) return;

  var lastTrigger = null;

  // Trackea el botón que abrió el modal
  document.addEventListener('click', function(e){
    var btn = e.target && e.target.closest('[data-bs-target="#perfilModal"]');
    if (btn) lastTrigger = btn;
  }, true);

  // NO cancelamos el show (dejamos que Bootstrap haga lo suyo), pero aislamos de handlers de la app
  document.addEventListener('show.bs.modal', function(ev){
    if (ev.target !== pm) return;
    // No mutamos DOM aquí. Solo impedimos que otros handlers de la APP actúen en esta fase.
    ev.stopPropagation();
  }, true);

  // Prefill y “kill-switch” en shown, ANTES que otros handlers
  document.addEventListener('shown.bs.modal', function(ev){
    if (ev.target !== pm) return;

    var form = pm.querySelector('form');
    if (form) {
      // Prefill precio fijo
      var price = form.querySelector('#modalChildPrecio');
      if (price) {
        var isEdit = !!(lastTrigger && lastTrigger.hasAttribute('data-row'));
        if (isEdit) {
          try {
            var row = JSON.parse(lastTrigger.getAttribute('data-row') || '{}');
            var v = (row && (row.soles ?? row.precio));
            if (v != null && v !== '') price.value = String(v);
          } catch(_) {}
        } else {
          var head = document.getElementById('precioPerfilHead');
          var val  = head ? (head.value || '').trim() : '';
          if (val) price.value = val;
        }
        setTimeout(function(){ try { price.focus(); } catch(_) {} }, 0);
      }
    }

    // Estabilizadores visuales
    if (!document.body.classList.contains('modal-open')) {
      document.body.classList.add('modal-open');
    }
    var backs = document.querySelectorAll('.modal-backdrop');
    if (backs.length > 1) {
      backs.forEach(function(b, i){ if (i < backs.length - 1) b.remove(); });
    }

    // Evitar que otros listeners (los de clones/anclas) corran en este ciclo
    ev.stopImmediatePropagation();
    ev.stopPropagation();
  }, true);

  // Limpieza al cerrar
  document.addEventListener('hidden.bs.modal', function(ev){
    if (ev.target !== pm) return;
    lastTrigger = null;
    if (!document.querySelector('.modal.show')) {
      document.body.classList.remove('modal-open');
      document.querySelectorAll('.modal-backdrop').forEach(function(b){ b.remove(); });
    }
    ev.stopPropagation();
  }, true);

  // Observa y elimina clones/anclas “intrusos” dentro de #perfilModal
  var mo = new MutationObserver(function(muts){
    muts.forEach(function(m){
      m.addedNodes && m.addedNodes.forEach(function(n){
        if (n.nodeType !== 1) return;
        // Elimina cualquier clon/ancla o inputs 'soles' no autorizados
        if (
          n.id === 'modalChildPrecio_display' ||
          (n.hasAttribute && (n.hasAttribute('data-price-mount') || n.hasAttribute('data-price-slot'))) ||
          (n.matches && (
            n.matches('[data-price-mount], [data-price-slot], #modalChildPrecio_display') ||
            (n.matches('input[name="soles"]') && n.id !== 'modalChildPrecio')
          ))
        ) {
          n.remove();
        }
      });
    });
  });
  mo.observe(pm, { childList: true, subtree: true });
})();
</script>


<script>
(function(){
  'use strict';

  var m = document.getElementById('perfilFamiliarModal');
  if (!m) return;

  function q(sel){ return m.querySelector(sel); }
  function setVal(name, val){
    var el = q('[name="'+name+'"]'); if (!el) return;
    el.value = (val==null ? '' : String(val));
  }
  function resetSelect(name){
    var el = q('select[name="'+name+'"]'); if (!el) return;
    // “Campos limpios” => primera opción visible
    el.selectedIndex = 0;
  }
  function clearForm(){
    // Limpio todos los que suelen estar en familiar
    ['id','correo','password_plain','perfil','whatsapp','fecha_inicio','fecha_fin','soles'].forEach(function(n){ setVal(n, ''); });
    // Selects a su primera opción
    ['estado','dispositivo','plan','combo'].forEach(resetSelect);
  }
  function fillFromRow(row){
    // Prefill por nombre de campo si existe en el row
    ['id','correo','password_plain','perfil','whatsapp','fecha_inicio','fecha_fin','soles','estado','dispositivo','plan','combo','streaming_id'].forEach(function(n){
      if (Object.prototype.hasOwnProperty.call(row, n)) setVal(n, row[n]);
    });
  }
  function ensureHidden(name){
    var el = q('input[name="'+name+'"]');
    if (!el){
      el = document.createElement('input');
      el.type = 'hidden';
      el.name = name;
      (q('form')||m).appendChild(el);
    }
    return el;
  }

  // Abrir en modo correcto (create vs edit). NO tocar si viene en modo hijo.
  m.addEventListener('show.bs.modal', function(ev){
    if (m.dataset && m.dataset.context === 'child') return; // hijo: no tocar

    var btn = ev.relatedTarget || null;
    var row = null;
    try { row = btn && btn.getAttribute('data-row') ? JSON.parse(btn.getAttribute('data-row')) : null; } catch(_){ row=null; }
    var isEdit = !!(row && (row.id || row.streaming_id || row.perfil_id));

    var form = q('form'); if (!form) return;
    var act  = ensureHidden('action');
    var hid  = ensureHidden('id');

    if (isEdit){
      // === EDITAR (familiar) ===
      act.value = 'update';
      hid.value = row.id || '';
      fillFromRow(row);

      var tit = m.querySelector('#perfilFamiliarModalLabel, .modal-title');
      if (tit) tit.textContent = 'Editar Perfil (familiar)';
      var btnSave = m.querySelector('.modal-footer .btn.btn-primary');
      if (btnSave) btnSave.textContent = 'Guardar cambios';
    } else {
      // === AGREGAR (familiar) => campos LIMPIOS ===
      act.value = 'create';
      hid.value = '';
      clearForm();

      var tit2 = m.querySelector('#perfilFamiliarModalLabel, .modal-title');
      if (tit2) tit2.textContent = 'Agregar Perfil (familiar)';
      var btnSave2 = m.querySelector('.modal-footer .btn.btn-primary');
      if (btnSave2) btnSave2.textContent = 'Guardar';
    }
  }, true);

  // Limpieza de marcas del modal al cerrar (no afecta hijo)
  m.addEventListener('hidden.bs.modal', function(){
    delete m.dataset.context; // si alguien dejó ‘child’, lo limpiamos al cerrar
  }, true);
})();
</script>


<script>
(function(){
  'use strict';

  var m = document.getElementById('perfilFamiliarModal');
  if (!m) return;

  function q(sel){ return m.querySelector(sel); }
  function form(){ return q('form') || m; }

  function setVal(name, val){
    var el = form().querySelector('[name="'+name+'"]');
    if (el) el.value = (val==null ? '' : String(val));
  }
  function selFirst(name){
    var el = form().querySelector('select[name="'+name+'"]');
    if (el) el.selectedIndex = 0;
  }
  function removeRO(sel){
    var el = form().querySelector(sel);
    if (!el) return;
    el.readOnly = false;
    el.removeAttribute('readonly');
    el.classList.remove('bg-light');
  }
  function makeEditable(){
    removeRO('input[name="correo"]');
    removeRO('input[name="password_plain"]');
  }
  function clearForm(){
    // Inputs conocidos en familiar
    ['id','correo','password_plain','perfil','whatsapp','wa_cc','wa_local','fecha_inicio','fecha_fin','soles','streaming_id']
      .forEach(function(n){ setVal(n, ''); });
    // Selects a primera opción (campos “limpios”)
    ['estado','dispositivo','plan','combo'].forEach(selFirst);
    makeEditable();
  }
  function fillFromRow(row){
    if (!row) return;
    Object.keys(row).forEach(function(k){
      setVal(k, row[k]);
    });
  }
  function ensureHidden(name){
    var el = form().querySelector('input[name="'+name+'"]');
    if (!el){
      el = document.createElement('input');
      el.type = 'hidden';
      el.name = name;
      form().appendChild(el);
    }
    return el;
  }
  function setTitle(txt){
    var t = m.querySelector('#perfilFamiliarModalLabel, .modal-title');
    if (t) t.textContent = txt;
  }
  function setPrimary(txt){
    var b = m.querySelector('.modal-footer .btn.btn-primary');
    if (b) b.textContent = txt;
  }

  // --- Apertura del modal: decidir modo (add | edit | child) ---
  m.addEventListener('show.bs.modal', function(ev){
    var f = form(); if (!f) return;
    var btn = ev.relatedTarget || null;

    // Detectar modo:
    // - child: alguien ya puso dataset.context = 'child' antes de abrir (tu flujo actual)
    // - edit : botón con data-row
    // - add  : default
    var isChild = (m.dataset && m.dataset.context === 'child');
    var isEdit  = !isChild && !!(btn && btn.hasAttribute('data-row'));
    var mode    = isChild ? 'child' : (isEdit ? 'edit' : 'add');

    m.dataset.mode = mode;

    // Importante: NO detener propagación en child (deja intacto tu flujo de hijo)
    if (mode !== 'child') {
      // Evita que otros scripts te reescriban el título/estado y “caigan” a Agregar
      ev.stopImmediatePropagation();
      ev.stopPropagation();
    }

    var act = ensureHidden('action');
    var hid = ensureHidden('id');

    if (mode === 'add') {
      // === AGREGAR (familiar) ⇒ SIEMPRE LIMPIO ===
      act.value = 'create';
      hid.value = '';
      clearForm();
      setTitle('Agregar Perfil (familiar)');
      setPrimary('Guardar');

    } else if (mode === 'edit') {
      // === EDITAR (familiar) ⇒ precargar desde data-row ===
      var row = {};
      try { row = JSON.parse(btn.getAttribute('data-row') || '{}'); } catch(_){ row = {}; }
      act.value = 'update';
      hid.value = row.id || '';
      clearForm();       // limpia restos de un “hijo” o “agregar” previos
      fillFromRow(row);  // carga valores del JSON
      makeEditable();    // en editar, correo/clave editables
      setTitle('Editar Perfil (familiar)');
      setPrimary('Guardar cambios');

    } else {
      // child ⇒ no tocamos nada (tu handler de hijo manda)
    }
  }, true);

  // --- Ya visible: reforzar que nadie te cambie el modo/título (solo add/edit) ---
  m.addEventListener('shown.bs.modal', function(ev){
    var mode = m.dataset.mode || '';
    if (!mode || mode === 'child') return;
    ev.stopImmediatePropagation();
    ev.stopPropagation();
  }, true);

  // --- Al cerrar: limpiar por completo para que el próximo “Agregar” salga vacío ---
  m.addEventListener('hidden.bs.modal', function(){
    // borrar marcas de modo/child y limpiar
    delete m.dataset.mode;
    delete m.dataset.context;
    clearForm();
  }, true);
})();
</script>


<script>
// === PERFIL (padre/hijo): en modo HIJO el precio debe ser editable y 0.00 (no anclado) ===
(function(){
  var pm = document.getElementById('perfilModal');
  if (!pm) return;

  function normalizePriceEditable(){
    var f = pm.querySelector('form'); if (!f) return;
    var price = f.querySelector('#modalChildPrecio'); if (!price) return;
    price.readOnly = false;
    price.removeAttribute('readonly');
    price.classList.remove('bg-light');
    // valor por defecto: 0.00 (si prefieres vacío, usa '')
    price.value = '0.00';
  }

  // Antes de que otros scripts toquen el modal
  pm.addEventListener('show.bs.modal', function(){
    if (pm.dataset && pm.dataset.context === 'child') {
      normalizePriceEditable();
    }
  }, true);

  // Reafirma justo al estar visible (y un tick después) por si otro handler lo pisa
  pm.addEventListener('shown.bs.modal', function(){
    if (pm.dataset && pm.dataset.context === 'child') {
      normalizePriceEditable();
      setTimeout(normalizePriceEditable, 0);
    }
  }, true);

  // Limpia el contexto hijo al cerrar
  pm.addEventListener('hidden.bs.modal', function(){
    delete pm.dataset.context;
    delete pm.dataset._childAnchor;
  }, true);
})();
</script>
<script src="/public/assets/js/child_price_killreadonly_v3.js?v=1"></script>

<script>
(function () {
  // Deja visible solo el pane activo
  function showOnly(targetSel) {
    document.querySelectorAll('#streamTabs .tab-pane').forEach(p => {
      const on = ('#' + p.id) === targetSel;
      p.classList.toggle('active', on);
      p.classList.toggle('show', on);
      p.style.display = on ? '' : 'none';
    });
  }

  // Al cargar: determina el pane activo por la pestaña activa; si no hay, usa el primero
  document.addEventListener('DOMContentLoaded', function () {
    const tabsRoot = document.getElementById('streamTabs');
    if (!tabsRoot) return;
    const btnActive = tabsRoot.querySelector('.nav-link.active[data-bs-target]');
    const panes = tabsRoot.querySelectorAll('.tab-pane');
    const initialSel = btnActive?.getAttribute('data-bs-target') || (panes[0] ? ('#' + panes[0].id) : null);
    if (initialSel) showOnly(initialSel);
  });

  // Al cambiar de pestaña (Bootstrap)
  document.addEventListener('shown.bs.tab', function (ev) {
    const targetSel = ev.target?.getAttribute('data-bs-target');
    if (targetSel) showOnly(targetSel);
  });

  // Fallback: si por algún motivo Bootstrap no dispara el evento
  document.addEventListener('click', function (ev) {
    const btn = ev.target.closest('[data-bs-toggle="tab"][data-bs-target]');
    if (!btn) return;
    const sel = btn.getAttribute('data-bs-target');
    if (sel) showOnly(sel);
  });
})();
</script>



<script>
(function () {
  // 1) Mantener un único #pausa activo (ocultar duplicados)
  const pausas = document.querySelectorAll('#pausa');
  if (pausas.length > 1) {
    pausas.forEach((el, i) => {
      if (i === 0) return;           // dejamos visible el primero
      el.id = 'pausa_dup_' + i;      // renombramos para evitar choques
      el.classList.remove('active', 'show');
      el.style.display = 'none';
    });
    // Asegurar que las tabs apunten al #pausa real
    document.querySelectorAll('[data-bs-target="#pausa"]').forEach(btn => {
      btn.setAttribute('data-bs-target', '#pausa');
      btn.setAttribute('aria-controls', 'pausa');
    });
  }

  // 2) Ocultar paginaciones/toolbar en pestañas inactivas
  function applyVisibilityByTab() {
    document.querySelectorAll('.tab-pane').forEach(pane => {
      const active = pane.classList.contains('active') && pane.classList.contains('show');
      pane.querySelectorAll('.pagination, .paginacion, .__filtersWrap__, .filters, .toolbar-filtros')
          .forEach(el => { el.style.display = active ? '' : 'none'; });
    });
  }
  applyVisibilityByTab();

  // Re-aplicar al cambiar de pestaña (eventos Bootstrap)
  document.addEventListener('shown.bs.tab', applyVisibilityByTab);
  document.addEventListener('hidden.bs.tab', applyVisibilityByTab);

  // 3) (Opcional y suave) Reubicar toolbars/paginaciones que estén fuera de su .tab-pane
  document.querySelectorAll('.pagination, .paginacion, .__filtersWrap__, .filters, .toolbar-filtros')
    .forEach(el => {
      if (el.closest('.tab-pane')) return; // ya está dentro
      // Buscar la pestaña visible más cercana para adoptarla
      const panes = Array.from(document.querySelectorAll('.tab-content .tab-pane'));
      // Elegimos la activa; si no hay, la primera
      const target = panes.find(p => p.classList.contains('active')) || panes[0];
      if (target) target.insertBefore(el, target.firstChild);
    });

  // 4) Mini util para detectar IDs duplicados en consola (para depuración)
  //    Abre la consola y pega:
  //    console.log([...document.querySelectorAll('[id]')].map(e=>e.id).filter((id,i,a)=>a.indexOf(id)!==i))
})();
</script>


<script>
/* STREAMING: asegurar que "Perfil familiar" NO se duplique ni aparezca en todos los tabs/páginas */
(function () {
  // Selectores tolerantes: ajusta si ya sabes el nombre exacto de la clase/id
  const ROW_SEL   = 'tr.perfil-familiar-row, tr[data-plan="perfil familiar"], tr[data-perfil-familiar="1"]';
  const BLOCK_SEL = '.perfil-familiar, .perfil-familiar-footer, #perfilFamiliarFooter';

  // 1) Si es FILA de tabla: mantener 1 por tabla y reubicarla en el tbody visible
  function fixPerfilFamiliarRows(scope) {
    const root = scope || document;
    const panes = root.querySelectorAll('.tab-pane');
    panes.forEach(pane => {
      const tbodies = pane.querySelectorAll('table tbody');
      tbodies.forEach(tbody => {
        const rows = tbody.querySelectorAll(ROW_SEL);
        if (!rows.length) return;

        // Dejar solo la primera fila y eliminar duplicados
        rows.forEach((r, i) => { if (i > 0) r.remove(); });

        const row = rows[0];

        // Si por algún motivo la fila quedó fuera del tbody, volver a insertarla
        if (row && row.parentElement !== tbody) {
          tbody.appendChild(row);
        }

        // Si usas paginación por DOM (no DataTables), intenta colocarla después del último <tr> visible
        const visibles = Array.from(tbody.querySelectorAll('tr'))
          .filter(tr => tr !== row && tr.offsetParent !== null);
        const lastVisible = visibles[visibles.length - 1];
        if (row && lastVisible && lastVisible.nextSibling !== row) {
          lastVisible.after(row);
        }
      });
    });
  }

  // 2) Si es BLOQUE suelto: que viva dentro del tab ACTIVO solamente (se mueve entre tabs)
  function fixPerfilFamiliarBlock() {
    const block = document.querySelector(BLOCK_SEL);
    if (!block) return;

    // Mover siempre al tab activo
    const activePane = document.querySelector('.tab-pane.active.show') || document.querySelector('.tab-pane.active');
    if (activePane && !activePane.contains(block)) {
      // Si hay un contenedor de paginación/tabla, lo anclamos al final
      const anchor = activePane.querySelector('.table-responsive') || activePane;
      anchor.appendChild(block);
    }

    // Ocultar en tabs inactivos por si quedara un clon en el HTML inicial (fallback visual)
    document.querySelectorAll('.tab-pane').forEach(p => {
      const el = p.querySelector(BLOCK_SEL);
      if (el) el.style.display = p.classList.contains('active') ? '' : 'none';
    });
  }

  // 3) Ejecutar al inicio
  function applyFix() {
    fixPerfilFamiliarRows(document);
    fixPerfilFamiliarBlock();
  }
  applyFix();

  // 4) Reaplicar al cambiar de tab
  document.addEventListener('shown.bs.tab', applyFix);

  // 5) Reaplicar al paginar (links típicos de paginación)
  document.addEventListener('click', function (ev) {
    if (ev.target.closest('.pagination a, .page-link')) {
      // Un pequeño timeout para esperar que el DOM de la página cambie
      setTimeout(applyFix, 0);
    }
  }, true);

  // 6) Si usas DataTables (opcional): re-fijar en cada draw
  if (window.jQuery && jQuery.fn && jQuery.fn.dataTable) {
    jQuery(document).on('draw.dt', applyFix);
  }

  // 7) Fallback visual extra: nunca mostrar el bloque fuera del tab activo
  const style = document.createElement('style');
  style.textContent =
    '.tab-pane:not(.active) .perfil-familiar, ' +
    '.tab-pane:not(.active) .perfil-familiar-footer { display:none !important; }';
  document.head.appendChild(style);
})();
</script>

<script>
(function () {
  const ROOT = document.getElementById('streamTabs');
  if (!ROOT) return;

  // Qué clases/elementos de UI queremos ocultar en panes inactivos
  const UI_SELECTORS = [
    '.table-pager',
    '.filters-bar',
    '.toolbar-filtros',
    '.js-filters-root',
    '.__filtersWrap__'
  ];

  function currentTargetSel() {
    const btnActive = ROOT.querySelector('.nav-link.active[data-bs-target]');
    const panes = ROOT.querySelectorAll('.tab-pane');
    return btnActive?.getAttribute('data-bs-target') || (panes[0] ? ('#' + panes[0].id) : null);
  }

  function toggleScopedUI(targetSel) {
    if (!targetSel) return;
    // Mostrar sólo la UI del pane activo y ocultar la del resto
    ROOT.querySelectorAll('.tab-pane').forEach(pane => {
      const on = ('#' + pane.id) === targetSel;
      UI_SELECTORS.forEach(sel => {
        pane.querySelectorAll(sel).forEach(el => {
          el.style.display = on ? '' : 'none';
        });
      });
    });
  }

  // Inicializar al cargar (por si la UI ya está pintada)
  function initOnce() {
    const sel = currentTargetSel();
    toggleScopedUI(sel);
  }

  // Al cambiar de pestaña (evento de Bootstrap)
  document.addEventListener('shown.bs.tab', function (ev) {
    const targetSel = ev.target?.getAttribute('data-bs-target');
    if (targetSel) toggleScopedUI(targetSel);
  });

  // Si la app crea paginaciones/toolbar dinámicamente, observa cambios y re-aplica
  const mo = new MutationObserver(() => toggleScopedUI(currentTargetSel()));
  mo.observe(ROOT, { childList: true, subtree: true });

  // Asegura que corre cuando todo esté cargado (por si tus scripts crean la paginación tarde)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOnce);
    window.addEventListener('load', initOnce);
  } else {
    initOnce();
    window.addEventListener('load', initOnce);
  }
})();
</script>
<script>
(function () {
  // Encuentra el pane de "Familiar" por id o data-attr
  function getFamiliarPane() {
    return document.querySelector(
      '.tab-pane[id*="familiar" i], .tab-pane[data-tab*="familiar" i]'
    );
  }

  // Heurística para identificar el bloque "Perfil familiar"
  function isFamiliarBlock(el) {
    if (!el) return false;
    const t = (el.textContent || '').toLowerCase();
    if (!t.includes('perfil familiar')) return false;
    // Evitamos filas de tabla; nos quedamos con avisos/leyendas pequeñitas
    if (el.closest('table')) return false;
    // Si tiene pinta de leyenda/aviso, mejor.
    if (
      el.matches('.alert, .form-text, .small, .perfil-familiar, .perfil-familiar-legend')
    ) return true;
    // Como fallback, aceptamos DIVs/SECTION con ese texto
    return el.matches('div, section, article');
  }

  function findFamiliarBlocks() {
    const out = [];
    document.querySelectorAll('div, section, article, .alert, .form-text, .small')
      .forEach(el => { if (isFamiliarBlock(el)) out.push(el); });
    return out;
  }

  // Mantener SOLO uno, y SOLO dentro del pane de Familiar
  function dedupeFamiliar() {
    const familiarPane = getFamiliarPane();
    if (!familiarPane) return;

    const blocks = findFamiliarBlocks();
    if (!blocks.length) return;

    // Preferimos mantener el que ya esté dentro del pane familiar
    let keep = blocks.find(b => familiarPane.contains(b));
    if (!keep) {
      keep = blocks[0];
      familiarPane.appendChild(keep);
    }

    // Eliminamos los duplicados fuera del pane correto
    blocks.forEach(b => { if (b !== keep) b.remove(); });
  }

  // Llamadas debounced para tolerar re-render/paginación
  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; dedupeFamiliar(); });
  }

  document.addEventListener('DOMContentLoaded', schedule);
  // Al cambiar de tab en Bootstrap
  document.addEventListener('shown.bs.tab', schedule, true);
  // Si tu paginación o filtros mutan el DOM, observamos y re-aplicamos
  const root = document.getElementById('streamingTabs') || document.body;
  new MutationObserver(schedule).observe(root, { childList: true, subtree: true });
})();
</script>
<script>
// --- Mutex para modales en Streaming (abre uno y cierra el resto)
(function () {
  if (window.__streamingModalMutex) return;
  window.__streamingModalMutex = true;

  // 1) Siempre que se vaya a abrir un modal, cierra cualquier otro que esté abierto
  document.addEventListener('show.bs.modal', function (ev) {
    document.querySelectorAll('.modal.show').forEach(m => {
      if (m !== ev.target) {
        try { bootstrap.Modal.getOrCreateInstance(m).hide(); } catch(_) {}
      }
    });
    // Limpia posibles backdrops viejos (por si quedaron)
    setTimeout(() => {
      const backs = document.querySelectorAll('.modal-backdrop');
      if (backs.length > 1) {
        backs.forEach((b,i) => { if (i < backs.length - 1) b.remove(); });
      }
    }, 10);
  });

  // 2) Encadena "Crear hijo": cierra el modal actual y luego abre el de hijo
  document.addEventListener('click', function (ev) {
    const btn = ev.target.closest(
      '.btn-add-hijo, .btn-add-hijo-fam, [data-mode="add-hijo"], [data-modal-context="child"]'
    );
    if (!btn) return;

    // Si el botón usa data-bs-toggle="modal", prevenimos la apertura automática
    ev.preventDefault();
    ev.stopPropagation();

    const targetSel = btn.getAttribute('data-bs-target') || '#perfilHijoModal';
    const targetEl  = document.querySelector(targetSel);
    if (!targetEl) return;

    const currentModal = btn.closest('.modal');
    if (currentModal) {
      const m = bootstrap.Modal.getOrCreateInstance(currentModal);
      // Cuando termine de ocultarse, abrimos el de hijo
      currentModal.addEventListener('hidden.bs.modal', function openChildOnce () {
        currentModal.removeEventListener('hidden.bs.modal', openChildOnce);
        try { bootstrap.Modal.getOrCreateInstance(targetEl).show(); } catch(_) {}
      });
      m.hide();
    } else {
      // Si el botón está fuera de un modal, abre directamente el de hijo
      try { bootstrap.Modal.getOrCreateInstance(targetEl).show(); } catch(_) {}
    }
  }, true);

  // 3) Sanitiza backdrops “huérfanos” cuando se cierre cualquier modal
  document.addEventListener('hidden.bs.modal', function () {
    // Si no queda ningún modal visible, deja 1 o 0 backdrops
    if (!document.querySelector('.modal.show')) {
      const backs = document.querySelectorAll('.modal-backdrop');
      backs.forEach((b,i) => { if (i > 0) b.remove(); });
    }
  });
})();
</script>

<script>
/* Gate de seguridad: el modal #perfilFamiliarModal SOLO se abre dentro del tab #perfiles-familiar */
(function () {
  if (window.__famModalGateInit) return;
  window.__famModalGateInit = true;

  const inside = (el, sel) => !!(el && el.closest(sel));

  // 1) Bloquea disparos del modal familiar fuera de su tab
  document.addEventListener('click', function (ev) {
    const trg = ev.target.closest(
      '[data-bs-target="#perfilFamiliarModal"],[data-target="#perfilFamiliarModal"],.btn-add-perfil-fam,.btn-add-hijo-fam'
    );
    if (!trg) return;

    // Si no está dentro del tab Familiar, cancelamos el disparo
    if (!inside(trg, '#perfiles-familiar')) {
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

      // (Opcional) Si este click vino desde la tabla de Perfiles,
      // redirige al modal de "Agregar Hijo" normal:
      const fromPerfiles = trg.closest('#perfilesTable');
      const childTarget  = '#perfilHijoModal'; // <-- cambia si tu ID es otro
      if (fromPerfiles && document.querySelector(childTarget)) {
        const cur = trg.closest('.modal');
        const openChild = () => bootstrap.Modal.getOrCreateInstance(document.querySelector(childTarget)).show();
        if (cur) {
          const m = bootstrap.Modal.getOrCreateInstance(cur);
          cur.addEventListener('hidden.bs.modal', function once(){ cur.removeEventListener('hidden.bs.modal', once); openChild(); });
          m.hide();
        } else {
          openChild();
        }
      }
    }
  }, true);

  // 2) Por si algún handler viejo intenta abrir #perfilFamiliarModal al clickear filas de Perfiles:
  document.addEventListener('click', function (ev) {
    const rowInPerfiles = ev.target.closest('#perfilesTable tr.js-parent-row');
    if (!rowInPerfiles) return;
    const badHit = ev.target.closest('[data-bs-target="#perfilFamiliarModal"],[data-target="#perfilFamiliarModal"]');
    if (badHit) {
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
    }
  }, true);

  // 3) Mutex: nunca 2 modales a la vez (evita superposición)
  document.addEventListener('show.bs.modal', function (ev) {
    document.querySelectorAll('.modal.show').forEach(m => {
      if (m !== ev.target) {
        try { bootstrap.Modal.getOrCreateInstance(m).hide(); } catch(_) {}
      }
    });
    setTimeout(() => {
      const backs = document.querySelectorAll('.modal-backdrop');
      if (backs.length > 1) {
        backs.forEach((b,i) => { if (i < backs.length - 1) b.remove(); });
      }
    }, 10);
  });
})();
</script>



<script>
/* STREAMING: guardar color -> pintar fila/grupo de forma robusta */
(function(){
  const formEl  = document.getElementById('formCambiarColor');    // usa el id real de tu formulario
  const modalEl = document.getElementById('modalCambiarColor');   // usa el id real de tu modal
  if (!formEl || !modalEl) return;

  const COLOR_CLASSES = ['row-color-rojo','row-color-azul','row-color-verde','row-color-blanco'];

  // Guardamos la última fila clickeada (sirve de fallback si no hay tr[data-id])
  let LAST_ORIGIN_TR = null;
  document.addEventListener('click', function(ev){
    const td = ev.target.closest('td.plan-cell, td.plan-cell-familiar, td.stock-cell, td.nombre-cell, td[data-id]');
    if (!td) return;
    const tr = td.closest('tr');
    if (tr) LAST_ORIGIN_TR = tr;
  }, true);

  function findRowById(id){
    // 1) Intentar con tr[data-id]
    let tr = document.querySelector(`tr[data-id="${id}"]`);
    if (tr) return tr;
    // 2) Intentar con td[data-id]
    const td = document.querySelector(`td[data-id="${id}"]`);
    if (td) return td.closest('tr');
    // 3) Último recurso: la última fila clickeada
    return LAST_ORIGIN_TR || null;
  }

  function setRowColor(tr, color){
    if (!tr) return;
    tr.classList.remove(...COLOR_CLASSES);
    tr.dataset.color = color || '';
    if (color) tr.classList.add('row-color-' + color);
  }

  function paintGroupFrom(parentTr, color){
    if (!parentTr) return;
    setRowColor(parentTr, color);
    // Propagar a hijos visibles hasta el siguiente padre o separador
    let n = parentTr.nextElementSibling;
    while (n && !n.matches('.js-parent-row,[data-sep="1"]')) {
      if (n.matches('tr')) setRowColor(n, color);
      n = n.nextElementSibling;
    }
  }

  formEl.addEventListener('submit', async function(ev){
    ev.preventDefault(); ev.stopPropagation();

    const id    = Number(formEl.querySelector('#cc_id')?.value || 0);
    const tipo  = (formEl.querySelector('#cc_tipo')?.value || '').trim();
    const color = (formEl.querySelector('#cc_color')?.value || '').trim(); // '', rojo, azul, verde, blanco
    if (!id) return;

    // Llamada al endpoint (ya lo tienes funcionando)
    try {
      const res = await fetch(formEl.action || (window.IPTV_ENDPOINTS?.color || ''), {
        method: 'POST',
        headers: {'Content-Type':'application/json','Accept':'application/json'},
        body: JSON.stringify({action:'color', id, tipo, color}),
        credentials: 'same-origin'
      });
      const js = await res.json().catch(()=>({ok:false}));
      if (!res.ok || !js.ok) throw new Error(js.error || ('HTTP '+res.status));
    } catch (e) {
      console.error('color save failed', e);
      alert('No se pudo cambiar el color');
      return;
    }

    // Pintar inmediatamente en DOM (aunque haya paginación)
    const parent = findRowById(id);
    if (!parent) {
      console.warn('No encontré la fila para pintar (id=', id, '). Verifica que el <tr> o el <td> tengan data-id="ID".');
    } else {
      paintGroupFrom(parent, color);
    }

    if (window.bootstrap?.Modal) bootstrap.Modal.getOrCreateInstance(modalEl).hide();
  }, true);
})();
</script>

<style>
  /* Asegura que el color gane a .table-striped / .table-light */
  .row-color-rojo   > * { background: #ffe5e5 !important; }
  .row-color-azul   > * { background: #e5f0ff !important; }
  .row-color-verde  > * { background: #e9ffe5 !important; }
  .row-color-blanco > * { background: #ffffff !important; }
</style>

<script>
(function(){
  const COLOR_CLASSES = ['row-color-rojo','row-color-azul','row-color-verde','row-color-blanco'];

  function reapplyColors(root){
    root.querySelectorAll('tr[data-color]').forEach(tr=>{
      const c = (tr.dataset.color || '').trim();
      tr.classList.remove(...COLOR_CLASSES);
      if (c) tr.classList.add('row-color-' + c);
    });
  }

  // 1) Reaplicar al cargar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ()=> reapplyColors(document));
  } else {
    reapplyColors(document);
  }

  // 2) Reaplicar después de cambiar de página (click en paginador)
  document.addEventListener('click', (e)=>{
    if (e.target.closest('.table-pager .page-link')) {
      setTimeout(()=> reapplyColors(document), 0);
    }
  });

  // 3) Reaplicar después de filtros (si no emites eventos, usamos cambios de selects/inputs comunes)
  document.addEventListener('change', (e)=>{
    if (e.target.closest('.__pcFilter__')) {
      setTimeout(()=> reapplyColors(document), 0);
    }
  });
  document.addEventListener('input', (e)=>{
    if (e.target.closest('.__pcFilter__')) {
      setTimeout(()=> reapplyColors(document), 0);
    }
  });

  // 4) Hook opcional: si tu código emite eventos propios tras paginar/filtrar, los escuchamos
  document.addEventListener('pc:after-filter', ()=> reapplyColors(document));
  document.addEventListener('pc:after-paginate', ()=> reapplyColors(document));

  // 5) Si ya tienes un submit que guarda el color, añade ESTO al success del fetch:
  window.__afterColorSaved = function(id, color){
    // Actualiza data-color para que los filtros/paginación no “borren” el color
    let tr = document.querySelector(`tr[data-id="${id}"]`) ||
             document.querySelector(`td[data-id="${id}"]`)?.closest('tr');
    if (tr) {
      tr.dataset.color = color || '';
      tr.classList.remove(...COLOR_CLASSES);
      if (color) tr.classList.add('row-color-' + color);

      // Propagar a los hijos del grupo visible
      let n = tr.nextElementSibling;
      while (n && !n.matches('.js-parent-row,[data-sep="1"]')) {
        n.dataset.color = color || '';
        n.classList.remove(...COLOR_CLASSES);
        if (color) n.classList.add('row-color-' + color);
        n = n.nextElementSibling;
      }
    }
  };
})();
</script>

<script>
(function(){
  const C = ['row-color-rojo','row-color-azul','row-color-verde','row-color-blanco'];
  function reapplyColors(root=document){
    root.querySelectorAll('tr[data-color]').forEach(tr=>{
      const col = (tr.dataset.color || '').trim();
      tr.classList.remove(...C);
      if (col) tr.classList.add('row-color-' + col);
    });
  }
  document.addEventListener('pc:after-filter', ()=> reapplyColors());
  document.addEventListener('pc:after-paginate', ()=> reapplyColors());

  // Por si tus filtros no emiten eventos propios:
  document.addEventListener('click', e=>{
    if (e.target.closest('.table-pager .page-link')) setTimeout(reapplyColors, 0);
  });
})();
</script>

<script>
(function () {
  const form = document.getElementById('formPlanStockPausa');
  if (!form || form.dataset._reloadBound === '1') return;
  form.dataset._reloadBound = '1';

  // Bandera: solo recargar tras este formulario
  form.addEventListener('submit', function () {
    window.__reloadAfterPlanChange = true;
  }, true);

  // ---------- Hook para fetch ----------
  if (window.fetch && !window.__reloadHookFetchInstalled) {
    window.__reloadHookFetchInstalled = true;
    const _origFetch = window.fetch.bind(window);

    window.fetch = async function (...args) {
      const res = await _origFetch(...args);
      try {
        if (window.__reloadAfterPlanChange) {
          const clone = res.clone();
          const ct = (clone.headers.get('content-type') || '').toLowerCase();
          if (ct.includes('application/json')) {
            const data = await clone.json().catch(() => null);
            if (data && (data.ok === true || data.success === true) &&
               (data.updated === true || data.saved === true || data.status === 'ok')) {
              window.__reloadAfterPlanChange = false;
              // un pequeño delay por si cierras el modal primero
              setTimeout(() => location.reload(), 50);
            }
          }
        }
      } catch (e) {
        // si algo falla, limpiamos la bandera para no recargar en otro fetch
        window.__reloadAfterPlanChange = false;
      }
      return res;
    };
  }

  // ---------- Hook para XHR (por si usas XMLHttpRequest) ----------
  if (!window.__reloadHookXHRInstalled) {
    window.__reloadHookXHRInstalled = true;
    const _open = XMLHttpRequest.prototype.open;
    const _send = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
      this.__isTargetXHR = !!window.__reloadAfterPlanChange;
      return _open.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function (body) {
      if (this.__isTargetXHR) {
        this.addEventListener('load', function () {
          try {
            if (!window.__reloadAfterPlanChange) return;

            const ct = (this.getResponseHeader('Content-Type') || '').toLowerCase();
            if (ct.includes('application/json')) {
              const data = JSON.parse(this.responseText || 'null');
              if (data && (data.ok === true || data.success === true) &&
                 (data.updated === true || data.saved === true || data.status === 'ok')) {
                window.__reloadAfterPlanChange = false;
                setTimeout(() => location.reload(), 50);
              }
            }
          } catch (e) {
            window.__reloadAfterPlanChange = false;
          }
        }, { once: true });
      }
      return _send.apply(this, arguments);
    };
  }
})();
</script>

<script>
(function () {
  const form = document.getElementById('formPlanStockPausa');
  if (!form || form.dataset._reloadBound === '1') return;
  form.dataset._reloadBound = '1';

  // 1) Marcamos que hubo submit (no prevenimos el submit)
  form.addEventListener('submit', function () {
    form.dataset._submitted = '1';

    // 1.a) Fallback: si el flujo es 100% AJAX y nadie recarga,
    //      forzamos reload tras ~1.2s (da tiempo a que el backend guarde)
    setTimeout(function () {
      // Solo si sigue marcado como "enviado" (no nos adelantamos)
      if (form.dataset._submitted === '1') {
        location.reload();
      }
    }, 1200);
  }, true);

  // 2) Si el modal se cierra (lo normal tras OK), recargamos en ese momento
  const modalEl = form.closest('.modal');
  if (modalEl) {
    modalEl.addEventListener('hidden.bs.modal', function () {
      if (form.dataset._submitted === '1') {
        // Quitamos la marca para que no dispare también el fallback
        form.dataset._submitted = '';
        location.reload();
      }
    });
  }
})();
</script>
<script>
/* ===== PATCH: Cambiar plan (Stock/Pausa) sin 'modalPlanStockPausa' y con reload ===== */
(function(){
  const FORM_ID = 'formPlanStockPausa'; // Ajusta si tu form tiene otro id
  const form = document.getElementById(FORM_ID);
  if (!form || form.dataset.sppPatchBound) return;
  form.dataset.sppPatchBound = '1';

  async function postJson(url, body){
    const res = await fetch(url, { method:'POST', body, credentials:'same-origin' });
    const js  = await res.json().catch(()=>({ok:false,error:'Respuesta inválida'}));
    if (!res.ok || !js.ok) throw new Error(js.error || ('HTTP '+res.status));
    return js;
  }

  async function onSubmit(ev){
    ev.preventDefault();
    ev.stopImmediatePropagation();
    if (form.dataset.sending === '1') return;

    const fd    = new FormData(form);
    const id    = +(fd.get('id') || 0);
    const tipo  = (fd.get('tipo') === 'pausa') ? 'pausa' : 'stock';

    // Asegura plan (por si el <select> está oculto y hay un input hidden con el valor)
    let plan = (fd.get('plan') || '').trim();
    if (!plan) {
      const sel = form.querySelector('#spp_plan');
      if (sel && sel.value) { plan = sel.value; fd.set('plan', plan); }
      const hiddenPlan = form.querySelector('input[name="plan"][type="hidden"]');
      if (!plan && hiddenPlan && hiddenPlan.value) { plan = hiddenPlan.value; fd.set('plan', plan); }
    }

    const color = (fd.get('color') || '').trim();
    if (!id || !plan) {
      try { await Swal.fire({icon:'warning',title:'Faltan datos',text:'ID y Plan son obligatorios.'}); } catch(_){}
      return;
    }

    form.dataset.sending = '1';
    try {
      // POST al backend
      const js = await postJson('ajax/stock_pausa_plan_update.php', fd);

      // Pintado optimista
      const sel = (tipo === 'stock')
        ? '.plan-cell-stock[data-id="'+id+'"]'
        : '.plan-cell-pausa[data-id="'+id+'"]';
      const td  = document.querySelector(sel);
      const tr  = td?.closest('tr');
      if (tr) {
        tr.classList.remove('row-color-rojo','row-color-azul','row-color-verde','row-color-blanco');
        tr.removeAttribute('data-color');
        if (color && color !== 'restablecer') {
          tr.classList.add('row-color-' + color);
          tr.setAttribute('data-color', color);
        }
      }

      // Cerrar modal de forma segura (sin depender de 'modalPlanStockPausa')
      try {
        if (window.bootstrap?.Modal) {
          const open = document.querySelector('.modal.show');
          if (open) bootstrap.Modal.getOrCreateInstance(open).hide();
        } else if (typeof modalPlanStockPausa !== 'undefined' && modalPlanStockPausa?.hide) {
          // Fallback si realmente existiera esa variable en otra vista
          modalPlanStockPausa.hide();
        }
      } catch(_){}

      // Aviso breve y reload
      try { Swal.fire({icon:'success',title:'Actualizado',timer:700,showConfirmButton:false}); } catch(_){}
      setTimeout(function(){ location.reload(); }, 200);
    } catch(e) {
      try { await Swal.fire({icon:'error',title:'Error',text: e?.message || String(e)}); } catch(_){ alert(e?.message || String(e)); }
    } finally {
      form.dataset.sending = '';
    }
  }

  // Bind en capture para ganarle a cualquier otro listener
  form.addEventListener('submit', onSubmit, { capture:true });
  console.log('[sppPatch] submit parcheado (sin modalPlanStockPausa) + reload');
})();
</script>
<!-- PATCH: Inicialización segura del modal de HIJO (Streaming Familiar) -->
<script>
(function () {
  if (window.__famChildPatch_v1) return; window.__famChildPatch_v1 = true;

  var fam = document.getElementById('perfilFamiliarModal');
  if (!fam) return;

  // Al terminar de mostrarse el modal (después de otros handlers globales)
  fam.addEventListener('shown.bs.modal', function () {
    // Si el modal fue abierto desde click en fila (openBigFromRow),
    // no reseteamos correo/password/precio; respetamos lo que ya se seteó.
    if (fam.getAttribute('data-open-from-row') === '1') {
      fam.removeAttribute('data-open-from-row');
      return;
    }

    var form = fam.querySelector('form');
    if (!form) return;

    // 1) Correo: vacío + editable
    var correo = form.querySelector('input[name="correo"]');
    if (correo) {
      correo.value = '';
      correo.readOnly = false;
      correo.removeAttribute('readonly');
      correo.classList.remove('bg-light', 'readonly');
    }

    // 2) Password: predeterminada + readonly (toma de data- o fallback '1234')
    var pwd = form.querySelector('input[name="password_plain"]');
    if (pwd) {
      var def = fam.getAttribute('data-default-password') || '1234';
      pwd.value = def;
      pwd.readOnly = true;
      pwd.setAttribute('readonly', 'readonly');
      pwd.classList.add('bg-light');
    }

    // 3) Precio: montar input limpio y editable en el slot (sin arrastrar valor del header)
    var slot = fam.querySelector('#famChildPriceSlot');
    if (slot) {
      slot.innerHTML = '<input type="number" name="soles" step="0.01" min="0" class="form-control" placeholder="0.00">';
    }
    var price = form.querySelector('input[name="soles"]');
    if (price) {
      price.value = '';
      price.readOnly = false;
      price.removeAttribute('readonly');
      price.classList.remove('bg-light');
    }
  });
})();
</script>



<script>
(function () {
  /**
   * Si el valor tiene SOLO dígitos y espacios, lo formatea "999 999 999".
   * Si tiene letras o símbolos (@, ., etc.), lo devuelve tal cual.
   */
  function formatPeruPhoneIfOnlyDigits(value) {
    const raw = value || '';

    // Si hay letras o símbolos distintos de espacio/dígitos, NO tocamos nada
    if (!/^[0-9\s]*$/.test(raw)) {
      return raw;
    }

    // Solo dígitos
    let digits = raw.replace(/\D+/g, '');
    // Máx 9 dígitos
    digits = digits.slice(0, 9);

    // Agrupar 3 a 3: 123456789 -> 123 456 789
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return digits.slice(0, 3) + ' ' + digits.slice(3);
    return digits.slice(0, 3) + ' ' + digits.slice(3, 6) + ' ' + digits.slice(6);
  }

  function initWhatsappSearchMask() {
    var inputs = document.querySelectorAll('.js-whatsapp-search');
    if (!inputs.length) return;

    inputs.forEach(function (inp) {
      inp.addEventListener('input', function () {
        var old = inp.value;
        var formatted = formatPeruPhoneIfOnlyDigits(old);

        // Si no cambió, no hacemos nada
        if (formatted === old) return;

        inp.value = formatted;
        // Cursor al final (suficiente para un buscador)
        inp.setSelectionRange(inp.value.length, inp.value.length);
      });

      inp.addEventListener('paste', function () {
        setTimeout(function () {
          inp.value = formatPeruPhoneIfOnlyDigits(inp.value);
        }, 0);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWhatsappSearchMask);
  } else {
    initWhatsappSearchMask();
  }
})();
</script>

<script>
(function () {
  // Celdas de plan en pestaña Perfiles
  var cells = document.querySelectorAll('.plan-cell-perfil');
  if (!cells.length) return;

  cells.forEach(function (cell) {
    cell.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') {
        e.stopImmediatePropagation();
      }

      var id = this.getAttribute('data-id') || '';

      // Ajusta estos IDs al modal real que tengas para cambiar plan:
      var modalEl = document.getElementById('modalCambiarPlanPerfil'); // TODO: cambiar si se llama distinto
      var inputId = modalEl ? modalEl.querySelector('input[name="id"]') : null;

      if (inputId) inputId.value = id;

      if (modalEl && window.bootstrap) {
        bootstrap.Modal.getOrCreateInstance(modalEl).show();
      }
    }, true); // capture = true para adelantarnos a otros listeners
  });
})();
</script>
<script>
(function () {
  'use strict';

  function formatWhatsappInput(input) {
    if (!input) return;

    let v = input.value || '';

    // Si parece correo (lleva letras o '@'), no tocamos nada
    if (/[a-zA-Z@]/.test(v)) {
      return;
    }

    // Extraer sólo dígitos
    const digits = v.replace(/\D/g, '');
    if (!digits) {
      input.value = '';
      return;
    }

    // Agrupar en bloques de 3: 999 999 999 ...
    const formatted = digits.replace(/(\d{3})(?=\d)/g, '$1 ');
    input.value = formatted;
  }

  // Delegado: cualquier input en .js-whatsapp-search
  document.addEventListener('input', function (e) {
    const el = e.target;
    if (!el.matches('.js-whatsapp-search')) return;
    formatWhatsappInput(el);
  });

  // También al salir del campo (por si el usuario pega el número de golpe)
  document.addEventListener('blur', function (e) {
    const el = e.target;
    if (!el.matches('.js-whatsapp-search')) return;
    formatWhatsappInput(el);
  }, true);

})();
</script>
<script>
(function () {
  'use strict';

  const PER_PAGE = 35;
  let currentPage = 1;
  let totalPages  = 1;
  let allRows = [];
  let filterIsActive = false;

  function initPerfilesPagination() {
    const pane  = document.getElementById('perfiles');
    if (!pane) return;

    const table = pane.querySelector('#perfilesTable');
    const pager = document.getElementById('perfilesPager');
    if (!table || !pager) return;

    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    // Todas las filas de perfiles (incluyendo separadores)
    allRows = Array.from(tbody.querySelectorAll('tr'));

    // Calculamos páginas SOLO cuando no hay filtro
    recomputePages();
    renderPage(1);

    // Click en paginador
    pager.addEventListener('click', function (ev) {
      const link = ev.target.closest('a.page-link');
      if (!link) return;
      ev.preventDefault();

      const page = parseInt(link.dataset.page, 10);
      if (!page || page < 1 || page > totalPages) return;

      renderPage(page);
    });
  }

  function recomputePages() {
    if (!allRows.length) {
      totalPages = 1;
      currentPage = 1;
      return;
    }

    // Contamos solo las filas de perfiles "padres" para paginar por grupos
    // (no contamos separadores data-sep="1")
    const parentRows = allRows.filter(tr =>
      tr.classList.contains('js-parent-row') && !tr.hasAttribute('data-sep')
    );

    const totalParents = parentRows.length || 1;
    totalPages = Math.max(1, Math.ceil(totalParents / PER_PAGE));

    if (currentPage > totalPages) currentPage = totalPages;
  }

  function renderPager() {
    const pager = document.getElementById('perfilesPager');
    if (!pager) return;

    const ul = pager.querySelector('ul.pagination');
    if (!ul) return;

    ul.innerHTML = '';

    if (filterIsActive || totalPages <= 1) {
      pager.style.display = 'none';
      return;
    }

    pager.style.display = '';

    function addItem(page, label, isActive = false, isDisabled = false) {
      const li = document.createElement('li');
      li.className = 'page-item' + (isActive ? ' active' : '') + (isDisabled ? ' disabled' : '');
      const a = document.createElement('a');
      a.className = 'page-link';
      a.href = '#';
      a.dataset.page = page;
      a.textContent = label;
      li.appendChild(a);
      ul.appendChild(li);
    }

    // Prev
    if (currentPage > 1) {
      addItem(currentPage - 1, '«', false, false);
    }

    for (let i = 1; i <= totalPages; i++) {
      addItem(i, String(i), i === currentPage, false);
    }

    // Next
    if (currentPage < totalPages) {
      addItem(currentPage + 1, '»', false, false);
    }
  }

  function renderPage(page) {
    const pane  = document.getElementById('perfiles');
    if (!pane || !allRows.length) return;

    const tbody = pane.querySelector('#perfilesTable tbody');
    if (!tbody) return;

    currentPage = page;

    // Si hay filtro activo → mostrar TODO y ocultar paginador
    if (filterIsActive) {
      allRows.forEach(tr => {
        tr.style.display = ''; // dejamos que el filtro JS se encargue de ocultar lo que no cuadra
      });
      renderPager();
      return;
    }

    // Paginación SIN filtro:
    // contamos padres y vamos mostrando/ocultando grupos
    let parentIndex = 0;
    const startParent = (currentPage - 1) * PER_PAGE;
    const endParent   = startParent + PER_PAGE;

    // Primero mostramos todo para que el filtro de grupos JS pueda trabajar encima si hace falta
    allRows.forEach(tr => tr.style.display = 'none');

    allRows.forEach(tr => {
      const isParent = tr.classList.contains('js-parent-row') && !tr.hasAttribute('data-sep');

      if (isParent) {
        // ¿Este padre cae en la ventana de esta página?
        const inPage = parentIndex >= startParent && parentIndex < endParent;
        parentIndex++;

        if (inPage) {
          // Mostrar este padre
          tr.style.display = '';

          // Mostrar las filas hijas que estén justo debajo hasta llegar a otro padre o separador
          let next = tr.nextElementSibling;
          while (next && !next.classList.contains('js-parent-row') && !next.hasAttribute('data-sep')) {
            next.style.display = '';
            next = next.nextElementSibling;
          }

          // También mostramos el separador inmediatamente anterior (si existe y es data-sep)
          let prev = tr.previousElementSibling;
          if (prev && prev.hasAttribute('data-sep')) {
            prev.style.display = '';
          }
        }
      }
    });

    renderPager();
  }

  // ===== Integración con TU filtro existente =====
  // Idea: cuando haya cualquier filtro activo, ponemos filterIsActive = true
  // y llamamos a renderPage(1) para que muestre todo (paginación OFF).

  function hookFilters() {
    const pane = document.getElementById('perfiles');
    if (!pane) return;

    const scopeFilter = pane.querySelector('.__pcFilter__');
    if (!scopeFilter) return;

    const mainSel  = scopeFilter.querySelector('.pc-main');
    const planSel  = scopeFilter.querySelector('.pc-plan');
    const search   = scopeFilter.querySelector('.js-whatsapp-search');
    const clearBtn = scopeFilter.querySelector('.pc-clear');

    function updateFilterState() {
      const mainVal = mainSel && mainSel.value.trim();
      const planVal = planSel && planSel.value.trim();
      const q       = search && search.value.trim();

      filterIsActive = !!(mainVal || planVal || q);

      // Dejamos que tu applyFilters() haga lo suyo:
      // (ya está enganchado en otros scripts)
      // Solo después, reajustamos la paginación:
      renderPage(1);
    }

    if (mainSel)  mainSel.addEventListener('change', updateFilterState);
    if (planSel)  planSel.addEventListener('change', updateFilterState);
    if (search)   search.addEventListener('input',  updateFilterState);
    if (clearBtn) clearBtn.addEventListener('click', function () {
      // Al limpiar, se desactiva el filtro
      filterIsActive = false;
      // Tu JS ya limpia filtros y vuelve a mostrar todo
      renderPage(1);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initPerfilesPagination();
    hookFilters();
  });
})();
</script>





<!-- /public/streaming.php — Validación de correo duplicado SOLO para PADRES en pestaña Perfiles -->
<script>
  (function () {
    'use strict';

    document.addEventListener('submit', function (ev) {
      var form  = ev.target;
      var modal = document.getElementById('perfilModal');
      if (!form || !modal || !modal.contains(form)) return; // sólo forms del modal de Perfiles

      // 1) Ver si es HIJO o PADRE leyendo el hidden is_child
      var flag = form.querySelector('input[name="is_child"]');
      var isChild = flag && String(flag.value || '0') === '1';

      // Si es hijo, NO validamos aquí (el hijo sí puede repetir correo)
      if (isChild) return;

      // 2) Leer correo
      var emailInput = form.querySelector('input[name="correo"]');
      if (!emailInput) return;

      var correo = String(emailInput.value || '').trim().toLowerCase();
      if (!correo) return;

      // 3) Tabla donde buscar duplicados: viene del data-email-table o usamos #perfilesTable por defecto
      var tableSel = form.getAttribute('data-email-table') || '#perfilesTable';
      var table    = document.querySelector(tableSel);
      if (!table) return;

      var tbody = table.tBodies && table.tBodies[0] ? table.tBodies[0] : table.querySelector('tbody');
      if (!tbody) return;

      var rows = tbody.querySelectorAll('tr');
      if (!rows || !rows.length) return;

      // ID actual (para no contarse a sí mismo cuando se edita)
      var idInput  = form.querySelector('input[name="id"]');
      var currentId = idInput ? String(idInput.value || '').trim() : '';

      var conflict = false;

      rows.forEach(function (tr) {
        if (conflict) return;

        // Solo PADRES (igual que en familiar, usan clase js-parent-row)
        if (!tr.classList.contains('js-parent-row')) return;

        var cell = tr.querySelector('td.correo-cell');
        if (!cell) return;

        var rowCorreo = String(cell.textContent || '').trim().toLowerCase();
        if (!rowCorreo || rowCorreo !== correo) return;

        var rowId = String(tr.getAttribute('data-id') || '').trim();
        if (currentId && rowId && rowId === currentId) return; // misma fila en edición

        conflict = true;
      });

      if (conflict) {
        // 4) BLOQUEAMOS el envío al backend y mostramos SweetAlert
        ev.preventDefault();

        if (window.Swal) {
          Swal.fire({
            icon: 'error',
            title: 'Correo duplicado',
            html:
              'Ya existe un <b>perfil padre</b> con ese correo en este streaming.<br><br>' +
              'Edita el registro existente o agrega hijos desde la pestaña <b>Familiar</b>.',
            confirmButtonText: 'Entendido'
          });
        } else {
          alert(
            'Ya existe un perfil padre con ese correo en este streaming.\n\n' +
            'Edita el registro existente o agrega hijos desde la pestaña Familiar.'
          );
        }

        return; // no seguimos
      }

      // 5) Si NO hubo conflicto → opcional: anti doble click
      var btn = form.querySelector('button[type="submit"], input[type="submit"]');
      if (btn) {
        btn.disabled = true;
        setTimeout(function () {
          btn.disabled = false;
        }, 4000);
      }
      // NO usamos preventDefault aquí → se envía normal al backend
    }, true); // true = captura, se ejecuta antes que otros listeners
  })();
</script>








<script>
  // ——— Validación de correo duplicado SOLO para PADRES en Streaming familiar
  document.addEventListener('submit', function (ev) {
    var form  = ev.target;
    var modal = document.getElementById('perfilFamiliarModal');
    if (!form || !modal || !modal.contains(form)) return; // sólo forms del modal familiar

    // 🧩 1) Detectar si es formulario de HIJO
    //    - HIJOS tienen input[name="action_child"]
    //    - Opcionalmente podrías usar data-_mode="child" en el modal si lo tienes
    var isChild =
      form.querySelector('input[name="action_child"]') ||
      (modal.dataset && modal.dataset._mode === 'child') ||
      (form.dataset && form.dataset.mode === 'child');

    if (isChild) {
      // 👉 Es HIJO → NO validamos duplicado aquí, dejamos que siga normal
      return;
    }

    // 🧩 2) Solo validamos si hay correo
    var emailInput = form.querySelector(
      'input[name="correo"], input[name="email"], input[type="email"]'
    );
    var correo = emailInput ? String(emailInput.value || '').trim().toLowerCase() : '';
    if (!correo) return;

    // ID actual (para edición, para no compararse consigo mismo)
    var idInput   = form.querySelector('input[name="id"]');
    var currentId = idInput ? String(idInput.value || '').trim() : '';

    // 🧩 3) Buscar SOLO PADRES en la tabla #perfilesFamiliarTable
    var table = document.getElementById('perfilesFamiliarTable');
    if (!table) return;

    var rows = table.querySelectorAll('tbody tr');
    var conflict = false;

    rows.forEach(function (tr) {
      // Saltar separadores
      if (tr.getAttribute('data-sep') === '1') return;

      // 🔴 IMPORTANTE: solo PADRES (tienen clase js-parent-row)
      if (!tr.classList.contains('js-parent-row')) return;

      // correo está en <td class="correo-cell…">
      var cell = tr.querySelector('td.correo-cell');
      if (!cell) return;

      var rowCorreo = String(cell.textContent || '').trim().toLowerCase();
      if (!rowCorreo || rowCorreo !== correo) return;

      // si estoy editando y es la misma fila, no cuenta
      var rowId = String(tr.getAttribute('data-id') || '').trim();
      if (currentId && rowId && rowId === currentId) return;

      conflict = true;
    });

    if (conflict) {
      // 🛑 Bloqueamos el envío al backend SOLO para PADRES
      ev.preventDefault();

      if (window.Swal) {
        Swal.fire({
          icon: 'error',
          title: 'Correo duplicado',
          html:
            'El correo "<b>' + correo +
            '</b>" ya existe en la pestaña <b>Streaming familiar</b> (como padre).' +
            '<br><br>No se puede repetir el mismo correo en otro registro PADRE. ' +
            'Edita el registro existente o usa otro correo.',
          confirmButtonText: 'Entendido'
        });
      } else {
        alert(
          'El correo "' + correo +
          '" ya existe en Streaming familiar como padre.\n\n' +
          'No se puede repetir el mismo correo en otro registro PADRE.\n' +
          'Edita el registro existente o usa otro correo.'
        );
      }

      return; // no seguimos
    }

    // 🧩 4) Si NO hubo conflicto (padre nuevo/edición válida) → anti doble click
    var btn = form.querySelector('button[type="submit"], input[type="submit"]');
    if (btn) {
      btn.disabled = true;
      setTimeout(function () {
        btn.disabled = false;
      }, 4000);
    }
    // OJO: NO usamos preventDefault aquí → se envía normal al backend
  }, true);
</script>




<!-- /public/streaming.php — BLOQUE PARA PERMITIR CORREOS REPETIDOS EN HIJOS -->
<script>
(function () {
  'use strict';

  // Evita que los validadores de "correo duplicado" actúen sobre formularios de HIJO
  document.addEventListener('submit', function (ev) {
    var form = ev.target;
    if (!(form instanceof HTMLFormElement)) return;

    var perfilModal = document.getElementById('perfilModal');           // pestaña Perfiles
    var famModal    = document.getElementById('perfilFamiliarModal');   // pestaña Streaming familiar

    var inPerfil = perfilModal && perfilModal.contains(form);
    var inFam    = famModal    && famModal.contains(form);

    // Si el submit no viene de ninguno de esos modales, no tocamos nada
    if (!inPerfil && !inFam) return;

    // Detectamos modo HIJO:
    // - En perfilModal se marca con dataset.context = 'child'
    // - En perfilFamiliarModal usamos dataset.mode = 'child'
    var isChildPerfil = inPerfil && perfilModal.dataset && perfilModal.dataset.context === 'child';
    var isChildFam    = inFam    && famModal    .dataset && famModal    .dataset.mode    === 'child';

    if (!isChildPerfil && !isChildFam) {
      // Es un padre o un familiar "normal" → dejamos que los validadores actúen
      return;
    }

    // A partir de aquí sabemos que es un formulario de HIJO:
    // Queremos que el form se envíe normal, pero SIN que otros listeners de submit se ejecuten.
    if (typeof ev.stopImmediatePropagation === 'function') {
      ev.stopImmediatePropagation();
    } else if (typeof ev.stopPropagation === 'function') {
      ev.stopPropagation();
    }
    // NO usamos preventDefault: dejamos que el submit vaya al backend (PHP/AJAX) como siempre.
  }, true); // true = fase de CAPTURA, se ejecuta antes que el resto de listeners
})();
</script>



<!-- /public/streaming.php — BLOQUE DURO PARA EVITAR QUE LA CELDA PLAN ABRA "AGREGAR FAMILIAR" -->
<script>
;(function(){
  'use strict';

  var famPane  = document.getElementById('perfiles-familiar');
  var bigModal = document.getElementById('perfilFamiliarModal');

  if (!famPane || !bigModal || !window.bootstrap) return;

  // Flag global simple para saber si el último click fue en la celda plan
  window.__famLastClickFromPlanCell = false;

  // Capturamos clicks en Streaming familiar y marcamos si vienen de la celda plan
  document.addEventListener('click', function(ev){
    if (!famPane.contains(ev.target)) return;
    var td = ev.target.closest && ev.target.closest('td');
    if (!td) return;
    var isPlan = td.closest && td.closest('.plan-cell-familiar');
    if (isPlan) {
      window.__famLastClickFromPlanCell = true;
      // En menos de 1 segundo ya no consideramos que fue por plan
      setTimeout(function(){ window.__famLastClickFromPlanCell = false; }, 1000);
    }
  }, true); // captura para ir lo más temprano posible

  // Si, a pesar de todo, el modal GRANDE se muestra por un click en plan, lo cerramos
  bigModal.addEventListener('shown.bs.modal', function(ev){
    if (window.__famLastClickFromPlanCell) {
      try {
        var inst = bootstrap.Modal.getInstance(bigModal);
        if (inst) inst.hide();
      } catch (_){}
    }
  });
})();
</script>



<script>
;(function () {
  'use strict';
  if (window.__famPlanMiniModalV4__) return;
  window.__famPlanMiniModalV4__ = true;

  const SMALL_MODAL_ID = 'modalCambiarPlanFamiliar';

  // 1) Antes del click: en mousedown quitamos data-bs-* al TR para que Bootstrap NO dispare el modal grande
  document.addEventListener('mousedown', function (e) {
    const cell = e.target.closest('.plan-cell-familiar[data-no-row-modal="1"]');
    if (!cell) return;

    const row = cell.closest('tr.js-parent-row[data-entidad="familiar"]');
    if (!row) return;

    // Guardar y quitar atributos de Bootstrap
    if (!row.dataset._bsToggleBackup && row.hasAttribute('data-bs-toggle')) {
      row.dataset._bsToggleBackup = row.getAttribute('data-bs-toggle');
      row.removeAttribute('data-bs-toggle');
    }
    if (!row.dataset._bsTargetBackup && row.hasAttribute('data-bs-target')) {
      row.dataset._bsTargetBackup = row.getAttribute('data-bs-target');
      row.removeAttribute('data-bs-target');
    }

    row.dataset._restoreBsAfterClick = '1';
  }, true);

  // 2) En el click: abrir el modal chico y luego restaurar los data-bs-* después del ciclo de eventos
  document.addEventListener('click', function (e) {
    const cell = e.target.closest('.plan-cell-familiar[data-no-row-modal="1"]');
    if (!cell) return;

    // Bloquear por completo que el click llegue a otros listeners (incluyendo Bootstrap)
    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === 'function') {
      e.stopImmediatePropagation();
    }

    const row   = cell.closest('tr.js-parent-row[data-entidad="familiar"]');
    const id    = cell.getAttribute('data-id')   || (row ? row.getAttribute('data-id') : '') || '';
    const plan  = (cell.getAttribute('data-plan') || (row ? row.getAttribute('data-plan') : '') || '').toLowerCase();
    const color = row ? (row.getAttribute('data-color') || '') : '';

    const modalEl = document.getElementById(SMALL_MODAL_ID);
    if (!modalEl) {
      console.warn('No se encontró el modal chico de familiar #' + SMALL_MODAL_ID);
      return;
    }

    // Rellenar campos del modal chico
    const planIdInput   = modalEl.querySelector('#famPlanId');
    const planSelect    = modalEl.querySelector('#famPlanSelect');
    const colorSelect   = modalEl.querySelector('#famColorSelect');
    const enviarSelect  = modalEl.querySelector('#famEnviarASelect');

    if (planIdInput) {
      planIdInput.value = id;
    }

    if (planSelect) {
      const opts = Array.from(planSelect.options);
      const match = opts.find(o => (o.value || '').toLowerCase() === plan);
      planSelect.value = match ? match.value : plan || 'individual';
    }

    if (colorSelect) {
      const c = (color || '').toLowerCase();
      const opts = Array.from(colorSelect.options);
      const match = opts.find(o => (o.value || '').toLowerCase() === c);
      colorSelect.value = match ? match.value : '';
    }

    if (enviarSelect) {
      // Por defecto mantener en perfiles
      enviarSelect.value = 'none';
    }

    // Abrir modal chico
    const modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
    modalInstance.show();

    // Restaurar los data-bs-* del TR DESPUÉS de que Bootstrap haya procesado el click
    if (row && row.dataset._restoreBsAfterClick === '1') {
      const rowToRestore = row;
      setTimeout(function () {
        if (rowToRestore.dataset._bsToggleBackup) {
          rowToRestore.setAttribute('data-bs-toggle', rowToRestore.dataset._bsToggleBackup);
          delete rowToRestore.dataset._bsToggleBackup;
        }
        if (rowToRestore.dataset._bsTargetBackup) {
          rowToRestore.setAttribute('data-bs-target', rowToRestore.dataset._bsTargetBackup);
          delete rowToRestore.dataset._bsTargetBackup;
        }
        delete rowToRestore.dataset._restoreBsAfterClick;
      }, 50); // pequeño delay para asegurarnos que el click ya se procesó
    }
  }, true);
})();
</script>

<script>
    ;(function () { 'use strict';
  if (window.__famDeleteFixV1) return;
  window.__famDeleteFixV1 = true;

  document.addEventListener('click', async function (ev) {
    const btn = ev.target.closest('.btnDeleteFamiliar');
    if (!btn) return;

    // 👇 Esto es clave para que NO se dispare el click de la fila
    ev.preventDefault();
    ev.stopPropagation();
    if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

    const id = btn.getAttribute('data-id') || btn.dataset.id;
    if (!id) return;

    if (!window.Swal) {
      if (!confirm('¿Seguro que deseas borrar este registro familiar?')) return;
    } else {
      const result = await Swal.fire({
        icon: 'warning',
        title: '¿Borrar familiar?',
        text: 'Esta acción no se puede deshacer.',
        showCancelButton: true,
        confirmButtonText: 'Sí, borrar',
        cancelButtonText: 'Cancelar'
      });
      if (!result.isConfirmed) return;
    }

    // Evitar doble click
    if (btn.disabled) return;
    btn.disabled = true;
    const oldHtml = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

    try {
      const endpoint = new URL(
        'ajax/perfiles_familiar_delete.php',
        document.baseURI
      ).toString();

      const body = new URLSearchParams();
      body.set('id', id);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
        },
        credentials: 'same-origin',
        redirect: 'follow',
        body
      });

      const ct = res.headers.get('content-type') || '';
      let data = null;
      if (ct.includes('application/json')) {
        try { data = await res.json(); } catch (_) {}
      }

      if (!res.ok || !data || !data.ok) {
        throw new Error((data && data.error) || 'Error al borrar (' + res.status + ')');
      }

      // Quitar la fila de la tabla
      const row = btn.closest('tr');
      if (row && row.parentNode) {
        row.parentNode.removeChild(row);
      }

      if (window.Swal) {
        Swal.fire({
          icon: 'success',
          title: 'Eliminado',
          timer: 1200,
          showConfirmButton: false
        });
      }
    } catch (err) {
      console.error('[Familiar] borrar:', err);
      if (window.Swal) {
        Swal.fire({
          icon: 'error',
          title: 'No se pudo borrar',
          text: err.message || 'Intenta de nuevo'
        });
      }
    } finally {
      btn.disabled = false;
      btn.innerHTML = oldHtml;
    }
  }, true); // captura para ganarle a otros listeners

})();

</script>

<?php if (!empty($_GET['err']) && $_GET['err'] === 'correo_padre_duplicado'): ?>
<script>
document.addEventListener('DOMContentLoaded', function() {
  if (window.Swal) {
    Swal.fire({
      icon: 'error',
      title: 'Correo duplicado',
      html: 'Ya existe un <b>perfil padre</b> con ese correo en este streaming.<br><br>' +
            'Edita el registro existente o agrega hijos desde la pestaña <b>Familiar</b>.',
      confirmButtonText: 'Entendido'
    });
  } else {
    alert(
      'Ya existe un perfil padre con ese correo en este streaming.\n\n' +
      'Edita el registro existente o agrega hijos desde la pestaña Familiar.'
    );
  }
});
</script>
<?php endif; ?>
<?php if (!empty($_GET['err']) && $_GET['err'] === 'correo_padre_duplicado'): ?>
<script>
document.addEventListener('DOMContentLoaded', function() {
  if (window.Swal) {
    Swal.fire({
      icon: 'error',
      title: 'Correo duplicado',
      html: 'Ya existe un <b>perfil padre</b> con ese correo en este streaming.<br><br>' +
            'Edita el registro existente o agrega hijos desde la pestaña <b>Familiar</b>.',
      confirmButtonText: 'Entendido'
    });
  } else {
    alert(
      'Ya existe un perfil padre con ese correo en este streaming.\n\n' +
      'Edita el registro existente o agrega hijos desde la pestaña Familiar.'
    );
  }
});
</script>
<?php endif; ?>




<script>
;(function () {
  'use strict';

  function initStockSearch() {
    // Evitar doble inicialización
    if (window.__stockSearchInit) return;
    window.__stockSearchInit = true;

    // Wrapper de filtros de STOCK
    var wrapper = document.querySelector('.__spFilter__[data-scope="stock"]');
    if (!wrapper) return;

    var input    = wrapper.querySelector('.sp-search');
    var clearBtn = wrapper.querySelector('.sp-clear');
    var table    = document.getElementById('stockTable');

    if (!input || !table) return;

    var tbody = table.tBodies && table.tBodies[0]
      ? table.tBodies[0]
      : table.querySelector('tbody');

    if (!tbody) return;

    var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr'));

    function normalizar(str) {
      // por si acaso hay mayúsculas, espacios, etc.
      return String(str || '')
        .toLowerCase()
        .normalize('NFD')        // separa acentos
        .replace(/[\u0300-\u036f]/g, ''); // quita acentos
    }

    function applyFilter() {
      var q = normalizar(input.value);
      var hasQuery = q.length > 0;

      rows.forEach(function (tr) {
        // Separadores de fecha
        if (tr.getAttribute('data-sep') === '1') {
          tr.style.display = hasQuery ? 'none' : '';
          return;
        }

        if (!hasQuery) {
          tr.style.display = '';
          return;
        }

        // Usamos SOLO el atributo data-correo
        var correoAttr = tr.getAttribute('data-correo') || '';
        var correoNorm = normalizar(correoAttr);

        tr.style.display = correoNorm.indexOf(q) !== -1 ? '' : 'none';
      });
    }

    // Filtrar mientras se escribe
    input.addEventListener('input', applyFilter);

    // Botón "Limpiar"
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        input.value = '';
        applyFilter();
      });
    }

    // Estado inicial
    applyFilter();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStockSearch);
  } else {
    initStockSearch();
  }
})();
</script>






<?php
// Modales y footer
include __DIR__ . '/../includes/modals.php';
include __DIR__ . '/../includes/footer.php';
