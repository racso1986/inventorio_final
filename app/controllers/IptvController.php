<?php
/* /app/controllers/IptvController.php */
declare(strict_types=1);

if (session_status() === PHP_SESSION_NONE) session_start();

require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../helpers.php';
// require_once __DIR__ . '/../models/IptvModel.php'; // no lo usamos aquí

/**
 * Asegurar una instancia PDO desde config/db.php
 * Intenta varios métodos/nombres habituales.
 */
if (!isset($pdo) || !($pdo instanceof PDO)) {
  // probar variables/globales
  if (isset($GLOBALS['pdo']) && $GLOBALS['pdo'] instanceof PDO) {
    $pdo = $GLOBALS['pdo'];
  }
  // probar funciones helper comunes
  elseif (function_exists('db')) {
    $pdo = db();
  } elseif (function_exists('pdo')) {
    $pdo = pdo();
  } elseif (function_exists('get_pdo')) {
    $pdo = get_pdo();
  }
  // probar clase estática común
  elseif (class_exists('DB') && method_exists('DB', 'get')) {
    $pdo = DB::get();
  } elseif (class_exists('DB') && method_exists('DB', 'conn')) {
    $pdo = DB::conn();
  }
}

if (!$pdo || !($pdo instanceof PDO)) {
  // Mensaje claro si no se pudo obtener PDO
  throw new RuntimeException('No se pudo obtener conexión PDO desde config/db.php');
}

if (empty($_SESSION['user_id'])) {
  redirect('../../public/index.php');
}

$action = (string)($_POST['action'] ?? '');
$back   = '../../public/iptv.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST' || $action === '') {
  set_flash('warning','Acción inválida.');
  redirect($back);
}

$allowedEstados = ['pendiente','activo'];

try {
  if ($action === 'create' || $action === 'update') {
    $id      = (int)($_POST['id'] ?? 0);

    $nombre  = trim((string)($_POST['nombre'] ?? ''));
    $usuario = trim((string)($_POST['usuario'] ?? ''));
    $pass    = trim((string)($_POST['password_plain'] ?? ''));
    $url     = trim((string)($_POST['url'] ?? ''));

    // WhatsApp: usa 'whatsapp' si llega; si no, arma desde wa_cc + wa_local
    $wa = trim((string)($_POST['whatsapp'] ?? ''));
    if ($wa === '') {
      $digits = static fn(string $s): string => preg_replace('/\D+/', '', $s);
      $cc     = $digits((string)($_POST['wa_cc'] ?? ''));
      $local  = $digits((string)($_POST['wa_local'] ?? ''));
      if ($local !== '') {
        $localFmt = trim(preg_replace('/(\d{3})(?=\d)/', '$1 ', $local));
        $wa = ($cc !== '' ? ('+' . $cc . ' ') : '') . $localFmt;
      }
    }

    $combo  = (int)($_POST['combo'] ?? 0);
    $soles  = (string)($_POST['soles'] ?? '0.00');
    $estado = (string)($_POST['estado'] ?? 'activo');

    // Fechas robustas
    $fi_raw = (string)($_POST['fecha_inicio'] ?? '');
    $ff_raw = (string)($_POST['fecha_fin'] ?? '');
    if ($fi_raw === '') $fi_raw = date('Y-m-d');
    if ($ff_raw === '') $ff_raw = date('Y-m-d', strtotime('+30 days'));

    if ($nombre === '') $nombre = '(sin nombre)';

    // Normaliza URL (agrega http:// si falta esquema)
    if ($url !== '' && !preg_match('~^https?://~i', $url)) {
      $url = 'http://' . $url;
    }

    /*if ($usuario === '' || $pass === '' || $url === '') {
      set_flash('warning','Completa usuario, contraseña y URL.');
      redirect($back);
    }*/
    
    if (!filter_var($url, FILTER_VALIDATE_URL)) {
      set_flash('warning','URL inválida.');
      redirect($back);
    }
    if (!in_array($estado, $allowedEstados, true)) $estado = 'activo';

    $fi = new DateTime($fi_raw);
    $ff = new DateTime($ff_raw);
    if ($ff < $fi) {
      set_flash('warning','La fecha fin no puede ser menor a la fecha de inicio.');
      redirect($back);
    }
    // +1 día como en tu flujo actual
    $ff->modify('+1 day');

    // Columnas finales (sin perfil ni dispositivo)
    $params = [
      ':nombre'         => $nombre,
      ':usuario'        => $usuario,
      ':password_plain' => $pass,
      ':url'            => $url,
      ':whatsapp'       => $wa,
      ':fi'             => $fi->format('Y-m-d'),
      ':ff'             => $ff->format('Y-m-d'),
      ':soles'          => $soles,
      ':estado'         => $estado,
      ':combo'          => $combo ? 1 : 0,
    ];

    if ($action === 'create') {
      $sql = "INSERT INTO iptv
        (nombre, usuario, password_plain, url, whatsapp, fecha_inicio, fecha_fin, soles, estado, combo)
        VALUES
        (:nombre, :usuario, :password_plain, :url, :whatsapp, :fi, :ff, :soles, :estado, :combo)";
      $stmt = $pdo->prepare($sql);
      $stmt->execute($params);
      set_flash('success','IPTV creada.');
    } else { // update
      $sql = "UPDATE iptv SET
        nombre = :nombre,
        usuario = :usuario,
        password_plain = :password_plain,
        url = :url,
        whatsapp = :whatsapp,
        fecha_inicio = :fi,
        fecha_fin = :ff,
        soles = :soles,
        estado = :estado,
        combo = :combo
        WHERE id = :id";
      $stmt = $pdo->prepare($sql);
      $params[':id'] = $id;
      $stmt->execute($params);
      set_flash('success','IPTV actualizada.');
    }

    redirect($back);
  }

  if ($action === 'delete') {
    $id = (int)($_POST['id'] ?? 0);
    $stmt = $pdo->prepare("DELETE FROM iptv WHERE id = :id");
    $stmt->execute([':id' => $id]);
    set_flash('success','IPTV eliminada.');
    redirect($back);
  }

  set_flash('warning','Acción no soportada.');
  redirect($back);

} catch (Throwable $e) {
  error_log('IptvController error: ' . $e->getMessage());
  set_flash('danger','Error: ' . $e->getMessage());
  redirect($back);
}
