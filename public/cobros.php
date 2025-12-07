<?php
declare(strict_types=1);
require_once __DIR__.'/../includes/header.php';

/* ===== Conexión tolerante ===== */
$base = realpath(__DIR__.'/..');
foreach ([
  $base.'/config/config.php',
  $base.'/config/db.php',
  dirname($base).'/config/config.php',
  dirname($base).'/config/db.php'
] as $f) { if ($f && is_file($f)) require_once $f; }

$pdo = (isset($pdo) && $pdo instanceof PDO) ? $pdo : ((isset($dbh) && $dbh instanceof PDO) ? $dbh : null);
if (!$pdo && function_exists('getPDO')) $pdo = getPDO();
if (!$pdo && defined('DB_HOST') && defined('DB_NAME') && defined('DB_USER')) {
  try {
    $pdo = new PDO(
      'mysql:host='.DB_HOST.';dbname='.DB_NAME.';charset=utf8mb4',
      DB_USER,
      (defined('DB_PASS') ? DB_PASS : (defined('DB_PASSWORD') ? DB_PASSWORD : '')),
      [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
      ]
    );
  } catch (Throwable $e) {}
}

/* ===== Util ===== */
function q($s){ return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }

/* Formato número */
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

/* Normalización de teléfono y helpers */
function normPhone(?string $v): string {
  $v = trim((string)$v);
  $v = preg_replace('/\s+/', '', $v);
  $v = preg_replace('/(?!^)\+/', '', $v);
  $v = preg_replace('/[^\d\+]/', '', $v);
  if ($v === '+') $v = '';
  return $v;
}
function digits(string $s): string { return preg_replace('/\D+/', '', $s); }
function ymd(?string $d): ?string {
  $d = trim((string)$d);
  if ($d === '' || $d === '0000-00-00') return null;
  $ts = strtotime($d);
  return $ts ? date('Y-m-d', $ts) : null;
}
function safe_float($v): float {
  if ($v === null || $v === '') return 0.0;
  return (float)$v;
}

/* ====== Normalización de Planes (compat PHP 7) ====== */
function contains($haystack, $needle) {
  return strpos($haystack, $needle) !== false;
}
function plan_rank(string $p): int {
  $s = strtolower(trim($p));
  if ($s === 'premium') return 3;
  if ($s === 'estándar' || $s === 'estandar' || $s === 'standard') return 2;
  if ($s === 'individual' || $s === 'básico' || $s === 'basico') return 1;
  return 0;
}
/* Normaliza el plan según la FUENTE de datos */
function norm_plan_from_source(?string $v, string $src): string {
  $s = strtolower(trim((string)$v));

  // En CUENTAS: solo forzar a premium si está vacío o dice "cuenta completa".
  if ($src === 'cuentas') {
    if ($s === '' || (strpos($s,'cuenta') !== false && strpos($s,'completa') !== false)) {
      return 'premium';
    }
    // Si viene "individual" o "básico", se respeta tal cual.
  }

  if ($s === '') return 'individual';
  if (strpos($s,'premium') !== false) return 'premium';
  if (strpos($s,'stand') !== false || strpos($s,'estándar') !== false || strpos($s,'estandar') !== false) return 'standard';
  if (strpos($s,'indiv') !== false || strpos($s,'básico') !== false || strpos($s,'basico') !== false)   return 'individual';

  // Si pone algo raro, lo dejamos como llega.
  return $s;
}

/* Clave de contacto SOLO por teléfono */
function wa_digits(?string $v): string {
  $v = (string)$v;
  $v = preg_replace('/\s+/', '', $v);
  $v = preg_replace('/(?!^)\+/', '', $v);
  $v = preg_replace('/[^\d\+]/', '', $v);
  $v = ltrim($v, '+');
  return preg_replace('/\D+/', '', $v);
}
function contact_key_phone_only(?string $wa): string {
  return wa_digits($wa);
}

/* Detección país por prefijo (para sugerir método de pago) */
function msisdn_detect_cc_iso2(string $raw): array {
  $d = preg_replace('/\s+/', '', (string)$raw);
  $d = preg_replace('/(?!^)\+/', '', $d);
  $d = preg_replace('/[^\d\+]/', '', $d);
  $d = ltrim($d, '+');
  if ($d === '') return ['', ''];
  $prefixMap = [
    // LatAm
    '598'=>'UY','597'=>'SR','596'=>'MQ','595'=>'PY','594'=>'GF','593'=>'EC','592'=>'GY','591'=>'BO','590'=>'BL',
    '509'=>'HT','507'=>'PA','506'=>'CR','505'=>'NI','504'=>'HN','503'=>'SV','502'=>'GT',
    '58'=>'VE','57'=>'CO','56'=>'CL','55'=>'BR','54'=>'AR','53'=>'CU','52'=>'MX','51'=>'PE',
    // Europa (comunes)
    '34'=>'ES','351'=>'PT','39'=>'IT','33'=>'FR','49'=>'DE','44'=>'GB',
    // otros
    '81'=>'JP','82'=>'KR','86'=>'CN','61'=>'AU','64'=>'NZ',
    '1'=>'US','7'=>'RU'
  ];
  $cands = array_map('strval', array_keys($prefixMap));
  usort($cands, function($a,$b){ return strlen($b) - strlen($a); });
  foreach ($cands as $cc) {
    if (strncmp($d, $cc, strlen($cc)) === 0) return [$cc, $prefixMap[$cc]];
  }
  return ['', ''];
}
function is_latam(string $iso2): bool {
  static $LATAM = ['AR','BO','BR','CL','CO','CR','CU','DO','EC','SV','GT','HT','HN','MX','NI','PA','PY','PE','PR','UY','VE'];
  return in_array(strtoupper($iso2), $LATAM, true);
}
function is_europe(string $iso2): bool {
  static $EU = ['ES','PT','IT','FR','DE','GB','NL','BE','IE','SE','DK','NO','FI','CH','AT','PL','CZ','HU','RO','BG','GR','SK','SI','HR','LT','LV','EE','LU','MT','CY','IS','LI'];
  return in_array(strtoupper($iso2), $EU, true);
}

/* === Nombres de servicios (streamings) === */
$streamingNames = []; // id => nombre
try {
  $st = $pdo->query('SELECT id, nombre FROM streamings ORDER BY id');
  foreach ($st->fetchAll() as $r) {
    $streamingNames[(int)$r['id']] = (string)$r['nombre'];
  }
} catch(Throwable $e){}

/* Set de columnas de servicios (todas las de streamings + IPTV al final) */
$colSet = [];
foreach ($streamingNames as $n) {
  if ($n !== '') $colSet[$n] = true;
}
$IPTV_COL = 'IPTV';
$colSet[$IPTV_COL] = true;

/* === Eventos (una fila = contacto + fecha) === */
$events = [];           // key: "<contact>|<Y-m-d>"
$today  = date('Y-m-d');

function add_event(array &$events, string $contactKey, array $payload): void {
  $fin = $payload['fin'] ?? null;
  if (!$fin) return;
  $k = $contactKey.'|'.$fin;

  if (!isset($events[$k])) {
    $events[$k] = [
      'contact'  => $contactKey,
      'correo'   => $payload['correo'] ?? '',
      'whatsapp' => $payload['whatsapp'] ?? '',
      'fin'      => $fin,
      'services' => [],
    ];
  } else {
    if ($events[$k]['correo']===''   && !empty($payload['correo']))   $events[$k]['correo']   = $payload['correo'];
    if ($events[$k]['whatsapp']==='' && !empty($payload['whatsapp'])) $events[$k]['whatsapp'] = $payload['whatsapp'];
  }

  $name  = (string)($payload['service'] ?? '');
  if ($name === '') return;

  $plan  = (string)($payload['plan'] ?? '');
  $monto = (float)($payload['monto'] ?? 0);

  if (!isset($events[$k]['services'][$name])) {
    $events[$k]['services'][$name] = ['plan'=>$plan,'monto'=>$monto];
  } else {
    $events[$k]['services'][$name]['monto'] += $monto;
    $old = (string)($events[$k]['services'][$name]['plan'] ?? '');
    if ($old === '' || plan_rank($plan) > plan_rank($old)) {
      $events[$k]['services'][$name]['plan'] = $plan;
    }
  }
}

/* ===== CARGA DE DATOS ===== */

/* === PERFILES === */
try {
  $sql = "SELECT correo, whatsapp, fecha_fin, soles, plan, streaming_id
          FROM perfiles
          WHERE fecha_fin IS NOT NULL AND fecha_fin <> '0000-00-00'";
  foreach ($pdo->query($sql) as $r) {
    $correo = trim((string)($r['correo'] ?? ''));
    $waRaw  = (string)($r['whatsapp'] ?? '');
    $fin    = ymd($r['fecha_fin'] ?? '');
    if (!$fin) continue;

    $waKey = contact_key_phone_only($waRaw);
    if ($waKey === '') continue;

    $sid = (int)($r['streaming_id'] ?? 0);
    $srv = $streamingNames[$sid] ?? (($sid>0)?('Srv #'.$sid):'');
    if ($srv === '') continue;
    $colSet[$srv] = true;

    add_event($events, $waKey, [
      'correo'   => $correo,
      'whatsapp' => $waRaw,
      'fin'      => $fin,
      'service'  => $srv,
      'plan'     => norm_plan_from_source($r['plan'] ?? '', 'perfiles'),
      'monto'    => (float)($r['soles'] ?? 0),
    ]);
  }
} catch (Throwable $e) {}

/* === CUENTAS === */
try {
  $sql = "SELECT correo, whatsapp, fecha_fin, soles, plan, streaming_id
          FROM cuentas
          WHERE fecha_fin IS NOT NULL AND fecha_fin <> '0000-00-00'";
  foreach ($pdo->query($sql) as $r) {
    $correo = trim((string)($r['correo'] ?? ''));
    $waRaw  = (string)($r['whatsapp'] ?? '');
    $fin    = ymd($r['fecha_fin'] ?? '');
    if (!$fin) continue;

    $waKey = contact_key_phone_only($waRaw);
    if ($waKey === '') continue;

    $sid = (int)($r['streaming_id'] ?? 0);
    $srv = $streamingNames[$sid] ?? (($sid>0)?('Srv #'.$sid):'');
    if ($srv === '') continue;
    $colSet[$srv] = true;

    add_event($events, $waKey, [
      'correo'   => $correo,
      'whatsapp' => $waRaw,
      'fin'      => $fin,
      'service'  => $srv,
      'plan'     => norm_plan_from_source($r['plan'] ?? '', 'cuentas'), // cuenta completa => premium
      'monto'    => (float)($r['soles'] ?? 0),
    ]);
  }
} catch (Throwable $e) {}

/* === STREAMING FAMILIAR (perfiles_familiar) === */
try {
    $sql = "SELECT correo, whatsapp, fecha_fin, soles, plan, streaming_id
            FROM perfiles_familiar
            WHERE fecha_fin IS NOT NULL
              AND fecha_fin <> '0000-00-00'";
    foreach ($pdo->query($sql) as $r) {
        $correo = trim((string)($r['correo'] ?? ''));
        $waRaw  = (string)($r['whatsapp'] ?? '');
        $fin    = ymd($r['fecha_fin'] ?? '');
        if (!$fin) continue;

        // Clave principal: teléfono
        $waKey = contact_key_phone_only($waRaw);

        // Fallback: si no hay teléfono válido, usamos el correo
        if ($waKey === '') {
            if ($correo === '') continue; // sin nada para agrupar -> descartamos
            $waKey = 'mail:' . strtolower($correo);
        }

        $sid = (int)($r['streaming_id'] ?? 0);
        $srv = $streamingNames[$sid] ?? (($sid > 0) ? ('Srv #' . $sid) : '');
        if ($srv === '') continue;
        $colSet[$srv] = true;

        add_event($events, $waKey, [
            'tipo'     => 'familiar',
            'correo'   => $correo,
            'whatsapp' => $waRaw,
            'fin'      => $fin,
            'service'  => $srv,
            'plan'     => norm_plan_from_source($r['plan'] ?? '', 'perfiles'),
            'monto'    => (float)($r['soles'] ?? 0),
        ]);
    }
} catch (Throwable $e) {}


/* === IPTV PERFILES (teléfono en whatsapp o cliente/clientes) === */
try {
  $sql = "SELECT * FROM iptv_perfiles
          WHERE fecha_fin IS NOT NULL AND fecha_fin <> '0000-00-00'";
  foreach ($pdo->query($sql) as $r) {
    $correo = trim((string)($r['usuario'] ?? ''));
    $waRaw  = (string)($r['whatsapp'] ?? ($r['cliente'] ?? ($r['clientes'] ?? '')));
    $fin    = ymd($r['fecha_fin'] ?? '');
    if (!$fin) continue;

    $waKey = contact_key_phone_only($waRaw);
    if ($waKey === '') continue;

    add_event($events, $waKey, [
      'correo'   => $correo,
      'whatsapp' => $waRaw,
      'fin'      => $fin,
      'service'  => $IPTV_COL,
      'plan'     => (string)($r['nombre'] ?? ''),
      'monto'    => safe_float($r['soles'] ?? 0),
    ]);
  }
} catch(Throwable $e) {}

/* === IPTV CUENTAS (mismo criterio) === */
try {
  $sql = "SELECT * FROM iptv_cuentas
          WHERE fecha_fin IS NOT NULL AND fecha_fin <> '0000-00-00'";
  foreach ($pdo->query($sql) as $r) {
    $correo = trim((string)($r['usuario'] ?? ''));
    $waRaw  = (string)($r['whatsapp'] ?? ($r['cliente'] ?? ($r['clientes'] ?? '')));
    $fin    = ymd($r['fecha_fin'] ?? '');
    if (!$fin) continue;

    $waKey = contact_key_phone_only($waRaw);
    if ($waKey === '') continue;

    add_event($events, $waKey, [
      'correo'   => $correo,
      'whatsapp' => $waRaw,
      'fin'      => $fin,
      'service'  => $IPTV_COL,
      'plan'     => (string)($r['nombre'] ?? ''),
      'monto'    => safe_float($r['soles'] ?? 0),
    ]);
  }
} catch(Throwable $e) {}

/* === Preparar columnas finales (streamings + IPTV al final) === */
$serviciosCols = array_keys($colSet);
usort($serviciosCols, function($a,$b){
  if ($a==='IPTV' && $b!=='IPTV') return 1;
  if ($b==='IPTV' && $a!=='IPTV') return -1;
  return strcasecmp($a,$b);
});

/* === Expandir eventos y ordenar por fecha asc === */
$rows = array_values($events);
usort($rows, function($a,$b){
  $fa = $a['fin']; $fb = $b['fin'];
  if ($fa === $fb) return strcasecmp((string)$a['contact'], (string)$b['contact']);
  return strtotime($fa) <=> strtotime($fb);
});

/* Formato “26 octubre” */
$MES = ['', 'enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
function pretty_date(?string $ymd, array $MES): string {
  if (!$ymd) return '';
  $ts = strtotime($ymd); if (!$ts) return '';
  return date('j', $ts) . ' ' . $MES[(int)date('n',$ts)];
}
?>
<style>
  .tr-hoy    { background-color:#ffe5e5 !important; }
  .tr-manana { background-color:#ffeacc !important; }
  .tr-pasado { background-color:#fff7cc !important; }
  .tr-otros  { background-color:#f8f9fa !important; }
</style>

<div class="container py-3">
  <div class="d-flex justify-content-between align-items-center mb-2">
    <h5 class="mb-0">Cobros</h5>
    <div class="d-flex gap-2">
      <a href="dashboard.php" class="btn btn-sm btn-outline-secondary">Dashboard</a>
      <a href="streaming.php" class="btn btn-sm btn-primary">Streaming</a>
      <a href="iptv_servicios.php" class="btn btn-sm btn-outline-primary">IPTV</a>

      <!-- Exportar lo que se ve en la tabla (thead + tbody) -->
      <button type="button"
              class="btn btn-sm btn-outline-success"
              id="btnExportCobrosDom">
        Exportar Excel (vista)
      </button>
    </div>
  </div>

  <div class="d-flex align-items-center gap-2 mb-2">
    <div class="btn-group btn-group-sm" role="group" aria-label="Filtro por vencimiento">
      <button type="button" class="btn btn-outline-secondary active" data-filter="all">Todos</button>
      <button type="button" class="btn btn-outline-secondary" data-filter=".tr-hoy">Hoy / vencidos</button>
      <button type="button" class="btn btn-outline-secondary" data-filter=".tr-manana">Mañana</button>
      <button type="button" class="btn btn-outline-secondary" data-filter=".tr-pasado">Pasado mañana</button>
      <button type="button" class="btn btn-outline-secondary" data-filter="otros">Otros</button>
    </div>
    <small class="text-muted ms-2">(filtra por color/fecha)</small>
  </div>

  <div class="table-responsive">
    <table id="tablaCobros"
           class="table table-bordered align-middle"
           style="--bs-border-color:#000;"
           data-no-row-modal="1">
      <thead>
        <tr>
            <th style="width:90px">Eliminar</th>
          <th style="width:90px">Fin</th>
          <th style="width:220px">Contacto</th>
          <th style="width:110px">WhatsApp</th>
          <th style="width:90px"  class="text-end">Pago</th>
<?php foreach ($serviciosCols as $svc): ?>
          <th class="text-center"><?= q($svc) ?></th>
<?php endforeach; ?>
        </tr>
      </thead>
      <tbody>
<?php
$granAcum = 0.0;
$todayTs  = strtotime($today);
$hiddenHashes = [];
try {
  $pdoHidden = $pdo instanceof PDO ? $pdo : (function_exists('getPDO') ? getPDO() : null);
  if ($pdoHidden instanceof PDO) {
    $stmtHidden = $pdoHidden->query("SELECT hash FROM cobros_ocultos");
    if ($stmtHidden) {
      $hiddenHashes = $stmtHidden->fetchAll(PDO::FETCH_COLUMN);
    }
  }
} catch (Throwable $e) {
  $hiddenHashes = [];
}

$hiddenMap = $hiddenHashes ? array_flip($hiddenHashes) : [];

if (!empty($hiddenMap) && is_array($rows)) {
  $rows = array_values(array_filter($rows, function($ev) use ($hiddenMap) {
    $raw  = json_encode($ev, JSON_UNESCAPED_UNICODE);
    $hash = hash('sha256', $raw);
    return !isset($hiddenMap[$hash]);
  }));
}



foreach ($rows as $ev):
  $rawEv  = json_encode($ev, JSON_UNESCAPED_UNICODE);
  $hashEv = hash('sha256', $rawEv);
  $fin    = $ev['fin'];
  $finTxt = pretty_date($fin, $MES);

  $diasFila = (int) floor((strtotime($fin) - $todayTs) / 86400);

  // CLASE por vencimiento
  if     ($diasFila <= 0)  $rowClass = 'tr-hoy';
  elseif ($diasFila === 1) $rowClass = 'tr-manana';
  elseif ($diasFila === 2) $rowClass = 'tr-pasado';
  else                     $rowClass = 'tr-otros';

  $wa_raw    = normPhone($ev['whatsapp']);
  $wa_for_wa = ltrim($wa_raw, '+');

  // Contacto visible
  $numero_display = '';
  if ($wa_raw !== '') {
    $numero_display = format_cliente_num($wa_raw, digits($wa_raw));
  } else {
    $numero_display = $ev['correo'] !== '' ? $ev['correo'] : $ev['contact'];
  }
  $tg_phone = $wa_raw ? ($wa_raw[0] === '+' ? $wa_raw : '+'.$wa_raw) : '';

  // Detalle del día y total (servicios)
  $lineas = [];
  $montoFila = 0.0;
  foreach ($ev['services'] as $nomSrv => $sv) {
    $plan  = trim((string)($sv['plan'] ?? ''));
    $monto = safe_float($sv['monto'] ?? 0);
    $label = $nomSrv . ($plan!=='' ? ' ('.$plan.')' : '');
    $lineas[] = $label . ': S/ ' . number_format($monto, 2);
    $montoFila += $monto;
  }
  $detalleServicios = implode("\n", $lineas);

  // Detectar región para método de pago
$metodoPago = 'PayPal'; // fallback genérico

if ($wa_for_wa !== '') {
  list($cc, $iso2) = msisdn_detect_cc_iso2($wa_raw);
  $iso2Upper = strtoupper((string)$iso2);

  if ($iso2Upper === 'PE') {
    // 🇵🇪 Perú: Yape / Plin / Binance
    $metodoPago = 'Yape, Plin o Binance';
  } elseif (is_latam($iso2)) {
    // Resto de Latinoamérica
    $metodoPago = 'Mercado Pago';
  } elseif (is_europe($iso2)) {
    // Europa
    $metodoPago = 'PayPal';
  } else {
    // Otros países
    $metodoPago = 'PayPal';
  }
}


  // Texto de vencimiento
  if     ($diasFila <= 0)  $lineaVence = "Tu cuenta ya venció.";
  elseif ($diasFila === 1) $lineaVence = "Tu cuenta vence el día de mañana.";
  else                     $lineaVence = "Tu cuenta vence el {$finTxt}.";

  // 👇 ESTE ES EL MENSAJE NUEVO QUE QUEREMOS
  $mensaje = $lineaVence . "\n\n"
           . "Detalle de las cuentas:\n"
           . ($detalleServicios !== '' ? $detalleServicios . "\n" : "")
           . "Total a pagar: S/ " . number_format($montoFila, 2) . "\n\n"
           . "Método de pago: {$metodoPago}.";

  // Lo seguimos codificando por si acaso en otros puntos
  $wa_msg = rawurlencode($mensaje);

  $granAcum += $montoFila;
?>

        <tr class="<?= q($rowClass) ?>" data-contacto="<?= q($ev['contact']) ?>" data-cobro-hash="<?= q($hashEv) ?>">
            
            
        <td class="text-center">
  <button
    type="button"
    class="btn btn-sm btnDeleteCobro  js-row-action js-cobro-delete" data-hash="<?= q($hashEv) ?>"
    title="Borrar cobro"
  >
    &times;
  </button>
</td>


          <td class="text-center"><?= q($finTxt) ?></td>

          <!-- CONTACTO visible (teléfono formateado o correo/contacto) -->
          <td class="text-nowrap"><?= q($numero_display) ?></td>

     
<td class="whatsapp text-center">
<?php if ($wa_for_wa): ?>
  <a href="#"
     class="cobro-wa-v2 text-success"
     data-wa="<?= q($wa_for_wa) ?>"
     data-msg="<?= q($mensaje) ?>"
     aria-label="WhatsApp"
     title="WhatsApp"
     data-bs-toggle="tooltip"
     data-bs-placement="top">
    <i class="bi bi-whatsapp fs-5" aria-hidden="true"></i>
  </a>
<?php endif; ?>

<?php if ($tg_phone && $tg_phone !== '+'): ?>
  <a href="#"
     class="ms-2 cobro-tg-v2 text-primary"
     data-phone="<?= q($tg_phone) ?>"
     data-msg="<?= q($mensaje) ?>"
     aria-label="Telegram"
     title="Telegram"
     data-bs-toggle="tooltip"
     data-bs-placement="top">
    <i class="bi bi-telegram fs-5" aria-hidden="true"></i>
  </a>
<?php endif; ?>
</td>







          <!-- TOTAL DEL DÍA PARA EL CONTACTO -->
          <td class="text-end"><?= number_format($montoFila, 2) ?></td>

<?php foreach ($serviciosCols as $svcName):
      $cell = '';
      if (isset($ev['services'][$svcName])) {
        $sv = $ev['services'][$svcName];
        $plan  = trim((string)($sv['plan'] ?? ''));
        $monto = safe_float($sv['monto'] ?? 0);
        $cell  = ($plan!=='' ? ($plan.' — ') : '') . 'S/ ' . number_format($monto, 2);
      }
?>
          <td class="text-nowrap text-center"><?= q($cell) ?></td>
<?php endforeach; ?>
        </tr>
<?php endforeach; ?>
      </tbody>
    </table>

    <div class="mt-2 text-end">
      <strong>Total a cobrar:</strong> S/ <?= number_format($granAcum, 2) ?>
    </div>
  </div>
</div>

<script>
(function () {
  const table = document.getElementById('tablaCobros');
  if (!table) return;

  const buttons = document.querySelectorAll('[data-filter]');
  const rows    = table.querySelectorAll('tbody tr');

  function applyFilter(f) {
    rows.forEach(tr => {
      tr.style.display = '';
      if (f === 'all') return;
      if (f === 'otros') {
        if (tr.classList.contains('tr-hoy') ||
            tr.classList.contains('tr-manana') ||
            tr.classList.contains('tr-pasado')) {
          tr.style.display = 'none';
        }
      } else {
        if (!tr.matches(f)) tr.style.display = 'none';
      }
    });
  }

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyFilter(btn.getAttribute('data-filter'));
    });
  });

  // Blindaje contra handlers globales (no dejamos que reescriban el ?text=)
  document.querySelectorAll('#tablaCobros a.cobro-wa').forEach(a => {
    a.addEventListener('click', function(e){
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
    }, true);
  });

  // Telegram: usamos window.open con el mensaje correcto
  document.querySelectorAll('#tablaCobros a.cobro-tg').forEach(a => {
    a.addEventListener('click', function(e){
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      e.preventDefault();
      const msg = a.getAttribute('data-msg') || '';
      const share = 'https://t.me/share/url?url=&text=' + encodeURIComponent(msg);
      window.open(share, '_blank', 'noopener');
      return false;
    }, true);
  });
})();
</script>

<script>
(function () {
  const btn = document.getElementById('btnExportCobrosDom');
  if (!btn) return;

  btn.addEventListener('click', function () {
    const table = document.querySelector('#tablaCobros');
    if (!table) {
      alert('No se encontró la tabla de cobros (#tablaCobros).');
      return;
    }

    let csv = '\uFEFF'; // BOM UTF-8
    const rows = table.querySelectorAll('tr');

    rows.forEach(function (row) {
      const cells = row.querySelectorAll('th, td');
      if (!cells.length) return;

      const cols = [];
      cells.forEach(function (cell) {
        let text = cell.innerText.replace(/\r?\n|\r/g, ' ').trim();
        text = text.replace(/"/g, '""');
        cols.push('"' + text + '"');
      });

      csv += cols.join(',') + '\r\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');

    const now   = new Date();
    const stamp = now.toISOString().slice(0,19).replace(/[-:T]/g, '');

    a.href = url;
    a.download = 'cobros_vista_' + stamp + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
})();
</script>
<script>
(function () {
  // Tooltips Bootstrap 5
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltipTriggerList.forEach(function (tooltipTriggerEl) {
    new bootstrap.Tooltip(tooltipTriggerEl);
  });

  // Filtros + blindaje WA/TG (ya lo tenías, lo integro con la nueva tabla)
  const table = document.getElementById('tablaCobros');
  if (!table) return;

  const buttons = document.querySelectorAll('[data-filter]');
  const rows    = table.querySelectorAll('tbody tr');

  function applyFilter(f) {
    rows.forEach(tr => {
      tr.style.display = '';
      if (f === 'all') return;
      if (f === 'otros') {
        if (tr.classList.contains('tr-hoy') ||
            tr.classList.contains('tr-manana') ||
            tr.classList.contains('tr-pasado')) {
          tr.style.display = 'none';
        }
      } else {
        if (!tr.matches(f)) tr.style.display = 'none';
      }
    });
  }

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyFilter(btn.getAttribute('data-filter'));
    });
  });

  // Blindaje WA
  document.querySelectorAll('#tablaCobros a.cobro-wa').forEach(a => {
    a.addEventListener('click', function(e){
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
    }, true);
  });

  // Telegram: window.open con el mensaje correcto
  document.querySelectorAll('#tablaCobros a.cobro-tg').forEach(a => {
    a.addEventListener('click', function(e){
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      e.preventDefault();
      const msg = a.getAttribute('data-msg') || '';
      const share = 'https://t.me/share/url?url=&text=' + encodeURIComponent(msg);
      window.open(share, '_blank', 'noopener');
      return false;
    }, true);
  });

})();
</script>
<script>
(function () {
  // Inicializar tooltips de Bootstrap 5
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltipTriggerList.forEach(function (el) {
    new bootstrap.Tooltip(el);
  });

  // 🔹 Lo demás: filtros + WA/TG (puedes dejar tu código existente aquí...)

})();
</script>
<script>
    document.querySelectorAll('#tablaCobros a.cobro-wa').forEach(a => {
  a.addEventListener('click', function(e){
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
  }, true);
});

document.querySelectorAll('#tablaCobros a.cobro-tg').forEach(a => {
  a.addEventListener('click', function(e){
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
    e.preventDefault();
    const msg = a.getAttribute('data-msg') || '';
    const share = 'https://t.me/share/url?url=&text=' + encodeURIComponent(msg);
    window.open(share, '_blank', 'noopener');
    return false;
  }, true);
});

</script>

<script>
(function () {
  // Inicializar tooltips Bootstrap 5
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltipTriggerList.forEach(function (el) {
    new bootstrap.Tooltip(el);
  });

  const table   = document.getElementById('tablaCobros');
  if (!table) return;

  const buttons = document.querySelectorAll('[data-filter]');
  const rows    = table.querySelectorAll('tbody tr');

  function applyFilter(f) {
    rows.forEach(tr => {
      tr.style.display = '';
      if (f === 'all') return;
      if (f === 'otros') {
        if (tr.classList.contains('tr-hoy') ||
            tr.classList.contains('tr-manana') ||
            tr.classList.contains('tr-pasado')) {
          tr.style.display = 'none';
        }
      } else {
        if (!tr.matches(f)) tr.style.display = 'none';
      }
    });
  }

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyFilter(btn.getAttribute('data-filter'));
    });
  });

  // ✅ WHATSAPP: construimos la URL con nuestro mensaje y número
  document.querySelectorAll('#tablaCobros a.cobro-wa').forEach(a => {
    a.addEventListener('click', function(e){
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') {
        e.stopImmediatePropagation();
      }

      const rawPhone = (a.getAttribute('data-wa') || '').trim();
      const phone    = rawPhone.replace(/^\+/, ''); // sin '+'
      const msg      = a.getAttribute('data-msg') || '';

      if (!phone || !msg) return;

      const url = 'https://wa.me/' + encodeURIComponent(phone)
                + '?text=' + encodeURIComponent(msg);

      window.open(url, '_blank', 'noopener');
      return false;
    }, true);
  });

  // ✅ TELEGRAM: mismo mensaje, share por URL
  document.querySelectorAll('#tablaCobros a.cobro-tg').forEach(a => {
    a.addEventListener('click', function(e){
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') {
        e.stopImmediatePropagation();
      }

      const msg = a.getAttribute('data-msg') || '';
      if (!msg) return;

      const share = 'https://t.me/share/url?url=&text=' + encodeURIComponent(msg);
      window.open(share, '_blank', 'noopener');
      return false;
    }, true);
  });
})();
</script>
<script>
(function () {
  // Inicializar tooltips Bootstrap 5
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltipTriggerList.forEach(function (el) {
    new bootstrap.Tooltip(el);
  });

  const table = document.getElementById('tablaCobros');
  if (!table) return;

  const buttons = document.querySelectorAll('[data-filter]');
  const rows    = table.querySelectorAll('tbody tr');

  function applyFilter(f) {
    rows.forEach(tr => {
      tr.style.display = '';
      if (f === 'all') return;
      if (f === 'otros') {
        if (tr.classList.contains('tr-hoy') ||
            tr.classList.contains('tr-manana') ||
            tr.classList.contains('tr-pasado')) {
          tr.style.display = 'none';
        }
      } else {
        if (!tr.matches(f)) tr.style.display = 'none';
      }
    });
  }

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyFilter(btn.getAttribute('data-filter'));
    });
  });

  // 🔧 1) Clonamos los enlaces WA/TG para limpiar cualquier listener viejo
  document.querySelectorAll('#tablaCobros a.cobro-wa, #tablaCobros a.cobro-tg').forEach(el => {
    const clone = el.cloneNode(true);
    el.parentNode.replaceChild(clone, el);
  });

  // 🔹 2) WHATSAPP: construir URL con nuestro data-msg y data-wa
  document.querySelectorAll('#tablaCobros a.cobro-wa').forEach(a => {
    a.addEventListener('click', function(e){
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') {
        e.stopImmediatePropagation();
      }

      const rawPhone = (a.getAttribute('data-wa') || '').trim();
      const phone    = rawPhone.replace(/^\+/, ''); // quitar '+'
      const msg      = a.getAttribute('data-msg') || '';

      if (!phone || !msg) return;

      const url = 'https://wa.me/' + encodeURIComponent(phone)
                + '?text=' + encodeURIComponent(msg);

      window.open(url, '_blank', 'noopener');
      return false;
    }, true);
  });

  // 🔹 3) TELEGRAM: mismo mensaje, compartido como texto
  document.querySelectorAll('#tablaCobros a.cobro-tg').forEach(a => {
    a.addEventListener('click', function(e){
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') {
        e.stopImmediatePropagation();
      }

      const msg = a.getAttribute('data-msg') || '';
      if (!msg) return;

      const share = 'https://t.me/share/url?url=&text=' + encodeURIComponent(msg);
      window.open(share, '_blank', 'noopener');
      return false;
    }, true);
  });
})();
</script>
<script>
(function () {
  // Tooltips Bootstrap 5
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltipTriggerList.forEach(el => new bootstrap.Tooltip(el));

  // ✅ WHATSAPP V2 (usa solo data-wa y data-msg)
  document.querySelectorAll('.cobro-wa-v2').forEach(a => {
    a.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') {
        e.stopImmediatePropagation();
      }

      const rawPhone = (a.dataset.wa || '').trim();
      const phone    = rawPhone.replace(/^\+/, '');
      const msg      = a.dataset.msg || '';

      if (!phone || !msg) return;

      const url = 'https://wa.me/' + encodeURIComponent(phone)
                + '?text=' + encodeURIComponent(msg);

      window.open(url, '_blank', 'noopener');
      return false;
    }, true); // capture=true para adelantarnos a delegados globales
  });

  // ✅ TELEGRAM V2
  document.querySelectorAll('.cobro-tg-v2').forEach(a => {
    a.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') {
        e.stopImmediatePropagation();
      }

      const msg = a.dataset.msg || '';
      if (!msg) return;

      const share = 'https://t.me/share/url?url=&text=' + encodeURIComponent(msg);
      window.open(share, '_blank', 'noopener');
      return false;
    }, true); // capture=true
  });

  // (Si ya tienes aquí abajo el código de filtros y export, déjalo tal cual)
})();
</script>
<script>
document.addEventListener('DOMContentLoaded', function () {
  // Tooltips Bootstrap 5 (por si los usas en los íconos)
  if (window.bootstrap && bootstrap.Tooltip) {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.forEach(function (el) {
      new bootstrap.Tooltip(el);
    });
  }

  // Delegación de eventos para WhatsApp y Telegram (VERSIÓN V2)
  document.addEventListener('click', function (e) {
    const target = e.target.closest('.cobro-wa-v2, .cobro-tg-v2');
    if (!target) return; // click en otra cosa

    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === 'function') {
      e.stopImmediatePropagation();
    }

    // WHATSAPP
    if (target.classList.contains('cobro-wa-v2')) {
      const rawPhone = (target.getAttribute('data-wa') || '').trim();
      const phone    = rawPhone.replace(/^\+/, '');
      const msg      = target.getAttribute('data-msg') || '';

      if (!phone || !msg) return;

      const url = 'https://wa.me/' + encodeURIComponent(phone)
                + '?text=' + encodeURIComponent(msg);

      window.open(url, '_blank', 'noopener');
      return;
    }

    // TELEGRAM
    if (target.classList.contains('cobro-tg-v2')) {
      const msg = target.getAttribute('data-msg') || '';
      if (!msg) return;

      const share = 'https://t.me/share/url?url=&text=' + encodeURIComponent(msg);
      window.open(share, '_blank', 'noopener');
      return;
    }
  }, true); // capture = true para adelantarnos a cualquier handler global
});
</script>
<script>
(function () {
  if (window.__cobrosDeletePermanentInit) return;
  window.__cobrosDeletePermanentInit = true;

  document.addEventListener('click', function (ev) {
    const btn = ev.target.closest('.js-cobro-delete');
    if (!btn) return;

    ev.preventDefault();
    ev.stopPropagation();

    const tr   = btn.closest('tr[data-cobro-hash]');
    const hash = btn.getAttribute('data-hash') || (tr ? tr.getAttribute('data-cobro-hash') : '');

    if (!hash || !tr) {
      console.warn('Cobro sin hash válido');
      return;
    }

    const doDelete = async () => {
      try {
        const resp = await fetch('ajax/cobro_delete.php', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: JSON.stringify({ hash })
        });

        let data;
        try {
          data = await resp.json();
        } catch (_) {
          data = { ok: false, error: 'Respuesta inválida del servidor.' };
        }

        if (!data.ok) {
          if (window.Swal) {
            Swal.fire('Error', data.error || 'No se pudo borrar el cobro.', 'error');
          } else {
            alert(data.error || 'No se pudo borrar el cobro.');
          }
          return;
        }

        // Éxito → quitar la fila de la tabla
        tr.remove();

      } catch (err) {
        console.error(err);
        if (window.Swal) {
          Swal.fire('Error', 'Ocurrió un error al borrar el cobro.', 'error');
        } else {
          alert('Ocurrió un error al borrar el cobro.');
        }
      }
    };

    if (window.Swal) {
      Swal.fire({
        title: '¿Borrar cobro?',
        text: 'No volverá a mostrarse en Cobros.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, borrar',
        cancelButtonText: 'Cancelar'
      }).then(r => {
        if (r.isConfirmed) doDelete();
      });
    } else {
      if (confirm('¿Seguro que quieres borrar este cobro?')) {
        doDelete();
      }
    }
  });
})();
</script>



<?php require_once __DIR__.'/../includes/footer.php'; ?>