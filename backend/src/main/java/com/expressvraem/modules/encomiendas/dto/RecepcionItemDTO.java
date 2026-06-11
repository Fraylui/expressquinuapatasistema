package com.expressvraem.modules.encomiendas.dto;

import jakarta.validation.constraints.NotNull;

public record RecepcionItemDTO(
        @NotNull(message = "encomiendaId es obligatorio")
        Long encomiendaId,
        boolean recibido,
        String observacion
) {}
