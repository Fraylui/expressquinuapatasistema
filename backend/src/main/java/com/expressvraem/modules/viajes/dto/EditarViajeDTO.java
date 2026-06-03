package com.expressvraem.modules.viajes.dto;

import jakarta.validation.constraints.NotNull;
import java.time.OffsetDateTime;

public record EditarViajeDTO(
        @NotNull Long conductorId,
        Long vehiculoId,           // null = mantener el vehículo actual
        @NotNull OffsetDateTime fechaHoraSal,
        String observaciones
) {}
