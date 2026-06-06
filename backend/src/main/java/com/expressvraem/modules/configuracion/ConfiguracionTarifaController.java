package com.expressvraem.modules.configuracion;

import com.expressvraem.modules.tarifas.dto.TarifaResponseDTO;
import com.expressvraem.modules.tarifas.entity.Tarifa;
import com.expressvraem.modules.tarifas.repository.TarifaRepository;
import com.expressvraem.shared.exceptions.ApiResponse;
import com.expressvraem.shared.exceptions.ResourceNotFoundException;
import jakarta.persistence.EntityManager;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/configuracion/tarifas")
@RequiredArgsConstructor
public class ConfiguracionTarifaController {

    private final TarifaRepository tarifaRepository;
    private final EntityManager entityManager;

    @GetMapping
    public ResponseEntity<ApiResponse<List<TarifaResponseDTO>>> listar() {
        // Tarifas son globales — el precio de cada ruta es el mismo para toda la empresa
        return ResponseEntity.ok(ApiResponse.ok(
                tarifaRepository.findAll().stream().map(this::enrich).collect(Collectors.toList())));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<TarifaResponseDTO>> crear(@Valid @RequestBody TarifaDTO dto) {
        Tarifa t = new Tarifa();
        t.setAgenciaId(1L); // catálogo compartido de la empresa
        t.setRutaId(dto.getRutaId());
        t.setTipoVehiculo(dto.getTipoVehiculo());
        t.setPrecio(dto.getPrecio());
        t.setVigente(true);
        t.setCreatedAt(OffsetDateTime.now());
        t.setUpdatedAt(OffsetDateTime.now());

        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(enrich(tarifaRepository.save(t))));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<TarifaResponseDTO>> actualizar(
            @PathVariable Long id,
            @Valid @RequestBody TarifaDTO dto) {
        Tarifa t = tarifaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Tarifa", id));
        t.setRutaId(dto.getRutaId());
        t.setTipoVehiculo(dto.getTipoVehiculo());
        t.setPrecio(dto.getPrecio());
        t.setUpdatedAt(OffsetDateTime.now());
        return ResponseEntity.ok(ApiResponse.ok(enrich(tarifaRepository.save(t))));
    }

    @PatchMapping("/{id}/vigente")
    public ResponseEntity<ApiResponse<TarifaResponseDTO>> toggleVigente(@PathVariable Long id) {
        Tarifa t = tarifaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Tarifa", id));
        t.setVigente(!t.getVigente());
        t.setUpdatedAt(OffsetDateTime.now());
        return ResponseEntity.ok(ApiResponse.ok(enrich(tarifaRepository.save(t))));
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

    @Data
    public static class TarifaDTO {
        @NotNull
        private Long rutaId;
        @NotBlank
        private String tipoVehiculo;
        @NotNull @DecimalMin("0.10")
        private BigDecimal precio;
    }
}
