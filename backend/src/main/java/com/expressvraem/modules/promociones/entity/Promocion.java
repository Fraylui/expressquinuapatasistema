package com.expressvraem.modules.promociones.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "promociones")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Promocion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String nombre;

    @Column(length = 300)
    private String descripcion;

    /** Código opcional de campaña (ej: "JULIO25"). Único, en mayúsculas. */
    @Column(length = 30, unique = true)
    private String codigo;

    /** PORCENTAJE | MONTO_FIJO | IDA_VUELTA */
    @Column(name = "tipo_descuento", nullable = false, length = 20)
    private String tipoDescuento;

    /** Porcentaje (20.00) o monto fijo en S/ (5.00) */
    @Column(nullable = false, precision = 6, scale = 2)
    private BigDecimal valor;

    /** PASAJES | ENCOMIENDAS | AMBOS */
    @Column(name = "aplica_a", nullable = false, length = 20)
    private String aplicaA;

    @Column(name = "fecha_inicio")
    private LocalDate fechaInicio;

    /** null = sin vencimiento */
    @Column(name = "fecha_fin")
    private LocalDate fechaFin;

    @Builder.Default
    @Column(nullable = false)
    private Boolean activa = true;

    /** null = usos ilimitados */
    @Column(name = "limite_usos")
    private Integer limiteUsos;

    @Builder.Default
    @Column(name = "usos_actuales", nullable = false)
    private Integer usosActuales = 0;

    /** null = aplica a todas las agencias */
    @Column(name = "agencia_id")
    private Long agenciaId;

    @Column(name = "creado_por", length = 100)
    private String creadoPor;

    @Column(name = "creado_en")
    private LocalDateTime creadoEn;

    @PrePersist
    public void prePersist() {
        creadoEn = LocalDateTime.now();
        if (usosActuales == null) usosActuales = 0;
    }
}
