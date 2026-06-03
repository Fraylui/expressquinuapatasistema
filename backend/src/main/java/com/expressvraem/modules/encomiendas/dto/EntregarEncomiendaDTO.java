package com.expressvraem.modules.encomiendas.dto;

import jakarta.validation.constraints.*;

public record EntregarEncomiendaDTO(

        @NotBlank(message = "DNI del receptor obligatorio")
        @Pattern(regexp = "\\d{8}", message = "DNI debe tener 8 dígitos")
        String dniReceptor,

        @NotBlank(message = "Nombre del receptor obligatorio")
        @Size(max = 200)
        String nombreReceptor,

        @Size(max = 500)
        String nota,

        // Only used when formaCobro = POR_COBRAR
        String formaPago

) {}
