<?php
// public/import_streamings.php
declare(strict_types=1);
session_start();

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../vendor/autoload.php';

use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;

// ---- Seguridad básica ----
if (empty($_SESSION['user_id'])) {
    header('Location: index.php');
    exit;
}

$pdo = get_pdo();

// ------------------------------------------------------------
// Helpers de BD
// ------------------------------------------------------------

/**
 * Verifica si una tabla existe en la BD actual.
 */
function tableExists(PDO $pdo, string $tableName): bool
{
    $sql  = "SHOW TABLES LIKE " . $pdo->quote($tableName);
    $stmt = $pdo->query($sql);
    return $stmt && $stmt->rowCount() > 0;
}

/**
 * Devuelve las columnas de una tabla (array de nombres de campo).
 */
function getTableColumns(PDO $pdo, string $table): array {
    $stmt = $pdo->query("SHOW COLUMNS FROM `$table`");
    if (!$stmt) {
        return [];
    }
    $cols = $stmt->fetchAll(PDO::FETCH_ASSOC);
    return $cols ? array_column($cols, 'Field') : [];
}

/**
 * Intenta detectar la columna FK hacia streamings.
 */
function getFkColumn(array $columns): ?string {
    foreach (['id_streaming', 'streaming_id'] as $candidate) {
        if (in_array($candidate, $columns, true)) {
            return $candidate;
        }
    }
    return null;
}

/**
 * Upsert genérico:
 * - Si viene id > 0 → UPDATE
 * - Si no → INSERT
 */
function upsertRow(
    PDO $pdo,
    string $table,
    array $rowData,
    int $streamingId,
    ?string $fkCol,
    array $validCols
): void {
    // Limpiar: solo columnas válidas
    $data = [];
    foreach ($rowData as $field => $value) {
        if (in_array($field, $validCols, true)) {
            $data[$field] = $value;
        }
    }

    if (!$data) return;

    // Forzar FK al streaming correspondiente (si aplica)
    if ($fkCol && in_array($fkCol, $validCols, true)) {
        $data[$fkCol] = $streamingId;
    }

    // Detectar id
    $id = 0;
    if (isset($data['id']) && $data['id'] !== '') {
        $id = (int)$data['id'];
    }

    // Filtrar filas totalmente vacías (ignorando id y fk)
    $allEmpty = true;
    foreach ($data as $field => $val) {
        if (in_array($field, ['id', (string)$fkCol], true)) {
            continue;
        }
        if ($val !== null && trim((string)$val) !== '') {
            $allEmpty = false;
            break;
        }
    }
    if ($allEmpty) {
        return;
    }

    if ($id > 0) {
        // UPDATE
        $setParts = [];
        $params   = [];
        foreach ($data as $field => $value) {
            if ($field === 'id') continue;
            $setParts[]        = "`$field` = :$field";
            $params[":$field"] = $value;
        }
        if (!$setParts) return;

        $sql = "UPDATE `$table` SET " . implode(', ', $setParts) . " WHERE `id` = :id";
        $params[':id'] = $id;
        if ($fkCol) {
            $sql .= " AND `$fkCol` = :sid";
            $params[':sid'] = $streamingId;
        }

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

    } else {
        // INSERT (id lo genera la BD)
        unset($data['id']);
        if (!$data) return;

        $fields       = array_keys($data);
        $colsSql      = '`' . implode('`,`', $fields) . '`';
        $placeholders = ':' . implode(',:', $fields);
        $params       = [];

        foreach ($data as $field => $value) {
            $params[":$field"] = $value;
        }

        $sql  = "INSERT INTO `$table` ($colsSql) VALUES ($placeholders)";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
    }
}

/**
 * Lee el Streaming ID desde A1: "Streaming ID: X"
 */
function getStreamingIdFromSheet(Worksheet $sheet): ?int {
    $firstCell = (string)$sheet->getCell('A1')->getValue();
    if (preg_match('/Streaming ID:\s*(\d+)/i', $firstCell, $m)) {
        return (int)$m[1];
    }
    return null;
}

/**
 * Procesa una sección (PERFILES / CUENTAS / STOCK / PAUSA / FAMILIAR)
 * y devuelve la siguiente fila desde donde seguir leyendo la hoja.
 */
function processSection(
    PDO $pdo,
    Worksheet $sheet,
    int $startRow,
    int $highestRow,
    int $highestColIndex,
    string $tableName,
    int $streamingId,
    array $validCols,
    ?string $fkCol
): int {
    $row = $startRow;

    // En $row está el título ("PERFILES", "CUENTAS", etc.)
    // La siguiente fila puede ser "Sin registros" o encabezados
    $row++;
    if ($row > $highestRow) return $row;

    $firstCell = trim((string)$sheet->getCellByColumnAndRow(1, $row)->getValue());

    // Caso "Sin registros"
    if (mb_strtoupper($firstCell) === 'SIN REGISTROS' || $firstCell === '') {
        // Avanzamos hasta la siguiente fila vacía y una más
        while ($row <= $highestRow && trim((string)$sheet->getCellByColumnAndRow(1, $row)->getValue()) !== '') {
            $row++;
        }
        return $row + 1;
    }

    // Encabezados
    $headers = []; // colIndex => fieldName
    for ($col = 1; $col <= $highestColIndex; $col++) {
        $val = trim((string)$sheet->getCellByColumnAndRow($col, $row)->getValue());
        if ($val !== '') {
            $headers[$col] = $val;
        }
    }

    // Verificamos si hay al menos un header que coincida con columnas de BD
    $hasValidHeader = false;
    foreach ($headers as $fieldName) {
        if (in_array($fieldName, $validCols, true)) {
            $hasValidHeader = true;
            break;
        }
    }
    if (!$hasValidHeader) {
        return $row + 1;
    }

    // Pasamos a la primera fila de datos
    $row++;

    while ($row <= $highestRow) {
        $first = (string)$sheet->getCellByColumnAndRow(1, $row)->getValue();
        $trimFirst = trim($first);

        // Fila vacía → fin de sección
        if ($trimFirst === '') {
            break;
        }

        // Si aparece otra sección o cabecera de streaming, cortamos
        $upper = mb_strtoupper($trimFirst);
        if (in_array($upper, ['PERFILES', 'CUENTAS', 'STOCK', 'PAUSA', 'FAMILIAR'], true) ||
            preg_match('/^STREAMING ID:/i', $trimFirst)) {
            break;
        }

        // Armar datos de la fila
        $rowData = [];
        foreach ($headers as $colIndex => $fieldName) {
            $cellVal = $sheet->getCellByColumnAndRow($colIndex, $row)->getValue();
            $rowData[$fieldName] = is_null($cellVal) ? null : (string)$cellVal;
        }

        upsertRow($pdo, $tableName, $rowData, $streamingId, $fkCol, $validCols);
        $row++;
    }

    // Devolvemos la siguiente fila desde donde debe seguir el escaneo
    return $row + 1;
}

// ------------------------------------------------------------
// Comprobamos upload
// ------------------------------------------------------------
if (empty($_FILES['excel']) || $_FILES['excel']['error'] !== UPLOAD_ERR_OK) {
    $_SESSION['flash_type'] = 'danger';
    $_SESSION['flash_text'] = 'No se recibió el archivo de Excel.';
    header('Location: dashboard.php');
    exit;
}

$tmpPath   = $_FILES['excel']['tmp_name'];
$origName  = $_FILES['excel']['name'];
$extension = strtolower(pathinfo($origName, PATHINFO_EXTENSION));

// Forzamos .xlsx (para que coincida con tu exportador moderno)
if ($extension !== 'xlsx') {
    $_SESSION['flash_type'] = 'danger';
    $_SESSION['flash_text'] = 'Por favor sube un archivo .xlsx (formato Excel moderno).';
    header('Location: dashboard.php');
    exit;
}

// Cargamos el libro
try {
    $spreadsheet = IOFactory::load($tmpPath);
} catch (Throwable $e) {
    $_SESSION['flash_type'] = 'danger';
    $_SESSION['flash_text'] = 'Error al leer el archivo de Excel: ' . $e->getMessage();
    header('Location: dashboard.php');
    exit;
}

// ------------------------------------------------------------
// Mapa de secciones → tablas (solo las que existan)
// ------------------------------------------------------------
$rawMap = [
    'PERFILES' => 'perfiles',          // sección PERFILES → tabla perfiles
    'CUENTAS'  => 'cuentas',           // sección CUENTAS  → tabla cuentas
    'STOCK'    => 'perfiles_stock',    // sección STOCK    → tabla perfiles_stock
    'PAUSA'    => 'perfiles_pausa',    // sección PAUSA    → tabla perfiles_pausa
    'FAMILIAR' => 'perfiles_familiar', // sección FAMILIAR → tabla perfiles_familiar
];


$tablesMap    = [];
$tableColumns = [];
$tableFkCols  = [];

foreach ($rawMap as $sectionTitle => $tableName) {
    // Si la tabla NO existe en la BD, la ignoramos
    if (!tableExists($pdo, $tableName)) {
        continue;
    }
    $cols = getTableColumns($pdo, $tableName);
    if (!$cols) {
        continue;
    }
    $tablesMap[$sectionTitle]   = $tableName;
    $tableColumns[$tableName]   = $cols;
    $tableFkCols[$tableName]    = getFkColumn($cols);
}

// ------------------------------------------------------------
// Recorremos hojas del Excel
// ------------------------------------------------------------
$sheetCount = $spreadsheet->getSheetCount();

for ($s = 0; $s < $sheetCount; $s++) {
    /** @var Worksheet $sheet */
    $sheet = $spreadsheet->getSheet($s);

    $streamingId = getStreamingIdFromSheet($sheet);
    if (!$streamingId) {
        // Si la hoja no tiene Streaming ID válido, la saltamos
        continue;
    }

    $highestRow      = $sheet->getHighestRow();
    $highestCol      = $sheet->getHighestColumn();
    $highestColIndex = Coordinate::columnIndexFromString($highestCol);

    $row = 1;

    while ($row <= $highestRow) {
        $val = trim((string)$sheet->getCellByColumnAndRow(1, $row)->getValue());
        if ($val === '') {
            $row++;
            continue;
        }

        $upper = mb_strtoupper($val);

        // Si encontramos una sección conocida, la procesamos
        if (isset($tablesMap[$upper])) {
            $tableName = $tablesMap[$upper];
            $validCols = $tableColumns[$tableName] ?? [];
            $fkCol     = $tableFkCols[$tableName] ?? null;

            $row = processSection(
                $pdo,
                $sheet,
                $row,
                $highestRow,
                $highestColIndex,
                $tableName,
                $streamingId,
                $validCols,
                $fkCol
            );
            continue;
        }

        $row++;
    }
}

// ------------------------------------------------------------
// Listo: redirigimos con mensaje de éxito
// ------------------------------------------------------------
$_SESSION['flash_type'] = 'success';
$_SESSION['flash_text'] = 'Importación de Excel completada correctamente.';
header('Location: dashboard.php');
exit;
