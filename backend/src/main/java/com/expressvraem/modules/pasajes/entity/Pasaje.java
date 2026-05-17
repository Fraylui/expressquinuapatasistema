package com.expressvraem.modules.pasajes.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "pasajes")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Pasaje {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "agencia_id", nullable = false)
    private Long agenciaId;

    @Column(name = "viaje_id", nullable = false)
    private Long viajeId;

    @Column(name = "asiento_id", nullable = false)
    private Long asientoId;

    @Column(name = "cliente_id", nullable = false)
    private Long clienteId;

    @Column(name = "tarifa_id", nullable = false)
    private Long tarifaId;

    @Column(name = "vendedor_id", nullable = false)
    private Long vendedorId;

    @Column(name = "descuento_id")
    private Long descuentoId;

    @Column(name = "precio_base", nullable = false, precision = 8, scale = 2)
    private BigDecimal precioBase;

    @Builder.Default
    @Column(name = "monto_descuento", precision = 8, scale = 2)
    private BigDecimal montoDescuento = BigDecimal.ZERO;

    @Column(name = "precio_final", nullable = false, precision = 8, scale = 2)
    private BigDecimal precioFinal;

    @Builder.Default
    @Column(name = "forma_pago", length = 20)
    private String formaPago = "EFECTIVO";

    @Builder.Default
    @Column(length = 20)
    private String estado = "EMITIDO";

    @Column(name = "codigo_pasaje", length = 20)
    private String codigoPasaje;

    @Column(length = 5)
    private String serie;

    @Column(length = 10)
    private String correlativo;

    @Column(name = "fecha_emision")
    private LocalDateTime fechaEmision;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        fechaEmision = LocalDateTime.now();
        createdAt = LocalDateTime.now();
    }
}
