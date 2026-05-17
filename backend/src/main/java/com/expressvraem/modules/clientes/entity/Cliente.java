package com.expressvraem.modules.clientes.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;


@Entity
@Table(name = "clientes")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Cliente {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "agencia_id", nullable = false)
    private Long agenciaId;

    @Builder.Default
    @Column(length = 10)
    private String tipo = "PERSONA"; // PERSONA | EMPRESA

    @Column(name = "razon_social", length = 200)
    private String razonSocial;

    @Column(nullable = false, length = 80)
    private String nombres;

    @Column(nullable = false, length = 80)
    private String apellidos;

    @Builder.Default
    @Column(name = "tipo_doc", nullable = false, length = 10)
    private String tipoDoc = "DNI";

    @Column(name = "num_doc", nullable = false, length = 20)
    private String numDoc;

    @Column(length = 20)
    private String telefono;

    @Column(length = 100)
    private String email;

    @Column(length = 8)
    private String dni;

    @Column(length = 11)
    private String ruc;

    @Column(length = 200)
    private String direccion;

    @Column(name = "fecha_registro")
    private LocalDateTime fechaRegistro;

    @Column(name = "fecha_nac")
    private LocalDate fechaNac;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        fechaRegistro = LocalDateTime.now();
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
