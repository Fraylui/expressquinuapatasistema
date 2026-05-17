package com.expressvraem.modules.encomiendas.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "historial_encomiendas")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class HistorialEncomienda {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "agencia_id", nullable = false)
    private Long agenciaId;

    @Column(name = "encomienda_id", nullable = false)
    private Long encomiendaId;

    @Column(name = "usuario_id", nullable = false)
    private Long usuarioId;

    @Column(name = "estado_anterior", length = 20)
    private String estadoAnterior;

    @Column(name = "estado_nuevo", nullable = false, length = 20)
    private String estadoNuevo;

    @Column(columnDefinition = "TEXT")
    private String observacion;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        createdAt = LocalDateTime.now();
    }
}
