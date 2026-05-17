package com.expressvraem.modules.agencias.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
public class AgenciaResponseDTO {
    private Long id;
    private String codigo;
    private String nombre;
    private String ciudad;
    private String direccion;
    private String telefono;
    private String email;
    private String ruc;
    private Long encargadoId;
    private String encargadoNombre;
    private String estado;
    private boolean esSedePrincipal;
    private LocalDate fechaApertura;
    private LocalDateTime fechaRegistro;
}
