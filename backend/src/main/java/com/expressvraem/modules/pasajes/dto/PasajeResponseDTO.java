package com.expressvraem.modules.pasajes.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record PasajeResponseDTO(
        Long id,
        String codigoBoleta,
        Long viajeId,
        Integer asientoNumero,
        Long clienteId,
        String clienteNombres,
        String clienteApellidos,
        String clienteDni,
        BigDecimal precioBase,
        BigDecimal descuento,
        BigDecimal precioFinal,
        String formaPago,
        /** Destino del pasajero (null = destino final de la ruta del viaje) */
        String destino,
        String estado,
        LocalDateTime fechaVenta
) {}
