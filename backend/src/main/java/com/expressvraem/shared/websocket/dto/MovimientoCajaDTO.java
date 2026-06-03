package com.expressvraem.shared.websocket.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record MovimientoCajaDTO(
        Long cajaId,
        Long movimientoId,
        String tipo,
        String referenciaTipo,
        String concepto,
        BigDecimal monto,
        BigDecimal saldoAcumulado,
        BigDecimal totalIngresos,
        BigDecimal totalEgresos,
        BigDecimal montoApertura,
        LocalDateTime timestamp
) {}
