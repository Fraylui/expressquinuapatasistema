package com.expressvraem.modules.modulos.entity;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "modulos")
@Data
public class Modulo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 60)
    private String nombre;

    @Column(nullable = false, unique = true, length = 30)
    private String codigo;

    @Column(length = 200)
    private String descripcion;

    @Column(length = 40)
    private String icono;

    @Column(nullable = false)
    private Boolean activo = true;
}
