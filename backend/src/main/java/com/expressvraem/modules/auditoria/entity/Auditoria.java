package com.expressvraem.modules.auditoria.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "auditoria")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Auditoria {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "agencia_id")
    private Long agenciaId;

    @Column(name = "usuario_id")
    private Long usuarioId;

    @Column(name = "usuario_nombre", length = 100)
    private String usuarioNombre;

    @Column(length = 20)
    private String accion;

    @Column(length = 60)
    private String modulo;

    @Column(length = 60)
    private String entidad;

    @Column(name = "registro_id")
    private Long registroId;

    @Column(name = "datos_antes", columnDefinition = "TEXT")
    private String datosAntes;

    @Column(name = "datos_despues", columnDefinition = "TEXT")
    private String datosDespues;

    @Column(name = "ip_cliente", length = 45)
    private String ip;

    @Column(name = "user_agent", length = 256)
    private String userAgent;

    @Column(nullable = false)
    private LocalDateTime fecha;

    @Transient
    private String detalle;

    @PrePersist
    public void prePersist() {
        if (fecha == null) fecha = LocalDateTime.now();
    }
}
