package com.expressvraem.modules.manifiestos.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "manifiestos")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Manifiesto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "agencia_id", nullable = false)
    private Long agenciaId;

    @Column(name = "viaje_id", nullable = false)
    private Long viajeId;

    @Column(name = "generado_por", nullable = false)
    private Long generadoPor;

    @Column(length = 20, nullable = false, unique = true)
    private String numero;

    @Builder.Default
    @Column(length = 20)
    private String estado = "BORRADOR";

    @Builder.Default
    @Column(name = "total_pasajeros")
    private Integer totalPasajeros = 0;

    @Builder.Default
    @Column(name = "total_encomiendas")
    private Integer totalEncomiendas = 0;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
