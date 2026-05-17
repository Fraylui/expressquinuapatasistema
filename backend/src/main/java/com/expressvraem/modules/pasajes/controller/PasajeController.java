package com.expressvraem.modules.pasajes.controller;

import com.expressvraem.modules.auth.repository.UsuarioRepository;
import com.expressvraem.modules.pasajes.dto.VentaPasajeDTO;
import com.expressvraem.modules.pasajes.entity.Pasaje;
import com.expressvraem.modules.pasajes.service.PasajeService;
import com.expressvraem.shared.annotations.RequiereModulo;
import com.expressvraem.shared.exceptions.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/pasajes")
@RequiredArgsConstructor
public class PasajeController {

    private final PasajeService pasajeService;
    private final UsuarioRepository usuarioRepository;

    @PostMapping("/vender")
    @RequiereModulo("VENTAS")
    public ResponseEntity<ApiResponse<Pasaje>> vender(
            @Valid @RequestBody VentaPasajeDTO dto,
            Authentication auth) {
        Long usuarioId = usuarioRepository.findByEmail(auth.getName())
                .map(u -> u.getId())
                .orElse(1L);

        String rol = auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .filter(a -> a.startsWith("ROLE_"))
                .map(a -> a.substring(5))
                .findFirst().orElse("OPERADOR");

        Pasaje pasaje = pasajeService.venderPasaje(dto, usuarioId, rol);
        return ResponseEntity.ok(ApiResponse.ok("Pasaje vendido correctamente", pasaje));
    }

    @GetMapping("/viaje/{viajeId}/asientos")
    public ResponseEntity<ApiResponse<List<Pasaje>>> asientosPorViaje(@PathVariable Long viajeId) {
        return ResponseEntity.ok(ApiResponse.ok(pasajeService.findByViaje(viajeId)));
    }

    @PostMapping("/{id}/anular")
    @RequiereModulo("VENTAS")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE','OPERADOR')")
    public ResponseEntity<ApiResponse<Void>> anular(@PathVariable Long id) {
        pasajeService.anularPasaje(id);
        return ResponseEntity.ok(ApiResponse.ok("Pasaje anulado correctamente", null));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<Pasaje>> detalle(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(pasajeService.findById(id)));
    }
}
