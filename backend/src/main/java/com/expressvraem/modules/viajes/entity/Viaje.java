package com.expressvraem.modules.viajes.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

@Entity
@Table(name = "viajes")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Viaje {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "agencia_id", nullable = false)
    private Long agenciaId;

    @Column(name = "ruta_id", nullable = false)
    private Long rutaId;

    @Column(name = "vehiculo_id", nullable = false)
    private Long vehiculoId;

    @Column(name = "conductor_id", nullable = false)
    private Long conductorId;

    @Column(name = "fecha_hora_sal", nullable = false)
    private OffsetDateTime fechaHoraSal;

    @Column(name = "fecha_hora_arr")
    private OffsetDateTime fechaHoraArr;

    @Column(nullable = false, length = 20)
    private String estado;

    @Column(columnDefinition = "TEXT")
    private String observaciones;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;
}
