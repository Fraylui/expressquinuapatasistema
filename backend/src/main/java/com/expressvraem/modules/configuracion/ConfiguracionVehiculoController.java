package com.expressvraem.modules.configuracion;

import com.expressvraem.modules.conductores.entity.Conductor;
import com.expressvraem.modules.conductores.repository.ConductorRepository;
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
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/configuracion/vehiculos")
@RequiredArgsConstructor
public class ConfiguracionVehiculoController {

    private final VehiculoRepository vehiculoRepository;
    private final ConductorRepository conductorRepository;

    @GetMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE','ADMIN_AGENCIA','OPERADOR','CONDUCTOR')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> listar() {
        // La flota es de la empresa: todas las agencias la ven completa
        List<Vehiculo> lista = vehiculoRepository.findAll();
        Map<Long, String> nombres = new LinkedHashMap<>();
        conductorRepository.findAll().forEach(c -> nombres.put(c.getId(),
                ((c.getNombres() != null ? c.getNombres() : "") + " "
                 + (c.getApellidos() != null ? c.getApellidos() : "")).trim()));
        return ResponseEntity.ok(ApiResponse.ok(lista.stream().map(v -> toMap(v, nombres)).toList()));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE','ADMIN_AGENCIA')")
    @Transactional
    public ResponseEntity<ApiResponse<Map<String, Object>>> crear(@Valid @RequestBody VehiculoDTO dto) {
        String placa = dto.getPlaca().toUpperCase().trim();
        if (vehiculoRepository.existsByPlacaAndIdNot(placa, 0L)) {
            throw new BusinessException("Ya existe un vehículo con esa placa", "PLACA_DUPLICADA");
        }

        Vehiculo v = new Vehiculo();
        // La flota pertenece a la empresa: si quien registra tiene agencia se guarda
        // como referencia, pero no es obligatoria (GERENTE/SUPER_ADMIN no la tienen)
        v.setAgenciaId(AgenciaContext.getAgenciaId());
        v.setPlaca(placa);
        aplicarDatos(v, dto);
        v.setEstado("OPERATIVO");
        v.setCreatedAt(OffsetDateTime.now());
        v.setUpdatedAt(OffsetDateTime.now());

        Vehiculo saved = vehiculoRepository.save(v);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Vehículo registrado", toMap(saved, null)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE','ADMIN_AGENCIA')")
    @Transactional
    public ResponseEntity<ApiResponse<Map<String, Object>>> actualizar(
            @PathVariable Long id,
            @Valid @RequestBody VehiculoDTO dto) {
        Vehiculo v = vehiculoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Vehículo", id));
        String placa = dto.getPlaca().toUpperCase().trim();
        if (vehiculoRepository.existsByPlacaAndIdNot(placa, id)) {
            throw new BusinessException("Ya existe un vehículo con esa placa", "PLACA_DUPLICADA");
        }
        v.setPlaca(placa);
        aplicarDatos(v, dto);
        v.setUpdatedAt(OffsetDateTime.now());
        return ResponseEntity.ok(ApiResponse.ok("Vehículo actualizado", toMap(vehiculoRepository.save(v), null)));
    }

    /** Copia los datos del DTO validando conductor habitual y completando capacidad. */
    private void aplicarDatos(Vehiculo v, VehiculoDTO dto) {
        v.setTipo(dto.getTipo());
        v.setMarca(dto.getMarca());
        v.setModelo(dto.getModelo());
        v.setAnio(dto.getAnio());
        // Capacidad opcional: si no se indica, es la cantidad de asientos
        v.setCapacidad(dto.getCapacidad() != null ? dto.getCapacidad() : dto.getNumAsientos());
        v.setColor(dto.getColor());
        v.setNumAsientos(dto.getNumAsientos());

        if (dto.getConductorHabitualId() != null) {
            Conductor c = conductorRepository.findById(dto.getConductorHabitualId())
                    .orElseThrow(() -> new BusinessException(
                            "Conductor habitual no encontrado", "CONDUCTOR_NO_ENCONTRADO"));
            if (!c.isActivo()) {
                throw new BusinessException(
                        "El conductor " + c.getNombres() + " " + c.getApellidos()
                        + " está inactivo; no puede ser conductor habitual.", "CONDUCTOR_INACTIVO");
            }
        }
        v.setConductorHabitualId(dto.getConductorHabitualId());
    }

    private Map<String, Object> toMap(Vehiculo v, Map<Long, String> nombresConductores) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id",           v.getId());
        m.put("agenciaId",    v.getAgenciaId());
        m.put("placa",        v.getPlaca());
        m.put("tipo",         v.getTipo());
        m.put("marca",        v.getMarca());
        m.put("modelo",       v.getModelo());
        m.put("anio",         v.getAnio());
        m.put("capacidad",    v.getCapacidad());
        m.put("color",        v.getColor());
        m.put("numAsientos",  v.getNumAsientos());
        m.put("estado",       v.getEstado());
        m.put("conductorHabitualId", v.getConductorHabitualId());
        String nombre = null;
        if (v.getConductorHabitualId() != null) {
            nombre = nombresConductores != null
                    ? nombresConductores.get(v.getConductorHabitualId())
                    : conductorRepository.findById(v.getConductorHabitualId())
                        .map(c -> (c.getNombres() + " " + c.getApellidos()).trim()).orElse(null);
        }
        m.put("conductorHabitualNombre", nombre);
        return m;
    }

    @PatchMapping("/{id}/estado")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE','ADMIN_AGENCIA')")
    @Transactional
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
        @Pattern(regexp = "^(COMBI|CAMIONETA)$", message = "Tipo de vehículo debe ser COMBI o CAMIONETA")
        private String tipo;
        @Size(max = 50)
        private String marca;
        @Size(max = 50)
        private String modelo;
        @Min(value = 1900, message = "Año inválido") @Max(value = 2100, message = "Año inválido")
        private Integer anio;
        /** Opcional: si no se indica se usa el número de asientos */
        @Min(1)
        private Integer capacidad;
        @Size(max = 30)
        private String color;
        @NotNull @Min(1)
        private Integer numAsientos;
        /** Conductor al que se le entrega el vehículo (opcional) */
        private Long conductorHabitualId;
    }
}
