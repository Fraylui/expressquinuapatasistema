package com.expressvraem.modules.promociones.dto;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;

public record PromocionRequestDTO(

        @NotBlank(message = "El nombre es obligatorio")
        @Size(max = 100)
        String nombre,

        @Size(max = 300)
        String descripcion,

        /** Código de campaña publicitaria — opcional, se guarda en mayúsculas */
        @Size(max = 30)
        String codigo,

        @NotBlank(message = "El tipo de descuento es obligatorio")
        @Pattern(regexp = "^(PORCENTAJE|MONTO_FIJO|IDA_VUELTA)$",
                message = "tipoDescuento debe ser PORCENTAJE, MONTO_FIJO o IDA_VUELTA")
        String tipoDescuento,

        @NotNull(message = "El valor del descuento es obligatorio")
        @DecimalMin(value = "0.01", message = "El valor debe ser mayor a 0")
        @DecimalMax(value = "9999.99")
        BigDecimal valor,

        @NotBlank(message = "aplicaA es obligatorio")
        @Pattern(regexp = "^(PASAJES|ENCOMIENDAS|AMBOS)$",
                message = "aplicaA debe ser PASAJES, ENCOMIENDAS o AMBOS")
        String aplicaA,

        LocalDate fechaInicio,

        LocalDate fechaFin,

        Boolean activa,

        @Min(value = 1, message = "El límite de usos debe ser mayor a 0")
        Integer limiteUsos

) {}
