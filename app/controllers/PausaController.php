<?php
declare(strict_types=1);

session_start();

require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/../models/PausaModel.php';

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

$allowedPlans        = ['individual','estándar','premium'];
$allowedEstados      = ['pendiente','activo'];
$allowedDispositivos = ['tv','smartphone'];

try {
  if ($action === 'create' || $action === 'update') {
;

    $id = (int)($_POST['id'] ?? 0);

    $plan = $_POST['plan'] ?? 'individual';
    if (!in_array($plan, $allowedPlans, true)) $plan = 'individual';

    $estado = $_POST['estado'] ?? 'activo';
    if (!in_array($estado, $allowedEstados, true)) $estado = 'pendiente';

    $dispositivo = $_POST['dispositivo'] ?? 'tv';
    if (!in_array($dispositivo, $allowedDispositivos, true)) $dispositivo = 'tv';

    $correo         = trim((string)($_POST['correo'] ?? ''));
    $password_plain = trim((string)($_POST['password_plain'] ?? ''));
    $whatsapp       = preg_replace('/\D+/', '', (string)($_POST['whatsapp'] ?? ''));
    $perfil         = trim((string)($_POST['perfil'] ?? ''));
    $combo          = (int)($_POST['combo'] ?? 0);
    $soles          = (string)($_POST['soles'] ?? '0.00');
    $fecha_inicio   = (string)($_POST['fecha_inicio'] ?? date('Y-m-d'));
    $fecha_fin      = (string)($_POST['fecha_fin'] ?? '');

    // validaciones mínimas
    if ($correo === '' || $password_plain === '' || $fecha_fin === '') {
      set_flash('warning','Completa los campos requeridos.');
      redirect($back);
    }

    // regla simple de fechas
    $fi = new DateTime($fecha_inicio);
    $ff = new DateTime($fecha_fin);
    if ($ff < $fi) {
      set_flash('warning','La fecha fin no puede ser menor a la fecha de inicio.');
      redirect($back);
    }

    $data = [
      'streaming_id'   => $streaming_id,
      'plan'           => $plan,
      'correo'         => $correo,
      'password_plain' => $password_plain,
      'whatsapp'       => $whatsapp,
      'perfil'         => $perfil,
      'combo'          => $combo ? 1 : 0,
      'soles'          => $soles,
      'estado'         => $estado,
      'dispositivo'    => $dispositivo,
      'fecha_inicio'   => $fi->format('Y-m-d'),
      'fecha_fin'      => $ff->format('Y-m-d'),
    ];

    if ($action === 'create') {
      PausaModel::create($data);
      set_flash('success','Cuenta en pausa creada.');
    } else {
      PausaModel::update($id, $data);
      set_flash('success','Cuenta en pausa actualizada.');
    }

    redirect($back);
  }

  if ($action === 'delete') {
    $id = (int)($_POST['id'] ?? 0);
    PausaModel::delete($id);
    set_flash('success','Registro en pausa eliminado.');
    redirect($back);
  }

  set_flash('warning','Acción no soportada.');
  redirect($back);

} catch (Throwable $e) {
  error_log('PausaController error: ' . $e->getMessage());
  set_flash('danger','Error: ' . $e->getMessage());
  redirect($back);
}
