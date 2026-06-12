package com.expressvraem.modules.configuracion;

import com.expressvraem.modules.temporadas.entity.Temporada;
import com.expressvraem.modules.temporadas.repository.TemporadaRepository;
import com.expressvraem.shared.exceptions.ApiResponse;
import com.expressvraem.shared.exceptions.BusinessException;
import com.expressvraem.shared.exceptions.ResourceNotFoundException;
import jakarta.persistence.EntityManager;
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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/configuracion/temporadas")
@RequiredArgsConstructor
public class ConfiguracionTemporadaController {

    private final TemporadaRepository temporadaRepository;
    private final EntityManager       entityManager;

    // ── Listar ────────────────────────────────────────────────────────────────

    @GetMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE','ADMIN_AGENCIA','OPERADOR')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> listar(
            @RequestParam(required = false, defaultValue = "false") boolean soloActivas) {

        List<Temporada> lista = soloActivas
                ? temporadaRepository.findByActivoTrueOrderByFechaIniAsc()
                : temporadaRepository.findAllByOrderByFechaIniAsc();

        return ResponseEntity.ok(ApiResponse.ok(lista.stream().map(this::toMap).toList()));
    }

    // ── Detalle ───────────────────────────────────────────────────────────────

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE','ADMIN_AGENCIA','OPERADOR')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> detalle(@PathVariable Long id) {
        Temporada t = temporadaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Temporada", id));
        return ResponseEntity.ok(ApiResponse.ok(toMap(t)));
    }

    // ── Crear ─────────────────────────────────────────────────────────────────

    @PostMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE','ADMIN_AGENCIA')")
    @Transactional
    public ResponseEntity<ApiResponse<Map<String, Object>>> crear(@Valid @RequestBody TemporadaDTO dto) {
        validarFechas(dto.getFechaIni(), dto.getFechaFin());

        List<Temporada> solapes = temporadaRepository.findSolapes(1L, 0L, dto.getFechaIni(), dto.getFechaFin());
        if (!solapes.isEmpty()) {
            throw new BusinessException(
                    "El rango de fechas se solapa con la temporada vigente: '" + solapes.get(0).getNombre() + "'",
                    "TEMPORADA_SOLAPADA");
        }

        Temporada t = new Temporada();
        t.setAgenciaId(1L); // catálogo compartido de la empresa
        t.setNombre(dto.getNombre().trim());
        t.setFechaIni(dto.getFechaIni());
        t.setFechaFin(dto.getFechaFin());
        t.setActivo(true);

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Temporada creada", toMap(temporadaRepository.save(t))));
    }

    // ── Actualizar ────────────────────────────────────────────────────────────

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE','ADMIN_AGENCIA')")
    @Transactional
    public ResponseEntity<ApiResponse<Map<String, Object>>> actualizar(
            @PathVariable Long id,
            @Valid @RequestBody TemporadaDTO dto) {

        Temporada t = temporadaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Temporada", id));

        validarFechas(dto.getFechaIni(), dto.getFechaFin());

        List<Temporada> solapes = temporadaRepository.findSolapes(t.getAgenciaId(), id, dto.getFechaIni(), dto.getFechaFin());
        if (!solapes.isEmpty()) {
            throw new BusinessException(
                    "El rango de fechas se solapa con la temporada vigente: '" + solapes.get(0).getNombre() + "'",
                    "TEMPORADA_SOLAPADA");
        }

        t.setNombre(dto.getNombre().trim());
        t.setFechaIni(dto.getFechaIni());
        t.setFechaFin(dto.getFechaFin());

        return ResponseEntity.ok(ApiResponse.ok("Temporada actualizada", toMap(temporadaRepository.save(t))));
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

        Temporada t = temporadaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Temporada", id));

        // Al reactivar, verificar que no genere solapamiento
        if (Boolean.TRUE.equals(activo) && !t.isActivo()) {
            List<Temporada> solapes = temporadaRepository.findSolapes(t.getAgenciaId(), id, t.getFechaIni(), t.getFechaFin());
            if (!solapes.isEmpty()) {
                throw new BusinessException(
                        "No se puede reactivar porque las fechas se solapan con: '" + solapes.get(0).getNombre() + "'",
                        "TEMPORADA_SOLAPADA");
            }
        }

        t.setActivo(activo);
        String msg = activo ? "Temporada activada" : "Temporada desactivada";
        return ResponseEntity.ok(ApiResponse.ok(msg, toMap(temporadaRepository.save(t))));
    }

    // ── Eliminar ──────────────────────────────────────────────────────────────

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE')")
    @Transactional
    public ResponseEntity<ApiResponse<Void>> eliminar(@PathVariable Long id) {
        Temporada t = temporadaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Temporada", id));

        if (t.isActivo()) {
            throw new BusinessException(
                    "No se puede eliminar una temporada activa. Desactívala primero.",
                    "TEMPORADA_ACTIVA");
        }

        Number count = (Number) entityManager
                .createNativeQuery("SELECT COUNT(*) FROM tarifas WHERE temporada_id = :id")
                .setParameter("id", id)
                .getSingleResult();
        if (count.longValue() > 0) {
            throw new BusinessException(
                    "No se puede eliminar la temporada porque tiene " + count.longValue()
                            + " tarifa(s) asignada(s). Solo puedes desactivarla.",
                    "TEMPORADA_CON_TARIFAS");
        }

        temporadaRepository.delete(t);
        return ResponseEntity.ok(ApiResponse.ok("Temporada eliminada", null));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void validarFechas(LocalDate ini, LocalDate fin) {
        if (fin.isBefore(ini)) {
            throw new BusinessException("La fecha de fin no puede ser anterior a la fecha de inicio", "FECHAS_INVALIDAS");
        }
        if (ini.equals(fin)) {
            throw new BusinessException("La temporada debe tener al menos un día de duración", "FECHAS_INVALIDAS");
        }
    }

    private Map<String, Object> toMap(Temporada t) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id",        t.getId());
        m.put("agenciaId", t.getAgenciaId());
        m.put("nombre",    t.getNombre());
        m.put("fechaIni",  t.getFechaIni());
        m.put("fechaFin",  t.getFechaFin());
        m.put("activo",    t.isActivo());
        // ChronoUnit.DAYS: until().getDays() devuelve solo el componente "días"
        // del Period (ene→jun = "5 meses y 29 días" → 29), no el total
        m.put("duracionDias", t.getFechaIni() != null && t.getFechaFin() != null
                ? java.time.temporal.ChronoUnit.DAYS.between(t.getFechaIni(), t.getFechaFin()) + 1
                : null);
        m.put("createdAt", t.getCreatedAt());
        m.put("updatedAt", t.getUpdatedAt());
        return m;
    }

    // ── DTO ───────────────────────────────────────────────────────────────────

    @Data
    public static class TemporadaDTO {

        @NotBlank(message = "El nombre es obligatorio")
        @Size(min = 3, max = 60, message = "El nombre debe tener entre 3 y 60 caracteres")
        private String nombre;

        @NotNull(message = "La fecha de inicio es obligatoria")
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
        private LocalDate fechaIni;

        @NotNull(message = "La fecha de fin es obligatoria")
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
        private LocalDate fechaFin;
    }
}
