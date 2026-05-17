package com.expressvraem.modules.encomiendas.dto;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;

public record RegistrarEncomiendaDTO(
        @NotNull(message = "El remitente es obligatorio") Long remitenteId,
        @NotNull(message = "El destinatario es obligatorio") Long destinatarioId,
        Long viajeId,
        @NotBlank(message = "La descripción es obligatoria")
        @Size(max = 255, message = "La descripción no puede superar 255 caracteres") String descripcion,
        @Positive(message = "El peso debe ser un valor positivo")
        @DecimalMax(value = "9999.99", message = "El peso no puede superar 9999.99 kg") BigDecimal pesoKg,
        @FutureOrPresent(message = "La fecha de entrega no puede ser en el pasado") LocalDate fechaEntregaEst,
        @Size(max = 500, message = "Las observaciones no pueden superar 500 caracteres") String observaciones
) {}
