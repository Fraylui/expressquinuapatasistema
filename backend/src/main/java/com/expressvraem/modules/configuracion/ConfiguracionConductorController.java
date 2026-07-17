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
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/configuracion/conductores")
@RequiredArgsConstructor
public class ConfiguracionConductorController {

    private final ConductorRepository conductorRepository;
    private final com.expressvraem.modules.auth.repository.UsuarioRepository usuarioRepository;

    // ── Listar ────────────────────────────────────────────────────────────────

    @GetMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE','ADMIN_AGENCIA','OPERADOR')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> listar(
            @RequestParam(required = false, defaultValue = "false") boolean soloActivos) {
        // Los conductores son de la empresa: todas las agencias ven la lista completa
        List<Conductor> lista = soloActivos
                ? conductorRepository.findByActivo(true)
                : conductorRepository.findAll();

        return ResponseEntity.ok(ApiResponse.ok(lista.stream().map(this::toMap).toList()));
    }

    // ── Detalle ───────────────────────────────────────────────────────────────

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE','ADMIN_AGENCIA','OPERADOR')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> detalle(@PathVariable Long id) {
        Conductor c = conductorRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Conductor", id));
        return ResponseEntity.ok(ApiResponse.ok(toMap(c)));
    }

    // ── Crear ─────────────────────────────────────────────────────────────────

    @PostMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE','ADMIN_AGENCIA')")
    @Transactional
    public ResponseEntity<ApiResponse<Map<String, Object>>> crear(@Valid @RequestBody ConductorDTO dto) {
        // Los conductores pertenecen a la empresa: la agencia es opcional
        // (GERENTE/SUPER_ADMIN no llevan agencia en el contexto)
        Long agenciaId = AgenciaContext.getAgenciaId();

        String dni      = dto.getDni().trim();
        String licencia = dto.getLicencia().toUpperCase().trim();

        if (conductorRepository.existsByDni(dni)) {
            throw new BusinessException("Ya existe un conductor con ese DNI", "DNI_DUPLICADO");
        }
        if (conductorRepository.existsByLicencia(licencia)) {
            throw new BusinessException("Ya existe un conductor con ese número de licencia", "LICENCIA_DUPLICADA");
        }

        // Si ya existe una cuenta con ese DNI (p. ej. el gerente que también maneja),
        // la ficha queda vinculada automáticamente: no hace falta una segunda cuenta.
        Long usuarioId = usuarioRepository.findByDni(dni)
                .map(u -> u.getId()).orElse(null);

        Conductor c = Conductor.builder()
                .agenciaId(agenciaId)
                .usuarioId(usuarioId)
                .nombres(dto.getNombres().trim())
                .apellidos(dto.getApellidos().trim())
                .dni(dni)
                .licencia(licencia)
                .categoriaLic(dto.getCategoriaLic())
                .telefono(dto.getTelefono())
                .email(dto.getEmail())
                .fechaVencLic(dto.getFechaVencLic())
                .activo(true)
                .build();

        Conductor saved = conductorRepository.save(c);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Conductor registrado", toMap(saved)));
    }

    // ── Actualizar ────────────────────────────────────────────────────────────

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE','ADMIN_AGENCIA')")
    @Transactional
    public ResponseEntity<ApiResponse<Map<String, Object>>> actualizar(
            @PathVariable Long id,
            @Valid @RequestBody ConductorDTO dto) {
        Conductor c = conductorRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Conductor", id));

        String dni      = dto.getDni().trim();
        String licencia = dto.getLicencia().toUpperCase().trim();

        if (conductorRepository.existsByDniAndIdNot(dni, id)) {
            throw new BusinessException("Ya existe un conductor con ese DNI", "DNI_DUPLICADO");
        }
        if (conductorRepository.existsByLicenciaAndIdNot(licencia, id)) {
            throw new BusinessException("Ya existe un conductor con ese número de licencia", "LICENCIA_DUPLICADA");
        }

        c.setNombres(dto.getNombres().trim());
        c.setApellidos(dto.getApellidos().trim());
        c.setDni(dni);
        c.setLicencia(licencia);
        c.setCategoriaLic(dto.getCategoriaLic());
        c.setTelefono(dto.getTelefono());
        c.setEmail(dto.getEmail());
        c.setFechaVencLic(dto.getFechaVencLic());

        Conductor saved = conductorRepository.save(c);
        return ResponseEntity.ok(ApiResponse.ok("Conductor actualizado", toMap(saved)));
    }

    // ── Activar / Desactivar ──────────────────────────────────────────────────

    @PatchMapping("/{id}/activo")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE','ADMIN_AGENCIA')")
    @Transactional
    public ResponseEntity<ApiResponse<Map<String, Object>>> cambiarActivo(
            @PathVariable Long id,
            @RequestBody Map<String, Boolean> body) {
        Boolean activo = body.get("activo");
        if (activo == null) {
            throw new BusinessException("El campo 'activo' es obligatorio", "CAMPO_REQUERIDO");
        }
        Conductor c = conductorRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Conductor", id));
        c.setActivo(activo);
        Conductor saved = conductorRepository.save(c);
        String msg = activo ? "Conductor activado" : "Conductor desactivado";
        return ResponseEntity.ok(ApiResponse.ok(msg, toMap(saved)));
    }

    // ── Renovar licencia ──────────────────────────────────────────────────────

    @PatchMapping("/{id}/licencia")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE','ADMIN_AGENCIA')")
    @Transactional
    public ResponseEntity<ApiResponse<Map<String, Object>>> renovarLicencia(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        String fechaStr = body.get("fechaVencLic");
        if (fechaStr == null || fechaStr.isBlank()) {
            throw new BusinessException(
                    "El campo 'fechaVencLic' es obligatorio (formato YYYY-MM-DD)", "CAMPO_REQUERIDO");
        }
        LocalDate nuevaFecha;
        try {
            nuevaFecha = LocalDate.parse(fechaStr);
        } catch (Exception e) {
            throw new BusinessException("Formato de fecha inválido. Use YYYY-MM-DD", "FECHA_INVALIDA");
        }
        if (!nuevaFecha.isAfter(LocalDate.now())) {
            throw new BusinessException(
                    "La nueva fecha de vencimiento debe ser posterior a hoy", "FECHA_PASADA");
        }

        Conductor c = conductorRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Conductor", id));
        c.setFechaVencLic(nuevaFecha);
        Conductor saved = conductorRepository.save(c);
        return ResponseEntity.ok(ApiResponse.ok("Licencia renovada hasta " + nuevaFecha, toMap(saved)));
    }

    // ── Eliminar ──────────────────────────────────────────────────────────────

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE')")
    @Transactional
    public ResponseEntity<ApiResponse<Void>> eliminar(@PathVariable Long id) {
        Conductor c = conductorRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Conductor", id));
        if (c.isActivo()) {
            throw new BusinessException(
                    "No se puede eliminar un conductor activo. Desactívalo primero.",
                    "CONDUCTOR_ACTIVO");
        }
        conductorRepository.delete(c);
        return ResponseEntity.ok(ApiResponse.ok("Conductor eliminado", null));
    }

    // ── Helper: enriquecer respuesta ──────────────────────────────────────────

    private Map<String, Object> toMap(Conductor c) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id",           c.getId());
        m.put("agenciaId",    c.getAgenciaId());
        m.put("usuarioId",    c.getUsuarioId());
        m.put("nombres",      c.getNombres());
        m.put("apellidos",    c.getApellidos());
        String n = c.getNombres() != null ? c.getNombres() : "";
        String a = c.getApellidos() != null ? c.getApellidos() : "";
        m.put("nombreCompleto", (n + " " + a).trim());
        m.put("dni",          c.getDni());
        m.put("licencia",     c.getLicencia());
        m.put("categoriaLic", c.getCategoriaLic());
        m.put("telefono",     c.getTelefono());
        m.put("email",        c.getEmail());
        m.put("fechaVencLic", c.getFechaVencLic());
        m.put("activo",       c.isActivo());
        m.put("createdAt",    c.getCreatedAt());
        m.put("updatedAt",    c.getUpdatedAt());

        // Alerta de vencimiento de licencia
        if (c.getFechaVencLic() != null) {
            long dias = ChronoUnit.DAYS.between(LocalDate.now(), c.getFechaVencLic());
            m.put("diasVencLic", dias);
            if (dias < 0) {
                m.put("alertaLicencia", "VENCIDA");
            } else if (dias <= 30) {
                m.put("alertaLicencia", "PROXIMA_A_VENCER");
            } else {
                m.put("alertaLicencia", "VIGENTE");
            }
        } else {
            m.put("diasVencLic",    null);
            m.put("alertaLicencia", "SIN_FECHA");
        }

        return m;
    }

    // ── DTO ───────────────────────────────────────────────────────────────────

    @Data
    public static class ConductorDTO {

        @NotBlank(message = "Nombres obligatorio")
        @Size(max = 80)
        private String nombres;

        @NotBlank(message = "Apellidos obligatorio")
        @Size(max = 80)
        private String apellidos;

        @NotBlank(message = "DNI obligatorio")
        @Size(min = 8, max = 8, message = "DNI debe tener exactamente 8 dígitos")
        @Pattern(regexp = "\\d{8}", message = "DNI debe contener solo dígitos")
        private String dni;

        @NotBlank(message = "Número de licencia obligatorio")
        @Size(max = 20)
        private String licencia;

        @Pattern(
            regexp = "^(A-I|A-IIa|A-IIb|A-IIIa|A-IIIb|A-IIIc|B-I|B-IIa|B-IIb|B-IIc)$",
            message = "Categoría inválida. Valores permitidos: A-I, A-IIa, A-IIb, A-IIIa, A-IIIb, A-IIIc, B-I, B-IIa, B-IIb, B-IIc"
        )
        private String categoriaLic;

        @Pattern(regexp = "9\\d{8}", message = "Teléfono debe tener 9 dígitos y empezar con 9")
        @Size(max = 20)
        private String telefono;

        @Email(message = "Email inválido")
        @Size(max = 100)
        private String email;

        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
        private LocalDate fechaVencLic;
    }
}
