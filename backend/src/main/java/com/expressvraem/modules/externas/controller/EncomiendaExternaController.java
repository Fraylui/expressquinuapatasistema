package com.expressvraem.modules.externas.controller;

import com.expressvraem.modules.auth.entity.Usuario;
import com.expressvraem.modules.auth.repository.UsuarioRepository;
import com.expressvraem.modules.externas.dto.EntregarEncomiendaExternaDTO;
import com.expressvraem.modules.externas.dto.RegistrarEncomiendaExternaDTO;
import com.expressvraem.modules.externas.entity.EncomiendaExterna;
import com.expressvraem.modules.externas.service.EncomiendaExternaService;
import com.expressvraem.modules.externas.service.EncomiendaExternaTicketPdfService;
import com.expressvraem.shared.exceptions.ApiResponse;
import com.expressvraem.shared.exceptions.BusinessException;
import com.expressvraem.shared.middleware.AgenciaContext;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/encomiendas-externas")
@RequiredArgsConstructor
public class EncomiendaExternaController {

    private final EncomiendaExternaService service;
    private final EncomiendaExternaTicketPdfService pdfService;
    private final UsuarioRepository usuarioRepository;

    private Long resolveUserId(Authentication auth) {
        return usuarioRepository.findByEmail(auth.getName())
                .orElseThrow(() -> new BusinessException("Usuario no encontrado", "USER_NOT_FOUND"))
                .getId();
    }

    private Long resolveAgenciaId(Authentication auth) {
        Long fromContext = AgenciaContext.getAgenciaId();
        if (fromContext != null) return fromContext;
        return usuarioRepository.findByEmail(auth.getName())
                .map(Usuario::getAgenciaId)
                .orElse(null);
    }

    private String resolveNombre(Authentication auth) {
        try {
            var u = usuarioRepository.findByEmail(auth.getName()).orElse(null);
            if (u != null) {
                String n = u.getNombres() != null ? u.getNombres() : "";
                String a = u.getApellidos() != null ? u.getApellidos() : "";
                return (n + " " + a).trim();
            }
        } catch (Exception ignored) {}
        return auth.getName();
    }

    // ── Registrar ───────────────────────────────────────────────────────────────

    @PostMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE','ADMIN_AGENCIA','OPERADOR')")
    public ResponseEntity<ApiResponse<EncomiendaExterna>> registrar(
            @Valid @RequestBody RegistrarEncomiendaExternaDTO dto,
            Authentication auth) {
        EncomiendaExterna enc = service.registrar(dto, resolveUserId(auth), resolveAgenciaId(auth));
        return ResponseEntity.ok(ApiResponse.ok("Encomienda externa registrada", enc));
    }

    // ── Listar ──────────────────────────────────────────────────────────────────

    @GetMapping("/lista")
    public ResponseEntity<ApiResponse<List<EncomiendaExterna>>> lista(
            @RequestParam(required = false) String estado,
            Authentication auth) {
        Long agenciaId = resolveAgenciaId(auth);
        return ResponseEntity.ok(ApiResponse.ok(service.getLista(agenciaId, estado)));
    }

    // ── Entregar ────────────────────────────────────────────────────────────────

    @PostMapping("/{id}/entregar")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE','ADMIN_AGENCIA','OPERADOR')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> entregar(
            @PathVariable Long id,
            @Valid @RequestBody EntregarEncomiendaExternaDTO dto,
            Authentication auth) {
        Map<String, Object> result = service.entregar(id, dto, resolveUserId(auth), resolveAgenciaId(auth));
        return ResponseEntity.ok(ApiResponse.ok("Encomienda entregada", result));
    }

    // ── Ticket PDF ──────────────────────────────────────────────────────────────

    @GetMapping("/{id}/ticket")
    public ResponseEntity<byte[]> ticket(@PathVariable Long id, Authentication auth) {
        EncomiendaExterna enc = service.getById(id);
        byte[] pdf = pdfService.generarTicket(enc, resolveNombre(auth));
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=ticket-" + enc.getCorrelativo() + ".pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }
}
