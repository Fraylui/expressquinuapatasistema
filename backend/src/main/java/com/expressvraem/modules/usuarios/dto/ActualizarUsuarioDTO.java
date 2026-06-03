package com.expressvraem.modules.usuarios.dto;

import jakarta.validation.constraints.*;

public record ActualizarUsuarioDTO(
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

        @Pattern(regexp = "9\\d{8}", message = "Teléfono debe tener 9 dígitos y empezar con 9")
        String telefono,

        String rol,

        Long agenciaId,

        /** Nueva contraseña — null para no cambiarla */
        String nuevaPassword
) {}
