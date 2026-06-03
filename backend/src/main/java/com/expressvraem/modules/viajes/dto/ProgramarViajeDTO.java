package com.expressvraem.modules.viajes.dto;

import jakarta.validation.constraints.NotNull;
import java.time.OffsetDateTime;

public record ProgramarViajeDTO(
        @NotNull Long rutaId,
        @NotNull Long vehiculoId,
        @NotNull Long conductorId,
        @NotNull OffsetDateTime fechaHoraSal,
        String observaciones
) {}
