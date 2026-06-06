package com.expressvraem.modules.empresa.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "empresa_config")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class EmpresaConfig {

    @Id
    private Long id;  // siempre 1 (single-row table)

    @Column(nullable = false, length = 200)
    private String nombre;

    @Column(length = 11)
    private String ruc;

    @Column(length = 300)
    private String direccion;

    @Column(length = 200)
    private String ciudad;

    @Column(length = 50)
    private String telefono;

    @Column(name = "logo_base64", columnDefinition = "TEXT")
    private String logoBase64;
}
