# Prueba E2E de los loops (18 jul): numeración por agencia + agencia de trabajo del gerente
$ErrorActionPreference = 'Stop'
$base = 'http://localhost:8080'

$login = Invoke-RestMethod -Method Post -Uri "$base/api/auth/login" -ContentType 'application/json' `
  -Body '{"email":"kevin.sandoval@quinuapata.com","password":"Quinuapata2026!"}'
$tok = $login.data.token; if (-not $tok) { $tok = $login.token }
$h = @{ Authorization = "Bearer $tok" }

# Caja del gerente trabajando en agencia 2 (Kimbiri en dev)
try {
  $abrir = Invoke-RestMethod -Method Post -Uri "$base/api/caja/abrir" -Headers $h -ContentType 'application/json' `
    -Body '{"montoInicial":50,"agenciaId":2}'
  Write-Output "CAJA: id=$($abrir.data.id) agencia=$($abrir.data.agenciaId)"
} catch { Write-Output "CAJA: $($_.ErrorDetails.Message)" }

# Datos para programar un viaje
$rutas = Invoke-RestMethod -Uri "$base/api/rutas" -Headers $h
$rutaId = $rutas.data[0].id
$vehs = Invoke-RestMethod -Uri "$base/api/configuracion/vehiculos" -Headers $h
$vehId = ($vehs.data | Where-Object { $_.estado -eq 'DISPONIBLE' -or $true } | Select-Object -First 1).id
$conds = Invoke-RestMethod -Uri "$base/api/conductor/lista" -Headers $h
$condId = $conds.data[0].id
Write-Output "DATOS: ruta=$rutaId veh=$vehId cond=$condId"

$sal = (Get-Date).AddHours(3).ToString('yyyy-MM-ddTHH:mm:00') + '-05:00'
$viajeBody = @{ rutaId = $rutaId; vehiculoId = $vehId; conductorId = $condId; fechaHoraSal = $sal } | ConvertTo-Json
$viaje = Invoke-RestMethod -Method Post -Uri "$base/api/viajes" -Headers $h -ContentType 'application/json' -Body $viajeBody
$viajeId = $viaje.data.id
Write-Output "VIAJE: id=$viajeId"

# Vender 1 pasaje: debe salir con numeración nueva VTA-{COD_AGENCIA}-2026-00001
$ventaBody = @{
  viajeId = $viajeId; asientoNumero = 1
  clienteDni = '45671234'; clienteNombres = 'Prueba'; clienteApellidos = 'Loops Numeracion'
  clienteTelefono = '966998877'; precioBase = 30.00; descuento = 0.00
  formaPago = 'EFECTIVO'; tipo = 'VENTA'
} | ConvertTo-Json
$venta = Invoke-RestMethod -Method Post -Uri "$base/api/pasajes/vender" -Headers $h -ContentType 'application/json' -Body $ventaBody
Write-Output "BOLETA: $($venta.data.codigoBoleta) agenciaId=$($venta.data.agenciaId)"

# Limpieza: anular pasaje y cerrar caja
try {
  Invoke-RestMethod -Method Post -Uri "$base/api/pasajes/$($venta.data.id)/anular" -Headers $h -ContentType 'application/json' `
    -Body '{"motivo":"prueba tecnica de numeracion"}' | Out-Null
  Write-Output "PASAJE ANULADO"
} catch { Write-Output "ANULAR: $($_.ErrorDetails.Message)" }
try {
  Invoke-RestMethod -Method Delete -Uri "$base/api/viajes/$viajeId" -Headers $h | Out-Null
  Write-Output "VIAJE ELIMINADO"
} catch { Write-Output "VIAJE (queda PROGRAMADO id=$viajeId): sin DELETE, ok" }
$cerrar = Invoke-RestMethod -Method Post -Uri "$base/api/caja/cerrar" -Headers $h -ContentType 'application/json' -Body '{"montoFisico":50}'
Write-Output "CAJA CERRADA: diferencia=$($cerrar.data.diferencia)"
