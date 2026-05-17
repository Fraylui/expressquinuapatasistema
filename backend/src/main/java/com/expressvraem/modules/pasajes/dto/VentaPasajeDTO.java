package com.expressvraem.modules.pasajes.dto;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;

public record VentaPasajeDTO(
        @NotNull(message = "El viaje es obligatorio") Long viajeId,
        @NotNull(message = "El asiento es obligatorio") Long asientoId,
        @NotNull(message = "El cliente es obligatorio") Long clienteId,
        @NotNull(message = "La tarifa es obligatoria") Long tarifaId,
        Long descuentoId,
        @PositiveOrZero(message = "El descuento no puede ser negativo")
        @DecimalMax(value = "9999.99", message = "El descuento no puede superar 9999.99") BigDecimal montoDescuento,
        @Pattern(regexp = "^(EFECTIVO|YAPE|PLIN|TRANSFERENCIA|TARJETA)?$",
                 message = "Forma de pago inválida") String formaPago
) {}
