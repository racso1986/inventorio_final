<?php
// public/export_streamings.php
declare(strict_types=1);
session_start();

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../vendor/autoload.php';

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;

// ---- Seguridad básica: solo usuarios logueados ----
if (empty($_SESSION['user_id'])) {
    header('Location: index.php');
    exit;
}

/**
 * Convierte número de columna (1,2,3,...) → letra de Excel (A,B,C...AA,...)
 */
function excelColLetter(int $colNumber): string
{
    $colLetter = '';
    while ($colNumber > 0) {
        $modulo    = ($colNumber - 1) % 26;
        $colLetter = chr(65 + $modulo) . $colLetter;
        $colNumber = (int)(($colNumber - $modulo) / 26);
    }
    return $colLetter;
}

/**
 * Exporta una tabla de STREAMING (perfiles, cuentas, stock, pausa, familiar)
 * Devuelve la siguiente fila libre después de escribir la tabla.
 */
function exportTableForStreaming(
    PDO $pdo,
    Worksheet $sheet,
    string $tableName,
    string $tableTitle,
    int $streamingId,
    int $startRow
): int {
    // 1) Obtener columnas reales de la tabla
    $stmtCols = $pdo->query("SHOW COLUMNS FROM `$tableName`");
    if (!$stmtCols) {
        throw new RuntimeException("No se pudieron leer las columnas de la tabla `$tableName`.");
    }
    $colsInfo = $stmtCols->fetchAll(PDO::FETCH_ASSOC);
    if (!$colsInfo) {
        // Tabla vacía de columnas (raro, pero por si acaso)
        return $startRow;
    }

    $columns = array_column($colsInfo, 'Field'); // TODAS las columnas

    // 2) Detectar columna de relación con streaming (id_streaming o streaming_id)
    $fkCol = null;
    foreach (['id_streaming', 'streaming_id'] as $candidate) {
        if (in_array($candidate, $columns, true)) {
            $fkCol = $candidate;
            break;
        }
    }

    // 3) Armar query: si hay FK, se filtra por streaming; si no, se trae todo
    $colsList = '`' . implode('`,`', $columns) . '`';

    if ($fkCol) {
        $sql  = "SELECT $colsList FROM `$tableName` WHERE `$fkCol` = :sid ORDER BY `id` ASC";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':sid' => $streamingId]);
    } else {
        // Caso raro: tabla sin FK clara → exportamos todo
        $sql  = "SELECT $colsList FROM `$tableName` ORDER BY `id` ASC";
        $stmt = $pdo->query($sql);
    }

    if (!$stmt) {
        throw new RuntimeException("No se pudieron leer registros de la tabla `$tableName`.");
    }

    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 4) Título de la sección
    $row = $startRow;
    $sheet->setCellValue('A' . $row, $tableTitle);

    $lastColLetter = excelColLetter(count($columns));
    $sheet->mergeCells('A' . $row . ':' . $lastColLetter . $row);
    $sheet->getStyle('A' . $row)->getFont()->setBold(true);
    $row++;

    if (!$rows) {
        // Si no hay registros, dejamos el mensaje
        $sheet->setCellValue('A' . $row, 'Sin registros');
        $row += 2;
        return $row;
    }

    // 5) Encabezados: TODAS las columnas reales
    foreach ($columns as $i => $field) {
        $colLetter = excelColLetter($i + 1);
        $sheet->setCellValue($colLetter . $row, $field);
    }
    $sheet->getStyle('A' . $row . ':' . $lastColLetter . $row)->getFont()->setBold(true);
    $row++;

    // 6) Datos
    foreach ($rows as $r) {
        foreach ($columns as $i => $field) {
            $colLetter = excelColLetter($i + 1);
            $sheet->setCellValue($colLetter . $row, $r[$field]);
        }
        $row++;
    }

    // Fila en blanco después de la tabla
    $row++;
    return $row;
}

try {
    $pdo = get_pdo();

    $spreadsheet = new Spreadsheet();

    // -----------------------------------------------------------------
    // STREAMINGS (tabla streamings)
    // -----------------------------------------------------------------
    $stmtStreamings = $pdo->query("SELECT id, nombre FROM streamings ORDER BY nombre ASC");
    if (!$stmtStreamings) {
        throw new RuntimeException('No se pudo consultar la tabla "streamings".');
    }

    $streamings = $stmtStreamings->fetchAll(PDO::FETCH_ASSOC);

    if (!$streamings) {
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('SIN_STREAMINGS');
        $sheet->setCellValue('A1', 'No hay streamings registrados.');
    } else {
        foreach ($streamings as $index => $st) {
            $streamingId   = (int)$st['id'];
            $streamingName = (string)$st['nombre'];

            if ($index === 0) {
                $sheet = $spreadsheet->getActiveSheet();
            } else {
                $sheet = new Worksheet($spreadsheet);
                $spreadsheet->addSheet($sheet);
            }

            // Título de la hoja (máx 31 caracteres)
            $sheetTitle = mb_substr($streamingName, 0, 31);
            if ($sheetTitle === '') {
                $sheetTitle = 'Streaming_' . $streamingId;
            }
            $sheet->setTitle($sheetTitle);

            // Cabecera de streaming
            $row = 1;
            $sheet->setCellValue('A' . $row, "Streaming ID: {$streamingId}");
            $row++;
            $sheet->setCellValue('A' . $row, "Nombre: {$streamingName}");
            $sheet->getStyle('A1:A' . $row)->getFont()->setBold(true);
            $row += 2;

            // -----------------------------------------------------------------
            // Tablas de STREAMING: perfiles, cuentas, stock, pausa, familiar
            // (AQUÍ van las tablas que son SOLO de streamings, no IPTV)
            // -----------------------------------------------------------------
            // Tablas de STREAMING en tu BD real:
$tables = [
    'perfiles'          => 'PERFILES',   // tabla: perfiles
    'cuentas'           => 'CUENTAS',    // tabla: cuentas
    'perfiles_stock'    => 'STOCK',      // tabla real: perfiles_stock
    'perfiles_pausa'    => 'PAUSA',      // tabla real: perfiles_pausa
    'perfiles_familiar' => 'FAMILIAR',   // tabla real: perfiles_familiar
];


            foreach ($tables as $tableName => $title) {
                // Si alguna tabla no existe DEBE avisar, para que la crees o corrijas el nombre
                $check = $pdo->query("SHOW TABLES LIKE " . $pdo->quote($tableName));
                if (!$check || $check->rowCount() === 0) {
                    throw new RuntimeException("La tabla requerida `$tableName` no existe en la BD (es de streaming).");
                }

                $row = exportTableForStreaming($pdo, $sheet, $tableName, $title, $streamingId, $row);
                $row++;
            }

            // Ajustar ancho de columnas
            $highestCol      = $sheet->getHighestColumn();
            $highestColIndex = Coordinate::columnIndexFromString($highestCol);
            for ($col = 1; $col <= $highestColIndex; $col++) {
                $sheet->getColumnDimension(excelColLetter($col))->setAutoSize(true);
            }
        }
    }

} catch (\Throwable $e) {
    // Si algo falla ANTES de mandar el Excel, mostramos error en texto
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo "Error al generar el Excel:\n\n" . $e->getMessage();
    exit;
}

// ---------------------------------------------------------------------
// Enviar el XLSX al navegador
// ---------------------------------------------------------------------
if (ob_get_length()) {
    ob_end_clean();
}

$filename = 'streamings_' . date('Ymd_His') . '.xlsx';

header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Cache-Control: max-age=0');
header('Pragma: public');

$writer = new Xlsx($spreadsheet);
$writer->save('php://output');
exit;
