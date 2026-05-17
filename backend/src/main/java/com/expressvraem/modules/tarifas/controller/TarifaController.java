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

import java.util.List;
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
        return ResponseEntity.ok(ApiResponse.ok(tarifas.stream()
                .map(this::enrich)
                .collect(Collectors.toList())));
    }

    /** Busca tarifa vigente por rutaId y tipoVehiculo */
    @GetMapping("/buscar")
    public ResponseEntity<ApiResponse<TarifaResponseDTO>> buscarPorRutaYTipo(
            @RequestParam Long rutaId,
            @RequestParam String tipoVehiculo) {
        List<Tarifa> resultados = tarifaRepository.findVigenteByRutaAndTipo(rutaId, tipoVehiculo);
        if (resultados.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.error("No hay tarifa vigente para esta ruta y tipo de vehículo"));
        }
        return ResponseEntity.ok(ApiResponse.ok(enrich(resultados.get(0))));
    }

    /** Endpoint autenticado — lista de la agencia del usuario */
    @GetMapping
    public ResponseEntity<ApiResponse<List<TarifaResponseDTO>>> listar() {
        Long agenciaId = AgenciaContext.getAgenciaId();
        List<Tarifa> tarifas = agenciaId != null
                ? tarifaRepository.findByAgenciaIdAndVigenteTrue(agenciaId)
                : tarifaRepository.findByVigenteTrue();
        return ResponseEntity.ok(ApiResponse.ok(tarifas.stream()
                .map(this::enrich)
                .collect(Collectors.toList())));
    }

    private TarifaResponseDTO enrich(Tarifa t) {
        TarifaResponseDTO dto = new TarifaResponseDTO();
        dto.setId(t.getId());
        dto.setRutaId(t.getRutaId());
        dto.setTipoVehiculo(t.getTipoVehiculo());
        dto.setPrecio(t.getPrecio());
        dto.setVigente(t.getVigente());

        try {
            Object[] ruta = (Object[]) entityManager
                    .createNativeQuery("SELECT origen, destino FROM rutas WHERE id = :id")
                    .setParameter("id", t.getRutaId())
                    .getSingleResult();
            dto.setRutaOrigen(String.valueOf(ruta[0]));
            dto.setRutaDestino(String.valueOf(ruta[1]));
        } catch (Exception ignored) {}

        return dto;
    }
}
