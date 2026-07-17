package com.expressvraem.modules.manifiestos.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

@Data
public class ManifiestoDTO {

    private Long viajeId;
    private String estado;
    private OffsetDateTime fechaHoraSal;
    private OffsetDateTime fechaHoraArr;

    private String rutaOrigen;
    private String rutaDestino;
    private Double distanciaKm;

    private String vehiculoPlaca;
    private String vehiculoTipo;
    private Integer vehiculoAsientos;

    private String conductorNombre;
    private String conductorLicencia;

    private String agenciaNombre;
    private String agenciaDireccion;
    private String agenciaRuc;

    private List<PasajeroItem> pasajeros;
    private int totalPasajeros;
    private BigDecimal totalRecaudado;

    private List<EncomiendaItem> encomiendas;
    private int totalEncomiendas;
    private BigDecimal totalMontoEncomiendas;

    /** Título alternativo del PDF (null = manifiesto normal) */
    private String tituloDocumento;
    /** Etiqueta de la firma derecha (null = "Firma del Administrador") */
    private String firmaDerecha;

    @Data
    public static class PasajeroItem {
        private int item;
        private Long pasajeId;
        private String correlativo;
        private String nombres;
        private String apellidos;
        private String tipoDoc;
        private String numDoc;
        private Integer numAsiento;
        private BigDecimal precioFinal;
        private String formaPago;
        private String estadoPasaje;
    }

    @Data
    public static class EncomiendaItem {
        private int item;
        private Long encomiendaId;
        private Long agenciaDestinoId;
        private String agenciaDestino;
        private String codigoTracking;
        private String descripcion;
        private BigDecimal pesoKg;
        private Integer numBultos;
        private BigDecimal precioEnvio;
        private String formaCobro;
        private String estado;
        private String remitente;
        private String destinatario;
    }
}
