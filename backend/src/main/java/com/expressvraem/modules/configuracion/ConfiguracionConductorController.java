package com.expressvraem.modules.configuracion;

import com.expressvraem.modules.conductores.entity.Conductor;
import com.expressvraem.modules.conductores.repository.ConductorRepository;
import com.expressvraem.shared.exceptions.ApiResponse;
import com.expressvraem.shared.exceptions.BusinessException;
import com.expressvraem.shared.exceptions.ResourceNotFoundException;
import com.expressvraem.shared.middleware.AgenciaContext;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/configuracion/conductores")
@RequiredArgsConstructor
public class ConfiguracionConductorController {

    private final ConductorRepository conductorRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<List<Conductor>>> listar() {
        Long agenciaId = AgenciaContext.getAgenciaId();
        List<Conductor> lista = agenciaId != null
                ? conductorRepository.findByAgenciaId(agenciaId)
                : conductorRepository.findAll();
        return ResponseEntity.ok(ApiResponse.ok(lista));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<Conductor>> crear(@Valid @RequestBody ConductorDTO dto) {
        if (conductorRepository.existsByDni(dto.getDni())) {
            throw new BusinessException("Ya existe un conductor con ese DNI", "DNI_DUPLICADO");
        }
        if (conductorRepository.existsByLicencia(dto.getLicencia())) {
            throw new BusinessException("Ya existe un conductor con esa licencia", "LICENCIA_DUPLICADA");
        }
        Long agenciaId = AgenciaContext.getAgenciaId();
        if (agenciaId == null) agenciaId = 1L;

        Conductor c = Conductor.builder()
                .agenciaId(agenciaId)
                .nombres(dto.getNombres())
                .apellidos(dto.getApellidos())
                .dni(dto.getDni())
                .licencia(dto.getLicencia())
                .categoriaLic(dto.getCategoriaLic())
                .telefono(dto.getTelefono())
                .email(dto.getEmail())
                .fechaVencLic(dto.getFechaVencLic())
                .activo(true)
                .createdAt(OffsetDateTime.now())
                .build();

        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(conductorRepository.save(c)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<Conductor>> actualizar(
            @PathVariable Long id,
            @Valid @RequestBody ConductorDTO dto) {
        Conductor c = conductorRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Conductor", id));
        if (conductorRepository.existsByDniAndIdNot(dto.getDni(), id)) {
            throw new BusinessException("Ya existe un conductor con ese DNI", "DNI_DUPLICADO");
        }
        if (conductorRepository.existsByLicenciaAndIdNot(dto.getLicencia(), id)) {
            throw new BusinessException("Ya existe un conductor con esa licencia", "LICENCIA_DUPLICADA");
        }
        c.setNombres(dto.getNombres());
        c.setApellidos(dto.getApellidos());
        c.setDni(dto.getDni());
        c.setLicencia(dto.getLicencia());
        c.setCategoriaLic(dto.getCategoriaLic());
        c.setTelefono(dto.getTelefono());
        c.setEmail(dto.getEmail());
        c.setFechaVencLic(dto.getFechaVencLic());
        return ResponseEntity.ok(ApiResponse.ok(conductorRepository.save(c)));
    }

    @PatchMapping("/{id}/activo")
    public ResponseEntity<ApiResponse<Conductor>> toggleActivo(@PathVariable Long id) {
        Conductor c = conductorRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Conductor", id));
        c.setActivo(!c.isActivo());
        return ResponseEntity.ok(ApiResponse.ok(conductorRepository.save(c)));
    }

    @Data
    public static class ConductorDTO {
        @NotBlank @Size(max = 80)
        private String nombres;
        @NotBlank @Size(max = 80)
        private String apellidos;
        @NotBlank @Size(min = 8, max = 8) @Pattern(regexp = "\\d{8}")
        private String dni;
        @NotBlank @Size(max = 20)
        private String licencia;
        @Size(max = 10)
        private String categoriaLic;
        @Size(max = 20)
        private String telefono;
        @Size(max = 100)
        private String email;
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
        private LocalDate fechaVencLic;
    }
}
