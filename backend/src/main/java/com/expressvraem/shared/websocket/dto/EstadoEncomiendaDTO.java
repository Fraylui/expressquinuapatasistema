package com.expressvraem.shared.websocket.dto;

import java.time.LocalDateTime;

public record EstadoEncomiendaDTO(
        String codigoTracking,
        String estadoAnterior,
        String estadoNuevo,
        String observacion,
        String usuario,
        LocalDateTime timestamp
) {}
