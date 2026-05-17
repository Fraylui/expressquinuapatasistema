package com.expressvraem.modules.pasajes.dto;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;

public record VentaPasajeDTO(

        @NotNull(message = "El viaje es obligatorio")
        Long viajeId,

        @NotNull(message = "El número de asiento es obligatorio")
        Integer asientoNumero,

        /* ── Cliente inline ───────────────────── */
        @NotBlank(message = "El DNI del cliente es obligatorio")
        @Pattern(regexp = "^\\d{8}$", message = "El DNI debe tener exactamente 8 dígitos")
        String clienteDni,

        @NotBlank(message = "Los nombres del cliente son obligatorios")
        String clienteNombres,

        @NotBlank(message = "Los apellidos del cliente son obligatorios")
        String clienteApellidos,

        @NotBlank(message = "El teléfono es obligatorio")
        @Pattern(regexp = "^9\\d{8}$",
                message = "El teléfono debe tener 9 dígitos y empezar en 9")
        String clienteTelefono,

        String clienteDireccion,

        /* ── Precio ───────────────────────────── */
        @NotNull(message = "El precio base es obligatorio")
        @Positive(message = "El precio debe ser mayor a 0")
        BigDecimal precioBase,

        @NotNull(message = "El descuento es obligatorio")
        @DecimalMin(value = "0.00", message = "El descuento no puede ser negativo")
        BigDecimal descuento,

        /* ── Forma de pago ────────────────────── */
        @NotBlank(message = "La forma de pago es obligatoria")
        @Pattern(regexp = "^(EFECTIVO|TRANSFERENCIA|YAPE|PLIN)$",
                message = "Forma de pago inválida")
        String formaPago,

        String motivoDescuento

) {
    public BigDecimal precioFinal() {
        return precioBase.subtract(descuento == null ? BigDecimal.ZERO : descuento);
    }
}
