package com.expressvraem.modules.conductores.controller;

import com.expressvraem.modules.auth.entity.Usuario;
import com.expressvraem.modules.auth.repository.UsuarioRepository;
import com.expressvraem.modules.conductores.entity.Conductor;
import com.expressvraem.modules.conductores.repository.ConductorRepository;
import com.expressvraem.modules.viajes.entity.Viaje;
import com.expressvraem.modules.viajes.repository.AsientoRepository;
import com.expressvraem.modules.viajes.repository.ViajeRepository;
import com.expressvraem.shared.exceptions.ApiResponse;
import com.expressvraem.shared.exceptions.BusinessException;
import com.expressvraem.shared.exceptions.ResourceNotFoundException;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@RestController
@RequestMapping("/api/conductor")
@RequiredArgsConstructor
public class ConductorQueryController {

    private final ConductorRepository conductorRepository;
    private final ViajeRepository     viajeRepository;
    private final AsientoRepository   asientoRepository;
    private final UsuarioRepository   usuarioRepository;
    private final EntityManager       entityManager;
    private final com.expressvraem.modules.encomiendas.repository.EncomiendaRepository encomiendaRepository;
    private final com.expressvraem.shared.websocket.WebSocketEventPublisher wsPublisher;
    private final com.expressvraem.modules.empresa.service.EmpresaConfigService empresaConfigService;

    // ── Lista de conductores para selects ────────────────────────────────────

    @GetMapping("/lista")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE','ADMIN_AGENCIA','OPERADOR','CONDUCTOR')")
    public ResponseEntity<ApiResponse<List<Conductor>>> listar() {
        // Los conductores trabajan para toda la empresa: lista completa para cualquier agencia
        return ResponseEntity.ok(ApiResponse.ok(conductorRepository.findByActivo(true)));
    }

    // ── Mi perfil de conductor (alerta de licencia en el panel) ──────────────

    @GetMapping("/mi-perfil")
    @PreAuthorize("hasAnyRole('CONDUCTOR','SUPER_ADMIN','GERENTE','ADMIN_AGENCIA','OPERADOR')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> miPerfil(Authentication auth) {
        Conductor c = resolverConductor(auth);
        Map<String, Object> m = new LinkedHashMap<>();
        if (c == null) {
            m.put("tieneFicha", false);
            return ResponseEntity.ok(ApiResponse.ok(m));
        }
        m.put("tieneFicha",   true);
        m.put("nombres",      c.getNombres());
        m.put("apellidos",    c.getApellidos());
        m.put("licencia",     c.getLicencia());
        m.put("categoriaLic", c.getCategoriaLic());
        m.put("fechaVencLic", c.getFechaVencLic());
        // Solo se avisa: el conductor puede seguir operando con licencia vencida
        if (c.getFechaVencLic() != null) {
            long dias = java.time.temporal.ChronoUnit.DAYS.between(
                    java.time.LocalDate.now(), c.getFechaVencLic());
            m.put("diasVencLic", dias);
            m.put("alertaLicencia", dias < 0 ? "VENCIDA" : dias <= 30 ? "PROXIMA_A_VENCER" : "VIGENTE");
        } else {
            m.put("diasVencLic", null);
            m.put("alertaLicencia", "SIN_FECHA");
        }
        return ResponseEntity.ok(ApiResponse.ok(m));
    }

    // ── Mis viajes (uso exclusivo del CONDUCTOR autenticado) ─────────────────

    @GetMapping("/mis-viajes")
    @PreAuthorize("hasAnyRole('CONDUCTOR','SUPER_ADMIN','GERENTE','ADMIN_AGENCIA','OPERADOR')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> misViajes(Authentication auth) {
        Conductor conductor = resolverConductor(auth);
        if (conductor == null) {
            // Sin ficha de conductor no hay viajes propios: lista vacía (no es un error)
            return ResponseEntity.ok(ApiResponse.ok(List.of()));
        }
        Long conductorId = conductor.getId();

        List<String> estadosActivos = List.of("PROGRAMADO", "EN_RUTA", "ATRASADO");
        List<Viaje> viajes = viajeRepository
                .findByEstadoInAndConductorId(estadosActivos, conductorId).stream()
                .sorted(java.util.Comparator.comparing(Viaje::getFechaHoraSal,
                        java.util.Comparator.nullsLast(java.util.Comparator.naturalOrder())))
                .toList();

        List<Map<String, Object>> resultado = viajes.stream()
                .map(v -> enriquecerViaje(v))
                .filter(Objects::nonNull)
                .toList();

        return ResponseEntity.ok(ApiResponse.ok(resultado));
    }

    @GetMapping("/mis-viajes/{viajeId}/pasajeros")
    @PreAuthorize("hasAnyRole('CONDUCTOR','SUPER_ADMIN','GERENTE','ADMIN_AGENCIA','OPERADOR')")
    @SuppressWarnings("unchecked")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> pasajeros(
            @PathVariable Long viajeId, Authentication auth) {
        Long conductorId = resolverConductorId(auth);
        Viaje viaje = viajeRepository.findById(viajeId)
                .orElseThrow(() -> new ResourceNotFoundException("Viaje", viajeId));
        if (!conductorId.equals(viaje.getConductorId())) {
            throw new BusinessException("Este viaje no te pertenece", "ACCESO_DENEGADO");
        }

        List<Object[]> rows = (List<Object[]>) entityManager.createNativeQuery(
                "SELECT p.id, p.asiento_numero, p.codigo_boleta, p.precio_final, p.estado, " +
                "       c.nombres, c.apellidos, c.dni " +
                "FROM pasajes p " +
                "LEFT JOIN clientes c ON c.id = p.cliente_id " +
                "WHERE p.viaje_id = :viajeId AND p.estado != 'ANULADO' " +
                "ORDER BY p.asiento_numero")
                .setParameter("viajeId", viajeId)
                .getResultList();

        List<Map<String, Object>> pasajeros = rows.stream().map(r -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("pasajeId",      ((Number) r[0]).longValue());
            m.put("asiento",       r[1] != null ? ((Number) r[1]).intValue() : null);
            m.put("boleta",        r[2]);
            m.put("precio",        r[3]);
            m.put("estado",        r[4]);
            String nom = r[5] != null ? String.valueOf(r[5]) : "";
            String ape = r[6] != null ? String.valueOf(r[6]) : "";
            m.put("nombre",        (nom + " " + ape).trim());
            m.put("dni",           r[7]);
            return m;
        }).toList();

        return ResponseEntity.ok(ApiResponse.ok(pasajeros));
    }

    /**
     * Encomiendas a bordo del viaje, para que el conductor sepa qué entregar
     * en cada agencia del camino (agrupa el frontend por agencia destino).
     */
    @GetMapping("/mis-viajes/{viajeId}/encomiendas")
    @PreAuthorize("hasAnyRole('CONDUCTOR','SUPER_ADMIN','GERENTE','ADMIN_AGENCIA','OPERADOR')")
    @SuppressWarnings("unchecked")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> encomiendas(
            @PathVariable Long viajeId, Authentication auth) {
        Long conductorId = resolverConductorId(auth);
        Viaje viaje = viajeRepository.findById(viajeId)
                .orElseThrow(() -> new ResourceNotFoundException("Viaje", viajeId));
        if (!conductorId.equals(viaje.getConductorId())) {
            throw new BusinessException("Este viaje no te pertenece", "ACCESO_DENEGADO");
        }

        List<Object[]> rows = (List<Object[]>) entityManager.createNativeQuery(
                "SELECT e.codigo_tracking, e.descripcion, e.num_bultos, e.es_fragil, " +
                "       e.estado, e.forma_cobro, " +
                "       COALESCE(a.nombre, 'Sin agencia'), a.ciudad, " +
                "       TRIM(COALESCE(c.nombres,'') || ' ' || COALESCE(c.apellidos,'')) " +
                "FROM encomiendas e " +
                "LEFT JOIN agencias a ON a.id = e.agencia_destino_id " +
                "LEFT JOIN clientes c ON c.id = e.destinatario_id " +
                "WHERE e.viaje_id = :viajeId AND e.estado != 'DEVUELTO' " +
                "ORDER BY COALESCE(a.nombre, 'zzz'), e.codigo_tracking")
                .setParameter("viajeId", viajeId)
                .getResultList();

        List<Map<String, Object>> lista = rows.stream().map(r -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("codigo",         r[0]);
            m.put("descripcion",    r[1]);
            m.put("bultos",         r[2] != null ? ((Number) r[2]).intValue() : 1);
            m.put("fragil",         Boolean.TRUE.equals(r[3]));
            m.put("estado",         r[4]);
            m.put("pagoEnDestino",  "POR_COBRAR".equals(String.valueOf(r[5])));
            m.put("agenciaDestino", r[6]);
            m.put("ciudadDestino",  r[7]);
            m.put("destinatario",   r[8]);
            return m;
        }).toList();

        return ResponseEntity.ok(ApiResponse.ok(lista));
    }

    @PostMapping("/mis-viajes/{viajeId}/confirmar-salida")
    @PreAuthorize("hasAnyRole('CONDUCTOR','SUPER_ADMIN','GERENTE','ADMIN_AGENCIA','OPERADOR')")
    @Transactional
    public ResponseEntity<ApiResponse<Map<String, Object>>> confirmarSalida(
            @PathVariable Long viajeId, Authentication auth) {
        Long conductorId = resolverConductorId(auth);
        Viaje viaje = viajeRepository.findById(viajeId)
                .orElseThrow(() -> new ResourceNotFoundException("Viaje", viajeId));
        if (!conductorId.equals(viaje.getConductorId())) {
            throw new BusinessException("Este viaje no te pertenece", "ACCESO_DENEGADO");
        }
        if (!"PROGRAMADO".equals(viaje.getEstado()) && !"ATRASADO".equals(viaje.getEstado())) {
            throw new BusinessException(
                    "Solo puedes confirmar salida de un viaje PROGRAMADO o ATRASADO. Estado: " + viaje.getEstado(),
                    "ESTADO_INVALIDO");
        }

        // Control interno: la salida de una COMBI con cuota configurada la confirma
        // el OPERADOR de la agencia, que registra la cuota de salida en su caja.
        // Si el conductor pudiera confirmarla, la cuota no quedaría registrada.
        Object vehTipo = null;
        try {
            vehTipo = entityManager
                    .createNativeQuery("SELECT tipo FROM vehiculos WHERE id = :vid")
                    .setParameter("vid", viaje.getVehiculoId())
                    .getSingleResult();
        } catch (Exception ignored) {}
        if ("COMBI".equals(String.valueOf(vehTipo))) {
            java.math.BigDecimal cuota = empresaConfigService.get().getCuotaSalidaCombi();
            if (cuota != null && cuota.compareTo(java.math.BigDecimal.ZERO) > 0) {
                throw new BusinessException(
                        "La salida de una combi la confirma el operador de la agencia: "
                        + "él registra la cuota de salida (S/ " + cuota.toPlainString()
                        + ") en su caja. Pídele que confirme la salida desde el módulo Viajes.",
                        "SALIDA_COMBI_REQUIERE_OPERADOR");
            }
        }

        viaje.setEstado("EN_RUTA");
        viaje.setUpdatedAt(OffsetDateTime.now());
        viajeRepository.save(viaje);

        // Igual que cuando confirma el operador: las encomiendas del viaje pasan
        // a EN_TRANSITO y se avisa a las agencias destino (tracking coherente)
        java.util.Set<String> preTransito = java.util.Set.of(
                "REGISTRADO", "RECEPCIONADO", "ALMACENADO", "CARGADO");
        var encomiendas = encomiendaRepository.findByViajeId(viajeId);
        var aActualizar = encomiendas.stream()
                .filter(enc -> preTransito.contains(enc.getEstado()))
                .peek(enc -> enc.setEstado("EN_TRANSITO"))
                .toList();
        if (!aActualizar.isEmpty()) encomiendaRepository.saveAll(aActualizar);

        encomiendas.stream()
                .map(com.expressvraem.modules.encomiendas.entity.Encomienda::getAgenciaDestinoId)
                .filter(Objects::nonNull)
                .distinct()
                .forEach(agDestId -> wsPublisher.publicarEncomiendaEnCamino(agDestId,
                        Map.of("viajeId", viajeId, "tipo", "EN_CAMINO")));

        return ResponseEntity.ok(ApiResponse.ok("Salida confirmada — en ruta", enriquecerViaje(viaje)));
    }

    @PostMapping("/mis-viajes/{viajeId}/confirmar-llegada")
    @PreAuthorize("hasAnyRole('CONDUCTOR','SUPER_ADMIN','GERENTE','ADMIN_AGENCIA','OPERADOR')")
    @Transactional
    public ResponseEntity<ApiResponse<Map<String, Object>>> confirmarLlegada(
            @PathVariable Long viajeId, Authentication auth) {
        Long conductorId = resolverConductorId(auth);
        Viaje viaje = viajeRepository.findById(viajeId)
                .orElseThrow(() -> new ResourceNotFoundException("Viaje", viajeId));
        if (!conductorId.equals(viaje.getConductorId())) {
            throw new BusinessException("Este viaje no te pertenece", "ACCESO_DENEGADO");
        }
        if (!"EN_RUTA".equals(viaje.getEstado())) {
            throw new BusinessException(
                    "Solo puedes confirmar llegada de un viaje EN_RUTA. Estado: " + viaje.getEstado(),
                    "ESTADO_INVALIDO");
        }
        viaje.setEstado("COMPLETADO");
        viaje.setFechaHoraArr(OffsetDateTime.now());
        viaje.setUpdatedAt(OffsetDateTime.now());
        viajeRepository.save(viaje);
        return ResponseEntity.ok(ApiResponse.ok("Llegada confirmada — viaje completado", enriquecerViaje(viaje)));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Resuelve la ficha de conductor del usuario autenticado: primero por el
     * vínculo explícito usuario_id, luego por DNI. Devuelve null si no tiene ficha
     * (antes se usaba el id del usuario como conductorId, lo que podía chocar con
     * la ficha de OTRO conductor y dejarle ver/confirmar viajes ajenos).
     */
    private Conductor resolverConductor(Authentication auth) {
        Usuario usuario = usuarioRepository.findByEmail(auth.getName())
                .orElseThrow(() -> new BusinessException("Usuario no encontrado", "USER_NOT_FOUND"));

        return conductorRepository.findByUsuarioId(usuario.getId())
                .or(() -> (usuario.getDni() != null && !usuario.getDni().isBlank())
                        ? conductorRepository.findByDni(usuario.getDni())
                        : java.util.Optional.empty())
                .orElse(null);
    }

    /** Igual que resolverConductor pero exige la ficha (para acciones sobre un viaje). */
    private Long resolverConductorId(Authentication auth) {
        Conductor c = resolverConductor(auth);
        if (c == null) {
            throw new BusinessException(
                    "Tu cuenta no tiene ficha de conductor. Pide al administrador que la cree "
                    + "(Configuración → Conductores → Nueva ficha, con tu mismo DNI).",
                    "SIN_FICHA_CONDUCTOR");
        }
        return c.getId();
    }

    private Map<String, Object> enriquecerViaje(Viaje v) {
        try {
            Object[] ruta = (Object[]) entityManager
                    .createNativeQuery("SELECT origen, destino, distancia_km FROM rutas WHERE id = :id")
                    .setParameter("id", v.getRutaId()).getSingleResult();
            Object[] veh = (Object[]) entityManager
                    .createNativeQuery("SELECT placa, tipo, num_asientos FROM vehiculos WHERE id = :id")
                    .setParameter("id", v.getVehiculoId()).getSingleResult();

            long libres   = asientoRepository.countByViajeIdAndEstado(v.getId(), "LIBRE");
            long ocupados = asientoRepository.countByViajeIdAndEstado(v.getId(), "OCUPADO")
                          + asientoRepository.countByViajeIdAndEstado(v.getId(), "RESERVADO");

            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id",           v.getId());
            m.put("estado",       v.getEstado());
            m.put("fechaHoraSal", v.getFechaHoraSal());
            m.put("fechaHoraArr", v.getFechaHoraArr());
            m.put("observaciones", v.getObservaciones());
            m.put("ruta", Map.of(
                    "origen",      String.valueOf(ruta[0]),
                    "destino",     String.valueOf(ruta[1]),
                    "distanciaKm", ruta[2] != null ? ((Number) ruta[2]).doubleValue() : null));
            m.put("vehiculo", Map.of(
                    "placa",      String.valueOf(veh[0]),
                    "tipo",       String.valueOf(veh[1]),
                    "numAsientos", ((Number) veh[2]).intValue()));
            m.put("asientosLibres",   libres);
            m.put("asientosOcupados", ocupados);
            m.put("cantEncomiendas",  encomiendaRepository.countByViajeId(v.getId()));
            return m;
        } catch (Exception e) {
            return null;
        }
    }
}
