<?php
/* /app/models/IptvModel.php */
declare(strict_types=1);

require_once __DIR__ . '/../../config/db.php';

final class IptvModel {

  /* ======================= LEGACY (tabla única: iptv) ======================= */

  public static function all(): array {
    $pdo = get_pdo();
    $sql = "SELECT id, nombre, usuario, password_plain, url, whatsapp,
                   fecha_inicio, fecha_fin, soles, estado, combo,
                   color, created_at
              FROM iptv
             ORDER BY usuario ASC, fecha_fin ASC, id ASC";
    $st = $pdo->query($sql);
    $rows = $st ? $st->fetchAll(PDO::FETCH_ASSOC) : [];
    return $rows ?: [];
  }

  public static function get(int $id): ?array {
    $pdo = get_pdo();
    $st  = $pdo->prepare(
      "SELECT id, nombre, usuario, password_plain, url, whatsapp,
              fecha_inicio, fecha_fin, soles, estado, combo,
              color, created_at
         FROM iptv
        WHERE id=?"
    );
    $st->execute([$id]);
    $row = $st->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
  }

  public static function create(array $d): int {
    $pdo = get_pdo();
    $st  = $pdo->prepare(
      "INSERT INTO iptv
       (nombre, usuario, password_plain, url, whatsapp,
        fecha_inicio, fecha_fin, soles, estado, combo, color, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,NOW())"
    );
    $st->execute([
      (string)($d['nombre'] ?? ''),
      (string)($d['usuario'] ?? ''),
      (string)($d['password_plain'] ?? ''),
      (string)($d['url'] ?? ''),
      ($d['whatsapp'] ?? '') !== '' ? (string)$d['whatsapp'] : null,
      (string)($d['fecha_inicio'] ?? ''),
      (string)($d['fecha_fin'] ?? ''),
      (string)($d['soles'] ?? '0.00'),
      (string)($d['estado'] ?? 'activo'),
      (int)($d['combo'] ?? 0),
      ($d['color'] ?? '') !== '' ? (string)$d['color'] : null,
    ]);
    return (int)$pdo->lastInsertId();
  }

  public static function update(int $id, array $d): bool {
    $pdo = get_pdo();
    $st  = $pdo->prepare(
      "UPDATE iptv SET
        nombre=?, usuario=?, password_plain=?, url=?, whatsapp=?,
        fecha_inicio=?, fecha_fin=?, soles=?, estado=?, combo=?
       WHERE id=?"
    );
    return $st->execute([
      (string)($d['nombre'] ?? ''),
      (string)($d['usuario'] ?? ''),
      (string)($d['password_plain'] ?? ''),
      (string)($d['url'] ?? ''),
      ($d['whatsapp'] ?? '') !== '' ? (string)$d['whatsapp'] : null,
      (string)($d['fecha_inicio'] ?? ''),
      (string)($d['fecha_fin'] ?? ''),
      (string)($d['soles'] ?? '0.00'),
      (string)($d['estado'] ?? 'activo'),
      (int)($d['combo'] ?? 0),
      $id,
    ]);
  }

  public static function delete(int $id): bool {
    $pdo = get_pdo();
    $st  = $pdo->prepare("DELETE FROM iptv WHERE id=?");
    return $st->execute([$id]);
  }

  public static function setColor(int $id, ?string $color): bool {
    $pdo = get_pdo();
    $st  = $pdo->prepare("UPDATE iptv SET color=? WHERE id=?");
    return $st->execute([$color ?: null, $id]);
  }

  /* ======================= NUEVO (split por tipo/tabla) ======================= */

  // helpers por tipo → tabla
   /* ======================= NUEVO (split por tipo/tabla) ======================= */

  // helpers por tipo → tabla
  private static function tableByType(string $tipo): string {
    if (function_exists('iptv_table_for')) return iptv_table_for($tipo);
    $tipo = strtolower($tipo);
    return ($tipo === 'perfil') ? 'iptv_perfiles' : 'iptv_cuentas';
  }

  /**
   * Listados
   * Ahora puede filtrar por servicio_id (cuando se le pasa).
   * allFrom('perfil')        → lista global (como antes)
   * allFrom('perfil', 3)     → solo servicio_id = 3
   */
  public static function allFrom(string $tipo, int $servicioId = 0): array {
    $pdo   = get_pdo();
    $table = self::tableByType($tipo);

    if ($servicioId > 0) {
      $sql = "SELECT id, servicio_id, nombre, usuario, password_plain, url, whatsapp,
                     fecha_inicio, fecha_fin, soles, estado, combo,
                     color, created_at
                FROM {$table}
               WHERE servicio_id = :sid
               ORDER BY usuario ASC, fecha_fin ASC, id ASC";
      $st = $pdo->prepare($sql);
      $st->execute([':sid' => $servicioId]);
      return $st->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    // listado global (sin filtrar) → para vistas generales
    $sql = "SELECT id, servicio_id, nombre, usuario, password_plain, url, whatsapp,
                   fecha_inicio, fecha_fin, soles, estado, combo,
                   color, created_at
              FROM {$table}
             ORDER BY usuario ASC, fecha_fin ASC, id ASC";

    return $pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC) ?: [];
  }

  // detalle
  public static function getFrom(string $tipo, int $id): ?array {
    $pdo   = get_pdo();
    $table = self::tableByType($tipo);
    $st    = $pdo->prepare(
      "SELECT id, servicio_id, nombre, usuario, password_plain, url, whatsapp,
              fecha_inicio, fecha_fin, soles, estado, combo,
              color, created_at
         FROM {$table}
        WHERE id=?"
    );
    $st->execute([$id]);
    $row = $st->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
  }

  /**
   * Crear
   * Ahora inserta también servicio_id si viene en $d['servicio_id'].
   */
  public static function createIn(string $tipo, array $d): int {
    $pdo   = get_pdo();
    $table = self::tableByType($tipo);

    $servicioId = (int)($d['servicio_id'] ?? 0);

    $st    = $pdo->prepare(
      "INSERT INTO {$table}
       (servicio_id, nombre, usuario, password_plain, url, whatsapp,
        fecha_inicio, fecha_fin, soles, estado, combo, color, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?, ?, NOW())"
    );
    $st->execute([
      $servicioId,
      (string)($d['nombre'] ?? ''),
      (string)($d['usuario'] ?? ''),
      (string)($d['password_plain'] ?? ''),
      (string)($d['url'] ?? ''),
      ($d['whatsapp'] ?? '') !== '' ? (string)$d['whatsapp'] : null,
      (string)($d['fecha_inicio'] ?? ''),
      (string)($d['fecha_fin'] ?? ''),
      (string)($d['soles'] ?? '0.00'),
      (string)($d['estado'] ?? 'activo'),
      (int)($d['combo'] ?? 0),
      ($d['color'] ?? '') !== '' ? (string)$d['color'] : null,
    ]);
    return (int)$pdo->lastInsertId();
  }


  // actualizar
  public static function updateIn(string $tipo, int $id, array $d): bool {
    $pdo   = get_pdo();
    $table = self::tableByType($tipo);
    $st    = $pdo->prepare(
      "UPDATE {$table} SET
        nombre=?, usuario=?, password_plain=?, url=?, whatsapp=?,
        fecha_inicio=?, fecha_fin=?, soles=?, estado=?, combo=?
       WHERE id=?"
    );
    return $st->execute([
      (string)($d['nombre'] ?? ''),
      (string)($d['usuario'] ?? ''),
      (string)($d['password_plain'] ?? ''),
      (string)($d['url'] ?? ''),
      ($d['whatsapp'] ?? '') !== '' ? (string)$d['whatsapp'] : null,
      (string)($d['fecha_inicio'] ?? ''),
      (string)($d['fecha_fin'] ?? ''),
      (string)($d['soles'] ?? '0.00'),
      (string)($d['estado'] ?? 'activo'),
      (int)($d['combo'] ?? 0),
      $id,
    ]);
  }

  // borrar
  public static function deleteIn(string $tipo, int $id): bool {
    $pdo   = get_pdo();
    $table = self::tableByType($tipo);
    $st    = $pdo->prepare("DELETE FROM {$table} WHERE id=?");
    return $st->execute([$id]);
  }

  // color
  public static function setColorIn(string $tipo, int $id, ?string $color): bool {
    $pdo   = get_pdo();
    $table = self::tableByType($tipo);
    $st    = $pdo->prepare("UPDATE {$table} SET color=? WHERE id=?");
    return $st->execute([$color ?: null, $id]);
  }

}
