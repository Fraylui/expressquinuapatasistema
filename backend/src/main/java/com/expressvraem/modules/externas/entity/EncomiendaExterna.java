package com.expressvraem.modules.externas.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "encomiendas_externas")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class EncomiendaExterna {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long agenciaId;

    @Column(length = 20, unique = true, nullable = false)
    private String correlativo;

    @Column(nullable = false)
    private int secuencia;

    @Column(nullable = false)
    private int anio;

    // ── Conductor externo ─────────────────────────────────────────────────────
    @Column(length = 200, nullable = false)
    private String conductorNombre;

    @Column(length = 15, nullable = false)
    private String conductorDni;

    @Column(length = 20)
    private String conductorTel;

    @Column(length = 20)
    private String conductorPlaca;

    // ── Destinatario ──────────────────────────────────────────────────────────
    @Column(length = 200, nullable = false)
    private String destinatarioNombre;

    @Column(length = 20, nullable = false)
    private String destinatarioDni;

    @Column(length = 20)
    private String destinatarioTel;

    // ── Encomienda ────────────────────────────────────────────────────────────
    @Column(columnDefinition = "TEXT", nullable = false)
    private String descripcion;

    @Column(columnDefinition = "TEXT")
    private String observaciones;

    // ── Cobro ─────────────────────────────────────────────────────────────────
    @Column(precision = 8, scale = 2, nullable = false)
    private BigDecimal monto;

    @Builder.Default
    @Column(length = 20, nullable = false)
    private String estadoPago = "PENDIENTE"; // PENDIENTE | PAGADO

    @Column(length = 20)
    private String formaPago; // EFECTIVO | YAPE | PLIN | TRANSFERENCIA

    // ── Estado entrega ────────────────────────────────────────────────────────
    @Builder.Default
    @Column(length = 20, nullable = false)
    private String estado = "PENDIENTE"; // PENDIENTE | ENTREGADO

    private LocalDateTime fechaEntrega;

    @Column(name = "entregado_a", length = 200)
    private String entregadoA;

    @Column(name = "entregado_dni", length = 20)
    private String entregadoDni;

    // ── Operadores ────────────────────────────────────────────────────────────
    @Column(nullable = false)
    private Long operadorId;

    private Long operadorEntregaId;

    // ── Timestamps ────────────────────────────────────────────────────────────
    private LocalDateTime fechaRecepcion;
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        fechaRecepcion = LocalDateTime.now();
        createdAt      = LocalDateTime.now();
        anio           = fechaRecepcion.getYear();
    }
}
