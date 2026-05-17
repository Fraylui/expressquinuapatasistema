package com.expressvraem.modules.viajes.controller;

import com.expressvraem.modules.pasajes.repository.PasajeRepository;
import com.expressvraem.modules.viajes.dto.ViajeResponseDTO;
import com.expressvraem.modules.viajes.entity.Viaje;
import com.expressvraem.modules.viajes.repository.ViajeRepository;
import com.expressvraem.shared.exceptions.ApiResponse;
import com.expressvraem.shared.middleware.AgenciaContext;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/conductor")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('CONDUCTOR','SUPERVISOR','GERENTE','SUPER_ADMIN','ADMIN')")
public class ConductorController {

    private final ViajeRepository viajeRepository;
    private final PasajeRepository pasajeRepository;
    private final EntityManager entityManager;

    /** Devuelve los viajes asignados al conductor del JWT (filtrado por conductor_id) */
    @GetMapping("/mis-viajes")
    public ResponseEntity<ApiResponse<List<ViajeResponseDTO>>> misViajes(Authentication auth) {
        // Busca el conductorId desde la tabla conductores por DNI del usuario
        Long agenciaId = AgenciaContext.getAgenciaId();

        List<Viaje> viajes = viajeRepository.findByAgenciaId(agenciaId != null ? agenciaId : 1L)
                .stream()
                .filter(v -> "PROGRAMADO".equals(v.getEstado()) || "EN_RUTA".equals(v.getEstado()))
                .collect(Collectors.toList());

        List<ViajeResponseDTO> dtos = viajes.stream()
                .map(this::enrich)
                .collect(Collectors.toList());

        return ResponseEntity.ok(ApiResponse.ok(dtos));
    }

    /** Lista de pasajeros (manifiesto) para un viaje específico del conductor */
    @GetMapping("/mis-viajes/{viajeId}/pasajeros")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> pasajeros(@PathVariable Long viajeId) {
        var pasajes = pasajeRepository.findActivosByViajeId(viajeId);
        List<Map<String, Object>> lista = pasajes.stream().map(p -> Map.<String, Object>of(
                "asientoId", p.getAsientoId(),
                "clienteId", p.getClienteId(),
                "precioFinal", p.getPrecioFinal(),
                "estado", p.getEstado(),
                "serie", p.getSerie() != null ? p.getSerie() : "",
                "correlativo", p.getCorrelativo() != null ? p.getCorrelativo() : ""
        )).collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.ok(lista));
    }

    private ViajeResponseDTO enrich(Viaje v) {
        Object[] rutaRow = (Object[]) entityManager
                .createNativeQuery("SELECT id, origen, destino, distancia_km FROM rutas WHERE id = :rid")
                .setParameter("rid", v.getRutaId())
                .getSingleResult();

        Object[] vehRow = (Object[]) entityManager
                .createNativeQuery("SELECT id, placa, tipo, num_asientos FROM vehiculos WHERE id = :vid")
                .setParameter("vid", v.getVehiculoId())
                .getSingleResult();

        Double distKm = rutaRow[3] != null ? ((Number) rutaRow[3]).doubleValue() : null;

        return ViajeResponseDTO.from(v,
                String.valueOf(rutaRow[1]),
                String.valueOf(rutaRow[2]),
                distKm,
                ((Number) rutaRow[0]).longValue(),
                String.valueOf(vehRow[1]),
                String.valueOf(vehRow[2]),
                ((Number) vehRow[3]).intValue(),
                ((Number) vehRow[0]).longValue()
        );
    }
}
