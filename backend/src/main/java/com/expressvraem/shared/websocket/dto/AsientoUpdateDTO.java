package com.expressvraem.shared.websocket.dto;

import java.time.LocalDateTime;

public record AsientoUpdateDTO(
        Long viajeId,
        Integer asientoNumero,
        String estado,
        LocalDateTime timestamp
) {}
