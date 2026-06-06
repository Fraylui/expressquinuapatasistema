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
import com.expressvraem.shared.middleware.AgenciaContext;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

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

    // ── Lista de conductores para selects ────────────────────────────────────

    @GetMapping("/lista")
    public ResponseEntity<ApiResponse<List<Conductor>>> listar() {
        Long agenciaId = AgenciaContext.getAgenciaId();
        List<Conductor> lista = agenciaId != null
                ? conductorRepository.findByAgenciaIdAndActivo(agenciaId, true)
                : conductorRepository.findAll().stream().filter(Conductor::isActivo).toList();
        return ResponseEntity.ok(ApiResponse.ok(lista));
    }

    // ── Mis viajes (uso exclusivo del CONDUCTOR autenticado) ─────────────────

    @GetMapping("/mis-viajes")
    @PreAuthorize("hasAnyRole('CONDUCTOR','SUPER_ADMIN','GERENTE','ADMIN_AGENCIA','OPERADOR')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> misViajes(Authentication auth) {
        Long conductorId = resolverConductorId(auth);

        List<String> estadosActivos = List.of("PROGRAMADO", "EN_RUTA", "ATRASADO");
        List<Viaje> viajes = viajeRepository.findByEstadoIn(estadosActivos).stream()
                .filter(v -> conductorId.equals(v.getConductorId()))
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
            m.put("nombre",        r[5] + " " + r[6]);
            m.put("dni",           r[7]);
            return m;
        }).toList();

        return ResponseEntity.ok(ApiResponse.ok(pasajeros));
    }

    @PostMapping("/mis-viajes/{viajeId}/confirmar-salida")
    @PreAuthorize("hasAnyRole('CONDUCTOR','SUPER_ADMIN','GERENTE','ADMIN_AGENCIA','OPERADOR')")
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
        viaje.setEstado("EN_RUTA");
        viaje.setUpdatedAt(OffsetDateTime.now());
        viajeRepository.save(viaje);
        return ResponseEntity.ok(ApiResponse.ok("Salida confirmada — en ruta", enriquecerViaje(viaje)));
    }

    @PostMapping("/mis-viajes/{viajeId}/confirmar-llegada")
    @PreAuthorize("hasAnyRole('CONDUCTOR','SUPER_ADMIN','GERENTE','ADMIN_AGENCIA','OPERADOR')")
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
     * Resuelve el conductorId a partir del usuario autenticado.
     * Busca en conductores por DNI del usuario, luego intenta por usuarios.id como fallback.
     */
    private Long resolverConductorId(Authentication auth) {
        Usuario usuario = usuarioRepository.findByEmail(auth.getName())
                .orElseThrow(() -> new BusinessException("Usuario no encontrado", "USER_NOT_FOUND"));

        // Buscar en conductores por DNI
        return conductorRepository.findAll().stream()
                .filter(c -> c.getDni().equals(usuario.getDni()))
                .map(Conductor::getId)
                .findFirst()
                .orElse(usuario.getId()); // fallback: el conductorId puede ser el userId
    }

    @SuppressWarnings("unchecked")
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
            return m;
        } catch (Exception e) {
            return null;
        }
    }
}
