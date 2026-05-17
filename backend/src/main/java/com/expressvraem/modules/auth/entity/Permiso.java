package com.expressvraem.modules.auth.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "permisos")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Permiso {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 60)
    private String codigo;

    @Column(length = 60)
    private String modulo;

    @Column(length = 60)
    private String accion;

    @Column(length = 200)
    private String descripcion;
}
