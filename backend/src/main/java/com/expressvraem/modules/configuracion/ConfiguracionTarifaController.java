package com.expressvraem.modules.configuracion;

import com.expressvraem.modules.tarifas.entity.Tarifa;
import com.expressvraem.modules.tarifas.repository.TarifaRepository;
import com.expressvraem.shared.exceptions.ApiResponse;
import com.expressvraem.shared.exceptions.BusinessException;
import com.expressvraem.shared.exceptions.ResourceNotFoundException;
import jakarta.persistence.EntityManager;
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
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/configuracion/tarifas")
@RequiredArgsConstructor
public class ConfiguracionTarifaController {

    private final TarifaRepository tarifaRepository;
    private final EntityManager    entityManager;

    // ── Listar ────────────────────────────────────────────────────────────────

    @GetMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE','ADMIN_AGENCIA','OPERADOR')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> listar(
            @RequestParam(required = false, defaultValue = "false") boolean soloVigentes) {

        List<Tarifa> tarifas = soloVigentes
                ? tarifaRepository.findByVigenteTrue()
                : tarifaRepository.findAll();

        Map<Long, String[]> rutaMap = cargarRutas(
                tarifas.stream().map(Tarifa::getRutaId).distinct().collect(Collectors.toList()));

        return ResponseEntity.ok(ApiResponse.ok(
                tarifas.stream().map(t -> toMap(t, rutaMap)).toList()));
    }

    // ── Detalle ───────────────────────────────────────────────────────────────

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE','ADMIN_AGENCIA','OPERADOR')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> detalle(@PathVariable Long id) {
        Tarifa t = tarifaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Tarifa", id));
        return ResponseEntity.ok(ApiResponse.ok(toMap(t, cargarRutas(List.of(t.getRutaId())))));
    }

    // ── Crear ─────────────────────────────────────────────────────────────────

    @PostMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE','ADMIN_AGENCIA')")
    @Transactional
    public ResponseEntity<ApiResponse<Map<String, Object>>> crear(@Valid @RequestBody TarifaDTO dto) {
        // Verificar duplicado: misma ruta + tipo + vigente en el catálogo compartido (agencia 1)
        boolean duplicado = !tarifaRepository
                .findVigenteConflicto(dto.getRutaId(), dto.getTipoVehiculo(), 1L, 0L)
                .isEmpty();
        if (duplicado) {
            throw new BusinessException(
                    "Ya existe una tarifa vigente para esa ruta y tipo de vehículo",
                    "TARIFA_DUPLICADA");
        }

        Tarifa t = new Tarifa();
        t.setAgenciaId(1L); // catálogo compartido de la empresa
        t.setRutaId(dto.getRutaId());
        t.setTemporadaId(dto.getTemporadaId());
        t.setTipoVehiculo(dto.getTipoVehiculo().toUpperCase().trim());
        t.setPrecio(dto.getPrecio());
        t.setVigente(true);

        Tarifa saved = tarifaRepository.save(t);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Tarifa creada",
                        toMap(saved, cargarRutas(List.of(saved.getRutaId())))));
    }

    // ── Actualizar ────────────────────────────────────────────────────────────

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE','ADMIN_AGENCIA')")
    @Transactional
    public ResponseEntity<ApiResponse<Map<String, Object>>> actualizar(
            @PathVariable Long id,
            @Valid @RequestBody TarifaDTO dto) {

        Tarifa t = tarifaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Tarifa", id));

        // Verificar conflicto excluyendo la propia tarifa
        boolean conflicto = !tarifaRepository
                .findVigenteConflicto(dto.getRutaId(), dto.getTipoVehiculo(), t.getAgenciaId(), id)
                .isEmpty();
        if (conflicto) {
            throw new BusinessException(
                    "Ya existe otra tarifa vigente para esa ruta y tipo de vehículo",
                    "TARIFA_DUPLICADA");
        }

        t.setRutaId(dto.getRutaId());
        t.setTemporadaId(dto.getTemporadaId());
        t.setTipoVehiculo(dto.getTipoVehiculo().toUpperCase().trim());
        t.setPrecio(dto.getPrecio());

        Tarifa saved = tarifaRepository.save(t);
        return ResponseEntity.ok(ApiResponse.ok("Tarifa actualizada",
                toMap(saved, cargarRutas(List.of(saved.getRutaId())))));
    }

    // ── Activar / Desactivar ──────────────────────────────────────────────────

    @PatchMapping("/{id}/vigente")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE','ADMIN_AGENCIA')")
    @Transactional
    public ResponseEntity<ApiResponse<Map<String, Object>>> cambiarVigente(
            @PathVariable Long id,
            @RequestBody Map<String, Boolean> body) {

        Boolean vigente = body.get("vigente");
        if (vigente == null) {
            throw new BusinessException("El campo 'vigente' es obligatorio", "CAMPO_REQUERIDO");
        }

        Tarifa t = tarifaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Tarifa", id));

        // Al reactivar, verificar que no genere duplicado vigente
        if (Boolean.TRUE.equals(vigente) && !t.getVigente()) {
            boolean conflicto = !tarifaRepository
                    .findVigenteConflicto(t.getRutaId(), t.getTipoVehiculo(), t.getAgenciaId(), id)
                    .isEmpty();
            if (conflicto) {
                throw new BusinessException(
                        "Ya existe otra tarifa vigente para esa ruta y tipo de vehículo",
                        "TARIFA_DUPLICADA");
            }
        }

        t.setVigente(vigente);
        Tarifa saved = tarifaRepository.save(t);
        String msg = vigente ? "Tarifa activada" : "Tarifa desactivada";
        return ResponseEntity.ok(ApiResponse.ok(msg,
                toMap(saved, cargarRutas(List.of(saved.getRutaId())))));
    }

    // ── Eliminar ──────────────────────────────────────────────────────────────

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE')")
    @Transactional
    public ResponseEntity<ApiResponse<Void>> eliminar(@PathVariable Long id) {
        Tarifa t = tarifaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Tarifa", id));

        if (Boolean.TRUE.equals(t.getVigente())) {
            throw new BusinessException(
                    "No se puede eliminar una tarifa vigente. Desactívala primero.",
                    "TARIFA_VIGENTE");
        }

        // Verificar que ningún pasaje usa esta tarifa
        Number count = (Number) entityManager
                .createNativeQuery("SELECT COUNT(*) FROM pasajes WHERE tarifa_id = :id")
                .setParameter("id", id)
                .getSingleResult();
        if (count.longValue() > 0) {
            throw new BusinessException(
                    "No se puede eliminar la tarifa porque tiene " + count.longValue()
                            + " pasaje(s) registrado(s). Solo puedes desactivarla.",
                    "TARIFA_CON_PASAJES");
        }

        tarifaRepository.delete(t);
        return ResponseEntity.ok(ApiResponse.ok("Tarifa eliminada", null));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private Map<Long, String[]> cargarRutas(List<Long> ids) {
        Map<Long, String[]> map = new HashMap<>();
        if (ids == null || ids.isEmpty()) return map;
        List<Object[]> rows = (List<Object[]>) entityManager
                .createNativeQuery("SELECT id, origen, destino FROM rutas WHERE id IN :ids")
                .setParameter("ids", ids)
                .getResultList();
        rows.forEach(r -> map.put(
                ((Number) r[0]).longValue(),
                new String[]{ String.valueOf(r[1]), String.valueOf(r[2]) }));
        return map;
    }

    private Map<String, Object> toMap(Tarifa t, Map<Long, String[]> rutaMap) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id",           t.getId());
        m.put("agenciaId",    t.getAgenciaId());
        m.put("rutaId",       t.getRutaId());
        m.put("temporadaId",  t.getTemporadaId());
        m.put("tipoVehiculo", t.getTipoVehiculo());
        m.put("precio",       t.getPrecio());
        m.put("vigente",      t.getVigente());
        String[] ruta = rutaMap.get(t.getRutaId());
        m.put("rutaOrigen",  ruta != null ? ruta[0] : null);
        m.put("rutaDestino", ruta != null ? ruta[1] : null);
        m.put("createdAt",   t.getCreatedAt());
        m.put("updatedAt",   t.getUpdatedAt());
        return m;
    }

    // ── DTO ───────────────────────────────────────────────────────────────────

    @Data
    public static class TarifaDTO {

        @NotNull(message = "La ruta es obligatoria")
        private Long rutaId;

        private Long temporadaId;

        @NotBlank(message = "El tipo de vehículo es obligatorio")
        @Pattern(regexp = "^(COMBI|CAMIONETA)$",
                message = "Tipo de vehículo debe ser COMBI o CAMIONETA")
        private String tipoVehiculo;

        @NotNull(message = "El precio es obligatorio")
        @DecimalMin(value = "0.10", message = "El precio mínimo es S/ 0.10")
        @DecimalMax(value = "9999.99", message = "El precio no puede superar S/ 9 999.99")
        @Digits(integer = 4, fraction = 2, message = "Formato de precio inválido")
        private BigDecimal precio;
    }
}
