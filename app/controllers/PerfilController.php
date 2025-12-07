<?php
// /app/controllers/PerfilController.php
// Acepta precio manual para hijos; si hijo y precio vacío -> 0.00; no hereda del padre
declare(strict_types=1);

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/../models/PerfilModel.php';

if (empty($_SESSION['user_id'])) {
    redirect('../../public/index.php');
}

$action       = $_POST['action']        ?? '';
$streaming_id = (int)($_POST['streaming_id'] ?? 0);
$back         = '../../public/streaming.php?id=' . $streaming_id;

if ($_SERVER['REQUEST_METHOD'] !== 'POST' || $action === '' || $streaming_id <= 0) {
    set_flash('warning', 'Acción inválida.');
    redirect($back);
}

$allowedPlans        = ['individual','standard','premium'];
$allowedEstados      = ['pendiente','activo'];
$allowedDispositivos = ['tv','smartphone'];

function norm_money($in): string {
    $s = is_string($in) ? trim($in) : (string)$in;
    if ($s === '') return '0.00';
    $s = preg_replace('/[^0-9\.,-]/', '', $s) ?? '';
    if ($s === '' || $s === '.' || $s === ',' || $s === '-.' || $s === '-,') return '0.00';
    if (strpos($s, ',') !== false && strpos($s, '.') === false) {
        $s = str_replace(',', '.', $s);
    } else {
        $s = str_replace([','], [''], $s);
    }
    $f = (float)$s;
    return number_format($f, 2, '.', '');
}

try {
    if ($action === 'create' || $action === 'update') {
        $id = (int)($_POST['id'] ?? 0);

        // Normalizamos el plan para aceptar variantes: estándar / estandar / standard, etc.
        $planRaw = trim((string)($_POST['plan'] ?? 'individual'));
        $planLow = mb_strtolower($planRaw, 'UTF-8');

        if ($planLow === 'individual') {
            $plan = 'individual';
        } elseif (in_array($planLow, ['estandar','estándar','estándard','standard','estandard'], true)) {
            $plan = 'standard';
        } elseif (in_array($planLow, ['premium','premiun','premier'], true)) {
            $plan = 'premium';
        } else {
            $plan = 'individual';
        }

        if (!in_array($plan, $allowedPlans, true)) {
            $plan = 'individual';
        }

        $estado = $_POST['estado'] ?? 'activo';
        if (!in_array($estado, $allowedEstados, true)) $estado = 'activo';

        $dispositivo = $_POST['dispositivo'] ?? 'tv';
        if (!in_array($dispositivo, $allowedDispositivos, true)) $dispositivo = 'tv';

        $correo         = trim((string)($_POST['correo'] ?? ''));
        $password_plain = trim((string)($_POST['password_plain'] ?? ''));

        // WhatsApp: +CC y número local con espacios
        $digits = static fn(string $s): string => preg_replace('/\D+/', '', $s) ?? '';
        $cc     = $digits((string)($_POST['wa_cc'] ?? ''));
        $local  = $digits((string)($_POST['wa_local'] ?? ''));
        if ($local !== '') {
            $localFmt = trim(preg_replace('/(\d{3})(?=\d)/', '$1 ', $local) ?? $local);
            $wa = ($cc !== '' ? ('+' . $cc . ' ') : '') . $localFmt;
        } else {
            $wa = '';
        }
        $_POST['whatsapp'] = $wa;

        $perfil      = trim((string)($_POST['perfil'] ?? ''));
        $combo       = (int)($_POST['combo'] ?? 0);
        $isChildFlag = (int)($_POST['is_child'] ?? 0); // 👈 viene del hidden del modal

        $solesIn        = (string)($_POST['soles'] ?? '');
        $soles          = norm_money($solesIn);

        $fecha_inicio   = (string)($_POST['fecha_inicio'] ?? date('Y-m-d'));
        $fecha_fin_in   = (string)($_POST['fecha_fin'] ?? '');

        if ($correo === '' || $password_plain === '' || $fecha_fin_in === '') {
            set_flash('warning','Completa los campos requeridos.');
            redirect($back);
        }

        /**
         * 🚫 Validar correo duplicado SOLO para PADRES nuevos
         * Regla:
         *   - Hijo  => is_child == 1  → puede repetir correo del padre.
         *   - Padre => is_child == 0 → correo debe ser único entre padres (perfil = '' y combo = 0) por streaming.
         */
        $isChild = ($isChildFlag === 1);

        if ($action === 'create' && !$isChild) {
            $pdo = get_pdo();
            $stmt = $pdo->prepare(
                "SELECT COUNT(*) 
                 FROM perfiles
                 WHERE streaming_id = :sid
                   AND correo = :correo
                   AND perfil = ''
                   AND combo = 0"
            );
            $stmt->execute([
                ':sid'    => $streaming_id,
                ':correo' => $correo,
            ]);
            $yaExiste = (int)$stmt->fetchColumn();

            if ($yaExiste > 0) {
                $url = $back;
                $sep = (strpos($url, '?') === false) ? '?' : '&';
                $url .= $sep . 'err=correo_padre_duplicado';
                redirect($url);
            }
        }

        $fi = new DateTime($fecha_inicio);
        $ff = new DateTime($fecha_fin_in);
        if ($ff < $fi) {
            set_flash('warning','La fecha fin no puede ser menor a la fecha de inicio.');
            redirect($back);
        }
        $ff->modify('+1 day'); // regla original

        // Reglas de precio:
        if ($perfil === '' && $soles === '') {
            $soles = '0.00';
        }
        if ($perfil !== '' && $soles === '') {
            $soles = '0.00';
        }

        $data = [
            'streaming_id'   => $streaming_id,
            'plan'           => $plan,
            'correo'         => $correo,
            'password_plain' => $password_plain,
            'fecha_inicio'   => $fi->format('Y-m-d'),
            'fecha_fin'      => $ff->format('Y-m-d'),
            'whatsapp'       => $wa,
            'perfil'         => $perfil,
            'combo'          => $combo ? 1 : 0,
            'soles'          => $soles,
            'estado'         => $estado,
            'dispositivo'    => $dispositivo,
        ];

        if ($action === 'create') {
            PerfilModel::create($data);
            set_flash('success','Perfil creado.');
        } else {
            PerfilModel::update($id, $data);
            set_flash('success','Perfil actualizado.');
        }

        redirect($back);
    }

    if ($action === 'delete') {
        $id = (int)($_POST['id'] ?? 0);
        PerfilModel::delete($id);
        set_flash('success','Perfil eliminado.');
        redirect($back);
    }

    set_flash('warning','Acción no soportada.');
    redirect($back);

} catch (Throwable $e) {
    error_log('PerfilController error: ' . $e->getMessage());
    set_flash('danger','Error: ' . $e->getMessage());
    redirect($back);
}
