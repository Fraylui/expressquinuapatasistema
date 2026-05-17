package com.expressvraem.modules.tarifas.dto;

import lombok.Data;
import java.math.BigDecimal;

@Data
public class TarifaResponseDTO {
    private Long id;
    private Long rutaId;
    private String rutaOrigen;
    private String rutaDestino;
    private String tipoVehiculo;
    private BigDecimal precio;
    private Boolean vigente;
}
