<?php
// public/test_perfil.php
require_once __DIR__ . '/../config/db.php'; // ajusta ruta
$pdo = get_pdo();

// Solo para probar: tomo el primer streaming existente
$streaming = $pdo->query("SELECT id, nombre FROM streamings ORDER BY id ASC LIMIT 1")->fetch(PDO::FETCH_ASSOC);
$streaming_id = $streaming ? (int)$streaming['id'] : 0;
?>
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Test agregar perfil</title>
  <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
</head>
<body>
<h1>Test agregar perfil</h1>

<?php if (!$streaming_id): ?>
<p>No hay streamings en la base de datos.</p>
<?php else: ?>
<form id="formPerfil">
  <input type="hidden" name="action" value="create">
  <input type="hidden" name="streaming_id" value="<?php echo htmlspecialchars($streaming_id); ?>">

  <div>
    <label>Correo</label>
    <input type="email" name="correo" required>
  </div>

  <div>
    <label>Plan</label>
    <input type="text" name="plan" required>
  </div>

  <div>
    <label>Password</label>
    <input type="text" name="password_plain">
  </div>

  <div>
    <label>Fecha inicio</label>
    <input type="date" name="fecha_inicio">
  </div>

  <div>
    <label>Fecha fin</label>
    <input type="date" name="fecha_fin">
  </div>

  <div>
    <label>WhatsApp</label>
    <input type="text" name="whatsapp">
  </div>

  <div>
    <label>Perfil (nombre)</label>
    <input type="text" name="perfil">
  </div>

  <div>
    <label>Combo</label>
    <input type="number" name="combo" value="0">
  </div>

  <div>
    <label>Soles</label>
    <input type="number" step="0.01" name="soles" value="0">
  </div>

  <div>
    <label>Estado</label>
    <input type="text" name="estado" value="activo">
  </div>

  <div>
    <label>Color</label>
    <input type="text" name="color" value="">
  </div>

  <div>
    <label>Dispositivo</label>
    <input type="text" name="dispositivo" value="">
  </div>

  <button type="submit">Guardar perfil</button>
</form>
<?php endif; ?>

<script>
document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('formPerfil');
  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    const actionUrl = 'ajax/perfil_save.php'; // ojo: relativo a /public/test_perfil.php
    const formData = new FormData(form);

    fetch(actionUrl, {
      method: 'POST',
      body: formData
    })
    .then(function (response) {
      return response.json();
    })
    .then(function (data) {
      console.log('RESP JSON', data); // para inspección
      if (data.ok) {
        Swal.fire({
          icon: 'success',
          title: 'OK',
          text: data.message || 'Perfil guardado correctamente'
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: data.error || 'No se pudo guardar el perfil'
        });
      }
    })
    .catch(function (err) {
      console.error(err);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error de servidor al guardar el perfil'
      });
    });
  });
});
</script>
</body>
</html>
