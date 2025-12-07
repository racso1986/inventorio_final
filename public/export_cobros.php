<?php
// public/export_cobros.php
declare(strict_types=1);

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../app/helpers/export_csv.php';

try {
    $pdo = get_pdo();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // 1) OBTENER LAS COLUMNAS REALES DE LA TABLA COBROS
    $colsStmt  = $pdo->query("SHOW COLUMNS FROM cobros");
    $colsDb    = $colsStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $available = array_map(static function($c) {
        return $c['Field'];
    }, $colsDb);

    $has = static function(string $name) use ($available): bool {
        return in_array($name, $available, true);
    };

    // 2) MAPEO DE CABECERAS (LAS DEL THEAD) A POSIBLES CAMPOS DE BD
    //    Para cada encabezado ponemos una lista de posibles nombres de columna.
    $map = [
        'Fin' => [
            'fin', 'fecha_fin', 'fecha_pago', 'fecha_vencimiento'
        ],
        'Contacto' => [
            'contacto', 'cliente', 'cliente_nombre', 'nombre', 'nombre_cliente'
        ],
        'WhatsApp' => [
            'whatsapp', 'telefono', 'telefono_whatsapp', 'celular'
        ],
        'Pago' => [
            'pago', 'monto', 'importe', 'total'
        ],
        'Disney +' => [
            'disney_plus', 'disney', 'disney+'
        ],
        'HBO MAX' => [
            'hbo_max', 'hbomax', 'hbo'
        ],
        'HULU' => [
            'hulu'
        ],
        'Netflix' => [
            'netflix'
        ],
        'Pramount Plus' => [
            'pramount_plus', 'paramount_plus', 'paramount', 'paramountplus'
        ],
        'Prime' => [
            'prime', 'amazon_prime', 'prime_video'
        ],
        'IPTV' => [
            'iptv'
        ],
    ];

    $selectFields = []; // nombres de columnas reales que vamos a seleccionar
    $headers      = []; // textos que irán en el Excel (los del thead)

    // 3) CONSTRUIR LISTA ORDENADA DE CAMPOS A SELECCIONAR
    foreach ($map as $label => $candidates) {
        $foundField = null;

        foreach ($candidates as $c) {
            if ($has($c)) {
                $foundField = $c;
                break;
            }
        }

        // Si encontramos una columna real para este encabezado, la usamos
        if ($foundField !== null) {
            $selectFields[] = $foundField;
            $headers[]      = $label;
        }
        // Si no existe ninguna de las candidatas en BD, simplemente
        // no incluimos esa columna en el CSV para evitar errores.
    }

    // Si por alguna razón no hay ninguna coincidencia, caemos a SELECT *
    if (empty($selectFields)) {
        $selectFields = $available;
        // Encabezados = nombres de columnas "crudas"
        $headers = array_map(static function($f) {
            return ucfirst(str_replace('_', ' ', $f));
        }, $selectFields);
    }

    $selectSql = implode(', ', $selectFields);

    // 4) FILTROS BÁSICOS (OPCIONAL: SOLO SI TU TABLA TIENE ESTAS COLUMNAS)
    $where  = [];
    $params = [];

    // Ejemplo: filtro por fecha usando la columna 'fin' o 'fecha_pago' / 'created_at'
    $dateCol = null;
    if ($has('fin')) {
        $dateCol = 'fin';
    } elseif ($has('fecha_fin')) {
        $dateCol = 'fecha_fin';
    } elseif ($has('fecha_pago')) {
        $dateCol = 'fecha_pago';
    } elseif ($has('created_at')) {
        $dateCol = 'created_at';
    }

    $desde = $_GET['desde'] ?? '';
    $hasta = $_GET['hasta'] ?? '';

    if ($dateCol !== null) {
        if ($desde !== '') {
            $where[]          = "{$dateCol} >= :desde";
            $params[':desde'] = $desde . ' 00:00:00';
        }
        if ($hasta !== '') {
            $where[]          = "{$dateCol} <= :hasta";
            $params[':hasta'] = $hasta . ' 23:59:59';
        }
    }

    // Ejemplo: filtro por estado si existe campo 'estado'
    $estado = $_GET['estado'] ?? 'todos';
    if ($estado !== '' && $estado !== 'todos' && $has('estado')) {
        $where[]           = "estado = :estado";
        $params[':estado'] = $estado;
    }

    // Ejemplo: filtro por método si existe 'metodo'
    $metodo = $_GET['metodo'] ?? 'todos';
    if ($metodo !== '' && $metodo !== 'todos' && $has('metodo')) {
        $where[]           = "metodo = :metodo";
        $params[':metodo'] = $metodo;
    }

    // 5) ARMAR SQL FINAL
    $sql = "SELECT {$selectSql} FROM cobros";
    if ($where) {
        $sql .= ' WHERE ' . implode(' AND ', $where);
    }

    if ($dateCol !== null) {
        $sql .= " ORDER BY {$dateCol} DESC, id DESC";
    } elseif ($has('id')) {
        $sql .= " ORDER BY id DESC";
    }

    $st = $pdo->prepare($sql);
    $st->execute($params);
    $rowsDb = $st->fetchAll(PDO::FETCH_ASSOC) ?: [];

    // 6) ARMAR FILAS EN EL MISMO ORDEN QUE $selectFields
    $rows = [];
    foreach ($rowsDb as $r) {
        $fila = [];
        foreach ($selectFields as $field) {
            $val = $r[$field] ?? '';

            // Formato especial para columna "Pago" → campos típicos: monto/importe
            if (in_array($field, ['pago', 'monto', 'importe', 'total'], true) && $val !== '') {
                $val = number_format((float)$val, 2, '.', '');
            }

            $fila[] = $val;
        }
        $rows[] = $fila;
    }

    // 7) NOMBRE DEL ARCHIVO
    $baseName = 'cobros';
    if ($estado !== '' && $estado !== 'todos') {
        $baseName .= '_estado_' . $estado;
    }
    if ($metodo !== '' && $metodo !== 'todos') {
        $baseName .= '_metodo_' . $metodo;
    }

    export_csv($baseName, $headers, $rows);

} catch (Throwable $e) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo "ERROR EXPORT_COBROS:\n";
    echo $e->getMessage();
    exit;
}
