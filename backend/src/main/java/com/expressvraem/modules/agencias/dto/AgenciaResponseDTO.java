package com.expressvraem.modules.agencias.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
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

    // Hierarchy fields
    private String tipo;
    private Long agenciaPadreId;
    private String agenciaPadreNombre;

    @Builder.Default
    private List<AgenciaResponseDTO> sucursales = new ArrayList<>();
}
