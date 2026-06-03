package com.expressvraem.modules.promociones.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record PromocionResponseDTO(
        Long id,
        String nombre,
        String descripcion,
        String codigo,
        String tipoDescuento,
        BigDecimal valor,
        String aplicaA,
        LocalDate fechaInicio,
        LocalDate fechaFin,
        boolean activa,
        boolean vigente,
        Integer limiteUsos,
        int usosActuales,
        Long agenciaId,
        LocalDateTime creadoEn
) {}
