package com.expressvraem.modules.vehiculos.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "vehiculos")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Vehiculo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** NULL = flota de la empresa (visible para todas las agencias) */
    @Column(name = "agencia_id")
    private Long agenciaId;

    @Column(nullable = false, unique = true, length = 10)
    private String placa;

    @Column(nullable = false, length = 20)
    private String tipo;

    @Column(length = 50)
    private String marca;

    @Column(length = 50)
    private String modelo;

    private Integer anio;

    @Column(nullable = false)
    private Integer capacidad;

    @Column(length = 30)
    private String color;

    @Column(name = "num_asientos", nullable = false)
    private Integer numAsientos;

    /** Conductor al que la empresa le entregó el vehículo (preseleccionado al programar viajes) */
    @Column(name = "conductor_habitual_id")
    private Long conductorHabitualId;

    @Column(nullable = false, length = 20)
    private String estado;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;
}
