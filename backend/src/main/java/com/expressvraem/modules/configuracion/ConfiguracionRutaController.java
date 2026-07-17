package com.expressvraem.modules.configuracion;

import com.expressvraem.modules.rutas.entity.Ruta;
import com.expressvraem.modules.rutas.repository.RutaRepository;
import com.expressvraem.modules.viajes.repository.ViajeRepository;
import com.expressvraem.shared.exceptions.ApiResponse;
import com.expressvraem.shared.exceptions.BusinessException;
import com.expressvraem.shared.exceptions.ResourceNotFoundException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/configuracion/rutas")
@RequiredArgsConstructor
public class ConfiguracionRutaController {

    private final RutaRepository  rutaRepository;
    private final ViajeRepository viajeRepository;

    // ── Listar ────────────────────────────────────────────────────────────────

    @GetMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE','ADMIN_AGENCIA','OPERADOR')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> listar(
            @RequestParam(required = false, defaultValue = "false") boolean soloActivas) {
        List<Ruta> rutas = soloActivas
                ? rutaRepository.findByActivoTrue()
                : rutaRepository.findAll();
        return ResponseEntity.ok(ApiResponse.ok(rutas.stream().map(this::toMap).toList()));
    }

    // ── Detalle ───────────────────────────────────────────────────────────────

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE','ADMIN_AGENCIA','OPERADOR')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> detalle(@PathVariable Long id) {
        Ruta ruta = rutaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Ruta", id));
        return ResponseEntity.ok(ApiResponse.ok(toMap(ruta)));
    }

    // ── Crear ─────────────────────────────────────────────────────────────────

    @PostMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE','ADMIN_AGENCIA')")
    @Transactional
    public ResponseEntity<ApiResponse<Map<String, Object>>> crear(@Valid @RequestBody RutaDTO dto) {
        String codigo = dto.getCodigo().toUpperCase().trim();
        if (rutaRepository.existsByCodigoAndIdNot(codigo, 0L)) {
            throw new BusinessException("Ya existe una ruta con ese código", "CODIGO_DUPLICADO");
        }
        // El trayecto es único: no se permite crear dos veces la misma ruta
        boolean trayectoDuplicado = rutaRepository.findAll().stream().anyMatch(r ->
                r.getOrigen() != null && r.getOrigen().trim().equalsIgnoreCase(dto.getOrigen().trim())
                && r.getDestino() != null && r.getDestino().trim().equalsIgnoreCase(dto.getDestino().trim()));
        if (trayectoDuplicado) {
            throw new BusinessException(
                    "Ya existe la ruta " + dto.getOrigen().trim() + " → " + dto.getDestino().trim()
                            + ". Edítala o actívala en vez de crearla de nuevo.",
                    "RUTA_DUPLICADA");
        }
        // Validar que origen y destino no sean iguales
        if (dto.getOrigen().trim().equalsIgnoreCase(dto.getDestino().trim())) {
            throw new BusinessException("Origen y destino no pueden ser iguales", "RUTA_INVALIDA");
        }

        Ruta ruta = new Ruta();
        // Rutas son catálogo global de la empresa (agencia_id = 1)
        ruta.setAgenciaId(1L);
        ruta.setCodigo(codigo);
        ruta.setOrigen(capitalizar(dto.getOrigen()));
        ruta.setDestino(capitalizar(dto.getDestino()));
        ruta.setDistanciaKm(dto.getDistanciaKm());
        ruta.setDuracionMin(dto.getDuracionMin());
        ruta.setActivo(true);

        Ruta saved = rutaRepository.save(ruta);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Ruta creada", toMap(saved)));
    }

    // ── Actualizar ────────────────────────────────────────────────────────────

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE','ADMIN_AGENCIA')")
    @Transactional
    public ResponseEntity<ApiResponse<Map<String, Object>>> actualizar(
            @PathVariable Long id,
            @Valid @RequestBody RutaDTO dto) {
        Ruta ruta = rutaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Ruta", id));

        String codigo = dto.getCodigo().toUpperCase().trim();
        if (rutaRepository.existsByCodigoAndIdNot(codigo, id)) {
            throw new BusinessException("Ya existe una ruta con ese código", "CODIGO_DUPLICADO");
        }
        if (dto.getOrigen().trim().equalsIgnoreCase(dto.getDestino().trim())) {
            throw new BusinessException("Origen y destino no pueden ser iguales", "RUTA_INVALIDA");
        }

        ruta.setCodigo(codigo);
        ruta.setOrigen(capitalizar(dto.getOrigen()));
        ruta.setDestino(capitalizar(dto.getDestino()));
        ruta.setDistanciaKm(dto.getDistanciaKm());
        ruta.setDuracionMin(dto.getDuracionMin());

        Ruta saved = rutaRepository.save(ruta);
        return ResponseEntity.ok(ApiResponse.ok("Ruta actualizada", toMap(saved)));
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

        Ruta ruta = rutaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Ruta", id));

        // Al desactivar: advertir si hay viajes activos en esta ruta
        if (Boolean.FALSE.equals(activo)) {
            long viajesActivos = viajeRepository
                    .findByEstadoIn(List.of("PROGRAMADO", "EN_RUTA", "ATRASADO"))
                    .stream()
                    .filter(v -> id.equals(v.getRutaId()))
                    .count();
            if (viajesActivos > 0) {
                throw new BusinessException(
                        "No se puede desactivar la ruta porque tiene " + viajesActivos
                                + " viaje(s) activo(s) asignado(s).",
                        "RUTA_CON_VIAJES_ACTIVOS");
            }
        }

        ruta.setActivo(activo);
        Ruta saved = rutaRepository.save(ruta);
        String msg = activo ? "Ruta activada" : "Ruta desactivada";
        return ResponseEntity.ok(ApiResponse.ok(msg, toMap(saved)));
    }

    // ── Eliminar ──────────────────────────────────────────────────────────────

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE')")
    @Transactional
    public ResponseEntity<ApiResponse<Void>> eliminar(@PathVariable Long id) {
        Ruta ruta = rutaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Ruta", id));

        if (ruta.isActivo()) {
            throw new BusinessException(
                    "No se puede eliminar una ruta activa. Desactívala primero.",
                    "RUTA_ACTIVA");
        }

        // Verificar que no tenga viajes históricos referenciando esta ruta
        long totalViajes = viajeRepository.findAll().stream()
                .filter(v -> id.equals(v.getRutaId()))
                .count();
        if (totalViajes > 0) {
            throw new BusinessException(
                    "No se puede eliminar la ruta porque tiene " + totalViajes
                            + " viaje(s) registrado(s). Solo puedes desactivarla.",
                    "RUTA_CON_VIAJES");
        }

        rutaRepository.delete(ruta);
        return ResponseEntity.ok(ApiResponse.ok("Ruta eliminada", null));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Map<String, Object> toMap(Ruta r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id",           r.getId());
        m.put("codigo",       r.getCodigo());
        m.put("origen",       r.getOrigen());
        m.put("destino",      r.getDestino());
        m.put("distanciaKm",  r.getDistanciaKm());
        m.put("duracionMin",  r.getDuracionMin());
        m.put("duracionTexto", formatDuracion(r.getDuracionMin()));
        m.put("activo",       r.isActivo());
        m.put("createdAt",    r.getCreatedAt());
        m.put("updatedAt",    r.getUpdatedAt());
        return m;
    }

    private String formatDuracion(Integer minutos) {
        if (minutos == null || minutos <= 0) return null;
        int h = minutos / 60;
        int m = minutos % 60;
        if (h == 0) return m + " min";
        if (m == 0) return h + "h";
        return h + "h " + m + "min";
    }

    private String capitalizar(String s) {
        if (s == null || s.isBlank()) return s;
        String trimmed = s.trim();
        return Character.toUpperCase(trimmed.charAt(0)) + trimmed.substring(1).toLowerCase();
    }

    // ── DTO ───────────────────────────────────────────────────────────────────

    @Data
    public static class RutaDTO {

        @NotBlank(message = "Código obligatorio")
        @Size(min = 2, max = 10, message = "El código debe tener entre 2 y 10 caracteres")
        @Pattern(regexp = "^[A-Za-z0-9\\-]+$", message = "El código solo puede contener letras, números y guiones")
        private String codigo;

        @NotBlank(message = "Ciudad origen obligatoria")
        @Size(max = 80)
        private String origen;

        @NotBlank(message = "Ciudad destino obligatoria")
        @Size(max = 80)
        private String destino;

        @DecimalMin(value = "0.01", message = "La distancia debe ser mayor a 0")
        @DecimalMax(value = "99999.99", message = "La distancia es demasiado grande")
        private BigDecimal distanciaKm;

        @Min(value = 1, message = "La duración debe ser al menos 1 minuto")
        @Max(value = 10080, message = "La duración no puede superar 7 días (10 080 min)")
        private Integer duracionMin;
    }
}
