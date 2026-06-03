package com.expressvraem.modules.externas.dto;

import jakarta.validation.constraints.*;

public record EntregarEncomiendaExternaDTO(

        @NotBlank(message = "Nombre del receptor es obligatorio")
        @Size(max = 200)
        String receptorNombre,

        @NotBlank(message = "DNI del receptor es obligatorio")
        @Size(max = 20)
        String receptorDni,

        String nota,

        /** Requerido si estadoPago de la encomienda era PENDIENTE */
        String formaPago
) {}
