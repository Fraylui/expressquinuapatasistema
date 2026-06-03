package com.expressvraem.modules.configuracion;

import com.expressvraem.modules.rutas.entity.Ruta;
import com.expressvraem.modules.rutas.repository.RutaRepository;
import com.expressvraem.shared.exceptions.ApiResponse;
import com.expressvraem.shared.exceptions.BusinessException;
import com.expressvraem.shared.exceptions.ResourceNotFoundException;
import com.expressvraem.shared.middleware.AgenciaContext;
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

@RestController
@RequestMapping("/api/configuracion/rutas")
@RequiredArgsConstructor
public class ConfiguracionRutaController {

    private final RutaRepository rutaRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<List<Ruta>>> listar() {
        Long agenciaId = AgenciaContext.getAgenciaId();
        List<Ruta> rutas = agenciaId != null
                ? rutaRepository.findByAgenciaId(agenciaId)
                : rutaRepository.findAll();
        return ResponseEntity.ok(ApiResponse.ok(rutas));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<Ruta>> crear(@Valid @RequestBody RutaDTO dto) {
        Long agenciaId = AgenciaContext.getAgenciaId();
        if (agenciaId == null) agenciaId = 1L;

        String codigo = dto.getCodigo().toUpperCase().trim();
        if (rutaRepository.existsByCodigoAndIdNot(codigo, 0L)) {
            throw new BusinessException("Ya existe una ruta con ese código", "CODIGO_DUPLICADO");
        }

        Ruta ruta = new Ruta();
        ruta.setAgenciaId(agenciaId);
        ruta.setCodigo(codigo);
        ruta.setOrigen(dto.getOrigen().trim());
        ruta.setDestino(dto.getDestino().trim());
        ruta.setDistanciaKm(dto.getDistanciaKm());
        ruta.setDuracionMin(dto.getDuracionMin());
        ruta.setActivo(true);
        ruta.setCreatedAt(OffsetDateTime.now());

        Ruta saved = rutaRepository.save(ruta);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(saved));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<Ruta>> actualizar(
            @PathVariable Long id,
            @Valid @RequestBody RutaDTO dto) {
        Ruta ruta = rutaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Ruta", id));

        String codigo = dto.getCodigo().toUpperCase().trim();
        if (rutaRepository.existsByCodigoAndIdNot(codigo, id)) {
            throw new BusinessException("Ya existe una ruta con ese código", "CODIGO_DUPLICADO");
        }

        ruta.setCodigo(codigo);
        ruta.setOrigen(dto.getOrigen().trim());
        ruta.setDestino(dto.getDestino().trim());
        ruta.setDistanciaKm(dto.getDistanciaKm());
        ruta.setDuracionMin(dto.getDuracionMin());

        return ResponseEntity.ok(ApiResponse.ok(rutaRepository.save(ruta)));
    }

    @PatchMapping("/{id}/activo")
    public ResponseEntity<ApiResponse<Ruta>> toggleActivo(@PathVariable Long id) {
        Ruta ruta = rutaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Ruta", id));
        ruta.setActivo(!ruta.isActivo());
        return ResponseEntity.ok(ApiResponse.ok(rutaRepository.save(ruta)));
    }

    @Data
    public static class RutaDTO {
        @NotBlank @Size(max = 10)
        private String codigo;
        @NotBlank @Size(max = 80)
        private String origen;
        @NotBlank @Size(max = 80)
        private String destino;
        @DecimalMin("0.01")
        private BigDecimal distanciaKm;
        @Min(1)
        private Integer duracionMin;
    }
}
