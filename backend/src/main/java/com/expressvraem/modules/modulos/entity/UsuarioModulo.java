package com.expressvraem.modules.modulos.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.OffsetDateTime;

@Entity
@Table(name = "usuario_modulos")
@Data
public class UsuarioModulo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "usuario_id", nullable = false)
    private Long usuarioId;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "modulo_id", nullable = false)
    private Modulo modulo;

    @Column(nullable = false)
    private Boolean activo = true;

    @Column(name = "fecha_asignacion")
    private OffsetDateTime fechaAsignacion;

    @Column(name = "asignado_por")
    private Long asignadoPor;
}
