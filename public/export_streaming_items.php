<?php
declare(strict_types=1);

/**
 * Exporta a CSV los ítems de streaming según:
 *  - streaming_id (GET)
 *  - tipo = perfiles | cuentas | stock | pausa | familiar (GET)
 *
 * Ejemplos:
 *   export_streaming_items.php?streaming_id=3&tipo=perfiles
 *   export_streaming_items.php?streaming_id=3&tipo=cuentas
 */

$base = realpath(__DIR__ . '/..');

/* ==== Carga tolerante de config/db ==== */
foreach ([
    $base . '/config/config.php',
    $base . '/config/db.php',
    dirname($base) . '/config/config.php',
    dirname($base) . '/config/db.php'
] as $f) {
    if ($f && is_file($f)) {
        require_once $f;
    }
}

$pdo = (isset($pdo) && $pdo instanceof PDO)
    ? $pdo
    : ((isset($dbh) && $dbh instanceof PDO) ? $dbh : null);

if (!$pdo && function_exists('getPDO')) {
    $pdo = getPDO();
}

if (!$pdo && defined('DB_HOST') && defined('DB_NAME') && defined('DB_USER')) {
    try {
        $pdo = new PDO(
            'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
            DB_USER,
            (defined('DB_PASS') ? DB_PASS : (defined('DB_PASSWORD') ? DB_PASSWORD : '')),
            [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false
            ]
        );
    } catch (Throwable $e) {
        header('Content-Type: text/plain; charset=utf-8');
        http_response_code(500);
        echo "ERROR DB: " . $e->getMessage();
        exit;
    }
}

if (!$pdo) {
    header('Content-Type: text/plain; charset=utf-8');
    http_response_code(500);
    echo "ERROR: No se pudo obtener conexión PDO.";
    exit;
}

/** Escapar CSV simple */
function csv_escape($v): string
{
    $v = (string) $v;
    $v = str_replace('"', '""', $v);
    return '"' . $v . '"';
}

/* ==== Parámetros ==== */
$streamingId = isset($_GET['streaming_id']) ? (int) $_GET['streaming_id'] : 0;
$tipo        = isset($_GET['tipo']) ? strtolower(trim((string) $_GET['tipo'])) : 'perfiles';

$validTipos = ['perfiles', 'cuentas', 'stock', 'pausa', 'familiar'];

if ($streamingId <= 0 || !in_array($tipo, $validTipos, true)) {
    header('Content-Type: text/plain; charset=utf-8');
    http_response_code(400);
    echo "Parámetros inválidos. Debes enviar streaming_id > 0 y tipo en {perfiles, cuentas, stock, pausa, familiar}.";
    exit;
}

/* ==== Obtener nombre del streaming ==== */
try {
    $st = $pdo->prepare('SELECT nombre FROM streamings WHERE id = :id');
    $st->execute([':id' => $streamingId]);
    $streaming = $st->fetchColumn();
} catch (Throwable $e) {
    $streaming = '';
}

if (!$streaming) {
    $streaming = 'Streaming #' . $streamingId;
}

/* ==== Definir consulta y columnas según tipo ==== */
$table      = '';
$sql        = '';
$headers    = [];
$orderBy    = 'ORDER BY fecha_fin, correo, id';

switch ($tipo) {
    case 'perfiles':
        $table = 'perfiles';
        $sql   = "SELECT id, streaming_id, correo, plan, password_plain,
                         fecha_inicio, fecha_fin, whatsapp, perfil, combo,
                         soles, estado, color, dispositivo, created_at
                  FROM perfiles
                  WHERE streaming_id = :sid
                  $orderBy";
        $headers = [
            'ID',
            'Streaming',
            'Correo',
            'Plan',
            'Password',
            'Fecha inicio',
            'Fecha fin',
            'WhatsApp',
            'Perfil',
            'Combo',
            'Soles',
            'Estado',
            'Color',
            'Dispositivo',
            'Creado en'
        ];
        break;

    case 'cuentas':
        $table = 'cuentas';
        $sql   = "SELECT id, streaming_id, correo, plan, password_plain,
                         fecha_inicio, fecha_fin, whatsapp, cuenta,
                         soles, estado, color, dispositivo, created_at
                  FROM cuentas
                  WHERE streaming_id = :sid
                  $orderBy";
        $headers = [
            'ID',
            'Streaming',
            'Correo',
            'Plan',
            'Password',
            'Fecha inicio',
            'Fecha fin',
            'WhatsApp',
            'Cuenta',
            'Soles',
            'Estado',
            'Color',
            'Dispositivo',
            'Creado en'
        ];
        break;

    case 'stock':
        $table = 'perfiles_stock';
        $sql   = "SELECT id, streaming_id, correo, plan, password_plain,
                         fecha_inicio, fecha_fin, whatsapp, perfil, combo,
                         soles, estado, color, dispositivo, created_at
                  FROM perfiles_stock
                  WHERE streaming_id = :sid
                  $orderBy";
        $headers = [
            'ID',
            'Streaming',
            'Correo',
            'Plan',
            'Password',
            'Fecha inicio',
            'Fecha fin',
            'WhatsApp',
            'Perfil',
            'Combo',
            'Soles',
            'Estado',
            'Color',
            'Dispositivo',
            'Creado en'
        ];
        break;

    case 'pausa':
        $table = 'perfiles_pausa';
        $sql   = "SELECT id, streaming_id, correo, plan, password_plain,
                         fecha_inicio, fecha_fin, whatsapp, perfil, combo,
                         soles, estado, color, dispositivo, created_at
                  FROM perfiles_pausa
                  WHERE streaming_id = :sid
                  $orderBy";
        $headers = [
            'ID',
            'Streaming',
            'Correo',
            'Plan',
            'Password',
            'Fecha inicio',
            'Fecha fin',
            'WhatsApp',
            'Perfil',
            'Combo',
            'Soles',
            'Estado',
            'Color',
            'Dispositivo',
            'Creado en'
        ];
        break;

    case 'familiar':
        $table = 'perfiles_familiar';
        $sql   = "SELECT id, streaming_id, correo, plan, password_plain,
                         fecha_inicio, fecha_fin, whatsapp, perfil,
                         soles, estado, dispositivo, combo, color, created_at
                  FROM perfiles_familiar
                  WHERE streaming_id = :sid
                  $orderBy";
        $headers = [
            'ID',
            'Streaming',
            'Correo',
            'Plan',
            'Password',
            'Fecha inicio',
            'Fecha fin',
            'WhatsApp',
            'Perfil',
            'Soles',
            'Estado',
            'Dispositivo',
            'Combo',
            'Color',
            'Creado en'
        ];
        break;
}

/* ==== Ejecutar consulta ==== */
try {
    $st = $pdo->prepare($sql);
    $st->execute([':sid' => $streamingId]);
    $rows = $st->fetchAll();
} catch (Throwable $e) {
    header('Content-Type: text/plain; charset=utf-8');
    http_response_code(500);
    echo "ERROR SQL:\n" . $e->getMessage();
    exit;
}

/* ==== Preparar salida CSV ==== */
$filename = sprintf(
    '%s_%s_%s.csv',
    $tipo,
    preg_replace('/\s+/', '_', strtolower($streaming)),
    date('Ymd_His')
);

header('Content-Type: text/csv; charset=UTF-8');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Pragma: no-cache');
header('Expires: 0');

// BOM UTF-8 para que Excel respete acentos
echo "\xEF\xBB\xBF";

/* Encabezados */
echo implode(',', array_map('csv_escape', $headers)) . "\r\n";

/* Filas */
foreach ($rows as $r) {
    $row = [];

    // ID
    $row[] = csv_escape($r['id'] ?? '');

    // Streaming (nombre en texto, NO el ID numérico)
    $row[] = csv_escape($streaming);

    // Para cada tipo respetamos la misma estructura que headers
    switch ($tipo) {
        case 'perfiles':
        case 'stock':
        case 'pausa':
            $row[] = csv_escape($r['correo'] ?? '');
            $row[] = csv_escape($r['plan'] ?? '');
            $row[] = csv_escape($r['password_plain'] ?? '');
            $row[] = csv_escape($r['fecha_inicio'] ?? '');
            $row[] = csv_escape($r['fecha_fin'] ?? '');
            $row[] = csv_escape($r['whatsapp'] ?? '');
            $row[] = csv_escape($r['perfil'] ?? '');
            if ($tipo !== 'familiar') {
                // perfiles, stock, pausa
                $row[] = csv_escape($r['combo'] ?? '');
            }
            $row[] = csv_escape($r['soles'] ?? '');
            $row[] = csv_escape($r['estado'] ?? '');
            $row[] = csv_escape($r['color'] ?? '');
            $row[] = csv_escape($r['dispositivo'] ?? '');
            $row[] = csv_escape($r['created_at'] ?? '');
            break;

        case 'cuentas':
            $row[] = csv_escape($r['correo'] ?? '');
            $row[] = csv_escape($r['plan'] ?? '');
            $row[] = csv_escape($r['password_plain'] ?? '');
            $row[] = csv_escape($r['fecha_inicio'] ?? '');
            $row[] = csv_escape($r['fecha_fin'] ?? '');
            $row[] = csv_escape($r['whatsapp'] ?? '');
            $row[] = csv_escape($r['cuenta'] ?? '');
            $row[] = csv_escape($r['soles'] ?? '');
            $row[] = csv_escape($r['estado'] ?? '');
            $row[] = csv_escape($r['color'] ?? '');
            $row[] = csv_escape($r['dispositivo'] ?? '');
            $row[] = csv_escape($r['created_at'] ?? '');
            break;

        case 'familiar':
            // Ojo: familiar tiene orden un poco distinto
            $row[] = csv_escape($r['correo'] ?? '');
            $row[] = csv_escape($r['plan'] ?? '');
            $row[] = csv_escape($r['password_plain'] ?? '');
            $row[] = csv_escape($r['fecha_inicio'] ?? '');
            $row[] = csv_escape($r['fecha_fin'] ?? '');
            $row[] = csv_escape($r['whatsapp'] ?? '');
            $row[] = csv_escape($r['perfil'] ?? '');
            $row[] = csv_escape($r['soles'] ?? '');
            $row[] = csv_escape($r['estado'] ?? '');
            $row[] = csv_escape($r['dispositivo'] ?? '');
            $row[] = csv_escape($r['combo'] ?? '');
            $row[] = csv_escape($r['color'] ?? '');
            $row[] = csv_escape($r['created_at'] ?? '');
            break;
    }

    echo implode(',', $row) . "\r\n";
}

exit;
