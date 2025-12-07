<?php
declare(strict_types=1);

session_start();

require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/../models/CuentaModel.php';

if (empty($_SESSION['user_id'])) {
  redirect('../../public/index.php');
}

$action       = $_POST['action']        ?? '';
$streaming_id = (int)($_POST['streaming_id'] ?? 0);
$back         = '../../public/streaming.php?id=' . $streaming_id;

// seguridad básica
if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !$action || $streaming_id <= 0) {
  set_flash('warning','Acción inválida.');
  redirect($back);
}

// listas permitidas (por si luego quieres validar estado/dispositivo)
$allowedEstados      = ['pendiente','activo'];
$allowedDispositivos = ['tv','smartphone'];

try {
  if ($action === 'create' || $action === 'update') {

    // -------- leer y validar mínimos
    $correo         = trim((string)($_POST['correo'] ?? ''));
    $password_plain = trim((string)($_POST['password_plain'] ?? ''));

    /* ==== WhatsApp (2 inputs reales: wa_cc y wa_local, sin defaults) ==== */
    $digits = static fn(string $s): string => preg_replace('/\D+/', '', $s);

    $cc    = $digits((string)($_POST['wa_cc'] ?? ''));
    $local = $digits((string)($_POST['wa_local'] ?? ''));

    if ($local !== '') {
      $localFmt = trim(preg_replace('/(\d{3})(?=\d)/', '$1 ', $local));
      $wa = ($cc !== '' ? ('+' . $cc . ' ') : '') . $localFmt;
    } else {
      $wa = '';
    }
    $_POST['whatsapp'] = $wa; // valor final que se guarda

    $cuenta         = trim((string)($_POST['cuenta'] ?? ''));
    $soles          = (string)($_POST['soles'] ?? '0.00');
    $estado         = (string)($_POST['estado'] ?? 'pendiente');
    $dispositivo    = (string)($_POST['dispositivo'] ?? 'tv');

    // fechas
    $fi_raw = (string)($_POST['fecha_inicio'] ?? '');
    $ff_raw = (string)($_POST['fecha_fin'] ?? '');

    if ($correo === '' || $password_plain === '' || $fi_raw === '' || $ff_raw === '') {
      set_flash('warning','Completa los campos requeridos.');
      redirect($back);
    }

    // normaliza estado/dispositivo
    if (!in_array($estado, $allowedEstados, true))           $estado = 'activo';
    if (!in_array($dispositivo, $allowedDispositivos, true)) $dispositivo = 'tv';

    // -------- fechas con +1 día SIEMPRE
    $fi = new DateTime($fi_raw);
    $ff = new DateTime($ff_raw);
    if ($ff < $fi) {
      set_flash('warning','La fecha fin no puede ser menor a la fecha de inicio.');
      redirect($back);
    }
    $ff->modify('+1 day'); // <-- +1 día

    // -------- payload final a modelo
    $data = [
      'streaming_id'   => $streaming_id,
      'correo'         => $correo,
      'password_plain' => $password_plain,
      'whatsapp'       => $wa,
      'cuenta'         => $cuenta,
      'soles'          => $soles,
      'estado'         => $estado,
      'dispositivo'    => $dispositivo,
      'fecha_inicio'   => $fi->format('Y-m-d'),
      'fecha_fin'      => $ff->format('Y-m-d'),
    ];

    if ($action === 'create') {
      CuentaModel::create($data);
      set_flash('success','Cuenta creada.');
    } else {
      $id = (int)($_POST['id'] ?? 0);
      CuentaModel::update($id, $data);
      set_flash('success','Cuenta actualizada.');
    }

    redirect($back);
  }

  if ($action === 'delete') {
    $id = (int)($_POST['id'] ?? 0);
    CuentaModel::delete($id);
    set_flash('success','Cuenta eliminada.');
    redirect($back);
  }

  set_flash('warning','Acción no soportada.');
  redirect($back);

} catch (Throwable $e) {
  error_log('CuentaController error: ' . $e->getMessage());
  set_flash('danger','Error: ' . $e->getMessage());
  redirect($back);
}
