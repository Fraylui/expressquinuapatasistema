package com.expressvraem.modules.agencias.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "agencias")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Agencia {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 20)
    private String codigo;

    @Column(nullable = false, length = 200)
    private String nombre;

    @Column(nullable = false, length = 100)
    private String ciudad;

    @Column(nullable = false, length = 300)
    private String direccion;

    @Column(nullable = false, length = 20)
    private String telefono;

    @Column(length = 150)
    private String email;

    @Column(length = 11)
    private String ruc;

    @Column(name = "encargado_id")
    private Long encargadoId;

    @Builder.Default
    @Column(nullable = false, length = 10)
    private String estado = "ACTIVA";

    @Builder.Default
    @Column(name = "es_sede_principal", nullable = false)
    private boolean esSedePrincipal = false;

    @Column(name = "fecha_apertura")
    private LocalDate fechaApertura;

    @Builder.Default
    @Column(name = "fecha_registro", nullable = false)
    private LocalDateTime fechaRegistro = LocalDateTime.now();

    // Legacy columns (kept for DB compat)
    @Column(length = 80)
    private String departamento;

    @Builder.Default
    @Column(nullable = false)
    private boolean activo = true;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (fechaRegistro == null) fechaRegistro = LocalDateTime.now();
        if (estado == null) estado = "ACTIVA";
        // Keep legacy activo in sync
        activo = "ACTIVA".equals(estado);
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
        activo = "ACTIVA".equals(estado);
    }
}
