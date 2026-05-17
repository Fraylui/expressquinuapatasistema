package com.expressvraem.shared.utils;

import com.expressvraem.shared.exceptions.BusinessException;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Service
public class PrecioCalculator {

    public BigDecimal calcularPrecioPasaje(BigDecimal base,
                                           BigDecimal porcentajeTemporada,
                                           BigDecimal descuento,
                                           String rol) {
        BigDecimal precio = base;

        if (porcentajeTemporada != null && porcentajeTemporada.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal incremento = base.multiply(porcentajeTemporada)
                    .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
            precio = precio.add(incremento);
        }

        BigDecimal maxDescuento = switch (rol) {
            case "OPERADOR" -> BigDecimal.valueOf(5);
            case "SUPERVISOR" -> BigDecimal.valueOf(10);
            default -> precio;
        };

        if (descuento != null && descuento.compareTo(BigDecimal.ZERO) > 0) {
            if (descuento.compareTo(maxDescuento) > 0) {
                throw new BusinessException(
                        "Descuento excede el límite permitido para el rol " + rol + ": S/" + maxDescuento,
                        "DESCUENTO_EXCEDIDO");
            }
            precio = precio.subtract(descuento);
        }

        return precio.max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
    }

    public BigDecimal calcularPrecioEncomienda(BigDecimal pesoKg, Integer distanciaKm) {
        BigDecimal base = BigDecimal.valueOf(5.00);
        BigDecimal precioPeso = pesoKg != null
                ? pesoKg.multiply(BigDecimal.valueOf(2.00))
                : BigDecimal.ZERO;
        BigDecimal precioDistancia = distanciaKm != null
                ? BigDecimal.valueOf(distanciaKm).multiply(BigDecimal.valueOf(0.05))
                : BigDecimal.ZERO;

        BigDecimal total = base.add(precioPeso).add(precioDistancia);
        BigDecimal minimo = BigDecimal.valueOf(8.00);
        return total.max(minimo).setScale(2, RoundingMode.HALF_UP);
    }
}
