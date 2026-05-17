package com.expressvraem.modules.caja.controller;

import com.expressvraem.modules.auth.repository.UsuarioRepository;
import com.expressvraem.modules.caja.entity.Caja;
import com.expressvraem.modules.caja.entity.MovimientoCaja;
import com.expressvraem.modules.caja.service.CajaService;
import com.expressvraem.shared.exceptions.ApiResponse;
import com.expressvraem.shared.exceptions.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/caja")
@RequiredArgsConstructor
public class CajaController {

    private final CajaService cajaService;
    private final UsuarioRepository usuarioRepository;

    private Long resolveUserId(Authentication auth) {
        return usuarioRepository.findByEmail(auth.getName())
                .orElseThrow(() -> new BusinessException("Usuario no encontrado", "USER_NOT_FOUND"))
                .getId();
    }

    @PostMapping("/abrir")
    public ResponseEntity<ApiResponse<Caja>> abrir(
            @RequestBody Map<String, Object> body,
            Authentication auth) {
        BigDecimal montoInicial = new BigDecimal(String.valueOf(body.getOrDefault("montoInicial", "200")));
        Caja caja = cajaService.abrirCaja(resolveUserId(auth), montoInicial);
        return ResponseEntity.ok(ApiResponse.ok("Caja abierta", caja));
    }

    @PostMapping("/movimiento")
    public ResponseEntity<ApiResponse<MovimientoCaja>> registrarMovimiento(
            @RequestBody Map<String, Object> body,
            Authentication auth) {
        Long cajaId = Long.valueOf(String.valueOf(body.get("cajaId")));
        String tipo = String.valueOf(body.get("tipo"));
        String concepto = String.valueOf(body.get("concepto"));
        BigDecimal monto = new BigDecimal(String.valueOf(body.get("monto")));

        MovimientoCaja mov = cajaService.registrarMovimiento(cajaId, tipo, concepto, monto, resolveUserId(auth), null, null);
        return ResponseEntity.ok(ApiResponse.ok("Movimiento registrado", mov));
    }

    @PostMapping("/cerrar")
    public ResponseEntity<ApiResponse<Caja>> cerrar(
            @RequestBody Map<String, Object> body,
            Authentication auth) {
        Long cajaId = Long.valueOf(String.valueOf(body.get("cajaId")));
        BigDecimal montoFisico = new BigDecimal(String.valueOf(body.get("montoFisico")));
        String obs = String.valueOf(body.getOrDefault("observaciones", ""));
        Caja caja = cajaService.cerrarCaja(cajaId, montoFisico, obs);
        return ResponseEntity.ok(ApiResponse.ok("Caja cerrada", caja));
    }

    @GetMapping("/turno-actual")
    public ResponseEntity<ApiResponse<Map<String, Object>>> turnoActual(Authentication auth) {
        Caja caja = cajaService.getTurnoActual(resolveUserId(auth));
        return ResponseEntity.ok(ApiResponse.ok(cajaService.getResumenTurno(caja.getId())));
    }

    @GetMapping("/movimientos/{cajaId}")
    public ResponseEntity<ApiResponse<List<MovimientoCaja>>> movimientos(@PathVariable Long cajaId) {
        return ResponseEntity.ok(ApiResponse.ok(cajaService.getMovimientos(cajaId)));
    }
}
