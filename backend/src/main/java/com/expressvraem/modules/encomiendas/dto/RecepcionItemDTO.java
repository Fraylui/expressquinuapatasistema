package com.expressvraem.modules.encomiendas.dto;

public record RecepcionItemDTO(
        Long encomiendaId,
        boolean recibido,
        String observacion
) {}
