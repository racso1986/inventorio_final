<?php
// public/export_iptv_items.php
declare(strict_types=1);

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../app/helpers/export_csv.php';

$pdo = get_pdo();
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

// servicio_id y tipo vienen del enlace
$servicio_id = isset($_GET['servicio_id']) ? (int)$_GET['servicio_id'] : 0;
$tipo        = ($_GET['tipo'] ?? 'perfil') === 'cuenta' ? 'cuenta' : 'perfil';

// Tabla según tipo
$table = $tipo === 'cuenta' ? 'iptv_cuentas' : 'iptv_perfiles';

$sql = "SELECT id, nombre, usuario, password_plain, url, whatsapp,
               fecha_inicio, fecha_fin, soles, estado, combo, color, created_at
        FROM {$table}
        WHERE servicio_id = :sid
        ORDER BY fecha_fin ASC, id ASC";

$st = $pdo->prepare($sql);
$st->execute([':sid' => $servicio_id]);
$rowsDb = $st->fetchAll(PDO::FETCH_ASSOC) ?: [];

$columns = [
    'ID', 'Nombre', 'Usuario', 'Password', 'URL', 'WhatsApp',
    'Fecha inicio', 'Fecha fin', 'Soles', 'Estado', 'Combo', 'Color', 'Creado el'
];

$rows = [];
foreach ($rowsDb as $r) {
    $rows[] = [
        $r['id'],
        $r['nombre'],
        $r['usuario'],
        $r['password_plain'],
        $r['url'],
        $r['whatsapp'],
        $r['fecha_inicio'],
        $r['fecha_fin'],
        number_format((float)$r['soles'], 2, '.', ''),
        $r['estado'],
        (int)$r['combo'],
        $r['color'],
        $r['created_at'],
    ];
}

$baseName = $tipo === 'cuenta' ? 'iptv_cuentas' : 'iptv_perfiles';
$baseName .= '_servicio_' . $servicio_id;

export_csv($baseName, $columns, $rows);
