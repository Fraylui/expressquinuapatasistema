package com.expressvraem.modules.usuarios.dto;

import jakarta.validation.constraints.*;

public record CrearUsuarioDTO(
        @NotBlank(message = "Nombres obligatorio")
        String nombres,

        @NotBlank(message = "Apellidos obligatorio")
        String apellidos,

        @NotBlank(message = "Email obligatorio")
        @Email(message = "Email inválido")
        String email,

        @NotBlank(message = "DNI obligatorio")
        @Size(min = 8, max = 8, message = "DNI debe tener 8 dígitos")
        @Pattern(regexp = "\\d{8}", message = "DNI debe tener 8 dígitos numéricos")
        String dni,

        @NotBlank(message = "Teléfono obligatorio")
        @Pattern(regexp = "9\\d{8}", message = "Teléfono debe tener 9 dígitos y empezar con 9")
        String telefono,

        @NotBlank(message = "Contraseña obligatoria")
        @Size(min = 8, message = "Contraseña mínimo 8 caracteres")
        String password,

        @NotBlank(message = "Rol obligatorio")
        String rol,

        @NotNull(message = "Agencia obligatoria")
        Long agenciaId
) {}
