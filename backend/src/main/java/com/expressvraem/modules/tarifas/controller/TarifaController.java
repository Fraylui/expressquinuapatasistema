package com.expressvraem.modules.tarifas.controller;

import com.expressvraem.modules.tarifas.dto.TarifaResponseDTO;
import com.expressvraem.modules.tarifas.entity.Tarifa;
import com.expressvraem.modules.tarifas.repository.TarifaRepository;
import com.expressvraem.shared.exceptions.ApiResponse;
import com.expressvraem.shared.middleware.AgenciaContext;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/tarifas")
@RequiredArgsConstructor
public class TarifaController {

    private final TarifaRepository tarifaRepository;
    private final EntityManager entityManager;

    /** Endpoint público — sin autenticación */
    @GetMapping("/publico")
    public ResponseEntity<ApiResponse<List<TarifaResponseDTO>>> listarPublico() {
        List<Tarifa> tarifas = tarifaRepository.findByVigenteTrue();
        return ResponseEntity.ok(ApiResponse.ok(enrichAll(tarifas)));
    }

    /** Busca tarifa vigente por rutaId y tipoVehiculo, priorizando la temporada activa */
    @GetMapping("/buscar")
    public ResponseEntity<ApiResponse<TarifaResponseDTO>> buscarPorRutaYTipo(
            @RequestParam Long rutaId,
            @RequestParam String tipoVehiculo) {
        List<Tarifa> resultados = tarifaRepository.findVigenteEnTemporada(rutaId, tipoVehiculo);
        if (resultados.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.error("No hay tarifa vigente para esta ruta y tipo de vehículo"));
        }
        return ResponseEntity.ok(ApiResponse.ok(enrichAll(resultados).get(0)));
    }

    /** Endpoint autenticado — lista de la agencia del usuario */
    @GetMapping
    public ResponseEntity<ApiResponse<List<TarifaResponseDTO>>> listar() {
        Long agenciaId = AgenciaContext.getAgenciaId();
        List<Tarifa> tarifas = agenciaId != null
                ? tarifaRepository.findByAgenciaIdAndVigenteTrue(agenciaId)
                : tarifaRepository.findByVigenteTrue();
        return ResponseEntity.ok(ApiResponse.ok(enrichAll(tarifas)));
    }

    /** Batch-enriches a list of tarifas with ruta names in a single query. */
    @SuppressWarnings("unchecked")
    private List<TarifaResponseDTO> enrichAll(List<Tarifa> tarifas) {
        List<Long> rutaIds = tarifas.stream().map(Tarifa::getRutaId).distinct().collect(Collectors.toList());
        Map<Long, String[]> rutaMap = new HashMap<>();
        if (!rutaIds.isEmpty()) {
            try {
                List<Object[]> rows = entityManager
                        .createNativeQuery("SELECT id, origen, destino FROM rutas WHERE id IN :ids")
                        .setParameter("ids", rutaIds)
                        .getResultList();
                rows.forEach(r -> rutaMap.put(
                        ((Number) r[0]).longValue(),
                        new String[]{ String.valueOf(r[1]), String.valueOf(r[2]) }));
            } catch (Exception ignored) {}
        }
        return tarifas.stream().map(t -> enrichFromMap(t, rutaMap)).collect(Collectors.toList());
    }

    private TarifaResponseDTO enrichFromMap(Tarifa t, Map<Long, String[]> rutaMap) {
        TarifaResponseDTO dto = new TarifaResponseDTO();
        dto.setId(t.getId());
        dto.setRutaId(t.getRutaId());
        dto.setTipoVehiculo(t.getTipoVehiculo());
        dto.setPrecio(t.getPrecio());
        dto.setVigente(t.getVigente());
        String[] rutaData = rutaMap.get(t.getRutaId());
        if (rutaData != null) {
            dto.setRutaOrigen(rutaData[0]);
            dto.setRutaDestino(rutaData[1]);
        }
        return dto;
    }
}
