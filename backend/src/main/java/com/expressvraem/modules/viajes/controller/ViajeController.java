package com.expressvraem.modules.viajes.controller;

import com.expressvraem.modules.conductores.entity.Conductor;
import com.expressvraem.modules.conductores.repository.ConductorRepository;
import com.expressvraem.modules.encomiendas.entity.Encomienda;
import com.expressvraem.modules.encomiendas.repository.EncomiendaRepository;
import com.expressvraem.modules.viajes.service.LiquidacionViajeService;
import com.expressvraem.shared.websocket.WebSocketEventPublisher;
import com.expressvraem.modules.viajes.dto.EditarViajeDTO;
import com.expressvraem.modules.viajes.dto.ProgramarViajeDTO;
import com.expressvraem.modules.viajes.dto.ViajeResponseDTO;
import com.expressvraem.modules.viajes.entity.Asiento;
import com.expressvraem.modules.viajes.entity.Viaje;
import com.expressvraem.modules.viajes.repository.AsientoRepository;
import com.expressvraem.modules.viajes.repository.ViajeRepository;
import com.expressvraem.shared.exceptions.ApiResponse;
import com.expressvraem.shared.exceptions.BusinessException;
import com.expressvraem.shared.exceptions.ResourceNotFoundException;
import com.expressvraem.shared.logs.LogService;
import com.expressvraem.shared.middleware.AgenciaContext;
import jakarta.persistence.EntityManager;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;


@RestController
@RequestMapping("/api/viajes")
@RequiredArgsConstructor
public class ViajeController {

    private final ViajeRepository         viajeRepository;
    private final AsientoRepository       asientoRepository;
    private final EncomiendaRepository    encomiendaRepository;
    private final ConductorRepository     conductorRepository;
    private final EntityManager           entityManager;
    private final LogService              logService;
    private final WebSocketEventPublisher wsPublisher;
    private final LiquidacionViajeService liquidacionViajeService;

    /**
     * Programa un nuevo viaje y genera los asientos según la capacidad del vehículo.
     */
    @PostMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE','ADMIN_AGENCIA','OPERADOR')")
    public ResponseEntity<ApiResponse<ViajeResponseDTO>> programar(
            @Valid @RequestBody ProgramarViajeDTO dto, Authentication auth) {

        Long agenciaId = AgenciaContext.getAgenciaId();
        if (agenciaId == null) agenciaId = 1L;

        Object[] vehRow = (Object[]) entityManager
                .createNativeQuery("SELECT id, placa, tipo, num_asientos FROM vehiculos WHERE id = :vid")
                .setParameter("vid", dto.vehiculoId())
                .getSingleResult();

        int numAsientos = ((Number) vehRow[3]).intValue();

        // Validar licencia y conflictos de horario antes de programar
        validarLicenciaConductor(dto.conductorId());
        validarConflictos(dto.vehiculoId(), dto.conductorId(), dto.fechaHoraSal(), -1L);

        Viaje viaje = Viaje.builder()
                .agenciaId(agenciaId)
                .rutaId(dto.rutaId())
                .vehiculoId(dto.vehiculoId())
                .conductorId(dto.conductorId())
                .fechaHoraSal(dto.fechaHoraSal())
                .estado("PROGRAMADO")
                .observaciones(dto.observaciones())
                .createdAt(java.time.OffsetDateTime.now())
                .updatedAt(java.time.OffsetDateTime.now())
                .build();

        viaje = viajeRepository.save(viaje);

        List<Asiento> asientosNuevos = new ArrayList<>(numAsientos);
        for (int i = 1; i <= numAsientos; i++) {
            asientosNuevos.add(Asiento.builder()
                    .agenciaId(agenciaId)
                    .viajeId(viaje.getId())
                    .vehiculoId(dto.vehiculoId())
                    .numero(i)
                    .estado("LIBRE")
                    .build());
        }
        asientoRepository.saveAll(asientosNuevos);

        logService.logOperacion(auth.getName(), "VIAJES", "PROGRAMAR",
                Map.of("viajeId", viaje.getId(), "rutaId", dto.rutaId(), "vehiculoId", dto.vehiculoId()));

        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok("Viaje programado", enrich(viaje)));
    }

    /**
     * Viajes disponibles para venta de pasajes.
     * Retorna viajes PROGRAMADO/EN_RUTA con al menos 1 asiento LIBRE.
     */
    @GetMapping("/disponibles")
    @SuppressWarnings("unchecked")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> disponibles(
            @RequestParam(required = false) String origen,
            @RequestParam(required = false) String destino,
            @RequestParam(required = false) String fecha) {

        Long agenciaId = AgenciaContext.getAgenciaId();
        List<String> estadosActivos = List.of("PROGRAMADO", "EN_RUTA");
        List<Viaje> todos = agenciaId != null
                ? viajeRepository.findByAgenciaIdAndEstadoIn(agenciaId, estadosActivos)
                : viajeRepository.findByEstadoIn(estadosActivos);

        if (todos.isEmpty()) return ResponseEntity.ok(ApiResponse.ok(List.of()));

        LocalDate fechaFiltro = null;
        if (fecha != null && !fecha.isBlank()) {
            try { fechaFiltro = LocalDate.parse(fecha); } catch (Exception ignored) {}
        }
        final LocalDate fechaFinal = fechaFiltro;

        // 1 query para todos los conteos de asientos libres en vez de N queries
        List<Long> ids = todos.stream().map(Viaje::getId).toList();
        Map<Long, Long> libresCnt = new HashMap<>();
        ((List<Object[]>) entityManager.createNativeQuery(
                "SELECT viaje_id, COUNT(*) FROM asientos WHERE viaje_id IN :ids AND estado = 'LIBRE' GROUP BY viaje_id")
                .setParameter("ids", ids).getResultList())
                .forEach(r -> libresCnt.put(((Number) r[0]).longValue(), ((Number) r[1]).longValue()));

        OffsetDateTime limite = OffsetDateTime.now().minusMinutes(30);
        List<Viaje> conLibres = todos.stream()
                .filter(v -> libresCnt.getOrDefault(v.getId(), 0L) > 0)
                // Excluir viajes PROGRAMADO cuya salida fue hace más de 30 min
                .filter(v -> !"PROGRAMADO".equals(v.getEstado())
                        || v.getFechaHoraSal() == null
                        || !v.getFechaHoraSal().isBefore(limite))
                .filter(v -> fechaFinal == null || v.getFechaHoraSal() == null
                        || v.getFechaHoraSal().toLocalDate().equals(fechaFinal))
                .toList();

        List<ViajeResponseDTO> enriched = batchEnrich(conLibres);

        List<Map<String, Object>> resultado = enriched.stream()
                .filter(dto -> origen == null || origen.isBlank() || dto.getRuta() == null
                        || dto.getRuta().getOrigen().toLowerCase().contains(origen.toLowerCase()))
                .filter(dto -> destino == null || destino.isBlank() || dto.getRuta() == null
                        || dto.getRuta().getDestino().toLowerCase().contains(destino.toLowerCase()))
                .map(dto -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id",           dto.getId());
                    m.put("estado",       dto.getEstado());
                    m.put("fechaHoraSal", dto.getFechaHoraSal());
                    m.put("ruta",         dto.getRuta());
                    m.put("vehiculo",     dto.getVehiculo());
                    m.put("asientosLibres", dto.getAsientosLibres());
                    return m;
                }).toList();

        return ResponseEntity.ok(ApiResponse.ok(resultado));
    }

    // ─── Historial de viajes completados/cancelados ────────────────────────────

    @SuppressWarnings("unchecked")
    @GetMapping("/historial")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> historial(
            @RequestParam(required = false) String desde,
            @RequestParam(required = false) String hasta,
            @RequestParam(required = false) String estado,
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "50") int size) {

        Long agenciaId = AgenciaContext.getAgenciaId();
        List<String> estados = (estado != null && !estado.isBlank())
                ? List.of(estado)
                : List.of("COMPLETADO", "CANCELADO");

        List<Viaje> viajes = (agenciaId != null)
                ? viajeRepository.findByAgenciaIdAndEstadoIn(agenciaId, estados)
                : viajeRepository.findByEstadoIn(estados);

        // Filtro por rango de fechas
        if (desde != null && !desde.isBlank()) {
            OffsetDateTime desdeDate = OffsetDateTime.parse(desde + "T00:00:00Z");
            viajes = viajes.stream()
                    .filter(v -> v.getFechaHoraSal() != null && !v.getFechaHoraSal().isBefore(desdeDate))
                    .toList();
        }
        if (hasta != null && !hasta.isBlank()) {
            OffsetDateTime hastaDate = OffsetDateTime.parse(hasta + "T23:59:59Z");
            viajes = viajes.stream()
                    .filter(v -> v.getFechaHoraSal() != null && !v.getFechaHoraSal().isAfter(hastaDate))
                    .toList();
        }

        viajes = viajes.stream()
                .sorted(Comparator.comparing(Viaje::getFechaHoraSal,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();

        if (viajes.isEmpty()) return ResponseEntity.ok(ApiResponse.ok(List.of()));

        // Aplicar paginación
        int fromIdx = Math.min(page * size, viajes.size());
        int toIdx   = Math.min(fromIdx + size, viajes.size());
        viajes = viajes.subList(fromIdx, toIdx);

        List<Long> viajeIds = viajes.stream().map(Viaje::getId).toList();
        List<Long> rutaIds  = viajes.stream().map(Viaje::getRutaId).filter(Objects::nonNull).distinct().toList();
        List<Long> vehIds   = viajes.stream().map(Viaje::getVehiculoId).filter(Objects::nonNull).distinct().toList();
        List<Long> condIds  = viajes.stream().map(Viaje::getConductorId).filter(Objects::nonNull).distinct().toList();

        // Rutas
        Map<Long, Object[]> rutas = new HashMap<>();
        if (!rutaIds.isEmpty())
            ((List<Object[]>) entityManager.createNativeQuery(
                    "SELECT id, origen, destino, distancia_km FROM rutas WHERE id IN :ids")
                    .setParameter("ids", rutaIds).getResultList())
                    .forEach(r -> rutas.put(((Number) r[0]).longValue(), r));

        // Vehículos
        Map<Long, Object[]> vehs = new HashMap<>();
        if (!vehIds.isEmpty())
            ((List<Object[]>) entityManager.createNativeQuery(
                    "SELECT id, placa, tipo, num_asientos FROM vehiculos WHERE id IN :ids")
                    .setParameter("ids", vehIds).getResultList())
                    .forEach(r -> vehs.put(((Number) r[0]).longValue(), r));

        // Conductores
        Map<Long, String> conds = new HashMap<>();
        if (!condIds.isEmpty())
            ((List<Object[]>) entityManager.createNativeQuery(
                    "SELECT id, nombres || ' ' || apellidos FROM usuarios WHERE id IN :ids")
                    .setParameter("ids", condIds).getResultList())
                    .forEach(r -> conds.put(((Number) r[0]).longValue(), String.valueOf(r[1])));

        // Asientos ocupados
        Map<Long, Long> ocupados = new HashMap<>();
        ((List<Object[]>) entityManager.createNativeQuery(
                "SELECT viaje_id, COUNT(*) FROM asientos WHERE viaje_id IN :ids AND estado IN ('OCUPADO','RESERVADO') GROUP BY viaje_id")
                .setParameter("ids", viajeIds).getResultList())
                .forEach(r -> ocupados.put(((Number) r[0]).longValue(), ((Number) r[1]).longValue()));

        // Encomiendas
        Map<Long, Long> encCnt = new HashMap<>();
        ((List<Object[]>) entityManager.createNativeQuery(
                "SELECT viaje_id, COUNT(*) FROM encomiendas WHERE viaje_id IN :ids GROUP BY viaje_id")
                .setParameter("ids", viajeIds).getResultList())
                .forEach(r -> encCnt.put(((Number) r[0]).longValue(), ((Number) r[1]).longValue()));

        // Ingresos de pasajes (excluye anulados)
        Map<Long, java.math.BigDecimal> ingresosPasajes = new HashMap<>();
        ((List<Object[]>) entityManager.createNativeQuery(
                "SELECT viaje_id, COALESCE(SUM(precio_final), 0) FROM pasajes WHERE viaje_id IN :ids AND estado != 'ANULADO' GROUP BY viaje_id")
                .setParameter("ids", viajeIds).getResultList())
                .forEach(r -> ingresosPasajes.put(((Number) r[0]).longValue(),
                        new java.math.BigDecimal(r[1].toString())));

        // Ingresos de encomiendas (excluye devueltas y pago-en-destino)
        Map<Long, java.math.BigDecimal> ingresosEnc = new HashMap<>();
        ((List<Object[]>) entityManager.createNativeQuery(
                "SELECT viaje_id, COALESCE(SUM(precio_envio - COALESCE(monto_descuento,0)), 0) " +
                "FROM encomiendas WHERE viaje_id IN :ids AND estado != 'DEVUELTO' AND forma_cobro != 'POR_COBRAR' GROUP BY viaje_id")
                .setParameter("ids", viajeIds).getResultList())
                .forEach(r -> ingresosEnc.put(((Number) r[0]).longValue(),
                        new java.math.BigDecimal(r[1].toString())));

        List<Map<String, Object>> resultado = viajes.stream().map(v -> {
            Object[] ruta = rutas.get(v.getRutaId());
            Object[] veh  = vehs.get(v.getVehiculoId());

            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id",             v.getId());
            m.put("estado",         v.getEstado());
            m.put("fechaHoraSal",   v.getFechaHoraSal());
            m.put("fechaHoraArr",   v.getFechaHoraArr());
            m.put("observaciones",  v.getObservaciones());
            m.put("conductorNombre", conds.getOrDefault(v.getConductorId(), "—"));

            if (ruta != null) {
                m.put("rutaOrigen",  String.valueOf(ruta[1]));
                m.put("rutaDestino", String.valueOf(ruta[2]));
                m.put("distanciaKm", ruta[3] != null ? ((Number) ruta[3]).doubleValue() : null);
            }
            if (veh != null) {
                m.put("vehiculoPlaca",     String.valueOf(veh[1]));
                m.put("vehiculoTipo",      String.valueOf(veh[2]));
                m.put("vehiculoAsientos",  ((Number) veh[3]).intValue());
            }

            long totalPasajeros  = ocupados.getOrDefault(v.getId(), 0L);
            long totalEncomiendas = encCnt.getOrDefault(v.getId(), 0L);
            java.math.BigDecimal ipas = ingresosPasajes.getOrDefault(v.getId(), java.math.BigDecimal.ZERO);
            java.math.BigDecimal ienc = ingresosEnc.getOrDefault(v.getId(), java.math.BigDecimal.ZERO);

            m.put("totalPasajeros",       totalPasajeros);
            m.put("totalEncomiendas",     totalEncomiendas);
            m.put("ingresosPasajes",      ipas);
            m.put("ingresosEncomiendas",  ienc);
            m.put("totalIngresos",        ipas.add(ienc));

            // Duración en minutos
            if (v.getFechaHoraSal() != null && v.getFechaHoraArr() != null) {
                m.put("duracionMinutos",
                        ChronoUnit.MINUTES.between(v.getFechaHoraSal(), v.getFechaHoraArr()));
            }
            return m;
        }).toList();

        return ResponseEntity.ok(ApiResponse.ok(resultado));
    }

    @GetMapping("/publico")
    public ResponseEntity<ApiResponse<List<ViajeResponseDTO>>> listarPublico(
            @RequestParam(required = false) String origen,
            @RequestParam(required = false) String destino) {
        List<Viaje> todos = viajeRepository.findByEstadoIn(List.of("PROGRAMADO", "EN_RUTA"));
        List<ViajeResponseDTO> dtos = batchEnrich(todos).stream()
                .filter(v -> origen == null || origen.isBlank() ||
                        (v.getRuta() != null && v.getRuta().getOrigen() != null &&
                         v.getRuta().getOrigen().equalsIgnoreCase(origen)))
                .filter(v -> destino == null || destino.isBlank() ||
                        (v.getRuta() != null && v.getRuta().getDestino() != null &&
                         v.getRuta().getDestino().equalsIgnoreCase(destino)))
                .toList();
        return ResponseEntity.ok(ApiResponse.ok(dtos));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<ViajeResponseDTO>>> listar(
            @RequestParam(required = false) String estado) {
        Long agenciaId = AgenciaContext.getAgenciaId();
        List<Viaje> viajes = (agenciaId != null && estado != null)
                ? viajeRepository.findByAgenciaIdAndEstado(agenciaId, estado)
                : (agenciaId != null)
                    ? viajeRepository.findByAgenciaId(agenciaId)
                    : viajeRepository.findAll();

        List<Viaje> sorted = viajes.stream()
                .sorted(Comparator.comparing(Viaje::getFechaHoraSal,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();

        return ResponseEntity.ok(ApiResponse.ok(batchEnrich(sorted)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ViajeResponseDTO>> detalle(@PathVariable Long id) {
        Viaje v = viajeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Viaje", id));
        return ResponseEntity.ok(ApiResponse.ok(enrich(v)));
    }

    /**
     * COSO — Actividades de control: confirmar salida de un viaje.
     * Cambia estado a EN_RUTA y todas sus encomiendas a EN_TRANSITO.
     * Solo SUPERVISOR, GERENTE o ADMIN pueden confirmar.
     */
    @PostMapping("/{id}/confirmar-salida")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE','ADMIN_AGENCIA','OPERADOR')")
    public ResponseEntity<ApiResponse<ViajeResponseDTO>> confirmarSalida(
            @PathVariable Long id, Authentication auth) {
        Viaje viaje = viajeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Viaje", id));

        if (!"PROGRAMADO".equals(viaje.getEstado()) && !"ATRASADO".equals(viaje.getEstado())) {
            throw new BusinessException(
                    "Solo se puede confirmar salida de un viaje PROGRAMADO o ATRASADO. Estado actual: " + viaje.getEstado(),
                    "ESTADO_INVALIDO");
        }

        viaje.setEstado("EN_RUTA");
        viajeRepository.save(viaje);

        // Cambia todas las encomiendas pre-tránsito asignadas a este viaje
        java.util.Set<String> preTransito = java.util.Set.of(
                "REGISTRADO", "RECEPCIONADO", "ALMACENADO", "CARGADO");
        List<Encomienda> encomiendas = encomiendaRepository.findByViajeId(id);
        encomiendas.forEach(enc -> {
            if (preTransito.contains(enc.getEstado())) {
                enc.setEstado("EN_TRANSITO");
                encomiendaRepository.save(enc);
            }
        });

        logService.logOperacion(auth.getName(), "VIAJES", "CONFIRMAR_SALIDA",
                Map.of("viajeId", id, "operador", auth.getName()));

        // Notify each destino agencia that their encomiendas are en camino
        encomiendas.stream()
                .map(Encomienda::getAgenciaDestinoId)
                .filter(java.util.Objects::nonNull)
                .distinct()
                .forEach(agDestId -> wsPublisher.publicarEncomiendaEnCamino(agDestId,
                        Map.of("viajeId", id, "tipo", "EN_CAMINO")));

        return ResponseEntity.ok(ApiResponse.ok("Viaje confirmado — en ruta", enrich(viaje)));
    }

    /**
     * Cancela un viaje PROGRAMADO.
     */
    @PostMapping("/{id}/cancelar")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE','ADMIN_AGENCIA','OPERADOR')")
    public ResponseEntity<ApiResponse<ViajeResponseDTO>> cancelar(
            @PathVariable Long id, Authentication auth) {
        Viaje viaje = viajeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Viaje", id));
        if (!"PROGRAMADO".equals(viaje.getEstado()) && !"ATRASADO".equals(viaje.getEstado())) {
            throw new BusinessException(
                    "Solo se puede cancelar un viaje PROGRAMADO o ATRASADO. Estado actual: " + viaje.getEstado(),
                    "ESTADO_INVALIDO");
        }
        viaje.setEstado("CANCELADO");
        viajeRepository.save(viaje);
        logService.logOperacion(auth.getName(), "VIAJES", "CANCELAR",
                Map.of("viajeId", id, "operador", auth.getName()));
        return ResponseEntity.ok(ApiResponse.ok("Viaje cancelado", enrich(viaje)));
    }

    /**
     * Confirmar llegada: cambia viaje a COMPLETADO y encomiendas EN_TRANSITO a LLEGADO_AGENCIA.
     */
    @PostMapping("/{id}/confirmar-llegada")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE','ADMIN_AGENCIA','OPERADOR')")
    public ResponseEntity<ApiResponse<ViajeResponseDTO>> confirmarLlegada(
            @PathVariable Long id, Authentication auth) {
        Viaje viaje = viajeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Viaje", id));

        if (!"EN_RUTA".equals(viaje.getEstado())) {
            throw new BusinessException(
                    "Solo se puede confirmar llegada de un viaje EN_RUTA. Estado actual: " + viaje.getEstado(),
                    "ESTADO_INVALIDO");
        }

        viaje.setEstado("COMPLETADO");
        viajeRepository.save(viaje);

        encomiendaRepository.findByViajeId(id).forEach(enc -> {
            if ("EN_TRANSITO".equals(enc.getEstado())) {
                enc.setEstado("LLEGADO_AGENCIA");
                encomiendaRepository.save(enc);
            }
        });

        logService.logOperacion(auth.getName(), "VIAJES", "CONFIRMAR_LLEGADA",
                Map.of("viajeId", id, "operador", auth.getName()));

        return ResponseEntity.ok(ApiResponse.ok("Viaje completado — llegada confirmada", enrich(viaje)));
    }

    /**
     * Asientos del viaje con tipo de vehículo para el SeatMap.
     *   COMBI     → 1 conductor + 15 pasajeros
     *   CAMIONETA → 1 conductor + 4 pasajeros
     */
    @GetMapping("/{id}/asientos")
    public ResponseEntity<ApiResponse<Map<String, Object>>> asientos(@PathVariable Long id) {
        Viaje viaje = viajeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Viaje", id));

        List<Asiento> asientos = asientoRepository.findByViajeIdOrderByNumeroAsc(id);

        Object[] vehiculoRow = (Object[]) entityManager
                .createNativeQuery("SELECT tipo, num_asientos FROM vehiculos WHERE id = :vid")
                .setParameter("vid", viaje.getVehiculoId())
                .getSingleResult();

        String tipoVehiculo = String.valueOf(vehiculoRow[0]);
        int    numAsientos  = ((Number) vehiculoRow[1]).intValue();
        int    pasajeros    = numAsientos - 1;

        return ResponseEntity.ok(ApiResponse.ok(Map.of(
                "tipoVehiculo", tipoVehiculo,
                "totalAsientos", numAsientos,
                "capacidadPasajeros", pasajeros,
                "asientos", asientos
        )));
    }

    /**
     * Editar un viaje PROGRAMADO: conductor, fecha/hora, observaciones.
     * El vehículo solo se puede cambiar si no hay asientos vendidos.
     */
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE','ADMIN_AGENCIA','OPERADOR')")
    public ResponseEntity<ApiResponse<ViajeResponseDTO>> editar(
            @PathVariable Long id,
            @Valid @RequestBody EditarViajeDTO dto,
            Authentication auth) {
        Viaje viaje = viajeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Viaje", id));

        if (!"PROGRAMADO".equals(viaje.getEstado()) && !"ATRASADO".equals(viaje.getEstado())) {
            throw new BusinessException(
                    "Solo se puede editar un viaje PROGRAMADO o ATRASADO. Estado actual: " + viaje.getEstado(),
                    "ESTADO_INVALIDO");
        }

        // Validar cambio de vehículo solo si no hay ventas; si ok, recrear asientos
        boolean cambiaVehiculo = dto.vehiculoId() != null && !dto.vehiculoId().equals(viaje.getVehiculoId());
        if (cambiaVehiculo) {
            long vendidos = asientoRepository.countByViajeIdAndEstado(viaje.getId(), "OCUPADO")
                          + asientoRepository.countByViajeIdAndEstado(viaje.getId(), "RESERVADO");
            if (vendidos > 0) {
                throw new BusinessException(
                        "No se puede cambiar el vehículo porque ya hay " + vendidos + " pasajes vendidos.",
                        "VEHICULO_CON_VENTAS");
            }
        }

        // Validar licencia y conflictos de horario con el nuevo conductor/vehículo
        validarLicenciaConductor(dto.conductorId());
        Long vehId = dto.vehiculoId() != null ? dto.vehiculoId() : viaje.getVehiculoId();
        validarConflictos(vehId, dto.conductorId(), dto.fechaHoraSal(), id);

        viaje.setConductorId(dto.conductorId());
        viaje.setFechaHoraSal(dto.fechaHoraSal());
        viaje.setObservaciones(dto.observaciones());
        if (cambiaVehiculo) {
            // Eliminar asientos del vehículo anterior y generar los del nuevo
            asientoRepository.deleteByViajeId(viaje.getId());

            Object[] newVehRow = (Object[]) entityManager
                    .createNativeQuery("SELECT num_asientos FROM vehiculos WHERE id = :vid")
                    .setParameter("vid", dto.vehiculoId())
                    .getSingleResult();
            int nuevosAsientos = ((Number) newVehRow[0]).intValue();

            Long agId = AgenciaContext.getAgenciaId() != null ? AgenciaContext.getAgenciaId() : viaje.getAgenciaId();
            List<Asiento> lista = new ArrayList<>(nuevosAsientos);
            for (int i = 1; i <= nuevosAsientos; i++) {
                lista.add(Asiento.builder()
                        .agenciaId(agId)
                        .viajeId(viaje.getId())
                        .vehiculoId(dto.vehiculoId())
                        .numero(i)
                        .estado("LIBRE")
                        .build());
            }
            asientoRepository.saveAll(lista);

            viaje.setVehiculoId(dto.vehiculoId());
        }
        viaje.setUpdatedAt(OffsetDateTime.now());
        viajeRepository.save(viaje);

        logService.logOperacion(auth.getName(), "VIAJES", "EDITAR",
                Map.of("viajeId", id, "conductorId", dto.conductorId()));

        return ResponseEntity.ok(ApiResponse.ok("Viaje actualizado", enrich(viaje)));
    }

    /** Bloquea si la licencia del conductor está vencida o si el conductor no existe. */
    private void validarLicenciaConductor(Long conductorId) {
        Conductor c = conductorRepository.findById(conductorId)
                .orElseThrow(() -> new BusinessException(
                        "Conductor no encontrado (id=" + conductorId + ")", "CONDUCTOR_NO_ENCONTRADO"));
        if (!c.isActivo()) {
            throw new BusinessException(
                    "El conductor " + c.getNombres() + " " + c.getApellidos() + " está inactivo.",
                    "CONDUCTOR_INACTIVO");
        }
        if (c.getFechaVencLic() != null && c.getFechaVencLic().isBefore(LocalDate.now())) {
            throw new BusinessException(
                    "La licencia del conductor " + c.getNombres() + " " + c.getApellidos()
                    + " venció el " + c.getFechaVencLic() + ". Renuévela antes de asignarlo a un viaje.",
                    "LICENCIA_VENCIDA");
        }
    }

    /** Verifica que el vehículo y el conductor no tengan otro viaje a ±4 horas. */
    private void validarConflictos(Long vehiculoId, Long conductorId,
                                   OffsetDateTime fechaHoraSal, Long excludeId) {
        List<String> activos = List.of("PROGRAMADO", "EN_RUTA", "ATRASADO");
        List<Viaje> candidatos = viajeRepository.findByEstadoIn(activos).stream()
                .filter(v -> !v.getId().equals(excludeId))
                .filter(v -> v.getVehiculoId().equals(vehiculoId) || v.getConductorId().equals(conductorId))
                .filter(v -> v.getFechaHoraSal() != null
                        && Math.abs(ChronoUnit.HOURS.between(v.getFechaHoraSal(), fechaHoraSal)) < 4)
                .toList();

        if (!candidatos.isEmpty()) {
            Viaje c = candidatos.get(0);
            boolean esVeh = c.getVehiculoId().equals(vehiculoId);
            throw new BusinessException(
                    (esVeh ? "El vehículo" : "El conductor")
                    + " ya tiene un viaje programado cerca de ese horario (±4h). Viaje #" + c.getId(),
                    "CONFLICTO_HORARIO");
        }
    }

    @SuppressWarnings("unchecked")
    private List<ViajeResponseDTO> batchEnrich(List<Viaje> viajes) {
        if (viajes.isEmpty()) return List.of();

        List<Long> rutaIds  = viajes.stream().map(Viaje::getRutaId).filter(Objects::nonNull).distinct().toList();
        List<Long> vehIds   = viajes.stream().map(Viaje::getVehiculoId).filter(Objects::nonNull).distinct().toList();
        List<Long> condIds  = viajes.stream().map(Viaje::getConductorId).filter(Objects::nonNull).distinct().toList();
        List<Long> viajeIds = viajes.stream().map(Viaje::getId).toList();

        Map<Long, Object[]> rutas = new HashMap<>();
        if (!rutaIds.isEmpty())
            ((List<Object[]>) entityManager.createNativeQuery(
                    "SELECT id, origen, destino, distancia_km FROM rutas WHERE id IN :ids")
                    .setParameter("ids", rutaIds).getResultList())
                    .forEach(r -> rutas.put(((Number) r[0]).longValue(), r));

        Map<Long, Object[]> vehs = new HashMap<>();
        if (!vehIds.isEmpty())
            ((List<Object[]>) entityManager.createNativeQuery(
                    "SELECT id, placa, tipo, num_asientos FROM vehiculos WHERE id IN :ids")
                    .setParameter("ids", vehIds).getResultList())
                    .forEach(r -> vehs.put(((Number) r[0]).longValue(), r));

        Map<Long, String> conds = new HashMap<>();
        if (!condIds.isEmpty())
            ((List<Object[]>) entityManager.createNativeQuery(
                    "SELECT id, nombres || ' ' || apellidos FROM usuarios WHERE id IN :ids")
                    .setParameter("ids", condIds).getResultList())
                    .forEach(r -> conds.put(((Number) r[0]).longValue(), String.valueOf(r[1])));

        Map<Long, long[]> asientosCnt = new HashMap<>();
        ((List<Object[]>) entityManager.createNativeQuery(
                "SELECT viaje_id, " +
                "COUNT(*) FILTER (WHERE estado = 'LIBRE'), " +
                "COUNT(*) FILTER (WHERE estado IN ('OCUPADO','RESERVADO')) " +
                "FROM asientos WHERE viaje_id IN :ids GROUP BY viaje_id")
                .setParameter("ids", viajeIds).getResultList())
                .forEach(r -> asientosCnt.put(((Number) r[0]).longValue(),
                        new long[]{((Number) r[1]).longValue(), ((Number) r[2]).longValue()}));

        Map<Long, Long> encCnt = new HashMap<>();
        ((List<Object[]>) entityManager.createNativeQuery(
                "SELECT viaje_id, COUNT(*) FROM encomiendas WHERE viaje_id IN :ids GROUP BY viaje_id")
                .setParameter("ids", viajeIds).getResultList())
                .forEach(r -> encCnt.put(((Number) r[0]).longValue(), ((Number) r[1]).longValue()));

        return viajes.stream().map(v -> {
            Object[] ruta = rutas.get(v.getRutaId());
            Object[] veh  = vehs.get(v.getVehiculoId());
            if (ruta == null || veh == null) return null;

            ViajeResponseDTO dto = ViajeResponseDTO.from(v,
                    String.valueOf(ruta[1]), String.valueOf(ruta[2]),
                    ruta[3] != null ? ((Number) ruta[3]).doubleValue() : null,
                    ((Number) ruta[0]).longValue(),
                    String.valueOf(veh[1]), String.valueOf(veh[2]),
                    ((Number) veh[3]).intValue(), ((Number) veh[0]).longValue());

            dto.setConductorId(v.getConductorId());
            dto.setConductorNombre(conds.getOrDefault(v.getConductorId(), "—"));

            long[] cnt = asientosCnt.getOrDefault(v.getId(), new long[]{0L, 0L});
            dto.setAsientosLibres(cnt[0]);
            dto.setAsientosOcupados(cnt[1]);
            dto.setCantEncomiendas(encCnt.getOrDefault(v.getId(), 0L));
            return dto;
        }).filter(Objects::nonNull).toList();
    }

    /**
     * PDF de liquidación: lista de pasajeros + encomiendas + totales de un viaje.
     */
    @GetMapping(value = "/{id}/liquidacion-pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE','ADMIN_AGENCIA','OPERADOR')")
    public ResponseEntity<byte[]> liquidacionPdf(@PathVariable Long id) {
        byte[] pdf = liquidacionViajeService.generarLiquidacion(id);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=\"liquidacion-viaje-" + id + ".pdf\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    private ViajeResponseDTO enrich(Viaje v) {
        Object[] rutaRow = (Object[]) entityManager
                .createNativeQuery("SELECT id, origen, destino, distancia_km FROM rutas WHERE id = :rid")
                .setParameter("rid", v.getRutaId()).getSingleResult();

        Object[] vehRow = (Object[]) entityManager
                .createNativeQuery("SELECT id, placa, tipo, num_asientos FROM vehiculos WHERE id = :vid")
                .setParameter("vid", v.getVehiculoId()).getSingleResult();

        ViajeResponseDTO dto = ViajeResponseDTO.from(v,
                String.valueOf(rutaRow[1]), String.valueOf(rutaRow[2]),
                rutaRow[3] != null ? ((Number) rutaRow[3]).doubleValue() : null,
                ((Number) rutaRow[0]).longValue(),
                String.valueOf(vehRow[1]), String.valueOf(vehRow[2]),
                ((Number) vehRow[3]).intValue(), ((Number) vehRow[0]).longValue());

        dto.setConductorId(v.getConductorId());
        try {
            Object[] condRow = (Object[]) entityManager
                    .createNativeQuery("SELECT nombres, apellidos FROM usuarios WHERE id = :cid")
                    .setParameter("cid", v.getConductorId()).getSingleResult();
            dto.setConductorNombre(condRow[0] + " " + condRow[1]);
        } catch (Exception ignored) {
            dto.setConductorNombre("—");
        }

        long libres   = asientoRepository.countByViajeIdAndEstado(v.getId(), "LIBRE");
        long ocupados = asientoRepository.countByViajeIdAndEstado(v.getId(), "OCUPADO")
                      + asientoRepository.countByViajeIdAndEstado(v.getId(), "RESERVADO");
        dto.setAsientosLibres(libres);
        dto.setAsientosOcupados(ocupados);
        dto.setCantEncomiendas(encomiendaRepository.countByViajeId(v.getId()));
        return dto;
    }
}
