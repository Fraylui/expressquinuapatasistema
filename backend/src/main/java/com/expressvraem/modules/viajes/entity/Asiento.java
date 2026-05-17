package com.expressvraem.modules.viajes.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "asientos")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Asiento {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "agencia_id", nullable = false)
    private Long agenciaId;

    @Column(name = "viaje_id", nullable = false)
    private Long viajeId;

    @Column(nullable = false)
    private Integer numero;

    @Column(nullable = false, length = 20)
    private String estado;
}
