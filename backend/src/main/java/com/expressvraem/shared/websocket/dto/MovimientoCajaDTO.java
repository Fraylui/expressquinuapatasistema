package com.expressvraem.shared.websocket.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record MovimientoCajaDTO(
        Long cajaId,
        String tipo,
        BigDecimal monto,
        BigDecimal totalAcumulado,
        LocalDateTime timestamp
) {}
