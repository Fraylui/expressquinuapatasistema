package com.expressvraem.modules.viajes.controller;

import com.expressvraem.modules.encomiendas.repository.EncomiendaRepository;
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
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/viajes")
@RequiredArgsConstructor
public class ViajeController {

    private final ViajeRepository viajeRepository;
    private final AsientoRepository asientoRepository;
    private final EncomiendaRepository encomiendaRepository;
    private final EntityManager entityManager;
    private final LogService logService;

    /** Endpoint público — sin autenticación. Filtra por origen, destino y fecha. */
    @GetMapping("/publico")
    public ResponseEntity<ApiResponse<List<ViajeResponseDTO>>> listarPublico(
            @RequestParam(required = false) String origen,
            @RequestParam(required = false) String destino,
            @RequestParam(required = false) String fecha) {
        List<Viaje> todos = viajeRepository.findAll();
        List<ViajeResponseDTO> dtos = todos.stream()
                .map(this::enrich)
                .filter(v -> v.getEstado() == null || !v.getEstado().equals("CANCELADO"))
                .filter(v -> origen == null || origen.isBlank() ||
                        (v.getRuta() != null && v.getRuta().getOrigen() != null &&
                         v.getRuta().getOrigen().equalsIgnoreCase(origen)))
                .filter(v -> destino == null || destino.isBlank() ||
                        (v.getRuta() != null && v.getRuta().getDestino() != null &&
                         v.getRuta().getDestino().equalsIgnoreCase(destino)))
                .collect(java.util.stream.Collectors.toList());
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

        List<ViajeResponseDTO> dtos = viajes.stream()
                .map(this::enrich)
                .collect(Collectors.toList());

        return ResponseEntity.ok(ApiResponse.ok(dtos));
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
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE','ADMIN','OPERADOR')")
    public ResponseEntity<ApiResponse<ViajeResponseDTO>> confirmarSalida(
            @PathVariable Long id, Authentication auth) {
        Viaje viaje = viajeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Viaje", id));

        if (!"PROGRAMADO".equals(viaje.getEstado())) {
            throw new BusinessException(
                    "Solo se puede confirmar salida de un viaje PROGRAMADO. Estado actual: " + viaje.getEstado(),
                    "ESTADO_INVALIDO");
        }

        viaje.setEstado("EN_RUTA");
        viajeRepository.save(viaje);

        // Cambia encomiendas asignadas a este viaje a EN_TRANSITO
        encomiendaRepository.findByViajeId(id).forEach(enc -> {
            if ("REGISTRADO".equals(enc.getEstado())) {
                enc.setEstado("EN_TRANSITO");
                encomiendaRepository.save(enc);
            }
        });

        logService.logOperacion(auth.getName(), "VIAJES", "CONFIRMAR_SALIDA",
                Map.of("viajeId", id, "operador", auth.getName()));

        return ResponseEntity.ok(ApiResponse.ok("Viaje confirmado — en ruta", enrich(viaje)));
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
