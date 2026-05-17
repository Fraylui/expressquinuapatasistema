package com.expressvraem.modules.encomiendas.controller;

import com.expressvraem.modules.auth.repository.UsuarioRepository;
import com.expressvraem.modules.encomiendas.dto.RegistrarEncomiendaDTO;
import com.expressvraem.modules.encomiendas.entity.Encomienda;
import com.expressvraem.modules.encomiendas.entity.HistorialEncomienda;
import com.expressvraem.modules.encomiendas.service.EncomiendaService;
import com.expressvraem.shared.exceptions.ApiResponse;
import com.expressvraem.shared.exceptions.BusinessException;
import com.expressvraem.shared.middleware.AgenciaContext;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class EncomiendaController {

    private final EncomiendaService encomiendaService;
    private final UsuarioRepository usuarioRepository;

    private Long resolveUserId(Authentication auth) {
        return usuarioRepository.findByEmail(auth.getName())
                .orElseThrow(() -> new BusinessException("Usuario no encontrado", "USER_NOT_FOUND"))
                .getId();
    }

    @PostMapping("/api/encomiendas")
    public ResponseEntity<ApiResponse<Encomienda>> registrar(
            @Valid @RequestBody RegistrarEncomiendaDTO dto,
            Authentication auth) {
        Encomienda enc = encomiendaService.registrar(dto, resolveUserId(auth));
        return ResponseEntity.ok(ApiResponse.ok("Encomienda registrada", enc));
    }

    @GetMapping("/api/encomiendas/{id}")
    public ResponseEntity<ApiResponse<Encomienda>> detalle(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(encomiendaService.getLista(AgenciaContext.getAgenciaId(), null)
                .stream().filter(e -> e.getId().equals(id)).findFirst()
                .orElseThrow()));
    }

    @PatchMapping("/api/encomiendas/{id}/estado")
    public ResponseEntity<ApiResponse<Encomienda>> cambiarEstado(
            @PathVariable Long id,
            @RequestBody Map<String, String> body,
            Authentication auth) {
        String nuevoEstado = body.get("estado");
        String observacion = body.getOrDefault("observacion", "");
        return ResponseEntity.ok(ApiResponse.ok("Estado actualizado",
                encomiendaService.cambiarEstado(id, nuevoEstado, observacion, resolveUserId(auth))));
    }

    @GetMapping("/api/encomiendas/lista")
    public ResponseEntity<ApiResponse<List<Encomienda>>> lista(
            @RequestParam(required = false) String estado) {
        return ResponseEntity.ok(ApiResponse.ok(
                encomiendaService.getLista(AgenciaContext.getAgenciaId(), estado)));
    }

    @GetMapping("/api/encomiendas/{id}/historial")
    public ResponseEntity<ApiResponse<List<HistorialEncomienda>>> historial(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(encomiendaService.getHistorial(id)));
    }

    // Endpoint público para tracking (sin auth)
    @GetMapping("/api/tracking/{codigo}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> tracking(@PathVariable String codigo) {
        Encomienda enc = encomiendaService.getByTracking(codigo);
        List<HistorialEncomienda> historial = encomiendaService.getHistorial(enc.getId());

        Map<String, Object> result = Map.of(
                "codigo", enc.getCodigoTracking(),
                "estado", enc.getEstado(),
                "descripcion", enc.getDescripcion(),
                "fechaRegistro", enc.getFechaRegistro(),
                "fechaEntregaEst", enc.getFechaEntregaEst() != null ? enc.getFechaEntregaEst() : "",
                "historial", historial
        );
        return ResponseEntity.ok(ApiResponse.ok(result));
    }
}
