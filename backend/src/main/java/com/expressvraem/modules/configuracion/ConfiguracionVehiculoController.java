package com.expressvraem.modules.configuracion;

import com.expressvraem.modules.vehiculos.entity.Vehiculo;
import com.expressvraem.modules.vehiculos.repository.VehiculoRepository;
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

import java.time.OffsetDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/configuracion/vehiculos")
@RequiredArgsConstructor
public class ConfiguracionVehiculoController {

    private final VehiculoRepository vehiculoRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<List<Vehiculo>>> listar() {
        Long agenciaId = AgenciaContext.getAgenciaId();
        List<Vehiculo> lista = agenciaId != null
                ? vehiculoRepository.findByAgenciaId(agenciaId)
                : vehiculoRepository.findAll();
        return ResponseEntity.ok(ApiResponse.ok(lista));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<Vehiculo>> crear(@Valid @RequestBody VehiculoDTO dto) {
        Long agenciaId = AgenciaContext.getAgenciaId();
        if (agenciaId == null) agenciaId = 1L;

        String placa = dto.getPlaca().toUpperCase().trim();
        if (vehiculoRepository.existsByPlacaAndIdNot(placa, 0L)) {
            throw new BusinessException("Ya existe un vehículo con esa placa", "PLACA_DUPLICADA");
        }

        Vehiculo v = new Vehiculo();
        v.setAgenciaId(agenciaId);
        v.setPlaca(placa);
        v.setTipo(dto.getTipo());
        v.setMarca(dto.getMarca());
        v.setModelo(dto.getModelo());
        v.setAnio(dto.getAnio());
        v.setCapacidad(dto.getCapacidad());
        v.setColor(dto.getColor());
        v.setNumAsientos(dto.getNumAsientos());
        v.setEstado("OPERATIVO");
        v.setCreatedAt(OffsetDateTime.now());
        v.setUpdatedAt(OffsetDateTime.now());

        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(vehiculoRepository.save(v)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<Vehiculo>> actualizar(
            @PathVariable Long id,
            @Valid @RequestBody VehiculoDTO dto) {
        Vehiculo v = vehiculoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Vehículo", id));
        String placa = dto.getPlaca().toUpperCase().trim();
        if (vehiculoRepository.existsByPlacaAndIdNot(placa, id)) {
            throw new BusinessException("Ya existe un vehículo con esa placa", "PLACA_DUPLICADA");
        }
        v.setPlaca(placa);
        v.setTipo(dto.getTipo());
        v.setMarca(dto.getMarca());
        v.setModelo(dto.getModelo());
        v.setAnio(dto.getAnio());
        v.setCapacidad(dto.getCapacidad());
        v.setColor(dto.getColor());
        v.setNumAsientos(dto.getNumAsientos());
        v.setUpdatedAt(OffsetDateTime.now());
        return ResponseEntity.ok(ApiResponse.ok(vehiculoRepository.save(v)));
    }

    @PatchMapping("/{id}/estado")
    public ResponseEntity<ApiResponse<Vehiculo>> cambiarEstado(
            @PathVariable Long id,
            @RequestParam String estado) {
        if (!List.of("OPERATIVO", "MANTENIMIENTO", "BAJA").contains(estado)) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Estado inválido: " + estado));
        }
        Vehiculo v = vehiculoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Vehículo", id));
        v.setEstado(estado);
        v.setUpdatedAt(OffsetDateTime.now());
        return ResponseEntity.ok(ApiResponse.ok(vehiculoRepository.save(v)));
    }

    @Data
    public static class VehiculoDTO {
        @NotBlank @Size(max = 10)
        private String placa;
        @NotBlank
        private String tipo;
        @Size(max = 50)
        private String marca;
        @Size(max = 50)
        private String modelo;
        private Integer anio;
        @NotNull @Min(1)
        private Integer capacidad;
        @Size(max = 30)
        private String color;
        @NotNull @Min(1)
        private Integer numAsientos;
    }
}
