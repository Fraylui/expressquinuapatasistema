package com.expressvraem.modules.agencias.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;

@Data
public class AgenciaRequestDTO {

    @NotBlank(message = "El código es obligatorio")
    @Size(max = 20, message = "El código no puede superar 20 caracteres")
    private String codigo;

    @NotBlank(message = "El nombre es obligatorio")
    @Size(max = 200, message = "El nombre no puede superar 200 caracteres")
    private String nombre;

    @Size(max = 100, message = "La ciudad no puede superar 100 caracteres")
    private String ciudad;

    @Size(max = 300, message = "La dirección no puede superar 300 caracteres")
    private String direccion;

    @Size(max = 20, message = "El teléfono no puede superar 20 caracteres")
    private String telefono;

    @Email(message = "El email no tiene formato válido")
    @Size(max = 150)
    private String email;

    @Pattern(regexp = "^\\d{11}$", message = "El RUC debe tener exactamente 11 dígitos numéricos")
    private String ruc;

    private Long encargadoId;
    private boolean esSedePrincipal;
    private LocalDate fechaApertura;

    @Pattern(regexp = "^(AGENCIA|SUCURSAL)$", message = "El tipo debe ser AGENCIA o SUCURSAL")
    private String tipo;

    private Long agenciaPadreId;
}
