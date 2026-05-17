package com.expressvraem.modules.agencias.dto;

import lombok.Data;

import java.time.LocalDate;

@Data
public class AgenciaRequestDTO {
    private String codigo;
    private String nombre;
    private String ciudad;
    private String direccion;
    private String telefono;
    private String email;
    private String ruc;
    private Long encargadoId;
    private boolean esSedePrincipal;
    private LocalDate fechaApertura;
}
