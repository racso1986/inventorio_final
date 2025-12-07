<?php
// Ajusta estas constantes para tu entorno
define('DB_HOST', 'localhost');
define('DB_NAME', 'u736815543_abbas');
define('DB_USER', 'u736815543_abbas');
define('DB_PASS', 'Maxidigital_2025');

// URL base del proyecto (ajusta si usas subcarpeta)
define('BASE_URL', 'https://abbas.maxidigital.pe');

// Rutas
define('BASE_PATH', dirname(__DIR__));
define('PUBLIC_PATH', BASE_PATH . '/public');
define('UPLOAD_DIR', PUBLIC_PATH . '/uploads');

// Configuración de subida
define('MAX_UPLOAD_SIZE', 2 * 1024 * 1024); // 2MB
$ALLOWED_IMG_EXT = ['jpg','jpeg','png','gif'];
$ALLOWED_IMG_MIME = ['image/jpeg','image/png','image/gif'];

// Inicia sesión global
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
?>    



<?php
// Detecta si el docroot público es /public o la raíz
$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host   = $_SERVER['HTTP_HOST'] ?? 'codexo.maxidigital.pe';

// Si la URL del script contiene /public/ asumimos que el docroot es /public
$needsPublic = (strpos($_SERVER['SCRIPT_NAME'] ?? '', '/public/') === false);

// BASE_URL absoluto correcto para assets
// config/config.php

if (!defined('BASE_URL')) {
    define('BASE_URL', $scheme . '://' . $host . ($needsPublic ? '/public' : ''));
}


// Directorio de uploads físico
if (!defined('UPLOAD_DIR')) {
  define('UPLOAD_DIR', __DIR__ . '/../public/uploads');
}

/**
 * asset_url('uploads/archivo.png') => URL absoluto correcta
 */
function asset_url(string $path): string {
  $path = ltrim($path, '/');
  return rtrim(BASE_URL, '/') . '/' . $path;
}

/**
 * Normaliza lo guardado en DB para logos.
 * Acepta: filename ("logo_x.png"), "uploads/logo_x.png" o URL absoluta.
 * Devuelve URL absoluta servible.
 */
function logo_url_from_db(?string $stored): string {
  $stored = trim((string)$stored);
  if ($stored === '') return '';
  if (preg_match('#^https?://#', $stored)) return $stored;
  // Si vino con "uploads/...", nos quedamos con el basename para evitar "uploads/uploads"
  $filename = basename($stored);
  return asset_url('uploads/' . $filename);
}











// ---- IPTV: dividir en tablas (ON = usa iptv_perfiles / iptv_cuentas) ----
if (!defined('IPTV_SPLIT_TABLES')) define('IPTV_SPLIT_TABLES', true);

// Dual-write opcional a la tabla legacy 'iptv' (por defecto OFF)
if (!defined('IPTV_DUAL_WRITE')) define('IPTV_DUAL_WRITE', false);

/**
 * Resuelve el nombre de tabla según tipo y flag.
 * 'perfil' | 'cuenta' -> iptv_perfiles | iptv_cuentas (si flag=ON), si no -> 'iptv'
 */
if (!function_exists('iptv_table_for')) {
  function iptv_table_for(string $tipo): string {
    $t = strtolower(trim($tipo));
    if (!IPTV_SPLIT_TABLES) return 'iptv';
    return ($t === 'perfil') ? 'iptv_perfiles' : 'iptv_cuentas';
  }
}
