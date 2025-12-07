<?php
// app/controllers/StreamingController.php
session_start();

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../models/StreamingModel.php';

if (empty($_SESSION['user_id'])) {
  header('Location: ../../public/index.php');
  exit;
}

// ---- Helpers ----
function flash_redirect(string $type, string $text, string $to = '../../public/dashboard.php') {
  $_SESSION['flash_type'] = $type;
  $_SESSION['flash_text'] = $text;
  header('Location: ' . $to);
  exit;
}

if (!defined('MAX_UPLOAD_SIZE')) define('MAX_UPLOAD_SIZE', 2 * 1024 * 1024); // 2MB
if (!defined('UPLOAD_DIR')) define('UPLOAD_DIR', __DIR__ . '/../../public/uploads');
$ALLOWED_MIME = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/gif' => 'gif'];

// ---- Read action ----
$action = $_POST['action'] ?? $_GET['action'] ?? '';
if (!in_array($action, ['create','update','delete'], true)) {
  flash_redirect('error', 'Acción inválida.');
}

// ---- Common: validate & move upload; return filename or keep existing ----
function handle_logo_upload(?string $existing = ''): string {
  global $ALLOWED_MIME;

  if (!isset($_FILES['logo']) || $_FILES['logo']['error'] === UPLOAD_ERR_NO_FILE) {
    return (string)$existing; // conservar
  }

  if ($_FILES['logo']['error'] !== UPLOAD_ERR_OK) {
    flash_redirect('warning', 'Error al subir el logo.');
  }

  if ((int)$_FILES['logo']['size'] > MAX_UPLOAD_SIZE) {
    flash_redirect('warning', 'El logo supera 2MB.');
  }

  $tmp  = $_FILES['logo']['tmp_name'];
  $finfo = finfo_open(FILEINFO_MIME_TYPE);
  $mime  = finfo_file($finfo, $tmp);
  finfo_close($finfo);

  if (!isset($ALLOWED_MIME[$mime])) {
    flash_redirect('warning', 'Formato inválido. Use JPG, PNG o GIF.');
  }

  $ext = $ALLOWED_MIME[$mime];
  if (!is_dir(UPLOAD_DIR)) { @mkdir(UPLOAD_DIR, 0775, true); }

  $filename = 'logo_' . time() . '_' . mt_rand(1000, 9999) . '.' . $ext;
  $dest = rtrim(UPLOAD_DIR, '/\\') . DIRECTORY_SEPARATOR . $filename;

  if (!move_uploaded_file($tmp, $dest)) {
    flash_redirect('error', 'No se pudo guardar el logo.');
  }

  // opcional: eliminar anterior si existe
  if ($existing && is_file(UPLOAD_DIR . '/' . $existing)) {
    @unlink(UPLOAD_DIR . '/' . $existing);
  }

  return $filename; // guardar SOLO el filename en DB
}

// ================= CREATE / UPDATE =================
if ($action === 'create' || $action === 'update') {
  $id      = (int)($_POST['id'] ?? 0);
  $nombre  = trim((string)($_POST['nombre'] ?? ''));
  $plan    = trim((string)($_POST['plan'] ?? ''));
  $precio  = (string)($_POST['precio'] ?? '');

  if ($nombre === '' || $precio === '') {
    flash_redirect('warning', 'Completa los campos requeridos.');
  }

  // Normaliza precio a float
  $precioNum = (float)str_replace(',', '.', preg_replace('/[^\d.,-]/', '', $precio));

  // Cargar logo actual si es update
  $existingLogo = '';
  if ($action === 'update') {
    if ($id <= 0) flash_redirect('error', 'ID inválido.');
    $pdo = get_pdo();
    $st = $pdo->prepare('SELECT logo FROM streamings WHERE id = ?');
    $st->execute([$id]);
    $existingLogo = (string)($st->fetchColumn() ?: '');
  }

  // Manejo de logo (devuelve filename o conserva)
  $logoForDb = handle_logo_upload($existingLogo);

  try {
    if ($action === 'create') {
      StreamingModel::create([
        'nombre' => $nombre,
        'plan'   => $plan,
        'precio' => $precioNum,
        'logo'   => $logoForDb,
      ]);
      flash_redirect('success', 'Streaming creado correctamente.');
    } else { // update
      StreamingModel::update($id, [
        'nombre' => $nombre,
        'plan'   => $plan,
        'precio' => $precioNum,
        'logo'   => $logoForDb,
      ]);
      flash_redirect('success', 'Streaming actualizado correctamente.');
    }
  } catch (Throwable $e) {
    flash_redirect('error', 'Error: ' . $e->getMessage());
  }
}

// ================= DELETE =================
if ($action === 'delete') {
  $id = (int)($_POST['id'] ?? 0);
  if ($id <= 0) flash_redirect('error', 'ID inválido.');

  // obtener logo para borrar archivo tras eliminar en DB
  $pdo = get_pdo();
  $st = $pdo->prepare('SELECT logo FROM streamings WHERE id = ?');
  $st->execute([$id]);
  $logoToDelete = (string)($st->fetchColumn() ?: '');

  try {
    StreamingModel::delete($id);
    if ($logoToDelete && is_file(UPLOAD_DIR . '/' . $logoToDelete)) {
      @unlink(UPLOAD_DIR . '/' . $logoToDelete);
    }
    flash_redirect('success', 'Streaming eliminado.');
  } catch (Throwable $e) {
    flash_redirect('error', 'Error: ' . $e->getMessage());
  }
}

flash_redirect('error', 'Acción no soportada.');
