package com.expressvraem.modules.externas.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;

public record RegistrarEncomiendaExternaDTO(

        @NotBlank(message = "Nombre del conductor es obligatorio")
        @Size(max = 200)
        String conductorNombre,

        @NotBlank(message = "DNI del conductor es obligatorio")
        @Pattern(regexp = "\\d{8}", message = "DNI del conductor debe tener 8 dígitos")
        String conductorDni,

        @Size(max = 20)
        String conductorTel,

        @Size(max = 20)
        String conductorPlaca,

        @NotBlank(message = "Nombre del destinatario es obligatorio")
        @Size(max = 200)
        String destinatarioNombre,

        @NotBlank(message = "DNI del destinatario es obligatorio")
        @Size(max = 20)
        String destinatarioDni,

        @Size(max = 20)
        String destinatarioTel,

        @NotBlank(message = "Descripción de la encomienda es obligatoria")
        String descripcion,

        String observaciones,

        @NotNull(message = "Monto es obligatorio")
        @DecimalMin(value = "0.00", message = "Monto no puede ser negativo")
        BigDecimal monto,

        /** "PENDIENTE" = cobrar al destinatario al recoger | "PAGADO" = conductor ya pagó */
        @NotBlank(message = "Estado de pago es obligatorio")
        String estadoPago,

        /** Requerido si estadoPago = "PAGADO" */
        String formaPago
) {}
