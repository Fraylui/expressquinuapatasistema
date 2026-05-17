package com.expressvraem.shared.websocket.dto;

import java.time.LocalDateTime;

public record NotificacionDTO(
        String tipo,
        String titulo,
        String mensaje,
        String modulo,
        LocalDateTime timestamp
) {}
