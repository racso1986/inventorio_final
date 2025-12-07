<?php
// public/export_iptv_servicios.php
declare(strict_types=1);

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../app/helpers/export_csv.php';

$pdo = get_pdo();
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

// Si quieres filtros, los lees de $_GET (plan, estado, etc.)
// Por ahora exportamos TODO:
$sql = "SELECT id, nombre, plan, precio, logo, created_at
        FROM iptv_servicios
        ORDER BY nombre ASC";

$rowsDb = $pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC) ?: [];

$columns = ['ID', 'Nombre', 'Plan', 'Precio', 'Logo', 'Creado el'];
$rows    = [];

foreach ($rowsDb as $r) {
    $rows[] = [
        $r['id'],
        $r['nombre'],
        $r['plan'],
        number_format((float)$r['precio'], 2, '.', ''),
        $r['logo'],
        $r['created_at'],
    ];
}

// Llama a helper
export_csv('iptv_servicios', $columns, $rows);
