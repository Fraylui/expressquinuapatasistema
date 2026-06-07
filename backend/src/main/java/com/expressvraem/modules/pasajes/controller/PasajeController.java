package com.expressvraem.modules.pasajes.controller;

import com.expressvraem.modules.auth.entity.Usuario;
import com.expressvraem.modules.auth.repository.UsuarioRepository;
import com.expressvraem.modules.pasajes.dto.PasajeResponseDTO;
import com.expressvraem.modules.pasajes.dto.VentaPasajeDTO;
import com.expressvraem.modules.pasajes.entity.Pasaje;
import com.expressvraem.modules.pasajes.service.PasajeService;
import com.expressvraem.modules.pasajes.service.TicketPdfService;
import com.expressvraem.modules.viajes.entity.Asiento;
import com.expressvraem.shared.annotations.RequiereModulo;
import com.expressvraem.shared.exceptions.ApiResponse;
import com.expressvraem.shared.exceptions.BusinessException;
import com.expressvraem.shared.middleware.AgenciaContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/pasajes")
@RequiredArgsConstructor
public class PasajeController {

    private final PasajeService pasajeService;
    private final TicketPdfService ticketPdfService;
    private final UsuarioRepository usuarioRepository;

    private Usuario resolveUser(Authentication auth) {
        return usuarioRepository.findByEmail(auth.getName())
                .orElseThrow(() -> new BusinessException("Usuario no encontrado", "USER_NOT_FOUND"));
    }

    private String extraerIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        return (xff != null && !xff.isBlank()) ? xff.split(",")[0].trim() : request.getRemoteAddr();
    }

    @PostMapping("/vender")
    @RequiereModulo("VENTAS")
    public ResponseEntity<ApiResponse<PasajeResponseDTO>> vender(
            @Valid @RequestBody VentaPasajeDTO dto,
            Authentication auth,
            HttpServletRequest request) {
        var u = resolveUser(auth);
        PasajeResponseDTO result = pasajeService.venderPasaje(
                dto, u.getId(), extraerIp(request), u.getNombres() + " " + u.getApellidos());
        return ResponseEntity.ok(ApiResponse.ok("Pasaje vendido", result));
    }

    @GetMapping("/viaje/{viajeId}/asientos")
    public ResponseEntity<ApiResponse<List<Asiento>>> asientosPorViaje(@PathVariable Long viajeId) {
        return ResponseEntity.ok(ApiResponse.ok(pasajeService.getAsientosPorViaje(viajeId)));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<PasajeResponseDTO>>> lista(
            @RequestParam(required = false) String estado,
            @RequestParam(required = false) String codigoBoleta,
            @RequestParam(required = false) String clienteBusqueda) {
        Long agenciaId = AgenciaContext.getAgenciaId();
        return ResponseEntity.ok(ApiResponse.ok(pasajeService.getLista(agenciaId, estado, codigoBoleta, clienteBusqueda)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<Pasaje>> detalle(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(pasajeService.findById(id)));
    }

    @PostMapping("/{id}/confirmar")
    @RequiereModulo("VENTAS")
    public ResponseEntity<ApiResponse<PasajeResponseDTO>> confirmar(
            @PathVariable Long id,
            @RequestBody Map<String, String> body,
            Authentication auth,
            HttpServletRequest request) {
        String formaPago = body.getOrDefault("formaPago", "EFECTIVO");
        var u = resolveUser(auth);
        PasajeResponseDTO result = pasajeService.confirmarReserva(
                id, formaPago, u.getId(), extraerIp(request), u.getNombres() + " " + u.getApellidos());
        return ResponseEntity.ok(ApiResponse.ok("Reserva confirmada y pagada", result));
    }

    @PostMapping("/{id}/anular")
    @RequiereModulo("VENTAS")
    public ResponseEntity<ApiResponse<Void>> anular(
            @PathVariable Long id,
            @RequestBody Map<String, String> body,
            Authentication auth,
            HttpServletRequest request) {
        String motivo = body.getOrDefault("motivoAnulacion", "");
        var u = resolveUser(auth);
        pasajeService.anularPasaje(id, motivo, u.getId(), extraerIp(request), u.getNombres() + " " + u.getApellidos());
        return ResponseEntity.ok(ApiResponse.ok("Pasaje anulado", null));
    }

    @GetMapping(value = "/{id}/ticket", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> ticket(@PathVariable Long id) {
        Pasaje p = pasajeService.findById(id);
        byte[] pdf = ticketPdfService.generarTicket(p);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=\"ticket-" + p.getCodigoBoleta() + ".pdf\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }
}
