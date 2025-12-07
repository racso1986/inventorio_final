<?php
/**
 * includes/iptv_table_block.php
 *
 * Espera:
 *   - $__rows : array de filas (cada una con las claves usadas abajo)
 *   - $__tipo : 'perfil' | 'cuenta'  (opcional, default 'cuenta') para el <form> delete
 *
 * Requiere que en el padre existan:
 *   - helpers: estado_badge_class(), row_json_attr(), format_cliente_num()
 *   - $hoy (string 'Y-m-d'); si no existe, se calcula aquí.
 */
$__tipo = isset($__tipo) && $__tipo === 'perfil' ? 'perfil' : 'cuenta';
$hoy = isset($hoy) ? $hoy : date('Y-m-d');
?>
<div class="table-responsive">
  <table class="table align-middle table-bordered table-compact">
    <thead>
      <tr data-soles="<?= htmlspecialchars($soles, ENT_QUOTES, 'UTF-8') ?>">
        <th>Nombre</th>
        <th>Correo</th>
        <th>Contraseña</th>
        <th>URL</th>
        <th>Inicio</th>
        <th>Fin</th>
        <th>Días</th>
        <th>Cliente</th>
        <th>Precio</th>
        <th>Combo</th>
        <th>Estado</th>
        <th>Entrega</th>
        <th>Acciones</th>
      </tr>
    </thead>
    <tbody>
<?php
  $lastCorreo = null;
  foreach ($__rows as $p):
    // Campos base
    $id            = (int)($p['id'] ?? 0);
    $nombre        = trim((string)($p['nombre'] ?? ''));
    $usuario       = (string)($p['usuario'] ?? '');
    $password      = (string)($p['password_plain'] ?? '');
    $url_raw       = trim((string)($p['url'] ?? ''));
    $wa_raw        = (string)($p['whatsapp'] ?? '');
    $fecha_inicio  = (string)($p['fecha_inicio'] ?? '');
    $fecha_fin     = (string)($p['fecha_fin'] ?? '');
    $soles         = (string)($p['soles'] ?? '0.00');
    $estado        = (string)($p['estado'] ?? 'activo');
    $combo         = (int)($p['combo'] ?? 0);

    // URL clickeable
    $url_href = $url_raw;
    if ($url_href !== '' && !preg_match('#^https?://#i', $url_href)) {
      $url_href = 'https://' . $url_href;
    }

    // Visual
    $nombre_ui = ($nombre !== '' ? $nombre : '(sin nombre)');

    // Fechas
    $fi_ok  = ($fecha_inicio && $fecha_inicio !== '0000-00-00');
    $ff_ok  = ($fecha_fin    && $fecha_fin    !== '0000-00-00');
    $fi_fmt = $fi_ok ? date('d/m/y', strtotime($fecha_inicio)) : '';
    $ff_fmt = $ff_ok ? date('d/m/y', strtotime($fecha_fin))    : '';

    // Días restantes
    $dias = $ff_ok ? (int) floor((strtotime($fecha_fin) - strtotime($hoy)) / 86400) : null;
    $estadoReal = ($ff_ok && $dias < 0) ? 'moroso' : $estado;
    $badgeClass = estado_badge_class($estadoReal);
    $comboLabel = $combo === 1 ? 'Sí' : 'No';

    // Normaliza número
    $__wa = preg_replace('/\s+/', '', $wa_raw);
    $__wa = preg_replace('/(?!^)\+/', '', $__wa);
    $__wa = preg_replace('/[^\d\+]/', '', $__wa);
    if ($__wa === '+') $__wa = '';

    $wa_num          = ltrim($__wa, '+'); // para wa.me
    $tg_phone        = ($__wa !== '' && $__wa[0] === '+') ? $__wa : ($__wa !== '' ? ('+' . $__wa) : '');
    $cliente_display = format_cliente_num($__wa, $wa_num);

    // Color de fila
    $__color      = isset($p['color']) ? strtolower((string)$p['color']) : '';
    $__allowedCol = ['rojo','azul','verde','blanco'];
    $__color      = in_array($__color, $__allowedCol, true) ? $__color : '';
    $__colorClass = $__color ? ' row-color-'.htmlspecialchars($__color, ENT_QUOTES, 'UTF-8') : '';

    // Agrupación visual por usuario
    $showCorreo = ($usuario !== $lastCorreo);

    // Payload para modal
    $rowIptv = [
      'id'             => $id,
      'nombre'         => $nombre,
      'usuario'        => $usuario,
      'password_plain' => $password,
      'url'            => (string)$p['url'],
      'whatsapp'       => $wa_raw,
      'fecha_inicio'   => $fecha_inicio,
      'fecha_fin'      => $fecha_fin,
      'soles'          => $soles,
      'estado'         => $estado,
      'combo'          => $combo,
    ];

    // Mensaje para WhatsApp/Telegram
    $lines = ['Le hacemos la entrega de su IPTV'];
    if ($nombre_ui !== '') { $lines[] = "Nombre: {$nombre_ui}"; }
    $lines[] = "Usuario: {$usuario}";
    $lines[] = "Contraseña: {$password}";
    if ($url_raw !== '') { $lines[] = "URL: {$url_raw}"; }
    $lines[] = "Nota: no compartir su acceso, por favor.";
    $iptv_msg = rawurlencode(implode("\n", $lines));
?>
<tr class="<?= trim(($showCorreo ? 'js-parent-row cursor-pointer' : '') . $__colorClass) ?>"
  <?php if ($showCorreo): ?>
    data-id="<?= $id ?>"
    data-entidad="iptv"
    data-correo="<?= htmlspecialchars($usuario, ENT_QUOTES) ?>"
    data-password="<?= htmlspecialchars($password, ENT_QUOTES) ?>"
    data-soles="<?= htmlspecialchars($soles, ENT_QUOTES) ?>"
    data-plan="<?= htmlspecialchars($nombre_ui, ENT_QUOTES) ?>"
    data-combo="<?= (int)$combo ?>"
    <?= $__color ? 'data-color="'.htmlspecialchars($__color, ENT_QUOTES, 'UTF-8').'"' : '' ?>
    role="button" tabindex="0"
  <?php endif; ?>>

  <!-- 1) NOMBRE -->
  <td class="plan-cell-perfil" data-id="<?= $id ?>" role="button" tabindex="0">
    <?= $showCorreo ? htmlspecialchars($nombre_ui) : '' ?>
  </td>

  <!-- 2) CORREO (usuario) -->
  <td class="correo-cell"><?= $showCorreo ? htmlspecialchars($usuario) : '' ?></td>

  <!-- 3) CONTRASEÑA -->
  <td><?= htmlspecialchars($password) ?></td>

  <!-- 4) URL -->
  <td class="text-truncate">
    <?php if ($url_raw !== ''): ?>
      <a href="<?= htmlspecialchars($url_href, ENT_QUOTES) ?>" target="_blank" rel="noopener">
        <?= htmlspecialchars($url_raw, ENT_QUOTES) ?>
      </a>
    <?php endif; ?>
  </td>

  <!-- 5) INICIO -->
  <td><?= $fi_fmt ?></td>

  <!-- 6) FIN -->
  <td><?= $ff_fmt ?></td>

  <!-- 7) DÍAS -->
  <td>
    <?php if ($dias === null): ?>
      <!-- vacío -->
    <?php elseif ($dias < 0): ?>
      <span class="text-danger"><?= $dias ?></span>
    <?php else: ?>
      <?= $dias ?>
    <?php endif; ?>
  </td>

  <!-- 8) CLIENTE -->
  <td class="cliente text-nowrap"><?= htmlspecialchars($cliente_display) ?></td>

  <!-- 9) PRECIO -->
  <td><?= number_format((float)$soles, 2) ?></td>

  <!-- 10) COMBO -->
  <td><?= $comboLabel ?></td>

  <!-- 11) ESTADO -->
  <td><span class="badge <?= $badgeClass ?> text-capitalize"><?= htmlspecialchars($estadoReal) ?></span></td>

  <!-- 12) ENTREGA -->
  <td class="whatsapp">
    <?php if ($wa_num !== ''): ?>
      <a class="iptv-wa-link js-row-action"
         data-scope="iptv" data-no-row-modal="1"
         onclick="event.stopPropagation();"
         href="https://www.wa.me/<?= htmlspecialchars($wa_num, ENT_QUOTES) ?>?text=<?= $iptv_msg ?>"
         target="_blank" rel="noopener"
         aria-label="WhatsApp" title="WhatsApp">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
             fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M13.601 2.326A7.854 7.854 0 0 0 8.03.002C3.6.002.008 3.594.008 8.023c0 1.414.37 2.792 1.074 4.005L.01 16l3.996-1.05a7.96 7.96 0 0 0 4.024 1.073h.003c4.43 0 8.022-3.592 8.022-8.021 0-2.144-.835-4.162-2.354-5.676zM8.033 14.5h-.002a6.48 6.48 0 0 1-3.302-.905l-.237-.141-2.371.623.633-2.31-.154-.237A6.47 6.47 0 0 1 1.53 8.02c0-3.575 2.91-6.485 6.5-6.485 1.738 0 3.37.676 4.598 1.901a6.46 6.46 0 0 1 1.907 4.585c0 3.575-2.91 6.48-6.5 6.48zm3.69-4.844c-.202-.1-1.194-.59-1.378-.657-.184-.068-.318-.101-.452.1-.134.201-.518.657-.635.792-.117.134-.234.151-.436.05-.202-.1-.853-.314-1.625-1.002-.6-.533-1.005-1.19-1.123-1.392-.117-.201-.013-.31.088-.41.09-.089.202-.234.302-.351.101-.117.134-.201.202-.335.067-.134.034-.251-.017-.351-.05-.1-.452-1.09-.619-1.49-.163-.392-.329-.339-.452-.345l-.386-.007c-.118 0-.31.045-.471.224-.16.177-.618.604-.618 1.475s.633 1.71.72 1.83c.084.118 1.245 1.9 3.016 2.665.422.182.75.29 1.006.371.422.134.807.115 1.11.069.339-.05 1.194-.488 1.363-.96.168-.472.168-.877.118-.964-.05-.084-.184-.134-.386-.234z"/>
        </svg>
      </a>
    <?php endif; ?>
    <?php if ($tg_phone !== '' && $tg_phone !== '+'): ?>
      <a class="ms-2 iptv-tg-link js-row-action"
         data-scope="iptv" data-no-row-modal="1"
         onclick="event.stopPropagation();"
         href="https://t.me/share/url?url=&text=<?= $iptv_msg ?>"
         target="_blank" rel="noopener"
         aria-label="Telegram" title="Telegram">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
             fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M15.953 1.737a1.01 1.01 0 0 0-1.04-.2L1.253 6.78c-.86.33-.854 1.54.01 1.86l3.17 1.18 1.24 3.98c.24.77 1.2.99 1.76.41l2.12-2.18 3.54 2.62c.73.54 1.79.14 1.98-.75l2.34-11.02a1.02 1.02 0 0 0-.46-1.18zM6.26 10.71l-.2 2.35 1.53-1.56 3.56-5.62-4.89 4.83z"/>
        </svg>
      </a>
    <?php endif; ?>
  </td>

  <!-- 13) ACCIONES -->
  <td class="text-nowrap">
    <button type="button"
            class="btn btn-sm btn-primary btn-edit-perfil js-row-action"
            data-bs-toggle="modal"
            data-bs-target="#modalEditarIptv"
            data-row='<?= row_json_attr($rowIptv) ?>'>Editar</button>
    <form action="../app/controllers/IptvController.php" method="post" class="d-inline">
      <input type="hidden" name="action" value="delete">
      <input type="hidden" name="id" value="<?= $id ?>">
      <input type="hidden" name="tipo" value="<?= $__tipo ?>">
      <button type="submit" class="btn btn-sm btn-outline-danger js-row-action">Borrar</button>
    </form>
  </td>
</tr>
<?php
    $lastCorreo = $usuario;
  endforeach;
?>
    </tbody>
  </table>
</div>
