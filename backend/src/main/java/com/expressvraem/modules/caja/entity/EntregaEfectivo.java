package com.expressvraem.modules.caja.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Rendición de efectivo: entrega periódica del dinero acumulado en una agencia
 * hacia gerencia. Flujo en dos pasos: la agencia declara (PENDIENTE) y
 * gerencia confirma contando el dinero (CONFIRMADA u OBSERVADA si no cuadra).
 */
@Entity
@Table(name = "entregas_efectivo")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class EntregaEfectivo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "agencia_id", nullable = false)
    private Long agenciaId;

    @Column(name = "usuario_entrega_id", nullable = false)
    private Long usuarioEntregaId;

    @Column(name = "usuario_confirma_id")
    private Long usuarioConfirmaId;

    @Column(nullable = false, length = 20, unique = true)
    private String numero;

    /** ENTREGA_DIRECTA | DEPOSITO_BANCARIO */
    @Builder.Default
    @Column(nullable = false, length = 20)
    private String modalidad = "ENTREGA_DIRECTA";

    @Column(name = "nro_operacion", length = 50)
    private String nroOperacion;

    @Column(name = "monto_declarado", nullable = false, precision = 10, scale = 2)
    private BigDecimal montoDeclarado;

    @Column(name = "monto_confirmado", precision = 10, scale = 2)
    private BigDecimal montoConfirmado;

    @Column(precision = 10, scale = 2)
    private BigDecimal diferencia;

    /** PENDIENTE | CONFIRMADA | OBSERVADA | ANULADA */
    @Builder.Default
    @Column(nullable = false, length = 20)
    private String estado = "PENDIENTE";

    @Column(columnDefinition = "TEXT")
    private String observaciones;

    @Column(name = "obs_confirmacion", columnDefinition = "TEXT")
    private String obsConfirmacion;

    @Column(name = "fecha_entrega", nullable = false)
    private LocalDateTime fechaEntrega;

    @Column(name = "fecha_confirmacion")
    private LocalDateTime fechaConfirmacion;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        createdAt = LocalDateTime.now();
        if (fechaEntrega == null) fechaEntrega = LocalDateTime.now();
    }
}
