package com.expressvraem.modules.encomiendas.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "encomiendas")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Encomienda {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "agencia_id", nullable = false)
    private Long agenciaId;

    @Column(name = "agencia_origen_id")
    private Long agenciaOrigenId;

    @Column(name = "agencia_destino_id")
    private Long agenciaDestinoId;

    @Column(name = "codigo_tracking", length = 40, unique = true)
    private String codigoTracking;

    @Column(name = "remitente_id", nullable = false)
    private Long remitenteId;

    @Column(name = "destinatario_id", nullable = false)
    private Long destinatarioId;

    @Column(name = "viaje_id")
    private Long viajeId;

    @Column(name = "vendedor_id", nullable = false)
    private Long vendedorId;

    @Column(nullable = false)
    private String descripcion;

    @Column(name = "peso_kg", precision = 8, scale = 3)
    private BigDecimal pesoKg;

    @Column(name = "num_bultos")
    private Integer numBultos;

    @Builder.Default
    @Column(name = "es_fragil", nullable = false)
    private boolean esFragil = false;

    @Column(precision = 8, scale = 2)
    private BigDecimal monto;

    @Column(name = "precio_envio", nullable = false, precision = 8, scale = 2)
    private BigDecimal precioEnvio;

    @Builder.Default
    @Column(name = "monto_descuento", precision = 8, scale = 2)
    private BigDecimal montoDescuento = BigDecimal.ZERO;

    @Column(name = "promocion_id")
    private Long promocionId;

    @Column(name = "forma_cobro", length = 20)
    private String formaCobro; // EFECTIVO, TRANSFERENCIA, YAPE, PLIN, POR_COBRAR

    @Builder.Default
    @Column(length = 20)
    private String estado = "REGISTRADO";

    @Column(length = 5)
    private String serie;

    @Column(length = 10)
    private String correlativo;

    @Column(name = "fecha_registro")
    private LocalDateTime fechaRegistro;

    @Column(name = "fecha_entrega_est")
    private LocalDate fechaEntregaEst;

    @Column(name = "fecha_entrega_real")
    private LocalDateTime fechaEntregaReal;

    @Column(name = "recibido_por_dni", length = 20)
    private String recibidoPorDni;

    @Column(name = "recibido_por_nombre", length = 200)
    private String recibidoPorNombre;

    @Column(columnDefinition = "TEXT")
    private String observaciones;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        fechaRegistro = LocalDateTime.now();
        createdAt = LocalDateTime.now();
    }
}
